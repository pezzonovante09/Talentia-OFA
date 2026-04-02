import { corsJson } from "@/lib/api-cors";

export const runtime = "nodejs";

// Hugging Face MMS-TTS models for supported languages
const HF_MODELS: Record<string, string> = {
  ru: "facebook/mms-tts-rus",
  ky: "facebook/mms-tts-kir",
  en: "facebook/mms-tts-eng",
};

export async function OPTIONS() {
  return corsJson({}, 200);
}

export async function POST(req: Request) {
  try {
    const hfToken = process.env.TTS_KEY;
    if (!hfToken) return corsJson({ error: "TTS not configured" }, 503);

    const body = await req.json().catch(() => ({}));
    const text = String(body.text ?? "").trim().slice(0, 400);
    const language = String(body.language ?? "ru");

    if (!text) return corsJson({ error: "text is required" }, 400);

    const modelId = HF_MODELS[language] ?? HF_MODELS["ru"];

    const r = await fetch(
      `https://api-inference.huggingface.co/models/${modelId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json",
          Accept: "audio/flac",
        },
        body: JSON.stringify({ inputs: text }),
        // HF cold-start can take up to 30s
        signal: AbortSignal.timeout(35_000),
      }
    );

    if (!r.ok) {
      const err = await r.text().catch(() => "unknown");
      // 503 = model loading — tell client to retry
      return corsJson({ error: "TTS unavailable", details: err }, r.status);
    }

    const audioBuffer = await r.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString("base64");

    return corsJson({ audio: base64, mimeType: "audio/flac" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return corsJson({ error: "Server error", details: msg }, 500);
  }
}
