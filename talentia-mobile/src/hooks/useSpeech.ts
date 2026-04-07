import { useCallback } from 'react';

import { useSettingsStore } from '../store/settingsStore';
import { speakViaTali, stopTaliSpeech, type TaliTtsLanguage } from '../services/ttsService';

/** Remove emoji characters and clean up extra whitespace for TTS. */
function stripForTTS(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FEFF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\uFE0E\uFE0F]/g, '')
    .replace(/[•·]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function mapLanguageToTaliTts(language: string): TaliTtsLanguage {
  return language === 'en' ? 'en' : 'ru';
}

/**
 * Озвучка: при EXPO_PUBLIC_BACKEND_URL — ElevenLabs через /api/tts, иначе медленный expo-speech.
 * Регистрирует последнюю фразу для кнопки «Повторить».
 */
export function useSpeech() {
  const language = useSettingsStore((s) => s.language);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);

  const speak = useCallback(
    (text: string) => {
      if (!ttsEnabled || !text) return;
      const cleaned = stripForTTS(text);
      if (!cleaned) return;
      void speakViaTali(cleaned, mapLanguageToTaliTts(language));
    },
    [language, ttsEnabled],
  );

  const stop = useCallback(() => {
    void stopTaliSpeech();
  }, []);

  return { speak, stop };
}
