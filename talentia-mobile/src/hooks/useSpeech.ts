import * as Speech from 'expo-speech';
import { useSettingsStore } from '../store/settingsStore';

/** Remove emoji characters and clean up extra whitespace for TTS. */
function stripForTTS(text: string): string {
  return text
    // Remove emoji (covers most ranges including modifiers, ZWJ sequences)
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FEFF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    // Remove variation selectors
    .replace(/[\uFE0E\uFE0F]/g, '')
    // Remove standalone punctuation/symbols left behind
    .replace(/[•·]/g, ' ')
    // Collapse extra spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Thin wrapper around expo-speech that respects the global ttsEnabled toggle,
 * strips emojis before speaking, and maps app language codes to BCP-47 locales.
 */
export function useSpeech() {
  const language = useSettingsStore((s) => s.language);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);

  const speak = (text: string) => {
    if (!ttsEnabled || !text) return;

    const cleaned = stripForTTS(text);
    if (!cleaned) return;

    const locale =
      language === 'ru' ? 'ru-RU' :
      language === 'ky' ? 'ru-RU' :   // Kyrgyz TTS falls back to Russian
      'en-US';

    Speech.stop();
    Speech.speak(cleaned, { language: locale, rate: 0.88, pitch: 1.05 });
  };

  const stop = () => {
    Speech.stop();
  };

  return { speak, stop };
}
