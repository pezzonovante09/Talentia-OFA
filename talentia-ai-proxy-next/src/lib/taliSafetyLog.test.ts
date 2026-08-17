import { describe, expect, it, vi, beforeEach } from "vitest";

const { insertMock, fromMock, captureExceptionMock, gteMock, eqMock, selectMock } = vi.hoisted(() => {
  const insertMock = vi.fn();
  const gteMock = vi.fn();
  const eqMock = vi.fn();
  const selectMock = vi.fn();
  const fromMock = vi.fn(() => ({ insert: insertMock, select: selectMock }));
  const captureExceptionMock = vi.fn();
  return { insertMock, fromMock, captureExceptionMock, gteMock, eqMock, selectMock };
});

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: fromMock },
}));

vi.mock("@/lib/sentry", () => ({
  captureException: captureExceptionMock,
}));

import { logTaliSafetyEvent, SAFETY_BURST_THRESHOLD } from "./taliSafetyLog";

/** Chainable select().eq().eq().gte() mock resolving to the given { count, error }. */
function mockBurstCount(result: { count: number | null; error: unknown }) {
  const chain = { eq: eqMock, gte: gteMock };
  eqMock.mockReturnValue(chain);
  gteMock.mockResolvedValue(result);
  selectMock.mockReturnValue(chain);
}

describe("logTaliSafetyEvent", () => {
  beforeEach(() => {
    fromMock.mockClear();
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    captureExceptionMock.mockClear();
    eqMock.mockReset();
    gteMock.mockReset();
    selectMock.mockReset();
    mockBurstCount({ count: 1, error: null });
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

  it("does not query for a burst when the insert itself failed", async () => {
    insertMock.mockResolvedValue({ error: { message: "boom" } });
    await logTaliSafetyEvent({ userId: "user-5", side: "input", category: "hate" });
    expect(selectMock).not.toHaveBeenCalled();
  });
});

describe("logTaliSafetyEvent — burst detection", () => {
  beforeEach(() => {
    fromMock.mockClear();
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    captureExceptionMock.mockClear();
    eqMock.mockReset();
    gteMock.mockReset();
    selectMock.mockReset();
  });

  it("queries the same user_id + category within the burst window", async () => {
    mockBurstCount({ count: 1, error: null });
    await logTaliSafetyEvent({ userId: "user-1", side: "input", category: "self_harm" });

    expect(selectMock).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(eqMock).toHaveBeenNthCalledWith(1, "user_id", "user-1");
    expect(eqMock).toHaveBeenNthCalledWith(2, "category", "self_harm");
    expect(gteMock).toHaveBeenCalledWith("created_at", expect.any(String));
  });

  it(`alerts exactly when the count first reaches the threshold (${SAFETY_BURST_THRESHOLD})`, async () => {
    mockBurstCount({ count: SAFETY_BURST_THRESHOLD, error: null });
    await logTaliSafetyEvent({ userId: "user-1", side: "input", category: "self_harm" });

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [err, extra] = captureExceptionMock.mock.calls[0];
    expect((err as Error).message).toContain("tali_safety_burst");
    expect((err as Error).message).toContain("self_harm");
    expect(extra).toEqual({ userId: "user-1", category: "self_harm", count: SAFETY_BURST_THRESHOLD });
  });

  it("does not alert below the threshold", async () => {
    mockBurstCount({ count: SAFETY_BURST_THRESHOLD - 1, error: null });
    await logTaliSafetyEvent({ userId: "user-1", side: "input", category: "self_harm" });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("does not re-alert past the threshold (fires once, not on every hit)", async () => {
    mockBurstCount({ count: SAFETY_BURST_THRESHOLD + 5, error: null });
    await logTaliSafetyEvent({ userId: "user-1", side: "input", category: "self_harm" });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("is best-effort: a burst-query error does not throw or alert", async () => {
    mockBurstCount({ count: null, error: { message: "count query failed" } });
    await expect(
      logTaliSafetyEvent({ userId: "user-1", side: "input", category: "self_harm" }),
    ).resolves.toBeUndefined();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("is best-effort: select() itself throwing does not throw or alert", async () => {
    selectMock.mockImplementationOnce(() => {
      throw new Error("network down");
    });
    await expect(
      logTaliSafetyEvent({ userId: "user-1", side: "input", category: "self_harm" }),
    ).resolves.toBeUndefined();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });
});
