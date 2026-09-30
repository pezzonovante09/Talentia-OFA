import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/verifyAuth", () => ({
  verifyAuth: vi.fn(async () => ({ ok: true, userId: "parent-1" })),
  authJsonError: vi.fn(),
}));
vi.mock("@/lib/supabaseUser", () => ({
  supabaseAsUser: vi.fn(() => ({})),
  bearerToken: vi.fn(() => "jwt"),
}));
vi.mock("@/lib/consentCheck", () => ({ hasConsent: vi.fn(async () => true) }));

import { hasConsent } from "@/lib/consentCheck";
import { CRISIS_REPLY, SAFE_FALLBACK } from "@/lib/taliSafety";
import { POST, TaliV2RequestSchema } from "./route";

const KID = "00000000-0000-4000-8000-0000000000c1";

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v2/tali", {
    method: "POST",
    headers: { authorization: "Bearer jwt", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const fetchMock = vi.fn();

function deepseekReplies(content: string) {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes("deepseek")) {
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
    }
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  });
}

beforeEach(() => {
  process.env.DEEPSEEK_API_KEY = "test";
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.mocked(hasConsent).mockResolvedValue(true);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/api/v2/tali", () => {
  it("без согласия родителя — 403, в модель не уходит ничего", async () => {
    vi.mocked(hasConsent).mockResolvedValue(false);
    const res = await POST(request({ childId: KID, language: "ru", message: "привет" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "consent_required" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(hasConsent).toHaveBeenCalledWith(expect.anything(), KID, "companion_ai");
  });

  it("тревожное сообщение — реплика «расскажи взрослому», модель не вызывается", async () => {
    const res = await POST(request({ childId: KID, language: "ru", message: "я не хочу жить" }));
    expect(await res.json()).toEqual({ reply: CRISIS_REPLY.ru, crisis: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("в модель не уходит ни id ребёнка, ни данные о нём; задание — данными в сообщении", async () => {
    deepseekReplies("Посчитай по одному!");
    const res = await POST(
      request({ childId: KID, language: "ru", mode: "hint", message: "не знаю", task: { question: "Сколько камней?" } }),
    );
    expect(await res.json()).toEqual({ reply: "Посчитай по одному!", crisis: false });
    const sent = String(fetchMock.mock.calls[0][1].body);
    expect(sent).not.toContain(KID);
    const { messages } = JSON.parse(sent);
    expect(messages[0].content).not.toContain("Сколько камней");
    expect(messages[1].content).toContain("TASK DATA");
  });

  it("ответ со ссылкой ребёнку не показывается", async () => {
    deepseekReplies("Смотри www.dino.com");
    const res = await POST(request({ childId: KID, language: "en", message: "hi" }));
    expect((await res.json()).reply).toBe(SAFE_FALLBACK.en);
  });

  it("лишние поля о ребёнке отклоняются схемой", () => {
    for (const extra of [{ childMode: "special" }, { methodology: "aba" }, { parentContext: "отчёт" }]) {
      expect(TaliV2RequestSchema.safeParse({ childId: KID, language: "ru", message: "a", ...extra }).success).toBe(false);
    }
    expect(TaliV2RequestSchema.safeParse({ childId: "not-a-uuid", language: "ru", message: "a" }).success).toBe(false);
  });

  it("озвучка — только отфильтрованного ответа", async () => {
    process.env.ELEVENLABS_API_KEY = "k";
    process.env.ELEVENLABS_VOICE_ID = "v";
    deepseekReplies("Позвони мне 8 800 555 35 35");
    const res = await POST(request({ childId: KID, language: "ru", message: "привет", speak: true }));
    const body = await res.json();
    expect(body.reply).toBe(SAFE_FALLBACK.ru);
    expect(body.audio).toBeTruthy();
    const ttsCall = fetchMock.mock.calls.find(([url]) => String(url).includes("elevenlabs"));
    expect(JSON.parse(String(ttsCall![1].body)).text).toBe(SAFE_FALLBACK.ru);
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_VOICE_ID;
  });
});
