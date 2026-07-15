/**
 * TTS: ElevenLabs via /api/tts (MP3 stream) when backend is configured;
 * fallback to expo-speech when offline or on error.
 */
import { File, Paths } from "expo-file-system";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";

import { AV_PLAYBACK_RATE_SLOW, EXPO_SPEECH_RATE_SLOW } from "../constants/ttsPlayback";
import { useLessonTtsReplayStore } from "../store/lessonTtsReplayStore";
import { backendFetch, getBackendBaseUrl } from "./backendApi";

/** Совпадает с лимитом прокси (talentia-ai-proxy-next MAX_TEXT_LEN). */
const NEURAL_TTS_MAX_LEN = 2500;

let currentSound: Audio.Sound | null = null;

export type TaliTtsLanguage = "ru" | "en" | "ky";

/** Maps app `LanguageCode` (en | ru | ky) to TTS pipeline language. */
export function mapLanguageCodeToTaliTts(code: string): TaliTtsLanguage {
  if (code === "en") return "en";
  if (code === "ky") return "ky";
  return "ru";
}

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
  if (lang === "en") return "en-US";
  if (lang === "ky") return "ky-KG";
  return "ru-RU";
}

function speakWithExpoSpeech(text: string, lang: TaliTtsLanguage): void {
  const cleaned = stripForNeuralTts(text);
  if (!cleaned) return;
  useLessonTtsReplayStore.getState().setLast({
    kind: "expo",
    text: cleaned,
    locale: speechLocaleForTts(lang),
  });
  Speech.stop();
  Speech.speak(cleaned, {
    language: speechLocaleForTts(lang),
    rate: EXPO_SPEECH_RATE_SLOW,
    pitch: 1.05,
  });
}

async function applySlowPlaybackRate(sound: Audio.Sound): Promise<void> {
  try {
    await sound.setRateAsync(AV_PLAYBACK_RATE_SLOW, true);
  } catch {
    /* web / старые устройства */
  }
}

/**
 * Neural TTS through the proxy (/api/tts → ElevenLabs MP3).
 * Falls back to system expo-speech if there is no backend URL or the request fails.
 */
export async function speakViaTali(text: string, language: TaliTtsLanguage): Promise<void> {
  const trimmed = stripForNeuralTts(text).slice(0, NEURAL_TTS_MAX_LEN);
  if (!trimmed) return;

  await stopTaliSpeech();

  useLessonTtsReplayStore.getState().setLast({ kind: "neural", text: trimmed, lang: language });

  if (!getBackendBaseUrl()) {
    speakWithExpoSpeech(trimmed, language);
    return;
  }

  try {
    const res = await backendFetch("/api/tts", {
      method: "POST",
      body: JSON.stringify({ text: trimmed, language }),
    });

    if (!res.ok) {
      speakWithExpoSpeech(trimmed, language);
      return;
    }

    const ct = res.headers.get("content-type") ?? "";

    // Hugging Face path: JSON { audio: base64, mimeType }
    if (ct.includes("application/json")) {
      const data = (await res.json()) as { audio?: string; mimeType?: string; error?: string };
      if (data.error || !data.audio) {
        speakWithExpoSpeech(trimmed, language);
        return;
      }
      const ext = data.mimeType?.includes("flac") ? "flac" : "mp3";
      const outFile = new File(Paths.cache, `tali_tts_${Date.now()}.${ext}`);
      outFile.create();
      outFile.write(data.audio, { encoding: "base64" });
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: outFile.uri });
      currentSound = sound;
      await applySlowPlaybackRate(sound);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => undefined);
          if (currentSound === sound) currentSound = null;
        }
      });
      return;
    }

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
    await applySlowPlaybackRate(sound);
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

/** Stop neural playback, вшитые mp3 урока и expo-speech. */
export async function stopTaliSpeech(): Promise<void> {
  Speech.stop();
  const { stopLessonBundledVoice } = await import("./lessonBundledVoice");
  await stopLessonBundledVoice();
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
