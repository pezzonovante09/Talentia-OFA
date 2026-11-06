import type { SupabaseClient } from "@supabase/supabase-js";

/** Области согласия, которые проверяет прокси перед обращением к внешним сервисам. */
export type ServerConsentScope = "companion_ai" | "voice_asr";

/**
 * Ответ проверки согласия. Три состояния, а не булево (раунд 3, `backend-auditor`, В-8): сбой
 * Supabase — не «согласие отозвано». Клиент на `denied` (403) может решить, что согласия нет, а на
 * `unavailable` (503) обязан просто ответить из банка реплик на устройстве.
 */
export type ConsentCheck = "granted" | "denied" | "unavailable";

/**
 * Дал ли родитель согласие для этого ребёнка — от имени пользователя.
 *
 * `has_consent` в базе отвечает только тому, у кого есть доступ к ребёнку. Поэтому
 * `childId` из тела запроса не может «одолжить» согласие чужого ребёнка: для
 * чужого ответ всегда «нет». `consent_active` (только service_role) — для фоновых
 * заданий без пользователя, не для роутов.
 *
 * Только `data === true` — `granted`: без подтверждённого согласия наружу не уходит ничего. Ответ
 * без ошибки, но не `true` (`false`, `null`, строка), — `denied`. Ошибка RPC или исключение
 * (сеть, Supabase) — `unavailable`; в лог идёт только код ошибки, без `childId` и без текста.
 */
export async function hasConsent(
  asUser: SupabaseClient,
  childId: string,
  scope: ServerConsentScope,
): Promise<ConsentCheck> {
  try {
    const { data, error } = await asUser.rpc("has_consent", { target_child: childId, consent_scope: scope });
    if (error) {
      console.error("[consent] has_consent unavailable", (error as { code?: string }).code ?? "unknown");
      return "unavailable";
    }
    return data === true ? "granted" : "denied";
  } catch (e: unknown) {
    console.error("[consent] has_consent unavailable", e instanceof Error ? e.name : "unknown");
    return "unavailable";
  }
}
