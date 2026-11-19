import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  setUser: vi.fn(),
  setContext: vi.fn(),
  setExtra: vi.fn(),
  setTag: vi.fn(),
}));

import { reportError } from "./reportError";

const KID = "00000000-0000-4000-8000-0000000000c1";

beforeEach(() => {
  vi.clearAllMocks();
});

function captured() {
  const [err, hint] = vi.mocked(Sentry.captureException).mock.calls[0] as [Error, Record<string, unknown>];
  return { err, hint };
}

describe("reportError", () => {
  it("передаёт ошибку в Sentry с тегом области", () => {
    reportError("v2/tali", new TypeError("boom"));
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(captured().hint).toEqual({ tags: { scope: "v2/tali" } });
  });

  it("не вызывает setUser и не кладёт контекст", () => {
    reportError("v2/tali", new Error("x"));
    expect(Sentry.setUser).not.toHaveBeenCalled();
    expect(Sentry.setContext).not.toHaveBeenCalled();
    expect(Sentry.setExtra).not.toHaveBeenCalled();
  });

  it("в hint нет ни extra, ни user, ни contexts", () => {
    reportError("v2/tali", new Error("x"));
    const { hint } = captured();
    expect(Object.keys(hint)).toEqual(["tags"]);
  });

  it("текст сообщения исходной ошибки в событие не попадает (в нём бывают id ребёнка и реплики)", () => {
    reportError("v2/tali", new Error(`child ${KID} said Секретное слово`));
    const { err } = captured();
    const everything = `${err.name}|${err.message}|${err.stack}`;
    expect(everything).not.toContain(KID);
    expect(everything).not.toContain("Секретное слово");
  });

  it("в событии остаются область и класс ошибки", () => {
    reportError("account/delete", new RangeError("с id " + KID));
    const { err } = captured();
    expect(err.message).toBe("account/delete: RangeError");
  });

  it("стек сохраняет только строки кадров, не первую строку с сообщением", () => {
    const original = new Error(`leak ${KID}`);
    original.stack = `Error: leak ${KID}\n    at handler (/app/route.ts:10:5)\n    at next (/app/n.ts:1:1)`;
    reportError("v2/tali", original);
    const { err } = captured();
    expect(err.stack).toContain("at handler (/app/route.ts:10:5)");
    expect(err.stack).not.toContain(KID);
  });

  it("не-Error (строка, объект с id) — не падает и не передаёт содержимое", () => {
    reportError("v2/tali", `secret ${KID}`);
    reportError("v2/tali", { childId: KID });
    for (const [err] of vi.mocked(Sentry.captureException).mock.calls as [Error][]) {
      expect(`${err.message}${err.stack}`).not.toContain(KID);
    }
    expect(Sentry.captureException).toHaveBeenCalledTimes(2);
  });
});
