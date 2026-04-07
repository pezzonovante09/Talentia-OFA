import * as Speech from 'expo-speech';

import { EXPO_SPEECH_RATE_SLOW } from '../constants/ttsPlayback';
import { useLessonTtsReplayStore } from '../store/lessonTtsReplayStore';
import { useSettingsStore } from '../store/settingsStore';
import { tryPlayBundledLessonVoice } from './lessonBundledVoice';
import { speakViaTali, stopTaliSpeech } from './ttsService';

/**
 * Повторить последнюю озвучку (нейросеть, системный TTS или вшитый mp3 урока).
 */
export async function replayLastLessonTts(): Promise<void> {
  if (!useSettingsStore.getState().ttsEnabled) return;

  const payload = useLessonTtsReplayStore.getState().last;
  if (!payload) return;

  await stopTaliSpeech();

  if (payload.kind === 'bundled') {
    await tryPlayBundledLessonVoice(payload.moduleId);
    return;
  }

  if (payload.kind === 'neural') {
    await speakViaTali(payload.text, payload.lang);
    return;
  }

  Speech.stop();
  Speech.speak(payload.text, {
    language: payload.locale,
    rate: EXPO_SPEECH_RATE_SLOW,
    pitch: 1.05,
  });
}
