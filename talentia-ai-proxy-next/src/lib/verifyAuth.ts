import { NextRequest, NextResponse } from "next/server";

import { buildCorsHeaders } from "@/lib/cors-strict";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type VerifyAuthOk = { ok: true; userId: string };
export type VerifyAuthFail = { ok: false; error: string; status: number };
export type VerifyAuthResult = VerifyAuthOk | VerifyAuthFail;

/**
 * Validates `Authorization: Bearer <jwt>` using the Supabase service-role client.
 */
export async function verifyAuth(req: NextRequest): Promise<VerifyAuthResult> {
  if (!supabaseAdmin) {
    // имена переменных — только в лог, клиенту 503 без устройства деплоя (К11)
    console.error("[verifyAuth] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured");
    return { ok: false, error: "Service unavailable", status: 503 };
  }

  const raw = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!raw || !raw.toLowerCase().startsWith("bearer ")) {
    return { ok: false, error: "Missing or invalid Authorization header", status: 401 };
  }

  const jwt = raw.slice(7).trim();
  if (!jwt) {
    return { ok: false, error: "Missing bearer token", status: 401 };
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(jwt);

  if (error || !user) {
    return {
      ok: false,
      error: "Unauthorized",
      status: 401,
    };
  }

  // Анонимная сессия Supabase — не родитель: без неё любой получил бы ИИ и озвучку за
  // счёт проекта под одним лимитом по IP.
  if (user.is_anonymous) {
    return { ok: false, error: "Anonymous sessions are not allowed", status: 403 };
  }

  return { ok: true, userId: user.id };
}

export function authJsonError(req: NextRequest, auth: VerifyAuthFail): NextResponse {
  return NextResponse.json(
    { error: auth.error },
    { status: auth.status, headers: buildCorsHeaders(req) },
  );
}
