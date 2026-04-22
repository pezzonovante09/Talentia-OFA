import { createHash, timingSafeEqual } from "node:crypto";

import { buildCorsHeaders } from "@/lib/cors-strict";

const HEADER = "x-talentia-secret";

function hashUtf8(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

/**
 * When TALENTIA_API_SECRET is unset, verification is skipped (backward-compatible local/dev).
 * When set, requests must send matching X-Talentia-Secret (compared via SHA-256 + timingSafeEqual).
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
