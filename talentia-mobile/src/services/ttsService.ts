/**
 * Neural TTS service — calls the /api/tts backend endpoint (HF MMS-TTS),
 * writes the returned audio to a temp file, and plays it via expo-av.
 *
 * Falls back silently if the backend is unavailable or TTS is disabled.
 */
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

let currentSound: Audio.Sound | null = null;

/** Speak text using the backend TTS. No-op when backend URL is not set. */
export async function speakWithTali(
  text: string,
  language: string,
): Promise<void> {
  if (!BACKEND_URL || !text.trim()) return;

  try {
    // Stop anything already playing
    await stopTaliSpeech();

    const res = await fetch(`${BACKEND_URL}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 400), language }),
    });

    if (!res.ok) return;

    const data = (await res.json()) as { audio?: string; mimeType?: string };
    if (!data.audio) return;

    // Write base64 audio to a temporary file
    const path = `${FileSystem.cacheDirectory ?? ""}tali_tts_${Date.now()}.flac`;
    await FileSystem.writeAsStringAsync(path, data.audio, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Enable audio in silent mode (important for iOS)
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

    const { sound } = await Audio.Sound.createAsync({ uri: path });
    currentSound = sound;
    await sound.playAsync();

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => undefined);
        if (currentSound === sound) currentSound = null;
      }
    });
  } catch {
    // Silent fail — chat text is always shown regardless
  }
}

/** Stop any currently playing TTS audio. */
export async function stopTaliSpeech(): Promise<void> {
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
