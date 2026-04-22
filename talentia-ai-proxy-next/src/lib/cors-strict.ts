/**
 * Strict CORS: no wildcard. React Native fetch typically sends no Origin — we omit
 * Access-Control-Allow-Origin in that case (native clients are not browser-CORS-bound).
 * Browser / Expo Web: echo origin only if listed in ALLOWED_CORS_ORIGINS.
 */

function parseAllowedOrigins(): Set<string> {
  const raw = process.env.ALLOWED_CORS_ORIGINS?.trim() ?? "";
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

let cached: Set<string> | null = null;
function allowedOrigins(): Set<string> {
  if (!cached) cached = parseAllowedOrigins();
  return cached;
}

/**
 * Builds CORS headers for this request.
 * - Missing / "null" Origin: allowlist for native apps — no ACAO header.
 * - Known browser origin in ALLOWED_CORS_ORIGINS: echo that origin.
 */
export function buildCorsHeaders(req: Request | null): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Talentia-Secret",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (!req) return base;

  const origin = req.headers.get("origin");
  if (!origin || origin === "null") {
    return base;
  }

  if (allowedOrigins().has(origin)) {
    return {
      ...base,
      "Access-Control-Allow-Origin": origin,
    };
  }

  return base;
}
