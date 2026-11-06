import { readFileSync } from "node:fs";
import path from "node:path";

import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { beforeSendScrub, scrubEvent, sentryPrivacyOptions } from "./sentryScrub";

const eventWith = (request: Record<string, unknown>, rest: Record<string, unknown> = {}) =>
  ({ type: undefined, request, ...rest }) as unknown as ErrorEvent;

const headersAfter = (headers: Record<string, string>) =>
  scrubEvent(eventWith({ url: "https://proxy/api/v2/tali", headers })).request?.headers;

describe("scrubEvent", () => {
  it("убирает JWT, куки, тело запроса и пользователя", () => {
    const event = {
      type: undefined,
      request: {
        url: "https://proxy/api/v2/tali",
        headers: { Authorization: "Bearer secret.jwt", cookie: "a=b", "content-type": "application/json" },
        data: '{"message":"меня зовут Аля"}',
        cookies: { a: "b" },
      },
      user: { id: "parent-1" },
    } as unknown as ErrorEvent;
    const out = scrubEvent(event);
    expect(out.request?.headers).toEqual({ "content-type": "application/json" });
    expect(out.request?.data).toBeUndefined();
    expect(out.request?.cookies).toBeUndefined();
    expect(out.user).toBeUndefined();
  });

  it.each([
    "x-forwarded-for",
    "x-real-ip",
    "x-vercel-forwarded-for",
    "user-agent",
    "authorization",
    "cookie",
    "x-api-key",
    "x-api-secret",
    "x-talentia-secret",
    "x-some-future-header",
  ])("заголовок %s отбрасывается", (name) => {
    expect(headersAfter({ [name]: "value", "content-type": "application/json" })).toEqual({
      "content-type": "application/json",
    });
  });

  it("заголовок в другом регистре тоже отбрасывается (X-Forwarded-For, USER-AGENT)", () => {
    expect(headersAfter({ "X-Forwarded-For": "1.2.3.4", "USER-AGENT": "Mozilla" })).toEqual({});
  });

  it("безопасные заголовки остаются, имя сохраняется как пришло (регистр)", () => {
    expect(headersAfter({ "Content-Type": "application/json", ACCEPT: "*/*", "content-length": "12" })).toEqual({
      "Content-Type": "application/json",
      ACCEPT: "*/*",
      "content-length": "12",
    });
  });

  it("событие без заголовков в запросе не падает и даёт пустые заголовки", () => {
    expect(scrubEvent(eventWith({ url: "https://proxy/x" })).request?.headers).toEqual({});
  });

  it("событие без request не падает", () => {
    const out = scrubEvent({ message: "boom" } as unknown as ErrorEvent);
    expect(out.request).toBeUndefined();
  });

  it("убирает query_string, cookies, data и env запроса", () => {
    const out = scrubEvent(
      eventWith({
        url: "https://proxy/api/v2/tali",
        method: "POST",
        query_string: "childId=abc",
        cookies: { a: "b" },
        data: "тело",
        env: { REMOTE_ADDR: "1.2.3.4" },
        headers: {},
      }),
    );
    expect(Object.keys(out.request ?? {}).sort()).toEqual(["headers", "method", "url"]);
  });

  it("метод запроса сохраняется", () => {
    expect(scrubEvent(eventWith({ method: "POST", headers: {} })).request?.method).toBe("POST");
  });

  it.each([
    ["строка запроса", "https://proxy/api/v2/tali?childId=abc&token=xyz", "https://proxy/api/v2/tali"],
    ["фрагмент", "https://proxy/api/ping#access_token=xyz", "https://proxy/api/ping"],
    ["и то и другое", "https://proxy/a?x=1#y", "https://proxy/a"],
    ["чистый URL", "https://proxy/api/ping", "https://proxy/api/ping"],
  ])("URL: %s режется", (_, url, expected) => {
    expect(scrubEvent(eventWith({ url, headers: {} })).request?.url).toBe(expected);
  });

  it("убирает user, breadcrumbs, server_name и contexts.device, остальные contexts оставляет", () => {
    const out = scrubEvent({
      user: { id: "p", ip_address: "1.2.3.4" },
      breadcrumbs: [{ message: "fetch /api" }],
      server_name: "host-1",
      contexts: { device: { name: "iPhone Ани" }, runtime: { name: "node" } },
    } as unknown as ErrorEvent);
    expect(out.user).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.server_name).toBeUndefined();
    expect(out.contexts).toEqual({ runtime: { name: "node" } });
  });

  it("транзакция чистится той же функцией (beforeSendTransaction)", () => {
    const tx = {
      type: "transaction",
      request: { url: "https://proxy/a?b=1", headers: { "x-forwarded-for": "1.2.3.4" } },
      user: { id: "p" },
    } as unknown as ErrorEvent;
    const out = sentryPrivacyOptions.beforeSendTransaction(tx);
    expect(out.request).toEqual({ url: "https://proxy/a", headers: {} });
    expect(out.user).toBeUndefined();
  });

  it("beforeSendScrub чистит событие ошибки", () => {
    const out = beforeSendScrub(eventWith({ headers: { cookie: "a=b" } }, { user: { id: "p" } }));
    expect(out.request?.headers).toEqual({});
    expect(out.user).toBeUndefined();
  });
});

describe("sentryPrivacyOptions", () => {
  it("не отправляет PII, трассировку и хлебные крошки", () => {
    expect(sentryPrivacyOptions).toMatchObject({ sendDefaultPii: false, tracesSampleRate: 0, maxBreadcrumbs: 0 });
  });

  it("очистка подключена и к ошибкам, и к транзакциям", () => {
    expect(sentryPrivacyOptions.beforeSend).toBe(beforeSendScrub);
    expect(sentryPrivacyOptions.beforeSendTransaction).toBe(scrubEvent);
  });
});

describe("все Sentry.init используют sentryPrivacyOptions", () => {
  const src = path.resolve(__dirname, "..");
  it.each(["sentry.server.config.ts", "sentry.edge.config.ts", "instrumentation-client.ts"])(
    "%s раскрывает sentryPrivacyOptions в init",
    (file) => {
      const text = readFileSync(path.join(src, file), "utf8");
      expect(text).toMatch(/Sentry\.init\(/);
      expect(text).toMatch(/\.\.\.sentryPrivacyOptions/);
      expect(text).toMatch(/from "@\/lib\/sentryScrub"/);
    },
  );

  it("ни один init не включает PII и трассировку вручную", () => {
    for (const file of ["sentry.server.config.ts", "sentry.edge.config.ts", "instrumentation-client.ts"]) {
      const text = readFileSync(path.join(src, file), "utf8");
      expect(text, file).not.toMatch(/sendDefaultPii:\s*true/);
      expect(text, file).not.toMatch(/Sentry\.setUser/);
    }
  });
});
