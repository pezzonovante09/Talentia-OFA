import { NextRequest } from "next/server";

import { corsJson, corsPreflight } from "@/lib/api-cors";
import { enforceRateLimit, ratelimitApi } from "@/lib/ratelimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authJsonError, verifyAuth } from "@/lib/verifyAuth";

export const runtime = "nodejs";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/**
 * Permanently deletes the authenticated user via Supabase Admin API.
 * DB rows with ON DELETE CASCADE (profiles, progress, analytics, aba sessions) are removed.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, ratelimitApi);
  if (limited) return limited;

  const auth = await verifyAuth(req);
  if (!auth.ok) return authJsonError(req, auth);

  if (!supabaseAdmin) {
    return corsJson(
      { error: "Server auth is not configured" },
      500,
      req,
    );
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(auth.userId);
  if (error) {
    console.error("[account/delete] deleteUser failed", error.message);
    return corsJson({ error: "Could not delete account" }, 500, req);
  }

  return corsJson({ ok: true }, 200, req);
}
