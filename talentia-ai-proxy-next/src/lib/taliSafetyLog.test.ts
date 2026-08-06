import { describe, expect, it, vi, beforeEach } from "vitest";

const { insertMock, fromMock } = vi.hoisted(() => {
  const insertMock = vi.fn();
  const fromMock = vi.fn(() => ({ insert: insertMock }));
  return { insertMock, fromMock };
});

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: fromMock },
}));

import { logTaliSafetyEvent } from "./taliSafetyLog";

describe("logTaliSafetyEvent", () => {
  beforeEach(() => {
    fromMock.mockClear();
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
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

  it("never throws when the insert fails", async () => {
    insertMock.mockResolvedValue({ error: { message: "boom" } });
    await expect(
      logTaliSafetyEvent({ userId: "user-3", side: "input", category: "hate" }),
    ).resolves.toBeUndefined();
  });

  it("never throws when supabaseAdmin.from itself throws", async () => {
    fromMock.mockImplementationOnce(() => {
      throw new Error("network down");
    });
    await expect(
      logTaliSafetyEvent({ userId: "user-4", side: "output", category: "violence" }),
    ).resolves.toBeUndefined();
  });
});
