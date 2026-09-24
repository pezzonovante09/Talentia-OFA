import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Клиент Supabase **от имени пользователя**: запросы идут с его JWT, и права
 * проверяет база — RLS и функции с `auth.uid()`, — а не код прокси.
 *
 * Для всего, что касается конкретного ребёнка, использовать этот клиент, а не
 * `supabaseAdmin`: service-role обходит RLS, и тогда `childId` из тела запроса
 * становится единственной «проверкой» доступа.
 *
 * Требует SUPABASE_URL и SUPABASE_ANON_KEY; без них — `null`.
 */
export function supabaseAsUser(jwt: string): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey || !jwt) return null;
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

/** Токен из заголовка `Authorization: Bearer …`. Проверку подписи делает `verifyAuth`. */
export function bearerToken(req: Request): string {
  const raw = req.headers.get("authorization") ?? "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
}
