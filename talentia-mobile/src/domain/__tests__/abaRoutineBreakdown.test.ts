/**
 * Срыв в прогоне рутины (методист 2026-10-12, смещает ответ В1 от 2026-10-11): срыв — не промах навыка.
 * - обучение: в окно `routineRuns` не идёт, копится в `routineBreakdowns`;
 * - базовая линия: не засчитывается совсем, день занят;
 * - поддержание: пробы нет, `maintenanceFailsInRow` и `lastMaintenanceDay` не двигаются;
 * - проверка: вердикта нет, срыв записан;
 * - два срыва подряд любого вида ставят `assent_concern`, спокойный прогон счётчик обнуляет;
 * - внешний обрыв — состояние как до прогона.
 * Плюс гард `targetErrors`: у рутины постоянная задержка не короче 3 с.
 */
import type { AbaPresentation, AbaTarget, AbaTargetState, PresentationOutcome, PromptLevel } from '../../types/aba';
import { ROUTINE } from '../../types/aba';
import { applyRoutineBreakdown } from '../abaCriterion';
import { initialTargetState } from '../abaPrompting';
import {
  finishRoutineByAdult,
  finishRoutineRun,
  interruptRoutineRun,
  nextRoutineStep,
  recordRoutineStep,
  routinesDue,
  setRoutineSetting,
  startRoutineRun,
  type RoutineRunState,
} from '../abaRoutineRun';
import { withAssentConcern } from '../abaSession';
import { targetErrors } from '../abaTargetRules';
import { initialTokenTraining } from '../abaTokenTraining';
import type { AbaTrialInput, TrialStep } from '../abaTrialStep';
import { NO_HISTORY } from './abaFixtures';

const POOL = ['puzzle', 'bubbles', 'drum', 'stickers', 'train', 'balloon'];
const SPEC = { id: 'obs-spec', role: 'specialist' as const, trained: true };
const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`;

function routine(id: string, over: Partial<AbaTarget> = {}): AbaTarget {
  return {
    id,
    programId: 'p-self',
    format: 'do_action',
    band: '7',
    level: 'cross',
    area: 'self_care',
    sdKind: 'instruction',
    sdKey: `sd.${id}`,
    chaining: 'total_task',
    steps: ['1', '2', '3'].map((n, i) => ({
      id: `${id}-s${n}`,
      order: i + 1,
      sdKey: `sd.${id}.${n}`,
      criterionKey: `c.${id}.${n}`,
      modelKey: `m.${id}.${n}`,
      image: `img-${id}-${n}`,
    })),
    exemplars: [{ id: `${id}-e`, role: 'teaching', targetKey: 'k', modelKey: 'm', partialModelKeys: [] }],
    delayMs: 3000,
    delayMode: 'constant',
    blockSize: 5,
    scoredBy: 'adult',
    ...over,
  };
}

const R = routine('R');

const acq = (over: Partial<AbaTargetState> = {}): AbaTargetState => ({
  ...initialTargetState(R),
  phase: 'acquisition',
  startPromptLevel: 0,
  lastSuccessfulPromptLevel: 0,
  ...over,
});
const mastered = (over: Partial<AbaTargetState> = {}): AbaTargetState => ({
  ...initialTargetState(R),
  phase: 'mastered',
  masteredBy: 'criterion',
  startPromptLevel: 0,
  lastSuccessfulPromptLevel: 0,
  lastMaintenanceDay: '2026-09-01',
  ...over,
});

function start(state: AbaTargetState | undefined, d: string, runId = `run-${d.replace(/-/g, "x")}`): RoutineRunState {
  return startRoutineRun({
    runId,
    day: d,
    target: R,
    state,
    band: '7',
    tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 5 },
    reinforcerPool: POOL,
    observers: [SPEC],
    primaryObserverId: SPEC.id,
    startedAt: Date.parse(`${d}T08:00:00Z`),
    seed: 7,
  });
}

let seq = 0;
function stepOk(run: RoutineRunState): RoutineRunState {
  const step = nextRoutineStep(run);
  if (step.kind !== 'trial') throw new Error(`ждали звено, а шаг ${step.kind}`);
  const trialStep: TrialStep = step;
  const t0 = Date.UTC(2026, 9, 1, 8);
  const log: AbaPresentation[] = [
    {
      level: trialStep.startPromptLevel as PromptLevel,
      by: 'app',
      startedAt: new Date(t0).toISOString(),
      endedAt: new Date(t0 + 1000).toISOString(),
      windowMs: trialStep.promptDelayMs ?? trialStep.responseWindowMs,
      outcome: 'correct' as PresentationOutcome,
      respondedAt: new Date(t0 + 1500).toISOString(),
    },
  ];
  seq += 1;
  const input: AbaTrialInput = {
    id: `bd-${seq}`,
    sessionId: run.runId,
    targetId: trialStep.targetId,
    exemplarId: trialStep.exemplarId,
    ...(trialStep.stepId ? { stepId: trialStep.stepId } : {}),
    ...(trialStep.runIndex !== undefined ? { runIndex: trialStep.runIndex } : {}),
    index: run.trials.length,
    kind: trialStep.trialKind,
    startPromptLevel: trialStep.startPromptLevel,
    presentationLog: log,
    promptDelayMs: trialStep.promptDelayMs,
    responseWindowMs: trialStep.responseWindowMs,
    sdEndedAt: '2026-10-01T08:00:01Z',
    scoredBy: trialStep.scoredBy,
  };
  const res = recordRoutineStep(run, input, nowOf(run));
  if (!res.ok) throw new Error(res.errors.join('; '));
  return res.run;
}

/** Момент записи звена: минута на пробу от старта прогона. */
const nowOf = (run: RoutineRunState) => run.startedAt + (run.trials.length + 1) * 60_000;

/** Прогон, оборванный срывом после `steps` верных звеньев; остаток доводит взрослый. */
function broken(state: AbaTargetState | undefined, d: string, steps = 1, setting?: 'usual' | 'other_adult' | 'other_place') {
  let run = start(state, d);
  for (let i = 0; i < steps; i += 1) run = stepOk(run);
  run = interruptRoutineRun(run, 'breakdown', nowOf(run));
  if (setting) run = setRoutineSetting(run, setting);
  return finishRoutineRun(finishRoutineByAdult(run), 7, NO_HISTORY);
}

/** Спокойный прогон: все звенья верно. */
function calm(state: AbaTargetState | undefined, d: string) {
  let run = start(state, d);
  while (nextRoutineStep(run).kind === 'trial') run = stepOk(run);
  return finishRoutineRun(run, 7, NO_HISTORY);
}

describe('срыв в обучении: не промах навыка', () => {
  it('в окно routineRuns срыв не попадает: окно точно такое же, как до прогона', () => {
    const before = acq({ routineRuns: [{ day: day(1), whole: true, startLevelSum: 0 }] });
    expect(broken(before, day(3)).state.routineRuns).toEqual(before.routineRuns);
  });

  it('записан в routineBreakdowns: день, вид, место, на каком звене', () => {
    const r = broken(acq(), day(3), 2, 'other_place');
    expect(r.state.routineBreakdowns).toEqual([{ day: day(3), kind: 'teaching', setting: 'other_place', atStep: 2 }]);
  });

  it('срыв до первого звена: atStep = 0, прогон всё равно занимает день', () => {
    const r = broken(acq(), day(3), 0);
    expect(r.state.routineBreakdowns).toEqual([{ day: day(3), kind: 'teaching', setting: 'usual', atStep: 0 }]);
    expect(r.state.lastRoutineRunDay).toBe(day(3));
  });

  it('routineStuck не затронут: срывы подряд не создают флаг no_progress и не двигают окно', () => {
    let s: AbaTargetState = acq();
    for (let d = 1; d <= ROUTINE.noProgressRuns + 2; d += 1) s = broken(s, day(d)).state;
    expect(s.flags).not.toContain('no_progress');
    expect(s.routineRuns).toBeUndefined();
  });

  it('вердикт по критерию не меняется: фаза остаётся acquisition', () => {
    expect(broken(acq(), day(3)).state.phase).toBe('acquisition');
  });

  it('записанные до срыва звенья остаются в затухании подсказок цели', () => {
    const r = broken(acq(), day(3), 1);
    const sp = r.state.stepPrompts!['R-s1'];
    expect(sp.consecutiveIndependentAtStart).toBe(1);
  });

  it('жетона за результат срыв не даёт', () => {
    expect(broken(acq(), day(3)).claim.token).toBeNull();
  });
});

describe('срыв на базовой линии: не засчитывается совсем', () => {
  it('первый день базовой линии: базовая линия не начата, день прогона занят, срыв записан', () => {
    const r = broken(undefined, day(1));
    expect(r.state.routineBaseline).toBeUndefined();
    expect(r.state.lastRoutineRunDay).toBe(day(1));
    expect(r.state.routineBreakdowns).toEqual([{ day: day(1), kind: 'baseline', setting: 'usual', atStep: 1 }]);
  });

  it('следующий день — первый засчитанный день базовой линии (срыв дня не набрал)', () => {
    const afterBreak = broken(undefined, day(1)).state;
    const next = calm(afterBreak, day(2));
    expect(next.state.routineBaseline?.days).toEqual([day(2)]);
  });

  it('срыв после набранного дня базовой линии: набранные дни и успехи по звеньям прежние', () => {
    const d1 = calm(undefined, day(1)).state;
    const r = broken(d1, day(2));
    expect(r.state.routineBaseline).toEqual(d1.routineBaseline);
  });

  it('срыв вне привычного контекста transferSeen не ставит', () => {
    expect(broken(undefined, day(1), 1, 'other_place').state.routineBaseline?.transferSeen).not.toBe(true);
  });
});

describe('срыв в поддержании: рутина снова ждёт завтра', () => {
  it('maintenanceFailsInRow и lastMaintenanceDay не двигаются, проб поддержания нет', () => {
    const before = mastered({ maintenanceFailsInRow: 1, lastMaintenanceDay: '2026-09-01' });
    const r = broken(before, day(10));
    expect([r.state.maintenanceFailsInRow, r.state.lastMaintenanceDay, r.state.phase]).toEqual([1, '2026-09-01', 'mastered']);
  });

  it('срыв не приближает возврат в обучение: после «1 провал» срыв — всё ещё один провал, а не два', () => {
    const afterFail = mastered({ maintenanceFailsInRow: 1 });
    expect(broken(afterFail, day(10)).state.phase).toBe('mastered');
  });

  it('день занят, а на следующий поддержание снова подходит', () => {
    const r = broken(mastered(), day(10));
    const states = { R: r.state };
    expect(routinesDue({ targets: [R], states, day: day(10), observers: [SPEC], primaryObserverId: SPEC.id })).toEqual([{ targetId: 'R', kind: null }]);
    expect(routinesDue({ targets: [R], states, day: day(11), observers: [SPEC], primaryObserverId: SPEC.id })).toEqual([{ targetId: 'R', kind: 'maintenance' }]);
  });

  it('индексы сессий цели не двигаются', () => {
    const before = mastered({ lastSessionIndex: 12, lastMaintenanceSessionIndex: 9 });
    const r = broken(before, day(10));
    expect([r.state.lastSessionIndex, r.state.lastMaintenanceSessionIndex]).toEqual([12, 9]);
  });
});

describe('срыв в проверке «получается дома»: вердикта нет', () => {
  const home = mastered({ masteredBy: 'home_unverified', lastMaintenanceDay: day(9) });

  it('masteredBy остаётся home_unverified, фаза mastered, срыв записан как verification', () => {
    const r = broken(home, day(10));
    expect([r.state.masteredBy, r.state.phase]).toEqual(['home_unverified', 'mastered']);
    expect(r.state.routineBreakdowns).toEqual([{ day: day(10), kind: 'verification', setting: 'usual', atStep: 1 }]);
  });

  it('после срыва проверка не пройдена и не провалена: lastMaintenanceDay прежний', () => {
    expect(broken(home, day(10)).state.lastMaintenanceDay).toBe(day(9));
  });
});

describe('внешний обрыв: состояние как до прогона', () => {
  it('state равен before, срыв не записан, счётчик срывов не тронут, день не занят', () => {
    const before = acq({ assentSessionsInRow: 1 });
    const one = stepOk(start(before, day(3)));
    const run = interruptRoutineRun(one, 'external', nowOf(one));
    const r = finishRoutineRun(run, 7, NO_HISTORY);
    expect(r.state).toEqual(before);
    expect(r.state.routineBreakdowns).toBeUndefined();
    expect(r.state.lastRoutineRunDay).toBeUndefined();
  });
});

describe('assent_concern: два срыва подряд', () => {
  it('один срыв — счётчик 1, флага нет', () => {
    const s = broken(acq(), day(1)).state;
    expect([s.assentSessionsInRow, s.flags.includes('assent_concern')]).toEqual([1, false]);
  });

  it('два срыва подряд в разные дни — флаг assent_concern', () => {
    const s = broken(broken(acq(), day(1)).state, day(2)).state;
    expect([s.assentSessionsInRow, s.flags]).toEqual([2, ['assent_concern']]);
  });

  it('срывы разных видов считаются вместе: обучение, затем поддержание', () => {
    const first = broken(acq(), day(1)).state;
    const second = broken({ ...first, phase: 'mastered', masteredBy: 'criterion', lastMaintenanceDay: '2026-09-01' }, day(12)).state;
    expect(second.flags).toContain('assent_concern');
    expect(second.routineBreakdowns?.map((b) => b.kind)).toEqual(['teaching', 'maintenance']);
  });

  it('срывы разных видов считаются вместе: базовая линия, затем обучение', () => {
    const first = broken(undefined, day(1)).state;
    const second = broken({ ...first, phase: 'acquisition' }, day(2)).state;
    expect(second.flags).toContain('assent_concern');
    expect(second.routineBreakdowns?.map((b) => b.kind)).toEqual(['baseline', 'teaching']);
  });

  it('спокойный прогон между срывами обнуляет счётчик: срыв, спокойный, срыв — флага нет', () => {
    const a = broken(acq(), day(1)).state;
    const b = calm(a, day(2)).state;
    expect(b.assentSessionsInRow).toBe(0);
    const c = broken(b, day(3)).state;
    expect([c.assentSessionsInRow, c.flags.includes('assent_concern')]).toEqual([1, false]);
  });

  it('спокойный прогон флаг не снимает: снимает только пересмотр цели', () => {
    const flagged = broken(broken(acq(), day(1)).state, day(2)).state;
    const after = calm(flagged, day(3)).state;
    expect([after.assentSessionsInRow, after.flags.includes('assent_concern')]).toEqual([0, true]);
  });

  it('withAssentConcern: экспортирована и ведёт себя одинаково для сессии и рутины', () => {
    const s0 = acq();
    const s2 = withAssentConcern(withAssentConcern(s0, true), true);
    expect([s2.assentSessionsInRow, s2.flags]).toEqual([2, ['assent_concern']]);
    expect(withAssentConcern(s2, false).assentSessionsInRow).toBe(0);
  });
});

describe('routineBreakdowns: журнал последних десяти', () => {
  const rec = (n: number) => ({ day: day(n), kind: 'teaching' as const, setting: 'usual' as const, atStep: 1 });

  it('applyRoutineBreakdown дописывает запись и не меняет исходное состояние', () => {
    const s = acq();
    const next = applyRoutineBreakdown(s, rec(1));
    expect(next.routineBreakdowns).toEqual([rec(1)]);
    expect(s.routineBreakdowns).toBeUndefined();
  });

  it('хранит не больше десяти последних', () => {
    let s = acq();
    for (let i = 1; i <= 13; i += 1) s = applyRoutineBreakdown(s, rec(i));
    expect(s.routineBreakdowns).toHaveLength(10);
    expect(s.routineBreakdowns![0].day).toBe(day(4));
    expect(s.routineBreakdowns![9].day).toBe(day(13));
  });
});

describe('targetErrors: у рутины постоянная задержка не короче 3 с', () => {
  it('контроль: рутина с constant и 3000 мс — ошибок нет', () => {
    expect(targetErrors(R)).toEqual([]);
  });

  it('прогрессивная задержка у рутины — ошибка', () => {
    expect(targetErrors(routine('P', { delayMode: 'progressive' })).join()).toMatch(/только постоянная/);
  });

  it('задержка 2999 мс — ошибка, 3000 — нет (граница)', () => {
    expect(targetErrors(routine('S', { delayMs: 2999 })).join()).toMatch(/короче 3000/);
    expect(targetErrors(routine('S', { delayMs: 3000 })).join()).not.toMatch(/короче 3000/);
  });

  it('длинная постоянная задержка допустима', () => {
    expect(targetErrors(routine('L', { delayMs: 5000 }))).toEqual([]);
  });

  it('обычная цель (не рутина) с прогрессивной короткой задержкой этой ошибкой не затронута', () => {
    const plain = routine('X', { area: 'receptive_instructions', level: 1, steps: undefined, chaining: undefined, delayMode: 'progressive', delayMs: 1000 });
    expect(targetErrors(plain).join()).not.toMatch(/только постоянная|короче 3000/);
  });
});
