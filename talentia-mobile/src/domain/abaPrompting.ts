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
  type AbaFormat,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
  type PromptLevel,
  type StepPromptState,
} from '../types/aba';

/** Сколько подряд проб нужно, чтобы стартовый уровень сдвинулся. */
export const FADE_AFTER = 2;

/**
 * Провалов подряд, после которых старт сразу возвращается на полную модель, а не
 * поднимается на ступень: две ошибки подряд значат, что ребёнок угадывает, и каждая
 * следующая проба без модели — ещё одна ошибка и коррекция.
 */
export const FAILURES_TO_ERRORLESS = 2;

/** Уровень, который приложение может выдать. L4 даёт только взрослый — стартовым он не бывает. */
export function clampToApp(level: PromptLevel): PromptLevel {
  return Math.min(level, APP_MAX_PROMPT) as PromptLevel;
}

/**
 * Новая цель начинается с **базовой линии** (`abaCriterion.applyBaseline`): три пробы без
 * подсказки показывают, с чего начинать. Без неё уже известный навык прошёл бы
 * безошибочный старт с полной модели — ребёнка учили бы ждать модель.
 *
 * Стартовый уровень здесь — на случай цели, у которой базовая линия дала ноль из трёх:
 * обучение с полной модели, а не с нуля. У нулевой цели вероятность самостоятельного
 * ответа около нуля, и «дай ответить самому» превращается в серию неудач на старте.
 *
 * Прогрессивная задержка начинается с одного шага и растёт по мере успеха;
 * постоянная — сразу `delayMs`. В обоих случаях не выше потолка по возрасту.
 */
export function initialTargetState(target: AbaTarget): AbaTargetState {
  const start = target.delayMode === 'progressive' ? DELAY_STEP_MS : target.delayMs;
  return {
    targetId: target.id,
    phase: 'baseline',
    startPromptLevel: APP_MAX_PROMPT,
    consecutiveIndependentAtStart: 0,
    consecutiveAboveStart: 0,
    consecutiveFailures: 0,
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
    lastGeneralizationSessionIndex: -1,
  };
}

/**
 * Состояние подсказки для пробы: у звена цепочки — своё, у дискретной цели — цели.
 * Новое звено наследует уровень цели: так цепочка стартует одинаково по всем звеньям.
 */
export function promptStateOf(s: AbaTargetState, stepId?: string): StepPromptState {
  const own: StepPromptState = {
    startPromptLevel: s.startPromptLevel,
    consecutiveIndependentAtStart: s.consecutiveIndependentAtStart,
    consecutiveAboveStart: s.consecutiveAboveStart,
    consecutiveFailures: s.consecutiveFailures,
    lastSuccessfulPromptLevel: s.lastSuccessfulPromptLevel,
  };
  if (!stepId) return own;
  return (
    s.stepPrompts?.[stepId] ?? {
      ...own,
      consecutiveIndependentAtStart: 0,
      consecutiveAboveStart: 0,
      consecutiveFailures: 0,
    }
  );
}

function withPromptState(s: AbaTargetState, stepId: string | undefined, ps: StepPromptState): AbaTargetState {
  if (!stepId) return { ...s, ...ps };
  return { ...s, stepPrompts: { ...s.stepPrompts, [stepId]: ps } };
}

/**
 * Первый уровень подсказки, который **несёт ответ**. После неверного ответа коррекция не
 * бывает ниже: ошибку различения ориентирующей подсказкой не исправить, это то же
 * «неверно, попробуй ещё» с жестом. В речевых форматах и в действии L1 ответа не
 * раскрывает — нужна хотя бы частичная модель; в `identify` L1 — жест к карточке, он и
 * есть ответ.
 */
export const FIRST_ANSWER_LEVEL: Record<AbaFormat, PromptLevel> = {
  imitate_sound: 2,
  repeat_word: 2,
  voice_volume: 2,
  do_action: 2,
  identify: 1,
};

/**
 * Уровень пробы коррекции — не ниже того, что ребёнку только что понадобилось, плюс
 * ступень, и никогда не L0: коррекция на L0 — то самое «неверно, попробуй ещё». Не
 * ниже последнего успешного уровня, а после неверного ответа — не ниже первого уровня,
 * несущего ответ (`FIRST_ANSWER_LEVEL`). Сама проба коррекции доводится до верного
 * ответа при любом провале: до полной модели, со взрослым — до L4.
 *
 * `null` — ребёнок не ответил даже на полной модели: модель только что прозвучала и
 * реакции не вызвала. Со взрослым вместо повтора модели взрослый сразу даёт L4, без
 * взрослого шаг пропускается — дальше отвлекающая проба и перенос.
 */
export function correctionLevel(s: AbaTargetState, failed: AbaTrial, format: AbaFormat): PromptLevel | null {
  if (failed.response === 'no_response' && failed.promptLevelUsed >= APP_MAX_PROMPT) return null;
  const ps = promptStateOf(s, failed.stepId);
  const floor = failed.response === 'incorrect' ? FIRST_ANSWER_LEVEL[format] : 1;
  const level = Math.max(floor, ps.lastSuccessfulPromptLevel, failed.promptLevelUsed + 1);
  return clampToApp(Math.min(level, APP_MAX_PROMPT) as PromptLevel);
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
 *
 * У звена цепочки затухание своё (`stepPrompts`).
 *
 * Два провала подряд (`FAILURES_TO_ERRORLESS`) — старт сразу на полную модель:
 * безошибочное обучение заново, а не подъём по ступени.
 */
export function applyTrialToFading(s: AbaTargetState, t: AbaTrial): AbaTargetState {
  if (t.response === 'interrupted') return s;
  if (t.kind !== 'teaching' && t.kind !== 'transfer') return s;
  return withPromptState(s, t.stepId, fadeStep(promptStateOf(s, t.stepId), t));
}

function fadeStep(ps: StepPromptState, t: AbaTrial): StepPromptState {
  const succeeded = SUCCESS.has(t.response);
  const lastSuccessfulPromptLevel = succeeded ? clampToApp(t.promptLevelUsed) : ps.lastSuccessfulPromptLevel;
  const failures = FAILURE.has(t.response) ? ps.consecutiveFailures + 1 : 0;
  const base = { ...ps, lastSuccessfulPromptLevel, consecutiveFailures: failures };

  if (failures >= FAILURES_TO_ERRORLESS) {
    return {
      ...base,
      startPromptLevel: APP_MAX_PROMPT,
      consecutiveIndependentAtStart: 0,
      consecutiveAboveStart: 0,
      consecutiveFailures: 0,
    };
  }
  if (t.response === 'approximation') {
    return { ...base, consecutiveIndependentAtStart: 0, consecutiveAboveStart: 0 };
  }

  const above = FAILURE.has(t.response) || t.promptLevelUsed > t.startPromptLevel;
  if (t.kind === 'transfer' && !above) return { ...base, consecutiveAboveStart: 0 };

  const independentRun = above ? 0 : ps.consecutiveIndependentAtStart + 1;
  const aboveRun = above ? ps.consecutiveAboveStart + 1 : 0;

  if (independentRun >= FADE_AFTER && ps.startPromptLevel > 0) {
    return {
      ...base,
      startPromptLevel: (ps.startPromptLevel - 1) as PromptLevel,
      consecutiveIndependentAtStart: 0,
      consecutiveAboveStart: 0,
    };
  }
  if (aboveRun >= FADE_AFTER && ps.startPromptLevel < APP_MAX_PROMPT) {
    return {
      ...base,
      startPromptLevel: (ps.startPromptLevel + 1) as PromptLevel,
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
 *
 * Считаются только пробы со старта L0 — там, где задержка вообще действует. На
 * подсказанном старте окна «до подсказки» нет, ошибиться до неё невозможно, и
 * каждый такой блок выглядел бы безошибочным: задержка доросла бы до потолка,
 * пока цель ещё на полной модели, и самая длинная пауза встретила бы ребёнка
 * ровно тогда, когда он впервые должен отвечать сам.
 */
export function applyBlockToDelay(s: AbaTargetState, target: AbaTarget, block: AbaTrial[]): AbaTargetState {
  if (target.delayMode !== 'progressive') return s;
  const trials = block.filter(
    (t) => t.kind === 'teaching' && t.startPromptLevel === 0 && t.response !== 'interrupted',
  );
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
 * У цепочки серия считается по каждому звену отдельно: провалы третьего звена
 * перемежаются удачными первыми двумя, и общая серия не собралась бы никогда.
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
  const byStep = new Map<string, AbaTrial[]>();
  for (const t of sessionTrials) {
    if (t.targetId !== targetId || t.response === 'interrupted') continue;
    if (t.kind !== 'teaching' && t.kind !== 'transfer') continue;
    const key = t.stepId ?? '';
    byStep.set(key, [...(byStep.get(key) ?? []), t]);
  }
  return [...byStep.values()].some((trials) => {
    const recent = trials.slice(-BREAKDOWN_AFTER);
    return recent.length === BREAKDOWN_AFTER && recent.every(failedAtMax);
  });
}

/** Сессия цели для проверки зависимости: сквозной номер и её пробы. */
export type SessionTrials = { index: number; trials: AbaTrial[] };

/**
 * Зависимость от подсказки по последним сессиям цели (свежие в конце).
 *
 * Три условия по пробам со старта L0: подсказанных много, самостоятельных мало
 * и — ключевое — в подсказанных ребёнок почти всегда **молчал до подсказки**.
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

  // Только старт с L0: на подсказанном старте самостоятельный ответ невозможен по
  // построению, и доли выполнялись бы сами собой
  const trials = window
    .flatMap((x) => x.trials)
    .filter((t) => t.kind === 'teaching' && t.startPromptLevel === 0 && t.response !== 'interrupted');
  const promptedTrials = trials.filter((t) => t.response === 'prompted');
  if (promptedTrials.length < PROMPT_DEPENDENCE.minSilentEvidence) return false;

  const independent = trials.filter((t) => t.response === 'independent').length / trials.length;
  const prompted = promptedTrials.length / trials.length;
  const silent = promptedTrials.filter((t) => !t.emittedBeforePrompt).length / promptedTrials.length;

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
    consecutiveFailures: 0,
    ...(s.stepPrompts
      ? {
          stepPrompts: Object.fromEntries(
            Object.entries(s.stepPrompts).map(([id, ps]) => [
              id,
              { ...ps, startPromptLevel: 0 as PromptLevel, consecutiveIndependentAtStart: 0, consecutiveAboveStart: 0, consecutiveFailures: 0 },
            ]),
          ),
        }
      : {}),
    dependenceFlaggedAtSession: sessionIndex,
  };
}

/**
 * Пробы, которые измеряют, а не учат: начинаются всегда без подсказки. Проба
 * поддержания со старта L1 не может дать самостоятельный ответ, и её провал был
 * бы назначен заранее.
 */
const MEASURING_KINDS: ReadonlySet<AbaTrial['kind']> = new Set(['baseline', 'generalization', 'maintenance']);

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
  if (MEASURING_KINDS.has(t.kind) && t.startPromptLevel !== 0) {
    errors.push('измерительная проба начата с подсказки');
  }
  if (t.startPromptLevel >= APP_MAX_PROMPT && t.emittedBeforePrompt) {
    errors.push('попытка до подсказки при старте с полной модели');
  }
  return errors;
}
