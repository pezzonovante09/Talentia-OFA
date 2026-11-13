/**
 * Живой разговор с Tali через ИИ — **последним этапом** (решение владельца №66, №102). Пока флаг не
 * включён, маршрут `/api/v2/tali` отвечает `ai_disabled` сразу, до любых проверок и до обращения к
 * провайдеру. Одной строки в `consent_texts` и ключа в окружении для включения мало: нужен ещё и
 * `TALI_AI_ENABLED=true` — осознанное решение после договора с провайдером и юриста
 * (раунд 3, `child-privacy-compliance`, В3).
 */
export function aiEnabled(
  env: Record<string, string | undefined> = process.env,
  provider: AiProvider | null = AI_PROVIDER,
): boolean {
  return provider !== null && env.TALI_AI_ENABLED === "true";
}

/** Провайдер модели: как назван в тексте согласия, куда ходит запрос, какая модель, где ключ. */
export type AiProvider = {
  /** Как провайдер назван в тексте согласия. */
  readonly name: string;
  readonly endpoint: string;
  readonly model: string;
  readonly apiKeyEnv: string;
};

/**
 * Провайдер модели — в конфиг, а не по всему коду: его имя нужно тексту согласия на ИИ, который
 * утверждает юрист (область `companion_ai`). Меняется только вместе с текстом согласия.
 *
 * **Провайдера нет** (взгляд ментора 2026-10-23, П3; решение владельца №4): DeepSeek убран из кода —
 * КНР без решения об адекватности по GDPR и закону КР, условия провайдера допускают обучение на входе.
 * Пока здесь `null`, `aiEnabled()` ложно при любом окружении, и `TALI_AI_ENABLED` один ничего не
 * включает. Провайдер возвращается только с договором (DPA, без обучения на данных, регион ЕС/США)
 * и вместе с текстом согласия `companion_ai`, где он назван.
 */
export const AI_PROVIDER: AiProvider | null = null;
