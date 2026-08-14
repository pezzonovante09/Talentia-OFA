import { describe, expect, it, vi, beforeEach } from "vitest";

const { insertMock, fromMock, captureExceptionMock } = vi.hoisted(() => {
  const insertMock = vi.fn();
  const fromMock = vi.fn(() => ({ insert: insertMock }));
  const captureExceptionMock = vi.fn();
  return { insertMock, fromMock, captureExceptionMock };
});

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: fromMock },
}));

vi.mock("@/lib/sentry", () => ({
  captureException: captureExceptionMock,
}));

import { logTaliSafetyEvent } from "./taliSafetyLog";

describe("logTaliSafetyEvent", () => {
  beforeEach(() => {
    fromMock.mockClear();
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    captureExceptionMock.mockClear();
  });

  it("inserts a row with the expected shape, no raw message text", async () => {
    await logTaliSafetyEvent({
      userId: "user-1",
      side: "input",
      category: "self_harm",
      mode: "chat",
      language: "ru",
    });

    expect(fromMock).toHaveBeenCalledWith("tali_safety_events");
    expect(insertMock).toHaveBeenCalledWith({
      user_id: "user-1",
      side: "input",
      category: "self_harm",
      mode: "chat",
      language: "ru",
    });
  });

  it("defaults category to 'unknown' and mode/language to null when omitted", async () => {
    await logTaliSafetyEvent({ userId: "user-2", side: "output" });

    expect(insertMock).toHaveBeenCalledWith({
      user_id: "user-2",
      side: "output",
      category: "unknown",
      mode: null,
      language: null,
    });
  });

  it("never throws when the insert fails, and reports it via captureException", async () => {
    insertMock.mockResolvedValue({ error: { message: "boom" } });
    await expect(
      logTaliSafetyEvent({ userId: "user-3", side: "input", category: "hate" }),
    ).resolves.toBeUndefined();

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [err, extra] = captureExceptionMock.mock.calls[0];
    expect(String(err)).toContain("boom");
    expect(extra).toEqual({ userId: "user-3", side: "input" });
  });

  it("never throws when supabaseAdmin.from itself throws, and reports it via captureException", async () => {
    fromMock.mockImplementationOnce(() => {
      throw new Error("network down");
    });
    await expect(
      logTaliSafetyEvent({ userId: "user-4", side: "output", category: "violence" }),
    ).resolves.toBeUndefined();

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [err, extra] = captureExceptionMock.mock.calls[0];
    expect((err as Error).message).toBe("network down");
    expect(extra).toEqual({ context: "logTaliSafetyEvent", userId: "user-4", side: "output" });
  });
});
