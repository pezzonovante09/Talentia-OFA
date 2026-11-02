/**
 * Доступ к подкрепителю на экране (раздел 8, Ц2.8; токены `abaAccessScene`): время ребёнка `durationMs` не урезается.
 *
 * - `play` — сцена отвечает на тап; за `endCue.beforeEndMs` до конца — `cue` «закругляемся» (без звука — ничего,
 *   конец несёт кольцо);
 * - `settle` — с T сцена больше не начинает новое на тап и доигрывает своё, не дольше `settleMaxMs`; кольцо пусто;
 * - `gap` — кольцо исчезло мгновенно, через `endSettleMs` — следующий шаг без перехода;
 * - `done`.
 *
 * Одна модель для доступа в сессии (обмен сразу, на перерыве) и в хвосте конца (обмен в конце, цикл сопряжения).
 */
import { abaAccessScene } from '../../../design/abaTokens';

export type AccessStage = 'play' | 'settle' | 'gap' | 'done';

export type AccessRun = {
  startedAt: number;
  durationMs: number;
  /** Сколько сцена доигрывает после T: у заглушки до ассетов — 0, у позиций каталога — своё, ≤ `settleMaxMs`. */
  settleMs: number;
  stage: AccessStage;
  cued: boolean;
};

export type AccessEffect = { type: 'cue' } | { type: 'scene_ended' } | { type: 'ring_hidden' } | { type: 'done'; at: number };

export function startAccess(startedAt: number, durationMs: number, settleMs = 0): AccessRun {
  return { startedAt, durationMs, settleMs: Math.min(Math.max(0, settleMs), abaAccessScene.settleMaxMs), stage: 'play', cued: false };
}

export const accessEndsAt = (r: AccessRun) => r.startedAt + r.durationMs;

/** Доля кольца, что ещё осталась: убывает в `play`, в `settle` — пусто. */
export function accessLeft(r: AccessRun, now: number): number {
  if (r.stage !== 'play') return 0;
  return Math.max(0, Math.min(1, (accessEndsAt(r) - now) / r.durationMs));
}

export function accessDueAt(r: AccessRun): number | null {
  const end = accessEndsAt(r);
  switch (r.stage) {
    case 'play':
      return !r.cued && r.durationMs > abaAccessScene.endCue.beforeEndMs ? end - abaAccessScene.endCue.beforeEndMs : end;
    case 'settle':
      return end + r.settleMs;
    case 'gap':
      return end + r.settleMs + abaAccessScene.endSettleMs;
    case 'done':
      return null;
  }
}

/** Все сроки до `at` по порядку: просроченные стадии проходят разом, эффекты — каждый один раз. */
export function stepAccess(r: AccessRun, at: number): { run: AccessRun; effects: AccessEffect[] } {
  let run = r;
  const effects: AccessEffect[] = [];
  for (let due = accessDueAt(run); due !== null && due <= at; due = accessDueAt(run)) {
    if (run.stage === 'play' && !run.cued && due < accessEndsAt(run)) {
      run = { ...run, cued: true };
      // просрочка (экран был свёрнут): «закругляемся» после конца доступа уже ничего не значит
      if (at < accessEndsAt(run)) effects.push({ type: 'cue' });
    } else if (run.stage === 'play') {
      run = { ...run, stage: 'settle', cued: true };
      effects.push({ type: 'scene_ended' });
    } else if (run.stage === 'settle') {
      run = { ...run, stage: 'gap' };
      effects.push({ type: 'ring_hidden' });
    } else {
      run = { ...run, stage: 'done' };
      effects.push({ type: 'done', at: due });
    }
  }
  return { run, effects };
}
