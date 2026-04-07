import { LESSON_VOICE_ASSETS } from '../generated/lessonVoiceAssets';
import type { LanguageCode } from '../store/settingsStore';
import { getBundledVoiceModuleId, tryPlayBundledLessonVoice } from './lessonBundledVoice';
import { speakViaTali, type TaliTtsLanguage } from './ttsService';

function mapToTaliLang(language: LanguageCode): TaliTtsLanguage {
  return language === 'en' ? 'en' : 'ru';
}

export function lessonTaskQuestionVoiceKey(
  lessonId: string,
  taskId: string,
  language: LanguageCode,
): string {
  const base = `${lessonId}_task_${taskId}_q_${language}`;
  if (language === 'ky' && LESSON_VOICE_ASSETS[base] === undefined) {
    return `${lessonId}_task_${taskId}_q_ru`;
  }
  return base;
}

export function lessonTaskOptionVoiceKey(
  lessonId: string,
  taskId: string,
  optionId: string,
  language: LanguageCode,
): string {
  const base = `${lessonId}_task_${taskId}_opt_${optionId}_${language}`;
  if (language === 'ky' && LESSON_VOICE_ASSETS[base] === undefined) {
    return `${lessonId}_task_${taskId}_opt_${optionId}_ru`;
  }
  return base;
}

/**
 * Вшитый mp3 для строки задания, иначе ElevenLabs/система (как speakViaTali).
 */
export async function playLessonTaskVoiceLine(
  lessonId: string,
  bundleKey: string,
  fallbackText: string,
  language: LanguageCode,
): Promise<void> {
  const mod = getBundledVoiceModuleId(bundleKey);
  if (mod !== undefined) {
    const ok = await tryPlayBundledLessonVoice(mod);
    if (ok) return;
  }
  await speakViaTali(fallbackText, mapToTaliLang(language));
}
