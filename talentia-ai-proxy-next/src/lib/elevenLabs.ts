/**
 * Синтез реплики Tali в ElevenLabs — для живого разговора (`/api/v2/tali`). Текст сюда
 * попадает только после фильтра ответа модели (`taliSafety.screenReply`): свободный
 * текст клиента в озвучку не уходит.
 */
import type { TaliLanguage } from "@/lib/taliSafety";

const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

/**
 * Таймаут синтеза. Вместе с `MODEL_TIMEOUT_MS` модели укладывается в `maxDuration` маршрута (60 с):
 * платформа не должна оборвать функцию раньше, чем сработают наши таймауты.
 */
export const TTS_TIMEOUT_MS = 20_000;

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

function envFloat(name: string, fallback: number): number {
  const n = Number.parseFloat(process.env[name] ?? "");
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

/** Готов ли синтез для языка. */
export function elevenLabsReady(language: TaliLanguage): boolean {
  return !!(env("ELEVENLABS_API_KEY") && voiceFor(language));
}

function voiceFor(language: TaliLanguage): string | undefined {
  return language === "ky" ? (env("ELEVENLABS_VOICE_ID_KY") ?? env("ELEVENLABS_VOICE_ID")) : env("ELEVENLABS_VOICE_ID");
}

/**
 * MP3 реплики или `null` — не настроено или сбой провайдера (подробности — в логе). Любое исключение
 * (таймаут, сеть, обрыв при чтении тела) — тоже `null`: готовый текст реплики озвучка уронить не
 * должна, клиент покажет его без звука (раунд 3, В-9). В лог — только класс ошибки, не текст реплики.
 */
export async function synthesizeReply(text: string, language: TaliLanguage): Promise<ArrayBuffer | null> {
  const apiKey = env("ELEVENLABS_API_KEY");
  const voiceId = voiceFor(language);
  if (!apiKey || !voiceId) return null;
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text,
          model_id: env("ELEVENLABS_MODEL_ID") ?? DEFAULT_MODEL_ID,
          voice_settings: {
            stability: envFloat("ELEVENLABS_TTS_STABILITY", 0.42),
            similarity_boost: envFloat("ELEVENLABS_TTS_SIMILARITY", 0.82),
            style: envFloat("ELEVENLABS_TTS_STYLE", 0.35),
            use_speaker_boost: true,
          },
        }),
        signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
      },
    );
    if (!r.ok) {
      console.error("[v2/tali] ElevenLabs error", r.status);
      return null;
    }
    return await r.arrayBuffer();
  } catch (e: unknown) {
    console.error("[v2/tali] ElevenLabs failure", e instanceof Error ? e.name : "unknown");
    return null;
  }
}
