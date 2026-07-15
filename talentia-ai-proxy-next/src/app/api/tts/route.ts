import type { NextRequest } from "next/server";
import { z } from "zod";

import { corsAudioMpegResponse, corsJson, corsPreflight } from "@/lib/api-cors";
import { authJsonError, verifyAuth } from "@/lib/verifyAuth";
import { enforceRateLimit, ratelimitApi, ratelimitTts } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Default model; override with ELEVENLABS_MODEL_ID (e.g. eleven_multilingual_v3 if your plan supports it). */
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const MAX_TEXT_LEN = 2500;

export const TtsRequestSchema = z.object({
  text: z.string().max(MAX_TEXT_LEN),
  language: z.enum(["ru", "en", "ky"]),
});

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

/** ElevenLabs voice: optional dedicated ID for Kyrgyz (multilingual model). */
function resolveElevenLabsVoiceId(language: "ru" | "en" | "ky"): string | undefined {
  const base = trimmedEnv("ELEVENLABS_VOICE_ID");
  if (language === "ky") {
    return trimmedEnv("ELEVENLABS_VOICE_ID_KY") ?? base;
  }
  return base;
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
    console.error("[tts] Hugging Face error", r.status, err);
    return corsJson({ error: "Upstream TTS service error" }, 502, req);
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
    console.error("[tts] ElevenLabs error", r.status, err);
    return corsJson({ error: "Upstream TTS service error" }, 502, req);
  }

  const audioBuffer = await r.arrayBuffer();
  return corsAudioMpegResponse(audioBuffer, 200, req);
}

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const limited = await enforceRateLimit(req, ratelimitApi);
  if (limited) return limited;
  const auth = await verifyAuth(req);
  if (!auth.ok) return authJsonError(req, auth);
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
      configured: elevenReady || hfReady,
      activeEngine,
    },
    200,
    req,
  );
}

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit(req, ratelimitTts);
  if (limited) return limited;
  try {
    const auth = await verifyAuth(req);
    if (!auth.ok) return authJsonError(req, auth);

    const rawBody = await req.json().catch(() => ({}));
    const parsed = TtsRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return corsJson(
        { error: "Invalid request", details: parsed.error.flatten() },
        400,
        req,
      );
    }
    const text = parsed.data.text.trim().slice(0, MAX_TEXT_LEN);
    const language = parsed.data.language;

    if (!text) return corsJson({ error: "text is required" }, 400, req);

    const hfToken = huggingFaceToken();
    const engineEnv = process.env.TTS_ENGINE?.trim().toLowerCase();
    const hfFallback =
      process.env.TTS_HF_FALLBACK === "1" || process.env.TTS_HF_FALLBACK?.toLowerCase() === "true";

    const apiKey = trimmedEnv("ELEVENLABS_API_KEY");
    const voiceId = resolveElevenLabsVoiceId(language);
    const elevenReady = !!(apiKey && voiceId);

    // Force Hugging Face only (MMS: ru/en only)
    if (engineEnv === "huggingface") {
      if (language === "ky") {
        return corsJson(
          {
            error: "Hugging Face path does not support Kyrgyz",
            details:
              "Use ElevenLabs (unset TTS_ENGINE or set ELEVENLABS_*), or rely on client expo-speech fallback.",
          },
          400,
          req,
        );
      }
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

    // No ElevenLabs → Hugging Face if token present (ru/en only)
    if (!elevenReady) {
      if (language === "ky") {
        const missing: string[] = [];
        if (!apiKey) missing.push("ELEVENLABS_API_KEY");
        if (!voiceId) missing.push("ELEVENLABS_VOICE_ID or ELEVENLABS_VOICE_ID_KY");
        return corsJson(
          {
            error: "TTS not configured for Kyrgyz",
            details:
              "Kyrgyz requires ElevenLabs (multilingual voice). Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID; optional ELEVENLABS_VOICE_ID_KY.",
            missing,
          },
          503,
          req,
        );
      }
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
    if ((status === 402 || status === 403) && hfFallback && hfToken && (language === "ru" || language === "en")) {
      return synthesizeHuggingFace(text, language, hfToken, req);
    }

    return elRes;
  } catch (e: unknown) {
    console.error("[tts] Server error", e);
    return corsJson({ error: "Server error" }, 500, req);
  }
}
