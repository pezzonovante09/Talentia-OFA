import { createHash, timingSafeEqual } from "node:crypto";

import { buildCorsHeaders } from "@/lib/cors-strict";

const HEADER = "x-talentia-secret";

function hashUtf8(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

/**
 * When TALENTIA_API_SECRET is unset, verification is skipped (backward-compatible local/dev).
 * When set, requests must send matching X-Talentia-Secret (compared via SHA-256 + timingSafeEqual).
 *
 * This fails OPEN when unset — fine for its current only use (gating /api/ping, a
 * data-free health check with its own rate limit), but this must never become the
 * sole gate on a route that touches user or child data. Those routes need
 * verifyAuth + verifyParentalConsent (see verifyAuth.ts), which fail closed.
 */
export function verifyTalentiaSecret(req: Request): Response | null {
  const expected = process.env.TALENTIA_API_SECRET?.trim();
  if (!expected) return null;

  const provided = req.headers.get(HEADER) ?? "";
  const a = hashUtf8(provided);
  const b = hashUtf8(expected);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        ...buildCorsHeaders(req),
      },
    });
  }

  return null;
}
