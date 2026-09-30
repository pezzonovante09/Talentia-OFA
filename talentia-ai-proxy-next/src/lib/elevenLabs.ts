/**
 * Синтез реплики Tali в ElevenLabs — для живого разговора (`/api/v2/tali`). Текст сюда
 * попадает только после фильтра ответа модели (`taliSafety.screenReply`): свободный
 * текст клиента в озвучку не уходит.
 */
import type { TaliLanguage } from "@/lib/taliSafety";

const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

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

/** MP3 реплики или `null` — не настроено или сбой провайдера (подробности — в логе). */
export async function synthesizeReply(text: string, language: TaliLanguage): Promise<ArrayBuffer | null> {
  const apiKey = env("ELEVENLABS_API_KEY");
  const voiceId = voiceFor(language);
  if (!apiKey || !voiceId) return null;
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
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!r.ok) {
    console.error("[v2/tali] ElevenLabs error", r.status);
    return null;
  }
  return r.arrayBuffer();
}
