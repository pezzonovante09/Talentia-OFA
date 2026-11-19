import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { elevenLabsReady, synthesizeReply, TTS_TIMEOUT_MS } from "./elevenLabs";

const fetchMock = vi.fn();
const ENV_KEYS = [
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "ELEVENLABS_VOICE_ID_KY",
  "ELEVENLABS_MODEL_ID",
  "ELEVENLABS_TTS_STABILITY",
  "ELEVENLABS_TTS_SIMILARITY",
  "ELEVENLABS_TTS_STYLE",
];

beforeEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  process.env.ELEVENLABS_API_KEY = "key-1";
  process.env.ELEVENLABS_VOICE_ID = "voice/1";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("synthesizeReply", () => {
  it("нет ключа — null, провайдер не вызывается", async () => {
    delete process.env.ELEVENLABS_API_KEY;
    expect(await synthesizeReply("Привет", "ru")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("нет голоса — null, провайдер не вызывается", async () => {
    delete process.env.ELEVENLABS_VOICE_ID;
    expect(await synthesizeReply("Привет", "ru")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ключ из пробелов считается отсутствующим", async () => {
    process.env.ELEVENLABS_API_KEY = "   ";
    expect(await synthesizeReply("Привет", "ru")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ответ провайдера не ok — null, в лог только статус", async () => {
    fetchMock.mockResolvedValue(new Response("quota", { status: 401 }));
    expect(await synthesizeReply("Секретная реплика", "ru")).toBeNull();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("Секретная реплика");
  });

  it("TimeoutError на запросе — null, а не исключение", async () => {
    fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    expect(await synthesizeReply("Привет", "ru")).toBeNull();
  });

  it("TypeError (сеть) на запросе — null", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await synthesizeReply("Привет", "ru")).toBeNull();
  });

  it("сбой при чтении тела — null", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => {
        throw new DOMException("aborted", "AbortError");
      },
    });
    expect(await synthesizeReply("Привет", "ru")).toBeNull();
  });

  it("в лог при сбое попадает класс ошибки, но не текст реплики и не текст ошибки", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed for Секретная реплика"));
    await synthesizeReply("Секретная реплика", "ru");
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("TypeError");
    expect(logged).not.toContain("Секретная реплика");
  });

  it("успех — ArrayBuffer с теми же байтами", async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([7, 8, 9]), { status: 200 }));
    const out = await synthesizeReply("Привет", "ru");
    expect(out).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(out!)]).toEqual([7, 8, 9]);
  });

  it("запрос: URL с кодированным голосом, POST, ключ в заголовке, текст и модель в теле", async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 }));
    await synthesizeReply("Привет", "ru");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/voice%2F1?output_format=mp3_44100_128");
    expect(init.method).toBe("POST");
    expect(init.headers["xi-api-key"]).toBe("key-1");
    const body = JSON.parse(init.body);
    expect(body.text).toBe("Привет");
    expect(body.model_id).toBe("eleven_multilingual_v2");
  });

  it("запрос получает сигнал таймаута", async () => {
    const spy = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 }));
    await synthesizeReply("Привет", "ru");
    expect(spy).toHaveBeenCalledWith(TTS_TIMEOUT_MS);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("для ky берётся ELEVENLABS_VOICE_ID_KY, если задан; иначе общий", async () => {
    fetchMock.mockImplementation(async () => new Response(new Uint8Array([1]), { status: 200 }));
    await synthesizeReply("Салам", "ky");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/voice%2F1");
    process.env.ELEVENLABS_VOICE_ID_KY = "kyvoice";
    await synthesizeReply("Салам", "ky");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/kyvoice");
  });

  it("настройки голоса ограничены диапазоном 0..1, мусор заменяется значением по умолчанию", async () => {
    process.env.ELEVENLABS_TTS_STABILITY = "7";
    process.env.ELEVENLABS_TTS_SIMILARITY = "abc";
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1]), { status: 200 }));
    await synthesizeReply("Привет", "ru");
    const { voice_settings } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(voice_settings.stability).toBe(1);
    expect(voice_settings.similarity_boost).toBe(0.82);
  });
});

describe("TTS_TIMEOUT_MS", () => {
  it("20 секунд: вместе с таймаутом модели укладывается в maxDuration", () => {
    expect(TTS_TIMEOUT_MS).toBe(20_000);
  });
});

describe("elevenLabsReady", () => {
  it("готов только при ключе и голосе для языка", () => {
    expect(elevenLabsReady("ru")).toBe(true);
    delete process.env.ELEVENLABS_VOICE_ID;
    expect(elevenLabsReady("ru")).toBe(false);
    process.env.ELEVENLABS_VOICE_ID_KY = "ky";
    expect(elevenLabsReady("ky")).toBe(true);
  });
});
