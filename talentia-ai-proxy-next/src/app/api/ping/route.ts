import type { NextRequest } from "next/server";

import { aiEnabled, AI_PROVIDER } from "@/lib/aiConfig";
import { corsJson, corsPreflight } from "@/lib/api-cors";
import { verifyTalentiaSecret } from "@/lib/api-secret";
import { enforceRateLimit, ratelimitApi } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

/** Заданы ли все переменные окружения из списка (значения не читаются дальше `trim`). */
function configured(...names: string[]): boolean {
  return names.every((n) => !!process.env[n]?.trim());
}

/**
 * Проверка развёртывания: если здесь 404 / 405, свежий код на Vercel не выложен. После секрета —
 * флаги наличия конфигурации (раунд 3, В-11): неверно настроенный деплой не должен выглядеть
 * здоровым. Только булевы флаги, без значений переменных.
 * - `ready` — без чего прокси не работает вовсе: Supabase (JWT, согласия) и Upstash (лимиты);
 * - `features` — что включено: ИИ-разговор выключен по умолчанию (`TALI_AI_ENABLED`, №66, №102),
 *   «выключен» — не поломка; озвучка опциональна.
 */
export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, ratelimitApi);
  if (limited) return limited;
  const denied = verifyTalentiaSecret(req);
  if (denied) return denied;
  return corsJson(
    {
      ping: true,
      at: new Date().toISOString(),
      ready: {
        supabase: configured("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
        upstash: configured("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"),
      },
      features: {
        ai: { enabled: aiEnabled(), configured: configured(AI_PROVIDER.apiKeyEnv) },
        tts: configured("ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"),
      },
    },
    200,
    req,
  );
}
