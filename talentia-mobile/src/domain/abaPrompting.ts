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
  DELAY_STEP_MS,
  MAX_DELAY_MS,
  MAX_ESCALATIONS_PER_TRIAL,
  PROMPT_DEPENDENCE,
  type AbaResponse,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
  type PromptLevel,
} from '../types/aba';

/** Сколько подряд проб нужно, чтобы стартовый уровень сдвинулся. */
export const FADE_AFTER = 2;

/** Уровень, который приложение может выдать. L4 даёт только взрослый — стартовым он не бывает. */
export function clampToApp(level: PromptLevel): PromptLevel {
  return Math.min(level, APP_MAX_PROMPT) as PromptLevel;
}

/**
 * Новая цель стартует с полной модели, а не с нуля: у нулевой цели вероятность
 * самостоятельного ответа около нуля, и «дай ответить самому» превращается в
 * серию неудач на старте. Две успешные пробы на L3 — и затухание пошло вниз.
 *
 * Прогрессивная задержка начинается с одного шага и растёт по мере успеха;
 * постоянная — сразу `delayMs`. В обоих случаях не выше потолка по возрасту.
 */
export function initialTargetState(target: AbaTarget): AbaTargetState {
  const start = target.delayMode === 'progressive' ? DELAY_STEP_MS : target.delayMs;
  return {
    targetId: target.id,
    phase: 'acquisition',
    startPromptLevel: APP_MAX_PROMPT,
    consecutiveIndependentAtStart: 0,
    consecutiveAboveStart: 0,
    currentDelayMs: Math.min(start, MAX_DELAY_MS[target.band]),
    recentIndependentRates: [],
    sessionsAtCriterion: 0,
    criterionDays: [],
    exemplarsAtCriterion: [],
    generalizationProbes: [],
    lastSessionIndex: -1,
    lastMaintenanceSessionIndex: -1,
    maintenanceGapIndex: 0,
    maintenanceFailsInRow: 0,
    flags: [],
    dependenceFlaggedAtSession: null,
    lastSuccessfulPromptLevel: APP_MAX_PROMPT,
  };
}

/**
 * Сколько ждать ответа после конца озвучки SD. На полной модели — ноль: модель
 * звучит сразу, ждать нечего, это и есть нулевая задержка безошибочного старта.
 */
export function effectiveDelayMs(s: AbaTargetState, level: PromptLevel): number {
  return level >= APP_MAX_PROMPT ? 0 : s.currentDelayMs;
}

/** Что сделать после того, как ребёнок не ответил на предъявление. */
export type EscalationStep =
  | { kind: 'present'; level: PromptLevel }
  /** Проба окончена: записать реакцию как есть и идти к следующей. */
  | { kind: 'close' };

/**
 * Следующий шаг внутри пробы после `presentations` предъявлений без ответа,
 * последнее — на уровне `level`.
 *
 * Least-to-most, но предъявлений не больше трёх: три раза один SD — уже
 * натаскивание. Поэтому последняя допустимая эскалация ведёт сразу на полную
 * модель, а после полной модели проба закрывается без повтора: с L0 это
 * L0 → L1 → L3, со старта L2 — L2 → L3. L4 приложение не выдаёт.
 *
 * Перенос и базовая линия измеряют, а не учат: подсказки нет.
 */
export function nextEscalation(trial: Pick<AbaTrial, 'kind'>, level: PromptLevel, presentations: number): EscalationStep {
  if (trial.kind === 'generalization' || trial.kind === 'baseline') return { kind: 'close' };
  if (level >= APP_MAX_PROMPT || presentations > MAX_ESCALATIONS_PER_TRIAL) return { kind: 'close' };
  const next = presentations === MAX_ESCALATIONS_PER_TRIAL ? APP_MAX_PROMPT : level + 1;
  return { kind: 'present', level: next as PromptLevel };
}

const SUCCESS: ReadonlySet<AbaResponse> = new Set(['independent', 'prompted']);
const FAILURE: ReadonlySet<AbaResponse> = new Set(['incorrect', 'no_response']);

/**
 * Затухание между пробами: сдвигает стартовый уровень по итогу пробы.
 *
 * Две подряд успешные обучающие пробы **на стартовом уровне** — уровень
 * опускается; две подряд, где понадобилось больше, — поднимается. «Подряд»
 * значит подряд: приближение не двигает уровень, но рвёт обе серии.
 *
 * Проба переноса после коррекции идёт на свежем следе модели, её успех завышен:
 * провал поднимает уровень, успех только рвёт серию подъёма. Коррекция успешна
 * по построению и в затухание не идёт вовсе. Прерванная проба не случилась.
 */
export function applyTrialToFading(s: AbaTargetState, t: AbaTrial): AbaTargetState {
  if (t.response === 'interrupted') return s;
  if (t.kind !== 'teaching' && t.kind !== 'transfer') return s;

  const succeeded = SUCCESS.has(t.response);
  const lastSuccessfulPromptLevel = succeeded ? clampToApp(t.promptLevelUsed) : s.lastSuccessfulPromptLevel;
  const base = { ...s, lastSuccessfulPromptLevel };

  if (t.response === 'approximation') {
    return { ...base, consecutiveIndependentAtStart: 0, consecutiveAboveStart: 0 };
  }

  const above = FAILURE.has(t.response) || t.promptLevelUsed > t.startPromptLevel;
  if (t.kind === 'transfer' && !above) return { ...base, consecutiveAboveStart: 0 };

  const independentRun = above ? 0 : s.consecutiveIndependentAtStart + 1;
  const aboveRun = above ? s.consecutiveAboveStart + 1 : 0;

  if (independentRun >= FADE_AFTER && s.startPromptLevel > 0) {
    return {
      ...base,
      startPromptLevel: (s.startPromptLevel - 1) as PromptLevel,
      consecutiveIndependentAtStart: 0,
      consecutiveAboveStart: 0,
    };
  }
  if (aboveRun >= FADE_AFTER && s.startPromptLevel < APP_MAX_PROMPT) {
    return {
      ...base,
      startPromptLevel: (s.startPromptLevel + 1) as PromptLevel,
      consecutiveIndependentAtStart: 0,
      consecutiveAboveStart: 0,
    };
  }
  return { ...base, consecutiveIndependentAtStart: independentRun, consecutiveAboveStart: aboveRun };
}

/** Ошибка до подсказки: ребёнок попробовал и промахнулся. Приближение ошибкой не считается. */
function erredBeforePrompt(t: AbaTrial): boolean {
  return t.emittedBeforePrompt && (t.response === 'incorrect' || t.response === 'prompted');
}

/**
 * Прогрессивная задержка по итогу обучающего блока.
 *
 * Блок без единой ошибки до подсказки — задержка на шаг длиннее. Две подряд
 * ошибки до подсказки — на шаг короче: ребёнок не ждёт, а угадывает, и ему
 * нужна подсказка раньше. Потолок по возрасту. Постоянная задержка не меняется.
 */
export function applyBlockToDelay(s: AbaTargetState, target: AbaTarget, block: AbaTrial[]): AbaTargetState {
  if (target.delayMode !== 'progressive') return s;
  const trials = block.filter((t) => t.kind === 'teaching' && t.response !== 'interrupted');
  if (trials.length === 0) return s;

  const twoInRow = trials.some((t, i) => i > 0 && erredBeforePrompt(t) && erredBeforePrompt(trials[i - 1]));
  if (twoInRow) return { ...s, currentDelayMs: Math.max(DELAY_STEP_MS, s.currentDelayMs - DELAY_STEP_MS) };
  if (trials.some(erredBeforePrompt)) return s;
  return { ...s, currentDelayMs: Math.min(MAX_DELAY_MS[target.band], s.currentDelayMs + DELAY_STEP_MS) };
}

/** Проба закончилась ничем даже на полной модели. */
function failedAtMax(t: AbaTrial): boolean {
  return t.promptLevelUsed >= APP_MAX_PROMPT && FAILURE.has(t.response);
}

/** Сколько подряд провалов на полной модели ведут к остановке. */
export const BREAKDOWN_AFTER = 3;

/**
 * Критерий остановки: три подряд пробы цели без ответа даже на полной модели.
 *
 * Считаются только обучающие пробы и пробы переноса этой цели. Разогрев и
 * отвлекающие пробы между ними серию не рвут: коррекция после каждой ошибки
 * вставляет отвлекающую пробу освоенной цели, и если бы она рвала серию, три
 * провала подряд в логе не встретились бы никогда — ребёнок проваливался бы без
 * конца. Приближение на полной модели — продвижение, не провал.
 *
 * Сессию после этого закрывает проба с полной моделью, доведённой до успеха, —
 * последнее событие сеанса ассоциируется с сеансом.
 */
export function isBreakdown(sessionTrials: AbaTrial[], targetId: string): boolean {
  const recent = sessionTrials
    .filter((t) => t.targetId === targetId && (t.kind === 'teaching' || t.kind === 'transfer'))
    .filter((t) => t.response !== 'interrupted')
    .slice(-BREAKDOWN_AFTER);
  return recent.length === BREAKDOWN_AFTER && recent.every(failedAtMax);
}

/** Сессия цели для проверки зависимости: сквозной номер и её пробы. */
export type SessionTrials = { index: number; trials: AbaTrial[] };

/**
 * Зависимость от подсказки по последним сессиям цели (свежие в конце).
 *
 * Три условия: подсказанных много, самостоятельных мало и — ключевое — среди
 * подсказанных проб со старта L0 ребёнок почти всегда **молчал до подсказки**.
 * Не умеющий пробует и ошибается; зависимый ждёт. Пока старт выше L0, одно от
 * другого не отличить, и флаг не ставится.
 *
 * После флага окно начинается заново: на тех же сессиях второй раз не срабатывает.
 */
export function isPromptDependent(s: AbaTargetState, sessions: SessionTrials[]): boolean {
  const fresh = sessions.filter(
    (x) => s.dependenceFlaggedAtSession === null || x.index > s.dependenceFlaggedAtSession,
  );
  const window = fresh.slice(-PROMPT_DEPENDENCE.overSessions);
  if (window.length < PROMPT_DEPENDENCE.overSessions) return false;

  const trials = window
    .flatMap((x) => x.trials)
    .filter((t) => t.kind === 'teaching' && t.response !== 'interrupted');
  if (trials.length === 0) return false;

  const independent = trials.filter((t) => t.response === 'independent').length / trials.length;
  const prompted = trials.filter((t) => t.response === 'prompted').length / trials.length;
  const fromL0 = trials.filter((t) => t.startPromptLevel === 0 && t.response === 'prompted');
  if (fromL0.length < PROMPT_DEPENDENCE.minSilentEvidence) return false;
  const silent = fromL0.filter((t) => !t.emittedBeforePrompt).length / fromL0.length;

  return (
    prompted >= PROMPT_DEPENDENCE.minPromptedRate &&
    independent <= PROMPT_DEPENDENCE.maxIndependentRate &&
    silent >= PROMPT_DEPENDENCE.minSilentBeforePromptRate
  );
}

/**
 * Реакция на зависимость: задержка на шаг длиннее (не выше потолка) и старт с L0
 * на следующую сессию. Флаг видит специалист, не ребёнок.
 */
export function applyPromptDependence(
  s: AbaTargetState,
  target: AbaTarget,
  sessionIndex: number,
): AbaTargetState {
  return {
    ...s,
    flags: s.flags.includes('prompt_dependent') ? s.flags : [...s.flags, 'prompt_dependent'],
    currentDelayMs: Math.min(MAX_DELAY_MS[target.band], s.currentDelayMs + DELAY_STEP_MS),
    startPromptLevel: 0,
    consecutiveIndependentAtStart: 0,
    consecutiveAboveStart: 0,
    dependenceFlaggedAtSession: sessionIndex,
  };
}

/** Противоречие внутри записи пробы. Непустой список — запись нельзя писать в лог. */
export function trialInvariantErrors(t: AbaTrial): string[] {
  const errors: string[] = [];
  if (t.response === 'independent' && t.promptLevelUsed !== 0) {
    errors.push('самостоятельный ответ после подсказки');
  }
  if (t.response === 'prompted' && t.promptLevelUsed === 0) errors.push('подсказанный ответ без подсказки');
  if (t.promptLevelUsed < t.startPromptLevel) errors.push('понадобилось меньше, чем стартовый уровень');
  if (t.presentations > MAX_ESCALATIONS_PER_TRIAL + 1) errors.push('больше трёх предъявлений одного SD');
  if (t.response === 'independent' && !t.emittedBeforePrompt) {
    errors.push('самостоятельный ответ без попытки до подсказки');
  }
  return errors;
}
