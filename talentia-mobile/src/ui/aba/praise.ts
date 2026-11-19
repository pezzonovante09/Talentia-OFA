/**
 * Похвала голосом (правка 4, 2026-11-12; аудит контента): одна и та же «Молодец!» сотни раз приедается. Варианты —
 * по кругу среди тех, что записаны (`SOUND_FILES`), подряд один и тот же не звучит. Пока записан один или ни одного —
 * основной ключ, как раньше. Тексты — `docs/aba-center/voice-lines-ru.md`.
 */
import { SOUND_FILES } from '../../services/voice';

export const PRAISE_KEYS = ['abaSession.sound.praise', 'abaSession.sound.praise-2', 'abaSession.sound.praise-3'] as const;

let last: string | null = null;

export function nextPraiseKey(files: Readonly<Record<string, number>> = SOUND_FILES): string {
  const ready = PRAISE_KEYS.filter((k) => files[k] !== undefined);
  if (ready.length <= 1) return ready[0] ?? PRAISE_KEYS[0];
  const i = last === null ? -1 : ready.indexOf(last as (typeof PRAISE_KEYS)[number]);
  last = ready[(i + 1) % ready.length];
  return last;
}
