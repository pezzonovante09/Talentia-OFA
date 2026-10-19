/**
 * Прогон рутины самообслуживания вне сессии (раунд 2, Р3; спецификация `aba-pedagogy-specialist`
 * 2026-10-11): список и вид прогона, критерий через модуль, обрывы (В1), поддержание (В6),
 * жетон, застревание (В2), проверка «получается дома» (П1), постоянный SD звена (Р4).
 */
import type {
  AbaObserver,
  AbaPresentation,
  AbaTarget,
  AbaTargetState,
  PresentationOutcome,
  AbaTrial,
  PromptLevel,
  RoutineRunRecord,
  RoutineSetting,
  StepPromptState,
} from '../../types/aba';
import { CHILD_BREAK_MS, REFUSAL_CARD_OFFER_MS, REFUSAL_QUIET_MS, ROUTINE, ROUTINE_DEPENDENCE } from '../../types/aba';
import { applyMaintenanceProbe, applyRoutineBaseline, applyRoutineRun, routineMasteryMet, routineStuck, routineTransferMet } from '../abaCriterion';
import { answerLevel, applyPromptDependence, initialTargetState, routineDependentSteps, type SessionTrials } from '../abaPrompting';
import {
  closeHangingRoutineRun,
  finishRoutineByAdult,
  finishRoutineRun,
  interruptRoutineRun,
  nextRoutineStep,
  recordRoutineStep,
  resumeRoutineRun,
  routineResultWithSetting,
  routinesDue,
  routineVerificationVerdict,
  setRoutineSetting,
  settleRoutineBoard,
  startRoutineRun,
  takeRoutineBreakCard,
  type RoutineRunInput,
  type RoutineRunResult,
  type RoutineRunState,
} from '../abaRoutineRun';
import { REINFORCER_CHOICES } from '../abaTokens';
import { initialTokenTraining, type BoardStage, type TokenTrainingState } from '../abaTokenTraining';
import type { AbaTrialInput, TrialStep } from '../abaTrialStep';
import { NO_HISTORY } from './abaFixtures';

const TRAINED: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: 5 };
const POOL = ['puzzle', 'bubbles', 'drum', 'stickers', 'train', 'balloon'];
const SPEC: AbaObserver = { id: 'obs-spec', role: 'specialist', trained: true };
const PARENT: AbaObserver = { id: 'obs-par', role: 'parent', trained: false };
/** Доска полосы `7` — 5 жетонов. */
const BOARD = 5;

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
const [S1, S2, S3] = R.steps!.map((s) => s.id);

/** Рутина в обучении; звенья стартуют с `start`. */
const acq = (start: PromptLevel = 0, over: Partial<AbaTargetState> = {}): AbaTargetState => ({
  ...initialTargetState(R),
  phase: 'acquisition',
  startPromptLevel: start,
  lastSuccessfulPromptLevel: start,
  ...over,
});

/** Освоенная рутина; поддержание подойдёт через `ROUTINE.maintenanceGapDays[0]` дней после `lastMaintenanceDay`. */
const mastered = (over: Partial<AbaTargetState> = {}, t: AbaTarget = R): AbaTargetState => ({
  ...initialTargetState(t),
  phase: 'mastered',
  masteredBy: 'criterion',
  startPromptLevel: 0,
  lastSuccessfulPromptLevel: 0,
  lastMaintenanceDay: '2026-09-01',
  ...over,
});

/** День `n` октября 2026, локальный. */
const day = (n: number) => `2026-10-${String(n).padStart(2, '0')}`;

/** Выплата прогона по живой доске: что раньше решал прогон со снимком доски, теперь решает `settleRoutineBoard`. */
const settle = (
  r: RoutineRunResult,
  live: { earned: number; nonContingent: number } = { earned: 0, nonContingent: 0 },
  size: BoardStage = BOARD,
  history: string[] = [],
) => settleRoutineBoard(live, size, r.claim, { pool: POOL, history, seed: r.seed });

function start(state: AbaTargetState | undefined, d: string, over: Partial<RoutineRunInput> = {}): RoutineRunState {
  return startRoutineRun({
    runId: `run-${d}`,
    day: d,
    target: R,
    state,
    band: '7',
    tokenTraining: TRAINED,
    reinforcerPool: POOL,
    observers: [SPEC, PARENT],
    primaryObserverId: SPEC.id,
    startedAt: Date.parse(`${d}T08:00:00Z`),
    seed: 7,
    ...over,
  });
}

/**
 * Как прошло звено: `ok` — верно на стартовом уровне; `adult` — не сделал, звено доделал
 * взрослый (в обучении — после всей лестницы); `escalate` — верно после одной подсказки.
 */
type How = 'ok' | 'adult' | 'escalate' | 'break' | 'refuse' | 'resist';
/** `break` — касание детской карточки; `refuse` — «Отказ»; `resist` — «Сопротивляется» на L4 после всей лестницы. */

function logFor(step: TrialStep, how: How): AbaPresentation[] {
  const s = step.startPromptLevel;
  const full = how === 'adult' || how === 'resist';
  const levels: PromptLevel[] =
    how === 'ok' || how === 'break' || how === 'refuse' || (full && !step.allowEscalation)
      ? [s]
      : how === 'escalate'
        ? [s, (s + 1) as PromptLevel]
        : 3 - s <= 2
          ? Array.from({ length: 3 - s + 1 }, (_, i) => (s + i) as PromptLevel)
          : [s, (s + 1) as PromptLevel, 3];
  const last: PresentationOutcome = (
    { adult: 'adult_completed', break: 'child_break', refuse: 'refusal', resist: 'l4_resisted', ok: 'correct', escalate: 'correct' } as const
  )[how];
  const t0 = Date.UTC(2026, 9, 1, 8);
  return levels.map((level, i) => {
    const startedAt = t0 + i * 120_000;
    const endedAt = startedAt + 1000;
    const outcome: PresentationOutcome = i === levels.length - 1 ? last : 'none';
    return {
      level,
      by: 'app' as const,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      windowMs: i === 0 ? (step.promptDelayMs ?? step.responseWindowMs) : step.responseWindowMs,
      outcome,
      ...(outcome === 'correct' || outcome === 'child_break' ? { respondedAt: new Date(endedAt + 500).toISOString() } : {}),
    };
  });
}

let seq = 0;
function inputFor(run: RoutineRunState, step: TrialStep, how: How): AbaTrialInput {
  seq += 1;
  return {
    id: `t-${seq}`,
    sessionId: run.runId,
    targetId: step.targetId,
    exemplarId: step.exemplarId,
    ...(step.stepId ? { stepId: step.stepId } : {}),
    ...(step.runIndex !== undefined ? { runIndex: step.runIndex } : {}),
    index: run.trials.length,
    kind: step.trialKind,
    startPromptLevel: step.startPromptLevel,
    presentationLog: logFor(step, how),
    promptDelayMs: step.promptDelayMs,
    responseWindowMs: step.responseWindowMs,
    sdEndedAt: '2026-10-01T08:00:01Z',
    scoredBy: step.scoredBy,
  };
}

function trialStep(run: RoutineRunState): TrialStep {
  const step = nextRoutineStep(run);
  if (step.kind !== 'trial') throw new Error(`ждали звено, а шаг ${step.kind}`);
  return step;
}

/** Момент записи звена: минута на пробу от старта прогона (детерминированно, без реальных часов). */
const nowOf = (run: RoutineRunState) => run.startedAt + (run.trials.length + 1) * 60_000;

/** Обрыв в момент «следующей пробы». */
const cut = (run: RoutineRunState, reason: 'breakdown' | 'external') => interruptRoutineRun(run, reason, nowOf(run));

function record(run: RoutineRunState, how: How): RoutineRunState {
  const res = recordRoutineStep(run, inputFor(run, trialStep(run), how), nowOf(run));
  if (!res.ok) throw new Error(res.errors.join('; '));
  return res.run;
}

const play = (run: RoutineRunState, hows: How[]) => hows.reduce(record, run);

/** Прогон целиком: старт, звенья, итог. */
function fullRun(
  state: AbaTargetState | undefined,
  d: string,
  hows: How[] = ['ok', 'ok', 'ok'],
  over: Partial<RoutineRunInput> = {},
): RoutineRunResult {
  return finishRoutineRun(play(start(state, d, over), hows), 7,NO_HISTORY);
}

/** Прогон целиком с отметкой «где и с кем». */
function runAt(state: AbaTargetState | undefined, d: string, hows: How[], setting: RoutineSetting, over: Partial<RoutineRunInput> = {}): RoutineRunResult {
  const run = setRoutineSetting(play(start(state, d, over), hows), setting);
  return finishRoutineRun(run, 7,NO_HISTORY);
}

const due = (states: Record<string, AbaTargetState>, d: string, targets: AbaTarget[] = [R], primaryObserverId = SPEC.id) =>
  routinesDue({ targets, states, day: d, observers: [SPEC, PARENT], primaryObserverId });

// ---------------------------------------------------------------------------

describe('Р3: список «ждут прогона» и вид прогона', () => {
  it('выдаёт каждый из четырёх видов', () => {
    const [B, T, M, V] = ['B', 'T', 'M', 'V'].map((id) => routine(id));
    const states = {
      T: { ...initialTargetState(T), phase: 'acquisition' as const },
      M: mastered({}, M),
      V: mastered({ masteredBy: 'home_unverified' }, V),
    };
    expect(routinesDue({ targets: [B, T, M, V], states, day: day(10), observers: [SPEC], primaryObserverId: SPEC.id })).toEqual([
      { targetId: 'B', kind: 'baseline' },
      { targetId: 'T', kind: 'teaching' },
      { targetId: 'M', kind: 'maintenance' },
      { targetId: 'V', kind: 'verification' },
    ]);
  });

  it('второй прогон в тот же день: в списке kind null, а старт бросает', () => {
    const first = fullRun(acq(), day(5));
    expect(first.state.lastRoutineRunDay).toBe(day(5));
    expect(due({ R: first.state }, day(5))).toEqual([{ targetId: 'R', kind: null }]);
    expect(() => start(first.state, day(5))).toThrow(/сегодня прогон уже был/);
  });

  it('на следующий день рутина снова ждёт прогона', () => {
    const first = fullRun(acq(), day(5));
    expect(due({ R: first.state }, day(6))).toEqual([{ targetId: 'R', kind: 'teaching' }]);
  });

  it('граница суток — из переданного day, а не из метки времени', () => {
    // оба прогона в один UTC-день, но локальные дни разные (вечер и раннее утро по поясу +6)
    const late = fullRun(acq(), day(1), ['ok', 'ok', 'ok'], { startedAt: Date.UTC(2026, 9, 1, 17, 0) });
    expect(late.record.day).toBe(day(1));
    const early = start(late.state, day(2), { startedAt: Date.UTC(2026, 9, 1, 19, 0) });
    expect(early.kind).toBe('teaching');
  });

  it('один локальный день с метками разных UTC-дней — второй прогон не принимается', () => {
    const evening = fullRun(acq(), day(2), ['ok', 'ok', 'ok'], { startedAt: Date.UTC(2026, 9, 1, 20, 0) });
    expect(() => start(evening.state, day(2), { startedAt: Date.UTC(2026, 9, 2, 10, 0) })).toThrow(/сегодня прогон уже был/);
  });

  it('день не в формате YYYY-MM-DD — ошибка, а не догадка', () => {
    expect(() => due({}, '2026-10-1')).toThrow(/YYYY-MM-DD/);
    expect(() => start(acq(), '2026-10-01T08:00:00Z')).toThrow(/YYYY-MM-DD/);
  });

  it('verification — только когда ведёт обученный наблюдатель', () => {
    const home = mastered({ masteredBy: 'home_unverified', lastMaintenanceDay: day(9) });
    expect(due({ R: home }, day(10))).toEqual([{ targetId: 'R', kind: 'verification' }]);
    // ведущий — необученный родитель, обученный есть, но не ведёт: проверки нет, поддержание не подошло
    expect(due({ R: home }, day(10), [R], PARENT.id)).toEqual([]);
    expect(() => start(home, day(10), { primaryObserverId: PARENT.id })).toThrow(/не ждёт/);
  });

  it('без обученного ведущего «получается дома» уходит в поддержание по сроку', () => {
    const home = mastered({ masteredBy: 'home_unverified', lastMaintenanceDay: day(1) });
    expect(due({ R: home }, day(10), [R], PARENT.id)).toEqual([{ targetId: 'R', kind: 'maintenance' }]);
  });

  it('освоенная рутина без срока поддержания в список не входит', () => {
    const s = mastered({ lastMaintenanceDay: day(9) });
    expect(due({ R: s }, day(10))).toEqual([]);
    expect(due({ R: s }, day(9 + ROUTINE.maintenanceGapDays[0]))).toEqual([{ targetId: 'R', kind: 'maintenance' }]);
  });

  it('рутина с неосвоенной предпосылкой в список не входит', () => {
    const P = routine('P', { area: 'echoic' as AbaTarget['area'], steps: undefined, format: 'imitate_sound' });
    const R2 = routine('R2', { prerequisiteTargetIds: ['P'] });
    expect(routinesDue({ targets: [P, R2], states: {}, day: day(10) })).toEqual([]);
    const done = { P: { ...initialTargetState(P), phase: 'mastered' as const } };
    expect(routinesDue({ targets: [P, R2], states: done, day: day(10) })).toEqual([{ targetId: 'R2', kind: 'baseline' }]);
  });

  it('порядок — по программе, «сегодня уже было» внизу, порядок внутри групп стабилен', () => {
    const [A, B, C, D] = ['A', 'B', 'C', 'D'].map((id) => routine(id));
    const today = day(10);
    const ran = (t: AbaTarget) => ({ ...initialTargetState(t), phase: 'acquisition' as const, lastRoutineRunDay: today });
    const states = { A: ran(A), C: ran(C) };
    const rows = routinesDue({ targets: [A, B, C, D], states, day: today });
    expect(rows).toEqual([
      { targetId: 'B', kind: 'baseline' },
      { targetId: 'D', kind: 'baseline' },
      { targetId: 'A', kind: null },
      { targetId: 'C', kind: null },
    ]);
    expect(routinesDue({ targets: [A, B, C, D], states, day: today })).toEqual(rows);
  });

  it('старт не доверяет списку: не рутина, без сопряжения, малый пул — ошибка', () => {
    const plain = routine('X', { area: 'receptive_instructions', level: 1 });
    expect(() => start(undefined, day(1), { target: plain })).toThrow(/не рутина/);
    expect(() => start(acq(), day(1), { tokenTraining: initialTokenTraining() })).toThrow(/Сопряжение/);
    expect(() => start(acq(), day(1), { reinforcerPool: POOL.slice(0, 3) })).toThrow(/Пул/);
  });
});

describe('Р3: прогон не двигает номер сессии', () => {
  it('ни обучение, ни освоение не меняют индексы сессий цели, кроме отметки освоения', () => {
    const before = acq(0, { lastSessionIndex: 4, lastMaintenanceSessionIndex: 2 });
    const r = fullRun(before, day(1));
    expect([r.state.lastSessionIndex, r.state.lastMaintenanceSessionIndex]).toEqual([4, 2]);
    expect(r.record).not.toHaveProperty('sessionIndex');
  });
});

describe('Р3: критерий через модуль совпадает с прямыми функциями', () => {
  it('базовая линия за два дня даёт те же стартовые уровни, что applyRoutineBaseline', () => {
    const d1 = fullRun(undefined, day(1), ['ok', 'adult', 'adult']);
    expect(d1.state.phase).toBe('baseline');
    const d2 = fullRun(d1.state, day(2), ['ok', 'ok', 'adult']);

    const init = initialTargetState(R);
    const direct = applyRoutineBaseline(
      applyRoutineBaseline(init, d1.trials, day(1), 7, R, 'with_adult'),
      d2.trials,
      day(2),
      7,
      R,
      'with_adult',
    );
    expect(d2.state.phase).toBe('acquisition');
    expect(d2.state.stepPrompts).toEqual(direct.stepPrompts);
    expect([d2.state.stepPrompts?.[S1].startPromptLevel, d2.state.stepPrompts?.[S2].startPromptLevel, d2.state.stepPrompts?.[S3].startPromptLevel]).toEqual([0, 1, 3]);
    // прогон дополнительно ведёт счётчик срывов (`assentSessionsInRow: 0` — спокойный прогон) и день прогона
    const { lastRoutineRunDay, assentSessionsInRow, routineRunSeq, ...rest } = d2.state;
    expect(lastRoutineRunDay).toBe(day(2));
    expect(routineRunSeq).toBe(2);
    expect(assentSessionsInRow).toBe(0);
    expect(rest).toEqual(direct);
  });

  it('базовая линия: прогон в один день — второй день не засчитан, второго прогона нет', () => {
    const d1 = fullRun(undefined, day(1));
    expect(d1.state.routineBaseline?.days).toEqual([day(1)]);
    expect(() => start(d1.state, day(1))).toThrow(/сегодня/);
  });

  it('освоение 4 из 5 — то же, что applyRoutineRun по тем же записям', () => {
    const plan: How[][] = [
      ['ok', 'ok', 'ok'],
      ['ok', 'adult', 'ok'],
      ['ok', 'ok', 'ok'],
      ['ok', 'ok', 'ok'],
      ['ok', 'ok', 'ok'],
    ];
    let s = acq();
    const records: RoutineRunRecord[] = [];
    plan.forEach((hows, i) => {
      // последний прогон — в другом месте: без переноса освоения нет (Г4)
      const r = i === 4 ? runAt(s, day(i + 1), hows, 'other_place') : fullRun(s, day(i + 1), hows);
      if (r.state.phase === 'acquisition') records.push(r.state.routineRuns!.at(-1)!);
      s = r.state;
    });
    expect([s.phase, s.masteredBy, s.lastMaintenanceDay, s.routineRuns]).toEqual(['mastered', 'criterion', day(5), []]);

    // те же записи прямой функцией: окно до последнего прогона, затем последний
    const lastRecord: RoutineRunRecord = { day: day(5), whole: true, startLevelSum: records.at(-1)!.startLevelSum, setting: 'other_place' };
    expect(routineMasteryMet([...records, lastRecord])).toBe(true);
    expect(records.map((r) => r.whole)).toEqual([true, false, true, true]);
    const direct = [...records, lastRecord].reduce((x, rec) => applyRoutineRun(x, rec, 7, 'criterion', 'with_adult'), acq());
    expect([direct.phase, direct.masteredBy, direct.lastMaintenanceDay]).toEqual([s.phase, s.masteredBy, s.lastMaintenanceDay]);
  });

  it('освоение без обученного ведущего — «получается дома»', () => {
    let s = acq();
    for (let i = 1; i <= 5; i += 1) {
      const run = start(s, day(i), { primaryObserverId: PARENT.id });
      s = finishRoutineRun(setRoutineSetting(play(run, ['ok', 'ok', 'ok']), i === 5 ? 'other_adult' : 'usual'), 7, NO_HISTORY).state;
    }
    expect([s.phase, s.masteredBy]).toEqual(['mastered', 'home_unverified']);
  });

  it('отметка «где и с кем» попадает в окно и в запись прогона', () => {
    const run = setRoutineSetting(play(start(acq(), day(1)), ['ok', 'ok', 'ok']), 'other_place');
    const r = finishRoutineRun(run, 7, NO_HISTORY);
    expect([r.record.setting, r.state.routineRuns?.at(-1)?.setting]).toEqual(['other_place', 'other_place']);
  });
});

describe('В1: обрыв прогона', () => {
  it('срыв в обучении: остаток доводит взрослый без проб; в окно критерия срыв не идёт, он копится в routineBreakdowns', () => {
    let run = play(start(acq(), day(3)), ['ok']);
    run = cut(run, 'breakdown');
    expect(nextRoutineStep(run)).toEqual({ kind: 'adult_finish_chain', targetId: 'R', stepIds: [S2, S3] });
    // звено во время доведения взрослым не пишется
    const probe = { ...inputFor(run, { ...trialStep({ ...run, status: 'running' }) }, 'ok') };
    expect(recordRoutineStep(run, probe, nowOf(run)).ok).toBe(false);
    expect(() => finishRoutineRun(run, 7, NO_HISTORY)).toThrow(/доводит/);

    const r = finishRoutineRun(finishRoutineByAdult(run), 7, NO_HISTORY);
    expect(r.trials).toHaveLength(1);
    expect(r.state.routineRuns).toBeUndefined();
    expect(r.state.routineBreakdowns).toEqual([{ day: day(3), kind: 'teaching', setting: 'usual', atStep: 1 }]);
    expect([r.claim.token, settle(r).token, r.record.interrupted]).toEqual([null, null, 'breakdown']);
  });

  it('срыв: заработанные жетоны не отнимаются, день занят', () => {
    const run = cut(play(start(acq(), day(3)), ['ok']), 'breakdown');
    const r = finishRoutineRun(finishRoutineByAdult(run), 7, NO_HISTORY);
    expect(settle(r, { earned: 2, nonContingent: 1 }).board).toEqual({ earned: 2, nonContingent: 1 });
    expect(r.state.lastRoutineRunDay).toBe(day(3));
    expect(due({ R: r.state }, day(3))).toEqual([{ targetId: 'R', kind: null }]);
  });

  it('срыв на базовой линии не засчитывается совсем: день базовой линии не набран, но день прогона занят', () => {
    const run = cut(play(start(undefined, day(1)), ['ok']), 'breakdown');
    const d1 = finishRoutineRun(finishRoutineByAdult(run), 7, NO_HISTORY);
    expect(d1.state.routineBaseline).toBeUndefined();
    expect(d1.state.lastRoutineRunDay).toBe(day(1));
    expect(d1.state.routineBreakdowns).toEqual([{ day: day(1), kind: 'baseline', setting: 'usual', atStep: 1 }]);
  });

  it('внешняя причина: в окно не пишется, состояние как до прогона, день не занят', () => {
    const before = acq(0, { routineRuns: [{ day: day(1), whole: true, startLevelSum: 0 }] });
    const run = cut(play(start(before, day(3)), ['ok', 'adult']), 'external');
    expect(nextRoutineStep(run)).toEqual({ kind: 'end' });
    const r = finishRoutineRun(run, 7, NO_HISTORY);
    expect(r.state).toEqual(before);
    const paid = settle(r, { earned: 3, nonContingent: 0 });
    expect([paid.token, paid.board.earned, r.record.interrupted, r.record.phase]).toEqual([null, 3, 'external', null]);
    expect(due({ R: r.state }, day(3))).toEqual([{ targetId: 'R', kind: 'teaching' }]);
    expect(start(r.state, day(3)).kind).toBe('teaching');
  });

  it('обрыв — не запись звена, и оборвать можно только идущий прогон', () => {
    const run = start(acq(), day(3));
    const stopped = cut(run, 'external');
    expect(stopped.trials).toEqual([]);
    expect(() => cut(stopped, 'breakdown')).toThrow(/не идёт/);
    expect(() => finishRoutineByAdult(stopped)).toThrow(/нечего/);
    // после обрыва звено не пишется
    expect(recordRoutineStep(stopped, inputFor(run, trialStep(run), 'ok'), nowOf(run)).ok).toBe(false);
  });

  it('конец прогона — момент обрыва, а не момент итога: довод взрослым в длительность не входит', () => {
    const run = play(start(acq(), day(3)), ['ok']);
    const at = nowOf(run);
    const r = finishRoutineRun(finishRoutineByAdult(interruptRoutineRun(run, 'breakdown', at)), 7, NO_HISTORY);
    expect(r.record.endedAt).toBe(new Date(at).toISOString());
  });

  it('конец прогона — момент записи последнего звена', () => {
    const two = play(start(acq(), day(3)), ['ok', 'ok']);
    const at = nowOf(two);
    const done = record(two, 'ok');
    expect(done.endedAt).toBe(at);
    expect(two.endedAt).toBeNull();
    expect(finishRoutineRun(done, 7, NO_HISTORY).record.endedAt).toBe(new Date(at).toISOString());
  });

  it.each(['breakdown', 'external'] as const)('%s после последнего звена — ошибка: сделанный прогон не стирается', (reason) => {
    const done = play(start(acq(), day(3)), ['ok', 'ok', 'ok']);
    expect(() => cut(done, reason)).toThrow(/Все звенья записаны/);
    // прогон закрывается обычным итогом и попадает в окно
    expect(finishRoutineRun(done, 7, NO_HISTORY).state.routineRuns?.at(-1)).toMatchObject({ whole: true });
  });

  it('незаконченный прогон без обрыва итог не даёт', () => {
    expect(() => finishRoutineRun(play(start(acq(), day(3)), ['ok']), 7, NO_HISTORY)).toThrow(/ещё идёт/);
  });
});

describe('В6: поддержание прогоном', () => {
  it('звенья — с L0 без подсказок, несделанное доделывает взрослый', () => {
    const run = start(mastered(), day(10));
    expect(run.kind).toBe('maintenance');
    expect(trialStep(run)).toMatchObject({ trialKind: 'maintenance', startPromptLevel: 0, allowEscalation: false, adultCompletesOnFail: true });
  });

  it('звено без ответа — adultCompleted, прогон продолжается и засчитан провалом', () => {
    let run = play(start(mastered(), day(10)), ['ok', 'adult']);
    expect(run.trials[1]).toMatchObject({ stepId: S2, response: 'no_response', adultCompleted: true });
    expect(nextRoutineStep(run)).toMatchObject({ kind: 'trial', stepId: S3 });
    run = record(run, 'ok');
    const r = finishRoutineRun(run, 7, NO_HISTORY);
    expect([r.state.phase, r.state.maintenanceFailsInRow, r.state.lastMaintenanceDay, r.claim.token]).toEqual(['maintenance', 1, day(10), null]);
  });

  it('прогон целиком сам — поддержание пройдено, интервал растёт, жетон за целиком сам', () => {
    const r = fullRun(mastered(), day(10));
    expect([r.state.phase, r.state.maintenanceGapIndex, r.state.lastMaintenanceDay, r.claim.token]).toEqual(['maintenance', 1, day(10), 'whole_independent']);
  });

  it('два провала подряд в разные дни — повторное обучение со звеньев от их последнего успеха', () => {
    // у S2 последний успех был с подсказкой L2, у остальных — сам
    const fresh = { currentDelayMs: 3000, consecutiveIndependentAtStart: 0, consecutiveAboveStart: 0, consecutiveFailures: 0 };
    const stepPrompts = Object.fromEntries(
      [S1, S2, S3].map((id) => [id, { ...fresh, startPromptLevel: 0 as PromptLevel, lastSuccessfulPromptLevel: (id === S2 ? 2 : 0) as PromptLevel }]),
    );
    const first = fullRun(mastered({ stepPrompts }), day(10), ['ok', 'adult', 'ok']);
    expect(first.state.phase).toBe('maintenance');
    const next = day(10 + ROUTINE.maintenanceGapDays[0]);
    expect(due({ R: first.state }, next)).toEqual([{ targetId: 'R', kind: 'maintenance' }]);
    const second = fullRun(first.state, next, ['ok', 'adult', 'ok']);
    expect(second.state.phase).toBe('acquisition');
    expect([S1, S2, S3].map((id) => second.state.stepPrompts?.[id].startPromptLevel)).toEqual([0, 2, 0]);
    expect(second.record.phase).toEqual({ from: 'maintenance', to: 'acquisition' });
  });

  it.each([
    ['пройдено', ['ok', 'ok', 'ok'] as How[]],
    ['провал', ['ok', 'adult', 'ok'] as How[]],
  ])('%s: прогон поддержания не двигает индексы сессий цели', (_, hows) => {
    const before = mastered({ lastSessionIndex: 12, lastMaintenanceSessionIndex: 9 });
    const r = fullRun(before, day(10), hows);
    expect([r.state.lastSessionIndex, r.state.lastMaintenanceSessionIndex]).toEqual([12, 9]);
  });

  it('два провала подряд: и при возврате в обучение индексы сессий как до прогонов', () => {
    const before = mastered({ lastSessionIndex: 12, lastMaintenanceSessionIndex: 9 });
    const first = fullRun(before, day(10), ['ok', 'adult', 'ok']);
    const second = fullRun(first.state, day(10 + ROUTINE.maintenanceGapDays[0]), ['ok', 'adult', 'ok']);
    expect([second.state.phase, second.state.lastSessionIndex, second.state.lastMaintenanceSessionIndex]).toEqual(['acquisition', 12, 9]);
  });

  it('срыв в поддержании индексы сессий тоже не двигает', () => {
    const before = mastered({ lastSessionIndex: 12, lastMaintenanceSessionIndex: 9 });
    const run = cut(play(start(before, day(10)), ['ok']), 'breakdown');
    const r = finishRoutineRun(finishRoutineByAdult(run), 7, NO_HISTORY);
    expect([r.state.maintenanceFailsInRow, r.state.lastSessionIndex, r.state.lastMaintenanceSessionIndex]).toEqual([0, 12, 9]);
  });

  it('срыв посреди поддержания — не провал навыка: проб нет, fails и день поддержания не двигаются, срыв записан', () => {
    const run = cut(play(start(mastered(), day(10)), ['ok']), 'breakdown');
    const r = finishRoutineRun(finishRoutineByAdult(run), 7, NO_HISTORY);
    expect([r.state.maintenanceFailsInRow ?? 0, r.state.lastMaintenanceDay]).toEqual([0, '2026-09-01']);
    expect(r.state.routineBreakdowns).toEqual([{ day: day(10), kind: 'maintenance', setting: 'usual', atStep: 1 }]);
  });

  it('срыв до первого звена поддержания — тоже не провал; день прогона занят, поддержание ждёт завтра', () => {
    const run = cut(start(mastered(), day(10)), 'breakdown');
    const r = finishRoutineRun(finishRoutineByAdult(run), 7, NO_HISTORY);
    expect([r.state.maintenanceFailsInRow ?? 0, r.state.lastRoutineRunDay, r.state.lastMaintenanceDay]).toEqual([0, day(10), '2026-09-01']);
    expect(due({ R: r.state }, day(10))).toEqual([{ targetId: 'R', kind: null }]);
    expect(due({ R: r.state }, day(11))).toEqual([{ targetId: 'R', kind: 'maintenance' }]);
  });
});

describe('Жетон после прогона', () => {
  it('обучение: каждое звено на своём стартовом уровне — жетон at_start_level, даже не целиком сам', () => {
    const r = fullRun(acq(1), day(1));
    expect(r.trials.every((t) => t.response === 'prompted')).toBe(true);
    const s = settle(r, { earned: 1, nonContingent: 0 });
    expect([s.token, s.board.earned]).toEqual(['at_start_level', 2]);
  });

  it('обучение: понадобилась эскалация — без жетона', () => {
    const r = fullRun(acq(1), day(1), ['ok', 'escalate', 'ok']);
    const s = settle(r, { earned: 1, nonContingent: 0 });
    expect([s.token, s.board.earned]).toEqual([null, 1]);
  });

  it('обучение: взрослый доделал звено — без жетона', () => {
    const r = fullRun(acq(0), day(1), ['ok', 'ok', 'adult']);
    const s = settle(r, { earned: 1, nonContingent: 0 });
    expect([s.token, s.board.earned]).toEqual([null, 1]);
  });

  it('полная доска — после прогона предложение обмена с выбором подкрепителя; жетоны остаются на доске до выбора', () => {
    const s = settle(fullRun(acq(), day(1)), { earned: BOARD - 1, nonContingent: 0 });
    expect(s.offer?.tokens).toBe(BOARD);
    expect(s.offer?.options).toHaveLength(REINFORCER_CHOICES);
    for (const o of s.offer!.options) expect(POOL).toContain(o);
    expect(s.board.earned).toBe(BOARD);
  });

  it('неполная доска — предложения нет', () => {
    const s = settle(fullRun(acq(), day(1)), { earned: 1, nonContingent: 0 });
    expect([s.offer, s.board.earned]).toEqual([undefined, 2]);
  });

  it('запись прогона не несёт того, что решает доска: ни жетона, ни обмена', () => {
    const r = fullRun(acq(), day(1));
    expect(r.record).not.toHaveProperty('token');
    expect(r.record).not.toHaveProperty('exchangeOffer');
  });

  it('базовая линия: заявка на жетон за участие, не за результат', () => {
    const r = fullRun(undefined, day(1), ['adult', 'adult', 'adult']);
    expect(r.claim).toEqual({ token: 'participation', tokens: 1, nonContingent: true });
    const s = settle(r, { earned: 0, nonContingent: 0 });
    expect([s.token, s.board.earned, s.board.nonContingent]).toEqual(['participation', 1, 1]);
  });

  it('жетон за участие учитывается в лимите size − 1 на цикл доски', () => {
    const r = fullRun(undefined, day(1));
    const atLimit = settle(r, { earned: BOARD - 1, nonContingent: BOARD - 1 });
    expect([atLimit.token, atLimit.board.earned, atLimit.offer]).toEqual([null, BOARD - 1, undefined]);
    const below = settle(r, { earned: BOARD - 2, nonContingent: BOARD - 2 });
    expect([below.token, below.board.nonContingent]).toEqual(['participation', BOARD - 1]);
  });

  it('за звено жетона нет: жетон — только после прогона', () => {
    const run = play(start(acq(), day(1)), ['ok', 'ok', 'ok']);
    expect(run.trials.map((t) => t.tokens)).toEqual([0, 0, 0]);
    // доски в состоянии прогона нет: она живёт на устройстве и общая с сессиями
    expect(run).not.toHaveProperty('board');
    expect(finishRoutineRun(run, 7, NO_HISTORY).claim).toEqual({ token: 'at_start_level', tokens: 1, nonContingent: false });
  });
});

describe('В2: застревание рутины', () => {
  const window10 = (whole: boolean[], startLevelSum: (i: number) => number): RoutineRunRecord[] =>
    whole.map((w, i) => ({ day: day(1 + Math.floor(i / 2)), whole: w, startLevelSum: startLevelSum(i) }));
  const none = Array<boolean>(10).fill(false);

  it('стартовые уровни снижаются, доля целиком самих не растёт — не застряла', () => {
    expect(routineStuck(window10(none, (i) => (i < 5 ? 6 : 3)))).toBe(false);
  });

  it('ни снижения, ни роста — застряла', () => {
    expect(routineStuck(window10(none, () => 6))).toBe(true);
  });

  it('стартовые уровни выросли, доля не растёт — застряла', () => {
    expect(routineStuck(window10(none, (i) => (i < 5 ? 3 : 6)))).toBe(true);
  });

  it('через applyRoutineRun: снижение уровней снимает no_progress, их застой — ставит', () => {
    const feed = (sums: (i: number) => number) =>
      window10(none, sums).reduce((s, rec) => applyRoutineRun(s, rec, 7, 'criterion', 'with_adult'), acq(3));
    expect(feed((i) => (i < 5 ? 9 : 6)).flags).not.toContain('no_progress');
    expect(feed(() => 9).flags).toContain('no_progress');
  });

  it('startLevelSum записи — сумма стартовых уровней звеньев до прогона', () => {
    const before = acq(0, {
      stepPrompts: {
        [S1]: { currentDelayMs: 3000, startPromptLevel: 0, lastSuccessfulPromptLevel: 0, consecutiveIndependentAtStart: 0, consecutiveAboveStart: 0, consecutiveFailures: 0 },
        [S2]: { currentDelayMs: 3000, startPromptLevel: 2, lastSuccessfulPromptLevel: 2, consecutiveIndependentAtStart: 0, consecutiveAboveStart: 0, consecutiveFailures: 0 },
        [S3]: { currentDelayMs: 3000, startPromptLevel: 3, lastSuccessfulPromptLevel: 3, consecutiveIndependentAtStart: 0, consecutiveAboveStart: 0, consecutiveFailures: 0 },
      },
    });
    const r = fullRun(before, day(1), ['ok', 'ok', 'ok']);
    expect(r.state.routineRuns?.at(-1)?.startLevelSum).toBe(5);
  });
});

describe('П1: проверка «получается дома» прогонами', () => {
  const home = () => mastered({ masteredBy: 'home_unverified', lastMaintenanceDay: day(1) });

  it('звенья проверки — без подсказок, с L0', () => {
    const run = start(home(), day(2));
    expect(run.kind).toBe('verification');
    expect(trialStep(run)).toMatchObject({ trialKind: 'verification', startPromptLevel: 0, allowEscalation: false });
  });

  it('два прогона целиком сами в разные дни — «освоено по критерию» и день поддержания', () => {
    const first = fullRun(home(), day(2));
    expect([first.state.masteredBy, first.state.routineVerificationRuns]).toEqual(['home_unverified', [{ runNo: 1, day: day(2) }]]);
    expect(() => start(first.state, day(2))).toThrow(/сегодня/);
    const second = fullRun(first.state, day(3));
    expect([second.state.masteredBy, second.state.lastMaintenanceDay, second.claim.token]).toEqual(['criterion', day(3), 'whole_independent']);
    expect(second.state.routineVerificationRuns).toEqual([]);
    expect(second.state.maintenanceGapIndex).toBe(first.state.maintenanceGapIndex + 1);
  });

  it('один прогон целиком сам — ещё не освоено по критерию', () => {
    expect(fullRun(home(), day(2)).state.masteredBy).toBe('home_unverified');
  });

  it('первый же не целиком самостоятельный прогон — провал сразу: обучение без проверок IOA, проваленное звено с уровня ответа, прочие с L0', () => {
    const r = fullRun(home(), day(2), ['ok', 'adult', 'ok']);
    // IOA ведётся по сессиям, рутина в сессии не бывает: счётчик не уменьшился бы никогда (методист, раунд 4)
    expect([r.state.phase, r.state.masteredBy, r.state.ioaDueSessions]).toEqual(['acquisition', undefined, undefined]);
    expect([S1, S2, S3].map((id) => r.state.stepPrompts?.[id].startPromptLevel)).toEqual([0, answerLevel(R), 0]);
    expect(r.record.phase).toEqual({ from: 'mastered', to: 'acquisition' });
    expect(r.claim.token).toBeNull();
  });

  it('целиком сам, затем провал — провал: набранный успешный прогон не спасает', () => {
    const first = fullRun(home(), day(2));
    const second = fullRun(first.state, day(3), ['ok', 'ok', 'adult']);
    expect([second.state.phase, second.state.routineVerificationRuns]).toEqual(['acquisition', []]);
  });

  it('оборванная срывом проверка ничего не решает', () => {
    const run = cut(play(start(home(), day(2)), ['ok']), 'breakdown');
    const r = finishRoutineRun(finishRoutineByAdult(run), 7, NO_HISTORY);
    expect([r.state.masteredBy, r.state.routineVerificationRuns ?? []]).toEqual(['home_unverified', []]);
  });

  it('routineVerificationVerdict: не все звенья в пробах — ничего не решает', () => {
    const s = home();
    const one = fullRun(home(), day(2)).trials.slice(0, 2);
    expect(routineVerificationVerdict(s, R, one, 1, day(2))).toBe(s);
  });
});

describe('Р4: SD звена рутины постоянен', () => {
  it('картинка и инструкция звена одинаковы в 10 прогонах с разными seed', () => {
    const sdOf = (seed: number) => {
      let run = start(acq(), day(1), { seed });
      const out: { stepId?: string; exemplarId: string; sdVariantKey?: string; image?: string; sdKey?: string }[] = [];
      for (let i = 0; i < R.steps!.length; i += 1) {
        const step = trialStep(run);
        const def = R.steps!.find((s) => s.id === step.stepId)!;
        out.push({ stepId: step.stepId, exemplarId: step.exemplarId, sdVariantKey: step.sdVariantKey, image: def.image, sdKey: def.sdKey });
        run = record(run, 'ok');
      }
      return out;
    };
    const reference = sdOf(1);
    expect(reference.map((x) => x.stepId)).toEqual([S1, S2, S3]);
    expect(new Set(reference.map((x) => x.image)).size).toBe(3);
    for (let seed = 2; seed <= 10; seed += 1) expect(sdOf(seed * 7919)).toEqual(reference);
  });
});

// ---------------------------------------------------------------------------
// Г4: перенос рутины (методист, 2026-10-12)

describe('Г4: перенос — критерий и окно', () => {
  type Spec = [whole: boolean, setting?: RoutineSetting, interrupted?: true];
  const recs = (specs: Spec[]): RoutineRunRecord[] =>
    specs.map(([whole, setting, interrupted], i) => ({
      day: day(1 + i),
      whole,
      startLevelSum: 0,
      ...(setting ? { setting } : {}),
      ...(interrupted ? { interrupted } : {}),
    }));
  const feedRecs = (specs: Spec[], from: AbaTargetState = acq()) =>
    recs(specs).reduce((s, rec) => applyRoutineRun(s, rec, 7, 'criterion', 'with_adult'), from);
  const USUAL5: Spec[] = [[true, 'usual'], [true, 'usual'], [true, 'usual'], [true, 'usual'], [true, 'usual']];

  it('окно выполнено, все пять прогонов в привычном контексте — обучение, флаг needs_transfer, окно сохранено', () => {
    const s = feedRecs(USUAL5);
    expect([s.phase, s.masteredBy, s.flags.includes('needs_transfer'), s.routineRuns?.length]).toEqual(['acquisition', undefined, true, 5]);
  });

  it('прогоны без отметки setting считаются привычным контекстом: переноса нет', () => {
    const s = feedRecs(USUAL5.map(([w]) => [w] as Spec));
    expect([s.phase, s.flags.includes('needs_transfer')]).toEqual(['acquisition', true]);
  });

  it.each(['other_place', 'other_adult'] as const)('окно выполнено и один прогон целиком сам с setting %s — освоено, окно обнуляется', (setting) => {
    const s = feedRecs([[true, 'usual'], [true, 'usual'], [true, setting], [true, 'usual'], [true, 'usual']]);
    expect([s.phase, s.masteredBy, s.routineRuns, s.flags.includes('needs_transfer')]).toEqual(['mastered', 'criterion', [], false]);
  });

  it('перенос в первом прогоне окна из пяти ещё в окне — освоено', () => {
    expect(feedRecs([[true, 'other_place'], [true, 'usual'], [true, 'usual'], [true, 'usual'], [true, 'usual']]).phase).toBe('mastered');
  });

  it('прогон вне контекста, но не целиком сам, перенос не засчитывает', () => {
    const s = feedRecs([[true, 'usual'], [false, 'other_place'], [true, 'usual'], [true, 'usual'], [true, 'usual']]);
    expect([s.phase, s.flags.includes('needs_transfer')]).toEqual(['acquisition', true]);
  });

  it('прогон вне контекста, оборванный срывом, перенос не засчитывает', () => {
    const s = feedRecs([[true, 'usual'], [false, 'other_adult', true], [true, 'usual'], [true, 'usual'], [true, 'usual']]);
    expect([s.phase, s.flags.includes('needs_transfer')]).toEqual(['acquisition', true]);
  });

  it('routineTransferMet: оборванный прогон вне контекста не переносит, даже если помечен whole', () => {
    expect(routineTransferMet([{ whole: true, interrupted: true, setting: 'other_place' }])).toBe(false);
    expect(routineTransferMet([{ whole: true, setting: 'other_place' }])).toBe(true);
    expect(routineTransferMet([])).toBe(false);
  });

  it('перенос выпал из окна из пяти — не засчитан', () => {
    // окно уже было [перенос, 3 обычных, провал]: освоения нет; шестой прогон выталкивает перенос из окна
    const before = acq(0, { routineRuns: recs([[true, 'other_place'], [true, 'usual'], [true, 'usual'], [true, 'usual'], [false, 'usual']]) });
    const sixth: RoutineRunRecord = { day: day(6), whole: true, startLevelSum: 0, setting: 'usual' };
    const window = [...before.routineRuns!, sixth];
    expect([routineTransferMet(window.slice(0, 5)), routineTransferMet(window)]).toEqual([true, false]);
    const s = applyRoutineRun(before, sixth, 7, 'criterion', 'with_adult');
    expect([s.phase, s.flags.includes('needs_transfer')]).toEqual(['acquisition', true]);
  });

  it('перенос есть, а окно не выполнено (3 из 5) — не освоено и не «почти»', () => {
    const s = feedRecs([[true, 'other_place'], [false], [false], [true], [true]]);
    expect([s.phase, s.flags.includes('needs_transfer')]).toEqual(['acquisition', false]);
  });

  it('перенос есть, но последний прогон не сам — не освоено', () => {
    const s = feedRecs([[true, 'other_place'], [true], [true], [true], [false]]);
    expect([s.phase, s.flags.includes('needs_transfer')]).toEqual(['acquisition', false]);
  });

  it('перенос есть, но дней меньше трёх — не освоено', () => {
    const same = recs([[true, 'other_place'], [true], [true], [true], [true]]).map((r, i) => ({ ...r, day: day(i < 3 ? 1 : 2) }));
    expect(routineMasteryMet(same)).toBe(false);
  });

  it('флаг снимается при освоении: шестой прогон вне контекста', () => {
    const waiting = feedRecs(USUAL5);
    expect(waiting.flags).toContain('needs_transfer');
    const s = applyRoutineRun(waiting, { day: day(6), whole: true, startLevelSum: 0, setting: 'other_place' }, 7, 'criterion', 'with_adult');
    expect([s.phase, s.flags.includes('needs_transfer')]).toEqual(['mastered', false]);
  });

  it('флаг снимается при понижении: после «почти» прогон не сам — критерий не выполнен', () => {
    const waiting = feedRecs(USUAL5);
    const s = applyRoutineRun(waiting, { day: day(6), whole: false, startLevelSum: 0 }, 7, 'criterion', 'with_adult');
    expect([s.phase, s.flags.includes('needs_transfer')]).toEqual(['acquisition', false]);
  });

  it('routineStuck: «почти» (критерий выполнен, переноса нет) не ставит no_progress', () => {
    const ten: RoutineRunRecord[] = Array.from({ length: 10 }, (_, i) => ({
      day: day(1 + Math.floor(i / 2)),
      whole: true,
      startLevelSum: 0,
      setting: 'usual' as const,
    }));
    expect(routineStuck(ten)).toBe(false);
    const s = ten.reduce((x, rec) => applyRoutineRun(x, rec, 7, 'criterion', 'with_adult'), acq());
    expect([s.flags.includes('needs_transfer'), s.flags.includes('no_progress')]).toEqual([true, false]);
  });

  it('откат из поддержания (два провала) требует перенос заново', () => {
    const first = feedRecs([[true, 'usual'], [true, 'usual'], [true, 'other_place'], [true, 'usual'], [true, 'usual']]);
    expect(first.phase).toBe('mastered');
    const failed = fullRun(mastered(), day(10), ['ok', 'adult', 'ok']);
    const fail = { ...failed.trials[1], kind: 'maintenance' as const, response: 'incorrect' as const };
    const back = applyMaintenanceProbe(applyMaintenanceProbe(first, fail, 20), fail, 21);
    expect(back.phase).toBe('acquisition');
    const again = recs(USUAL5).reduce((x, rec) => applyRoutineRun(x, rec, 22, 'criterion', 'with_adult'), back);
    expect([again.phase, again.flags.includes('needs_transfer')]).toEqual(['acquisition', true]);
  });
});

describe('Г4: перенос — прогоны через finishRoutineRun', () => {
  const teachToWaiting = () => {
    let s = acq();
    for (let i = 1; i <= 5; i += 1) s = fullRun(s, day(i)).state;
    return s;
  };

  it('setting протянут в обучение: прогон вне контекста в окне даёт освоение', () => {
    let s = acq();
    for (let i = 1; i <= 4; i += 1) s = fullRun(s, day(i)).state;
    expect(s.phase).toBe('acquisition');
    const r = runAt(s, day(5), ['ok', 'ok', 'ok'], 'other_adult');
    expect([r.state.phase, r.record.phase]).toEqual(['mastered', { from: 'acquisition', to: 'mastered' }]);
  });

  it('пять прогонов в привычном контексте — рутина «почти»: фаза прежняя, флаг стоит', () => {
    const waiting = teachToWaiting();
    expect([waiting.phase, waiting.flags.includes('needs_transfer')]).toEqual(['acquisition', true]);
  });

  it('routinesDue отдаёт hint transfer при флаге и не отдаёт без него', () => {
    const waiting = teachToWaiting();
    expect(due({ R: waiting }, day(6))).toEqual([{ targetId: 'R', kind: 'teaching', hint: 'transfer' }]);
    expect(due({ R: acq() }, day(6))).toEqual([{ targetId: 'R', kind: 'teaching' }]);
  });

  it('после освоения переносом routinesDue подсказки не даёт', () => {
    const done = runAt(teachToWaiting(), day(6), ['ok', 'ok', 'ok'], 'other_place').state;
    expect(done.phase).toBe('mastered');
    expect(due({ R: done }, day(7))).toEqual([]);
    expect(due({ R: done }, day(6 + ROUTINE.maintenanceGapDays[0]))).toEqual([{ targetId: 'R', kind: 'maintenance' }]);
  });

  it('home_unverified и criterion ведут себя одинаково: без переноса оба «почти», с переносом оба освоены', () => {
    const outcomes = (primaryObserverId: string, lastSetting: RoutineSetting) => {
      let s = acq();
      for (let i = 1; i <= 5; i += 1) s = runAt(s, day(i), ['ok', 'ok', 'ok'], i === 5 ? lastSetting : 'usual', { primaryObserverId }).state;
      return [s.phase, s.masteredBy, s.flags.includes('needs_transfer')];
    };
    expect(outcomes(SPEC.id, 'usual')).toEqual(['acquisition', undefined, true]);
    expect(outcomes(PARENT.id, 'usual')).toEqual(['acquisition', undefined, true]);
    expect(outcomes(SPEC.id, 'other_place')).toEqual(['mastered', 'criterion', false]);
    expect(outcomes(PARENT.id, 'other_place')).toEqual(['mastered', 'home_unverified', false]);
  });

  it('проверка «получается дома» перенос не требует: два прогона в привычном контексте — criterion', () => {
    const home = mastered({ masteredBy: 'home_unverified', lastMaintenanceDay: day(1) });
    const second = fullRun(fullRun(home, day(2)).state, day(3));
    expect([second.state.masteredBy, second.state.flags.includes('needs_transfer')]).toEqual(['criterion', false]);
  });

  it('откат из проваленной проверки требует перенос заново', () => {
    const home = mastered({ masteredBy: 'home_unverified', lastMaintenanceDay: day(1) });
    const failed = fullRun(home, day(2), ['ok', 'adult', 'ok']).state;
    expect(failed.phase).toBe('acquisition');
    // окно не переносится через откат: пять целых прогонов в привычном — снова только «почти»
    const again = Array.from({ length: 5 }, (_, i): RoutineRunRecord => ({ day: day(4 + i), whole: true, startLevelSum: 0, setting: 'usual' })).reduce(
      (x, rec) => applyRoutineRun(x, rec, 7, 'criterion', 'with_adult'),
      failed,
    );
    expect([again.phase, again.flags.includes('needs_transfer')]).toEqual(['acquisition', true]);
  });
});

describe('Г4: перенос — базовая линия', () => {
  /** Два прогона целиком сами в привычном контексте: ждёт переноса. */
  const waiting = () => fullRun(fullRun(undefined, day(1)).state, day(2)).state;

  it('оба прогона целиком сами в привычном — фаза baseline, needs_transfer, transferSeen false', () => {
    const s = waiting();
    expect([s.phase, s.flags.includes('needs_transfer'), s.routineBaseline?.transferSeen, s.masteredBy]).toEqual(['baseline', true, false, undefined]);
  });

  it('целиком сам вне контекста уже в первый из двух дней — освоено по базовой линии', () => {
    const s = runAt(runAt(undefined, day(1), ['ok', 'ok', 'ok'], 'other_place').state, day(2), ['ok', 'ok', 'ok'], 'usual').state;
    expect([s.phase, s.masteredBy, s.routineBaseline, s.flags.includes('needs_transfer')]).toEqual(['mastered', 'baseline', undefined, false]);
  });

  it('вне контекста, но звено не сам — перенос не засчитан: обучение, а не освоение', () => {
    const s = runAt(runAt(undefined, day(1), ['ok', 'ok', 'ok'], 'usual').state, day(2), ['ok', 'adult', 'ok'], 'other_place').state;
    expect([s.phase, s.masteredBy]).toEqual(['acquisition', undefined]);
  });

  it('следующий прогон: целиком сам вне контекста — освоено, masteredBy baseline, флаг снят', () => {
    const s = runAt(waiting(), day(3), ['ok', 'ok', 'ok'], 'other_adult').state;
    expect([s.phase, s.masteredBy, s.routineBaseline, s.flags.includes('needs_transfer'), s.lastMaintenanceDay]).toEqual(['mastered', 'baseline', undefined, false, day(3)]);
  });

  it('следующий прогон: звено не сам — обучение, сделанное самим L0, не сделанное L1, флаг снят', () => {
    const s = fullRun(waiting(), day(3), ['ok', 'adult', 'ok']).state;
    expect(s.phase).toBe('acquisition');
    expect([S1, S2, S3].map((id) => s.stepPrompts?.[id].startPromptLevel)).toEqual([0, 1, 0]);
    expect([s.flags.includes('needs_transfer'), s.routineBaseline]).toEqual([false, undefined]);
  });

  it('следующий прогон: звено не сам вне контекста — тоже обучение, перенос не спасает', () => {
    const s = runAt(waiting(), day(3), ['adult', 'ok', 'ok'], 'other_place').state;
    expect([s.phase, s.stepPrompts?.[S1].startPromptLevel, s.stepPrompts?.[S2].startPromptLevel]).toEqual(['acquisition', 1, 0]);
  });

  it('следующий прогон: целиком сам в привычном — состояние держится, ждёт переноса', () => {
    const s = fullRun(waiting(), day(3)).state;
    expect([s.phase, s.flags.includes('needs_transfer'), s.routineBaseline?.transferSeen]).toEqual(['baseline', true, false]);
  });

  it('срыв в held-состоянии — базовая линия без изменений; прибавились только занятый день и запись срыва', () => {
    const before = waiting();
    const run = cut(play(start(before, day(3)), ['ok']), 'breakdown');
    const r = finishRoutineRun(finishRoutineByAdult(run), 7, NO_HISTORY);
    expect(r.state).toEqual({
      ...before,
      lastRoutineRunDay: day(3),
      routineRunSeq: (before.routineRunSeq ?? 0) + 1,
      assentSessionsInRow: 1,
      routineBreakdowns: [{ day: day(3), kind: 'baseline', setting: 'usual', atStep: 1 }],
    });
    expect(r.state.routineBaseline).toEqual(before.routineBaseline);
  });

  it('срыв в первый день базовой линии transferSeen не ставит, даже вне контекста; базовая линия не начата', () => {
    const run = setRoutineSetting(cut(play(start(undefined, day(1)), ['ok']), 'breakdown'), 'other_place');
    const r = finishRoutineRun(finishRoutineByAdult(run), 7, NO_HISTORY);
    expect(r.state.routineBaseline?.transferSeen).not.toBe(true);
    expect(r.state.routineBaseline).toBeUndefined();
    expect(r.state.routineBreakdowns).toEqual([{ day: day(1), kind: 'baseline', setting: 'other_place', atStep: 1 }]);
  });

  it('setting протянут в базовую линию: transferSeen ставит только целиком сам прогон вне контекста', () => {
    const away = runAt(undefined, day(1), ['ok', 'ok', 'ok'], 'other_place').state;
    expect(away.routineBaseline?.transferSeen).toBe(true);
    const awayPartial = runAt(undefined, day(1), ['ok', 'adult', 'ok'], 'other_place').state;
    expect(awayPartial.routineBaseline?.transferSeen).toBe(false);
  });

  it('routinesDue: ждущая переноса базовая линия помечена hint transfer', () => {
    expect(due({ R: waiting() }, day(3))).toEqual([{ targetId: 'R', kind: 'baseline', hint: 'transfer' }]);
  });
});

describe('Методист В2: зависимость от подсказки у рутины', () => {
  /** Прогон за прогоном с накопленной историей, как её отдаёт хранилище (`routineHistoryOf`). */
  function course(hows: How[][], withHistory = true, from: AbaTargetState = acq(0)) {
    let state = from;
    const runs: SessionTrials[] = [];
    const results: RoutineRunResult[] = [];
    hows.forEach((h, i) => {
      const d = day(i + 1);
      const history = withHistory ? { runs: [...runs] } : NO_HISTORY;
      const res = finishRoutineRun(play(start(state, d), h), 7,history);
      runs.push({ index: res.record.runNo ?? runs.length + 1, trials: res.trials });
      results.push(res);
      state = res.state;
    });
    return { state, results };
  }
  const ESC: How[] = ['escalate', 'escalate', 'escalate'];

  const W = ROUTINE_DEPENDENCE.windowRuns;
  const times = (n: number, h: How[]) => Array.from({ length: n }, () => h);
  /** Только второе звено ждёт подсказку, остальные — сами. */
  const MIX: How[] = ['ok', 'escalate', 'ok'];

  it(`В8: ${W} прогонов «дождался подсказки» — флаг prompt_dependent и все звенья специалисту; уровни и задержка не тронуты`, () => {
    const { state, results } = course(times(W, ESC));
    for (const r of results.slice(0, W - 1)) expect(r.state.flags).not.toContain('prompt_dependent');
    expect(state.flags).toContain('prompt_dependent');
    expect(state.dependenceFlaggedAtSession).toBe(W);
    expect(state.dependentStepIds).toEqual([S1, S2, S3]);
    // только флаг (В2): ни старт, ни задержка, ни счётчики звеньев реакцией не меняются
    const noReaction = finishRoutineRun(play(start(results[W - 2].state, day(W)), ESC), 7, NO_HISTORY).state;
    expect(state.stepPrompts).toEqual(noReaction.stepPrompts);
    expect([state.startPromptLevel, state.currentDelayMs]).toEqual([noReaction.startPromptLevel, noReaction.currentDelayMs]);
  });

  it('В8: детектор по звену — одно подсказанное звено среди самостоятельных не тонет', () => {
    const { state } = course(times(W, MIX));
    expect([state.flags.includes('prompt_dependent'), state.dependentStepIds]).toEqual([true, [S2]]);
  });

  it(`В8: ${W - 1} прогонов — судить не по чему, флага нет`, () => {
    expect(course(times(W - 1, ESC)).state.flags).not.toContain('prompt_dependent');
  });

  it('В8: у звена меньше пяти подсказанных проб в окне — не зависимо', () => {
    // четыре подсказанных и одна самостоятельная у второго звена
    const { state } = course([...times(W - 1, MIX), ['ok', 'ok', 'ok']]);
    expect(state.flags).not.toContain('prompt_dependent');
  });

  it('В8: routineDependentSteps не берёт пробы, снятые перерывом', () => {
    const s = acq(0);
    const t = (stepId: string, response: AbaTrial['response']) =>
      ({ kind: 'teaching', stepId, startPromptLevel: 0, response, emittedBeforePrompt: false }) as AbaTrial;
    const runs: SessionTrials[] = Array.from({ length: W }, (_, i) => ({
      index: i + 1,
      trials: i === 0 ? [t(S2, 'interrupted'), t(S2, 'independent')] : [t(S2, 'prompted')],
    }));
    expect(routineDependentSteps(s, runs, [S1, S2, S3])).toEqual([]);
    const allPrompted = runs.map((r) => ({ ...r, trials: [t(S2, 'interrupted'), t(S2, 'prompted')] }));
    expect(routineDependentSteps(s, allPrompted, [S1, S2, S3])).toEqual([S2]);
  });

  it('без истории прогонов детектор молчит: забытый вход не ставит флаг', () => {
    expect(course(times(W, ESC), false).state.flags).not.toContain('prompt_dependent');
  });

  it('после флага окно начинается заново: следующий прогон флаг не продлевает', () => {
    const { state, results } = course(times(W + 1, ESC));
    expect(results[W - 1].state.dependenceFlaggedAtSession).toBe(W);
    expect(state.dependenceFlaggedAtSession).toBe(W);
  });

  it('самостоятельные прогоны флага не дают', () => {
    const OK: How[] = ['ok', 'ok', 'ok'];
    expect(course(times(W, OK)).state.flags).not.toContain('prompt_dependent');
  });

  it('базовая линия детектор не запускает: она измеряет, а не учит', () => {
    const ADULT: How[] = ['adult', 'adult', 'adult'];
    const base = course(times(W, ADULT), true, initialTargetState(R));
    expect(base.state.flags).not.toContain('prompt_dependent');
  });

  it('номер прогона — счётчик в состоянии, а не позиция в журнале: флаг хранит его, окно после флага идёт дальше', () => {
    // счётчик уже на 40: старые прогоны срезаны сроком хранения, в истории остались только новые
    const { state, results } = course(times(W + 1, ESC), true, acq(0, { routineRunSeq: 40 }));
    expect(results.map((r) => r.record.runNo)).toEqual([41, 42, 43, 44, 45, 46]);
    expect(results.map((r) => r.state.routineRunSeq)).toEqual([41, 42, 43, 44, 45, 46]);
    expect(results[W - 1].state.dependenceFlaggedAtSession).toBe(45);
    expect(state.dependenceFlaggedAtSession).toBe(45);
  });

  it('прогон, отменённый извне, счётчик не двигает и номера не получает', () => {
    const before = acq(0, { routineRunSeq: 5 });
    const run = cut(play(start(before, day(2)), ['ok', 'adult']), 'external');
    const r = finishRoutineRun(run, 7, NO_HISTORY);
    expect(r.state.routineRunSeq).toBe(5);
    expect(r.record.runNo).toBeUndefined();
  });

  describe('сброс в L0 только у звеньев с зависимостью (applyPromptDependence)', () => {
    const trial = (stepId: string, over: Partial<AbaTrial> = {}) =>
      ({
        kind: 'teaching',
        stepId,
        startPromptLevel: 0,
        response: 'prompted',
        emittedBeforePrompt: false,
        ...over,
      }) as AbaTrial;
    const ps = (startPromptLevel: PromptLevel): StepPromptState => ({
      currentDelayMs: 3000,
      startPromptLevel,
      consecutiveIndependentAtStart: 2,
      consecutiveAboveStart: 1,
      consecutiveFailures: 1,
      lastSuccessfulPromptLevel: startPromptLevel,
    });
    // три прогона: S1 стартует с L2 и стоит на нём (не освоено), S2 с L0 ждёт подсказку, S3 с L0 делает сам
    const sessions: SessionTrials[] = [1, 2, 3].map((index) => ({
      index,
      trials: [
        trial(S1, { startPromptLevel: 2 }),
        trial(S2),
        trial(S2),
        trial(S3, { response: 'independent', emittedBeforePrompt: true }),
        trial(S3, { response: 'independent', emittedBeforePrompt: true }),
      ],
    }));
    const state = acq(0, { stepPrompts: { [S1]: ps(2), [S2]: ps(1), [S3]: ps(0) } });

    it('звено на L2 без проб со старта L0 и звено, которое делает само, не трогаются', () => {
      const after = applyPromptDependence(state, R, 43, sessions);
      expect(after.dependenceFlaggedAtSession).toBe(43);
      expect(after.flags).toContain('prompt_dependent');
      expect(after.stepPrompts?.[S1]).toEqual(state.stepPrompts?.[S1]);
      expect(after.stepPrompts?.[S3]).toEqual(state.stepPrompts?.[S3]);
      expect(after.stepPrompts?.[S2]).toMatchObject({
        startPromptLevel: 0,
        consecutiveIndependentAtStart: 0,
        consecutiveAboveStart: 0,
        consecutiveFailures: 0,
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Раунд 4, Д3: карточка «перерыв» и «Отказ» в звене рутины (методист 2026-10-19)

describe('Д3: перерыв по детской карточке в звене', () => {
  it('прерванное звено — проба interrupted/child_break с msSinceSd; done не растёт; пауза CHILD_BREAK_MS полосы', () => {
    const run = record(start(acq(), day(3)), 'break');
    expect(run.trials).toHaveLength(1);
    expect(run.trials[0]).toMatchObject({ stepId: S1, response: 'interrupted', interruptedBy: 'child_break', tokens: 0 });
    expect(run.trials[0].msSinceSd).toBe(500);
    expect([run.done, run.requests, run.refusals, run.status]).toEqual([0, 1, 0, 'running']);
    expect(run.pause).toEqual({ by: 'child_card', maxMs: CHILD_BREAK_MS['7'] });
    expect(nextRoutineStep(run)).toEqual({ kind: 'break', by: 'child_card', maxMs: CHILD_BREAK_MS['7'] });
  });

  it('пауза по полосе: у 5-6 короче, чем у 7', () => {
    const young = record(start(acq(), day(3), { band: '5-6' }), 'break');
    expect(young.pause?.maxMs).toBe(CHILD_BREAK_MS['5-6']);
    expect(CHILD_BREAK_MS['5-6']).toBeLessThan(CHILD_BREAK_MS['7']);
  });

  it('во время перерыва звено не пишется; после resumeRoutineRun — то же звено, повтор ссылается на снятую пробу', () => {
    const paused = record(start(acq(), day(3)), 'break');
    const step = trialStep({ ...paused, pause: null });
    expect(recordRoutineStep(paused, inputFor(paused, step, 'ok'), nowOf(paused)).ok).toBe(false);
    const resumed = resumeRoutineRun(paused);
    expect(trialStep(resumed)).toMatchObject({ stepId: S1 });
    const after = record(resumed, 'ok');
    expect(after.trials[1]).toMatchObject({ stepId: S1, response: 'independent', requeuedFromTrialId: paused.trials[0].id });
    expect([after.done, after.requeueOf]).toEqual([1, null]);
    // следующее звено — уже без ссылки
    expect(record(after, 'ok').trials[2].requeuedFromTrialId).toBeUndefined();
  });

  it('resumeRoutineRun без перерыва — ошибка', () => {
    expect(() => resumeRoutineRun(start(acq(), day(3)))).toThrow(/Перерыва нет/);
  });

  it('одна просьба при всех звеньях «сам» — прогон целиком сам: в окне whole, поддержание даёт жетон', () => {
    const teach = play(resumeRoutineRun(record(start(acq(), day(3)), 'break')), ['ok', 'ok', 'ok']);
    const r = finishRoutineRun(teach, 7, NO_HISTORY);
    expect([r.record.interrupted, r.state.routineRuns?.at(-1)?.whole, r.claim.token]).toEqual([null, true, 'at_start_level']);
    expect(r.breakRequests).toEqual({ requests: 1, ended: false });

    const keep = play(resumeRoutineRun(record(start(mastered(), day(10)), 'break')), ['ok', 'ok', 'ok']);
    const m = finishRoutineRun(keep, 7, NO_HISTORY);
    expect([m.claim.token, m.state.maintenanceFailsInRow ?? 0, m.state.lastMaintenanceDay]).toEqual(['whole_independent', 0, day(10)]);
  });

  it('спокойный прогон с одной просьбой счётчик тревожных прогонов обнуляет', () => {
    const run = play(resumeRoutineRun(record(start(acq(0, { assentSessionsInRow: 1 }), day(3)), 'break')), ['ok', 'ok', 'ok']);
    expect(finishRoutineRun(run, 7, NO_HISTORY).state.assentSessionsInRow).toBe(0);
  });
});

describe('Д3: второе прерывание и «Сопротивляется» — конец прогона assent_withdrawn', () => {
  const withdrawnRun = (state: AbaTargetState = acq(), d = day(3)) => {
    const once = play(resumeRoutineRun(record(start(state, d), 'break')), ['ok']);
    return record(once, 'break');
  };

  it('вторая просьба: прогон кончен, остаток не пишется, конец — момент второй просьбы', () => {
    const once = play(resumeRoutineRun(record(start(acq(), day(3)), 'break')), ['ok']);
    const at = nowOf(once);
    const run = record(once, 'break');
    expect([run.status, run.interrupted, run.pause, run.done, run.requests, run.endedAt]).toEqual(['finished', 'assent_withdrawn', null, 1, 2, at]);
    expect(nextRoutineStep(run)).toEqual({ kind: 'end' });
    expect(recordRoutineStep(run, inputFor(run, trialStep({ ...run, status: 'running' }), 'ok'), nowOf(run)).ok).toBe(false);
  });

  it('итог: день занят, номер прогона есть, жетона нет, в окно и в срывы не идёт, тревожность +1', () => {
    const before = acq(0, { routineRuns: [{ day: day(1), whole: true, startLevelSum: 0 }], routineRunSeq: 4 });
    const r = finishRoutineRun(withdrawnRun(before), 7, NO_HISTORY);
    expect([r.record.interrupted, r.record.runNo, r.state.routineRunSeq, r.state.lastRoutineRunDay]).toEqual(['assent_withdrawn', 5, 5, day(3)]);
    expect(r.claim).toEqual({ token: null, tokens: 0, nonContingent: false });
    expect(settle(r, { earned: 2, nonContingent: 0 }).board).toEqual({ earned: 2, nonContingent: 0 });
    expect(r.state.routineRuns).toEqual(before.routineRuns);
    expect(r.state.routineBreakdowns).toBeUndefined();
    expect(r.state.assentSessionsInRow).toBe(1);
    expect(r.breakRequests).toEqual({ requests: 2, ended: true });
    expect(due({ R: r.state }, day(3))).toEqual([{ targetId: 'R', kind: null }]);
  });

  it('просьба и «Отказ» в любом сочетании — тоже два прерывания', () => {
    const once = play(resumeRoutineRun(record(start(acq(), day(3)), 'refuse')), ['ok']);
    const run = record(once, 'break');
    expect([run.interrupted, run.requests, run.refusals]).toEqual(['assent_withdrawn', 1, 1]);
  });

  it('«Сопротивляется» — сразу конец, без паузы', () => {
    const run = record(start(acq(0), day(3), { physicalPromptAllowed: true }), 'resist');
    expect(run.trials[0]).toMatchObject({ response: 'interrupted', interruptedBy: 'l4_resisted' });
    expect([run.status, run.interrupted, run.pause, run.requests, run.refusals]).toEqual(['finished', 'assent_withdrawn', null, 0, 0]);
    const r = finishRoutineRun(run, 7, NO_HISTORY);
    expect([r.claim.token, r.state.routineBreakdowns, r.state.assentSessionsInRow]).toEqual([null, undefined, 1]);
  });

  it('два тревожных прогона подряд — assent_concern: два отказа от продолжения', () => {
    const first = finishRoutineRun(withdrawnRun(), 7, NO_HISTORY).state;
    const second = finishRoutineRun(
      record(play(resumeRoutineRun(record(start(first, day(4)), 'break')), ['ok']), 'refuse'),
      7,
      NO_HISTORY,
    ).state;
    expect([second.assentSessionsInRow, second.flags.includes('assent_concern')]).toEqual([2, true]);
  });

  it('два тревожных прогона подряд — assent_concern: срыв, затем отказ от продолжения', () => {
    const broke = finishRoutineRun(finishRoutineByAdult(cut(play(start(acq(), day(3)), ['ok']), 'breakdown')), 7, NO_HISTORY).state;
    const s = finishRoutineRun(withdrawnRun(broke, day(4)), 7, NO_HISTORY).state;
    expect(s.flags).toContain('assent_concern');
  });

  it('прерванные пробы в окно не считаются: routineRunRecord видит только повтор звена', () => {
    const r = finishRoutineRun(play(resumeRoutineRun(record(start(acq(), day(3)), 'refuse')), ['ok', 'ok', 'ok']), 7, NO_HISTORY);
    expect(r.trials).toHaveLength(4);
    expect(r.state.routineRuns?.at(-1)).toMatchObject({ whole: true });
  });
});

describe('Д3: «Отказ» в звене — тихая пауза с подсвеченной карточкой', () => {
  it('пауза refusal: тихая REFUSAL_QUIET_MS, карточка подсвечена REFUSAL_CARD_OFFER_MS; это не просьба', () => {
    const run = record(start(acq(), day(3)), 'refuse');
    expect(run.trials[0]).toMatchObject({ response: 'interrupted', interruptedBy: 'assent' });
    expect([run.requests, run.refusals]).toEqual([0, 1]);
    expect(nextRoutineStep(run)).toEqual({ kind: 'break', by: 'refusal', maxMs: REFUSAL_QUIET_MS, offerCardMs: REFUSAL_CARD_OFFER_MS });
  });

  it('касание подсвеченной карточки — полный перерыв полосы, но не просьба', () => {
    const run = takeRoutineBreakCard(record(start(acq(), day(3)), 'refuse'));
    expect(run.pause).toEqual({ by: 'refusal', maxMs: CHILD_BREAK_MS['7'], offerCardMs: REFUSAL_CARD_OFFER_MS, cardTaken: true });
    expect(nextRoutineStep(run)).toEqual({ kind: 'break', by: 'refusal', maxMs: CHILD_BREAK_MS['7'] });
    expect(run.requests).toBe(0);
    const r = finishRoutineRun(play(resumeRoutineRun(run), ['ok', 'ok', 'ok']), 7, NO_HISTORY);
    expect(r.breakRequests).toEqual({ requests: 0, ended: false });
  });

  it('takeRoutineBreakCard без подсвеченной карточки — ошибка: после детской карточки, второй раз, без паузы', () => {
    expect(() => takeRoutineBreakCard(start(acq(), day(3)))).toThrow(/карточки/);
    expect(() => takeRoutineBreakCard(record(start(acq(), day(3)), 'break'))).toThrow(/карточки/);
    expect(() => takeRoutineBreakCard(takeRoutineBreakCard(record(start(acq(), day(3)), 'refuse')))).toThrow(/карточки/);
  });

  it('обрыв во время паузы снимает паузу', () => {
    const paused = record(start(acq(), day(3)), 'refuse');
    const stopped = interruptRoutineRun(paused, 'external', nowOf(paused));
    expect([stopped.pause, stopped.requeueOf, stopped.status]).toEqual([null, null, 'finished']);
  });
});

describe('В5: висящий прогон', () => {
  it('старт при незаписанном свёрнутом прогоне бросает', () => {
    const pending = play(start(acq(), day(3)), ['ok']);
    expect(() => start(acq(), day(3), { runId: 'other', pending })).toThrow(/Не записан прогон run-2026-10-03/);
    expect(start(acq(), day(3), { pending: null }).kind).toBe('teaching');
  });

  it('идущий — внешний обрыв: день не занят, номер не выдан, конец — момент закрытия', () => {
    const before = acq(0, { routineRunSeq: 3 });
    const run = play(start(before, day(3)), ['ok']);
    const closed = closeHangingRoutineRun(run, Date.parse('2026-10-04T07:00:00Z'));
    expect([closed.status, closed.interrupted, closed.endedAt]).toEqual(['finished', 'external', Date.parse('2026-10-04T07:00:00Z')]);
    const r = finishRoutineRun(closed, 7, NO_HISTORY);
    expect([r.state, r.record.runNo]).toEqual([before, undefined]);
  });

  it('идущий во время паузы — тоже внешний обрыв, пауза снята', () => {
    const closed = closeHangingRoutineRun(record(start(acq(), day(3)), 'break'), 1);
    expect([closed.interrupted, closed.pause]).toEqual(['external', null]);
  });

  it('срыв, который доводил взрослый, — срыв: сигнал о согласии не теряется', () => {
    const run = cut(play(start(acq(), day(3)), ['ok']), 'breakdown');
    const closed = closeHangingRoutineRun(run, Date.parse('2026-10-04T07:00:00Z'));
    expect([closed.status, closed.interrupted, closed.endedAt]).toEqual(['finished', 'breakdown', run.endedAt]);
    expect(finishRoutineRun(closed, 7, NO_HISTORY).state.assentSessionsInRow).toBe(1);
  });

  it('с записанным последним звеном — как есть', () => {
    const run = play(start(acq(), day(3)), ['ok', 'ok', 'ok']);
    expect(closeHangingRoutineRun(run, Date.parse('2026-10-04T07:00:00Z'))).toBe(run);
  });
});

describe('Д2: пересчёт итога с местом (routineResultWithSetting)', () => {
  it('тот же прогон с other_place: тот же runNo, место в записи и в окне, состояние — от before', () => {
    let s = acq();
    for (let i = 1; i <= 4; i += 1) s = fullRun(s, day(i)).state;
    const run = play(start(s, day(5)), ['ok', 'ok', 'ok']);
    const t1 = finishRoutineRun(run, 7, NO_HISTORY);
    expect([t1.state.phase, t1.state.flags.includes('needs_transfer')]).toEqual(['acquisition', true]);
    const t2 = routineResultWithSetting({ run: t1.run, t1State: t1.state, sessionIndex: t1.sessionIndex, history: t1.history }, 'other_place');
    expect(t2.record.runNo).toBe(t1.record.runNo);
    expect([t2.record.setting, t2.state.phase, t2.state.flags.includes('needs_transfer')]).toEqual(['other_place', 'mastered', false]);
    expect(t2.record.endedAt).toBe(t1.record.endedAt);
    expect(t2.claim).toEqual(t1.claim);
  });
});

describe('В3: prompt_dependent снимается освоением рутины', () => {
  it('прогон, переводящий в освоенную фазу, снимает флаг; номер флага остаётся, dependenceClearedAt — runNo', () => {
    let s = acq(0, { flags: ['prompt_dependent'], dependenceFlaggedAtSession: 2, dependentStepIds: [S2], routineRunSeq: 2 });
    for (let i = 1; i <= 4; i += 1) s = fullRun(s, day(i)).state;
    expect(s.flags).toContain('prompt_dependent');
    const r = runAt(s, day(5), ['ok', 'ok', 'ok'], 'other_place');
    expect(r.state.phase).toBe('mastered');
    expect(r.state.flags).not.toContain('prompt_dependent');
    expect([r.state.dependenceFlaggedAtSession, r.state.dependenceClearedAt, r.state.dependentStepIds]).toEqual([2, 7, undefined]);
  });

  it('прогон без освоения флаг не снимает', () => {
    const s = acq(0, { flags: ['prompt_dependent'], dependenceFlaggedAtSession: 1, dependentStepIds: [S2] });
    const r = fullRun(s, day(1));
    expect([r.state.flags.includes('prompt_dependent'), r.state.dependenceClearedAt]).toEqual([true, undefined]);
  });
});
