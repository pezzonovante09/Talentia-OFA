import { Audio } from 'expo-av';

import { AV_PLAYBACK_RATE_SLOW } from '../constants/ttsPlayback';
import { LESSON_VOICE_ASSETS } from '../generated/lessonVoiceAssets';
import type { LanguageCode } from '../store/settingsStore';
import { useLessonTtsReplayStore } from '../store/lessonTtsReplayStore';
import { stopTaliSpeech } from './ttsService';

let currentSound: Audio.Sound | null = null;

export function lessonBundledVoiceKey(
  lessonId: string,
  kind: 'intro' | 'dialog',
  index: number,
  language: LanguageCode,
): string {
  const base = `${lessonId}_${kind}_${index}_${language}`;
  if (language === 'ky' && LESSON_VOICE_ASSETS[base] === undefined) {
    return `${lessonId}_${kind}_${index}_ru`;
  }
  return base;
}

export function getBundledVoiceModuleId(key: string): number | undefined {
  const id = LESSON_VOICE_ASSETS[key];
  return typeof id === 'number' ? id : undefined;
}

export async function stopLessonBundledVoice(): Promise<void> {
  if (currentSound) {
    try {
      await currentSound.stopAsync();
    } catch {
      /* ignore */
    }
    try {
      await currentSound.unloadAsync();
    } catch {
      /* ignore */
    }
    currentSound = null;
  }
}

/**
 * Проигрывает вшитый mp3, если он есть в LESSON_VOICE_ASSETS. Иначе false.
 * Останавливает expo-speech перед воспроизведением.
 */
export async function tryPlayBundledLessonVoice(moduleId: number): Promise<boolean> {
  await stopTaliSpeech();

  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(moduleId);
    currentSound = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => undefined);
        if (currentSound === sound) currentSound = null;
      }
    });
    try {
      await sound.setRateAsync(AV_PLAYBACK_RATE_SLOW, true);
    } catch {
      /* web */
    }
    await sound.playAsync();
    useLessonTtsReplayStore.getState().setLast({ kind: 'bundled', moduleId });
    return true;
  } catch {
    await stopLessonBundledVoice();
    return false;
  }
}
