import { NextRequest } from "next/server";
import type { Ratelimit } from "@upstash/ratelimit";
import { afterEach, describe, expect, it, vi } from "vitest";

import { enforceRateLimit } from "./ratelimit";

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/test", { headers });
}

function mockLimiter(result: { success: boolean; limit: number; remaining: number; reset: number }) {
  return {
    limit: vi.fn().mockResolvedValue(result),
  } as unknown as Ratelimit;
}

describe("enforceRateLimit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed (503) when no limiter is configured in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await enforceRateLimit(makeRequest(), null);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(503);
  });

  it("fails closed (503) on Vercel production even if NODE_ENV isn't 'production'", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const res = await enforceRateLimit(makeRequest(), null);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(503);
  });

  it("allows the request through (fail-open) when no limiter is configured outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");
    const res = await enforceRateLimit(makeRequest(), null);
    expect(res).toBeNull();
  });

  it("prefers x-vercel-forwarded-for, then the last XFF hop", async () => {
    const limiter = mockLimiter({ success: true, limit: 20, remaining: 19, reset: Date.now() + 1000 });
    await enforceRateLimit(
      makeRequest({ "x-vercel-forwarded-for": "10.0.0.1", "x-forwarded-for": "1.2.3.4, 5.6.7.8" }),
      limiter,
    );
    expect(limiter.limit).toHaveBeenCalledWith("10.0.0.1");

    const limiter2 = mockLimiter({ success: true, limit: 20, remaining: 19, reset: Date.now() + 1000 });
    await enforceRateLimit(makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }), limiter2);
    expect(limiter2.limit).toHaveBeenCalledWith("5.6.7.8");
  });

  it("allows the request when under the limit", async () => {
    const limiter = mockLimiter({ success: true, limit: 20, remaining: 19, reset: Date.now() + 1000 });
    const res = await enforceRateLimit(makeRequest({ "x-forwarded-for": "1.2.3.4" }), limiter);
    expect(res).toBeNull();
    expect(limiter.limit).toHaveBeenCalledWith("1.2.3.4");
  });

  it("returns 429 with rate-limit headers when over the limit", async () => {
    const limiter = mockLimiter({ success: false, limit: 20, remaining: 0, reset: 1234567890 });
    const res = await enforceRateLimit(makeRequest({ "x-forwarded-for": "5.6.7.8" }), limiter);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(429);
    expect(res?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res?.headers.get("X-RateLimit-Reset")).toBe("1234567890");
  });

  it("falls back to x-real-ip, then 'anonymous', when x-forwarded-for is absent", async () => {
    const limiter = mockLimiter({ success: true, limit: 20, remaining: 19, reset: Date.now() });
    await enforceRateLimit(makeRequest({ "x-real-ip": "9.9.9.9" }), limiter);
    expect(limiter.limit).toHaveBeenCalledWith("9.9.9.9");

    const limiter2 = mockLimiter({ success: true, limit: 20, remaining: 19, reset: Date.now() });
    await enforceRateLimit(makeRequest(), limiter2);
    expect(limiter2.limit).toHaveBeenCalledWith("anonymous");
  });

  it("fails closed (503) when the Upstash limiter throws", async () => {
    const limiter = {
      limit: vi.fn().mockRejectedValue(new Error("redis down")),
    } as unknown as Ratelimit;
    const res = await enforceRateLimit(makeRequest({ "x-forwarded-for": "1.1.1.1" }), limiter);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(503);
  });
});

describe("бюджет по длине", () => {
  it("списывает с окна длину текста, когда она передана", async () => {
    const limiter = { limit: vi.fn(async () => ({ success: true, limit: 30000, remaining: 29000, reset: Date.now() })) };
    await enforceRateLimit(makeRequest(), limiter as never, "parent-1", 1000);
    expect(limiter.limit).toHaveBeenCalledWith("parent-1", { rate: 1000 });
  });
});
