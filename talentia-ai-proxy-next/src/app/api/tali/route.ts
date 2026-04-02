import { corsJson } from "@/lib/api-cors";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsJson({}, 200);
}

export async function GET() {
  return new Response("ok", { status: 200 });
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return corsJson({ error: "Missing DEEPSEEK_API_KEY" }, 500);

    const body = await req.json().catch(() => ({}));
    const language = body.language ?? "en";
    const message = String(body.message ?? body.userMessage ?? "").trim();

    if (!message) return corsJson({ error: "message is required" }, 400);

    const system = [
      "You are Tali, a friendly learning companion for kids age 5-8.",
      `Reply in ${language}.`,
      "Use only 1-2 short sentences.",
      "Never give the exact final answer.",
      "Give a hint or a guiding question.",
      "Be warm and encouraging."
    ].join(" ");

    const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 120,
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return corsJson({ error: "DeepSeek error", details: data }, r.status);
    }

    const reply = data?.choices?.[0]?.message?.content?.trim() || "Let's try one small step together.";
    return corsJson({ reply });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return corsJson({ error: "Server error", details: msg }, 500);
  }
}