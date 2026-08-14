import type { LessonTask } from '../data/worlds';

/**
 * ABA "least-to-most" prompt escalation for a single trial (one task).
 * Must be driven by mistakes on THIS task only — feeding it a lesson-wide
 * mistake tally causes every task after the child's first lesson mistake to
 * skip straight to the restricted-choice prompt (level 2).
 */
export function nextAbaPromptLevel(taskMistakesBeforeThisAnswer: number): 1 | 2 {
  return taskMistakesBeforeThisAnswer === 0 ? 1 : 2;
}

export function isTherapistLedTask(t: LessonTask): boolean {
  return (
    t.type === 'vocal_imitation' ||
    t.type === 'word_repetition' ||
    t.type === 'volume_control' ||
    t.type === 'action_instruction'
  );
}

export function shuffleArray<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function abaTaskInstructionI18nKey(taskType: LessonTask['type']): string {
  if (taskType === 'action_instruction') return 'lesson.aba_action_instruction';
  return `lesson.aba_${taskType}_instruction`;
}

/** Syllable-ish chunks for stress highlight (Cyrillic + Latin). */
export function splitWordSyllables(word: string): string[] {
  const vowel = /[aeiouyаеёиоуыэюяAEIOUYАЕЁИОУЫЭЮЯ]/;
  const parts: string[] = [];
  let buf = '';
  for (const ch of word) {
    buf += ch;
    if (vowel.test(ch)) {
      parts.push(buf);
      buf = '';
    }
  }
  if (buf.length) parts.push(buf);
  return parts.length ? parts : [word];
}
