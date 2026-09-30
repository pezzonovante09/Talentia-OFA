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
 * Account deletion — 3 req/10 min per IP. Deletion is rare; a burst means a script
 * or a stolen session, not a parent.
 */
export const ratelimitAccount =
  redis !== null
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "10 m"),
        prefix: "talentia:account",
      })
    : null;

/**
 * Account deletion per user — 3 req/hour, keyed by the verified user id. The IP
 * limit alone lets one stolen session retry from many addresses.
 */
export const ratelimitAccountUser =
  redis !== null
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(3, "1 h"),
        prefix: "talentia:account:user",
      })
    : null;

/**
 * Лимиты на пользователя — по id из проверенного JWT. Лимит по IP один не работает: за
 * школьным NAT и мобильным CGNAT много детей делят адрес и получают ложные 429, а один
 * аккаунт, меняющий адрес, не ограничен ничем (AUDIT.md, «Важно»).
 */
function perUser(limit: number, window: Parameters<typeof Ratelimit.slidingWindow>[1], prefix: string) {
  return redis !== null ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, window), prefix }) : null;
}

function envInt(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Tali — 30 запросов в минуту на пользователя. */
export const ratelimitApiUser = perUser(30, "1 m", "talentia:api:user");

/** Дневной бюджет живого разговора с Tali на пользователя (запросов к модели). */
export const taliDailyUser = perUser(envInt("TALI_DAILY_REQUESTS_PER_USER", 200), "1 d", "talentia:tali:day");

/** Озвучка — 20 запросов в минуту на пользователя. */
export const ratelimitTtsUser = perUser(20, "1 m", "talentia:tts:user");

/**
 * Дневной бюджет озвучки в символах на пользователя: живая озвучка — самая дорогая
 * статья (порядка $100k/мес на 10k детей без потолка). Списывается длиной текста.
 */
export const ttsCharsDailyUser = perUser(envInt("TTS_DAILY_CHARS_PER_USER", 30_000), "1 d", "talentia:tts:chars");

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
 */
export async function enforceRateLimit(
  req: NextRequest,
  limiter: Ratelimit | null,
  /** Ключ окна; по умолчанию IP клиента. Для лимита на пользователя — его id из проверенного JWT. */
  key?: string,
  /** Сколько списать с окна: по умолчанию 1, для бюджета символов — длина текста. */
  rate?: number,
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
  const identifier = key ?? clientIp(req);
  try {
    const { success, limit, remaining, reset } = await (rate ? limiter.limit(identifier, { rate }) : limiter.limit(identifier));
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
