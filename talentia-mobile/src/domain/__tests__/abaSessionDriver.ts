/**
 * Помощник тестов «живой доски» (Р3): настоящая ABA-сессия, которую проходят шаг за шагом, без
 * экрана. Домен и хранилище проверяются на одной и той же сессии, а не на её пересказе руками.
 * Не тест: имя без `.test`, jest его не запускает.
 */
import type {
  AbaExemplar,
  AbaPresentation,
  AbaTarget,
  AbaTargetState,
  PresentationOutcome,
  PromptLevel,
} from '../../types/aba';
import {
  chooseReinforcer,
  nextStep,
  recordTrial,
  startAbaSession,
  type AbaSessionState,
  type AbaTrialInput,
  type RecordResult,
  type StartInput,
  type TrialStep,
} from '../abaSession';
import { initialTargetState } from '../abaPrompting';
import { initialTokenTraining, type BoardStage, type TokenTrainingState } from '../abaTokenTraining';
import { GRID_FOR } from './abaFixtures';

export const POOL = ['puzzle', 'bubbles', 'drum', 'stickers', 'train', 'balloon'];

/** Начало сессии в тестах: 2026-10-12 08:00 UTC. Все метки времени отсчитываются от него. */
export const BASE_MS = Date.UTC(2026, 9, 12, 8);
export const DAY = '2026-10-12';

export const trained = (stage: BoardStage = 5): TokenTrainingState => ({ ...initialTokenTraining(), pairingDone: true, stage });

const ex = (id: string, role: AbaExemplar['role'] = 'teaching'): AbaExemplar => ({
  id,
  role,
  targetKey: `k.${id}`,
  modelKey: `m.${id}`,
  partialModelKeys: [],
  image: `img-${id}`,
});

export function tgt(id: string, over: Partial<AbaTarget> = {}): AbaTarget {
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

export const acq = (t: AbaTarget, start: PromptLevel = 0): AbaTargetState => ({
  ...initialTargetState(t),
  phase: 'acquisition',
  startPromptLevel: start,
  lastSuccessfulPromptLevel: start,
});

export const masteredState = (t: AbaTarget, idx = 10): AbaTargetState => ({
  ...initialTargetState(t),
  phase: 'mastered',
  startPromptLevel: 0,
  lastSuccessfulPromptLevel: 0,
  lastMaintenanceSessionIndex: idx,
});

/** Две обучаемые цели и три освоенных: разогрев, два блока обучения, перерыв между ними. */
export function standardPlan(): { targets: AbaTarget[]; states: Record<string, AbaTargetState> } {
  const [M1, M2, A, B, N] = ['M1', 'M2', 'A', 'B', 'N'].map((id) => tgt(id));
  return {
    targets: [M1, M2, A, B, N],
    states: { M1: masteredState(M1), M2: masteredState(M2, 0), A: { ...acq(A, 0), recentIndependentRates: [0.7] }, B: acq(B) },
  };
}

/** Начать сессию и сделать выбор подкрепителя (по умолчанию первый из трёх). */
export function beginSession(over: Partial<StartInput> = {}, pick = 0, by: 'child' | 'adult' = 'child'): AbaSessionState {
  const plan = standardPlan();
  const st = startAbaSession({
    sessionId: 's',
    sessionIndex: 10,
    day: DAY,
    config: 'with_adult',
    band: '7',
    targets: plan.targets,
    states: plan.states,
    reinforcerPool: POOL,
    reinforcerHistory: [],
    startedAt: BASE_MS,
    seed: 42,
    tokenTraining: trained(5),
    physicalPromptAllowed: true,
    observers: [{ id: 'obs-spec', role: 'specialist', trained: true }],
    primaryObserverId: 'obs-spec',
    ...over,
  });
  const first = nextStep(st, BASE_MS);
  if (first.step.kind !== 'choose_reinforcer') throw new Error('сессия начинается не с выбора подкрепителя');
  return chooseReinforcer(first.state, first.step.options[pick], BASE_MS, by);
}

/** Сессия до выбора подкрепителя: для проверки самого выбора. */
export function startedSession(over: Partial<StartInput> = {}): AbaSessionState {
  const plan = standardPlan();
  return startAbaSession({
    sessionId: 's',
    sessionIndex: 10,
    day: DAY,
    config: 'with_adult',
    band: '7',
    targets: plan.targets,
    states: plan.states,
    reinforcerPool: POOL,
    reinforcerHistory: [],
    startedAt: BASE_MS,
    seed: 42,
    tokenTraining: trained(5),
    physicalPromptAllowed: true,
    observers: [{ id: 'obs-spec', role: 'specialist', trained: true }],
    primaryObserverId: 'obs-spec',
    ...over,
  });
}

function logFor(step: TrialStep): AbaPresentation[] {
  // верный ответ на стартовом уровне — один показ
  const level = Math.min(step.startPromptLevel, 3) as PromptLevel;
  const startedAt = BASE_MS;
  const endedAt = startedAt + 1000;
  const outcome: PresentationOutcome = 'correct';
  return [
    {
      level,
      by: 'app',
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      windowMs: step.promptDelayMs ?? step.responseWindowMs,
      outcome,
      respondedAt: new Date(endedAt + 1000).toISOString(),
    },
  ];
}

let seq = 0;

/** Ввод экрана: верный ответ на стартовом уровне. */
export function correctInput(state: AbaSessionState, step: TrialStep): AbaTrialInput {
  const start = step.startPromptLevel;
  seq += 1;
  return {
    id: `drv-${seq}`,
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
    presentationLog: logFor(step),
    promptDelayMs: step.promptDelayMs,
    responseWindowMs: step.responseWindowMs,
    sdEndedAt: '2026-10-12T08:00:01Z',
    scoredBy: step.scoredBy,
  };
}

/** Следующая проба и её верный ответ: состояние после `nextStep` и запись. */
export function answerNext(state: AbaSessionState, now: number): { state: AbaSessionState; res: Extract<RecordResult, { ok: true }> } {
  const next = nextStep(state, now);
  if (next.step.kind !== 'trial') throw new Error(`ждали пробу, а шаг ${next.step.kind}`);
  const res = recordTrial(next.state, correctInput(next.state, next.step), now);
  if (!res.ok) throw new Error(res.errors.join('; '));
  return { state: res.state, res };
}
