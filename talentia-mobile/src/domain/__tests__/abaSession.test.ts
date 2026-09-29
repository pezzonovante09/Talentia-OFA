/**
 * Регрессия оркестратора ABA-сессии по разбору методиста (`ABA.md`, «Разбор оркестратора
 * сессии»): К1–К3, «важно», базовая линия, закрытие, цепочки, `identify`.
 */
import type {
  AbaExemplar,
  AbaResponse,
  AbaTarget,
  AbaTargetState,
  AbaTrial,
  PromptLevel,
} from '../../types/aba';
import {
  chooseReinforcer,
  finishAbaSession,
  finishBreak,
  nextStep,
  NEUTRAL_PAUSE_MS,
  recordTrial,
  startAbaSession,
  stopSession,
  type AbaSessionState,
  type AbaStep,
  type RecordResult,
  type StartInput,
  type TrialStep,
} from '../abaSession';
import { correctionLevel, initialTargetState, promptStateOf } from '../abaPrompting';
import { applyBaseline, summarizeSession } from '../abaCriterion';
import { targetErrors } from '../abaTargetRules';
import { initialTokenTraining, type TokenTrainingState } from '../abaTokenTraining';

/** Ребёнок, прошедший сопряжение и обучение доске: финальная ступень. */
const TRAINED: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: 5 };

const POOL = ['puzzle', 'bubbles', 'drum', 'stickers', 'train', 'balloon'];

const ex = (id: string, role: AbaExemplar['role'] = 'teaching'): AbaExemplar => ({
  id,
  role,
  targetKey: `k.${id}`,
  modelKey: `m.${id}`,
  partialModelKeys: [],
  image: `img-${id}`,
});

function tgt(id: string, over: Partial<AbaTarget> = {}): AbaTarget {
  return {
    id,
    programId: 'p',
    format: 'imitate_sound',
    band: '7',
    sdKey: `sd.${id}`,
    exemplars: [ex(`${id}-1`), ex(`${id}-2`), ex(`${id}-g1`, 'generalization'), ex(`${id}-g2`, 'generalization')],
    delayMs: 3000,
    delayMode: 'constant',
    blockSize: 5,
    scoredBy: 'adult',
    ...over,
  };
}

const acq = (t: AbaTarget, start: PromptLevel = 0, over: Partial<AbaTargetState> = {}): AbaTargetState => ({
  ...initialTargetState(t),
  phase: 'acquisition',
  startPromptLevel: start,
  lastSuccessfulPromptLevel: start,
  ...over,
});

/** Освоенная цель, поддержание которой не подошло: была на этой же сессии. */
const mastered = (t: AbaTarget, idx = 10, over: Partial<AbaTargetState> = {}): AbaTargetState => ({
  ...initialTargetState(t),
  phase: 'mastered',
  startPromptLevel: 0,
  lastSuccessfulPromptLevel: 0,
  lastMaintenanceSessionIndex: idx,
  ...over,
});

function begin(
  targets: AbaTarget[],
  states: Record<string, AbaTargetState>,
  over: Partial<StartInput> = {},
  by: 'child' | 'adult' = 'child',
) {
  const st = startAbaSession({
    sessionId: 's',
    sessionIndex: 10,
    config: 'with_adult',
    band: '7',
    targets,
    states,
    reinforcerPool: POOL,
    reinforcerHistory: [],
    startedAt: 0,
    seed: 42,
    tokenTraining: TRAINED,
    ...over,
  });
  const first = nextStep(st, 0);
  if (first.step.kind !== 'choose_reinforcer') throw new Error('сессия начинается не с выбора подкрепителя');
  return chooseReinforcer(first.state, first.step.options[0], 0, by);
}

/** Как ответил ребёнок. */
type How = 'ok' | 'wrong' | 'silent_at_model' | 'approx' | { response: AbaResponse; used: PromptLevel; emitted: boolean };

let seq = 0;

function trialFor(state: AbaSessionState, step: TrialStep, how: How): Omit<AbaTrial, 'tokens' | 'tokenReason'> {
  const start = step.startPromptLevel;
  const max = (step.allowEscalation ? Math.max(3, start) : start) as PromptLevel;
  const h =
    how === 'ok'
      ? { response: start === 0 ? 'independent' : 'prompted', used: start, emitted: start === 0 }
      : how === 'wrong'
        ? { response: 'incorrect', used: max, emitted: start < 3 }
        : how === 'silent_at_model'
          ? { response: 'no_response', used: max, emitted: false }
          : how === 'approx'
            ? { response: 'approximation', used: start, emitted: start < 3 }
            : how;
  seq += 1;
  return {
    id: `t-${seq}`,
    sessionId: state.sessionId,
    targetId: step.targetId,
    exemplarId: step.exemplarId,
    ...(step.stepId ? { stepId: step.stepId } : {}),
    ...(step.runIndex !== undefined ? { runIndex: step.runIndex } : {}),
    ...(step.sdVariantKey ? { sdVariantKey: step.sdVariantKey } : {}),
    ...(step.field ? { field: step.field } : {}),
    index: state.trials.length,
    kind: step.trialKind,
    startPromptLevel: start,
    promptLevelUsed: h.used as PromptLevel,
    presentations: h.used > start ? 3 : 1,
    response: h.response as AbaResponse,
    emittedBeforePrompt: h.emitted,
    latencyMs: 1000,
    sdEndedAt: '2026-09-29T10:00:00Z',
    scoredBy: step.scoredBy,
  };
}

/** Ответить на текущую пробу. */
function answer(state: AbaSessionState, now: number, how: How) {
  const next = nextStep(state, now);
  if (next.step.kind !== 'trial') throw new Error(`ждали пробу, а шаг ${next.step.kind}`);
  const res = recordTrial(next.state, trialFor(next.state, next.step, how), now);
  if (!res.ok) throw new Error(res.errors.join('; '));
  return { state: res.state, step: next.step, res: res as Extract<RecordResult, { ok: true }> };
}

/** Прогнать сессию до конца: `policy` решает ответ по шагу, перерывы проходят сразу. */
function drive(state: AbaSessionState, policy: (step: TrialStep) => How, clock = { now: 0 }) {
  let st = state;
  const steps: AbaStep[] = [];
  for (let guard = 0; guard < 200; guard += 1) {
    clock.now += 1000;
    const next = nextStep(st, clock.now);
    st = next.state;
    steps.push(next.step);
    if (next.step.kind === 'end') return { state: st, steps };
    if (next.step.kind === 'break') {
      st = finishBreak(st, clock.now).state;
      continue;
    }
    if (next.step.kind !== 'trial') throw new Error(`неожиданный шаг ${next.step.kind}`);
    const res = recordTrial(st, trialFor(st, next.step, policy(next.step)), clock.now);
    if (!res.ok) throw new Error(res.errors.join('; '));
    st = res.state;
  }
  throw new Error('сессия не кончилась');
}

const kinds = (steps: AbaStep[]) => steps.map((s) => (s.kind === 'trial' ? s.trialKind : s.kind));

// ---------------------------------------------------------------------------

describe('порядок сессии', () => {
  const [M1, M2, A, B, N] = ['M1', 'M2', 'A', 'B', 'N'].map((id) => tgt(id));
  const states = {
    M1: mastered(M1),
    M2: mastered(M2, 0),
    A: acq(A, 0, { recentIndependentRates: [0.7] }),
    B: acq(B),
  };

  it('подкрепитель → разогрев → базовая линия → блок A → перерыв → блок B → перенос и поддержание → конец', () => {
    const { steps } = drive(begin([M1, M2, A, B, N], states), () => 'ok');
    expect(kinds(steps)).toEqual([
      'high_p', 'high_p',
      'baseline', 'high_p', 'baseline', 'high_p', 'baseline',
      'teaching', 'teaching', 'teaching', 'teaching', 'teaching',
      'break',
      'teaching', 'teaching', 'teaching', 'teaching', 'teaching',
      'generalization', 'maintenance',
      'end',
    ]);
  });

  it('цель на поддержании не бывает высоковероятной пробой — ни в разогреве, ни между пробами', () => {
    const { steps } = drive(begin([M1, M2, A, B, N], states), () => 'ok');
    const highP = steps.filter((s): s is TrialStep => s.kind === 'trial' && s.trialKind === 'high_p');
    expect(new Set(highP.map((s) => s.targetId))).toEqual(new Set(['M1']));
  });

  it('перенос — только на экземпляре generalization', () => {
    const { steps } = drive(begin([M1, M2, A, B, N], states), () => 'ok');
    const gen = steps.find((s): s is TrialStep => s.kind === 'trial' && s.trialKind === 'generalization')!;
    expect(gen.exemplarId).toMatch(/^A-g/);
    expect(gen.allowEscalation).toBe(false);
  });
});

describe('К1: уровень пробы коррекции', () => {
  const M = tgt('M');
  const A = tgt('A');

  function afterWarmup(s: AbaTargetState) {
    let st = begin([M, A], { M: mastered(M), A: s });
    st = answer(st, 1, 'ok').state;
    return answer(st, 2, 'ok').state;
  }

  it('никогда не L0, даже если последний успех был самостоятельным', () => {
    const st = answer(afterWarmup(acq(A, 0)), 3, { response: 'no_response', used: 0, emitted: false }).state;
    const step = nextStep(st, 4).step as TrialStep;
    expect([step.trialKind, step.startPromptLevel]).toEqual(['correction', 1]);
  });

  it('после неверного ответа — не ниже первого уровня, несущего ответ, и доводится до верного', () => {
    const st = answer(afterWarmup(acq(A, 0)), 3, { response: 'incorrect', used: 0, emitted: true }).state;
    const step = nextStep(st, 4).step as TrialStep;
    expect([step.trialKind, step.startPromptLevel, step.escalateOnIncorrect]).toEqual(['correction', 2, true]);
  });

  it('не ниже того, что ребёнку только что понадобилось, плюс ступень', () => {
    const st = answer(afterWarmup(acq(A, 0)), 3, { response: 'incorrect', used: 1, emitted: true }).state;
    expect((nextStep(st, 4).step as TrialStep).startPromptLevel).toBe(2);
  });

  it('коррекция → отвлекающая проба освоенной цели → перенос того же экземпляра на стартовом уровне', () => {
    const failed = answer(afterWarmup(acq(A, 0)), 3, 'wrong');
    const { steps } = drive(failed.state, () => 'ok');
    const [c, h, t] = steps.slice(0, 3) as TrialStep[];
    expect([c.trialKind, h.trialKind, h.targetId, t.trialKind]).toEqual(['correction', 'high_p', 'M', 'transfer']);
    expect(t.exemplarId).toBe(failed.step.exemplarId);
    expect(t.startPromptLevel).toBe(0);
  });

  it('не ответил и на полной модели, со взрослым — сразу его помощь (L4), без повтора модели', () => {
    const st = answer(afterWarmup(acq(A, 3)), 3, 'silent_at_model').state;
    const step = nextStep(st, 4).step as TrialStep;
    expect([step.trialKind, step.startPromptLevel, step.askAdultForL4]).toEqual(['correction', 4, true]);
  });

  it('не ответил и на полной модели, без взрослого — шаг коррекции пропускается', () => {
    const V = tgt('V', { format: 'voice_volume' });
    let st = begin([V], { V: acq(V, 3) }, { config: 'alone' });
    st = answer(st, 1, 'silent_at_model').state;
    expect((nextStep(st, 2).step as TrialStep).trialKind).toBe('transfer');
  });

  it('коррекция на полной модели со взрослым — просьба помочь (L4)', () => {
    const st = answer(afterWarmup(acq(A, 2)), 3, { response: 'incorrect', used: 3, emitted: true }).state;
    const step = nextStep(st, 4).step as TrialStep;
    expect([step.trialKind, step.startPromptLevel, step.askAdultForL4]).toEqual(['correction', 3, true]);
  });

  it('освоенных нет — вместо отвлекающей нейтральная пауза перед переносом', () => {
    const st = answer(begin([A], { A: acq(A) }), 1, 'wrong').state;
    const { steps } = drive(st, () => 'ok');
    const [c, t] = steps as TrialStep[];
    expect([c.trialKind, t.trialKind, t.pauseBeforeMs]).toEqual(['correction', 'transfer', NEUTRAL_PAUSE_MS]);
  });

  it('коррекция и её проба жетона не приносят: жетон оплачивал бы ошибку', () => {
    const st = answer(afterWarmup(acq(A, 0)), 3, 'wrong').state;
    expect(answer(st, 4, 'ok').res.award.tokens).toBe(0);
  });

  it('correctionLevel: провал на полной модели с неверным ответом — снова полная модель', () => {
    const s = acq(A, 1);
    const t = { kind: 'teaching', response: 'incorrect', promptLevelUsed: 3 } as AbaTrial;
    expect(correctionLevel(s, t, 'imitate_sound')).toBe(3);
  });

  it('correctionLevel: в identify ответ несёт уже жест (L1)', () => {
    const t = { kind: 'teaching', response: 'incorrect', promptLevelUsed: 0 } as AbaTrial;
    expect(correctionLevel(acq(A, 0), t, 'identify')).toBe(1);
    expect(correctionLevel(acq(A, 0), t, 'repeat_word')).toBe(2);
  });

  it('два провала подряд — старт сразу на полную модель, а не на ступень', () => {
    let st = afterWarmup(acq(A, 0));
    st = answer(st, 3, 'wrong').state;
    st = answer(st, 4, 'ok').state; // коррекция
    st = answer(st, 5, 'ok').state; // отвлекающая
    st = answer(st, 6, 'wrong').state; // перенос
    expect(st.states.A.startPromptLevel).toBe(3);
  });
});

describe('К2: конфигурация «сам»', () => {
  const V = tgt('V', { format: 'voice_volume' });
  const W = tgt('W', { format: 'repeat_word' });
  const D = tgt('D', { format: 'do_action' });
  const M = tgt('M', { format: 'repeat_word' });
  const states = { V: acq(V), W: acq(W), D: acq(D), M: mastered(M) };

  it('обучаются только цели с правом на критерий; do_action не предлагается', () => {
    const st = begin([V, W, D, M], states, { config: 'alone' });
    expect(st.teachingTargetIds).toEqual(['V']);
    expect(st.highPTargetIds).toEqual(['M']);
  });

  it('громкость засчитывает устройство', () => {
    const st = begin([V, W, D, M], states, { config: 'alone' });
    const { steps } = drive(st, () => 'ok');
    const v = steps.find((s): s is TrialStep => s.kind === 'trial' && s.targetId === 'V')!;
    expect(v.scoredBy).toBe('device_loudness');
  });

  it('проба без права на критерий: «Tali послушал», без жетона, состояние цели не меняется', () => {
    const st = begin([V, W, D, M], states, { config: 'alone' });
    const warm = answer(st, 1, 'ok');
    expect(warm.step.scoredBy).toBe('device_onset');
    expect([warm.res.award.feedback, warm.res.award.tokens]).toEqual(['listened', 0]);
    expect(warm.state.states.M).toEqual(st.states.M);
  });
});

describe('К3: жетоны', () => {
  const [M, A, B] = ['M', 'A', 'B'].map((id) => tgt(id, { band: '5-6' }));

  it('5–6: разогрев и участие не заполняют доску без ответа по цели', () => {
    const st = begin([M, A, B], { M: mastered(M), A: acq(A), B: acq(B) }, { band: '5-6' });
    const { state } = drive(st, (s) => (s.trialKind === 'teaching' ? 'approx' : 'ok'));
    expect(state.board).toMatchObject({ size: 3, nonContingent: 2 });
    expect(state.board.earned).toBe(2);
  });

  it('безошибочный старт: верный с полной модели приносит жетон', () => {
    const st = begin([A], { A: acq(A, 3) }, { band: '5-6' });
    expect(answer(st, 1, 'ok').res.award).toMatchObject({ tokens: 1, reason: 'at_start_level' });
  });

  it('понадобилась эскалация — похвала без жетона', () => {
    const st = begin([A], { A: acq(A, 1) }, { band: '5-6' });
    const r = answer(st, 1, { response: 'prompted', used: 3, emitted: false }).res.award;
    expect([r.tokens, r.feedback]).toEqual([0, 'praise']);
  });
});

describe('остановка и закрытие', () => {
  const [M, A, B] = ['M', 'A', 'B'].map((id) => tgt(id));

  function toBreakdown() {
    const st = begin([M, A, B], { M: mastered(M), A: acq(A, 3), B: acq(B) });
    return drive(st, (s) => (s.targetId === 'A' && s.trialKind !== 'closing' ? 'silent_at_model' : 'ok'));
  }

  it('три провала на полной модели — закрывает полная модель той цели с просьбой к взрослому', () => {
    const { steps } = toBreakdown();
    const closing = steps.find((s): s is TrialStep => s.kind === 'trial' && s.trialKind === 'closing')!;
    expect([closing.targetId, closing.startPromptLevel, closing.askAdultForL4]).toEqual(['A', 3, true]);
    expect(steps[steps.length - 1]).toEqual({ kind: 'end', reason: 'breakdown', endedOnSuccess: true, pairingCycle: false });
  });

  it('жетон за участие начатого блока — после успешной закрывающей пробы', () => {
    const { state } = toBreakdown();
    expect(state.events.filter((e) => e.kind === 'participation').map((e) => e.kind === 'participation' && e.targetId)).toEqual(['A']);
  });

  it('остановка рвёт серию только своей цели и видна в итоге', () => {
    const { state } = toBreakdown();
    const result = finishAbaSession(state, '2026-09-29', 99_000);
    expect(result.session).toMatchObject({ brokenTargetId: 'A', endReason: 'breakdown', endedOnSuccess: true });
  });

  it('закрывающая проба — kind closing: не в процент и не в остановку', () => {
    const { state } = toBreakdown();
    const summary = summarizeSession(A, state.trials);
    expect(state.trials.some((t) => t.kind === 'closing')).toBe(true);
    expect(summary.trials).toBe(state.trials.filter((t) => t.targetId === 'A' && t.kind === 'teaching').length);
  });

  it('две закрывающие не удались — спокойный конец, без участия, специалисту видно', () => {
    const st = begin([A], { A: acq(A) }, { timeLimitMs: 2500 });
    let s = answer(st, 1000, 'ok').state;
    s = answer(s, 2000, 'wrong').state;
    const { state, steps } = drive(s, () => 'wrong', { now: 2000 });
    expect(kinds(steps)).toEqual(['closing', 'closing', 'end']);
    const result = finishAbaSession(state, '2026-09-29', 9000);
    expect(result.session).toMatchObject({ endReason: 'time_limit', endedOnSuccess: false });
    expect(state.events.some((e) => e.kind === 'participation')).toBe(false);
  });

  it('остановка взрослым: ни закрывающей, ни участия, ни обмена даже при полной доске', () => {
    const st = begin([A], { A: acq(A) }, { board: { earned: 5, nonContingent: 0 } });
    const s = stopSession(answer(st, 1, 'wrong').state, 'adult_stopped');
    expect(nextStep(s, 2).step).toEqual({ kind: 'end', reason: 'adult_stopped', endedOnSuccess: false, pairingCycle: false });
    const result = finishAbaSession(s, '2026-09-29', 3);
    expect([result.exchanged, result.board.earned]).toEqual([0, 5]);
  });

  it('блок не кончается провалом: перед концом блока — успешная закрывающая, потом участие и перерыв', () => {
    const [M, B] = [tgt('M'), tgt('B')];
    let teachingA = 0;
    const { steps, state } = drive(begin([M, A, B], { M: mastered(M), A: acq(A), B: acq(B) }), (s) => {
      if (s.targetId === 'A' && s.trialKind === 'teaching') teachingA += 1;
      return s.targetId === 'A' && ((s.trialKind === 'teaching' && teachingA === 5) || s.trialKind === 'transfer')
        ? 'wrong'
        : 'ok';
    });
    const k = kinds(steps);
    const brk = k.indexOf('break');
    expect(k.slice(brk - 4, brk + 1)).toEqual(['correction', 'high_p', 'transfer', 'closing', 'break']);
    const partAt = state.events.findIndex((e) => e.kind === 'participation');
    expect(partAt).toBeGreaterThanOrEqual(0);
  });

  it('по лимиту жетон за участие экран получает флагом, а не молча', () => {
    let st = begin([A], { A: acq(A) }, { timeLimitMs: 2500 });
    st = answer(st, 1000, 'ok').state;
    const next = nextStep(st, 3000);
    expect(next.step.kind).toBe('end');
    expect(next.participation).toBe(true);
  });

  it('по плану полная доска в конце обменивается', () => {
    const { state } = drive(begin([A], { A: acq(A) }, { board: { earned: 4, nonContingent: 0 } }), () => 'ok');
    const result = finishAbaSession(state, '2026-09-29', 99_000);
    expect(result.exchanged).toBeGreaterThanOrEqual(5);
    expect(result.session.events.some((e) => e.kind === 'exchange')).toBe(true);
  });
});

describe('выбор подкрепителя', () => {
  it('кто выбрал — пишется: выбор взрослого не данные о предпочтениях', () => {
    const A = tgt('A');
    const st = stopSession(begin([A], { A: acq(A) }, {}, 'adult'), 'abandoned');
    expect(finishAbaSession(st, '2026-09-29', 1).session.reinforcerChosenBy).toBe('adult');
  });
});

describe('время и доска', () => {
  const [A, B] = ['A', 'B'].map((id) => tgt(id));

  it('перерыв в рабочее время не идёт', () => {
    let st = begin([A, B], { A: acq(A), B: acq(B) }, { timeLimitMs: 8000 });
    for (let i = 1; i <= 5; i += 1) st = answer(st, i * 1000, 'ok').state;
    const brk = nextStep(st, 5000);
    expect(brk.step.kind).toBe('break');
    st = finishBreak(brk.state, 60_000).state;
    const next = nextStep(st, 61_000).step as TrialStep;
    expect([next.kind, next.targetId]).toEqual(['trial', 'B']);
    expect(st.events.map((e) => e.kind)).toEqual(['participation', 'break', 'exchange']);
  });

  it('лимит взрослый может уменьшить, но не увеличить', () => {
    expect(begin([A], { A: acq(A) }, { timeLimitMs: 60 * 60_000 }).timeLimitMs).toBe(15 * 60_000);
  });

  it('доска берёт размер по текущей полосе, жетоны сохраняются', () => {
    const st = begin([A], { A: acq(A) }, { board: { earned: 2, nonContingent: 1 } });
    expect(st.board).toEqual({ size: 5, earned: 2, nonContingent: 1 });
  });
});

describe('перенос и поддержание в конце', () => {
  it('перенос достаётся цели, у которой он был давнее всех', () => {
    const [A, B] = ['A', 'B'].map((id) => tgt(id));
    const st = begin([A, B], {
      A: acq(A, 0, { recentIndependentRates: [0.7], lastGeneralizationSessionIndex: 5 }),
      B: acq(B, 0, { recentIndependentRates: [0.7] }),
    });
    const gen = st.queue.find((q) => q.kind === 'trial' && q.trial.kind === 'generalization');
    expect(gen?.kind === 'trial' && gen.trial.targetId).toBe('B');
  });

  it('перепроверка после провала поддержания — раньше самых просроченных', () => {
    const [M2, M3, M4] = ['M2', 'M3', 'M4'].map((id) => tgt(id));
    const st = begin(
      [M2, M3, M4],
      {
        M2: mastered(M2, 19, { maintenanceFailsInRow: 1, phase: 'maintenance' }),
        M3: mastered(M3, 0),
        M4: mastered(M4, 1),
      },
      { sessionIndex: 20 },
    );
    expect(st.maintenanceTargetIds).toEqual(['M2', 'M3']);
    expect(st.highPTargetIds).toEqual(['M4']);
  });
});

describe('цепочки', () => {
  const C = tgt('C', {
    format: 'do_action',
    steps: [
      { id: 's1', order: 1, sdKey: 'a', criterionKey: 'a', modelKey: 'a' },
      { id: 's2', order: 2, sdKey: 'b', criterionKey: 'b', modelKey: 'b' },
    ],
  });

  it('блок — три прогона, звенья по порядку, с номером прогона и просьбой к взрослому после модели', () => {
    const { steps } = drive(begin([C], { C: acq(C, 2) }), () => 'ok');
    const trials = steps.filter((s): s is TrialStep => s.kind === 'trial');
    expect(trials.map((t) => `${t.runIndex}:${t.stepId}`)).toEqual(['0:s1', '0:s2', '1:s1', '1:s2', '2:s1', '2:s2']);
    expect(trials.every((t) => t.askAdultForL4)).toBe(true);
  });

  it('провал звена — без коррекции: следующим идёт следующее звено', () => {
    let st = begin([C], { C: acq(C, 2) });
    st = answer(st, 1, 'ok').state;
    st = answer(st, 2, 'wrong').state;
    const next = nextStep(st, 3).step as TrialStep;
    expect([next.trialKind, next.stepId, next.runIndex]).toEqual(['teaching', 's1', 1]);
  });

  it('затухание у каждого звена своё', () => {
    const { state } = drive(begin([C], { C: acq(C, 2) }), (s) =>
      s.stepId === 's2' ? { response: 'prompted', used: 3, emitted: false } : 'ok',
    );
    expect(promptStateOf(state.states.C, 's1').startPromptLevel).toBe(1);
    expect(promptStateOf(state.states.C, 's2').startPromptLevel).toBe(3);
  });

  it('базовая линия цепочки — два прогона, старт у каждого звена свой', () => {
    const { state } = drive(begin([C], {}), (s) =>
      s.stepId === 's2' && s.runIndex === 1 ? { response: 'no_response', used: 0, emitted: false } : 'ok',
    );
    const result = finishAbaSession(state, '2026-09-29', 99_000);
    expect(promptStateOf(result.states.C, 's1').startPromptLevel).toBe(0);
    expect(promptStateOf(result.states.C, 's2').startPromptLevel).toBe(1);
    expect(result.states.C.phase).toBe('acquisition');
  });

  it('поддержание цепочки — прогоном; распалось — каждое звено к своему последнему успеху', () => {
    const st = begin([C], { C: mastered(C, 0, { phase: 'maintenance', maintenanceFailsInRow: 1 }) });
    const { state, steps } = drive(st, (s) =>
      s.stepId === 's2' ? { response: 'prompted', used: 2, emitted: false } : 'ok',
    );
    const probe = steps.filter((s): s is TrialStep => s.kind === 'trial' && s.trialKind === 'maintenance');
    expect(probe.map((s) => s.stepId)).toEqual(['s1', 's2']);
    const result = finishAbaSession(state, '2026-09-29', 99_000);
    expect(result.states.C.phase).toBe('acquisition');
    expect(promptStateOf(result.states.C, 's1').startPromptLevel).toBe(0);
    expect(promptStateOf(result.states.C, 's2').startPromptLevel).toBe(2);
    expect(result.session.events).toContainEqual(expect.objectContaining({ kind: 'phase', reason: 'maintenance_failed' }));
  });

  it('освоенная цепочка не бывает высоковероятной пробой', () => {
    const A = tgt('A');
    expect(begin([C, A], { C: mastered(C), A: acq(A) }).highPTargetIds).toEqual([]);
  });

  it('критерий цепочки — по прогонам целиком: 80% на каждом звене ещё не зачёт', () => {
    // 5 прогонов: s1 срывается в прогоне 0, s2 — в прогоне 1; по звеньям 4/5, целиком 3/5
    const trials: AbaTrial[] = [];
    for (let run = 0; run < 5; run += 1) {
      for (const step of ['s1', 's2']) {
        const bad = (step === 's1' && run === 0) || (step === 's2' && run === 1);
        trials.push({
          id: `c-${run}-${step}`, sessionId: 's', targetId: 'C', exemplarId: 'C-1', stepId: step, runIndex: run,
          index: trials.length, kind: 'teaching', startPromptLevel: 0, promptLevelUsed: bad ? 1 : 0,
          presentations: 1, response: bad ? 'prompted' : 'independent', emittedBeforePrompt: !bad,
          latencyMs: 900, sdEndedAt: '2026-09-29T10:00:00Z', scoredBy: 'adult', tokens: 0,
        });
      }
    }
    expect(summarizeSession(C, trials)).toMatchObject({ trials: 5, independentRate: 0.6, outcome: 'breaks' });
  });
});

describe('identify', () => {
  const I = tgt('I', {
    format: 'identify',
    fieldSize: 3,
    distractors: ['d1', 'd2', 'd3'].map((id) => ({ id, labelKey: `k.${id}`, image: `img-${id}` })),
  });

  it('«сам»: касание засчитывает устройство, поле — верная карточка и дистракторы', () => {
    const st = begin([I], { I: acq(I) }, { config: 'alone' });
    const step = nextStep(st, 1).step as TrialStep;
    expect(step.scoredBy).toBe('device_tap');
    expect(step.field).toHaveLength(3);
    expect(step.field).toContain(step.exemplarId);
  });

  it('верная карточка не бывает три раза подряд на одном месте', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { state } = drive(begin([I], { I: acq(I) }, { config: 'alone', seed }), () => 'ok');
      const at = state.trials.filter((t) => t.field).map((t) => t.field!.indexOf(t.exemplarId));
      expect(at.some((p, i) => i >= 2 && p === at[i - 1] && p === at[i - 2])).toBe(false);
    }
  });

  it('проба с чужим полем не пишется', () => {
    const st = begin([I], { I: acq(I) }, { config: 'alone' });
    const next = nextStep(st, 1);
    const input = trialFor(next.state, next.step as TrialStep, 'ok');
    const res = recordTrial(next.state, { ...input, field: [...input.field!].reverse() }, 1);
    expect(res.ok).toBe(false);
  });
});

describe('базовая линия', () => {
  const N = tgt('N');
  const base = (responses: AbaResponse[]) =>
    responses.map((response, i): AbaTrial => ({
      id: `b-${i}`, sessionId: 's', targetId: 'N', exemplarId: i % 2 ? 'N-2' : 'N-1', index: i, kind: 'baseline',
      startPromptLevel: 0, promptLevelUsed: 0, presentations: 1, response,
      emittedBeforePrompt: response !== 'no_response', latencyMs: 900, sdEndedAt: '2026-09-29T10:00:00Z',
      scoredBy: 'adult', tokens: 0,
    }));

  it('новая цель начинает с базовой линии', () => {
    expect(initialTargetState(N).phase).toBe('baseline');
  });

  it('3/3 — сразу в поддержание', () => {
    const s = applyBaseline(initialTargetState(N), base(['independent', 'independent', 'independent']), 4, N);
    expect([s.phase, s.masteredBy]).toEqual(['mastered', 'baseline']);
  });

  it('1–2 из 3 — обучение со старта L1', () => {
    expect(applyBaseline(initialTargetState(N), base(['independent', 'incorrect', 'no_response']), 4, N)).toMatchObject({
      phase: 'acquisition',
      startPromptLevel: 1,
    });
  });

  it('0 из 3 — обучение с полной модели', () => {
    expect(applyBaseline(initialTargetState(N), base(['incorrect', 'no_response', 'incorrect']), 4, N)).toMatchObject({
      phase: 'acquisition',
      startPromptLevel: 3,
    });
  });

  it('меньше трёх проб — базовая линия повторяется', () => {
    expect(applyBaseline(initialTargetState(N), base(['independent']), 4, N).phase).toBe('baseline');
  });

  it('в сессии: без подсказки, без жетонов за ответ, без участия; внимание хвалят до инструкции', () => {
    const st = begin([N], {});
    const r = answer(st, 1, { response: 'incorrect', used: 0, emitted: true });
    expect([r.step.trialKind, r.step.allowEscalation, r.step.praiseAttentionBeforeSd]).toEqual(['baseline', false, true]);
    expect([r.res.award.feedback, r.res.award.tokens]).toEqual(['neutral', 0]);
    const { state } = drive(r.state, () => 'ok');
    expect(state.events.some((e) => e.kind === 'participation')).toBe(false);
    expect(state.queue).toEqual([]);
    const result = finishAbaSession(state, '2026-09-29', 10_000);
    expect(result.states.N).toMatchObject({ phase: 'acquisition', startPromptLevel: 1 });
    expect(result.session.events).toContainEqual(
      expect.objectContaining({ kind: 'phase', targetId: 'N', from: 'baseline', to: 'acquisition', reason: 'baseline' }),
    );
  });

  it('5–6: базовая линия занимает слоты обучения', () => {
    const [A5, B5, N5] = ['A', 'B', 'N'].map((id) => tgt(id, { band: '5-6' }));
    const st = begin([A5, B5, N5], { A: acq(A5), B: acq(B5) }, { band: '5-6' });
    expect(st.baselineTargetIds).toEqual([]);
    const one = begin([A5, N5], { A: acq(A5) }, { band: '5-6' });
    expect(one.baselineTargetIds).toEqual(['N']);
  });
});

describe('проверка записи', () => {
  const A = tgt('A');

  it('не тот стартовый уровень — не пишется', () => {
    const st = begin([A], { A: acq(A, 1) });
    const next = nextStep(st, 1);
    const input = trialFor(next.state, next.step as TrialStep, 'ok');
    const res = recordTrial(next.state, { ...input, startPromptLevel: 0, promptLevelUsed: 0, response: 'independent', emittedBeforePrompt: true }, 1);
    expect(res.ok === false && res.errors).toContain('не тот стартовый уровень');
  });

  it('L4 без просьбы к взрослому — не пишется', () => {
    const st = begin([A], { A: acq(A, 1) });
    const next = nextStep(st, 1);
    const input = trialFor(next.state, next.step as TrialStep, { response: 'prompted', used: 4, emitted: false });
    const res = recordTrial(next.state, input, 1);
    expect(res.ok === false && res.errors).toContain('L4 без просьбы к взрослому');
  });
});

describe('правила на цель', () => {
  it('годная цель проходит', () => {
    expect(targetErrors(tgt('A'))).toEqual([]);
  });

  it.each([
    ['обратное сцепление', { chaining: 'backward' as const }, 'обратное сцепление'],
    ['блок 10 на 5–6', { band: '5-6' as const, blockSize: 10 as const, delayMs: 3000 }, 'блок 10'],
    ['одна пара для переноса', { exemplars: [ex('x-1'), ex('x-2'), ex('x-g', 'generalization')] }, 'меньше двух пар'],
    ['экземпляры отличаются только id', { exemplars: [ex('x-1'), { ...ex('x-1'), id: 'x-9' }, ex('x-g1', 'generalization'), ex('x-g2', 'generalization')] }, 'только id'],
    ['identify без дистракторов', { format: 'identify' as const }, 'дистракторов'],
  ])('%s — ошибка', (_, over, message) => {
    expect(targetErrors(tgt('A', over)).join('; ')).toContain(message);
  });

  it('сессия с негодной целью не начинается', () => {
    expect(() => begin([tgt('A', { chaining: 'backward' })], {})).toThrow(/обратное сцепление/);
  });
});

describe('обучение доске в сессии', () => {
  const [M, A, N] = ['M', 'A', 'N'].map((id) => tgt(id));
  const stage = (st: TokenTrainingState['stage'], over: Partial<TokenTrainingState> = {}): TokenTrainingState => ({
    ...initialTokenTraining(),
    pairingDone: true,
    stage: st,
    ...over,
  });

  it('без сопряжения рабочая сессия не начинается', () => {
    expect(() => begin([A], { A: acq(A) }, { tokenTraining: initialTokenTraining() })).toThrow(/Сопряжение/);
  });

  it('ступень 1: доска из одной ячейки, обмен сразу, доступ не в рабочее время', () => {
    const st = begin([A], { A: acq(A) }, { tokenTraining: stage(1) });
    expect(st.board.size).toBe(1);
    const r = answer(st, 1, 'ok');
    expect(r.res.exchanged).toBe(1);
    expect(r.state.board.earned).toBe(0);
    expect(r.state.pausedMs).toBe(20_000);
  });

  it('ступень 1: разогрев жетона не даёт — нет места для жетонов не за результат', () => {
    const st = begin([M, A], { M: mastered(M), A: acq(A) }, { tokenTraining: stage(1) });
    expect(answer(st, 1, 'ok').res.award.tokens).toBe(0);
  });

  it('на финальной ступени обмен — как прежде, на перерыве', () => {
    const st = begin([A], { A: acq(A) });
    expect(answer(st, 1, 'ok').res.exchanged).toBe(0);
  });

  it('ступени 1–2: на базовой линии не больше одной цели', () => {
    const N2 = tgt('N2');
    expect(begin([N, N2], {}, { tokenTraining: stage(2) }).baselineTargetIds).toEqual(['N']);
    expect(begin([N, N2], {}, { tokenTraining: stage(3) }).baselineTargetIds).toEqual(['N', 'N2']);
  });

  it('сессия из одной базовой линии кончается циклом сопряжения', () => {
    const { state, steps } = drive(begin([N], {}), () => 'ok');
    expect(steps[steps.length - 1]).toMatchObject({ kind: 'end', pairingCycle: true });
    expect(finishAbaSession(state, '2026-09-29', 99_000).session.events).toContainEqual(
      expect.objectContaining({ kind: 'pairing' }),
    );
  });

  it('две сессии подряд с двумя обменами — ступень растёт, событие в итоге', () => {
    const tt = stage(1, { atStage: [{ sessionIndex: 9, exchanges: 3, endReason: 'completed' }] });
    const { state } = drive(begin([A], { A: acq(A) }, { tokenTraining: tt }), () => 'ok');
    const result = finishAbaSession(state, '2026-09-29', 99_000);
    expect(result.tokenTraining.stage).toBe(2);
    expect(result.session.events).toContainEqual(expect.objectContaining({ kind: 'board_stage', from: 1, to: 2 }));
    expect(result.session.boardSize).toBe(1);
  });
});
