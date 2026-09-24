import type { SupabaseClient } from "@supabase/supabase-js";

/** Области согласия, которые проверяет прокси перед обращением к внешним сервисам. */
export type ServerConsentScope = "companion_ai" | "voice_asr";

/**
 * Дал ли родитель согласие для этого ребёнка — от имени пользователя.
 *
 * `has_consent` в базе отвечает только тому, у кого есть доступ к ребёнку. Поэтому
 * `childId` из тела запроса не может «одолжить» согласие чужого ребёнка: для
 * чужого ответ всегда «нет». `consent_active` (только service_role) — для фоновых
 * заданий без пользователя, не для роутов.
 *
 * Любая ошибка — «нет»: без подтверждённого согласия наружу не уходит ничего.
 */
export async function hasConsent(
  asUser: SupabaseClient,
  childId: string,
  scope: ServerConsentScope,
): Promise<boolean> {
  try {
    const { data, error } = await asUser.rpc("has_consent", { target_child: childId, consent_scope: scope });
    return !error && data === true;
  } catch {
    return false;
  }
}
