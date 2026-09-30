import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { scrubEvent } from "./sentryScrub";

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
});
