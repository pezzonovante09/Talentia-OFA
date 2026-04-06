/**
 * TTS: ElevenLabs via /api/tts (MP3 stream) when backend is configured;
 * fallback to expo-speech when offline or on error.
 */
import { File, Paths } from "expo-file-system";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

let currentSound: Audio.Sound | null = null;

export type TaliTtsLanguage = "ru" | "en";

function stripForNeuralTts(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FEFF}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/[\uFE0E\uFE0F]/g, "")
    .replace(/[•·]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function speechLocaleForTts(lang: TaliTtsLanguage): string {
  return lang === "en" ? "en-US" : "ru-RU";
}

function mapAppLanguageToTts(lang: string): TaliTtsLanguage {
  return lang === "en" ? "en" : "ru";
}

function speakWithExpoSpeech(text: string, lang: TaliTtsLanguage): void {
  const cleaned = stripForNeuralTts(text);
  if (!cleaned) return;
  Speech.stop();
  Speech.speak(cleaned, {
    language: speechLocaleForTts(lang),
    rate: 0.88,
    pitch: 1.05,
  });
}

/**
 * Neural TTS through the proxy (/api/tts → ElevenLabs MP3).
 * Falls back to system expo-speech if there is no backend URL or the request fails.
 */
export async function speakViaTali(text: string, language: TaliTtsLanguage): Promise<void> {
  const trimmed = stripForNeuralTts(text).slice(0, 400);
  if (!trimmed) return;

  await stopTaliSpeech();

  if (!BACKEND_URL) {
    speakWithExpoSpeech(trimmed, language);
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed, language }),
    });

    if (!res.ok) {
      speakWithExpoSpeech(trimmed, language);
      return;
    }

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("mpeg") && !ct.includes("octet-stream") && !ct.includes("audio")) {
      speakWithExpoSpeech(trimmed, language);
      return;
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) {
      speakWithExpoSpeech(trimmed, language);
      return;
    }

    const outFile = new File(Paths.cache, `tali_tts_${Date.now()}.mp3`);
    outFile.create();
    outFile.write(new Uint8Array(buf));

    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

    const { sound } = await Audio.Sound.createAsync({ uri: outFile.uri });
    currentSound = sound;
    await sound.playAsync();

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => undefined);
        if (currentSound === sound) currentSound = null;
      }
    });
  } catch {
    speakWithExpoSpeech(trimmed, language);
  }
}

/** @deprecated Prefer speakViaTali with explicit 'ru' | 'en'. Maps app language codes to TTS language. */
export async function speakWithTali(text: string, language: string): Promise<void> {
  return speakViaTali(text, mapAppLanguageToTts(language));
}

/** Stop neural playback and any in-flight expo-speech from this flow. */
export async function stopTaliSpeech(): Promise<void> {
  Speech.stop();
  if (!currentSound) return;
  const s = currentSound;
  currentSound = null;
  try {
    await s.stopAsync();
    await s.unloadAsync();
  } catch {
    // ignore
  }
}
