/**
 * **ЧЕРНОВИК, без тестов — не использовать.** Методист нашёл критичные дефекты: уровень
 * пробы коррекции, конфигурация «сам», жетоны не за результат. Переделать по `ABA.md`,
 * раздел «Разбор оркестратора сессии», — REBUILD.md, «Ближайшие работы», пункт 2.
 *
 * Ход ABA-сессии. Спецификация — «Единица работы», «Исправление ошибки»,
 * «Генерализация» и «Поддержание» в `ABA.md`.
 *
 * Здесь порядок, а не правила отдельной пробы: правила уже лежат в
 * `abaPrompting` (подсказки, затухание, остановка), `abaCriterion` (критерий,
 * поддержание) и `abaTokens` (жетоны). Сессия их связывает.
 *
 * Экран работает с сессией тремя вызовами: `nextStep` — что показать, `recordTrial`
 * — чем кончилась проба, `finishAbaSession` — итог. Состояние — обычный объект: его
 * можно сохранить посреди сессии и продолжить после сворачивания приложения.
 *
 * Порядок всегда один (предсказуемость структуры сама снижает проблемное поведение):
 * выбор подкрепителя → разогрев → блок A → перерыв → блок B → перенос и поддержание →
 * завершение на успешной пробе.
 */
import {
  APP_MAX_PROMPT,
  COUNTS_TOWARD_MASTERY,
  MAINTENANCE_GAP,
  MASTERY,
  TOKEN_BOARD_SIZE,
  type AbaConfig,
  type AbaExemplar,
  type AbaResponse,
  type AbaSession,
  type AbaSessionEndReason,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
  type AbaTrialKind,
  type PromptLevel,
  type ScoringSource,
} from '../types/aba';
import type { AgeBand } from '../types/task';
import {
  applyBlockToDelay,
  applyPromptDependence,
  applyTrialToFading,
  clampToApp,
  effectiveDelayMs,
  initialTargetState,
  isBreakdown,
  isPromptDependent,
  trialInvariantErrors,
  type SessionTrials,
} from './abaPrompting';
import {
  applyGeneralizationProbe,
  applyMaintenanceProbe,
  applySession,
  isMaintenanceDue,
  isMasteryMet,
  markMastered,
  needsGeneralizationProbe,
  summarizeSession,
} from './abaCriterion';
import {
  addTokens,
  awardForTrial,
  isBoardFull,
  newSchedule,
  PARTICIPATION_AWARD,
  reinforcerChoices,
  tryExchange,
  type Rng,
  type TokenAward,
  type TokenBoard,
  type TokenSchedule,
} from './abaTokens';

// ---------------------------------------------------------------------------
// Константы сессии
// ---------------------------------------------------------------------------

/** Проб разогрева: сессия начинается с успеха. */
export const WARMUP_TRIALS = 2;

/** Обучаемых целей за сессию — не больше. */
export const MAX_TEACHING_TARGETS = 2;

/** Проб переноса и поддержания в конце сессии вместе. Переноса — не больше одной. */
export const MAX_PROBES = 2;

/**
 * Проб в блоке на полосе 5–6 — пять, даже если у цели `blockSize: 10`. Сессия 5–6 —
 * 12–14 проб: 2 разогрева + 5 + 5 + 1–2 пробы в конце. Два блока по десять дали бы 24,
 * втрое дольше, чем держит внимание пятилетки. Пять сохраняет целую пробу в 80%.
 */
export function blockTrials(target: AbaTarget, band: AgeBand): number {
  return band === '5-6' ? 5 : target.blockSize;
}

/**
 * Прогонов цепочки в блоке. Минимум для зачёта сессии у цепочки — в прогонах, и блок
 * ровно его и даёт: пять полных «помыть руки» в сессию не помещаются.
 */
export const CHAIN_RUNS_PER_BLOCK = MASTERY.minChainRunsPerSession;

/**
 * Жёсткий лимит времени. Запланированная сессия — около 8 минут на полосе 5–6 и 12
 * дальше; коррекции добавляют по три пробы на ошибку, поэтому лимит с запасом. По
 * лимиту сессия не обрывается, а закрывается успешной пробой.
 */
export const SESSION_TIME_LIMIT_MS: Record<AgeBand, number> = {
  '5-6': 10 * 60_000,
  '7': 15 * 60_000,
  '8': 15 * 60_000,
  '9-10': 15 * 60_000,
};

/**
 * Проб закрытия подряд, после которых сессия кончается как есть. Завершать на неудаче
 * нельзя, но и бесконечно добиваться успеха от ребёнка, который сегодня не может, —
 * тоже: это тот же аверсивный сеанс.
 */
export const MAX_CLOSING_ATTEMPTS = 2;

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

/** Проба в плане сессии. Уровень подсказки определяется, когда до неё дошла очередь. */
export type PlannedTrial = {
  kind: AbaTrialKind;
  targetId: string;
  exemplarId: string;
  stepId?: string;
  sdVariantKey?: string;
  /** Уровень задан процедурой, а не стартовым уровнем цели: коррекция, закрытие. */
  fixedStart?: PromptLevel;
};

type QueueItem =
  | { kind: 'reinforcer' }
  | { kind: 'trial'; trial: PlannedTrial }
  /** Конец блока цели: жетон за участие. */
  | { kind: 'block_end'; targetId: string }
  | { kind: 'break' };

/** Что показать сейчас. */
export type AbaStep =
  | { kind: 'choose_reinforcer'; options: string[] }
  | {
      kind: 'trial';
      trialKind: AbaTrialKind;
      targetId: string;
      exemplarId: string;
      stepId?: string;
      sdVariantKey?: string;
      startPromptLevel: PromptLevel;
      /** Пауза после конца озвучки SD. */
      delayMs: number;
      /** Кто засчитывает. В конфигурации «сам» взрослого нет. */
      scoredBy: ScoringSource;
      /** Перенос и базовая линия измеряют: подсказки нет. */
      allowEscalation: boolean;
    }
  /** Перерыв по расписанию. Обмен — только при полной доске. */
  | { kind: 'break'; canExchange: boolean }
  | { kind: 'end'; reason: AbaSessionEndReason };

export type AbaSessionState = {
  sessionId: string;
  sessionIndex: number;
  config: AbaConfig;
  band: AgeBand;
  startedAt: number;
  targets: Record<string, AbaTarget>;
  states: Record<string, AbaTargetState>;
  /** Цели блоков A и B. */
  teachingTargetIds: string[];
  /** Освоенные цели, доступные для разогрева и отвлекающих проб. */
  highPTargetIds: string[];
  reinforcerOptions: string[];
  reinforcerId: string | null;
  queue: QueueItem[];
  trials: AbaTrial[];
  board: TokenBoard;
  tokensEarned: number;
  exchangesMade: number;
  schedule: TokenSchedule;
  highPTokenPaid: boolean;
  endReason: AbaSessionEndReason | null;
  /** Цель, на которой сработал критерий остановки: серию критерия рвёт только ей. */
  brokenTargetId: string | null;
  closingAttempts: number;
};

export type StartInput = {
  sessionId: string;
  sessionIndex: number;
  config: AbaConfig;
  band: AgeBand;
  /** Цели программ в порядке программы: обучаемые берутся первыми по этому порядку. */
  targets: readonly AbaTarget[];
  /** Состояния целей. Нет состояния — цель новая. */
  states: Readonly<Record<string, AbaTargetState>>;
  reinforcerPool: string[];
  /** Выборы прошлых сессий, свежие в конце. */
  reinforcerHistory: string[];
  /** Доска с прошлой сессии: жетоны не сгорают. */
  board?: TokenBoard;
  startedAt: number;
  rng: Rng;
};

// ---------------------------------------------------------------------------
// План
// ---------------------------------------------------------------------------

const MASTERED_PHASES = new Set(['mastered', 'maintenance']);
const TEACHING_PHASES = new Set(['acquisition', 'generalization_check']);
const MEASURING_KINDS: ReadonlySet<AbaTrialKind> = new Set(['baseline', 'generalization', 'maintenance']);
const SUCCESS: ReadonlySet<AbaResponse> = new Set(['independent', 'prompted', 'approximation']);

/**
 * Кто засчитывает пробу в этой конфигурации. «Со взрослым» — источник цели. «Сам» —
 * устройство: громкость для `voice_volume`, остальное — детектор начала звука, и
 * такие пробы пишутся тренировкой, критерий они не двигают (`COUNTS_TOWARD_MASTERY`).
 */
export function sessionScoring(target: AbaTarget, config: AbaConfig): ScoringSource {
  if (config === 'with_adult') return target.scoredBy;
  return target.format === 'voice_volume' ? 'device_loudness' : 'device_onset';
}

/** Проба этой цели в этой конфигурации может двигать критерий. */
function counts(target: AbaTarget, config: AbaConfig): boolean {
  return COUNTS_TOWARD_MASTERY[sessionScoring(target, config)];
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

const teachingExemplars = (t: AbaTarget): AbaExemplar[] => t.exemplars.filter((e) => e.role === 'teaching');

/**
 * Пробы блока. Обучающие экземпляры чередуются по кругу в случайном порядке:
 * критерий требует минимум двух разных, а один экземпляр подряд учит одной картинке.
 * `generalization` в обучении не используется никогда.
 */
function blockOf(target: AbaTarget, band: AgeBand, rng: Rng): PlannedTrial[] {
  const exemplars = shuffle(teachingExemplars(target), rng);
  if (exemplars.length === 0) return [];
  const at = (i: number) => exemplars[i % exemplars.length].id;

  if (target.steps?.length) {
    const steps = [...target.steps].sort((a, b) => a.order - b.order);
    return Array.from({ length: CHAIN_RUNS_PER_BLOCK }, (_, run) =>
      steps.map((step) => ({ kind: 'teaching' as const, targetId: target.id, exemplarId: at(run), stepId: step.id })),
    ).flat();
  }
  return Array.from({ length: blockTrials(target, band) }, (_, i) => ({
    kind: 'teaching' as const,
    targetId: target.id,
    exemplarId: at(i),
  }));
}

function highP(target: AbaTarget, rng: Rng): PlannedTrial {
  return { kind: 'high_p', targetId: target.id, exemplarId: pick(teachingExemplars(target), rng).id };
}

/**
 * Проба переноса: экземпляр `generalization`, перефразированный SD. Сначала пары
 * «экземпляр × формулировка», ещё не взятые самостоятельно: повтор взятой второй раз
 * не засчитывается.
 */
function generalizationProbe(target: AbaTarget, s: AbaTargetState, rng: Rng): PlannedTrial | null {
  const exemplars = target.exemplars.filter((e) => e.role === 'generalization');
  if (exemplars.length === 0) return null;
  const variants: (string | undefined)[] = target.sdVariantKeys?.length ? target.sdVariantKeys : [undefined];
  const all = exemplars.flatMap((e) => variants.map((v) => ({ exemplarId: e.id, sdVariantKey: v })));
  const passed = new Set(
    s.generalizationProbes
      .filter((p) => p.response === 'independent')
      .map((p) => `${p.exemplarId}|${p.sdVariantKey ?? ''}`),
  );
  const fresh = all.filter((c) => !passed.has(`${c.exemplarId}|${c.sdVariantKey ?? ''}`));
  const chosen = pick(fresh.length ? fresh : all, rng);
  return {
    kind: 'generalization',
    targetId: target.id,
    exemplarId: chosen.exemplarId,
    ...(chosen.sdVariantKey ? { sdVariantKey: chosen.sdVariantKey } : {}),
  };
}

/** На сколько сессий просрочена проба поддержания. */
function overdue(s: AbaTargetState, sessionIndex: number): number {
  return sessionIndex - s.lastMaintenanceSessionIndex - MAINTENANCE_GAP[s.maintenanceGapIndex];
}

/**
 * Начать сессию: выбрать цели и разложить план.
 *
 * - Обучаемые — первые по порядку программы цели в обучении, у которых освоены
 *   предпосылки; не больше двух.
 * - Разогрев — две пробы одной освоенной цели. Если освоенных нет (первые сессии),
 *   разогрева нет: разогревать нечем.
 * - Перенос — одна проба за сессию, цели, которая держится на 60%, только на
 *   экземпляре `generalization`. Поддержание — цели, у которых подошёл срок, самые
 *   просроченные первыми. Вместе — не больше двух. Разогрев на цели с подошедшим
 *   сроком не берётся, если есть другая: проба поддержания должна измерять навык, а
 *   не повторять только что подсказанное.
 * - В конфигурации «сам» `do_action` не предлагается вовсе: некому увидеть, поднял
 *   ли ребёнок руки. Перенос и поддержание — только тем целям, чьи пробы здесь
 *   двигают критерий.
 */
export function startAbaSession(input: StartInput): AbaSessionState {
  const { config, band, rng, sessionIndex } = input;
  const states: Record<string, AbaTargetState> = {};
  for (const t of input.targets) states[t.id] = input.states[t.id] ?? initialTargetState(t);

  const eligible = input.targets.filter((t) => !(config === 'alone' && t.format === 'do_action'));
  const isMastered = (id: string) => states[id] !== undefined && MASTERED_PHASES.has(states[id].phase);

  const teaching = eligible
    .filter((t) => TEACHING_PHASES.has(states[t.id].phase))
    .filter((t) => (t.prerequisiteTargetIds ?? []).every(isMastered))
    .filter((t) => teachingExemplars(t).length > 0)
    .slice(0, MAX_TEACHING_TARGETS);

  const mastered = eligible.filter((t) => isMastered(t.id) && teachingExemplars(t).length > 0);
  const due = mastered
    .filter((t) => counts(t, config) && isMaintenanceDue(states[t.id], sessionIndex))
    .sort((a, b) => overdue(states[b.id], sessionIndex) - overdue(states[a.id], sessionIndex));

  const probes: PlannedTrial[] = [];
  const genTarget = teaching.find((t) => counts(t, config) && needsGeneralizationProbe(states[t.id]));
  const gen = genTarget ? generalizationProbe(genTarget, states[genTarget.id], rng) : null;
  if (gen) probes.push(gen);
  for (const t of due) {
    if (probes.length >= MAX_PROBES) break;
    probes.push({ kind: 'maintenance', targetId: t.id, exemplarId: pick(teachingExemplars(t), rng).id });
  }

  const dueIds = new Set(probes.filter((p) => p.kind === 'maintenance').map((p) => p.targetId));
  const warmPool = mastered.filter((t) => !dueIds.has(t.id));
  const warmTarget = warmPool.length ? pick(warmPool, rng) : mastered.length ? pick(mastered, rng) : null;

  const queue: QueueItem[] = [{ kind: 'reinforcer' }];
  if (warmTarget) for (let i = 0; i < WARMUP_TRIALS; i += 1) queue.push({ kind: 'trial', trial: highP(warmTarget, rng) });
  teaching.forEach((t, i) => {
    if (i > 0) queue.push({ kind: 'break' });
    for (const trial of blockOf(t, band, rng)) queue.push({ kind: 'trial', trial });
    queue.push({ kind: 'block_end', targetId: t.id });
  });
  if (teaching.length === 1 && probes.length > 0) queue.push({ kind: 'break' });
  for (const trial of probes) queue.push({ kind: 'trial', trial });

  return {
    sessionId: input.sessionId,
    sessionIndex,
    config,
    band,
    startedAt: input.startedAt,
    targets: Object.fromEntries(input.targets.map((t) => [t.id, t])),
    states,
    teachingTargetIds: teaching.map((t) => t.id),
    highPTargetIds: mastered.map((t) => t.id),
    reinforcerOptions: reinforcerChoices(input.reinforcerPool, input.reinforcerHistory, rng),
    reinforcerId: null,
    queue,
    trials: [],
    board: input.board ?? { size: TOKEN_BOARD_SIZE[band], earned: 0 },
    tokensEarned: 0,
    exchangesMade: 0,
    schedule: newSchedule(rng),
    highPTokenPaid: false,
    endReason: null,
    brokenTargetId: null,
    closingAttempts: 0,
  };
}

// ---------------------------------------------------------------------------
// Ход
// ---------------------------------------------------------------------------

function trialStep(state: AbaSessionState, p: PlannedTrial): Extract<AbaStep, { kind: 'trial' }> {
  const target = state.targets[p.targetId];
  const s = state.states[p.targetId];
  const start: PromptLevel =
    p.fixedStart ?? (MEASURING_KINDS.has(p.kind) ? 0 : clampToApp(s.startPromptLevel));
  return {
    kind: 'trial',
    trialKind: p.kind,
    targetId: p.targetId,
    exemplarId: p.exemplarId,
    ...(p.stepId ? { stepId: p.stepId } : {}),
    ...(p.sdVariantKey ? { sdVariantKey: p.sdVariantKey } : {}),
    startPromptLevel: start,
    delayMs: effectiveDelayMs(s, start),
    scoredBy: sessionScoring(target, state.config),
    allowEscalation: p.kind !== 'generalization' && p.kind !== 'baseline',
  };
}

/**
 * Что показать сейчас. Проверяет лимит времени: исчерпан — сессия переходит к
 * закрытию. Выбор подкрепителя лимитом не прерывается.
 */
export function nextStep(state: AbaSessionState, now: number): { state: AbaSessionState; step: AbaStep } {
  let st = state;
  const timeUp = now - st.startedAt >= SESSION_TIME_LIMIT_MS[st.band];
  if (timeUp && st.endReason === null && st.reinforcerId !== null) st = closeOut(st, 'time_limit');
  if (st.queue.length === 0 && st.endReason === null) st = closeOut(st, 'completed');

  const head = st.queue[0];
  if (!head) return { state: st, step: { kind: 'end', reason: st.endReason ?? 'completed' } };
  switch (head.kind) {
    case 'reinforcer':
      return { state: st, step: { kind: 'choose_reinforcer', options: st.reinforcerOptions } };
    case 'break':
      return { state: st, step: { kind: 'break', canExchange: isBoardFull(st.board) } };
    case 'trial':
      return { state: st, step: trialStep(st, head.trial) };
    case 'block_end':
      // до конца блока доходит только внутри recordTrial; сюда — если план начался с него
      return nextStep(payParticipation(st), now);
  }
}

/** Ребёнок выбрал, за что работает сегодня. Подкрепитель изображается на доске. */
export function chooseReinforcer(state: AbaSessionState, id: string): AbaSessionState {
  if (state.queue[0]?.kind !== 'reinforcer') throw new Error('Сейчас не выбор подкрепителя');
  if (!state.reinforcerOptions.includes(id)) throw new Error(`Подкрепитель ${id} не предлагался`);
  return { ...state, reinforcerId: id, queue: state.queue.slice(1) };
}

/**
 * Перерыв кончился. Обмен — если доска полна; неполная переходит на следующий блок как
 * есть, жетоны не сгорают.
 */
export function finishBreak(state: AbaSessionState): { state: AbaSessionState; exchanged: number } {
  if (state.queue[0]?.kind !== 'break') throw new Error('Сейчас не перерыв');
  const { board, exchanged } = tryExchange(state.board);
  return {
    state: {
      ...state,
      board,
      exchangesMade: state.exchangesMade + (exchanged > 0 ? 1 : 0),
      queue: state.queue.slice(1),
    },
    exchanged,
  };
}

/** Взрослый остановил или ребёнок ушёл. Закрывающей пробы нет: решение принял человек. */
export function stopSession(state: AbaSessionState, reason: 'adult_stopped' | 'abandoned'): AbaSessionState {
  return { ...state, endReason: state.endReason ?? reason, queue: [] };
}

function payParticipation(state: AbaSessionState): AbaSessionState {
  return {
    ...state,
    queue: state.queue.slice(1),
    board: addTokens(state.board, PARTICIPATION_AWARD.tokens),
    tokensEarned: state.tokensEarned + PARTICIPATION_AWARD.tokens,
  };
}

/**
 * Перейти к завершению: план снимается, и если последняя проба неуспешна — ставится
 * закрывающая. После критерия остановки закрывает полная модель той же цели,
 * доведённая до успеха.
 */
function closeOut(state: AbaSessionState, reason: AbaSessionEndReason, brokenTargetId?: string): AbaSessionState {
  const closed = {
    ...state,
    endReason: state.endReason ?? reason,
    brokenTargetId: brokenTargetId ?? state.brokenTargetId,
    queue: [],
  };
  return ensureSuccessfulEnd(closed, brokenTargetId);
}

/**
 * Последнее событие сеанса ассоциируется с сеансом, поэтому сессия кончается успешной
 * пробой. Успех — самостоятельный, подсказанный или приближение. Закрывающая проба —
 * полная модель цели, на которой случилась остановка; иначе высоковероятная проба
 * освоенной цели; если освоенных нет — полная модель последней цели. Не больше
 * `MAX_CLOSING_ATTEMPTS`.
 */
function ensureSuccessfulEnd(state: AbaSessionState, brokenTargetId?: string): AbaSessionState {
  const last = [...state.trials].reverse().find((t) => t.response !== 'interrupted');
  if (!last || SUCCESS.has(last.response)) return state;
  if (state.closingAttempts >= MAX_CLOSING_ATTEMPTS) return state;

  const fullModel = (targetId: string): PlannedTrial => ({
    kind: 'correction',
    targetId,
    exemplarId: teachingExemplars(state.targets[targetId])[0].id,
    fixedStart: APP_MAX_PROMPT,
  });
  let trial: PlannedTrial;
  if (brokenTargetId) trial = fullModel(brokenTargetId);
  else if (state.highPTargetIds.length) {
    const t = state.targets[state.highPTargetIds[0]];
    trial = { kind: 'high_p', targetId: t.id, exemplarId: teachingExemplars(t)[0].id };
  }
  else trial = fullModel(last.targetId);

  return { ...state, closingAttempts: state.closingAttempts + 1, queue: [{ kind: 'trial', trial }] };
}

/** Проба, как её записал экран. Жетоны проставляет сессия. */
export type AbaTrialInput = Omit<AbaTrial, 'tokens' | 'tokenReason'>;

export type RecordResult =
  | { ok: true; state: AbaSessionState; trial: AbaTrial; award: TokenAward; participation: boolean }
  /** Запись противоречива или не та, что ждала сессия, — в лог она не идёт. */
  | { ok: false; errors: string[] };

/**
 * Записать пробу.
 *
 * Перед записью — проверка: проба та, что ждала сессия (цель, экземпляр, назначение,
 * стартовый уровень, источник оценки), и не противоречит сама себе
 * (`trialInvariantErrors`). Иначе данные о затухании молча портятся.
 *
 * Потом: жетон по дифференциальной схеме, затухание стартового уровня, и одно из:
 * - **остановка** — три провала подряд на полной модели: план снимается, закрывает
 *   полная модель той же цели;
 * - **коррекция** — провал обучающей пробы: проба на последнем успешном уровне →
 *   отвлекающая высоковероятная проба другой, освоенной цели → проба переноса того же
 *   SD на стартовом уровне. Без третьего шага коррекция не завершена: ребёнок повторил
 *   за моделью, но не показал, что может без неё. Освоенных целей нет — без
 *   отвлекающей. У цепочки коррекции нет: провал звена уже доведён подсказкой до
 *   полной модели внутри пробы, а отвлекающая проба посреди прогона рвёт цепочку.
 *
 * Дошли до конца блока — жетон за участие.
 */
export function recordTrial(state: AbaSessionState, input: AbaTrialInput, rng: Rng): RecordResult {
  const head = state.queue[0];
  if (head?.kind !== 'trial') return { ok: false, errors: ['сессия сейчас не ждёт пробу'] };
  const expected = trialStep(state, head.trial);

  const errors: string[] = [];
  if (input.sessionId !== state.sessionId) errors.push('проба из другой сессии');
  if (input.targetId !== expected.targetId) errors.push('не та цель');
  if (input.exemplarId !== expected.exemplarId) errors.push('не тот экземпляр');
  if (input.kind !== expected.trialKind) errors.push('не то назначение пробы');
  if ((input.stepId ?? null) !== (expected.stepId ?? null)) errors.push('не то звено цепочки');
  if ((input.sdVariantKey ?? null) !== (expected.sdVariantKey ?? null)) errors.push('не та формулировка SD');
  if (input.startPromptLevel !== expected.startPromptLevel) errors.push('не тот стартовый уровень');
  if (input.scoredBy !== expected.scoredBy) errors.push('не тот источник оценки');
  if (!expected.allowEscalation && input.promptLevelUsed !== input.startPromptLevel) {
    errors.push('подсказка в пробе, которая измеряет');
  }

  const targetState = state.states[input.targetId];
  const award = awardForTrial(
    input.response,
    input.kind,
    targetState.phase,
    state.schedule,
    rng,
    state.highPTokenPaid,
  );
  const trial: AbaTrial = { ...input, tokens: award.tokens, ...(award.reason ? { tokenReason: award.reason } : {}) };
  errors.push(...trialInvariantErrors(trial));
  if (errors.length) return { ok: false, errors };

  let st: AbaSessionState = {
    ...state,
    trials: [...state.trials, trial],
    queue: state.queue.slice(1),
    board: addTokens(state.board, award.tokens),
    tokensEarned: state.tokensEarned + award.tokens,
    schedule: award.schedule,
    highPTokenPaid: state.highPTokenPaid || (trial.kind === 'high_p' && award.tokens > 0),
    states: { ...state.states, [trial.targetId]: applyTrialToFading(targetState, trial) },
  };

  const failed = trial.response === 'incorrect' || trial.response === 'no_response';
  if (st.endReason === null && isBreakdown(st.trials, trial.targetId)) {
    st = closeOut(st, 'breakdown', trial.targetId);
  } else if (st.endReason === null && failed && trial.kind === 'teaching' && !trial.stepId) {
    st = { ...st, queue: [...correctionFor(st, trial, rng), ...st.queue] };
  }

  let participation = false;
  while (st.queue[0]?.kind === 'block_end') {
    st = payParticipation(st);
    participation = true;
  }
  if (st.endReason !== null && st.queue.length === 0) st = ensureSuccessfulEnd(st);

  return { ok: true, state: st, trial, award, participation };
}

function correctionFor(state: AbaSessionState, failed: AbaTrial, rng: Rng): QueueItem[] {
  const s = state.states[failed.targetId];
  const same = { targetId: failed.targetId, exemplarId: failed.exemplarId };
  const items: QueueItem[] = [
    { kind: 'trial', trial: { ...same, kind: 'correction', fixedStart: clampToApp(s.lastSuccessfulPromptLevel) } },
  ];
  const others = state.highPTargetIds.filter((id) => id !== failed.targetId);
  if (others.length) items.push({ kind: 'trial', trial: highP(state.targets[pick(others, rng)], rng) });
  items.push({ kind: 'trial', trial: { ...same, kind: 'transfer' } });
  return items;
}

// ---------------------------------------------------------------------------
// Итог
// ---------------------------------------------------------------------------

export type AbaSessionResult = {
  session: AbaSession;
  /** Состояния всех целей программы: затронутые — новыми, прочие — как были. */
  states: Record<string, AbaTargetState>;
  trials: AbaTrial[];
  /** Доска на следующую сессию: жетоны не сгорают. */
  board: TokenBoard;
  /** Сколько жетонов ушло в обмен в конце. 0 — доска неполная, обмена нет. */
  exchanged: number;
};

/**
 * Итог сессии.
 *
 * По каждой обучаемой цели: задержка по блоку, итог сессии для серии критерия
 * (остановка рвёт серию только той цели, на которой сработала), проверка зависимости от подсказки по последним сессиям. По
 * пробам переноса и поддержания — их отдельные правила. Цель, выполнившая критерий,
 * переходит в поддержание. Полная доска в конце — обмен.
 *
 * `pastSessions` — прошлые сессии цели для проверки зависимости, свежие в конце; без
 * них проверка не набирает трёх сессий и молчит.
 */
export function finishAbaSession(
  state: AbaSessionState,
  day: string,
  endedAt: number,
  pastSessions: Readonly<Record<string, SessionTrials[]>> = {},
): AbaSessionResult {
  if (state.endReason === null) throw new Error('Сессия ещё идёт');
  const idx = state.sessionIndex;
  const states = { ...state.states };
  const touched = [...new Set(state.trials.map((t) => t.targetId))];

  for (const id of touched) {
    const target = state.targets[id];
    const own = state.trials.filter((t) => t.targetId === id);
    let s: AbaTargetState = { ...states[id], lastSessionIndex: idx };

    if (state.teachingTargetIds.includes(id)) {
      s = applyBlockToDelay(s, target, own.filter((t) => t.kind === 'teaching'));
      const endReason = state.brokenTargetId === id ? 'breakdown' : null;
      s = applySession(s, summarizeSession(target, own, endReason), idx, day);
    }
    for (const t of own) {
      if (t.kind === 'generalization') s = applyGeneralizationProbe(s, t);
      if (t.kind === 'maintenance') s = applyMaintenanceProbe(s, t, idx);
    }
    if (TEACHING_PHASES.has(s.phase) && state.teachingTargetIds.includes(id)) {
      if (isMasteryMet(s)) s = markMastered(s, idx);
      else if (isPromptDependent(s, [...(pastSessions[id] ?? []), { index: idx, trials: own }])) {
        s = applyPromptDependence(s, target, idx);
      }
    }
    states[id] = s;
  }

  const { board, exchanged } = tryExchange(state.board);
  return {
    session: {
      id: state.sessionId,
      index: idx,
      startedAt: new Date(state.startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      config: state.config,
      targetIds: state.teachingTargetIds,
      reinforcerId: state.reinforcerId ?? '',
      tokensEarned: state.tokensEarned,
      exchangesMade: state.exchangesMade + (exchanged > 0 ? 1 : 0),
      endReason: state.endReason,
    },
    states,
    trials: state.trials,
    board,
    exchanged,
  };
}
