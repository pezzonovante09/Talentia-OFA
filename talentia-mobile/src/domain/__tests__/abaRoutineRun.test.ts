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
  PromptLevel,
  RoutineRunRecord,
  RoutineSetting,
} from '../../types/aba';
import { ROUTINE } from '../../types/aba';
import { applyMaintenanceProbe, applyRoutineBaseline, applyRoutineRun, routineMasteryMet, routineStuck, routineTransferMet } from '../abaCriterion';
import { initialTargetState } from '../abaPrompting';
import {
  finishRoutineByAdult,
  finishRoutineRun,
  interruptRoutineRun,
  nextRoutineStep,
  recordRoutineStep,
  routinesDue,
  setRoutineSetting,
  settleRoutineBoard,
  startRoutineRun,
  type RoutineRunInput,
  type RoutineRunResult,
  type RoutineRunState,
} from '../abaRoutineRun';
import { REINFORCER_CHOICES } from '../abaTokens';
import { initialTokenTraining, type BoardStage, type TokenTrainingState } from '../abaTokenTraining';
import type { AbaTrialInput, TrialStep } from '../abaTrialStep';

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
type How = 'ok' | 'adult' | 'escalate';

function logFor(step: TrialStep, how: How): AbaPresentation[] {
  const s = step.startPromptLevel;
  const levels: PromptLevel[] =
    how === 'ok' || (how === 'adult' && !step.allowEscalation)
      ? [s]
      : how === 'escalate'
        ? [s, (s + 1) as PromptLevel]
        : 3 - s <= 2
          ? Array.from({ length: 3 - s + 1 }, (_, i) => (s + i) as PromptLevel)
          : [s, (s + 1) as PromptLevel, 3];
  const last: PresentationOutcome = how === 'adult' ? 'adult_completed' : 'correct';
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
      ...(outcome === 'correct' ? { respondedAt: new Date(endedAt + 500).toISOString() } : {}),
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

function record(run: RoutineRunState, how: How): RoutineRunState {
  const res = recordRoutineStep(run, inputFor(run, trialStep(run), how));
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
  return finishRoutineRun(play(start(state, d, over), hows), Date.parse(`${d}T08:05:00Z`), 7);
}

/** Прогон целиком с отметкой «где и с кем». */
function runAt(state: AbaTargetState | undefined, d: string, hows: How[], setting: RoutineSetting, over: Partial<RoutineRunInput> = {}): RoutineRunResult {
  const run = setRoutineSetting(play(start(state, d, over), hows), setting);
  return finishRoutineRun(run, Date.parse(`${d}T08:05:00Z`), 7);
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
    const { lastRoutineRunDay, ...rest } = d2.state;
    expect(lastRoutineRunDay).toBe(day(2));
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
      s = finishRoutineRun(setRoutineSetting(play(run, ['ok', 'ok', 'ok']), i === 5 ? 'other_adult' : 'usual'), Date.parse(`${day(i)}T08:05:00Z`), 7).state;
    }
    expect([s.phase, s.masteredBy]).toEqual(['mastered', 'home_unverified']);
  });

  it('отметка «где и с кем» попадает в окно и в запись прогона', () => {
    const run = setRoutineSetting(play(start(acq(), day(1)), ['ok', 'ok', 'ok']), 'other_place');
    const r = finishRoutineRun(run, Date.parse('2026-10-01T08:05:00Z'), 7);
    expect([r.record.setting, r.state.routineRuns?.at(-1)?.setting]).toEqual(['other_place', 'other_place']);
  });
});

describe('В1: обрыв прогона', () => {
  it('срыв: остаток доводит взрослый без проб, в окне — не целиком и interrupted', () => {
    let run = play(start(acq(), day(3)), ['ok']);
    run = interruptRoutineRun(run, 'breakdown');
    expect(nextRoutineStep(run)).toEqual({ kind: 'adult_finish_chain', targetId: 'R', stepIds: [S2, S3] });
    // звено во время доведения взрослым не пишется
    const probe = { ...inputFor(run, { ...trialStep({ ...run, status: 'running' }) }, 'ok') };
    expect(recordRoutineStep(run, probe).ok).toBe(false);
    expect(() => finishRoutineRun(run, 0, 7)).toThrow(/доводит/);

    const r = finishRoutineRun(finishRoutineByAdult(run), Date.parse('2026-10-03T08:05:00Z'), 7);
    expect(r.trials).toHaveLength(1);
    expect(r.state.routineRuns?.at(-1)).toMatchObject({ day: day(3), whole: false, interrupted: true });
    expect([r.claim.token, settle(r).token, r.record.interrupted]).toEqual([null, null, 'breakdown']);
  });

  it('срыв: заработанные жетоны не отнимаются, день занят', () => {
    const run = interruptRoutineRun(play(start(acq(), day(3)), ['ok']), 'breakdown');
    const r = finishRoutineRun(finishRoutineByAdult(run), 0, 7);
    expect(settle(r, { earned: 2, nonContingent: 1 }).board).toEqual({ earned: 2, nonContingent: 1 });
    expect(r.state.lastRoutineRunDay).toBe(day(3));
    expect(due({ R: r.state }, day(3))).toEqual([{ targetId: 'R', kind: null }]);
  });

  it('срыв на базовой линии: день засчитан, недойденные звенья — «не сам»', () => {
    const run = interruptRoutineRun(play(start(undefined, day(1)), ['ok']), 'breakdown');
    const d1 = finishRoutineRun(finishRoutineByAdult(run), 0, 7);
    expect(d1.state.routineBaseline).toEqual({ days: [day(1)], independentByStep: { [S1]: 1 }, transferSeen: false });
  });

  it('внешняя причина: в окно не пишется, состояние как до прогона, день не занят', () => {
    const before = acq(0, { routineRuns: [{ day: day(1), whole: true, startLevelSum: 0 }] });
    const run = interruptRoutineRun(play(start(before, day(3)), ['ok', 'adult']), 'external');
    expect(nextRoutineStep(run)).toEqual({ kind: 'end' });
    const r = finishRoutineRun(run, 0, 7);
    expect(r.state).toEqual(before);
    const paid = settle(r, { earned: 3, nonContingent: 0 });
    expect([paid.token, paid.board.earned, r.record.interrupted, r.record.phase]).toEqual([null, 3, 'external', null]);
    expect(due({ R: r.state }, day(3))).toEqual([{ targetId: 'R', kind: 'teaching' }]);
    expect(start(r.state, day(3)).kind).toBe('teaching');
  });

  it('обрыв — не запись звена, и оборвать можно только идущий прогон', () => {
    const run = start(acq(), day(3));
    const step = trialStep(run);
    const input = inputFor(run, step, 'ok');
    const { respondedAt: _drop, ...rest } = input.presentationLog[0];
    const res = recordRoutineStep(run, { ...input, presentationLog: [{ ...rest, outcome: 'child_break' }] });
    expect(res.ok).toBe(false);
    const stopped = interruptRoutineRun(run, 'external');
    expect(() => interruptRoutineRun(stopped, 'breakdown')).toThrow(/не идёт/);
    expect(() => finishRoutineByAdult(stopped)).toThrow(/нечего/);
  });

  it.each(['breakdown', 'external'] as const)('%s после последнего звена — ошибка: сделанный прогон не стирается', (reason) => {
    const done = play(start(acq(), day(3)), ['ok', 'ok', 'ok']);
    expect(() => interruptRoutineRun(done, reason)).toThrow(/Все звенья записаны/);
    // прогон закрывается обычным итогом и попадает в окно
    expect(finishRoutineRun(done, 0, 7).state.routineRuns?.at(-1)).toMatchObject({ whole: true });
  });

  it('незаконченный прогон без обрыва итог не даёт', () => {
    expect(() => finishRoutineRun(play(start(acq(), day(3)), ['ok']), 0, 7)).toThrow(/ещё идёт/);
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
    const r = finishRoutineRun(run, 0, 7);
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
    const run = interruptRoutineRun(play(start(before, day(10)), ['ok']), 'breakdown');
    const r = finishRoutineRun(finishRoutineByAdult(run), 0, 7);
    expect([r.state.maintenanceFailsInRow, r.state.lastSessionIndex, r.state.lastMaintenanceSessionIndex]).toEqual([1, 12, 9]);
  });

  it('срыв посреди поддержания — провал поддержания', () => {
    const run = interruptRoutineRun(play(start(mastered(), day(10)), ['ok']), 'breakdown');
    const r = finishRoutineRun(finishRoutineByAdult(run), 0, 7);
    expect([r.state.maintenanceFailsInRow, r.state.lastMaintenanceDay]).toEqual([1, day(10)]);
  });

  it('срыв до первого звена поддержания — тоже провал', () => {
    const run = interruptRoutineRun(start(mastered(), day(10)), 'breakdown');
    const r = finishRoutineRun(finishRoutineByAdult(run), 0, 7);
    expect([r.state.maintenanceFailsInRow, r.state.lastRoutineRunDay]).toEqual([1, day(10)]);
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

  it('полная доска — обмен сразу после прогона с выбором подкрепителя', () => {
    const s = settle(fullRun(acq(), day(1)), { earned: BOARD - 1, nonContingent: 0 });
    expect(s.exchange?.tokens).toBe(BOARD);
    expect(s.exchange?.options).toHaveLength(REINFORCER_CHOICES);
    for (const o of s.exchange!.options) expect(POOL).toContain(o);
    expect(s.board.earned).toBe(0);
  });

  it('неполная доска — обмена нет', () => {
    const s = settle(fullRun(acq(), day(1)), { earned: 1, nonContingent: 0 });
    expect([s.exchange, s.board.earned]).toEqual([undefined, 2]);
  });

  it('запись прогона не несёт того, что решает доска: ни жетона, ни обмена', () => {
    const r = fullRun(acq(), day(1));
    expect(r.record).not.toHaveProperty('token');
    expect(r.record).not.toHaveProperty('exchanged');
    expect(r.record).not.toHaveProperty('exchangeOptions');
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
    expect([atLimit.token, atLimit.board.earned, atLimit.exchange]).toEqual([null, BOARD - 1, undefined]);
    const below = settle(r, { earned: BOARD - 2, nonContingent: BOARD - 2 });
    expect([below.token, below.board.nonContingent]).toEqual(['participation', BOARD - 1]);
  });

  it('за звено жетона нет: жетон — только после прогона', () => {
    const run = play(start(acq(), day(1)), ['ok', 'ok', 'ok']);
    expect(run.trials.map((t) => t.tokens)).toEqual([0, 0, 0]);
    // доски в состоянии прогона нет: она живёт на устройстве и общая с сессиями
    expect(run).not.toHaveProperty('board');
    expect(finishRoutineRun(run, 0, 7).claim).toEqual({ token: 'at_start_level', tokens: 1, nonContingent: false });
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

  it('два успешных прогона в разные дни — «освоено по критерию» и день поддержания', () => {
    const first = fullRun(home(), day(2));
    expect([first.state.masteredBy, first.state.chainVerificationRuns?.length]).toEqual(['home_unverified', 1]);
    expect(() => start(first.state, day(2))).toThrow(/сегодня/);
    const second = fullRun(first.state, day(3));
    expect([second.state.masteredBy, second.state.lastMaintenanceDay, second.claim.token]).toEqual(['criterion', day(3), 'whole_independent']);
  });

  it('проваленное в обоих прогонах звено — обратно в обучение', () => {
    const first = fullRun(home(), day(2), ['ok', 'adult', 'ok']);
    const second = fullRun(first.state, day(3), ['ok', 'adult', 'ok']);
    expect(second.state.phase).toBe('acquisition');
    expect(second.state.masteredBy).toBeUndefined();
  });

  it('оборванная срывом проверка ничего не решает', () => {
    const run = interruptRoutineRun(play(start(home(), day(2)), ['ok']), 'breakdown');
    const r = finishRoutineRun(finishRoutineByAdult(run), 0, 7);
    expect([r.state.masteredBy, r.state.chainVerificationRuns ?? []]).toEqual(['home_unverified', []]);
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
    const failed = fullRun(fullRun(home, day(2), ['ok', 'adult', 'ok']).state, day(3), ['ok', 'adult', 'ok']).state;
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

  it('срыв в held-состоянии — состояние без изменений, кроме занятого дня', () => {
    const before = waiting();
    const run = interruptRoutineRun(play(start(before, day(3)), ['ok']), 'breakdown');
    const r = finishRoutineRun(finishRoutineByAdult(run), 0, 7);
    expect(r.state).toEqual({ ...before, lastRoutineRunDay: day(3) });
  });

  it('срыв в первый день базовой линии transferSeen не ставит, даже вне контекста', () => {
    const run = setRoutineSetting(interruptRoutineRun(play(start(undefined, day(1)), ['ok']), 'breakdown'), 'other_place');
    const r = finishRoutineRun(finishRoutineByAdult(run), 0, 7);
    expect(r.state.routineBaseline?.transferSeen).toBe(false);
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
