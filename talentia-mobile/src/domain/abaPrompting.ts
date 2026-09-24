/**
 * Подсказки в ABA-режиме. Спецификация — раздел «Подсказки» в `ABA.md`.
 *
 * Два движения, которые прежняя версия смешивала в одно: **подъём внутри пробы**
 * (ребёнок молчит — SD повторяется на уровень выше) и **спуск между пробами**
 * (затухание стартового уровня). Первое живёт одну пробу, второе персистится в
 * `AbaTargetState`: прежняя версия держала уровень в `useState`, и затухание
 * обнулялось при каждом входе.
 */
import {
  APP_MAX_PROMPT,
  MAX_ESCALATIONS_PER_TRIAL,
  PROMPT_DEPENDENCE,
  type AbaResponse,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
  type AbaTrialKind,
  type PromptLevel,
} from '../types/aba';

/** Сколько подряд проб нужно, чтобы стартовый уровень сдвинулся. */
export const FADE_AFTER = 2;

/** На сколько растёт задержка при флаге зависимости. */
export const DEPENDENCE_DELAY_STEP_MS = 1000;

/**
 * Новая цель стартует с полной модели, а не с нуля: у нулевой цели вероятность
 * самостоятельного ответа около нуля, и «дай ответить самому» превращается в
 * серию неудач на старте. Две успешные пробы на L3 — и затухание пошло вниз.
 */
export function initialTargetState(target: AbaTarget): AbaTargetState {
  return {
    targetId: target.id,
    phase: 'acquisition',
    startPromptLevel: APP_MAX_PROMPT,
    consecutiveIndependentAtStart: 0,
    consecutiveAboveStart: 0,
    currentDelayMs: target.delayMs,
    recentIndependentRates: [],
    sessionsAtCriterion: 0,
    criterionDays: [],
    exemplarsAtCriterion: [],
    generalizationProbes: [],
    lastSessionIndex: -1,
    maintenanceGapIndex: 0,
    flags: [],
    lastSuccessfulPromptLevel: APP_MAX_PROMPT,
  };
}

/** Что сделать после того, как ребёнок не ответил на предъявление. */
export type EscalationStep =
  | { kind: 'present'; level: PromptLevel }
  /** Эскалации исчерпаны: показать полную модель, записать пробу, идти дальше. */
  | { kind: 'model_and_close' }
  /** Проба не учит, а измеряет: подсказки нет, реакция пишется как есть. */
  | { kind: 'close' };

/**
 * Следующий шаг внутри пробы после `presentations` предъявлений без ответа.
 *
 * Least-to-most: SD → задержка → нет реакции → SD на уровень выше. Больше двух
 * эскалаций не бывает — три предъявления одного SD уже натаскивание. Если
 * стартовый уровень уже полная модель, подниматься некуда: L4 приложение не
 * выдаёт, его даёт только взрослый.
 */
export function nextEscalation(
  kind: AbaTrialKind,
  startLevel: PromptLevel,
  presentations: number,
): EscalationStep {
  if (kind === 'generalization' || kind === 'baseline') return { kind: 'close' };
  const escalations = presentations - 1;
  const current = Math.min(APP_MAX_PROMPT, startLevel + escalations);
  if (escalations >= MAX_ESCALATIONS_PER_TRIAL || current >= APP_MAX_PROMPT) {
    return { kind: 'model_and_close' };
  }
  return { kind: 'present', level: (current + 1) as PromptLevel };
}

const SUCCESS: ReadonlySet<AbaResponse> = new Set(['independent', 'prompted']);
const FAILURE: ReadonlySet<AbaResponse> = new Set(['incorrect', 'no_response']);

/** Пробы, по которым двигается затухание. Перенос и поддержание измеряют, а не учат. */
const FADING_KINDS: ReadonlySet<AbaTrialKind> = new Set(['teaching', 'transfer']);

/**
 * Затухание между пробами: сдвигает стартовый уровень по итогу пробы.
 *
 * Две подряд успешные пробы **на стартовом уровне** — уровень опускается; две
 * подряд, где понадобилось больше, — поднимается. Приближение ни то ни другое:
 * на шейпинге оно продвижение, но не ответ, и сдвигать по нему уровень рано.
 * Прерванная проба не случилась.
 */
export function applyTrialToFading(s: AbaTargetState, t: AbaTrial): AbaTargetState {
  if (t.response === 'interrupted' || !FADING_KINDS.has(t.kind)) return s;

  const succeeded = SUCCESS.has(t.response);
  const lastSuccessfulPromptLevel = succeeded ? t.promptLevelUsed : s.lastSuccessfulPromptLevel;
  const atStart = succeeded && t.promptLevelUsed <= t.startPromptLevel;
  const above = FAILURE.has(t.response) || (succeeded && t.promptLevelUsed > t.startPromptLevel);

  if (!atStart && !above) return { ...s, lastSuccessfulPromptLevel };

  const independentRun = atStart ? s.consecutiveIndependentAtStart + 1 : 0;
  const aboveRun = above ? s.consecutiveAboveStart + 1 : 0;

  if (independentRun >= FADE_AFTER && s.startPromptLevel > 0) {
    return {
      ...s,
      lastSuccessfulPromptLevel,
      startPromptLevel: (s.startPromptLevel - 1) as PromptLevel,
      consecutiveIndependentAtStart: 0,
      consecutiveAboveStart: 0,
    };
  }
  if (aboveRun >= FADE_AFTER && s.startPromptLevel < APP_MAX_PROMPT) {
    return {
      ...s,
      lastSuccessfulPromptLevel,
      startPromptLevel: (s.startPromptLevel + 1) as PromptLevel,
      consecutiveIndependentAtStart: 0,
      consecutiveAboveStart: 0,
    };
  }
  return {
    ...s,
    lastSuccessfulPromptLevel,
    consecutiveIndependentAtStart: independentRun,
    consecutiveAboveStart: aboveRun,
  };
}

/** Проба закончилась ничем даже на полной модели. */
function failedAtMax(t: AbaTrial): boolean {
  return t.promptLevelUsed >= APP_MAX_PROMPT && FAILURE.has(t.response);
}

/** Сколько подряд провалов на полной модели ведут к остановке. */
export const BREAKDOWN_AFTER = 3;

/**
 * Критерий остановки: три подряд пробы без ответа даже на полной модели.
 *
 * Сессию после этого закрывает проба с полной моделью, доведённой до успеха, —
 * последнее событие сеанса ассоциируется с сеансом. Прерванные пробы серию не
 * рвут и в неё не входят.
 */
export function isBreakdown(sessionTrials: AbaTrial[]): boolean {
  const recent = sessionTrials.filter((t) => t.response !== 'interrupted').slice(-BREAKDOWN_AFTER);
  return recent.length === BREAKDOWN_AFTER && recent.every(failedAtMax);
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Зависимость от подсказки по последним сессиям цели (свежие в конце).
 *
 * Три условия, и третье ключевое: не умеющий ошибается быстро, зависимый
 * **молчит ровно до подсказки**. Поэтому без проб на L0 с измеренной
 * латентностью флаг не ставится — отличить одно от другого не по чему.
 */
export function isPromptDependent(sessions: AbaTrial[][], delayMs: number): boolean {
  const window = sessions.slice(-PROMPT_DEPENDENCE.overSessions);
  if (window.length < PROMPT_DEPENDENCE.overSessions) return false;

  const trials = window.flat().filter((t) => t.kind === 'teaching' && t.response !== 'interrupted');
  if (trials.length === 0) return false;

  const independent = trials.filter((t) => t.response === 'independent').length / trials.length;
  const prompted = trials.filter((t) => t.response === 'prompted').length / trials.length;
  const l0Latency = median(
    trials
      .filter((t) => t.startPromptLevel === 0 && t.latencyMs !== null)
      .map((t) => t.latencyMs as number),
  );

  return (
    prompted >= PROMPT_DEPENDENCE.minPromptedRate &&
    independent <= PROMPT_DEPENDENCE.maxIndependentRate &&
    l0Latency !== null &&
    l0Latency >= delayMs
  );
}

/**
 * Реакция на зависимость: задержка +1 с и стартовый уровень L0 на следующую
 * сессию. Флаг видит специалист, не ребёнок.
 */
export function applyPromptDependence(s: AbaTargetState): AbaTargetState {
  return {
    ...s,
    flags: s.flags.includes('prompt_dependent') ? s.flags : [...s.flags, 'prompt_dependent'],
    currentDelayMs: s.currentDelayMs + DEPENDENCE_DELAY_STEP_MS,
    startPromptLevel: 0,
    consecutiveIndependentAtStart: 0,
    consecutiveAboveStart: 0,
  };
}
