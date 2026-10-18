import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ratelimit", () => ({
  enforceRateLimit: vi.fn(async () => null),
  ratelimitApi: "ip",
}));

import { enforceRateLimit } from "@/lib/ratelimit";
import { GET } from "./route";

const VALUES = {
  SUPABASE_URL: "https://zzz-secret-project.supabase.co",
  SUPABASE_ANON_KEY: "anon-VALUE-123",
  SUPABASE_SERVICE_ROLE_KEY: "service-VALUE-456",
  UPSTASH_REDIS_REST_URL: "https://upstash-VALUE-789.example",
  UPSTASH_REDIS_REST_TOKEN: "upstash-token-VALUE-000",
  DEEPSEEK_API_KEY: "deepseek-VALUE-111",
  ELEVENLABS_API_KEY: "eleven-VALUE-222",
  ELEVENLABS_VOICE_ID: "voice-VALUE-333",
  TALENTIA_API_SECRET: "ping-secret-VALUE",
  TALI_AI_ENABLED: "true",
};

function setEnv(env: Record<string, string | undefined>) {
  for (const k of Object.keys(VALUES)) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
}

function ping(secret?: string): NextRequest {
  return new NextRequest("http://localhost/api/ping", {
    headers: secret === undefined ? {} : { "x-talentia-secret": secret },
  });
}

beforeEach(() => {
  vi.mocked(enforceRateLimit).mockReset().mockResolvedValue(null);
  setEnv(VALUES);
});

describe("/api/ping", () => {
  it("без секрета (когда он задан) — 401, флагов нет", async () => {
    const res = await GET(ping());
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).not.toContain("ready");
  });

  it("неверный секрет — 401", async () => {
    expect((await GET(ping("wrong"))).status).toBe(401);
  });

  it("верный секрет — 200 и ping: true", async () => {
    const res = await GET(ping(VALUES.TALENTIA_API_SECRET));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ping).toBe(true);
    expect(typeof body.at).toBe("string");
  });

  it("всё настроено — ready.supabase и ready.upstash true, features заполнены", async () => {
    const body = await (await GET(ping(VALUES.TALENTIA_API_SECRET))).json();
    expect(body.ready).toEqual({ supabase: true, upstash: true });
    expect(body.features).toEqual({ ai: { enabled: true, configured: true }, tts: true });
  });

  it.each(["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"])(
    "без %s — ready.supabase: false",
    async (name) => {
      setEnv({ ...VALUES, [name]: undefined });
      const body = await (await GET(ping(VALUES.TALENTIA_API_SECRET))).json();
      expect(body.ready.supabase).toBe(false);
      expect(body.ready.upstash).toBe(true);
    },
  );

  it.each(["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"])("без %s — ready.upstash: false", async (name) => {
    setEnv({ ...VALUES, [name]: undefined });
    const body = await (await GET(ping(VALUES.TALENTIA_API_SECRET))).json();
    expect(body.ready.upstash).toBe(false);
    expect(body.ready.supabase).toBe(true);
  });

  it("переменная из пробелов считается отсутствующей", async () => {
    setEnv({ ...VALUES, SUPABASE_URL: "   " });
    const body = await (await GET(ping(VALUES.TALENTIA_API_SECRET))).json();
    expect(body.ready.supabase).toBe(false);
  });

  it("ИИ выключен — enabled: false (не поломка), ключ отдельным флагом", async () => {
    setEnv({ ...VALUES, TALI_AI_ENABLED: undefined });
    const body = await (await GET(ping(VALUES.TALENTIA_API_SECRET))).json();
    expect(body.features.ai).toEqual({ enabled: false, configured: true });
  });

  it("ИИ включён без ключа — enabled: true, configured: false", async () => {
    setEnv({ ...VALUES, DEEPSEEK_API_KEY: undefined });
    const body = await (await GET(ping(VALUES.TALENTIA_API_SECRET))).json();
    expect(body.features.ai).toEqual({ enabled: true, configured: false });
  });

  it("озвучка: нужен и ключ, и голос", async () => {
    setEnv({ ...VALUES, ELEVENLABS_VOICE_ID: undefined });
    expect((await (await GET(ping(VALUES.TALENTIA_API_SECRET))).json()).features.tts).toBe(false);
  });

  it("значения переменных окружения в ответе не встречаются", async () => {
    const text = await (await GET(ping(VALUES.TALENTIA_API_SECRET))).text();
    for (const [name, value] of Object.entries(VALUES)) {
      if (name === "TALI_AI_ENABLED") continue; // "true" — обычное булево в ответе
      expect(text, name).not.toContain(value);
    }
  });

  it("без TALENTIA_API_SECRET ping открыт (поведение dev), флаги отдаются", async () => {
    setEnv({ ...VALUES, TALENTIA_API_SECRET: undefined });
    const res = await GET(ping());
    expect(res.status).toBe(200);
  });

  it("лимитер вызывается первым: при 429 секрет не проверяется и флаги не отдаются", async () => {
    vi.mocked(enforceRateLimit).mockResolvedValue(NextResponse.json({ error: "limit" }, { status: 429 }));
    const res = await GET(ping(VALUES.TALENTIA_API_SECRET));
    expect(res.status).toBe(429);
    expect(JSON.stringify(await res.json())).not.toContain("ready");
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.anything(), "ip");
  });

  it("лимитер вызывается и для запроса с неверным секретом (до проверки секрета)", async () => {
    await GET(ping("wrong"));
    expect(enforceRateLimit).toHaveBeenCalledTimes(1);
  });
});
