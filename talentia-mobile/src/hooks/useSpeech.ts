import * as Speech from 'expo-speech';
import { useSettingsStore } from '../store/settingsStore';

/**
 * Thin wrapper around expo-speech that respects the global ttsEnabled toggle
 * and maps app language codes to BCP-47 locale strings.
 */
export function useSpeech() {
  const language = useSettingsStore((s) => s.language);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);

  const speak = (text: string) => {
    if (!ttsEnabled || !text) return;

    const locale =
      language === 'ru' ? 'ru-RU' :
      language === 'ky' ? 'ru-RU' :   // Kyrgyz TTS falls back to Russian
      'en-US';

    Speech.stop();
    Speech.speak(text, { language: locale, rate: 0.9 });
  };

  const stop = () => {
    Speech.stop();
  };

  return { speak, stop };
}
