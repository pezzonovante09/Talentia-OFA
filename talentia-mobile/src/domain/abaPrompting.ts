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
  CHAIN_STEP_RESPONSE_WINDOW_MS,
  DELAY_STEP_MS,
  MAX_DELAY_MS,
  MAX_ESCALATIONS_PER_TRIAL,
  PROMPT_DEPENDENCE,
  RESPONSE_WINDOW_MS,
  ROUTINE_DEPENDENCE,
  type AbaResponse,
  type AbaFormat,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
  type PromptLevel,
  type StepPromptState,
} from '../types/aba';
import { LATENCY_SOURCE } from './abaScoring';
import { pick, seeded } from './abaRandom';

/** Сколько подряд проб нужно, чтобы стартовый уровень сдвинулся. */
export const FADE_AFTER = 2;

/**
 * Провалов подряд, после которых старт поднимается сразу до уровня, несущего ответ
 * (`FIRST_ANSWER_LEVEL`), а не на одну ступень: две ошибки подряд значат, что ребёнок
 * угадывает. Но не сразу на полную модель — у почти освоившего ребёнка одна неудачная пара
 * проб обнуляла бы сессию и серию критерия (решение владельца 2026-10-01 по аудиту,
 * `aba-pedagogy-specialist`).
 */
export const FAILURES_TO_RAISE = 2;

/**
 * Шаг прогрессивной задержки вверх — только если в блоке хотя бы столько обучающих проб со
 * старта L0: иначе одна удачная L0-проба двигала бы задержку (ABA.md, «Протокол
 * взрослого», блок 5).
 */
export const MIN_L0_TRIALS_FOR_DELAY_STEP = 3;

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
    currentDelayMs: s.currentDelayMs,
    startPromptLevel: s.startPromptLevel,
    consecutiveIndependentAtStart: s.consecutiveIndependentAtStart,
    consecutiveAboveStart: s.consecutiveAboveStart,
    consecutiveFailures: s.consecutiveFailures,
    consecutiveObservingFailures: s.consecutiveObservingFailures,
    lastSuccessfulPromptLevel: s.lastSuccessfulPromptLevel,
  };
  if (!stepId) return own;
  return (
    s.stepPrompts?.[stepId] ?? {
      ...own,
      consecutiveIndependentAtStart: 0,
      consecutiveAboveStart: 0,
      consecutiveFailures: 0,
      consecutiveObservingFailures: undefined,
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
  /** L2 «верный и один дистрактор» ответа не несёт — коррекция с L3 (методист, 2026-10-02). */
  match: 3,
  say: 2,
};

/**
 * Лестница подсказок цели (ABA.md, «Подсказки», «Лестница подражания»; `aba-pedagogy-specialist`
 * 2026-10-02). Решает содержание SD, а не название формата.
 *
 * - `standard` — SD словесный или картинка, модель — подсказка: L0 → L1 → L2 → L3.
 * - `imitative` — SD **и есть модель** (эхоика, подражание движениям, «скажи как Tali»): частичная
 *   модель даёт меньше, чем SD, поэтому L2 нет; L3 — **усиленная** модель (медленнее, с
 *   выделением, по слогам или фазам), дно приложения; дальше — только взрослый (L4). Без этого
 *   «полная модель» совпадала с L0, и проба повтора SD писалась подсказанной.
 */
export type PromptLadder = 'standard' | 'imitative' | 'two_choice';

/**
 * `two_choice` — выбор из двух (`match` с полем 2, сортировка): L2 «оставить два» ничего не
 * убирает, поэтому L2 нет, а коррекция и подъём — по `FIRST_ANSWER_LEVEL` (у `match` — L3).
 */
export function promptLadder(t: Pick<AbaTarget, 'format' | 'sdKind' | 'fieldSize' | 'matchMode'>): PromptLadder {
  if (t.format === 'imitate_sound' || t.format === 'repeat_word' || t.sdKind === 'imitation') return 'imitative';
  if (t.format === 'match' && (t.fieldSize === 2 || t.matchMode === 'sort')) return 'two_choice';
  return 'standard';
}

const LADDER_LEVELS: Record<PromptLadder, readonly PromptLevel[]> = {
  standard: [0, 1, 2, 3],
  imitative: [0, 1, 3],
  two_choice: [0, 1, 3],
};

/** Следующий уровень лестницы вверх, не выше того, что выдаёт приложение. */
export function ladderUp(level: PromptLevel, ladder: PromptLadder): PromptLevel {
  return LADDER_LEVELS[ladder].find((l) => l > level) ?? APP_MAX_PROMPT;
}

/** Следующий уровень лестницы вниз; L0 остаётся L0. */
export function ladderDown(level: PromptLevel, ladder: PromptLadder): PromptLevel {
  return [...LADDER_LEVELS[ladder]].reverse().find((l) => l < level) ?? 0;
}

/**
 * Уровень, с которого коррекция и возврат в обучение несут ответ. У лестницы подражания ответ
 * несёт уже L0, на котором ребёнок и ошибся, — поэтому коррекция идёт на усиленной модели L3.
 */
export function answerLevel(target: Pick<AbaTarget, 'format' | 'sdKind' | 'fieldSize' | 'matchMode'>): PromptLevel {
  return promptLadder(target) === 'imitative' ? APP_MAX_PROMPT : FIRST_ANSWER_LEVEL[target.format];
}

/**
 * Уровень пробы коррекции — не ниже того, что ребёнку только что понадобилось, плюс
 * ступень, и никогда не L0: коррекция на L0 — то самое «неверно, попробуй ещё». Не
 * ниже последнего успешного уровня, а после неверного ответа — не ниже первого уровня,
 * несущего ответ (`FIRST_ANSWER_LEVEL`). Сама проба коррекции доводится до верного
 * ответа при любом провале: до полной модели, со взрослым — до L4.
 *
 * `null` — ребёнок не ответил даже на полной модели: модель только что прозвучала и
 * реакции не вызвала. Если L4 разрешена, коррекция — одна полная модель, которую взрослый
 * сразу выполняет вместе с ребёнком (старт 4); иначе шаг пропускается — дальше
 * отвлекающая проба и перенос.
 */
export function correctionLevel(
  s: AbaTargetState,
  failed: AbaTrial,
  target: Pick<AbaTarget, 'format' | 'sdKind' | 'fieldSize' | 'matchMode'>,
): PromptLevel | null {
  if (failed.response === 'no_response' && failed.promptLevelUsed >= APP_MAX_PROMPT) return null;
  // Лестница подражания: коррекция — на усиленной модели; провал и на ней — к взрослому (L4).
  if (promptLadder(target) === 'imitative') return failed.promptLevelUsed >= APP_MAX_PROMPT ? null : APP_MAX_PROMPT;
  const ps = promptStateOf(s, failed.stepId);
  const floor = failed.response === 'incorrect' ? FIRST_ANSWER_LEVEL[target.format] : 1;
  const level = Math.max(floor, ps.lastSuccessfulPromptLevel, failed.promptLevelUsed + 1);
  // уровень — из лестницы цели (№163): у выбора из двух L2 нет, коррекция с L2 уронила бы `promptVisualFor`
  const onLadder = LADDER_LEVELS[promptLadder(target)].find((l) => l >= level) ?? APP_MAX_PROMPT;
  return clampToApp(Math.min(onLadder, APP_MAX_PROMPT) as PromptLevel);
}

/**
 * Окно ответа пробы: после каждого предъявления, включая полную модель, — сколько ждать
 * начала реакции. У звена цепочки — своё (`AbaChainStep.responseWindowMs` или
 * `CHAIN_STEP_RESPONSE_WINDOW_MS`).
 */
export function responseWindowMs(target: AbaTarget, stepId?: string): number {
  if (stepId) {
    return target.steps?.find((x) => x.id === stepId)?.responseWindowMs ?? CHAIN_STEP_RESPONSE_WINDOW_MS;
  }
  return RESPONSE_WINDOW_MS[target.format][target.band];
}

/** Пробы, где на старте L0 есть задержка до первой подсказки: обучение и перенос. */
const DELAYED_PROMPT_KINDS: ReadonlySet<AbaTrial['kind']> = new Set(['teaching', 'transfer']);

/**
 * Задержка до первой подсказки (D1, ABA.md «Протокол взрослого», блок 2). Есть только при
 * старте L0 в обучающих пробах и пробах переноса. Прогрессивная — `currentDelayMs` цели
 * или звена цепочки (у звена своя); постоянная — всегда `delayMs` цели с потолком по
 * полосе, её не сдвигает ничто. Не больше окна ответа. Иначе `null`:
 * при старте L1+ подсказка идёт вместе с SD, а измерительные пробы, разогрев и закрывающая
 * ждут полное окно.
 *
 * Прежде одно поле значило и задержку, и окно: на базовой линии, переносе и поддержании
 * ребёнку давалась 1 с на ответ (прогрессивная задержка на старте) — ложный ноль на базовой
 * линии, известный навык учился с полной модели.
 */
export function promptDelayMs(
  s: AbaTargetState,
  target: AbaTarget,
  kind: AbaTrial['kind'],
  start: PromptLevel,
  windowMs: number,
  stepId?: string,
): number | null {
  if (start !== 0 || !DELAYED_PROMPT_KINDS.has(kind)) return null;
  const delay =
    target.delayMode === 'constant'
      ? Math.min(target.delayMs, MAX_DELAY_MS[target.band])
      : promptStateOf(s, stepId).currentDelayMs;
  return Math.min(delay, windowMs);
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
export function nextEscalation(
  trial: Pick<AbaTrial, 'kind'>,
  level: PromptLevel,
  presentations: number,
  ladder: PromptLadder = 'standard',
): EscalationStep {
  if (trial.kind === 'generalization' || trial.kind === 'baseline') return { kind: 'close' };
  if (level >= APP_MAX_PROMPT || presentations > MAX_ESCALATIONS_PER_TRIAL) return { kind: 'close' };
  const next = presentations === MAX_ESCALATIONS_PER_TRIAL ? APP_MAX_PROMPT : ladderUp(level, ladder);
  return { kind: 'present', level: next };
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
 * Два провала подряд (`FAILURES_TO_RAISE`) — старт сразу до уровня, несущего ответ
 * (не ниже), но не обязательно до полной модели.
 *
 * «Дождался подсказки» (`waited`) старт не поднимает (блок 14 аудита): иначе две такие
 * пробы поднимали старт до L1, две верных на L1 опускали обратно, и прогрессивная задержка
 * не работала. При возврате старта с L1 на L0 задержка на шаг короче: ребёнок не встречает
 * самую длинную паузу сразу после возврата.
 */
export function applyTrialToFading(s: AbaTargetState, t: AbaTrial, target: AbaTarget): AbaTargetState {
  // подсказка взрослого вне процедуры — ошибка процедуры, а не данные о ребёнке
  if (t.response === 'interrupted' || t.adultUnplannedPrompt) return s;
  if (t.kind !== 'teaching' && t.kind !== 'transfer') return s;
  const before = promptStateOf(s, t.stepId);
  const ladder = promptLadder(target);
  // Подъём после двух провалов — «на ступень, но не ниже уровня, несущего ответ» (№12); у
  // лестницы подражания ответ несёт и L1 (повтор того же SD), поэтому пол — L1.
  const after = fadeStep(before, t, ladder === 'imitative' ? 1 : FIRST_ANSWER_LEVEL[target.format], ladder);
  // возврат на L0 укорачивает задержку того, у кого старт перешёл: цели или звена;
  // постоянную задержку не сдвигает ничто
  const back = target.delayMode === 'progressive' && before.startPromptLevel === 1 && after.startPromptLevel === 0;
  return withPromptState(
    s,
    t.stepId,
    back ? { ...after, currentDelayMs: Math.max(DELAY_STEP_MS, after.currentDelayMs - DELAY_STEP_MS) } : after,
  );
}

/**
 * Класс пробы для затухания (ABA.md, «Протокол взрослого», блок 5):
 * - `at_start` — успех на стартовом уровне;
 * - `waited` — **только со старта L0**: ребёнок не пробовал до подсказки, дождался первой
 *   (L1) и ответил. В процедуре временной задержки это ожидаемый путь, а не признак
 *   слишком низкого старта: старт L1 — задержка 0 с, старт L0 — задержка d;
 * - `above` — провал или успех, которому понадобилось больше старта, кроме `waited`;
 * - `approximation` — рвёт обе серии.
 */
export type FadeClass = 'at_start' | 'waited' | 'above' | 'approximation';

export function fadeClass(t: AbaTrial): FadeClass {
  if (t.response === 'approximation') return 'approximation';
  if (FAILURE.has(t.response)) return 'above';
  // L1 наблюдения `match` (образца не коснулись) — не «дождался подсказки» выбора (№163)
  if (t.startPromptLevel === 0 && t.response === 'prompted' && t.promptLevelUsed === 1 && !t.emittedBeforePrompt && !t.observingPrompted) {
    return 'waited';
  }
  return t.promptLevelUsed > t.startPromptLevel ? 'above' : 'at_start';
}

/**
 * Провал наблюдения `match`: образца так и не коснулись — с любого старта (методист 2026-10-29): на старте L1 пульс
 * над образцом идёт вместе с SD, и непройденное наблюдение то же. Строго `null`: у других форматов поля нет.
 */
const observingMiss = (t: AbaTrial) => t.observingLatencyMs === null && FAILURE.has(t.response);

function fadeStep(ps: StepPromptState, t: AbaTrial, answerFloor: PromptLevel, ladder: PromptLadder): StepPromptState {
  const succeeded = SUCCESS.has(t.response);
  const lastSuccessfulPromptLevel = succeeded ? clampToApp(t.promptLevelUsed) : ps.lastSuccessfulPromptLevel;
  const failures = FAILURE.has(t.response) ? ps.consecutiveFailures + 1 : 0;
  const observing = observingMiss(t) ? (ps.consecutiveObservingFailures ?? 0) + 1 : 0;
  const base = { ...ps, lastSuccessfulPromptLevel, consecutiveFailures: failures, consecutiveObservingFailures: observing || undefined };

  if (failures >= FAILURES_TO_RAISE) {
    // вся серия — провалы наблюдения (№165): ребёнок не смотрел на образец, а не ошибался в выборе — старт
    // не выше L1 (метка над образцом сразу; L1 и выше остаются), уровень, несущий ответ, растил бы зависимость
    const level = observing >= failures ? Math.max(ps.startPromptLevel, 1) : Math.max(ladderUp(ps.startPromptLevel, ladder), answerFloor);
    return {
      ...base,
      startPromptLevel: level as PromptLevel,
      consecutiveIndependentAtStart: 0,
      consecutiveAboveStart: 0,
      consecutiveFailures: 0,
      consecutiveObservingFailures: undefined,
    };
  }
  const cls = fadeClass(t);
  if (cls === 'approximation') {
    return { ...base, consecutiveIndependentAtStart: 0, consecutiveAboveStart: 0 };
  }
  // Дождался подсказки: нейтрально — серия подъёма рвётся, серия спуска не трогается.
  if (cls === 'waited') return { ...base, consecutiveAboveStart: 0 };

  const above = cls === 'above';
  if (t.kind === 'transfer' && !above) return { ...base, consecutiveAboveStart: 0 };

  const independentRun = above ? 0 : ps.consecutiveIndependentAtStart + 1;
  const aboveRun = above ? ps.consecutiveAboveStart + 1 : 0;

  if (independentRun >= FADE_AFTER && ps.startPromptLevel > 0) {
    return {
      ...base,
      startPromptLevel: ladderDown(ps.startPromptLevel, ladder),
      consecutiveIndependentAtStart: 0,
      consecutiveAboveStart: 0,
    };
  }
  if (aboveRun >= FADE_AFTER && ps.startPromptLevel < APP_MAX_PROMPT) {
    return {
      ...base,
      startPromptLevel: ladderUp(ps.startPromptLevel, ladder),
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
 *
 * «Дождался подсказки» — чистая проба: ошибки до подсказки не было. Шаг вверх — только
 * при `MIN_L0_TRIALS_FOR_DELAY_STEP` таких пробах в блоке. Ребёнок, который всегда ждёт,
 * дорастит задержку до потолка — его ловит флаг `prompt_dependent`.
 *
 * У цепочки — по каждому звену отдельно: «подряд» — в пробах этого звена, порог — в его
 * пробах (одна на прогон), потолок — у каждого звена.
 */
export function applyBlockToDelay(s: AbaTargetState, target: AbaTarget, block: AbaTrial[]): AbaTargetState {
  if (target.delayMode !== 'progressive') return s;
  const trials = block.filter(
    (t) => t.kind === 'teaching' && t.startPromptLevel === 0 && t.response !== 'interrupted' && !t.adultUnplannedPrompt && !t.observingPrompted,
  );
  const byStep = new Map<string, AbaTrial[]>();
  for (const t of trials) byStep.set(t.stepId ?? '', [...(byStep.get(t.stepId ?? '') ?? []), t]);

  let next = s;
  for (const [key, own] of byStep) {
    const stepId = key || undefined;
    const ps = promptStateOf(next, stepId);
    const twoInRow = own.some((t, i) => i > 0 && erredBeforePrompt(t) && erredBeforePrompt(own[i - 1]));
    let delay = ps.currentDelayMs;
    if (twoInRow) delay = Math.max(DELAY_STEP_MS, delay - DELAY_STEP_MS);
    else if (!own.some(erredBeforePrompt) && own.length >= MIN_L0_TRIALS_FOR_DELAY_STEP) {
      delay = Math.min(MAX_DELAY_MS[target.band], delay + DELAY_STEP_MS);
    }
    if (delay !== ps.currentDelayMs) next = withPromptState(next, stepId, { ...ps, currentDelayMs: delay });
  }
  return next;
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
  const trials = dependenceTrials(s, sessions);
  if (!trials) return false;
  if (trials.filter((t) => t.response === 'prompted').length < PROMPT_DEPENDENCE.minSilentEvidence) return false;
  return dependenceRates(trials);
}

/**
 * Пробы окна детектора: последние `overSessions` сессий после флага, только обучающие со старта L0
 * (на подсказанном старте самостоятельный ответ невозможен по построению, и доли выполнялись бы
 * сами собой). `null` — окно ещё не набралось.
 */
function dependenceTrials(s: AbaTargetState, sessions: SessionTrials[]): AbaTrial[] | null {
  const fresh = sessions.filter(
    (x) => s.dependenceFlaggedAtSession === null || x.index > s.dependenceFlaggedAtSession,
  );
  const window = fresh.slice(-PROMPT_DEPENDENCE.overSessions);
  if (window.length < PROMPT_DEPENDENCE.overSessions) return null;
  return (
    window
      .flatMap((x) => x.trials)
      // перенос не в счёт: выборка условная (только после ошибки) — решение методиста 2026-10-01;
      // подсказка взрослого вне процедуры — не данные о ребёнке
      .filter(
        (t) => t.kind === 'teaching' && t.startPromptLevel === 0 && t.response !== 'interrupted' && !t.adultUnplannedPrompt && !t.observingPrompted,
      )
  );
}

/** Три условия детектора по пробам со старта L0 (без порога числа проб). */
function dependenceRates(trials: AbaTrial[]): boolean {
  const promptedTrials = trials.filter((t) => t.response === 'prompted');
  if (trials.length === 0 || promptedTrials.length === 0) return false;
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
 * Реакция на зависимость: задержка на шаг длиннее (не выше потолка; постоянная не
 * меняется) и старт с L0 на следующую сессию — у цели и только у тех звеньев, где зависимость
 * видна: у звена есть пробы со старта L0, и по ним выполнены те же три условия, что у детектора.
 * Звенья на L2/L3, ещё не освоенные, остаются как были: сброс в L0 откатил бы обучение, а не
 * зависимость. `sessions` — те же, что получил `isPromptDependent` (флаг у `s` ещё прежний).
 * Флаг видит специалист, не ребёнок.
 */
export function applyPromptDependence(
  s: AbaTargetState,
  target: AbaTarget,
  sessionIndex: number,
  sessions: SessionTrials[],
): AbaTargetState {
  const longer = (ms: number) =>
    target.delayMode === 'progressive' ? Math.min(MAX_DELAY_MS[target.band], ms + DELAY_STEP_MS) : ms;
  const window = dependenceTrials(s, sessions) ?? [];
  const dependentStep = (id: string) => dependenceRates(window.filter((t) => t.stepId === id));
  return {
    ...s,
    flags: s.flags.includes('prompt_dependent') ? s.flags : [...s.flags, 'prompt_dependent'],
    currentDelayMs: longer(s.currentDelayMs),
    startPromptLevel: 0,
    consecutiveIndependentAtStart: 0,
    consecutiveAboveStart: 0,
    consecutiveFailures: 0,
    consecutiveObservingFailures: undefined,
    ...(s.stepPrompts
      ? {
          stepPrompts: Object.fromEntries(
            Object.entries(s.stepPrompts).map(([id, ps]) => [
              id,
              dependentStep(id)
                ? {
                    ...ps,
                    currentDelayMs: longer(ps.currentDelayMs),
                    startPromptLevel: 0 as PromptLevel,
                    consecutiveIndependentAtStart: 0,
                    consecutiveAboveStart: 0,
                    consecutiveFailures: 0,
                  }
                : ps,
            ]),
          ),
        }
      : {}),
    dependenceFlaggedAtSession: sessionIndex,
  };
}

/**
 * Детектор зависимости у рутины — по звену (раунд 4, В8; методист 2026-10-19, переспросить):
 * окно — последние `ROUTINE_DEPENDENCE.windowRuns` прогонов обучения после флага (`runs` — только
 * записанные и не прерванные, `routineHistoryOf` плюс этот прогон; `index` — `runNo`). Звено
 * зависимо, если в окне у него не меньше `minPromptedPerStep` подсказанных проб со старта L0 и
 * выполнены доли детектора (`dependenceRates`). Меньше прогонов — судить не по чему, `[]`.
 * Общий детектор по всем звеньям сразу у рутины не годится: одно звено с подсказками тонуло в
 * самостоятельных остальных.
 */
export function routineDependentSteps(s: AbaTargetState, runs: readonly SessionTrials[], stepIds: readonly string[]): string[] {
  const fresh = runs.filter((x) => s.dependenceFlaggedAtSession === null || x.index > s.dependenceFlaggedAtSession);
  const window = fresh.slice(-ROUTINE_DEPENDENCE.windowRuns);
  if (window.length < ROUTINE_DEPENDENCE.windowRuns) return [];
  const trials = window
    .flatMap((x) => x.trials)
    .filter((t) => t.kind === 'teaching' && t.startPromptLevel === 0 && t.response !== 'interrupted' && !t.adultUnplannedPrompt);
  return stepIds.filter((id) => {
    const own = trials.filter((t) => t.stepId === id);
    return own.filter((t) => t.response === 'prompted').length >= ROUTINE_DEPENDENCE.minPromptedPerStep && dependenceRates(own);
  });
}

/**
 * Реакция на зависимость у рутины — **только флаг** (раунд 4, В2; методист 2026-10-19, переспросить):
 * уровни, задержка и счётчики звеньев не трогаются — сброс в L0 откатывал подъём уровня, которого
 * рутина достигла затуханием. Звенья — специалисту (`dependentStepIds`); окно детектора начинается
 * заново после `runNo`.
 */
export function applyRoutineDependence(s: AbaTargetState, runNo: number, stepIds: readonly string[]): AbaTargetState {
  return {
    ...s,
    flags: s.flags.includes('prompt_dependent') ? s.flags : [...s.flags, 'prompt_dependent'],
    dependentStepIds: [...stepIds],
    dependenceFlaggedAtSession: runNo,
  };
}

/**
 * Снятие `prompt_dependent` освоением (раунд 4, В3; методист 2026-10-19, переспросить): цель вошла в
 * освоенную фазу любым путём (критерий, базовая линия, пройденная проверка) — зависимости нет. По
 * «чистому» окну флаг не снимается. `dependenceFlaggedAtSession` остаётся: на нём держится окно
 * детектора и гард устаревшей записи; когда снят — `dependenceClearedAt` (сессия или `runNo`).
 */
export function clearDependenceOnMastery(
  fromPhase: AbaTargetState['phase'],
  s: AbaTargetState,
  at: number,
): AbaTargetState {
  const mastered = (p: AbaTargetState['phase']) => p === 'mastered' || p === 'maintenance';
  if (mastered(fromPhase) || !mastered(s.phase) || !s.flags.includes('prompt_dependent')) return s;
  const { dependentStepIds: _d, ...rest } = s;
  return { ...rest, flags: s.flags.filter((f) => f !== 'prompt_dependent'), dependenceClearedAt: at };
}

/**
 * Пробы, которые измеряют, а не учат: начинаются всегда без подсказки. Проба
 * поддержания со старта L1 не может дать самостоятельный ответ, и её провал был
 * бы назначен заранее.
 */
const MEASURING_KINDS: ReadonlySet<AbaTrial['kind']> = new Set(['baseline', 'generalization', 'maintenance', 'verification']);

/** Противоречие внутри записи пробы. Непустой список — запись нельзя писать в лог. */
export function trialInvariantErrors(t: AbaTrial): string[] {
  const errors: string[] = [];
  if (t.response === 'independent' && t.promptLevelUsed !== 0) {
    errors.push('самостоятельный ответ после подсказки');
  }
  if (t.response === 'prompted' && t.promptLevelUsed === 0) errors.push('подсказанный ответ без подсказки');
  // старт с помощи взрослого, L4 не дана («Пропустить», «Сопротивляется», отказ) — уровень 3
  const l4NotGiven =
    t.startPromptLevel === 4 && t.promptLevelUsed === APP_MAX_PROMPT && (t.response === 'no_response' || t.response === 'interrupted');
  if (t.promptLevelUsed < t.startPromptLevel && !l4NotGiven) errors.push('понадобилось меньше, чем стартовый уровень');
  if (t.presentations > MAX_ESCALATIONS_PER_TRIAL + 1) errors.push('больше трёх предъявлений одного SD');
  if (t.response === 'independent' && !t.emittedBeforePrompt) {
    errors.push('самостоятельный ответ без попытки до подсказки');
  }
  if (MEASURING_KINDS.has(t.kind) && t.startPromptLevel !== 0) {
    errors.push('измерительная проба начата с подсказки');
  }
  // D3: при старте L1+ подсказка идёт вместе с SD — окна «до подсказки» нет
  if (t.startPromptLevel >= 1 && t.emittedBeforePrompt) {
    errors.push('попытка до подсказки при старте с подсказки');
  }
  // в дискретной пробе неверный ответ закрывает пробу — подсказанного после попытки не бывает
  if ((t.kind === 'teaching' || t.kind === 'transfer') && !t.stepId && t.response === 'prompted' && t.emittedBeforePrompt) {
    errors.push('подсказанный ответ после попытки в дискретной пробе');
  }
  if (t.adultUnplannedPrompt && t.response === 'independent') errors.push('самостоятельный ответ после подсказки взрослого');
  if ((t.latencyMs === null) !== (t.latencySource === null)) errors.push('латентность без источника или источник без латентности');
  if (t.latencyMs === null && t.latencyFromFirstSdMs !== null) errors.push('время от первого SD без латентности');
  if (t.latencyMs !== null && (t.latencyFromFirstSdMs === null || t.latencyFromFirstSdMs < t.latencyMs)) {
    errors.push('время от первого SD меньше латентности');
  }
  if (t.response === 'independent' && t.latencyFromFirstSdMs !== t.latencyMs) {
    errors.push('у самостоятельного ответа время от первого SD отличается от латентности');
  }
  if (t.response === 'no_response' && t.latencyMs !== null) errors.push('латентность у отсутствия ответа');
  const delayed = (t.kind === 'teaching' || t.kind === 'transfer') && t.startPromptLevel === 0;
  if (delayed !== (t.promptDelayMs !== null)) {
    errors.push('задержка до подсказки — только и всегда при старте L0 в обучении и переносе');
  }
  if (t.response === 'independent' && t.latencyMs !== null && t.latencyMs > (t.promptDelayMs ?? t.responseWindowMs)) {
    errors.push('самостоятельный ответ позже первой подсказки');
  }
  // подсказка взрослого вне процедуры приходит, когда пришла, а не по задержке (№163)
  if (
    t.response === 'prompted' &&
    !t.adultUnplannedPrompt &&
    t.promptLevelUsed > t.startPromptLevel &&
    t.latencyMs !== null &&
    t.latencyFromFirstSdMs !== null &&
    t.latencyFromFirstSdMs < (t.promptDelayMs ?? 0) + t.latencyMs
  ) {
    errors.push('подсказанный ответ раньше, чем закончилась задержка');
  }
  if (t.latencySource !== null && t.latencySource !== LATENCY_SOURCE[t.scoredBy]) errors.push('источник латентности не тот, что оценивает');
  if (t.promptDelayMs !== null && t.promptDelayMs > t.responseWindowMs) errors.push('задержка до подсказки длиннее окна ответа');
  if (t.responseWindowMs <= 0) errors.push('нет окна ответа');
  return errors;
}

// ---------------------------------------------------------------------------
// Что видно на экране выбора на каждом уровне подсказки
// ---------------------------------------------------------------------------

/** Проба выбора: какие карточки на экране, какая верная; образец `match` или предмет сортировки. */
export type PromptChoiceTrial = {
  correctId: string;
  /** Карточки выбора в порядке показа — позиции не меняются ни на каком уровне. */
  choiceIds: readonly string[];
  sampleId?: string;
  itemId?: string;
};

/**
 * Подсказка на экране выбора. `activeChoiceIds` принимают нажатие; остальные **приглушены**, не
 * скрыты (позиции не меняются: перестройка сетки — сама подсказка местом) и не доступны
 * экранному чтецу. Степень приглушения и вид метки — токены `design-lead` (`design/abaTokens.ts`).
 */
export type PromptVisualPlan = {
  focus: { on: 'sample' | 'item' | 'choice'; id: string; pulse: boolean } | null;
  activeChoiceIds: readonly string[];
  /** Выделить верную карточку — только у `identify`, где жест L1 и несёт ответ. */
  highlightCorrect: boolean;
  /** L4: экран как на L3, в панели взрослого — «мягко направь руку, прекрати при сопротивлении». */
  adultPhysical: boolean;
  /**
   * Одна плита (эхоика, подражание, действие, громкость; Г5): метка над плитой — открытый шеврон на
   * L1, сплошной треугольник и контур 6 на L2–L4 (L2 выглядит как L3, его отличает звук или
   * анимация модели и панель взрослого). `null` — меток нет (L0 и форматы с экраном выбора).
   * Вид метки — токен `promptVisual.single` (`design/abaTokens.ts`).
   */
  plateMark: 'chevron_open' | 'triangle_solid' | null;
};

/**
 * Подсказка по формату (раунд 2, Р5, `aba-pedagogy-specialist` 2026-10-11). В `match` и сортировке
 * L1–L2 ответа не раскрывают (`FIRST_ANSWER_LEVEL.match` = 3): L1 — метка и пульс над образцом
 * (над предметом у сортировки), активны все; L2 — активны верный и один случайный дистрактор,
 * верный не выделен (у выбора из двух L2 нет); L3 — активен только верный. У `identify` жест к
 * карточке и есть ответ — она выделена с L1. Дистрактор L2 тянется из `seed` пробы: при
 * восстановлении сессии он тот же, новая проба тянет заново. Форматы без экрана выбора
 * (речь, действие) — одна плита с меткой над ней (`plateMark`, Г5): шеврон на L1, треугольник
 * на L2–L4; сама подсказка — модель звуком или движением, не экран.
 */
export function promptVisualFor(
  target: Pick<AbaTarget, 'format' | 'sdKind' | 'fieldSize' | 'matchMode'>,
  level: PromptLevel,
  trial: PromptChoiceTrial,
  seed: number,
): PromptVisualPlan {
  const all = trial.choiceIds;
  const adultPhysical = level === 4;
  const shown = Math.min(level, APP_MAX_PROMPT);
  const plan = (p: Partial<PromptVisualPlan>): PromptVisualPlan => ({
    focus: null,
    activeChoiceIds: all,
    highlightCorrect: false,
    adultPhysical,
    plateMark: null,
    ...p,
  });
  if (shown === 0) return plan({});
  if (target.format === 'identify') {
    return plan({
      focus: { on: 'choice', id: trial.correctId, pulse: false },
      activeChoiceIds: shown === 3 ? [trial.correctId] : all,
      highlightCorrect: true,
    });
  }
  if (target.format !== 'match') {
    // одна плита: у эхоики и подражания лестница L0 → L1 → L3, уровня 2 нет (ABA.md); у действия
    // и громкости L2 на экране как L3
    if (shown === 2 && promptLadder(target) === 'imitative') throw new Error('у эхоики и подражания уровня L2 нет');
    return plan({ plateMark: shown === 1 ? 'chevron_open' : 'triangle_solid' });
  }
  if (shown === 1) {
    const sort = target.matchMode === 'sort';
    const id = sort ? trial.itemId : trial.sampleId;
    if (!id) throw new Error(sort ? 'у пробы сортировки нет предмета' : 'у пробы match нет образца');
    return plan({ focus: { on: sort ? 'item' : 'sample', id, pulse: true } });
  }
  // подсказки накапливаются (№163, проверка 2026-10-27): метка и пульс над образцом держатся на L2–L3 тоже, пока
  // образца не коснулись (снимает экран) — иначе ребёнку, которому нужна именно реакция наблюдения, её убирали бы
  const sampleFocus = target.matchMode === 'sort' || !trial.sampleId ? null : { on: 'sample' as const, id: trial.sampleId, pulse: true };
  if (shown === 2) {
    if (promptLadder(target) === 'two_choice') throw new Error('у выбора из двух уровня L2 нет: «оставить два» ничего не убирает');
    const distractor = pick(
      all.filter((id) => id !== trial.correctId),
      seeded(seed).rng,
    );
    return plan({ focus: sampleFocus, activeChoiceIds: all.filter((id) => id === trial.correctId || id === distractor) });
  }
  return plan({ focus: sampleFocus, activeChoiceIds: [trial.correctId] });
}
