import type { NextRequest } from "next/server";

import {
  AccountDeletionBodySchema,
  deleteAccount,
  emailOtpVerifiedAt,
  isRecentEmailOtp,
  type AccountDeletionPort,
} from "@/lib/accountDeletion";
import { corsJson, corsPreflight } from "@/lib/api-cors";
import { enforceRateLimit, ratelimitAccount, ratelimitAccountUser } from "@/lib/ratelimit";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { bearerToken, supabaseAsUser } from "@/lib/supabaseUser";
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
 *
 * Перед вызовом приложение проводит родителя через вход кодом из письма
 * (`signInWithOtp` без создания пользователя, затем `verifyOtp`) — роут принимает
 * только JWT, в `amr` которого такой вход не старше пяти минут. Если ответ 502 после
 * частичного успеха, при повторе приложение убирает из решений детей из
 * `transferred`: они уже не его.
 */
export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, ratelimitAccount);
  if (limited) return limited;
  const auth = await verifyAuth(req);
  if (!auth.ok) return authJsonError(req, auth);

  const perUser = await enforceRateLimit(req, ratelimitAccountUser, auth.userId);
  if (perUser) return perUser;

  const jwt = bearerToken(req);
  if (!isRecentEmailOtp(emailOtpVerifiedAt(jwt), Math.floor(Date.now() / 1000))) {
    return corsJson({ error: "Email code confirmation required" }, 401, req);
  }

  const asUser = supabaseAsUser(jwt);
  if (!asUser || !supabaseAdmin) {
    return corsJson({ error: "Server is not configured" }, 500, req);
  }

  const parsed = AccountDeletionBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return corsJson({ error: "Invalid request", details: parsed.error.flatten() }, 400, req);
  }

  // Список своих детей и передачи — под JWT пользователя: права проверяет база
  // через RLS и функции, а не этот код. Service-role — только для удаления.
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
