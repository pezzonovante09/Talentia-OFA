/**
 * Жетон за участие на проверках — решение методиста 2 (ABA.md, последний раздел, №205) с рецензией 2026-11-18:
 * - блок измерения (базовая линия, проверка сверху вниз) кончается жетоном за участие даже при доске на 1;
 * - блок измерения, чья последняя проба неуспешна (ошибка, промах наблюдения, проверку оборвала ошибка), — участие
 *   в долг; долг платит первая успешная проба не измерения, не коррекции и не закрывающей, а в конце занятия —
 *   закрывающая L3 на той же цели и экземпляре, если последняя проба занятия была на ней;
 * - блок без единого выбора не платит участие никогда, и в долг тоже;
 * - занятие, где все обмены свободные (доска из жетонов за участие), в окно ступени доски не входит.
 * Источник — вопрос 115 (REBUILD.md): прогон домена 2026-11-13, второе занятие без награды.
 *
 * Харнесс — как в `abaPlacementObservingMiss.test.ts` / `abaParentStage.test.ts`: настоящие цели ABA, полоса 5–6,
 * «Со взрослым», пробы через модель экрана (`matchTrialRun`).
 */
import { ABA_TARGETS, readyAbaTargets } from '../../content/aba';
import { DEV_PLACEHOLDER_ART } from '../../services/local/abaStart';
import type { AbaTargetState, AbaTrial } from '../../types/aba';
import { matchDueAt, matchTrialInput, optionActive, startMatchTrial, stepMatchTrial, type MatchTrialRun } from '../../ui/aba/model/matchTrialRun';
import {
  accessShown,
  chooseReinforcer,
  finishAbaSession,
  finishAccess,
  finishBreak,
  nextStep,
  recordTrial,
  startAbaSession,
  type AbaSessionResult,
  type AbaSessionState,
  type AbaStep,
  type RecordResult,
  type StartInput,
  type TrialStep,
} from '../abaSession';
import { targetForBand } from '../abaTargetRules';
import { participationAward } from '../abaTokens';
import { applyStageSession, initialTokenTraining, type StageSession, type TokenTrainingState } from '../abaTokenTraining';
import { isObservingMiss } from '../abaPrompting';

type Act = 'correct' | 'none' | 'incorrect';

const POOL = ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'];
const T0 = Date.UTC(2026, 10, 15, 6);
const TARGETS = readyAbaTargets(ABA_TARGETS, DEV_PLACEHOLDER_ART).map((t) => targetForBand(t, '5-6'));
const SUCCESS = new Set(['independent', 'prompted']);

/** «Верно» — образец и такая же карточка; «неверно» — образец и другая; «нет ответа» — окна истекают без касаний. */
function runTrial(r0: MatchTrialRun, act: Act, at0: number): { r: MatchTrialRun; at: number } {
  let r = r0;
  let at = at0;
  if (act !== 'none') {
    if (r.sampleTouchedAt === null) r = stepMatchTrial(r, { type: 'tap_sample', at: (at += 1000) });
    const id = act === 'correct' ? r.step.sampleCardId! : r.step.field!.find((x) => x !== r.step.sampleCardId)!;
    if (optionActive(r, id)) r = stepMatchTrial(r, { type: 'tap_option', id, at: (at += 500) });
  }
  for (let guard = 0; !r.done && guard < 50; guard += 1) {
    if (r.awaitingL4) {
      r = stepMatchTrial(r, { type: 'adult', button: 'l4_skipped', at });
      break;
    }
    const due = matchDueAt(r);
    if (due === null) break;
    at = Math.max(at, due);
    r = stepMatchTrial(r, { type: 'due', at });
  }
  return { r, at };
}

type Child = {
  states: Record<string, AbaTargetState>;
  tokenTraining: TokenTrainingState;
  board?: StartInput['board'];
  identifySets: StartInput['identifySets'];
  index: number;
  now: number;
};

/** После знакомства: доска на ступени 1, ни одной цели не трогали. */
const freshChild = (): Child => ({ states: {}, tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 1 }, identifySets: [], index: 0, now: T0 });

const inputOf = (c: Child, seed: number): StartInput => ({
  sessionId: `s${c.index}`,
  sessionIndex: c.index,
  day: '2026-11-15',
  config: 'with_adult',
  band: '5-6',
  targets: TARGETS,
  states: c.states,
  reinforcerPool: POOL,
  reinforcerApart: [],
  reinforcerHistory: [],
  tokenTraining: c.tokenTraining,
  startedAt: c.now,
  seed,
  ...(c.board ? { board: c.board } : {}),
  identifySets: c.identifySets,
  physicalPromptAllowed: false,
  autoPlacement: true,
  observers: [{ id: 'o1', role: 'parent', trained: false }],
  primaryObserverId: 'o1',
});

type Recorded = Extract<RecordResult, { ok: true }>;
type EndStep = Extract<AbaStep, { kind: 'end' }>;
type Run = {
  child: Child;
  result: AbaSessionResult;
  trials: AbaTrial[];
  planned: AbaSessionState;
  records: Recorded[];
  /** Шаг пробы, как его получил экран, — параллельно `records`. */
  steps: TrialStep[];
  end: EndStep;
  /** Доля жетонов, которую отдал `nextStep` (жетон за участие на снятии конца блока). */
  stepParticipation: boolean;
};

/** Ответ на пробу: шаг и её номер среди проб того же вида той же цели в занятии (с нуля). */
type Policy = (step: TrialStep, n: number) => Act;

/** Одно занятие до конца: пробы — по `policy` (и закрывающая), высоковероятные — верно. */
function runSession(c: Child, policy: Policy, seed = 1000 + c.index): Run {
  let now = c.now + 3 * 3600_000;
  let st = startAbaSession(inputOf({ ...c, now }, seed));
  const planned = st;
  let seq = 0;
  const seen = new Map<string, number>();
  const records: Recorded[] = [];
  const steps: TrialStep[] = [];
  let end: EndStep | null = null;
  let stepParticipation = false;
  for (let guard = 0; guard < 400; guard += 1) {
    const next = nextStep(st, now);
    st = next.state;
    stepParticipation ||= next.participation;
    const step = next.step;
    if (step.kind === 'choose_reinforcer') st = chooseReinforcer(st, step.options[0], now, 'child');
    else if (step.kind === 'break') {
      now += 60_000;
      st = finishBreak(st, now).state;
    } else if (step.kind === 'access') {
      st = accessShown(st);
      now += step.durationMs;
      st = finishAccess(st, now);
    } else if (step.kind === 'end') {
      end = step;
      break;
    } else if (step.kind === 'adult_finish_chain') throw new Error('цепочек в match нет');
    else {
      const key = `${step.targetId}|${step.trialKind}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      const act = step.trialKind === 'high_p' ? 'correct' : policy(step, n);
      const run = startMatchTrial({ step, target: st.targets[step.targetId], config: 'with_adult', seed: st.seed, trialId: `t${(seq += 1)}`, sessionId: st.sessionId, index: st.trials.length, shownAt: now });
      const done = runTrial(run, act, now);
      now = done.at + 200;
      const res = recordTrial(st, matchTrialInput(done.r), now);
      if (!res.ok) throw new Error(res.errors.join('; '));
      records.push(res);
      steps.push(step);
      st = res.state;
      now += 5000;
    }
  }
  if (!end) throw new Error('занятие не дошло до конца');
  const result = finishAbaSession(st, now, {}, undefined, undefined, { routineExchangeInWindow: false });
  const child: Child = {
    states: { ...c.states, ...result.states },
    tokenTraining: result.tokenTraining,
    board: { earned: result.board.earned, nonContingent: result.board.nonContingent, ...(result.board.returned ? { returned: result.board.returned } : {}) },
    identifySets: result.identifySets,
    index: c.index + 1,
    now,
  };
  return { child, result, trials: st.trials, planned, records, steps, end, stepParticipation };
}

/** Очередь плана строкой: проба — `вид:цель`, конец блока — `END:цель:participation`. */
const plan = (st: AbaSessionState) =>
  st.queue.map((x) => (x.kind === 'trial' ? `${x.trial.kind}:${x.trial.targetId}` : x.kind === 'block_end' ? `END:${x.targetId}:${x.participation}` : x.kind));

const participations = (r: Run) => r.result.session.events.filter((e) => e.kind === 'participation');
const pairings = (r: Run) => r.result.session.events.filter((e) => e.kind === 'pairing');

const allCorrect: Policy = () => 'correct';
const TOP = 'match-shape';
const COLOR = 'match-color-3';
const BOARD_1 = { size: 1 as const, earned: 0, nonContingent: 0 };

// ---------------------------------------------------------------------------
// Жетон за участие: исключение блока измерения из предела size − 1
// ---------------------------------------------------------------------------

describe('participationAward: блок измерения', () => {
  it('на доске 1 вне измерения жетона за участие нет — предел size − 1 = 0', () => {
    expect(participationAward(BOARD_1).tokens).toBe(0);
  });

  it('на доске 1 блок измерения получает жетон за участие', () => {
    expect(participationAward(BOARD_1, true).tokens).toBe(1);
  });

  it('на полной доске блок измерения жетона за участие не получает', () => {
    expect(participationAward({ size: 1, earned: 1, nonContingent: 1 }, true).tokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Сценарий А — вопрос 115: занятия 1 и 2 после знакомства, всё верно
// ---------------------------------------------------------------------------

describe('вопрос 115: занятия 1 и 2 после знакомства, всё верно', () => {
  const s1 = runSession(freshChild(), allCorrect);
  const s2 = runSession(s1.child, allCorrect);

  it('занятие 1 — один блок проверки match-shape из 5 проб, конец блока с жетоном за участие', () => {
    expect(plan(s1.planned)).toEqual(['reinforcer', ...Array(5).fill(`baseline:${TOP}`), `END:${TOP}:true`]);
    expect(s1.planned.placementTargetIds).toEqual([TOP]);
  });

  it('занятие 1 — жетон за участие заполняет доску на 1: 1 жетон, 1 обмен, событие participation на match-shape', () => {
    expect([s1.result.session.tokensEarned, s1.result.session.exchangesMade]).toEqual([1, 1]);
    expect(participations(s1)).toEqual([expect.objectContaining({ targetId: TOP })]);
  });

  it('занятие 1 — обмен был, поэтому цикла сопряжения в конце нет', () => {
    expect(s1.end).toMatchObject({ kind: 'end', reason: 'completed', endedOnSuccess: true, pairingCycle: false });
    expect(pairings(s1)).toEqual([]);
  });

  it('занятие 1 — все обмены свободные (доска из жетона за участие): в окно ступени занятие не входит, atStage не меняется', () => {
    expect(s1.result.tokenTraining).toEqual(freshChild().tokenTraining);
  });

  it('занятие 1 — на пробах проверки знака «принято» нет (praiseAttentionBeforeSd false)', () => {
    const baseline = s1.steps.filter((s) => s.trialKind === 'baseline');
    expect(baseline).toHaveLength(5);
    expect(baseline.every((s) => s.praiseAttentionBeforeSd === false)).toBe(true);
  });

  it('занятие 2 — доска на 1; разогрев и отвлекающие — освоенная match-shape; базовая линия match-color-3; обучения нет', () => {
    expect(s2.planned.board).toMatchObject({ size: 1 });
    expect(s2.planned.immediateExchange).toBe(true);
    expect(s2.planned.placementTargetIds).toEqual([]);
    expect(s2.planned.baselineTargetIds).toEqual([COLOR]);
    expect(s2.planned.teachingTargetIds).toEqual([]);
    expect(s2.planned.highPTargetIds).toEqual([TOP]);
  });

  it('занятие 2 — конец блока базовой линии цвета с жетоном за участие', () => {
    expect(plan(s2.planned)).toContain(`END:${COLOR}:true`);
    expect(participations(s2)).toEqual(expect.arrayContaining([expect.objectContaining({ targetId: COLOR })]));
  });

  it('занятие 2 — хотя бы один обмен', () => {
    expect(s2.result.session.exchangesMade).toBeGreaterThanOrEqual(1);
  });

  it('предусловие L0: match-shape освоена проверкой, но её стартовая подсказка осталась выше L0', () => {
    expect(['mastered', 'maintenance']).toContain(s1.child.states[TOP].phase);
    expect(s1.child.states[TOP].startPromptLevel).toBeGreaterThan(0);
  });

  it('разогрев на освоенной проверкой цели начинается с L0 и проходится самостоятельно', () => {
    const highP = s2.steps.flatMap((s, i) => (s.trialKind === 'high_p' ? [[s.startPromptLevel, s2.records[i].trial.response]] : []));
    expect(highP.length).toBeGreaterThan(0);
    expect(highP).toEqual(Array(highP.length).fill([0, 'independent']));
  });

  it('после двух занятий «всё верно» флага token_training_stalled нет', () => {
    expect(s2.result.tokenTraining.flags).not.toContain('token_training_stalled');
  });

  it('при любом seed занятия 2 (20 seed) — ≥ 1 обмен и нет token_training_stalled', () => {
    const outcomes = Array.from({ length: 20 }, (_, i) => runSession(s1.child, allCorrect, 2000 + i)).map((r) => ({
      exchanges: r.result.session.exchangesMade,
      stalled: r.result.tokenTraining.flags.includes('token_training_stalled'),
    }));
    expect(outcomes.filter((o) => o.exchanges < 1 || o.stalled)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Сценарий Б — настоящая ошибка на 2-й пробе первой проверки, освоенных целей нет
// ---------------------------------------------------------------------------

describe('ошибка на 2-й пробе первой проверки сверху вниз, освоенных нет', () => {
  const wrongSecond = (closing: Act): Policy => (s, n) =>
    s.trialKind === 'closing' ? closing : s.trialKind === 'baseline' && s.targetId === TOP && n === 1 ? 'incorrect' : 'correct';

  describe('закрывающая проба удалась', () => {
    const b = runSession(freshChild(), wrongSecond('correct'));
    const err = b.records[1];
    const closing = b.records[2];

    it('предусловие: проверка match-shape, ни высоковероятных, ни обучения', () => {
      expect(b.planned.placementTargetIds).toEqual([TOP]);
      expect([b.planned.highPTargetIds, b.planned.teachingTargetIds]).toEqual([[], []]);
    });

    it('предусловие: 2-я проба — настоящая ошибка (incorrect, образца коснулись), не промах наблюдения', () => {
      expect(err.trial.kind).toBe('baseline');
      expect(err.trial.response).toBe('incorrect');
      expect(err.trial.observingLatencyMs).not.toBeNull();
    });

    it('после ошибки участие не платится сразу, а уходит в долг (participationOwed = match-shape)', () => {
      expect([err.participation, err.exchanged, err.award.tokens]).toEqual([false, 0, 0]);
      expect(err.state.participationOwed).toBe(TOP);
      expect(err.state.tokensEarned).toBe(0);
    });

    it('после ошибки — закрывающая проба на той же цели и том же экземпляре с полной моделью (L3)', () => {
      expect(b.records).toHaveLength(3);
      expect(b.steps[2]).toMatchObject({ trialKind: 'closing', targetId: TOP, exemplarId: err.trial.exemplarId, startPromptLevel: 3 });
    });

    it('успешная закрывающая платит долг участия — жетон заполняет доску на 1 и обменивается сразу', () => {
      expect(SUCCESS.has(closing.trial.response)).toBe(true);
      expect([closing.participation, closing.exchanged]).toEqual([true, 1]);
      expect(closing.state.participationOwed).toBeNull();
      expect(participations(b)).toEqual([expect.objectContaining({ targetId: TOP })]);
      expect([b.result.session.tokensEarned, b.result.session.exchangesMade]).toEqual([1, 1]);
    });

    it('занятие кончается успехом, обмен был — цикла сопряжения нет', () => {
      expect(b.end).toMatchObject({ kind: 'end', reason: 'completed', endedOnSuccess: true, pairingCycle: false });
      expect(pairings(b)).toEqual([]);
    });

    it('проверка не прошла: закрывающая не измерительная и итог проверки не меняет', () => {
      expect(b.result.session.events.filter((e) => e.kind === 'placement')).toEqual([expect.objectContaining({ targetId: TOP, passed: false })]);
    });
  });

  describe('закрывающая проба не удалась', () => {
    const b = runSession(freshChild(), wrongSecond('incorrect'));

    it('предусловие: закрывающая проба была и записана неуспешной', () => {
      const closing = b.records.filter((r) => r.trial.kind === 'closing');
      expect(closing).toHaveLength(1);
      expect(SUCCESS.has(closing[0].trial.response)).toBe(false);
    });

    it('спокойный конец: без жетона, без обмена, без события participation', () => {
      expect([b.result.session.tokensEarned, b.result.session.exchangesMade, b.result.exchanged]).toEqual([0, 0, 0]);
      expect(b.stepParticipation).toBe(false);
      expect(b.records.some((r) => r.participation)).toBe(false);
      expect(participations(b)).toEqual([]);
    });

    it('конец на неудаче — цикла сопряжения нет (доступ сразу за ошибкой не даётся)', () => {
      expect(b.end).toMatchObject({ kind: 'end', reason: 'completed', endedOnSuccess: false, pairingCycle: false });
      expect(pairings(b)).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Блок без выбора: два промаха наблюдения
// ---------------------------------------------------------------------------

describe('блок проверки, закрытый двумя промахами наблюдения', () => {
  it('без единого выбора — жетона за участие нет', () => {
    const r = runSession(freshChild(), (s) => (s.trialKind === 'baseline' ? 'none' : 'correct'));
    const baseline = r.trials.filter((t) => t.kind === 'baseline');
    expect(baseline).toHaveLength(2);
    expect(baseline.every(isObservingMiss)).toBe(true);
    expect(participations(r)).toEqual([]);
    expect(r.result.session.tokensEarned).toBe(0);
  });

  it('без единого выбора — и успешная закрывающая долг не платит: участие без выбора не платится и позже', () => {
    const r = runSession(freshChild(), (s) => (s.trialKind === 'baseline' ? 'none' : 'correct'));
    expect(r.trials.filter((t) => t.kind === 'closing').map((t) => [t.targetId, SUCCESS.has(t.response)])).toEqual([[TOP, true]]);
    expect([r.result.session.tokensEarned, r.result.session.exchangesMade]).toEqual([0, 0]);
  });

  // Закреплено как есть на 2026-11-18, вопрос методисту: занятие без выбора и без обмена кончается успешной
  // закрывающей — и циклом сопряжения (доступ к подкрепителю без жетона).
  it('без единого выбора: конец — успешная закрывающая, 0 обменов, затем цикл сопряжения', () => {
    const r = runSession(freshChild(), (s) => (s.trialKind === 'baseline' ? 'none' : 'correct'));
    expect(r.end).toMatchObject({ reason: 'completed', endedOnSuccess: true, pairingCycle: true, pairingCycleAfterMs: 10_000 });
    expect(pairings(r)).toHaveLength(1);
  });

  it('контроль: был выбор, затем два промаха — жетон за участие есть', () => {
    const r = runSession(freshChild(), (s, n) => (s.trialKind === 'baseline' && n > 0 ? 'none' : 'correct'));
    const baseline = r.trials.filter((t) => t.kind === 'baseline');
    expect(baseline.filter(isObservingMiss)).toHaveLength(2);
    expect(participations(r)).toEqual([expect.objectContaining({ targetId: TOP })]);
  });

  it('контроль: блок кончился промахом — участие в долг и платится успешной закрывающей, а не на промахе', () => {
    const r = runSession(freshChild(), (s, n) => (s.trialKind === 'baseline' && n > 0 ? 'none' : 'correct'));
    const paid = r.records.filter((x) => x.participation);
    expect(paid.map((x) => x.trial.kind)).toEqual(['closing']);
  });
});

// ---------------------------------------------------------------------------
// Свободные обмены и ступень доски
// ---------------------------------------------------------------------------

describe('applyStageSession: свободные обмены', () => {
  const at1 = { ...initialTokenTraining(), pairingDone: true, stage: 1 } as TokenTrainingState;
  const session = (i: number, s: Pick<StageSession, 'exchanges' | 'freeExchanges'>): StageSession => ({ sessionIndex: i, endReason: 'completed', config: 'with_adult', ...s });
  const twoSessions = (s: Pick<StageSession, 'exchanges' | 'freeExchanges'>) => [0, 1].reduce((t, i) => applyStageSession(t, '5-6', session(i, s)), at1);

  it('занятие, где все обмены свободные, в окно ступени не входит — ни роста, ни спуска, ни флага', () => {
    expect(applyStageSession(at1, '5-6', session(0, { exchanges: 2, freeExchanges: 2 }))).toEqual(at1);
    expect(twoSessions({ exchanges: 2, freeExchanges: 2 })).toEqual(at1);
  });

  it('свободное занятие серию не рвёт: два занятия с 0 обменов вокруг него дают флаг token_training_stalled', () => {
    const t = [session(0, { exchanges: 0 }), session(1, { exchanges: 1, freeExchanges: 1 }), session(2, { exchanges: 0 })].reduce(
      (acc, x) => applyStageSession(acc, '5-6', x),
      at1,
    );
    expect(t.atStage.map((x) => x.sessionIndex)).toEqual([0, 2]);
    expect(t.flags).toContain('token_training_stalled');
  });

  it('контроль: обмены за ответы растят ступень', () => {
    expect(twoSessions({ exchanges: 2 }).stage).toBe(2);
  });

  it('свободный обмен сверх двух заработанных рост не отменяет', () => {
    expect(twoSessions({ exchanges: 3, freeExchanges: 1 }).stage).toBe(2);
  });

  it('свободные обмены не засчитываются в рост: 2 обмена, из них 1 свободный, — ступень не растёт', () => {
    expect(twoSessions({ exchanges: 2, freeExchanges: 1 }).stage).toBe(1);
  });
});

// Долг участия посреди занятия (высоковероятная, обучающая; коррекция не платит), обычная базовая линия с неверной
// последней пробой и закрывающая L3 — в abaSession.test.ts, describe «решение методиста 2: долг участия…»: там
// синтетические цели, на которых проверка сверху вниз соседствует с освоенной и обучаемой целью.
