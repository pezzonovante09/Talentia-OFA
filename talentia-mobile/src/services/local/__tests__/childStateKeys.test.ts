/**
 * Каждый ключ состояния ребёнка — ровно в одном списке: уроки (`LESSON_STATE_KEYS`) или ABA (`ABA_DELETED_KEYS`).
 * На этом держатся очистка прогресса (№189: стирает всё, кроме ABA) и отзыв согласия на ABA (стирает ABA): ключ ABA,
 * забытый в `ABA_STATE_KEYS`, очистка стёрла бы молча, а отзыв оставил бы (`child-privacy-compliance`, 2026-11-12).
 * Новый ключ в `ChildStateValues` без строки здесь — ошибка typecheck: запись `ALL` обязана перечислить все ключи.
 */
import { ABA_DELETED_KEYS, type ChildStateKey, LESSON_STATE_KEYS } from '../childState';

const ALL: Record<ChildStateKey, true> = {
  skills: true,
  atlas: true,
  lessonCounter: true,
  formatsSeen: true,
  abaTargets: true,
  tokenTraining: true,
  identifySets: true,
  abaBoard: true,
  abaSessionIndex: true,
  abaSessionInProgress: true,
  abaPaused: true,
  physicalPromptAllowed: true,
  abaObservers: true,
  abaRoutineRunInProgress: true,
  breakCard: true,
  abaRoutineSettingOpen: true,
};

describe('ключи состояния ребёнка', () => {
  it('уроки и ABA делят все ключи без остатка и без пересечения', () => {
    const lesson = new Set<string>(LESSON_STATE_KEYS);
    const aba = new Set<string>(ABA_DELETED_KEYS);
    expect([...lesson].filter((k) => aba.has(k))).toEqual([]);
    expect([...lesson, ...aba].sort()).toEqual(Object.keys(ALL).sort());
  });
});
