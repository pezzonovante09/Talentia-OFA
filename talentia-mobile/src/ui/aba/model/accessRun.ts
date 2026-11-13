/**
 * Доступ к подкрепителю на экране (раздел 8, Ц2.8, кадр конца — Ц3.5; токены `abaAccessScene`): время ребёнка
 * `durationMs` не урезается.
 *
 * - `play` — сцена отвечает на тап; за `endCue.beforeEndMs` до конца — `cue` «закругляемся» (без звука — ничего);
 * - T — `scene_ended`: кольцо и силуэт исчезают, метки заглушки снимаются, сцена больше не начинает новое на тап;
 * - `settle` — сцена доигрывает своё, не дольше `settleMaxMs`;
 * - `fold` — сцена сворачивается в карточку 160 за `endFrame.foldMs` (calm — смена кадра);
 * - `hold` — карточка стоит `endSettleMs`, затем `done` — следующий шаг сменой кадра.
 *
 * Одна модель для доступа в сессии (обмен сразу, на перерыве), в хвосте конца и в сопряжении. Время сцены для журнала
 * (№171) — от `startedAt` до T: без обмена, доигрывания и сворачивания.
 */
import { abaAccessScene } from '../../../design/abaTokens';

export type AccessStage = 'play' | 'settle' | 'fold' | 'hold' | 'done';

export type AccessRun = {
  startedAt: number;
  durationMs: number;
  /** Сколько сцена доигрывает после T: у заглушки до ассетов — 0, у позиций каталога — своё, ≤ `settleMaxMs`. */
  settleMs: number;
  calm: boolean;
  stage: AccessStage;
  cued: boolean;
};

export type AccessEffect = { type: 'cue' } | { type: 'scene_ended'; at: number } | { type: 'fold' } | { type: 'done'; at: number };

export function startAccess(startedAt: number, durationMs: number, settleMs = 0, calm = false): AccessRun {
  return { startedAt, durationMs, settleMs: Math.min(Math.max(0, settleMs), abaAccessScene.settleMaxMs), calm, stage: 'play', cued: false };
}

/** T — конец времени ребёнка. */
export const accessEndsAt = (r: AccessRun) => r.startedAt + r.durationMs;
const foldAt = (r: AccessRun) => accessEndsAt(r) + r.settleMs;
const holdAt = (r: AccessRun) => foldAt(r) + (r.calm ? 0 : abaAccessScene.endFrame.foldMs);

/** Доля кольца, что ещё осталась: убывает в `play`; после T кольца нет. */
export function accessLeft(r: AccessRun, now: number): number {
  if (r.stage !== 'play') return 0;
  return Math.max(0, Math.min(1, (accessEndsAt(r) - now) / r.durationMs));
}

/** Кольцо и силуэт видны только пока сцена играет (ограничение 5 цикла 3: убираются в T). */
export const accessRingVisible = (r: AccessRun) => r.stage === 'play';

export function accessDueAt(r: AccessRun): number | null {
  const end = accessEndsAt(r);
  switch (r.stage) {
    case 'play':
      return !r.cued && r.durationMs > abaAccessScene.endCue.beforeEndMs ? end - abaAccessScene.endCue.beforeEndMs : end;
    case 'settle':
      return foldAt(r);
    case 'fold':
      return holdAt(r);
    case 'hold':
      return holdAt(r) + abaAccessScene.endSettleMs;
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
      effects.push({ type: 'scene_ended', at: due });
    } else if (run.stage === 'settle') {
      run = { ...run, stage: 'fold' };
      effects.push({ type: 'fold' });
    } else if (run.stage === 'fold') {
      run = { ...run, stage: 'hold' };
    } else {
      run = { ...run, stage: 'done' };
      effects.push({ type: 'done', at: due });
    }
  }
  return { run, effects };
}
