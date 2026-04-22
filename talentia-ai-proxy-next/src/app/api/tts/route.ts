import { corsAudioMpegResponse, corsJson, corsPreflight } from "@/lib/api-cors";
import { verifyTalentiaSecret } from "@/lib/api-secret";

export const runtime = "nodejs";

/** Default model; override with ELEVENLABS_MODEL_ID (e.g. eleven_multilingual_v3 if your plan supports it). */
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const MAX_TEXT_LEN = 2500;

/** Free tier: MMS-TTS on Hugging Face Inference API (token from https://huggingface.co/settings/tokens). */
const HF_MODELS: Record<"ru" | "en", string> = {
  ru: "facebook/mms-tts-rus",
  en: "facebook/mms-tts-eng",
};

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

function huggingFaceToken(): string | undefined {
  return (
    trimmedEnv("HUGGINGFACE_API_TOKEN") ??
    trimmedEnv("HF_API_TOKEN") ??
    trimmedEnv("TTS_KEY")
  );
}

async function synthesizeHuggingFace(
  text: string,
  language: "ru" | "en",
  hfToken: string,
  req: Request,
): Promise<Response> {
  const modelId = HF_MODELS[language];
  const r = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${hfToken}`,
      "Content-Type": "application/json",
      Accept: "audio/flac",
    },
    body: JSON.stringify({ inputs: text }),
    signal: AbortSignal.timeout(35_000),
  });

  if (!r.ok) {
    const err = await r.text().catch(() => "unknown");
    return corsJson({ error: "Hugging Face TTS error", details: err }, r.status, req);
  }

  const audioBuffer = await r.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString("base64");
  return corsJson({ audio: base64, mimeType: "audio/flac" }, 200, req);
}

async function synthesizeElevenLabs(
  text: string,
  apiKey: string,
  voiceId: string,
  req: Request,
): Promise<Response> {
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
    return corsJson({ error: "ElevenLabs TTS error", details: err }, r.status, req);
  }

  const audioBuffer = await r.arrayBuffer();
  return corsAudioMpegResponse(audioBuffer, 200, req);
}

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: Request) {
  const denied = verifyTalentiaSecret(req);
  if (denied) return denied;
  const apiKey = trimmedEnv("ELEVENLABS_API_KEY");
  const voiceId = trimmedEnv("ELEVENLABS_VOICE_ID");
  const hfToken = huggingFaceToken();
  const engineEnv = process.env.TTS_ENGINE?.trim().toLowerCase();
  const hfFallback =
    process.env.TTS_HF_FALLBACK === "1" || process.env.TTS_HF_FALLBACK?.toLowerCase() === "true";

  const elevenReady = !!(apiKey && voiceId);
  const hfReady = !!hfToken;

  let activeEngine: string;
  if (engineEnv === "huggingface") {
    activeEngine = "huggingface";
  } else if (elevenReady) {
    activeEngine = "elevenlabs";
  } else if (hfReady) {
    activeEngine = "huggingface";
  } else {
    activeEngine = "none";
  }

  return corsJson(
    {
      ok: true,
      endpoint: "/api/tts",
      usage:
        "POST JSON: { text, language: 'ru'|'en' } → audio/mpeg (ElevenLabs) or JSON { audio, mimeType } (Hugging Face FLAC).",
      activeEngine,
      envPresent: {
        ELEVENLABS_API_KEY: !!apiKey,
        ELEVENLABS_VOICE_ID: !!voiceId,
        HUGGINGFACE_API_TOKEN_or_TTS_KEY: hfReady,
      },
      configured: elevenReady || hfReady,
      hints: {
        elevenLabsFreeTier:
          "ElevenLabs Free: library voices are blocked for API (paid_plan_required). Upgrade or use Hugging Face.",
        huggingFaceFree:
          "Set HUGGINGFACE_API_TOKEN (HF token) and optionally TTS_ENGINE=huggingface, or TTS_HF_FALLBACK=1 to auto-fallback when ElevenLabs returns 402.",
      },
      options: {
        TTS_ENGINE: "huggingface | (omit for elevenlabs when EL keys set)",
        TTS_HF_FALLBACK: hfFallback ? "enabled" : "set to 1 to retry HF on EL 402/403",
      },
    },
    200,
    req,
  );
}

export async function POST(req: Request) {
  try {
    const denied = verifyTalentiaSecret(req);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const text = String(body.text ?? "").trim().slice(0, MAX_TEXT_LEN);
    const language = body.language;

    if (!text) return corsJson({ error: "text is required" }, 400, req);
    if (language !== "ru" && language !== "en") {
      return corsJson({ error: "language must be 'ru' or 'en'" }, 400, req);
    }

    const hfToken = huggingFaceToken();
    const engineEnv = process.env.TTS_ENGINE?.trim().toLowerCase();
    const hfFallback =
      process.env.TTS_HF_FALLBACK === "1" || process.env.TTS_HF_FALLBACK?.toLowerCase() === "true";

    const apiKey = trimmedEnv("ELEVENLABS_API_KEY");
    const voiceId = trimmedEnv("ELEVENLABS_VOICE_ID");
    const elevenReady = !!(apiKey && voiceId);

    // Force Hugging Face only
    if (engineEnv === "huggingface") {
      if (!hfToken) {
        return corsJson(
          {
            error: "TTS not configured",
            details: "TTS_ENGINE=huggingface requires HUGGINGFACE_API_TOKEN (or HF_API_TOKEN / TTS_KEY).",
          },
          503,
          req,
        );
      }
      return synthesizeHuggingFace(text, language, hfToken, req);
    }

    // No ElevenLabs → Hugging Face if token present
    if (!elevenReady) {
      if (!hfToken) {
        const missing: string[] = [];
        if (!apiKey) missing.push("ELEVENLABS_API_KEY");
        if (!voiceId) missing.push("ELEVENLABS_VOICE_ID");
        if (!hfToken) missing.push("HUGGINGFACE_API_TOKEN");
        return corsJson(
          {
            error: "TTS not configured",
            details:
              "Set ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID, or HUGGINGFACE_API_TOKEN (e.g. TTS_ENGINE=huggingface).",
            missing,
          },
          503,
          req,
        );
      }
      return synthesizeHuggingFace(text, language, hfToken, req);
    }

    // ElevenLabs primary
    const elRes = await synthesizeElevenLabs(text, apiKey!, voiceId!, req);
    if (elRes.ok) return elRes;

    const status = elRes.status;
    if ((status === 402 || status === 403) && hfFallback && hfToken) {
      return synthesizeHuggingFace(text, language, hfToken, req);
    }

    return elRes;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return corsJson({ error: "Server error", details: msg }, 500, req);
  }
}
