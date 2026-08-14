import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { buildCorsHeaders } from "@/lib/cors-strict";

function redisFromEnv(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = redisFromEnv();

/** Tali, reports, ping — 20 req/min per IP (global sliding window). */
export const ratelimitApi =
  redis !== null
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, "1 m"),
        prefix: "talentia:api",
      })
    : null;

/** TTS synthesis — 10 req/min per IP (stricter). */
export const ratelimitTts =
  redis !== null
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"),
        prefix: "talentia:tts",
      })
    : null;

/**
 * Tali chat — per-user daily cap, keyed by authenticated user id (not IP).
 * Bounds worst-case DeepSeek spend from a single account even though the IP-based
 * ratelimitApi limit is shared across all routes and resets every minute. 300/day is
 * generous for realistic lesson-companion usage while still capping runaway cost.
 */
export const ratelimitTaliUserDaily =
  redis !== null
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(300, "1 d"),
        prefix: "talentia:tali:user:daily",
      })
    : null;

/** True on Vercel production deployments (or when NODE_ENV is explicitly production). */
function isProductionEnv(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

/**
 * Client IP for rate limiting.
 *
 * On Vercel, prefer `x-vercel-forwarded-for` (platform-set) over the first hop of
 * `x-forwarded-for`, which a client can spoof when the origin is hit directly.
 * Assumption for production: deploy behind Vercel (or another edge that overwrites XFF).
 */
function clientIp(req: NextRequest): string {
  const vercelFwd = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercelFwd) return vercelFwd;
  // Fallback: last hop is more likely to be the trusted proxy's view than XFF[0].
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1]!;
  }
  return req.headers.get("x-real-ip")?.trim() || "anonymous";
}

/**
 * Returns a 429 JSON response if over limit, a 503 if rate limiting is required but
 * unavailable in production, or null if the request is allowed.
 *
 * Rate limiting is fail-closed in production: if Upstash credentials are missing,
 * requests are rejected instead of silently bypassing the limiter (which would
 * otherwise let anyone with a valid JWT hit the AI/TTS providers without limit).
 * In non-production environments (local dev, previews without Redis) requests are
 * still allowed through, with a warning logged, so local development isn't blocked.
 *
 * `key` overrides the default IP-based bucket key — pass the authenticated user id
 * for a per-user limiter (only available after verifyAuth succeeds, unlike IP which
 * is known pre-auth).
 */
export async function enforceRateLimit(
  req: NextRequest,
  limiter: Ratelimit | null,
  key?: string,
): Promise<NextResponse | null> {
  if (!limiter) {
    if (isProductionEnv()) {
      console.error(
        "[ratelimit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are not configured in " +
          "production. Refusing request instead of allowing unmetered access.",
      );
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503, headers: buildCorsHeaders(req) },
      );
    }
    console.warn(
      "[ratelimit] Rate limiting is disabled (no Upstash credentials configured). " +
        "Allowing request because this is not a production environment.",
    );
    return null;
  }
  const rlKey = key ?? clientIp(req);
  try {
    const { success, limit, remaining, reset } = await limiter.limit(rlKey);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            ...buildCorsHeaders(req),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
          },
        },
      );
    }
    return null;
  } catch (err) {
    console.error("[ratelimit] Upstash limiter.limit failed — refusing request:", err);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503, headers: buildCorsHeaders(req) },
    );
  }
}
