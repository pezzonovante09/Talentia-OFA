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
  reviewAssentConcern,
  stopSession,
  takeBreakCard,
  withdrawAssent,
  type AbaSessionState,
  type AbaStep,
  type RecordResult,
  type StartInput,
  type AbaTrialInput,
  type TrialStep,
  finishChainByAdult,
} from '../abaSession';
import { correctionLevel, initialTargetState, promptStateOf } from '../abaPrompting';
import { applyBaseline, summarizeSession } from '../abaCriterion';
import { targetErrors } from '../abaTargetRules';
import { EXCHANGE_ACCESS_MS, initialTokenTraining, type TokenTrainingState } from '../abaTokenTraining';
import type { IdentifySet } from '../abaIdentifySet';
import { GRID_FOR, finishSession } from './abaFixtures';

/** Ребёнок, прошедший сопряжение и обучение доске: финальная ступень. */
const TRAINED: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: 5 };

const POOL = ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'];

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
    ...GRID_FOR[over.format ?? 'imitate_sound'],
    ...over,
  };
}

/**
 * Формат открыт для «сам» (решение №60): цель того же формата освоена со взрослым по критерию и
 * ждёт пробы поддержания — поэтому в разогрев не идёт и порядок проб сценария не сдвигает.
 */
function unlocking(format: AbaTarget['format'], over: Partial<AbaTarget> = {}): [AbaTarget, AbaTargetState] {
  const t = tgt(`U-${format}`, { format, ...over });
  return [t, mastered(t, 5, { masteredBy: 'criterion', masteredConfig: 'with_adult' })];
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
    reinforcerApart: [],
    sessionId: 's',
    sessionIndex: 10,
    // локальный день сессии (В5); тесты с несколькими днями задают его в `over`
    day: '2026-09-29',
    config: 'with_adult',
    band: '7',
    targets,
    states,
    reinforcerPool: POOL,
    reinforcerHistory: [],
    startedAt: 0,
    seed: 42,
    tokenTraining: TRAINED,
    // большинство сценариев — со взрослым, которому L4 разрешена; по умолчанию в приложении — нет
    physicalPromptAllowed: true,
    // сессию ведёт обученный специалист центра: освоение подтверждено
    observers: [{ id: 'obs-spec', role: 'specialist', trained: true }],
    primaryObserverId: 'obs-spec',
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
    ...(step.sampleCardId ? { sampleCardId: step.sampleCardId } : {}),
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
    if (next.step.kind === 'adult_finish_chain') {
      st = finishChainByAdult(st);
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
      // полная доска на перерыве по расписанию — обмен, затем доступ (№169)
      'break', 'access',
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
  const A = tgt('A', { format: 'do_action' }) // стандартная лестница: инструкция словами;

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

  it('не ответил и на полной модели, со взрослым — сразу его помощь (L4): одна полная модель', () => {
    const st = answer(afterWarmup(acq(A, 3)), 3, 'silent_at_model').state;
    const step = nextStep(st, 4).step as TrialStep;
    expect([step.trialKind, step.startPromptLevel, step.askAdultForL4]).toEqual(['correction', 4, true]);
  });

  it('физическая подсказка по умолчанию запрещена: ни коррекции с L4, ни просьбы к взрослому', () => {
    let st = begin([M, A], { M: mastered(M), A: acq(A, 3) }, { physicalPromptAllowed: undefined });
    st = answer(answer(st, 1, 'ok').state, 2, 'ok').state;
    const failed = answer(st, 3, 'silent_at_model');
    expect(failed.step.askAdultForL4).toBe(false);
    const next = nextStep(failed.state, 4).step as TrialStep;
    expect(next.trialKind).not.toBe('correction');
  });

  it('сопротивление физическому ведению выключает L4 до конца сессии', () => {
    const st = answer(afterWarmup(acq(A, 3)), 3, 'silent_at_model').state;
    const next = nextStep(st, 4);
    const step = next.step as TrialStep;
    expect([step.trialKind, step.startPromptLevel]).toEqual(['correction', 4]);
    const input = trialFor(next.state, step, 'silent_at_model');
    const resisted = recordTrial(next.state, { ...input, presentationLog: [{ ...input.presentationLog[0], outcome: 'l4_resisted' }] }, 4);
    if (!resisted.ok) throw new Error(resisted.errors.join('; '));
    expect([resisted.trial.response, resisted.trial.interruptedBy, resisted.trial.promptLevelUsed]).toEqual(['interrupted', 'l4_resisted', 3]);
    expect(resisted.state.l4Stopped).toBe(true);
    const { steps } = drive(resisted.state, () => 'ok');
    for (const s of steps) if (s.kind === 'trial') expect(s.askAdultForL4).toBe(false);
  });

  it('не ответил и на полной модели, без взрослого — шаг коррекции пропускается', () => {
    const V = tgt('V', { format: 'voice_volume' });
    const [U, u] = unlocking('voice_volume');
    let st = begin([V, U], { V: acq(V, 3), [U.id]: u }, { config: 'alone' });
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
    expect(correctionLevel(s, t, { format: 'voice_volume', sdKind: 'instruction' })).toBe(3);
  });

  it('correctionLevel: в identify ответ несёт уже жест (L1)', () => {
    const t = { kind: 'teaching', response: 'incorrect', promptLevelUsed: 0 } as AbaTrial;
    expect(correctionLevel(acq(A, 0), t, { format: 'identify' })).toBe(1);
    expect(correctionLevel(acq(A, 0), t, { format: 'voice_volume' })).toBe(2);
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
  const [U, u] = unlocking('voice_volume');
  const states = { V: acq(V), W: acq(W), D: acq(D), M: mastered(M), [U.id]: u };

  it('обучаются только цели с правом на критерий; do_action не предлагается', () => {
    const st = begin([V, W, D, M, U], states, { config: 'alone' });
    expect(st.teachingTargetIds).toEqual(['V']);
    expect(st.highPTargetIds).toEqual(['M']);
  });

  it('громкость засчитывает устройство', () => {
    const st = begin([V, W, D, M, U], states, { config: 'alone' });
    const { steps } = drive(st, () => 'ok');
    const v = steps.find((s): s is TrialStep => s.kind === 'trial' && s.targetId === 'V')!;
    expect(v.scoredBy).toBe('device_loudness');
  });

  it('проба без права на критерий: «Tali послушал», без жетона, состояние цели не меняется', () => {
    const st = begin([V, W, D, M, U], states, { config: 'alone' });
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
    const result = finishSession(state, 99_000);
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
    const result = finishSession(state, 9000);
    expect(result.session).toMatchObject({ endReason: 'time_limit', endedOnSuccess: false });
    expect(state.events.some((e) => e.kind === 'participation')).toBe(false);
  });

  it('остановка взрослым: ни закрывающей, ни участия, ни обмена даже при полной доске', () => {
    const st = begin([A], { A: acq(A) }, { board: { earned: 5, nonContingent: 0 } });
    const s = stopSession(answer(st, 1, 'wrong').state, 'adult_stopped');
    expect(nextStep(s, 2).step).toMatchObject({ kind: 'end', reason: 'adult_stopped', endedOnSuccess: false, pairingCycle: false });
    const result = finishSession(s, 3);
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
    const result = finishSession(state, 99_000);
    expect(result.exchanged).toBeGreaterThanOrEqual(5);
    expect(result.session.events.some((e) => e.kind === 'exchange')).toBe(true);
  });
});

describe('выбор подкрепителя', () => {
  it('кто выбрал — пишется: выбор взрослого не данные о предпочтениях', () => {
    const A = tgt('A');
    const st = stopSession(begin([A], { A: acq(A) }, {}, 'adult'), 'abandoned');
    expect(finishSession(st, 1).session.reinforcerChosenBy).toBe('adult');
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
    // обмен на перерыве даёт доступ (№169); доступ в рабочее время не идёт, как и перерыв
    const access = nextStep(st, 60_000);
    expect(access.step).toEqual({ kind: 'access', durationMs: EXCHANGE_ACCESS_MS[st.board.size] });
    st = finishAccess(access.state, 100_000);
    const next = nextStep(st, 101_000).step as TrialStep;
    expect([next.kind, next.targetId]).toEqual(['trial', 'B']);
    expect(st.events.map((e) => e.kind)).toEqual(['participation', 'break', 'exchange', 'access']);
  });

  it('лимит взрослый может уменьшить, но не увеличить', () => {
    expect(begin([A], { A: acq(A) }, { timeLimitMs: 60 * 60_000 }).timeLimitMs).toBe(15 * 60_000);
  });

  it('доска — 3 ячейки на любой полосе (здесь 7, сохранённая ступень 5 работает как 3), жетоны сохраняются', () => {
    const st = begin([A], { A: acq(A) }, { board: { earned: 2, nonContingent: 1 } });
    expect(st.board).toEqual({ size: 3, earned: 2, nonContingent: 1 });
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
    const result = finishSession(state, 99_000);
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
    const result = finishSession(state, 99_000);
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
    const first = finishSession(state, 99_000);
    expect(first.states.I1).toMatchObject({ phase: 'acquisition', startPromptLevel: 0 });
    expect(first.states.I2).toMatchObject({ phase: 'acquisition', startPromptLevel: 1 });
    // третья цель сессией не затронута (проб нет) — в итоге её нет: commitAbaSession сливает по ключам
    expect(first.states.I3).toBeUndefined();
    expect(first.identifySets[0].lastSetSessionIndex).toBe(10);

    // вторая сессия: базовая линия третьей и обучение первых двух в тех же половинах
    const second = begin(pool, first.states, { identifySets: first.identifySets, sessionIndex: 11, day: '2026-09-30' });
    expect([second.baselineTargetIds, second.teachingTargetIds]).toEqual([['I3'], ['I1', 'I2']]);
    const { state: s2 } = drive(second, (s) => (s.targetId === 'I3' ? 'wrong' : 'ok'));
    expect(finishSession(s2, 199_000).states.I3).toMatchObject({ phase: 'acquisition', startPromptLevel: 3 });
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
    const [U, u] = unlocking('identify', { identifyPoolKey: 'animals' });
    const st = begin([...pool, U], { ...acqAll(), [U.id]: u }, { identifySets: withSet(), config: 'alone' });
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
    const result = finishSession(state, 10_000);
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
    // вторая — из другой области и с другой формой ответа (телом, а не голосом)
    const N2 = tgt('N2', { format: 'do_action' });
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
    expect(finishSession(state, 99_000).session.events).toContainEqual(
      expect.objectContaining({ kind: 'pairing' }),
    );
  });

  it('две сессии подряд с двумя обменами — ступень растёт, событие в итоге', () => {
    const tt = stage(1, { atStage: [{ sessionIndex: 9, exchanges: 3, endReason: 'completed' }] });
    const { state } = drive(begin([A], { A: acq(A) }, { tokenTraining: tt }), () => 'ok');
    const result = finishSession(state, 99_000);
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
      const st = begin([A], states, { sessionIndex: 10 + i, day: `2026-10-0${i + 1}` });
      // одни приближения: доля самостоятельных 0, уровень не двигается
      const { state } = drive(st, () => 'approx');
      states = finishSession(state, 99_000).states;
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

describe('согласие ребёнка — assent (блок 4)', () => {
  const A = tgt('A');
  const M = tgt('M');

  /** Ответить на текущую пробу исходом журнала, который закрывает пробу без ответа. */
  function interrupt(state: AbaSessionState, now: number, outcome: 'child_break' | 'refusal') {
    const next = nextStep(state, now);
    if (next.step.kind !== 'trial') throw new Error(`ждали пробу, а шаг ${next.step.kind}`);
    const input = trialFor(next.state, next.step, 'ok');
    const [first] = input.presentationLog;
    const { respondedAt: _drop, ...rest } = first;
    const res = recordTrial(next.state, { ...input, presentationLog: [{ ...rest, outcome }] }, now);
    if (!res.ok) throw new Error(res.errors.join('; '));
    return { state: res.state, step: next.step, res };
  }
  /** Дойти до первой обучающей пробы цели A. */
  function toTeaching(st: AbaSessionState) {
    let s = st;
    for (let i = 0; i < 10; i += 1) {
      const n = nextStep(s, i);
      if (n.step.kind === 'trial' && n.step.trialKind === 'teaching' && n.step.targetId === 'A') return n.state;
      if (n.step.kind === 'break') s = finishBreak(n.state, i).state;
      else s = answer(s, i, 'ok').state;
    }
    throw new Error('обучающая проба A не наступила');
  }

  it('карточка «перерыв»: проба снята, перерыв по карточке, высоковероятная, та же проба снова', () => {
    const st = toTeaching(begin([M, A], { M: mastered(M), A: acq(A, 0) }));
    const broke = interrupt(st, 100, 'child_break');
    expect([broke.res.trial.response, broke.res.trial.interruptedBy]).toEqual(['interrupted', 'child_break']);
    const brk = nextStep(broke.state, 101);
    expect(brk.step).toMatchObject({ kind: 'break', initiatedBy: 'child_card', maxMs: 90_000 });
    const after = finishBreak(brk.state, 102).state;
    expect(after.events.find((e) => e.kind === 'break')).toMatchObject({ initiatedBy: 'child_card' });
    const hp = answer(after, 103, 'ok');
    expect(hp.step.trialKind).toBe('high_p');
    const again = answer(hp.state, 104, 'ok');
    expect([again.step.targetId, again.step.exemplarId]).toEqual([broke.step.targetId, broke.step.exemplarId]);
    expect(again.res.trial.requeuedFromTrialId).toBe(broke.res.trial.id);
    expect(again.state.events.filter((e) => e.kind === 'assent').map((e) => (e.kind === 'assent' ? e.action : ''))).toEqual(['break']);
  });

  it('перерыв в первой же пробе после возврата — конец сессии по отказу, без закрывающей; в учебной сессии без сопряжения (№170)', () => {
    const st = toTeaching(begin([M, A], { M: mastered(M), A: acq(A, 0) }));
    const broke = interrupt(st, 100, 'child_break');
    const after = finishBreak(nextStep(broke.state, 101).state, 102).state;
    const ended = interrupt(after, 103, 'child_break');
    expect(ended.state.endReason).toBe('assent_withdrawn');
    const end = nextStep(ended.state, 104).step;
    expect(end).toMatchObject({ kind: 'end', reason: 'assent_withdrawn', endedOnSuccess: false, pairingCycle: false });
  });

  it('второй «Отказ» от взрослого кончает сессию; первый — перерыв', () => {
    const st = toTeaching(begin([M, A], { M: mastered(M), A: acq(A, 0) }));
    const first = interrupt(st, 100, 'refusal');
    expect([first.res.trial.interruptedBy, first.state.endReason]).toEqual(['assent', null]);
    expect(nextStep(first.state, 101).step).toMatchObject({ kind: 'break', initiatedBy: 'adult' });
    let s = finishBreak(nextStep(first.state, 101).state, 102).state;
    s = interrupt(s, 103, 'refusal').state;
    expect(s.endReason).toBe('assent_withdrawn');
  });

  it('отказ не отнимает заработанное: полная доска обменивается в конце', () => {
    const st = toTeaching(begin([M, A], { M: mastered(M), A: acq(A, 0) }, { board: { earned: 5, nonContingent: 0 }, day: '2026-10-01' }));
    const ended = withdrawAssent(st, 200, 'adult_observed', { targetId: 'A' });
    const r = finishSession(ended, 300);
    expect(r.exchanged).toBeGreaterThan(0);
    expect(r.session.endReason).toBe('assent_withdrawn');
  });

  it('отказ до начала работы — событие not_started', () => {
    const st = startAbaSession({
    reinforcerApart: [],
      sessionId: 's', sessionIndex: 1, day: '2026-10-01', config: 'with_adult', band: '7', targets: [A], states: { A: acq(A) },
      reinforcerPool: POOL, reinforcerHistory: [], startedAt: 0, seed: 1, tokenTraining: TRAINED,
    });
    const ended = withdrawAssent(st, 10, 'child_card');
    expect(ended.events.at(-1)).toMatchObject({ kind: 'assent', action: 'not_started' });
  });

  it('сессия, кончившаяся по отказу, серию критерия не продлевает', () => {
    let st = begin([A], { A: acq(A, 0, { sessionsAtCriterion: 1 }) }, { day: '2026-10-01' });
    for (let i = 0; i < 6; i += 1) {
      const n = nextStep(st, i);
      if (n.step.kind !== 'trial') break;
      st = answer(st, i, 'ok').state;
    }
    const ended = withdrawAssent(st, 50, 'adult_observed', { targetId: 'A' });
    expect(finishSession(ended, 60).states.A.sessionsAtCriterion).toBe(1);
  });

  it('два прерывания на пробах цели во второй сессии подряд — флаг assent_concern', () => {
    const st = toTeaching(begin([M, A], { M: mastered(M), A: acq(A, 0, { assentSessionsInRow: 1 }) }, { day: '2026-10-01' }));
    let s = finishBreak(nextStep(interrupt(st, 100, 'child_break').state, 101).state, 102).state;
    s = answer(s, 103, 'ok').state; // высоковероятная
    s = interrupt(s, 104, 'refusal').state; // повтор A снят отказом — второе прерывание на A
    const r = finishSession(withdrawAssent(s, 200, 'adult_observed'), 300);
    expect(r.states.A.flags).toContain('assent_concern');
    expect(r.states.A.assentSessionsInRow).toBe(2);
  });

  it('конец по отказу вне пробы цели ей не приписывается, а спокойная сессия обнуляет счётчик', () => {
    const st = toTeaching(begin([M, A], { M: mastered(M), A: acq(A, 0, { assentSessionsInRow: 1 }) }, { day: '2026-10-01' }));
    const s = answer(st, 100, 'ok').state;
    const r = finishSession(withdrawAssent(s, 200, 'adult_observed', { targetId: 'A' }), 300);
    expect(r.states.A.flags).not.toContain('assent_concern');
    expect(r.states.A.assentSessionsInRow).toBe(0);
  });

  it('флаг снимает только взрослый отметкой «цель пересмотрена»', () => {
    const flagged = { ...acq(A), flags: ['assent_concern' as const], assentSessionsInRow: 3 };
    const reviewed = reviewAssentConcern(flagged, 'specialist', '2026-10-01T10:00:00Z');
    expect([reviewed.flags, reviewed.assentSessionsInRow, reviewed.assentConcernReviewed?.role]).toEqual([[], 0, 'specialist']);
  });

  it('отказ: карточка подсвечена 10 с, просьба принимается всю тихую паузу 30 с — полный перерыв без счёта карточек (№170)', () => {
    const st = toTeaching(begin([M, A], { M: mastered(M), A: acq(A, 0) }));
    const refused = interrupt(st, 100, 'refusal').state;
    const pause = nextStep(refused, 101);
    expect(pause.step).toMatchObject({ kind: 'break', initiatedBy: 'adult', maxMs: 30_000, offerCardMs: 10_000 });
    const taken = takeBreakCard(pause.state, 105);
    expect(nextStep(taken, 106).step).toMatchObject({ kind: 'break', maxMs: 90_000 });
    expect(nextStep(taken, 106).step).not.toHaveProperty('offerCardMs');
    expect(taken.childBreaks).toBe(0);
    // после подсветки просьба карточкой не теряется: тот же полный перерыв
    expect(nextStep(takeBreakCard(pause.state, 101 + 20_000), 101 + 20_001).step).toMatchObject({ kind: 'break', maxMs: 90_000 });
    const done = finishBreak(taken, 200).state;
    expect(done.events.find((e) => e.kind === 'break')).toMatchObject({ initiatedBy: 'adult', cardTaken: true });
  });

  it('защитное окно: карточка на высоковероятной перед повтором кончает сессию', () => {
    const st = toTeaching(begin([M, A], { M: mastered(M), A: acq(A, 0) }));
    const back = finishBreak(nextStep(interrupt(st, 100, 'refusal').state, 101).state, 102).state;
    expect(interrupt(back, 103, 'child_break').state.endReason).toBe('assent_withdrawn');
  });

  it('«Сам»: активность без засчитанной реакции три раза — цель снята, не отказ и не срыв; без целей — техническая причина', () => {
    const V = tgt('V', { format: 'voice_volume', scoredBy: 'device_loudness' });
    // открывающая цель освоена недавно: поддержание не к сроку, она — разогрев в начале сессии
    const U = tgt('U-voice', { format: 'voice_volume', scoredBy: 'device_loudness' });
    const u = mastered(U, 10, { masteredBy: 'criterion', masteredConfig: 'with_adult' });
    const run = (st: AbaSessionState) => {
      for (let i = 0; i < 20 && st.unreliableTargetIds.length === 0; i += 1) {
        const next = nextStep(st, i + 1);
        if (next.step.kind !== 'trial') throw new Error('ждали пробу');
        const onV = next.step.targetId === 'V';
        const input = trialFor(next.state, next.step, onV ? 'silent_at_model' : 'ok');
        const log = onV ? input.presentationLog.map((p) => ({ ...p, activity: true })) : input.presentationLog;
        const res = recordTrial(next.state, { ...input, presentationLog: log }, i + 1);
        if (!res.ok) throw new Error(res.errors.join('; '));
        expect(res.suggestBreak).toBe(false);
        st = res.state;
      }
      return st;
    };
    const alone = run(begin([V, U], { V: acq(V, 0), [U.id]: u }, { config: 'alone' }));
    expect(alone.unreliableTargetIds).toEqual(['V']);
    expect(alone.endReason).toBe('unreliable_measurement');
    expect(alone.events.at(-1)).toMatchObject({ kind: 'measurement', targetId: 'V', action: 'unreliable' });
    // осталась другая цель — сессия идёт дальше, снятая цель не «срывается»
    const [W, w] = unlocking('voice_volume', { scoredBy: 'device_loudness' });
    const withOther = run(begin([V, W], { V: acq(V, 0), [W.id]: w }, { config: 'alone' }));
    expect(withOther.unreliableTargetIds).toEqual(['V']);
    expect(withOther.endReason).toBeNull();
  });

  it('«Сам»: две пробы без активности — предложить перерыв, третья — конец сессии', () => {
    const V = tgt('V', { format: 'voice_volume', scoredBy: 'device_loudness' });
    const [U, u] = unlocking('voice_volume', { scoredBy: 'device_loudness' });
    let st = begin([V, U], { V: acq(V, 0), [U.id]: u }, { config: 'alone' });
    const results: boolean[] = [];
    for (let i = 0; i < 3; i += 1) {
      const r = answer(st, i + 1, 'silent_at_model');
      results.push(r.res.suggestBreak);
      st = r.state;
    }
    expect(results).toEqual([false, true, false]);
    expect(st.endReason).toBe('assent_withdrawn');
    expect(st.events.at(-1)).toMatchObject({ kind: 'assent', by: 'device_inactivity', action: 'end' });
  });
});

describe('assent: правки по проверке методиста', () => {
  const A = tgt('A');
  const M = tgt('M');
  function interrupt(state: AbaSessionState, now: number, outcome: 'child_break' | 'refusal') {
    const next = nextStep(state, now);
    if (next.step.kind !== 'trial') throw new Error(`ждали пробу, а шаг ${next.step.kind}`);
    const input = trialFor(next.state, next.step, 'ok');
    const { respondedAt: _drop, ...rest } = input.presentationLog[0];
    const res = recordTrial(next.state, { ...input, presentationLog: [{ ...rest, outcome }] }, now);
    if (!res.ok) throw new Error(res.errors.join('; '));
    return res;
  }
  const passBreak = (st: AbaSessionState, now: number) => finishBreak(nextStep(st, now).state, now + 1).state;

  it('без высоковероятной — перед повтором снятой пробы нейтральная пауза', () => {
    const st = begin([A], { A: acq(A, 0) });
    const broke = interrupt(st, 1, 'refusal');
    const after = passBreak(broke.state, 2);
    const again = nextStep(after, 4).step as TrialStep;
    expect([again.trialKind, again.pauseBeforeMs]).toEqual(['teaching', NEUTRAL_PAUSE_MS]);
  });

  it('повтор снят снова, потом предъявлен — сессия не нейтральна', () => {
    let st = begin([M, A], { M: mastered(M), A: acq(A, 0) });
    // до первой обучающей A
    for (let i = 0; i < 10; i += 1) {
      const n = nextStep(st, i);
      if (n.step.kind === 'trial' && n.step.trialKind === 'teaching') break;
      st = answer(st, i, 'ok').state;
    }
    st = passBreak(interrupt(st, 20, 'child_break').state, 21);
    st = answer(st, 23, 'ok').state; // высоковероятная
    st = passBreak(interrupt(st, 24, 'refusal').state, 25); // повтор снят «Отказом»
    st = answer(st, 27, 'ok').state; // высоковероятная
    const again = answer(st, 28, 'ok');
    expect(again.res.trial.requeuedFromTrialId).toBeDefined();
    const ended = withdrawAssent(again.state, 40, 'adult_observed');
    // сессия кончилась отказом — нейтральна; но снятых непредъявленных проб нет
    const trials = ended.trials.filter((t) => t.targetId === 'A');
    const presented = new Set(trials.map((t) => t.requeuedFromTrialId));
    const dropped = trials.filter((t) => t.response === 'interrupted');
    expect(dropped.length).toBe(2);
    expect(dropped.some((t) => presented.has(t.id))).toBe(true);
  });

  it('старт 4 без просьбы к взрослому понижается до полной модели', () => {
    const st = begin([M, A], { M: mastered(M), A: acq(A, 3) }, { physicalPromptAllowed: false });
    const s1 = answer(answer(st, 1, 'ok').state, 2, 'ok').state;
    const failed = answer(s1, 3, 'silent_at_model');
    const next = nextStep(failed.state, 4).step as TrialStep;
    expect(next.startPromptLevel).not.toBe(4);
  });

  it('«Сам»: после конца по тишине — сразу конец, без закрывающей пробы', () => {
    const V = tgt('V', { format: 'voice_volume', scoredBy: 'device_loudness' });
    const [U, u] = unlocking('voice_volume', { scoredBy: 'device_loudness' });
    let st = begin([V, U], { V: acq(V, 0), [U.id]: u }, { config: 'alone' });
    for (let i = 0; i < 3; i += 1) st = answer(st, i + 1, 'silent_at_model').state;
    expect(st.queue.some((q) => q.kind === 'trial')).toBe(false);
    // конец по бездействию устройства — ребёнка, скорее всего, нет рядом: без цикла сопряжения (№169)
    expect(nextStep(st, 10).step).toMatchObject({ kind: 'end', reason: 'assent_withdrawn', pairingCycle: false });
  });
});

describe('проверочная проба «получается дома» (блок 5)', () => {
  const A = tgt('A', { format: 'do_action' }) // стандартная лестница: инструкция словами;
  const H = tgt('H', { format: 'do_action' });
  const home = (t: AbaTarget) => ({ ...mastered(t), masteredBy: 'home_unverified' as const });
  const verificationOf = (steps: AbaStep[]) => steps.filter((x): x is TrialStep => x.kind === 'trial' && x.trialKind === 'verification');

  it('ведёт обученный — 5 проб без подсказок; 80% и выше — освоено по критерию', () => {
    const { state, steps } = drive(begin([A, H], { A: acq(A, 0), H: home(H) }, { day: '2026-10-01' }), () => 'ok');
    const v = verificationOf(steps);
    expect(v).toHaveLength(5);
    for (const x of v) expect([x.startPromptLevel, x.allowEscalation, x.targetId]).toEqual([0, false, 'H']);
    const r = finishSession(state, 9e6);
    expect(r.states.H.masteredBy).toBe('criterion');
    expect(r.session.events).toContainEqual(expect.objectContaining({ kind: 'phase', targetId: 'H', reason: 'verification_passed' }));
  });

  it('0 из 5 — обратно в обучение с уровня, несущего ответ, и следующим сессиям нужна проверка IOA', () => {
    const { state } = drive(begin([A, H], { A: acq(A, 0), H: home(H) }, { day: '2026-10-01' }), (s) => (s.trialKind === 'verification' ? 'wrong' : 'ok'));
    const r = finishSession(state, 9e6);
    expect([r.states.H.phase, r.states.H.masteredBy, r.states.H.startPromptLevel, r.states.H.ioaDueSessions]).toEqual([
      'acquisition',
      undefined,
      2,
      2,
    ]);
  });

  it('3 из 5 — обратно в обучение с последнего успешного уровня', () => {
    let n = 0;
    const { state } = drive(begin([A, H], { A: acq(A, 0), H: home(H) }, { day: '2026-10-01' }), (s) =>
      s.trialKind === 'verification' ? (n++ < 3 ? 'ok' : 'wrong') : 'ok',
    );
    const r = finishSession(state, 9e6);
    expect([r.states.H.phase, r.states.H.startPromptLevel]).toEqual(['acquisition', 0]);
  });

  it('пройденная проверка засчитана как проба поддержания', () => {
    const { state } = drive(begin([A, H], { A: acq(A, 0), H: home(H) }, { day: '2026-10-01' }), () => 'ok');
    const r = finishSession(state, 9e6);
    expect([r.states.H.lastMaintenanceSessionIndex, r.states.H.maintenanceGapIndex]).toEqual([10, 1]);
  });

  it('непроверенные навыки не идут в разогрев, когда есть проверенные', () => {
    const M = tgt('M');
    const { steps } = drive(begin([A, H, M], { A: acq(A, 0), H: home(H), M: mastered(M) }), () => 'ok');
    const warm = steps.filter((x): x is TrialStep => x.kind === 'trial' && x.trialKind === 'high_p');
    expect(warm.length).toBeGreaterThan(0);
    for (const x of warm) expect(x.targetId).toBe('M');
  });

  it('цепочка: один полный прогон за сессию; решают два, провал возвращает только проваленные звенья', () => {
    const C = tgt('C', {
      format: 'do_action',
      steps: [
        { id: 'c1', order: 1, sdKey: 'a', criterionKey: 'b', modelKey: 'c' },
        { id: 'c2', order: 2, sdKey: 'a', criterionKey: 'b', modelKey: 'c' },
      ],
    });
    const first = drive(begin([A, C], { A: acq(A, 0), C: home(C) }, { day: '2026-10-01' }), () => 'ok');
    const v = first.steps.filter((x): x is TrialStep => x.kind === 'trial' && x.trialKind === 'verification');
    expect(v.map((x) => x.stepId)).toEqual(['c1', 'c2']);
    const r1 = finishSession(first.state, 9e6);
    expect([r1.states.C.masteredBy, r1.states.C.chainVerificationRuns?.length]).toEqual(['home_unverified', 1]);
    const second = drive(begin([A, C], { A: acq(A, 0), C: r1.states.C }, { sessionIndex: 11, day: '2026-10-02' }), (s) =>
      s.trialKind === 'verification' && s.stepId === 'c2' ? 'wrong' : 'ok',
    );
    const r2 = finishSession(second.state, 9e6);
    expect(r2.states.C.phase).toBe('acquisition');
    expect([r2.states.C.stepPrompts?.c1.startPromptLevel, r2.states.C.stepPrompts?.c2.startPromptLevel]).toEqual([0, 2]);
  });

  it('ведёт необученный взрослый — проверочной пробы нет', () => {
    const st = begin([A, H], { A: acq(A, 0), H: home(H) }, { observers: [{ id: 'p', role: 'parent', trained: false }], primaryObserverId: 'p' });
    expect(verificationOf(drive(st, () => 'ok').steps)).toHaveLength(0);
  });
});

describe('итоговая проверка методиста: защитное окно', () => {
  const A = tgt('A');
  const M = tgt('M');
  function interrupt(state: AbaSessionState, now: number, outcome: 'child_break' | 'refusal') {
    const next = nextStep(state, now);
    if (next.step.kind !== 'trial') throw new Error(`ждали пробу, а шаг ${next.step.kind}`);
    const input = trialFor(next.state, next.step, 'ok');
    const { respondedAt: _drop, ...rest } = input.presentationLog[0];
    const res = recordTrial(next.state, { ...input, presentationLog: [{ ...rest, outcome }] }, now);
    if (!res.ok) throw new Error(res.errors.join('; '));
    return res;
  }

  it('отказ в защитном окне после карточки — тоже конец сессии', () => {
    let st = begin([M, A], { M: mastered(M), A: acq(A, 0) });
    for (let i = 0; i < 10; i += 1) {
      const n = nextStep(st, i);
      if (n.step.kind === 'trial' && n.step.trialKind === 'teaching') break;
      st = answer(st, i, 'ok').state;
    }
    const back = finishBreak(nextStep(interrupt(st, 20, 'child_break').state, 21).state, 22).state;
    expect(interrupt(back, 23, 'refusal').state.endReason).toBe('assent_withdrawn');
  });
});

describe('ненадёжное измерение нейтрально в любой фазе', () => {
  it('цель на базовой линии в «Сам» с активностью без реакции — базовая линия не засчитана', () => {
    const V = tgt('V', { format: 'voice_volume', scoredBy: 'device_loudness' });
    const [U, u] = unlocking('voice_volume', { scoredBy: 'device_loudness' });
    let st = begin([V, U], { V: initialTargetState(V), [U.id]: u }, { config: 'alone', day: '2026-10-01' });
    for (let i = 0; i < 3; i += 1) {
      const next = nextStep(st, i + 1);
      if (next.step.kind !== 'trial') break;
      const input = trialFor(next.state, next.step, 'silent_at_model');
      const res = recordTrial(next.state, { ...input, presentationLog: input.presentationLog.map((p) => ({ ...p, activity: true })) }, i + 1);
      if (!res.ok) throw new Error(res.errors.join('; '));
      st = res.state;
    }
    expect(st.unreliableTargetIds).toEqual(['V']);
    // у открывающей цели осталась проба поддержания — доводим сессию до конца
    const r = finishSession(drive(st, () => 'ok').state, 9e6);
    expect(r.states.V.phase).toBe('baseline');
  });
});

describe('Р3: рутина вне сессии — общий план', () => {
  const R = tgt('R', {
    level: 'cross',
    area: 'self_care',
    format: 'do_action',
    sdKind: 'instruction',
    chaining: 'total_task',
    steps: [
      { id: 'r1', order: 1, sdKey: 'a', criterionKey: 'b', modelKey: 'c', image: 'wash-1' },
      { id: 'r2', order: 2, sdKey: 'a', criterionKey: 'b', modelKey: 'c', image: 'wash-2' },
    ],
    exemplars: [ex('R-1')],
  });
  const A = tgt('A');
  const M = tgt('M');
  const inPlan = (st: AbaSessionState) => [
    ...st.baselineTargetIds,
    ...st.placementTargetIds,
    ...st.teachingTargetIds,
    ...st.maintenanceTargetIds,
    ...st.highPTargetIds,
  ];
  const routineTrials = (steps: AbaStep[]) => steps.filter((x) => x.kind === 'trial' && x.targetId === 'R');

  // каждое состояние рутины, которое в прежней сессии давало бы ей слот
  const slots: [string, () => AbaTargetState][] = [
    ['обучение', () => acq(R)],
    ['базовая линия', () => initialTargetState(R)],
    // поддержание просрочено и по сессиям, и по дням
    ['поддержание', () => mastered(R, 0, { masteredBy: 'criterion', lastMaintenanceDay: '2026-09-01' })],
    ['проверка «получается дома»', () => mastered(R, 10, { masteredBy: 'home_unverified' })],
    ['перенос', () => acq(R, 0, { recentIndependentRates: [0.9, 1] })],
    ['разогрев', () => mastered(R, 10, { masteredBy: 'criterion', lastMaintenanceDay: '2026-09-29' })],
  ];

  it.each(slots)('%s: рутины нет ни в плане сессии, ни в её пробах', (_, stateOf) => {
    const st = begin([R, A, M], { R: stateOf(), A: acq(A, 0, { recentIndependentRates: [0.9, 1] }), M: mastered(M) });
    expect(inPlan(st)).not.toContain('R');
    expect(routineTrials(drive(st, () => 'ok').steps)).toEqual([]);
  });

  it.each(slots)('%s: в итоге сессии рутины нет вовсе — её меняет только прогон', (_, stateOf) => {
    const { state } = drive(begin([R, A, M], { R: stateOf(), A: acq(A), M: mastered(M) }), () => 'ok');
    const { states } = finishSession(state, 9e6);
    expect(Object.keys(states).sort()).toEqual(['A', 'M']);
  });

  it('предпосылка на освоенную рутину открывает обычную цель', () => {
    const P = tgt('P', { prerequisiteTargetIds: ['R'] });
    const open = begin([R, P], { R: mastered(R, 10, { masteredBy: 'criterion', lastMaintenanceDay: '2026-09-29' }), P: acq(P) });
    expect(open.teachingTargetIds).toEqual(['P']);
  });

  it('предпосылка на неосвоенную рутину цель не открывает', () => {
    const P = tgt('P', { prerequisiteTargetIds: ['R'] });
    expect(begin([R, P, A], { R: acq(R), P: acq(P), A: acq(A) }).teachingTargetIds).toEqual(['A']);
  });
});

describe('ABA v1: автоподбор и параметры специалиста в сессии', () => {
  const A = tgt('A');
  const B = tgt('B', { prerequisiteTargetIds: ['A'], includesTargetIds: ['A'] });
  const C = tgt('C', { prerequisiteTargetIds: ['B'], includesTargetIds: ['B'] });

  it('автоподбор: на свежей лестнице базовая линия — у верхней цели; без него — у нижней', () => {
    expect(begin([A, B, C], {}, { autoPlacement: true }).baselineTargetIds).toEqual(['C']);
    expect(begin([A, B, C], {}).baselineTargetIds).toEqual(['A']);
  });

  it('верхняя прошла — освоена, предпосылки выведены и ждут поддержания', () => {
    const { state } = drive(begin([A, B, C], {}, { autoPlacement: true, day: '2026-10-02' }), () => 'ok');
    const r = finishSession(state, 99_000);
    expect([r.states.C.phase, r.states.C.masteredBy]).toEqual(['mastered', 'baseline']);
    expect([r.states.A.masteredBy, r.states.B.masteredBy]).toEqual(['inferred', 'inferred']);
  });

  it('проверки сверху вниз и новые цели делят один бюджет: не больше двух, разных областей и форм ответа', () => {
    const E1 = tgt('E1');
    const E2 = tgt('E2', { prerequisiteTargetIds: ['E1'] });
    const V1 = tgt('V1', { format: 'voice_volume' });
    const V2 = tgt('V2', { format: 'voice_volume', prerequisiteTargetIds: ['V1'] });
    const D1 = tgt('D1', { format: 'do_action' });
    const D2 = tgt('D2', { format: 'do_action', prerequisiteTargetIds: ['D1'] });
    const all = [E1, E2, V1, V2, D1, D2];
    const st = begin(all, {}, { autoPlacement: true });
    // эхоика и голос — одна форма ответа: из них одна
    expect(st.placementTargetIds).toEqual(['E2', 'D2']);
    // на ступенях 1–2 обучения доске — одна
    expect(begin(all, {}, { autoPlacement: true, tokenTraining: { ...TRAINED, stage: 2 } }).placementTargetIds).toHaveLength(1);
  });

  it('цель с неосвоенной предпосылкой из другой области — не проба сверху вниз: после ошибки базовая линия идёт дальше', () => {
    const Y = tgt('Y', { format: 'do_action' });
    const X = tgt('X', { prerequisiteTargetIds: ['Y'] });
    const st = begin([Y, X], {}, { autoPlacement: true });
    expect(st.placementTargetIds).toEqual([]);
    const first = st.baselineTargetIds[0];
    let wrongOnce = false;
    const { steps } = drive(st, (x) => {
      if (x.trialKind === 'baseline' && x.targetId === first && !wrongOnce) {
        wrongOnce = true;
        return 'wrong';
      }
      return 'ok';
    });
    const ofFirst = steps.filter((x): x is TrialStep => x.kind === 'trial' && x.trialKind === 'baseline' && x.targetId === first);
    expect(ofFirst.length).toBeGreaterThan(1);
  });

  it('полоса параметров специалиста меняет полосу сессии и целей; неверные параметры сессию не начинают', () => {
    const st = begin([A], { A: acq(A) }, { params: { paramsBand: '5-6' } });
    expect([st.band, st.targets.A.band]).toEqual(['5-6', '5-6']);
    expect(() => begin([A], { A: acq(A) }, { params: { timeLimitMs: 60_000 } })).toThrow('вне 3–');
  });

  it('одна обучаемая цель, если так задал специалист', () => {
    const D = tgt('D', { format: 'voice_volume' });
    expect(begin([A, D], { A: acq(A), D: acq(D) }).teachingTargetIds).toHaveLength(2);
    expect(begin([A, D], { A: acq(A), D: acq(D) }, { params: { maxTeachingTargets: 1 } }).teachingTargetIds).toHaveLength(1);
  });

  it('удлинённое окно ответа специалиста приходит в шаг пробы', () => {
    const st = begin([A], { A: acq(A) }, { params: { responseWindowMs: { imitate_sound: 9000 } } });
    const { steps } = drive(st, () => 'ok');
    const a = steps.find((x): x is TrialStep => x.kind === 'trial' && x.targetId === 'A')!;
    expect(a.responseWindowMs).toBe(9000);
  });
});

describe('ABA v1: поле match и сортировка в сессии', () => {
  const ex = (id: string, role: 'teaching' | 'generalization' = 'teaching'): AbaTarget['exemplars'][number] => ({
    id,
    role,
    targetKey: `k.${id}`,
    modelKey: `m.${id}`,
    partialModelKeys: [],
    cards: [`${id}-a`, `${id}-b`, `${id}-c`],
  });
  const M = tgt('M', {
    format: 'match',
    area: 'matching',
    level: 1,
    sdKind: undefined,
    fieldSize: 3,
    scoredBy: 'device_tap',
    blockSize: 10,
    exemplars: [ex('e1'), ex('e2'), ex('g1', 'generalization'), ex('g2', 'generalization')],
  });

  it('образец — карточка экземпляра по очереди, верная не стоит на одном месте трижды подряд', () => {
    const { state } = drive(begin([M], { M: acq(M) }), () => 'ok');
    const own = state.trials.filter((t) => t.targetId === 'M' && t.kind === 'teaching');
    expect(own.length).toBe(10);
    for (const t of own) {
      expect(t.field).toHaveLength(3);
      expect(t.field).toContain(t.sampleCardId);
      expect(M.exemplars.find((e) => e.id === t.exemplarId)!.cards).toContain(t.sampleCardId);
    }
    const at = own.map((t) => t.field!.indexOf(t.sampleCardId!));
    expect(at.some((p, i) => i >= 2 && p === at[i - 1] && p === at[i - 2])).toBe(false);
    // контрбалансировка: у экземпляра каждая карточка — образец почти поровну
    for (const e of ['e1', 'e2']) {
      const samples = own.filter((t) => t.exemplarId === e).map((t) => t.sampleCardId);
      const counts = [`${e}-a`, `${e}-b`, `${e}-c`].map((c) => samples.filter((x) => x === c).length);
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    }
  });

  it('выбранная карточка — из поля; после подсказки к образцу самостоятельной пробы нет', () => {
    const next = nextStep(begin([M], { M: acq(M) }), 1);
    if (next.step.kind !== 'trial') throw new Error('ждали пробу');
    const input = trialFor(next.state, next.step, 'ok');
    expect(recordTrial(next.state, { ...input, chosenCardId: 'чужая' }, 2)).toMatchObject({ ok: false, errors: ['выбрана карточка не из поля'] });
    expect(recordTrial(next.state, { ...input, observingPrompted: true }, 2)).toMatchObject({ ok: false });
    expect(recordTrial(next.state, { ...input, chosenCardId: next.step.sampleCardId, tapCount: 2 }, 2).ok).toBe(true);
  });

  it('повторы инструкции пишутся числом и кем, не предъявлением; дробные или отрицательные — ошибка программы', () => {
    const next = nextStep(begin([M], { M: acq(M) }), 1);
    if (next.step.kind !== 'trial') throw new Error('ждали пробу');
    const input = trialFor(next.state, next.step, 'ok');
    expect(recordTrial(next.state, { ...input, sdRepeats: { child: 1, adult: -1 } }, 2)).toMatchObject({ ok: false, errors: ['повторы инструкции — целые ≥ 0'] });
    expect(recordTrial(next.state, { ...input, sdRepeats: { child: 0.5, adult: 0 } }, 2).ok).toBe(false);
    const ok = recordTrial(next.state, { ...input, sdRepeats: { child: 2, adult: 1 } }, 2);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      const t = ok.state.trials.at(-1)!;
      expect(t.sdRepeats).toEqual({ child: 2, adult: 1 });
      expect(t.presentations).toBe(input.presentationLog.length);
    }
  });

  it('сортировка: категории поровну, одна не больше двух раз подряд, порядок карточек категорий в сессии неизменен', () => {
    const item = (id: string, category: string, role: 'teaching' | 'generalization' = 'teaching') => ({
      id,
      role,
      targetKey: `k.${id}`,
      modelKey: `m.${id}`,
      partialModelKeys: [],
      image: `img.${id}`,
      category,
    });
    const S = tgt('S', {
      format: 'match',
      area: 'matching',
      level: 2,
      sdKind: undefined,
      matchMode: 'sort',
      sortCategories: ['food', 'clothes'],
      scoredBy: 'device_tap',
      blockSize: 10,
      prerequisiteTargetIds: ['M'],
      exemplars: [
        ...['f1', 'f2', 'f3'].map((id) => item(id, 'food')),
        item('fg', 'food', 'generalization'),
        ...['c1', 'c2', 'c3'].map((id) => item(id, 'clothes')),
        item('cg', 'clothes', 'generalization'),
      ],
    });
    const { state } = drive(begin([M, S], { M: mastered(M), S: acq(S) }, { day: '2026-10-02' }), () => 'ok');
    const own = state.trials.filter((t) => t.targetId === 'S' && t.kind === 'teaching');
    const cats = own.map((t) => t.sampleCardId!);
    expect(cats.filter((c) => c === 'food')).toHaveLength(5);
    expect(cats.some((c, i) => i >= 2 && c === cats[i - 1] && c === cats[i - 2])).toBe(false);
    expect(new Set(own.map((t) => t.field!.join()))).toHaveProperty('size', 1);
    // в следующей сессии с этой целью карточки категорий меняются местами — по её сессиям, а не
    // по чётности номера: номер сессии здесь тот же
    const r = finishSession(state, 99_000);
    const next = drive(begin([M, S], r.states), () => 'ok').state;
    expect(next.trials.find((t) => t.targetId === 'S' && t.field)!.field).toEqual([...own[0].field!].reverse());
  });
});

describe('ABA v1: правки по проверке методиста', () => {
  const A = tgt('A');
  const B = tgt('B', { prerequisiteTargetIds: ['A'], includesTargetIds: ['A'] });
  const C = tgt('C', { prerequisiteTargetIds: ['B'], includesTargetIds: ['B'] });

  it('первая ошибка проверки сверху вниз снимает остаток её проб', () => {
    const st = begin([A, B, C], {}, { autoPlacement: true });
    const failed = answer(st, 1, 'wrong').state;
    expect(failed.queue.some((q) => q.kind === 'trial' && q.trial.targetId === 'C' && q.trial.kind === 'baseline')).toBe(false);
  });

  it('проверка сверху вниз — только со взрослым; в «сам» базовая линия — только в открытом формате', () => {
    expect(begin([A, B, C], {}, { autoPlacement: true, config: 'alone' }).baselineTargetIds).toEqual([]);
  });

  it('выведенные цели получают событие для специалиста', () => {
    const { state } = drive(begin([A, B, C], {}, { autoPlacement: true, day: '2026-10-02' }), () => 'ok');
    const r = finishSession(state, 99_000);
    const inferred = r.session.events.filter((e) => e.kind === 'phase' && e.reason === 'inferred').map((e) => (e as { targetId: string }).targetId);
    expect(inferred.sort()).toEqual(['A', 'B']);
  });

  it('окно специалиста действует и на звенья цепочки — не короче окна звена', () => {
    const D = tgt('D', {
      format: 'do_action',
      steps: [
        { id: 's1', order: 0, sdKey: 'sd1', criterionKey: 'c1', modelKey: 'm1' },
        { id: 's2', order: 1, sdKey: 'sd2', criterionKey: 'c2', modelKey: 'm2', responseWindowMs: 12_000 },
      ],
    });
    const st = begin([D], { D: acq(D) }, { params: { responseWindowMs: { do_action: 10_000 } } });
    const { steps } = drive(st, () => 'ok');
    const windows = steps.filter((x): x is TrialStep => x.kind === 'trial' && x.targetId === 'D').map((x) => [x.stepId, x.responseWindowMs]);
    expect(windows).toContainEqual(['s1', 10_000]);
    expect(windows).toContainEqual(['s2', 12_000]);
  });

  it('сигналы сессии считаются в конце, если передана история', () => {
    const { state } = drive(begin([A], { A: acq(A) }, { day: '2026-10-02' }), () => 'ok');
    const r = finishSession(state, 99_000, {}, undefined, { sessions: [], previous: ['low_motivation'] });
    // истории мало — сигнал держится, как был
    expect(r.signals).toEqual(['low_motivation']);
  });
});

describe('ABA v1: вторая проверка методиста', () => {
  const A = tgt('A');
  const B = tgt('B', { prerequisiteTargetIds: ['A'] });
  const C = tgt('C', { prerequisiteTargetIds: ['B'] });
  const M = tgt('M');

  it('после ошибки проверки сверху вниз — не больше двух высоковероятных проб взамен', () => {
    const st = begin([A, B, C, M], { M: mastered(M) }, { autoPlacement: true });
    const first = nextStep(st, 1);
    // разогрев освоенной M — дойти до пробы C
    let cur = st;
    let i = 1;
    for (; i < 10; i += 1) {
      const n = nextStep(cur, i);
      if (n.step.kind === 'trial' && n.step.targetId === 'C') break;
      cur = answer(cur, i, 'ok').state;
    }
    expect(first.step.kind).toBe('trial');
    const failed = answer(cur, i, 'wrong').state;
    const pending = failed.queue.filter((q) => q.kind === 'trial');
    expect(pending.some((q) => q.kind === 'trial' && q.trial.targetId === 'C' && q.trial.kind === 'baseline')).toBe(false);
    expect(pending.filter((q) => q.kind === 'trial' && q.trial.kind === 'high_p').length).toBeLessThanOrEqual(2);
  });

  it('проверка сверху вниз пишет событие и при провале', () => {
    const { state } = drive(begin([A, B, C], {}, { autoPlacement: true, day: '2026-10-02' }), () => 'wrong');
    const r = finishSession(state, 99_000);
    expect(r.session.events).toContainEqual(expect.objectContaining({ kind: 'placement', targetId: 'C', passed: false }));
    expect(r.states.C.placementTriedAt).toBe(10);
  });

  it('выведенная цель, провалившая поддержание, — событие «вывод не подтвердился»', () => {
    const inferred = { ...mastered(A, 5), masteredBy: 'inferred' as const };
    const { state } = drive(begin([A], { A: inferred }, { day: '2026-10-02' }), () => 'wrong');
    const r = finishSession(state, 99_000);
    expect(r.states.A.phase).toBe('baseline');
    expect(r.session.events).toContainEqual(expect.objectContaining({ kind: 'phase', targetId: 'A', reason: 'inferred_not_confirmed' }));
  });

  it('первый провал поддержания освоенной цели — событие провала, а не «пройдено»', () => {
    const { state } = drive(begin([A], { A: mastered(A, 5, { masteredBy: 'criterion' }) }, { day: '2026-10-02' }), () => 'wrong');
    const r = finishSession(state, 99_000);
    expect(r.session.events).toContainEqual(expect.objectContaining({ kind: 'phase', targetId: 'A', reason: 'maintenance_failed' }));
  });
});

describe('ABA v1: проверка сверху вниз в цепочке', () => {
  const chain = (id: string, pre?: string[]) =>
    tgt(id, {
      format: 'do_action',
      steps: [
        { id: `${id}-1`, order: 0, sdKey: 'sd1', criterionKey: 'c1', modelKey: 'm1' },
        { id: `${id}-2`, order: 1, sdKey: 'sd2', criterionKey: 'c2', modelKey: 'm2' },
        { id: `${id}-3`, order: 2, sdKey: 'sd3', criterionKey: 'c3', modelKey: 'm3' },
      ],
      ...(pre ? { prerequisiteTargetIds: pre } : {}),
    });
  const A = chain('A');
  const B = chain('B', ['A']);

  it('ошибка на звене — оставшиеся звенья прогона доводит взрослый, без записи проб', () => {
    let st = begin([A, B], {}, { autoPlacement: true });
    expect(st.baselineTargetIds).toEqual(['B']);
    st = answer(st, 1, 'wrong').state;
    const { steps, state } = drive(st, () => 'ok');
    const finish = steps.find((x) => x.kind === 'adult_finish_chain');
    expect(finish).toEqual({ kind: 'adult_finish_chain', targetId: 'B', stepIds: ['B-2', 'B-3'] });
    expect(state.trials.filter((t) => t.targetId === 'B')).toHaveLength(1);
  });
});

describe('finishAbaSession: что попадает в итог (слияние в commitAbaSession)', () => {
  const A = tgt('A');
  const B = tgt('B', { prerequisiteTargetIds: ['A'], includesTargetIds: ['A'] });
  const C = tgt('C', { prerequisiteTargetIds: ['B'], includesTargetIds: ['B'] });

  it('states: цель с пробами и выведенные размещением предпосылки попадают в итог', () => {
    const X = tgt('X');
    const { state } = drive(begin([A, B, C, X], { X: mastered(X, 10) }, { autoPlacement: true, day: '2026-10-02' }), () => 'ok');
    const withTrials = new Set(state.trials.map((t) => t.targetId));
    const r = finishSession(state, 99_000);
    // выведенные A и B проб не имели — но размещение их изменило
    expect(withTrials.has('A') || withTrials.has('B')).toBe(false);
    expect(withTrials.has('C')).toBe(true);
    expect(Object.keys(r.states).sort()).toEqual([...new Set(['A', 'B', ...withTrials])].sort());
  });

  it('session.day — локальный день старта, а не UTC-дата метки', () => {
    const { state } = drive(begin([tgt('D')], {}, { day: '2026-10-02' }), () => 'ok');
    expect(finishSession(state, 99_000).session.day).toBe('2026-10-02');
  });

  it('признак обмена рутины в окне передаётся в итог как есть: true, false; пуст (JS-вызов без него) — поля нет', () => {
    const { state } = drive(begin([tgt('D')], {}), () => 'ok');
    const flag = (extra: { routineExchangeInWindow?: boolean }) =>
      finishAbaSession(state, 99_000, {}, undefined, undefined, extra as { routineExchangeInWindow: boolean });
    expect(flag({ routineExchangeInWindow: true }).routineExchangeInWindow).toBe(true);
    expect(flag({ routineExchangeInWindow: false }).routineExchangeInWindow).toBe(false);
    expect(flag({}).routineExchangeInWindow).toBeUndefined();
  });
});

describe('раунд 4: история целей обязательна (В4) и prompt_dependent снимается освоением (В3)', () => {
  const A = tgt('A');
  const M = tgt('M');
  /** Одна сессия до критерия: две сессии на критерии в разные дни, два экземпляра, два переноса. */
  const nearMastery = (over: Partial<AbaTargetState> = {}) =>
    acq(A, 0, {
      sessionsAtCriterion: 2,
      criterionDays: ['2026-09-27', '2026-09-28'],
      exemplarsAtCriterion: ['A-1', 'A-2'],
      generalizationProbes: [
        { response: 'independent', exemplarId: 'A-g1' },
        { response: 'independent', exemplarId: 'A-g2' },
      ],
      ...over,
    });

  it('finishAbaSession без pastSessions бросает: забытый список не отключает детектор молча', () => {
    const { state } = drive(begin([A, M], { A: acq(A, 0), M: mastered(M) }), () => 'ok');
    expect(() => finishAbaSession(state, 9e6, undefined as never, undefined, undefined, { routineExchangeInWindow: false })).toThrow(/pastSessions/);
    expect(() => finishSession(state, 9e6, {})).not.toThrow();
  });

  it('цель с флагом вошла в освоение по критерию — флаг снят, номер флага остаётся, dependenceClearedAt — номер сессии', () => {
    const flagged = nearMastery({ flags: ['prompt_dependent'], dependenceFlaggedAtSession: 4 });
    const r = finishSession(drive(begin([A, M], { A: flagged, M: mastered(M) }), () => 'ok').state, 9e6);
    expect(r.states.A.phase).toBe('mastered');
    expect(r.states.A.flags).not.toContain('prompt_dependent');
    expect([r.states.A.dependenceFlaggedAtSession, r.states.A.dependenceClearedAt]).toEqual([4, 10]);
  });

  it('без освоения флаг остаётся', () => {
    const flagged = acq(A, 0, { flags: ['prompt_dependent'], dependenceFlaggedAtSession: 4 });
    const r = finishSession(drive(begin([A, M], { A: flagged, M: mastered(M) }), () => 'ok').state, 9e6);
    expect(r.states.A.phase).toBe('acquisition');
    expect([r.states.A.flags.includes('prompt_dependent'), r.states.A.dependenceClearedAt]).toEqual([true, undefined]);
  });
});
