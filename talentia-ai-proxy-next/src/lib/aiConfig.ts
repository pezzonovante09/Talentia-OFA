/**
 * Живой разговор с Tali через ИИ — **последним этапом** (решение владельца №66, №102). Пока флаг не
 * включён, маршрут `/api/v2/tali` отвечает `ai_disabled` сразу, до любых проверок и до обращения к
 * провайдеру. Одной строки в `consent_texts` и ключа в окружении для включения мало: нужен ещё и
 * `TALI_AI_ENABLED=true` — осознанное решение после договора с провайдером и юриста
 * (раунд 3, `child-privacy-compliance`, В3).
 */
export function aiEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.TALI_AI_ENABLED === "true";
}

/**
 * Провайдер модели — в конфиг, а не по всему коду: его имя нужно тексту согласия на ИИ, который
 * утверждает юрист (область `companion_ai`). Меняется только вместе с текстом согласия.
 */
export const AI_PROVIDER = {
  /** Как провайдер назван в тексте согласия. */
  name: "DeepSeek",
  endpoint: "https://api.deepseek.com/v1/chat/completions",
  model: "deepseek-chat",
  apiKeyEnv: "DEEPSEEK_API_KEY",
} as const;
