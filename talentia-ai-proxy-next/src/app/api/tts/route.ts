import { corsAudioMpegResponse, corsJson } from "@/lib/api-cors";

export const runtime = "nodejs";

/** Default model; override with ELEVENLABS_MODEL_ID (e.g. eleven_multilingual_v3 if your plan supports it). */
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const MAX_TEXT_LEN = 2500;

/**
 * ElevenLabs defaults lean “flat”; lower stability + moderate style sounds more human, less robotic.
 * Tune via env: ELEVENLABS_TTS_STABILITY, ELEVENLABS_TTS_SIMILARITY, ELEVENLABS_TTS_STYLE (0–1).
 */
function parseEnvFloat(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

function trimmedEnv(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

export async function OPTIONS() {
  return corsJson({}, 200);
}

/** Browser uses GET — avoids 405 on /api/tts. Shows which env vars the server sees (no secret values). */
export async function GET() {
  const hasKey = !!trimmedEnv("ELEVENLABS_API_KEY");
  const hasVoice = !!trimmedEnv("ELEVENLABS_VOICE_ID");
  return corsJson(
    {
      ok: true,
      endpoint: "/api/tts",
      usage: "POST JSON body: { text: string, language: 'ru' | 'en' } → audio/mpeg",
      configured: hasKey && hasVoice,
      envPresent: {
        ELEVENLABS_API_KEY: hasKey,
        ELEVENLABS_VOICE_ID: hasVoice,
      },
      vercelMonorepoHint:
        "If envPresent is false but you set variables in Vercel: (1) Redeploy after saving env. (2) Project → Settings → General → Root Directory must be `talentia-ai-proxy-next` when the Git repo is the monorepo root. (3) Variables must be enabled for Production.",
    },
    200,
  );
}

export async function POST(req: Request) {
  try {
    const apiKey = trimmedEnv("ELEVENLABS_API_KEY");
    const voiceId = trimmedEnv("ELEVENLABS_VOICE_ID");
    if (!apiKey || !voiceId) {
      const missing = [
        !apiKey ? "ELEVENLABS_API_KEY" : null,
        !voiceId ? "ELEVENLABS_VOICE_ID" : null,
      ].filter(Boolean) as string[];
      return corsJson(
        {
          error: "TTS not configured",
          details: "Server process has no non-empty values for required env vars.",
          missing,
          envPresent: {
            ELEVENLABS_API_KEY: !!apiKey,
            ELEVENLABS_VOICE_ID: !!voiceId,
          },
          vercelMonorepoHint:
            "Root Directory = talentia-ai-proxy-next, then Redeploy. Names must match exactly (case-sensitive).",
        },
        503,
      );
    }

    const body = await req.json().catch(() => ({}));
    const text = String(body.text ?? "").trim().slice(0, MAX_TEXT_LEN);
    const language = body.language;

    if (!text) return corsJson({ error: "text is required" }, 400);
    if (language !== "ru" && language !== "en") {
      return corsJson({ error: "language must be 'ru' or 'en'" }, 400);
    }

    const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL_ID;
    const stability = parseEnvFloat("ELEVENLABS_TTS_STABILITY", 0.42);
    const similarityBoost = parseEnvFloat("ELEVENLABS_TTS_SIMILARITY", 0.82);
    const style = parseEnvFloat("ELEVENLABS_TTS_STYLE", 0.35);

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
      voiceId,
    )}?output_format=mp3_44100_128`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!r.ok) {
      const err = await r.text().catch(() => "unknown");
      return corsJson({ error: "ElevenLabs TTS error", details: err }, r.status);
    }

    const audioBuffer = await r.arrayBuffer();
    return corsAudioMpegResponse(audioBuffer, 200);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return corsJson({ error: "Server error", details: msg }, 500);
  }
}
