import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 60;

/**
 * In-memory sliding window per IP. Works for single-instance / dev; on Vercel Edge each
 * isolate has its own memory — limits are best-effort only.
 *
 * @todo Replace with @upstash/ratelimit + Vercel KV (or Redis) for accurate global limits.
 */
const buckets = new Map<string, number[]>();

export function clientIpFromRequest(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export function rateLimitAllow(ip: string): boolean {
  const now = Date.now();
  let ts = buckets.get(ip) ?? [];
  ts = ts.filter((t) => now - t < WINDOW_MS);
  if (ts.length >= MAX_REQUESTS) {
    buckets.set(ip, ts);
    return false;
  }
  ts.push(now);
  buckets.set(ip, ts);

  if (buckets.size > 10_000) {
    for (const [k, arr] of buckets) {
      if (arr.every((t) => now - t >= WINDOW_MS)) buckets.delete(k);
      if (buckets.size < 5000) break;
    }
  }
  return true;
}

export function rateLimitedResponse(): NextResponse {
  return new NextResponse(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: { "Content-Type": "application/json" },
  });
}
