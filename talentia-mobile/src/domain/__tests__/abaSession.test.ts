/**
 * Регрессия оркестратора ABA-сессии по разбору методиста (`ABA.md`, «Разбор оркестратора
 * сессии»): К1–К3, «важно», базовая линия, закрытие, цепочки, `identify`.
 */
import type {
  AbaExemplar,
  AbaPresentation,
  PresentationOutcome,
  AbaResponse,
  AbaTarget,
  AbaTargetState,
  AbaTrial,
  PromptLevel,
} from '../../types/aba';
import {
  chooseReinforcer,
  finishAbaSession,
  finishAccess,
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
  type AbaTrialInput,
  type TrialStep,
} from '../abaSession';
import { correctionLevel, initialTargetState, promptStateOf } from '../abaPrompting';
import { applyBaseline, summarizeSession } from '../abaCriterion';
import { targetErrors } from '../abaTargetRules';
import { initialTokenTraining, type TokenTrainingState } from '../abaTokenTraining';
import type { IdentifySet } from '../abaIdentifySet';

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

/**
 * Журнал предъявлений, который дал бы такой исход: путь эскалации от старта до нужного
 * уровня (как `nextEscalation`: не больше трёх предъявлений, третье — полная модель), на
 * промежуточных — тишина, на первом — неверная попытка, если она была; на последнем — исход.
 */
function logFor(step: TrialStep, h: { response: AbaResponse; used: PromptLevel; emitted: boolean }): AbaPresentation[] {
  const s = Math.min(step.startPromptLevel, 3) as PromptLevel;
  const top = Math.min(h.used, 3) as PromptLevel;
  const path: PromptLevel[] = s === top ? [s] : top - s <= 2 ? Array.from({ length: top - s + 1 }, (_, i) => (s + i) as PromptLevel) : [s, (s + 1) as PromptLevel, top];
  const last: PresentationOutcome =
    h.used === 4
      ? 'l4_done'
      : h.response === 'independent' || h.response === 'prompted'
        ? 'correct'
        : h.response === 'no_response'
          ? 'none'
          : (h.response as PresentationOutcome);
  const t0 = Date.UTC(2026, 8, 29, 10);
  const windowOf = (i: number) => (i === 0 ? (step.promptDelayMs ?? step.responseWindowMs) : step.responseWindowMs);
  return path.map((level, i) => {
    const startedAt = t0 + i * 20_000;
    const endedAt = startedAt + 1000;
    const outcome: PresentationOutcome = i === path.length - 1 ? last : i === 0 && h.emitted ? 'incorrect' : 'none';
    const responded = outcome === 'correct' || outcome === 'incorrect' || outcome === 'approximation';
    return {
      level,
      by: 'app' as const,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      windowMs: windowOf(i),
      outcome,
      ...(responded ? { respondedAt: new Date(endedAt + 1000).toISOString() } : {}),
    };
  });
}

function trialFor(state: AbaSessionState, step: TrialStep, how: How): AbaTrialInput {
  const start = step.startPromptLevel;
  const max = (step.allowEscalation ? Math.max(3, start) : start) as PromptLevel;
  const h =
    how === 'ok'
      ? { response: start === 0 ? 'independent' : 'prompted', used: start, emitted: start === 0 }
      : how === 'wrong'
        ? { response: 'incorrect', used: max, emitted: max === start && start === 0 }
        : how === 'silent_at_model'
          ? { response: 'no_response', used: max, emitted: false }
          : how === 'approx'
            ? { response: 'approximation', used: start, emitted: start === 0 }
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
    ...(step.closes ? { closes: step.closes } : {}),
    index: state.trials.length,
    kind: step.trialKind,
    startPromptLevel: start,
    presentationLog: logFor(step, h as { response: AbaResponse; used: PromptLevel; emitted: boolean }),
    promptDelayMs: step.promptDelayMs,
    responseWindowMs: step.responseWindowMs,
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
    if (next.step.kind === 'access') {
      st = finishAccess(st, clock.now);
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
    // молчал до подсказки, на L1 ответил неверно: в дискретной пробе ошибка закрывает пробу
    const st = answer(afterWarmup(acq(A, 0)), 3, { response: 'incorrect', used: 1, emitted: false }).state;
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
    const st = answer(afterWarmup(acq(A, 2)), 3, { response: 'incorrect', used: 3, emitted: false }).state;
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

  it('два провала подряд — старт до уровня, несущего ответ, а не сразу на полную модель', () => {
    let st = afterWarmup(acq(A, 0));
    st = answer(st, 3, 'wrong').state;
    st = answer(st, 4, 'ok').state; // коррекция
    st = answer(st, 5, 'ok').state; // отвлекающая
    st = answer(st, 6, 'wrong').state; // перенос
    expect(st.states.A.startPromptLevel).toBe(2);
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
    expect(steps[steps.length - 1]).toMatchObject({ kind: 'end', reason: 'breakdown', endedOnSuccess: true, pairingCycle: false });
    expect(closing.closes).toBe('session');
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
    expect(nextStep(s, 2).step).toMatchObject({ kind: 'end', reason: 'adult_stopped', endedOnSuccess: false, pairingCycle: false });
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
          latencyMs: 900, latencyFromFirstSdMs: bad ? 4000 : 900, latencySource: 'adult_press',
          promptDelayMs: 1000, responseWindowMs: 10000, presentationLog: [],
          sdEndedAt: '2026-09-29T10:00:00Z', scoredBy: 'adult', tokens: 0,
        });
      }
    }
    expect(summarizeSession(C, trials)).toMatchObject({ trials: 5, independentRate: 0.6, outcome: 'breaks' });
  });
});

describe('набор identify', () => {
  const [I1, I2, I3] = ['I1', 'I2', 'I3'].map((id) => tgt(id, { format: 'identify', identifyPoolKey: 'animals' }));
  const pool = [I1, I2, I3];
  const acqAll = () => ({ I1: acq(I1), I2: acq(I2), I3: acq(I3) });
  const withSet = (over: Partial<IdentifySet> = {}): IdentifySet[] => [
    { id: 'animals#1', poolKey: 'animals', memberIds: ['I1', 'I2', 'I3'], createdAtSession: 1, lastSetSessionIndex: -1, ...over },
  ];
  const trialSteps = (steps: AbaStep[]) => steps.filter((s): s is TrialStep => s.kind === 'trial');
  const runs = (ids: string[]) => ids.some((id, i) => i >= 2 && id === ids[i - 1] && id === ids[i - 2]);

  it('первая сессия: набор из трёх новых — базовая линия двух по 5 вперемешку, третья — только карточкой', () => {
    const { state, steps } = drive(begin(pool, {}), () => 'ok');
    const trials = trialSteps(steps);
    expect(state.set?.memberIds).toEqual(['I1', 'I2', 'I3']);
    expect(trials.every((t) => t.trialKind === 'baseline')).toBe(true);
    expect(trials).toHaveLength(10);
    expect(trials.some((t) => t.targetId === 'I3')).toBe(false);
    expect(trials.every((t) => t.field!.some((id) => id.startsWith('I3')))).toBe(true);
    expect(runs(trials.map((t) => t.targetId))).toBe(false);
    expect(steps[steps.length - 1]).toMatchObject({ kind: 'end', pairingCycle: true, pairingCycleAfterMs: 10_000 });
  });

  it('на ступенях 1–2 обучения доске — базовая линия одной цели набора', () => {
    const st = begin(pool, {}, { tokenTraining: { ...TRAINED, stage: 2 } });
    expect(st.baselineTargetIds).toEqual(['I1']);
  });

  it('5/5 на базовой линии набора — обучение с L0, а не «освоено»; 4/5 — L1; меньше — L3', () => {
    let n = 0;
    const { state } = drive(begin(pool, {}), (s) => {
      if (s.targetId === 'I1') return 'ok';
      n += 1;
      return n === 1 ? { response: 'incorrect', used: 0, emitted: true } : 'ok';
    });
    const first = finishAbaSession(state, '2026-09-29', 99_000);
    expect(first.states.I1).toMatchObject({ phase: 'acquisition', startPromptLevel: 0 });
    expect(first.states.I2).toMatchObject({ phase: 'acquisition', startPromptLevel: 1 });
    expect(first.states.I3.phase).toBe('baseline');
    expect(first.identifySets[0].lastSetSessionIndex).toBe(10);

    // вторая сессия: базовая линия третьей и обучение первых двух в тех же половинах
    const second = begin(pool, first.states, { identifySets: first.identifySets, sessionIndex: 11 });
    expect([second.baselineTargetIds, second.teachingTargetIds]).toEqual([['I3'], ['I1', 'I2']]);
    const { state: s2 } = drive(second, (s) => (s.targetId === 'I3' ? 'wrong' : 'ok'));
    expect(finishAbaSession(s2, '2026-09-30', 199_000).states.I3).toMatchObject({ phase: 'acquisition', startPromptLevel: 3 });
  });

  it('поддержание освоенного участника — первой его пробой в наборе, без отдельной пробы в конце', () => {
    const states = { I1: mastered(I1, 0), I2: acq(I2), I3: acq(I3) };
    const { steps } = drive(begin(pool, states, { identifySets: withSet() }), () => 'ok');
    const mine = trialSteps(steps).filter((t) => t.targetId === 'I1');
    expect(mine[0].trialKind).toBe('maintenance');
    expect(mine.filter((t) => t.trialKind === 'maintenance')).toHaveLength(1);
    expect(mine.slice(1).every((t) => t.trialKind === 'high_p')).toBe(true);
  });

  it('мост в наборе: проваленная базовая линия в конце половины — не подсказка той же цели', () => {
    const states = { I1: acq(I1), I2: acq(I2) };
    const st = begin(pool, states, { identifySets: withSet() });
    // провалить все пробы базовой линии I3
    const { steps } = drive(st, (s) => (s.trialKind === 'baseline' ? { response: 'incorrect', used: 0, emitted: true } : 'ok'));
    const bridges = trialSteps(steps).filter((t) => t.closes === 'block');
    expect(bridges.every((t) => t.targetId !== 'I3')).toBe(true);
  });

  it('обучение набора: по 5 проб на цель, 8 + 7 вокруг перерыва, поле — карточки набора', () => {
    const { steps } = drive(begin(pool, acqAll(), { identifySets: withSet() }), () => 'ok');
    const k = kinds(steps);
    const brk = k.indexOf('break');
    expect([brk, k.filter((x) => x === 'teaching').length]).toEqual([8, 15]);
    const first = trialSteps(steps)[0];
    expect(first.field).toHaveLength(3);
    expect(new Set(first.field!.map((id) => id.split('-')[0]))).toEqual(new Set(['I1', 'I2', 'I3']));
  });

  it('инструкции вперемешку: не больше двух одной подряд; верная — не больше двух раз на одном месте', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { state } = drive(begin(pool, acqAll(), { identifySets: withSet(), seed }), () => 'ok');
      const teaching = state.trials.filter((t) => t.kind === 'teaching');
      expect(runs(teaching.map((t) => t.targetId))).toBe(false);
      const at = state.trials.filter((t) => t.field).map((t) => String(t.field!.indexOf(t.exemplarId)));
      expect(runs(at)).toBe(false);
    }
  });

  it('«сам»: касание засчитывает телефон', () => {
    const st = begin(pool, acqAll(), { identifySets: withSet(), config: 'alone' });
    expect((nextStep(st, 1).step as TrialStep).scoredBy).toBe('device_tap');
  });

  it('коррекция: отвлекающая — следующая плановая проба другой инструкции, потом перенос', () => {
    const st = begin(pool, acqAll(), { identifySets: withSet() });
    const failed = answer(st, 1, 'wrong');
    const { steps } = drive(failed.state, () => 'ok');
    const [c, d, t] = trialSteps(steps);
    expect([c.trialKind, c.targetId]).toEqual(['correction', failed.step.targetId]);
    expect(d.trialKind).toBe('teaching');
    expect(d.targetId).not.toBe(failed.step.targetId);
    expect([t.trialKind, t.targetId, t.exemplarId]).toEqual(['transfer', failed.step.targetId, failed.step.exemplarId]);
  });

  it('освоенная цель остаётся в поле и получает две высоковероятные пробы', () => {
    const { steps } = drive(
      begin(pool, { I1: mastered(I1), I2: acq(I2), I3: acq(I3) }, { identifySets: withSet() }),
      () => 'ok',
    );
    const block = trialSteps(steps).filter((t) => t.targetId === 'I1' && t.trialKind === 'high_p' && t.field);
    expect(block.length).toBeGreaterThanOrEqual(2);
    expect(trialSteps(steps).every((t) => !t.field || t.field.length === 3)).toBe(true);
  });

  it('набор и обычные цели — сессии чередуются', () => {
    const A = tgt('A');
    const states = { ...acqAll(), A: acq(A, 0, { lastSessionIndex: 9 }) };
    expect(begin([A, ...pool], states, { identifySets: withSet({ lastSetSessionIndex: 8 }) }).set).not.toBeNull();
    expect(begin([A, ...pool], states, { identifySets: withSet({ lastSetSessionIndex: 10 }) }).set).toBeNull();
    expect(begin([A, ...pool], states, { identifySets: withSet({ lastSetSessionIndex: 10 }) }).teachingTargetIds).toEqual(['A']);
  });

  it('цель «покажи…» вне набора не обучается поодиночке', () => {
    const I4 = tgt('I4', { format: 'identify', identifyPoolKey: 'animals', prerequisiteTargetIds: ['X'] });
    const X = tgt('X');
    const st = begin([X, I1, I2, I4], { X: acq(X), I1: acq(I1), I2: acq(I2) });
    expect(st.set).toBeNull();
    expect(st.teachingTargetIds).toEqual(['X']);
  });

  it('пул меньше трёх целей — сессия не начинается', () => {
    expect(() => begin([I1, I2], {})).toThrow(/пул animals/);
  });
});

describe('базовая линия', () => {
  const N = tgt('N');
  const base = (responses: AbaResponse[]) =>
    responses.map((response, i): AbaTrial => ({
      id: `b-${i}`, sessionId: 's', targetId: 'N', exemplarId: i % 2 ? 'N-2' : 'N-1', index: i, kind: 'baseline',
      startPromptLevel: 0, promptLevelUsed: 0, presentations: 1, response,
      emittedBeforePrompt: response !== 'no_response',
      latencyMs: response === 'no_response' ? null : 900,
      latencyFromFirstSdMs: response === 'no_response' ? null : 900,
      latencySource: response === 'no_response' ? null : 'adult_press',
      promptDelayMs: null, responseWindowMs: 5000, presentationLog: [],
      sdEndedAt: '2026-09-29T10:00:00Z', scoredBy: 'adult', tokens: 0,
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
    const res = recordTrial(next.state, { ...input, startPromptLevel: 0, presentationLog: input.presentationLog.map((p) => ({ ...p, level: 0 as PromptLevel })) }, 1);
    expect(res.ok === false && res.errors).toContain('не тот стартовый уровень');
  });

  it('громкость в цели не на громкость — не пишется', () => {
    const st = begin([A], { A: acq(A) });
    const next = nextStep(st, 1);
    const input = trialFor(next.state, next.step as TrialStep, 'ok');
    const res = recordTrial(next.state, { ...input, loudnessDb: 62 }, 1);
    expect(res.ok === false && res.errors).toContain('громкость пишется только в целях на громкость');
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
    ['identify без пула', { format: 'identify' as const }, 'нет пула'],
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

  it('ступень 1: доска из одной ячейки, обмен сразу, доступ — отдельный шаг с фактическим временем', () => {
    const st = begin([A], { A: acq(A) }, { tokenTraining: stage(1) });
    expect(st.board.size).toBe(1);
    const r = answer(st, 1000, 'ok');
    expect(r.res.exchanged).toBe(1);
    expect(r.state.board.earned).toBe(0);
    const access = nextStep(r.state, 2000);
    expect(access.step).toEqual({ kind: 'access', durationMs: 20_000 });
    const after = finishAccess(access.state, 27_000);
    expect(after.pausedMs).toBe(25_000);
    expect(after.events).toContainEqual(expect.objectContaining({ kind: 'access' }));
  });

  it('доступ к подкрепителю не отнимается лимитом времени', () => {
    const st = begin([A], { A: acq(A) }, { tokenTraining: stage(1), timeLimitMs: 1500 });
    const r = answer(st, 1000, 'ok');
    expect(nextStep(r.state, 5000).step.kind).toBe('access');
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

  it('«сам»: высоковероятные без жетона не отменяют цикл сопряжения', () => {
    const V = tgt('V', { format: 'voice_volume' });
    const R = tgt('R', { format: 'repeat_word' });
    const { steps } = drive(begin([V, R], { R: mastered(R) }, { config: 'alone' }), () => 'ok');
    expect(steps[steps.length - 1]).toMatchObject({ kind: 'end', pairingCycle: true });
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

describe('застрявшая цель', () => {
  const [A, B, C] = ['A', 'B', 'C'].map((id) => tgt(id));

  it('пять сессий без снижения уровня и без роста доли — флаг no_progress', () => {
    let states: Record<string, AbaTargetState> = { A: acq(A, 1) };
    for (let i = 0; i < 5; i += 1) {
      const st = begin([A], states, { sessionIndex: 10 + i });
      // одни приближения: доля самостоятельных 0, уровень не двигается
      const { state } = drive(st, () => 'approx');
      states = finishAbaSession(state, `2026-10-0${i + 1}`, 99_000).states;
    }
    expect(states.A.flags).toContain('no_progress');
  });

  it('застрявшая уступает слот следующей по программе', () => {
    const st = begin([A, B, C], { A: acq(A, 1, { flags: ['no_progress'] }), B: acq(B), C: acq(C) });
    expect(st.teachingTargetIds).toEqual(['B', 'C']);
    const alone = begin([A, B], { A: acq(A, 1, { flags: ['no_progress'] }), B: acq(B) });
    expect(alone.teachingTargetIds).toEqual(['B', 'A']);
  });
});

describe('окно ответа и задержка до подсказки (D1)', () => {
  const P = tgt('P', { delayMode: 'progressive' });
  const Q = tgt('Q', { format: 'repeat_word' });
  const trialsOf = (steps: AbaStep[]) => steps.filter((s): s is TrialStep => s.kind === 'trial');

  it('базовая линия ждёт полное окно, а не 1 с прогрессивной задержки', () => {
    const { steps } = drive(begin([P], { P: initialTargetState(P) }), () => 'ok');
    const baseline = trialsOf(steps).filter((s) => s.trialKind === 'baseline');
    expect(baseline.length).toBeGreaterThan(0);
    for (const s of baseline) expect([s.promptDelayMs, s.responseWindowMs]).toEqual([null, 5000]);
  });

  it('на старте L0 в обучении — задержка до подсказки; на L1+ и в разогреве — только окно', () => {
    const { steps } = drive(begin([P, Q], { P: acq(P, 0), Q: acq(Q, 1) }), () => 'ok');
    const teaching = trialsOf(steps).filter((s) => s.trialKind === 'teaching');
    const p0 = teaching.filter((s) => s.targetId === 'P' && s.startPromptLevel === 0);
    const q1 = teaching.filter((s) => s.targetId === 'Q' && s.startPromptLevel === 1);
    expect(p0.length).toBeGreaterThan(0);
    expect(q1.length).toBeGreaterThan(0);
    for (const s of p0) expect([s.promptDelayMs, s.responseWindowMs]).toEqual([1000, 5000]);
    for (const s of q1) expect(s.promptDelayMs).toBeNull();
    for (const s of trialsOf(steps).filter((x) => x.trialKind === 'high_p')) expect(s.promptDelayMs).toBeNull();
  });

  it('разогрев освоенной целью — без задержки до подсказки, с полным окном', () => {
    const M = tgt('M');
    const { steps } = drive(begin([P, M], { P: acq(P, 0), M: mastered(M) }), () => 'ok');
    const highP = trialsOf(steps).filter((s) => s.trialKind === 'high_p');
    expect(highP.length).toBeGreaterThan(0);
    for (const s of highP) expect([s.promptDelayMs, s.responseWindowMs]).toEqual([null, 5000]);
  });

  it('у звена цепочки — окно 10 с или своё', () => {
    const H = tgt('H', {
      format: 'do_action',
      steps: [
        { id: 'h1', order: 1, sdKey: 'a', criterionKey: 'b', modelKey: 'c' },
        { id: 'h2', order: 2, sdKey: 'a', criterionKey: 'b', modelKey: 'c', responseWindowMs: 15000 },
      ],
    });
    const { steps } = drive(begin([H], { H: acq(H, 0) }), () => 'ok');
    const byStep = (id: string) => trialsOf(steps).filter((s) => s.stepId === id);
    expect(byStep('h1').length).toBeGreaterThan(0);
    for (const s of byStep('h1')) expect(s.responseWindowMs).toBe(10000);
    for (const s of byStep('h2')) expect(s.responseWindowMs).toBe(15000);
  });

  it('voice_volume — удержание громкости в шаге пробы', () => {
    const V = tgt('V', { format: 'voice_volume' });
    const { steps } = drive(begin([V], { V: acq(V, 0) }), () => 'ok');
    expect(trialsOf(steps).find((s) => s.targetId === 'V')?.voiceHoldMs).toBe(3000);
  });

  it('полная модель тоже даёт окно на ответ', () => {
    const { steps } = drive(begin([Q], { Q: acq(Q, 3) }), () => 'ok');
    const l3 = trialsOf(steps).filter((s) => s.trialKind === 'teaching' && s.startPromptLevel === 3);
    expect(l3.length).toBeGreaterThan(0);
    for (const s of l3) expect(s.responseWindowMs).toBe(5000);
  });

  it('проба с другим окном или задержкой, чем ждала сессия, не пишется', () => {
    const st = begin([P], { P: acq(P, 0) });
    const next = nextStep(st, 1000);
    if (next.step.kind !== 'trial') throw new Error('ждали пробу');
    const t = trialFor(next.state, next.step, 'ok');
    const wrongWindow = recordTrial(next.state, { ...t, responseWindowMs: 1000 }, 1000);
    const wrongDelay = recordTrial(next.state, { ...t, promptDelayMs: 4000 }, 1000);
    expect([wrongWindow.ok, wrongDelay.ok]).toEqual([false, false]);
  });
});

describe('окно звена цепочки', () => {
  it('окно звена короче потолка задержки — цель не годится', () => {
    const H = tgt('H', {
      format: 'do_action',
      band: '7',
      steps: [{ id: 'h1', order: 1, sdKey: 'a', criterionKey: 'b', modelKey: 'c', responseWindowMs: 3000 }],
    });
    expect(targetErrors(H)).toContain('окно звена h1 короче потолка задержки полосы');
  });
});
