import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

import {
  AccountDeletionBodySchema,
  deleteAccount,
  isFreshToken,
  tokenIssuedAt,
  type AccountDeletionPort,
} from "@/lib/accountDeletion";
import { corsJson, corsPreflight } from "@/lib/api-cors";
import { enforceRateLimit, ratelimitAccount } from "@/lib/ratelimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { authJsonError, verifyAuth } from "@/lib/verifyAuth";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

/**
 * Удаление аккаунта взрослого вместе с решением по каждому ребёнку: передать
 * второму родителю или удалить. Логика — `src/lib/accountDeletion.ts`.
 *
 * Идентификатор пользователя берётся только из проверенного JWT; в теле его нет.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, ratelimitAccount);
  if (limited) return limited;
  const auth = await verifyAuth(req);
  if (!auth.ok) return authJsonError(req, auth);

  const jwt = (req.headers.get("authorization") ?? "").slice(7).trim();
  if (!isFreshToken(tokenIssuedAt(jwt), Math.floor(Date.now() / 1000))) {
    return corsJson({ error: "Re-authentication required" }, 401, req);
  }

  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey || !supabaseAdmin) {
    return corsJson({ error: "Server is not configured" }, 500, req);
  }

  const parsed = AccountDeletionBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return corsJson({ error: "Invalid request", details: parsed.error.flatten() }, 400, req);
  }

  // Под JWT пользователя: права на передачу и список своих детей проверяет база
  // через RLS и функции, а не этот код.
  const asUser = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const admin = supabaseAdmin;

  const port: AccountDeletionPort = {
    async ownedChildren() {
      const { data, error } = await asUser
        .from("child_guardians")
        .select("child_id")
        .eq("user_id", auth.userId)
        .eq("role", "owner");
      if (error) throw error;
      return (data ?? []).map((r: { child_id: string }) => r.child_id);
    },
    async transfer(childId, newOwnerId) {
      const { error } = await asUser.rpc("transfer_child_ownership", {
        target_child: childId,
        new_owner: newOwnerId,
      });
      if (error) throw error;
    },
    async deleteUser(userId) {
      // false — жёсткое удаление: на мягкое триггеры базы не срабатывают.
      const { error } = await admin.auth.admin.deleteUser(userId, false);
      if (error) throw error;
    },
  };

  try {
    const result = await deleteAccount(auth.userId, parsed.data, port);
    if (!result.ok) {
      return corsJson({ error: result.error, transferred: result.transferred ?? [] }, result.status, req);
    }
    return corsJson(result, 200, req);
  } catch (e: unknown) {
    console.error("[account/delete] Server error", e instanceof Error ? e.message : "unknown");
    return corsJson({ error: "Server error" }, 500, req);
  }
}
