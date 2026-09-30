/**
 * Ход ABA-сессии. Спецификация — «Единица работы», «Исправление ошибки»,
 * «Генерализация», «Поддержание» и «Разбор оркестратора сессии» в `ABA.md`.
 *
 * Здесь порядок, а не правила отдельной пробы: правила лежат в `abaPrompting`
 * (подсказки, затухание, остановка), `abaCriterion` (критерий, базовая линия,
 * поддержание), `abaTokens` (жетоны) и `abaTargetRules` (что годится в цель). Сессия их
 * связывает.
 *
 * Экран работает с сессией так: `nextStep` — что показать, `chooseReinforcer`,
 * `recordTrial`, `finishBreak`, `stopSession` — что произошло, `finishAbaSession` — итог.
 * Состояние — обычный объект, включая генератор случайных чисел (`seed`): сессию можно
 * сохранить посреди и продолжить после сворачивания, и она пойдёт так же.
 *
 * Порядок всегда один — предсказуемость структуры сама снижает проблемное поведение:
 * выбор подкрепителя → разогрев → базовая линия новых целей → блок A → перерыв → блок B
 * → перенос и поддержание → завершение на успешной пробе.
 */
import {
  APP_MAX_PROMPT,
  COUNTS_TOWARD_MASTERY,
  MAINTENANCE_GAP,
  MASTERY,
  type AbaConfig,
  type AbaExemplar,
  type AbaResponse,
  type AbaSession,
  type AbaSessionEndReason,
  type AbaSessionEvent,
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
  correctionLevel,
  effectiveDelayMs,
  initialTargetState,
  isBreakdown,
  isPromptDependent,
  promptStateOf,
  trialInvariantErrors,
  type SessionTrials,
} from './abaPrompting';
import {
  applyBaseline,
  applyGeneralizationProbe,
  applyMaintenanceProbe,
  applySession,
  BASELINE_CHAIN_RUNS,
  BASELINE_TRIALS,
  generalizationPasses,
  isMaintenanceDue,
  isMasteryMet,
  markMastered,
  MAX_BASELINE_TARGETS,
  needsGeneralizationProbe,
  summarizeSession,
} from './abaCriterion';
import {
  addTokens,
  awardForTrial,
  isBoardFull,
  newSchedule,
  participationAward,
  reinforcerChoices,
  tryExchange,
  type Rng,
  type TokenAward,
  type TokenBoard,
  type TokenSchedule,
} from './abaTokens';
import { targetErrors } from './abaTargetRules';
import { arrange, baselineMembers, poolErrors, setHalves, updateSets, type IdentifySet } from './abaIdentifySet';
import {
  applyStageSession,
  EXCHANGE_ACCESS_MS,
  immediateExchange,
  PAIRING,
  workingBoardSize,
  type TokenTrainingState,
} from './abaTokenTraining';

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
 * Прогонов цепочки в блоке. Минимум для зачёта сессии у цепочки — в прогонах, и блок
 * ровно его и даёт: пять полных «помыть руки» в сессию не помещаются.
 */
export const CHAIN_RUNS_PER_BLOCK = MASTERY.minChainRunsPerSession;

/**
 * Лимит рабочего времени — предохранитель, а не план: запланированная сессия около 8
 * минут на полосе 5–6 и 12 дальше, коррекции добавляют пробы. Перерывы и обмен не
 * считаются. По лимиту сессия не обрывается, а закрывается успешной пробой. Взрослый
 * может уменьшить лимит (`StartInput.timeLimitMs`); точные минуты — с
 * `child-ux-specialist`.
 */
export const SESSION_TIME_LIMIT_MS: Record<AgeBand, number> = {
  '5-6': 10 * 60_000,
  '7': 15 * 60_000,
  '8': 15 * 60_000,
  '9-10': 15 * 60_000,
};

/** Сколько ребёнок выбирает подкрепитель, прежде чем выбрать предложат взрослому. */
export const REINFORCER_CHOICE_TIMEOUT_MS = 30_000;

/**
 * Нейтральная пауза между пробой коррекции и пробой переноса, когда отвлекающей пробы
 * нет (освоенных целей ещё нет): иначе перенос — эхо только что прозвучавшей модели.
 */
export const NEUTRAL_PAUSE_MS = 5000;

/**
 * Закрывающих проб подряд, после которых сессия кончается как есть — спокойно, без
 * требования. Завершать на неудаче нельзя, но и добиваться успеха без конца от
 * ребёнка, который сегодня не может, — тот же аверсивный сеанс.
 */
export const MAX_CLOSING_ATTEMPTS = 2;

/** Верная карточка `identify` — не больше двух раз подряд на одном месте. */
export const MAX_SAME_POSITION = 2;

/**
 * Сессий обучения без снижения стартового уровня и без роста доли самостоятельных, после
 * которых цель считается застрявшей: флаг `no_progress` специалисту, и цель уступает
 * слот следующей по программе. Иначе две застрявшие цели навсегда занимают оба слота, а
 * на полосе 5–6 — ещё и базовую линию всех следующих.
 */
export const NO_PROGRESS_SESSIONS = 5;

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------

/** Проба в плане сессии. Уровень подсказки и поле определяются, когда до неё дошла очередь. */
export type PlannedTrial = {
  kind: AbaTrialKind;
  targetId: string;
  exemplarId: string;
  stepId?: string;
  runIndex?: number;
  sdVariantKey?: string;
  /** Уровень задан процедурой, а не стартовым уровнем: коррекция, закрытие. */
  fixedStart?: PromptLevel;
  /** Поле `identify`; заполняется, когда проба становится текущей. */
  field?: string[];
  pauseBeforeMs?: number;
  /** Со взрослым: после полной модели попросить взрослого помочь (L4). */
  adultAssist?: true;
  /** Проба коррекции доводится до верного ответа при любом провале, не только при молчании. */
  escalateOnIncorrect?: true;
  /** Закрывающая проба: блок или сессию. */
  closes?: 'block' | 'session';
};

type QueueItem =
  | { kind: 'reinforcer' }
  | { kind: 'trial'; trial: PlannedTrial }
  /** Конец блока цели. `participation` — жетон за участие; базовая линия его не получает. */
  | {
      kind: 'block_end';
      /** Цель блока; у набора — id набора, участники — в `members`. */
      targetId: string;
      participation: boolean;
      bridged?: true;
      members?: string[];
    }
  | { kind: 'break' }
  /** Доступ к подкрепителю после обмена при обучении доске. */
  | { kind: 'access'; durationMs: number };

export type TrialStep = {
  kind: 'trial';
  trialKind: AbaTrialKind;
  targetId: string;
  exemplarId: string;
  stepId?: string;
  runIndex?: number;
  sdVariantKey?: string;
  /**
   * Поле `identify` слева направо, верная — `exemplarId`. На L3 дистракторы убираются
   * (поле из одной карточки), на L2 — пассивны: это решает экран по уровню, в данные
   * пишется полное поле.
   */
  field?: string[];
  startPromptLevel: PromptLevel;
  /** Пауза после конца озвучки SD. */
  delayMs: number;
  /** Пауза перед пробой. */
  pauseBeforeMs: number;
  /** Кто засчитывает. В конфигурации «сам» взрослого нет. */
  scoredBy: ScoringSource;
  /** Перенос и базовая линия измеряют: подсказки нет. */
  allowEscalation: boolean;
  /** После полной модели попросить взрослого выполнить вместе и записать L4. */
  askAdultForL4: boolean;
  /** Эскалировать и после неверного ответа, а не только после молчания: проба коррекции. */
  escalateOnIncorrect: boolean;
  /**
   * Похвалить внимание **до** инструкции: базовая линия подкрепляет внимание, но не
   * ответ, — после ответа реакция нейтральная.
   */
  praiseAttentionBeforeSd: boolean;
  /**
   * Проба без подсказок в цепочке (базовая линия, перенос): проваленное звено выполняет
   * взрослый, пробой ребёнка это не пишется, и прогон идёт дальше.
   */
  adultCompletesOnFail: boolean;
  closes?: 'block' | 'session';
};

/** Что показать сейчас. */
export type AbaStep =
  | { kind: 'choose_reinforcer'; options: string[]; adultChoosesAfterMs: number }
  | TrialStep
  /** Перерыв по расписанию. Обмен — только при полной доске. */
  | { kind: 'break'; canExchange: boolean; pauseBeforeMs: number }
  /** Доступ к подкрепителю после обмена: экран показывает его и зовёт `finishAccess`. */
  | { kind: 'access'; durationMs: number }
  /** `endedOnSuccess: false` — спокойный экран «закончили» без оценки и до обмена. */
  | {
      kind: 'end';
      reason: AbaSessionEndReason;
      endedOnSuccess: boolean;
      /**
       * Цикл сопряжения на экране перехода: в сессии не было ни учебной, ни освоенной
       * цели (одна базовая линия), и без него ребёнок ушёл бы ни с чем. Жетон на доску из
       * одной ячейки и сразу обмен, доступ 20 с; в доску не идёт.
       */
      pairingCycle: boolean;
      /** Цикл сопряжения — через столько после экрана «закончили», как в сессии сопряжения. */
      pairingCycleAfterMs: number;
      pauseBeforeMs: number;
    };

export type AbaSessionState = {
  sessionId: string;
  sessionIndex: number;
  config: AbaConfig;
  band: AgeBand;
  startedAt: number;
  /** Начало работы — выбор подкрепителя сделан. От него считается лимит. */
  workStartedAt: number | null;
  timeLimitMs: number;
  pausedMs: number;
  breakStartedAt: number | null;
  accessStartedAt: number | null;
  /** Нейтральная пауза перед следующим шагом: мост не нашёл, чем закрыть блок успехом. */
  pendingPauseMs: number;
  targets: Record<string, AbaTarget>;
  states: Record<string, AbaTargetState>;
  baselineTargetIds: string[];
  /** Цели блоков A и B. */
  teachingTargetIds: string[];
  /** Цели с пробой поддержания в этой сессии: практикой их не загрязняем. */
  maintenanceTargetIds: string[];
  /** Освоенные цели для разогрева, отвлекающих и закрывающих проб: не цепочки, не на поддержании. */
  highPTargetIds: string[];
  /** Наборы `identify` ребёнка на эту сессию. */
  identifySets: IdentifySet[];
  /** Набор, который обучается в этой сессии: он занимает оба слота обучения. */
  set: IdentifySet | null;
  reinforcerOptions: string[];
  reinforcerId: string | null;
  reinforcerChosenBy: 'child' | 'adult' | null;
  queue: QueueItem[];
  trials: AbaTrial[];
  board: TokenBoard;
  tokenTraining: TokenTrainingState;
  /** Обучение доске: обмен сразу, как доска полна, а не на перерыве. */
  immediateExchange: boolean;
  tokensEarned: number;
  exchangesMade: number;
  schedule: TokenSchedule;
  highPTokenPaid: boolean;
  /** Обучающий блок, начатый и ещё не оплаченный жетоном за участие. */
  openBlockTargetId: string | null;
  /** Остановка или лимит оборвали начатый блок: участие — после успешной закрывающей пробы. */
  participationOwed: string | null;
  endReason: AbaSessionEndReason | null;
  brokenTargetId: string | null;
  closingAttempts: number;
  events: AbaSessionEvent[];
  seed: number;
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
  /** Доска с прошлой сессии: жетоны не сгорают. Размер — по ступени обучения доске. */
  board?: Pick<TokenBoard, 'earned' | 'nonContingent'>;
  /** Сопряжение и обучение доске — на ребёнке. Без сопряжения рабочая сессия не начинается. */
  tokenTraining: TokenTrainingState;
  /** Наборы `identify` ребёнка. */
  identifySets?: IdentifySet[];
  /** Взрослый может уменьшить лимит, но не увеличить. */
  timeLimitMs?: number;
  startedAt: number;
  seed: number;
};

// ---------------------------------------------------------------------------
// Случайность, которую можно сохранить
// ---------------------------------------------------------------------------

/** mulberry32: генератор, чьё состояние — одно число. */
function seeded(seed: number): { rng: Rng; seed: () => number } {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { rng, seed: () => a };
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

// ---------------------------------------------------------------------------
// План
// ---------------------------------------------------------------------------

const MASTERED_PHASES = new Set(['mastered', 'maintenance']);
const TEACHING_PHASES = new Set(['acquisition', 'generalization_check']);
const MEASURING_KINDS: ReadonlySet<AbaTrialKind> = new Set(['baseline', 'generalization', 'maintenance']);
const SUCCESS: ReadonlySet<AbaResponse> = new Set(['independent', 'prompted', 'approximation']);
/** Причины, по которым в конце сессии бывает обмен. Уход и остановка взрослым — нет. */
const EXCHANGE_AT_END: ReadonlySet<AbaSessionEndReason> = new Set(['completed', 'time_limit', 'breakdown']);

/**
 * Кто засчитывает пробу в этой конфигурации. «Со взрослым» — источник цели. «Сам» —
 * устройство: громкость для `voice_volume`, касание для `identify`, остальное — детектор
 * начала звука без права на критерий.
 */
export function sessionScoring(target: AbaTarget, config: AbaConfig): ScoringSource {
  if (config === 'with_adult') return target.scoredBy;
  if (target.format === 'voice_volume') return 'device_loudness';
  if (target.format === 'identify') return 'device_tap';
  return 'device_onset';
}

/** Проба этой цели в этой конфигурации может двигать критерий. */
function counts(target: AbaTarget, config: AbaConfig): boolean {
  return COUNTS_TOWARD_MASTERY[sessionScoring(target, config)];
}

const teachingExemplars = (t: AbaTarget): AbaExemplar[] => t.exemplars.filter((e) => e.role === 'teaching');

/** Экземпляры по кругу в случайном порядке: критерий требует минимум двух разных. */
function rotation(target: AbaTarget, rng: Rng): (i: number) => string {
  const exemplars = shuffle(teachingExemplars(target), rng);
  return (i) => exemplars[i % exemplars.length].id;
}

/** Прогон цепочки: каждое звено — отдельной строкой, в естественном порядке. */
function chainRun(target: AbaTarget, base: PlannedTrial, runIndex: number): PlannedTrial[] {
  return [...(target.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((step) => ({ ...base, stepId: step.id, runIndex }));
}

/** Проба цели — у цепочки целый прогон. Перенос и поддержание цепочки тоже прогоном. */
function unit(target: AbaTarget, base: PlannedTrial, runIndex = 0): PlannedTrial[] {
  return target.steps?.length ? chainRun(target, base, runIndex) : [base];
}

/** Пробы обучающего блока. `generalization` в обучении не используется никогда. */
function teachingBlock(target: AbaTarget, rng: Rng): PlannedTrial[] {
  const at = rotation(target, rng);
  if (target.steps?.length) {
    return Array.from({ length: CHAIN_RUNS_PER_BLOCK }, (_, run) =>
      chainRun(target, { kind: 'teaching', targetId: target.id, exemplarId: at(run) }, run),
    ).flat();
  }
  return Array.from({ length: target.blockSize }, (_, i) => ({
    kind: 'teaching' as const,
    targetId: target.id,
    exemplarId: at(i),
  }));
}

/**
 * Базовая линия: три пробы без подсказки минимум на двух обучающих экземплярах, между
 * ними — высоковероятные пробы, если есть освоенные. У цепочки — два прогона без
 * подсказок; проваленное звено выполняет взрослый, и прогон идёт дальше.
 */
function baselineBlock(target: AbaTarget, highP: AbaTarget[], rng: Rng): PlannedTrial[] {
  const at = rotation(target, rng);
  if (target.steps?.length) {
    return Array.from({ length: BASELINE_CHAIN_RUNS }, (_, run) =>
      chainRun(target, { kind: 'baseline', targetId: target.id, exemplarId: at(run) }, run),
    ).flat();
  }
  const out: PlannedTrial[] = [];
  for (let i = 0; i < BASELINE_TRIALS; i += 1) {
    if (i > 0 && highP.length) out.push(highPTrial(pick(highP, rng), rng));
    out.push({ kind: 'baseline', targetId: target.id, exemplarId: at(i) });
  }
  return out;
}

function highPTrial(target: AbaTarget, rng: Rng, kind: 'high_p' | 'closing' = 'high_p'): PlannedTrial {
  return { kind, targetId: target.id, exemplarId: pick(teachingExemplars(target), rng).id };
}

/**
 * Проба переноса: экземпляр `generalization`, перефразированный SD. Сначала пары
 * «экземпляр × формулировка», ещё не взятые самостоятельно: повтор взятой второй раз
 * не засчитывается.
 */
function generalizationProbe(target: AbaTarget, s: AbaTargetState, rng: Rng): PlannedTrial {
  const exemplars = target.exemplars.filter((e) => e.role === 'generalization');
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
 * Начать сессию: проверить цели, выбрать и разложить план.
 *
 * - Цель с ошибкой в описании (`abaTargetRules`) сессию не начинает: иначе процедура
 *   молча расходится с данными.
 * - «Сам»: `do_action` не предлагается вовсе — некому увидеть, поднял ли ребёнок руки.
 *   Обучаются, проходят базовую линию, перенос и поддержание только цели, чьи пробы
 *   здесь двигают критерий (`voice_volume`, `identify`); остальные освоенные — только
 *   отработка, с реакцией «Tali послушал».
 * - Базовая линия — первые по порядку программы новые цели, не больше двух.
 * - Обучаемые — первые по порядку цели в обучении с освоенными предпосылками, не
 *   больше двух.
 * - Перенос — одна проба за сессию, цели, которая держится на 60%, по кругу: той, у
 *   которой перенос был давнее всех, при равенстве — у которой зачётов меньше.
 * - Поддержание — сначала перепроверки после провала, потом самые просроченные. Вместе
 *   с переносом не больше двух.
 * - Цель с поддержанием в этой сессии не попадает ни в разогрев, ни в отвлекающие, ни в
 *   закрывающие пробы: иначе поддержание измеряет только что отработанное. Цепочки
 *   туда тоже не попадают: высоковероятная проба короткая, а прогон — нет.
 */
export function startAbaSession(input: StartInput): AbaSessionState {
  const { config, band, sessionIndex } = input;
  const r = seeded(input.seed);
  const rng = r.rng;

  for (const t of input.targets) {
    const errors = targetErrors(t);
    if (errors.length) throw new Error(`Цель ${t.id}: ${errors.join('; ')}`);
  }
  const pools = poolErrors(input.targets);
  if (pools.length) throw new Error(pools.join('; '));

  if (!input.tokenTraining.pairingDone) {
    throw new Error('Сопряжение не закончено: сначала сессия сопряжения, а не рабочая');
  }

  const states: Record<string, AbaTargetState> = {};
  for (const t of input.targets) states[t.id] = input.states[t.id] ?? initialTargetState(t);

  const offered = input.targets.filter((t) => !(config === 'alone' && t.format === 'do_action'));
  const isMastered = (id: string) => states[id] !== undefined && MASTERED_PHASES.has(states[id].phase);
  const ready = (t: AbaTarget) => counts(t, config) && (t.prerequisiteTargetIds ?? []).every(isMastered);

  const single = offered.filter((t) => t.format !== 'identify');
  // застрявшая цель уступает слот следующей по программе; сама — если больше некому
  const stuck = (t: AbaTarget) => Number(states[t.id].flags.includes('no_progress'));
  const regular = single
    .filter((t) => TEACHING_PHASES.has(states[t.id].phase) && ready(t))
    .sort((a, b) => stuck(a) - stuck(b))
    .slice(0, MAX_TEACHING_TARGETS);

  // identify — только набором. Набор занимает оба слота обучения; готовы и набор, и
  // обычные цели — сессии чередуются
  const identifySets = updateSets(input.identifySets ?? [], offered, states, sessionIndex, ready);
  // наборов несколько (пулов несколько) — давнее обучавшийся первым
  const candidate = [...identifySets].sort((a, b) => a.lastSetSessionIndex - b.lastSetSessionIndex)[0] ?? null;
  const regularLast = Math.max(-1, ...regular.map((t) => states[t.id].lastSessionIndex));
  const set = candidate && (regular.length === 0 || candidate.lastSetSessionIndex <= regularLast) ? candidate : null;
  const setMembers = set ? set.memberIds.map((id) => input.targets.find((t) => t.id === id)!) : [];
  const teaching = set ? setMembers.filter((t) => TEACHING_PHASES.has(states[t.id].phase)) : regular;
  // 5–6: базовая линия занимает слоты обучения — иначе сессия малыша вдвое длиннее нормы
  const baselineRoom = Math.min(
    band === '5-6' ? MAX_TEACHING_TARGETS - teaching.length : MAX_BASELINE_TARGETS,
    // на ступенях 1–2 обучения доске — не больше одной новой цели
    input.tokenTraining.stage <= 2 ? 1 : MAX_BASELINE_TARGETS,
  );
  const setBaselineLimit = input.tokenTraining.stage <= 2 ? 1 : MAX_BASELINE_TARGETS;
  const baseline = set
    ? baselineMembers(set, states, setBaselineLimit).map((id) => setMembers.find((t) => t.id === id)!)
    : single.filter((t) => states[t.id].phase === 'baseline' && ready(t)).slice(0, Math.max(0, baselineRoom));
  const mastered = offered.filter((t) => isMastered(t.id));

  const due = mastered
    .filter((t) => counts(t, config) && isMaintenanceDue(states[t.id], sessionIndex))
    .sort((a, b) => {
      const retest = Number(states[b.id].maintenanceFailsInRow > 0) - Number(states[a.id].maintenanceFailsInRow > 0);
      return retest || overdue(states[b.id], sessionIndex) - overdue(states[a.id], sessionIndex);
    });

  // поддержание участника набора — внутри блока набора, первой его пробой
  const setDue = set ? due.filter((t) => set.memberIds.includes(t.id)).map((t) => t.id) : [];
  const probes: PlannedTrial[][] = [];
  const genTarget = teaching
    .filter((t) => needsGeneralizationProbe(states[t.id]))
    .sort(
      (a, b) =>
        states[a.id].lastGeneralizationSessionIndex - states[b.id].lastGeneralizationSessionIndex ||
        generalizationPasses(states[a.id]) - generalizationPasses(states[b.id]),
    )[0];
  if (genTarget) probes.push(unit(genTarget, generalizationProbe(genTarget, states[genTarget.id], rng)));
  for (const t of due.filter((x) => !setDue.includes(x.id))) {
    if (probes.length >= MAX_PROBES) break;
    probes.push(unit(t, { kind: 'maintenance', targetId: t.id, exemplarId: pick(teachingExemplars(t), rng).id }));
  }

  const maintenanceIds = [...setDue, ...probes.filter((p) => p[0].kind === 'maintenance').map((p) => p[0].targetId)];
  const highP = mastered.filter((t) => !t.steps?.length && !maintenanceIds.includes(t.id));

  const queue: QueueItem[] = [{ kind: 'reinforcer' }];
  if (highP.length) {
    const warm = pick(highP, rng);
    for (let i = 0; i < WARMUP_TRIALS; i += 1) queue.push({ kind: 'trial', trial: highPTrial(warm, rng) });
  }
  if (set) {
    // набор: две половины вокруг перерыва, инструкции вперемешку
    const rot = new Map(setMembers.map((t) => [t.id, rotation(t, rng)]));
    const seen = new Map<string, number>();
    const members = set.memberIds;
    const hasTeaching = teaching.length > 0;
    const halves = setHalves(set, states, rng, { baselineLimit: setBaselineLimit, maintenanceIds: setDue });
    halves.forEach((half, i) => {
      if (i > 0) queue.push({ kind: 'break' });
      let baselineRun = 0;
      for (const item of half) {
        const n = seen.get(item.targetId) ?? 0;
        seen.set(item.targetId, n + 1);
        queue.push({ kind: 'trial', trial: { kind: item.kind, targetId: item.targetId, exemplarId: rot.get(item.targetId)!(n) } });
        // между пробами базовой линии — через каждые две высоковероятная другой освоенной цели
        const others = highP.filter((t) => !set.memberIds.includes(t.id));
        if (item.kind === 'baseline' && ++baselineRun % 2 === 0 && others.length) {
          queue.push({ kind: 'trial', trial: highPTrial(pick(others, rng), rng) });
        }
      }
      queue.push({ kind: 'block_end', targetId: set.id, participation: hasTeaching, members });
    });
  } else {
    for (const t of baseline) {
      for (const trial of baselineBlock(t, highP, rng)) queue.push({ kind: 'trial', trial });
      queue.push({ kind: 'block_end', targetId: t.id, participation: false });
    }
    teaching.forEach((t, i) => {
      if (i > 0) queue.push({ kind: 'break' });
      for (const trial of teachingBlock(t, rng)) queue.push({ kind: 'trial', trial });
      queue.push({ kind: 'block_end', targetId: t.id, participation: true });
    });
    if (teaching.length === 1 && probes.length > 0) queue.push({ kind: 'break' });
  }
  for (const trial of probes.flat()) queue.push({ kind: 'trial', trial });

  const reinforcerOptions = reinforcerChoices(input.reinforcerPool, input.reinforcerHistory, rng);
  const schedule = newSchedule(rng);

  return {
    sessionId: input.sessionId,
    sessionIndex,
    config,
    band,
    startedAt: input.startedAt,
    workStartedAt: null,
    timeLimitMs: Math.min(input.timeLimitMs ?? Infinity, SESSION_TIME_LIMIT_MS[band]),
    pausedMs: 0,
    breakStartedAt: null,
    accessStartedAt: null,
    pendingPauseMs: 0,
    targets: Object.fromEntries(input.targets.map((t) => [t.id, t])),
    states,
    baselineTargetIds: baseline.map((t) => t.id),
    teachingTargetIds: teaching.map((t) => t.id),
    maintenanceTargetIds: maintenanceIds,
    highPTargetIds: highP.map((t) => t.id),
    identifySets,
    set,
    reinforcerOptions,
    reinforcerId: null,
    reinforcerChosenBy: null,
    queue,
    trials: [],
    board: {
      size: workingBoardSize(input.tokenTraining, band),
      earned: input.board?.earned ?? 0,
      nonContingent: input.board?.nonContingent ?? 0,
    },
    tokenTraining: input.tokenTraining,
    immediateExchange: immediateExchange(input.tokenTraining, band),
    tokensEarned: 0,
    exchangesMade: 0,
    schedule,
    highPTokenPaid: false,
    openBlockTargetId: null,
    participationOwed: null,
    endReason: null,
    brokenTargetId: null,
    closingAttempts: 0,
    events: [],
    seed: r.seed(),
  };
}

// ---------------------------------------------------------------------------
// Ход
// ---------------------------------------------------------------------------

const iso = (ms: number) => new Date(ms).toISOString();

function trialStep(state: AbaSessionState, p: PlannedTrial): TrialStep {
  const target = state.targets[p.targetId];
  const s = state.states[p.targetId];
  const start: PromptLevel =
    p.fixedStart ?? (MEASURING_KINDS.has(p.kind) ? 0 : clampToApp(promptStateOf(s, p.stepId).startPromptLevel));
  const withAdult = state.config === 'with_adult';
  return {
    kind: 'trial',
    trialKind: p.kind,
    targetId: p.targetId,
    exemplarId: p.exemplarId,
    ...(p.stepId ? { stepId: p.stepId } : {}),
    ...(p.runIndex !== undefined ? { runIndex: p.runIndex } : {}),
    ...(p.sdVariantKey ? { sdVariantKey: p.sdVariantKey } : {}),
    ...(p.field ? { field: p.field } : {}),
    startPromptLevel: start,
    delayMs: effectiveDelayMs(s, start),
    pauseBeforeMs: Math.max(p.pauseBeforeMs ?? 0, state.pendingPauseMs),
    scoredBy: sessionScoring(target, state.config),
    allowEscalation: p.kind !== 'generalization' && p.kind !== 'baseline',
    askAdultForL4: withAdult && (p.adultAssist === true || (Boolean(p.stepId) && p.kind === 'teaching')),
    escalateOnIncorrect: p.escalateOnIncorrect === true,
    praiseAttentionBeforeSd: p.kind === 'baseline',
    adultCompletesOnFail: withAdult && Boolean(p.stepId) && (p.kind === 'baseline' || p.kind === 'generalization'),
    ...(p.closes ? { closes: p.closes } : {}),
  };
}

/**
 * Поле `identify` для текущей пробы: верная карточка и карточки других целей набора в
 * случайном порядке, но верная — не больше двух раз подряд на одном месте по всем пробам
 * сессии: иначе ребёнок учит место, а не стимул.
 */
function withField(state: AbaSessionState): AbaSessionState {
  const head = state.queue[0];
  if (head?.kind !== 'trial' || head.trial.field) return state;
  const target = state.targets[head.trial.targetId];
  if (target.format !== 'identify') return state;

  const r = seeded(state.seed);
  // карточки поля — учебные экземпляры других целей набора; вне набора (перенос и
  // поддержание распавшегося набора) — других целей пула
  const inSet = state.set?.memberIds.includes(target.id) ?? false;
  const size = state.states[target.id].lastFieldSize ?? 3;
  const others = inSet
    ? state.set!.memberIds.filter((id) => id !== target.id)
    : shuffle(
        Object.values(state.targets)
          .filter((t) => t.format === 'identify' && t.identifyPoolKey === target.identifyPoolKey && t.id !== target.id)
          .map((t) => t.id),
        r.rng,
      ).slice(0, size - 1);
  const cards = others.map((id) => pick(teachingExemplars(state.targets[id]), r.rng).id);
  const field = shuffle([head.trial.exemplarId, ...cards], r.rng);

  // позиция верной — по всему блоку, а не по цели: иначе ребёнок учит место
  const recent = state.trials
    .filter((t) => t.field)
    .slice(-MAX_SAME_POSITION)
    .map((t) => t.field!.indexOf(t.exemplarId));
  const at = field.indexOf(head.trial.exemplarId);
  if (recent.length === MAX_SAME_POSITION && recent.every((p) => p === at)) {
    const others = field.map((_, i) => i).filter((i) => i !== at);
    const to = pick(others, r.rng);
    [field[at], field[to]] = [field[to], field[at]];
  }
  const trial = { ...head.trial, field };
  return { ...state, queue: [{ kind: 'trial', trial }, ...state.queue.slice(1)], seed: r.seed() };
}

function workedMs(state: AbaSessionState, now: number): number {
  if (state.workStartedAt === null) return 0;
  const inBreak = state.breakStartedAt === null ? 0 : now - state.breakStartedAt;
  const inAccess = state.accessStartedAt === null ? 0 : now - state.accessStartedAt;
  return now - state.workStartedAt - state.pausedMs - inBreak - inAccess;
}

/**
 * Что показать сейчас. Проверяет лимит рабочего времени: исчерпан — сессия переходит к
 * закрытию. Пока подкрепитель не выбран, лимит не идёт; через
 * `REINFORCER_CHOICE_TIMEOUT_MS` экран предлагает выбрать взрослому.
 */
export function nextStep(
  state: AbaSessionState,
  now: number,
): { state: AbaSessionState; step: AbaStep; participation: boolean; exchanged: number } {
  const before = state.tokensEarned;
  const done = (st: AbaSessionState, step: AbaStep) => ({
    state: st,
    step,
    participation: st.tokensEarned > before,
    exchanged: exchangedSince(st, state),
  });
  let st = state;
  const paused = st.breakStartedAt !== null || st.accessStartedAt !== null;
  if (st.endReason === null && !paused && workedMs(st, now) >= st.timeLimitMs) {
    st = closeOut(st, 'time_limit', now);
  }
  while (st.queue[0]?.kind === 'block_end') st = endBlock(st, now).state;
  if (st.queue.length === 0 && st.endReason === null) st = closeOut(st, 'completed', now);
  // доступ к подкрепителю отложил закрытие — сессия всё равно кончается успехом
  if (st.queue.length === 0 && st.endReason !== null && CLOSABLE.has(st.endReason)) st = ensureSuccessfulEnd(st, now);

  const pause = st.pendingPauseMs;
  const head = st.queue[0];
  if (!head) {
    const last = lastTrial(st);
    const pairingCycle = needsPairingCycle(st);
    return done(
      { ...st, pendingPauseMs: 0 },
      {
        kind: 'end',
        reason: st.endReason ?? 'completed',
        endedOnSuccess: !last || SUCCESS.has(last.response),
        pairingCycle,
        pairingCycleAfterMs: pairingCycle ? PAIRING.tokenAfterMs : 0,
        pauseBeforeMs: pause,
      },
    );
  }
  switch (head.kind) {
    case 'reinforcer':
      return done(st, {
        kind: 'choose_reinforcer',
        options: st.reinforcerOptions,
        adultChoosesAfterMs: REINFORCER_CHOICE_TIMEOUT_MS,
      });
    case 'break':
      if (st.breakStartedAt === null) st = { ...st, breakStartedAt: now };
      return done({ ...st, pendingPauseMs: 0 }, { kind: 'break', canExchange: isBoardFull(st.board), pauseBeforeMs: pause });
    case 'access':
      if (st.accessStartedAt === null) st = { ...st, accessStartedAt: now };
      return done(st, { kind: 'access', durationMs: head.durationMs });
    case 'trial': {
      st = withField(st);
      const step = trialStep(st, (st.queue[0] as { trial: PlannedTrial }).trial);
      return done({ ...st, pendingPauseMs: 0 }, step);
    }
    case 'block_end':
      throw new Error('недостижимо: концы блоков сняты выше');
  }
}

/**
 * Ребёнок (или взрослый по таймауту) выбрал, за что работает сегодня. С этого момента
 * идёт время. Кто выбрал, пишется: выбор взрослого — не данные о предпочтениях ребёнка.
 */
export function chooseReinforcer(
  state: AbaSessionState,
  id: string,
  now: number,
  by: 'child' | 'adult' = 'child',
): AbaSessionState {
  if (state.queue[0]?.kind !== 'reinforcer') throw new Error('Сейчас не выбор подкрепителя');
  if (!state.reinforcerOptions.includes(id)) throw new Error(`Подкрепитель ${id} не предлагался`);
  return { ...state, reinforcerId: id, reinforcerChosenBy: by, workStartedAt: now, queue: state.queue.slice(1) };
}

/**
 * Перерыв кончился. Обмен — если доска полна; неполная переходит на следующий блок как
 * есть, жетоны не сгорают. Перерыв в рабочее время не идёт.
 */
export function finishBreak(state: AbaSessionState, now: number): { state: AbaSessionState; exchanged: number } {
  if (state.queue[0]?.kind !== 'break') throw new Error('Сейчас не перерыв');
  const startedAt = state.breakStartedAt ?? now;
  const { board, exchanged } = tryExchange(state.board);
  const events: AbaSessionEvent[] = [...state.events, { kind: 'break', startedAt: iso(startedAt), endedAt: iso(now) }];
  if (exchanged > 0) events.push({ kind: 'exchange', at: iso(now), tokens: exchanged });
  return {
    state: {
      ...state,
      board,
      exchangesMade: state.exchangesMade + (exchanged > 0 ? 1 : 0),
      pausedMs: state.pausedMs + (now - startedAt),
      breakStartedAt: null,
      events,
      queue: state.queue.slice(1),
    },
    exchanged,
  };
}

/**
 * Доступ к подкрепителю после обмена кончился. Пишется фактическое время: экран может
 * прервать или продлить доступ, и рабочее время не должно на этом теряться.
 */
export function finishAccess(state: AbaSessionState, now: number): AbaSessionState {
  if (state.queue[0]?.kind !== 'access') throw new Error('Сейчас не доступ к подкрепителю');
  const startedAt = state.accessStartedAt ?? now;
  return {
    ...state,
    pausedMs: state.pausedMs + (now - startedAt),
    accessStartedAt: null,
    events: [...state.events, { kind: 'access', startedAt: iso(startedAt), endedAt: iso(now) }],
    queue: state.queue.slice(1),
  };
}

/**
 * Взрослый остановил или ребёнок ушёл. Ни закрывающей пробы, ни жетона за участие:
 * решение принял человек, и подкреплять уход нельзя.
 */
export function stopSession(state: AbaSessionState, reason: 'adult_stopped' | 'abandoned'): AbaSessionState {
  return {
    ...state,
    endReason: state.endReason ?? reason,
    queue: [],
    participationOwed: null,
    breakStartedAt: null,
    accessStartedAt: null,
  };
}

function payParticipation(state: AbaSessionState, targetId: string, now: number): { state: AbaSessionState; paid: boolean } {
  const award = participationAward(state.board);
  if (award.tokens === 0) return { state, paid: false };
  const paid: AbaSessionState = {
    ...state,
    board: addTokens(state.board, award.tokens, true),
    tokensEarned: state.tokensEarned + award.tokens,
    events: [...state.events, { kind: 'participation', at: iso(now), targetId }],
  };
  return { state: settleBoard(paid, now).state, paid: true };
}

/**
 * Обучение доске: полная доска обменивается сразу, внутри блока. Доступ к подкрепителю
 * за обмен в рабочее время не идёт.
 */
function settleBoard(state: AbaSessionState, now: number): { state: AbaSessionState; exchanged: number } {
  if (!state.immediateExchange || !isBoardFull(state.board)) return { state, exchanged: 0 };
  const { board, exchanged } = tryExchange(state.board);
  const access: QueueItem = { kind: 'access', durationMs: EXCHANGE_ACCESS_MS[state.board.size] };
  return {
    state: {
      ...state,
      board,
      exchangesMade: state.exchangesMade + 1,
      events: [...state.events, { kind: 'exchange', at: iso(now), tokens: exchanged }],
      queue: [access, ...state.queue],
    },
    exchanged,
  };
}

/** Сессия без учебной и освоенной цели — одна базовая линия: в конце цикл сопряжения. */
function needsPairingCycle(state: AbaSessionState): boolean {
  const reason = state.endReason;
  // в «сам» высоковероятные пробы бывают без жетона («Tali послушал») — их не считаем
  const paying = state.highPTargetIds.some((id) => counts(state.targets[id], state.config));
  return (
    state.teachingTargetIds.length === 0 && !paying && (reason === 'completed' || reason === 'time_limit')
  );
}

/** Снять конец блока; обучающий блок получает жетон за участие. */
function endBlock(state: AbaSessionState, now: number): { state: AbaSessionState; paid: boolean } {
  const head = state.queue[0];
  if (head?.kind !== 'block_end') return { state, paid: false };
  const st = { ...state, queue: state.queue.slice(1), openBlockTargetId: null };
  return head.participation ? payParticipation(st, head.targetId, now) : { state: st, paid: false };
}

/**
 * Перейти к завершению: план снимается. Если остановка или лимит оборвали начатый
 * обучающий блок, жетон за участие ему положен — после успешной закрывающей пробы.
 */
function closeOut(
  state: AbaSessionState,
  reason: AbaSessionEndReason,
  now: number,
  brokenTargetId?: string,
): AbaSessionState {
  const closed: AbaSessionState = {
    ...state,
    endReason: state.endReason ?? reason,
    brokenTargetId: brokenTargetId ?? state.brokenTargetId,
    participationOwed: state.openBlockTargetId,
    openBlockTargetId: null,
    // доступ к подкрепителю после обмена у ребёнка не отнимается
    queue: state.queue.filter((q) => q.kind === 'access'),
    breakStartedAt: null,
  };
  return ensureSuccessfulEnd(closed, now);
}

/** Причины, при которых сессия закрывается успешной пробой. Уход и остановка взрослым — нет. */
const CLOSABLE: ReadonlySet<AbaSessionEndReason> = new Set(['completed', 'time_limit', 'breakdown']);

const lastTrial = (state: AbaSessionState) => [...state.trials].reverse().find((t) => t.response !== 'interrupted');

/**
 * Последнее событие сеанса ассоциируется с сеансом, поэтому сессия кончается успешной
 * пробой (самостоятельный, подсказанный или приближение). Закрывающая проба (`closing`):
 *
 * 1. со взрослым, после остановки — полная модель той цели на экземпляре провала (у
 *    цепочки — то звено), с просьбой к взрослому помочь (L4): полная модель без L4
 *    после трёх провалов на ней дала бы четвёртый и пятый;
 * 2. иначе — высоковероятная проба освоенной цели (не цепочки, не на поддержании);
 * 3. иначе — повтор последней успешной пробы сессии: та же цель, экземпляр, уровень.
 *
 * Не больше `MAX_CLOSING_ATTEMPTS`; не удалось — спокойный конец без требования.
 */
function ensureSuccessfulEnd(state: AbaSessionState, now: number): AbaSessionState {
  const last = lastTrial(state);
  if (!last) return { ...state, participationOwed: null };
  if (SUCCESS.has(last.response)) {
    if (!state.participationOwed) return state;
    const paid = payParticipation(state, state.participationOwed, now).state;
    return { ...paid, participationOwed: null };
  }
  if (state.closingAttempts >= MAX_CLOSING_ATTEMPTS) return { ...state, participationOwed: null };

  const r = seeded(state.seed);
  let trial: PlannedTrial | null = null;
  const broken = state.brokenTargetId;
  if (state.closingAttempts === 0 && broken && state.config === 'with_adult') {
    const failed = [...state.trials].reverse().find((t) => t.targetId === broken && !SUCCESS.has(t.response));
    if (failed) {
      trial = {
        kind: 'closing',
        targetId: broken,
        exemplarId: failed.exemplarId,
        ...(failed.stepId ? { stepId: failed.stepId } : {}),
        ...(failed.runIndex !== undefined ? { runIndex: failed.runIndex } : {}),
        fixedStart: APP_MAX_PROMPT,
        adultAssist: true,
      };
    }
  }
  if (!trial && state.highPTargetIds.length) {
    trial = highPTrial(state.targets[pick(state.highPTargetIds, r.rng)], r.rng, 'closing');
  }
  if (!trial) {
    // стимул переноса и поддержания повтором делается знакомым — их не повторяем
    const ok = [...state.trials]
      .reverse()
      .find((t) => SUCCESS.has(t.response) && !MEASURING_KINDS.has(t.kind));
    if (ok) {
      trial = {
        kind: 'closing',
        targetId: ok.targetId,
        exemplarId: ok.exemplarId,
        ...(ok.stepId ? { stepId: ok.stepId } : {}),
        ...(ok.runIndex !== undefined ? { runIndex: ok.runIndex } : {}),
        fixedStart: clampToApp(ok.promptLevelUsed),
      };
    }
  }
  if (!trial) return { ...state, participationOwed: null, seed: r.seed() };
  return {
    ...state,
    closingAttempts: state.closingAttempts + 1,
    queue: [...state.queue.filter((q) => q.kind === 'access'), { kind: 'trial', trial: { ...trial, closes: 'session' } }],
    seed: r.seed(),
  };
}

/** Проба, как её записал экран. Жетоны проставляет сессия. */
export type AbaTrialInput = Omit<AbaTrial, 'tokens' | 'tokenReason'>;

export type RecordResult =
  | {
      ok: true;
      state: AbaSessionState;
      trial: AbaTrial;
      award: TokenAward;
      /** Жетон за участие: экран показывает его отдельным событием «за то, что занимался». */
      participation: boolean;
      /** Обучение доске: доска заполнилась и обменялась сразу — экран даёт доступ. */
      exchanged: number;
    }
  /** Запись противоречива или не та, что ждала сессия, — в лог она не идёт. */
  | { ok: false; errors: string[] };

function mismatch(input: AbaTrialInput, expected: TrialStep, state: AbaSessionState): string[] {
  const errors: string[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  if (input.sessionId !== state.sessionId) errors.push('проба из другой сессии');
  if (input.targetId !== expected.targetId) errors.push('не та цель');
  if (input.exemplarId !== expected.exemplarId) errors.push('не тот экземпляр');
  if (input.kind !== expected.trialKind) errors.push('не то назначение пробы');
  if (!same(input.stepId, expected.stepId)) errors.push('не то звено цепочки');
  if (!same(input.runIndex, expected.runIndex)) errors.push('не тот прогон цепочки');
  if (!same(input.sdVariantKey, expected.sdVariantKey)) errors.push('не та формулировка SD');
  if (!same(input.field, expected.field)) errors.push('не то поле карточек');
  if (!same(input.closes, expected.closes)) errors.push('не то, что закрывает проба');
  if (input.startPromptLevel !== expected.startPromptLevel) errors.push('не тот стартовый уровень');
  if (input.scoredBy !== expected.scoredBy) errors.push('не тот источник оценки');
  if (!expected.allowEscalation && input.promptLevelUsed !== input.startPromptLevel) {
    errors.push('подсказка в пробе, которая измеряет');
  }
  if (input.promptLevelUsed === 4 && !expected.askAdultForL4) errors.push('L4 без просьбы к взрослому');
  // минимизация: громкость — только там, где она и есть критерий
  if (input.loudnessDb !== undefined && state.targets[expected.targetId].format !== 'voice_volume') {
    errors.push('громкость пишется только в целях на громкость');
  }
  return errors;
}

/**
 * Записать пробу.
 *
 * Перед записью — проверка: проба та, что ждала сессия, и не противоречит сама себе
 * (`trialInvariantErrors`). Иначе данные о затухании молча портятся.
 *
 * Потом:
 * - жетон по дифференциальной схеме (`awardForTrial`);
 * - проба без права на критерий (устройство без точности) не меняет в состоянии цели
 *   ничего: ни затухания, ни остановки, ни коррекции — иначе затухание, выросшее на
 *   непроверенных ответах, перейдёт в сессии со взрослым;
 * - **остановка** — три провала подряд на полной модели: план снимается, дальше
 *   закрывающая проба;
 * - **коррекция** — провал обучающей пробы: проба на уровне из `correctionLevel` (не L0,
 *   не ниже только что понадобившегося; не ответил и на полной модели — шаг
 *   пропускается) → отвлекающая высоковероятная проба другой, освоенной цели →
 *   проба переноса того же экземпляра на стартовом уровне. Освоенных нет — вместо
 *   отвлекающей нейтральная пауза. У цепочки коррекции нет: следующий прогон и есть
 *   перенос, а звено, проваленное и на полной модели, взрослый выполняет с ребёнком (L4).
 * - дошли до конца обучающего блока — жетон за участие.
 */
export function recordTrial(state: AbaSessionState, input: AbaTrialInput, now: number): RecordResult {
  const head = state.queue[0];
  if (head?.kind !== 'trial') return { ok: false, errors: ['сессия сейчас не ждёт пробу'] };
  if (state.targets[head.trial.targetId].format === 'identify' && !head.trial.field) {
    return { ok: false, errors: ['поле карточек ещё не выложено: сначала nextStep'] };
  }
  const expected = trialStep(state, head.trial);
  const target = state.targets[input.targetId] ?? state.targets[expected.targetId];
  const targetState = state.states[target.id];
  const countsHere = COUNTS_TOWARD_MASTERY[input.scoredBy];

  const r = seeded(state.seed);
  const award = awardForTrial(input, {
    phase: targetState.phase,
    schedule: state.schedule,
    board: state.board,
    rng: r.rng,
    highPTokenPaid: state.highPTokenPaid,
    counts: countsHere,
  });
  const trial: AbaTrial = { ...input, tokens: award.tokens, ...(award.reason ? { tokenReason: award.reason } : {}) };
  const errors = [...mismatch(input, expected, state), ...trialInvariantErrors(trial)];
  if (errors.length) return { ok: false, errors };

  let st: AbaSessionState = {
    ...state,
    trials: [...state.trials, trial],
    queue: state.queue.slice(1),
    board: addTokens(state.board, award.tokens, award.nonContingent === true),
    tokensEarned: state.tokensEarned + award.tokens,
    schedule: award.schedule,
    highPTokenPaid: state.highPTokenPaid || (trial.kind === 'high_p' && award.tokens > 0),
    states: countsHere ? { ...state.states, [trial.targetId]: applyTrialToFading(targetState, trial) } : state.states,
    // блок набора — один блок: участие пишется на набор, как и в конце половины
    openBlockTargetId:
      trial.kind === 'teaching'
        ? (state.set?.memberIds.includes(trial.targetId) ? state.set.id : trial.targetId)
        : state.openBlockTargetId,
    seed: r.seed(),
  };
  const exchangesBefore = state.exchangesMade;

  const failed = trial.response === 'incorrect' || trial.response === 'no_response';
  if (countsHere && st.endReason === null) {
    const counted = st.trials.filter((t) => COUNTS_TOWARD_MASTERY[t.scoredBy]);
    if (isBreakdown(counted, trial.targetId)) {
      st = closeOut(st, 'breakdown', now, trial.targetId);
    } else if (failed && trial.kind === 'teaching' && !trial.stepId) {
      st = st.set?.memberIds.includes(trial.targetId)
        ? { ...st, queue: setCorrection(st, trial) }
        : { ...st, queue: [...correctionFor(st, trial), ...st.queue] };
    }
  }

  st = bridgeFailedBlock(st, trial);

  let participation = false;
  while (st.queue[0]?.kind === 'block_end') {
    const ended = endBlock(st, now);
    st = ended.state;
    participation ||= ended.paid;
  }
  if (st.endReason !== null && st.queue.length === 0) {
    const before = st.tokensEarned;
    st = ensureSuccessfulEnd(st, now);
    participation ||= st.tokensEarned > before;
  }
  // обмен при обучении доске — после всего: доступ встаёт первым в очереди
  st = settleBoard(st, now).state;

  const exchanged = st.exchangesMade > exchangesBefore ? exchangedSince(st, state) : 0;
  return { ok: true, state: st, trial, award, participation, exchanged };
}

/**
 * Блок не кончается провалом: за концом блока идут жетон за участие или перерыв, и
 * провал сопрягался бы с уходом — «перерыв за неудачу». Если последняя проба перед таким
 * концом блока провалена (любая, кроме закрывающей), встаёт закрывающая проба блока:
 *
 * - высоковероятная проба освоенной цели;
 * - после провала **базовой линии** — не полная модель той же цели (базовая линия
 *   превратилась бы в обучение), а участник набора в обучении на его стартовом уровне;
 * - иначе — полная модель того же экземпляра (со взрослым — с его помощью);
 * - базовая линия, и закрыть нечем — нейтральная пауза перед концом блока.
 *
 * Одна на блок.
 */
function bridgeFailedBlock(state: AbaSessionState, last: AbaTrial): AbaSessionState {
  const head = state.queue[0];
  if (head?.kind !== 'block_end' || head.bridged) return state;
  if (head.targetId !== last.targetId && !head.members?.includes(last.targetId)) return state;
  if (!head.participation && state.queue[1]?.kind !== 'break') return state;
  if (last.kind === 'closing' || (last.response !== 'incorrect' && last.response !== 'no_response')) return state;

  const r = seeded(state.seed);
  const mark = (q: QueueItem[]) => ({ ...state, queue: [...q, { ...head, bridged: true as const }, ...state.queue.slice(1)], seed: r.seed() });
  const others = state.highPTargetIds.filter((id) => id !== last.targetId);
  if (others.length) {
    return mark([{ kind: 'trial', trial: { ...highPTrial(state.targets[pick(others, r.rng)], r.rng, 'closing'), closes: 'block' } }]);
  }
  if (last.kind === 'baseline') {
    const learner = (state.set?.memberIds ?? []).find((id) => TEACHING_PHASES.has(state.states[id].phase));
    if (!learner) return { ...mark([]), pendingPauseMs: NEUTRAL_PAUSE_MS };
    const t = state.targets[learner];
    return mark([
      {
        kind: 'trial',
        trial: {
          kind: 'closing',
          targetId: learner,
          exemplarId: pick(teachingExemplars(t), r.rng).id,
          fixedStart: clampToApp(state.states[learner].startPromptLevel),
          closes: 'block',
        },
      },
    ]);
  }
  return mark([
    {
      kind: 'trial',
      trial: {
        kind: 'closing',
        targetId: last.targetId,
        exemplarId: last.exemplarId,
        ...(last.stepId ? { stepId: last.stepId } : {}),
        ...(last.runIndex !== undefined ? { runIndex: last.runIndex } : {}),
        fixedStart: APP_MAX_PROMPT,
        closes: 'block',
        ...(state.config === 'with_adult' ? { adultAssist: true as const } : {}),
      },
    },
  ]);
}

/** Сколько жетонов ушло в обмены между двумя состояниями. */
function exchangedSince(after: AbaSessionState, before: AbaSessionState): number {
  return after.events
    .slice(before.events.length)
    .reduce((n, e) => n + (e.kind === 'exchange' ? e.tokens : 0), 0);
}

/**
 * Коррекция в наборе: проба коррекции → следующая плановая проба **другой инструкции**
 * (учебная, считается как обычно; отдельной высоковероятной не вставляется) → перенос
 * того же SD и экземпляра на стартовом уровне. Следующая плановая — той же инструкции:
 * переставляется ближайшая другая. Другой до конца половины нет — нейтральная пауза.
 */
function setCorrection(state: AbaSessionState, failed: AbaTrial): QueueItem[] {
  const [correction] = correctionFor({ ...state, highPTargetIds: [] }, failed).filter(
    (q) => q.kind === 'trial' && q.trial.kind === 'correction',
  );
  const queue = [...state.queue];
  const end = queue.findIndex((q) => q.kind !== 'trial');
  const limit = end < 0 ? queue.length : end;
  const differs = (q: QueueItem, kinds?: AbaTrialKind[]) =>
    q.kind === 'trial' && q.trial.targetId !== failed.targetId && (!kinds || kinds.includes(q.trial.kind));
  // отвлекающей лучше учебная или высоковероятная, чем проба базовой линии
  let j = queue.slice(0, limit).findIndex((q) => differs(q, ['teaching', 'high_p']));
  if (j < 0) j = queue.slice(0, limit).findIndex((q) => differs(q));
  const transfer: QueueItem = {
    kind: 'trial',
    trial: {
      kind: 'transfer',
      targetId: failed.targetId,
      exemplarId: failed.exemplarId,
      ...(j < 0 ? { pauseBeforeMs: NEUTRAL_PAUSE_MS } : {}),
    },
  };
  const head: QueueItem[] = correction ? [correction] : [];
  if (j < 0) return [...head, transfer, ...queue];
  const [distractor] = queue.splice(j, 1);
  // остаток половины — заново, чтобы после вставки не вышло трёх одинаковых инструкций подряд
  const cut = queue.findIndex((q) => q.kind !== 'trial');
  const rest = (cut < 0 ? queue : queue.slice(0, cut)) as Extract<QueueItem, { kind: 'trial' }>[];
  const tail = cut < 0 ? [] : queue.slice(cut);
  const before = [...state.trials.slice(-2), ...[...head, distractor, transfer].map((q) => (q as { trial: PlannedTrial }).trial)];
  const r = seeded(state.seed);
  const arranged = arrange(
    rest.map((q) => ({ targetId: q.trial.targetId, q })),
    r.rng,
    before,
  ).map((x) => x.q);
  return [...head, distractor, transfer, ...arranged, ...tail];
}

function correctionFor(state: AbaSessionState, failed: AbaTrial): QueueItem[] {
  const r = seeded(state.seed);
  const same = { targetId: failed.targetId, exemplarId: failed.exemplarId };
  const items: QueueItem[] = [];
  const withAdult = state.config === 'with_adult';
  const level = correctionLevel(state.states[failed.targetId], failed, state.targets[failed.targetId].format);
  // молчание и на полной модели: со взрослым — сразу его помощь (L4), без повтора модели
  const start: PromptLevel | null = level ?? (withAdult ? 4 : null);
  if (start !== null) {
    items.push({
      kind: 'trial',
      trial: {
        ...same,
        kind: 'correction',
        fixedStart: start,
        escalateOnIncorrect: true,
        ...(withAdult ? { adultAssist: true as const } : {}),
      },
    });
  }
  const others = state.highPTargetIds.filter((id) => id !== failed.targetId);
  if (others.length) items.push({ kind: 'trial', trial: highPTrial(state.targets[pick(others, r.rng)], r.rng) });
  items.push({
    kind: 'trial',
    trial: { ...same, kind: 'transfer', ...(others.length ? {} : { pauseBeforeMs: NEUTRAL_PAUSE_MS }) },
  });
  return items;
}

// ---------------------------------------------------------------------------
// Итог
// ---------------------------------------------------------------------------

type PhaseReason = Extract<AbaSessionEvent, { kind: 'phase' }>['reason'];

/**
 * Прогресс цели за последние `NO_PROGRESS_SESSIONS` сессий обучения. Ни снижения
 * стартового уровня (у цепочки — самого низкого из звеньев), ни роста доли
 * самостоятельных — флаг `no_progress` специалисту. Прогресс пошёл — флаг снимается.
 */
function applyProgress(s: AbaTargetState, target: AbaTarget, sessionIndex: number, rate: number): AbaTargetState {
  const start = target.steps?.length
    ? (Math.min(...target.steps.map((st) => promptStateOf(s, st.id).startPromptLevel)) as PromptLevel)
    : s.startPromptLevel;
  const progressWindow = [...(s.progressWindow ?? []), { sessionIndex, startPromptLevel: start, independentRate: rate }].slice(
    -NO_PROGRESS_SESSIONS,
  );
  const [first] = progressWindow;
  const last = progressWindow[progressWindow.length - 1];
  const stuck =
    progressWindow.length >= NO_PROGRESS_SESSIONS &&
    last.startPromptLevel >= first.startPromptLevel &&
    last.independentRate <= first.independentRate;
  const others = s.flags.filter((f) => f !== 'no_progress');
  return { ...s, progressWindow, flags: stuck ? [...others, 'no_progress'] : others };
}

/**
 * Пробы переноса или поддержания цели — по одной на прогон. У цепочки прогон — это все
 * звенья, и зачёт у него, только если все звенья выполнены самостоятельно: иначе
 * перенос «помыть руки» засчитывался бы по первому звену.
 */
function probesOf(target: AbaTarget, own: AbaTrial[], kind: 'generalization' | 'maintenance'): AbaTrial[] {
  const trials = own.filter((t) => t.kind === kind);
  if (!target.steps?.length) return trials;
  const runs = new Map<number, AbaTrial[]>();
  for (const t of trials) runs.set(t.runIndex ?? 0, [...(runs.get(t.runIndex ?? 0) ?? []), t]);
  return [...runs.values()]
    .filter((run) => (target.steps ?? []).every((st) => run.some((t) => t.stepId === st.id)))
    .map((run) => {
      const response: AbaResponse = run.every((t) => t.response === 'independent')
        ? 'independent'
        : run.some((t) => t.response === 'incorrect' || t.response === 'no_response')
          ? 'incorrect'
          : 'prompted';
      const used = Math.max(...run.map((t) => t.promptLevelUsed)) as PromptLevel;
      return { ...run[0], stepId: undefined, response, promptLevelUsed: used };
    });
}

/**
 * Навык цепочки распался на поддержании: каждое звено возвращается к уровню своего
 * последнего успеха в пробе поддержания, а не всё сразу к уровню цели.
 */
function rollbackSteps(before: AbaTargetState, after: AbaTargetState, target: AbaTarget, own: AbaTrial[]): AbaTargetState {
  const probe = own.filter((t) => t.kind === 'maintenance');
  const stepPrompts = Object.fromEntries(
    (target.steps ?? []).map((st) => {
      const t = probe.find((x) => x.stepId === st.id);
      const prev = promptStateOf(before, st.id);
      const level: PromptLevel =
        t?.response === 'independent'
          ? 0
          : t?.response === 'prompted'
            ? clampToApp(t.promptLevelUsed)
            : clampToApp(prev.lastSuccessfulPromptLevel);
      return [
        st.id,
        {
          startPromptLevel: level,
          lastSuccessfulPromptLevel: level,
          consecutiveIndependentAtStart: 0,
          consecutiveAboveStart: 0,
          consecutiveFailures: 0,
        },
      ];
    }),
  );
  return { ...after, stepPrompts };
}

export type AbaSessionResult = {
  session: AbaSession;
  /** Состояния всех целей программы: затронутые — новыми, прочие — как были. */
  states: Record<string, AbaTargetState>;
  trials: AbaTrial[];
  /** Доска на следующую сессию: жетоны не сгорают. */
  board: TokenBoard;
  /** Сколько жетонов ушло в обмен в конце. 0 — доска неполная или обмена по этой причине нет. */
  exchanged: number;
  /** Обучение доске после этой сессии. */
  tokenTraining: TokenTrainingState;
  /** Наборы `identify` после этой сессии. */
  identifySets: IdentifySet[];
};

/**
 * Итог сессии. В расчёт идут только пробы с правом на критерий.
 *
 * - Базовая линия — с чего начинать обучение (`applyBaseline`).
 * - Обучаемая цель — задержка по блоку, итог сессии для серии критерия (остановка рвёт
 *   серию только той цели, на которой сработала), проверка зависимости от подсказки.
 *   Выполнила критерий — в поддержание.
 * - Перенос и поддержание — их отдельные правила.
 * - Обмен в конце — только при полной доске и если сессия кончилась по плану, лимиту или
 *   остановке; после ухода или остановки взрослым подкрепитель сразу не приходит —
 *   доска ждёт первого перерыва следующей сессии.
 *
 * `pastSessions` — прошлые сессии цели для проверки зависимости, свежие в конце.
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

  const phaseEvents: AbaSessionEvent[] = [];

  for (const id of touched) {
    const target = state.targets[id];
    const own = state.trials.filter((t) => t.targetId === id && COUNTS_TOWARD_MASTERY[t.scoredBy]);
    const from = states[id].phase;
    let s: AbaTargetState = { ...states[id], lastSessionIndex: idx };
    let reason: PhaseReason | null = null;

    if (state.baselineTargetIds.includes(id)) {
      s = applyBaseline(s, own, idx, target);
      reason = 'baseline';
    }
    if (state.teachingTargetIds.includes(id)) {
      s = applyBlockToDelay(s, target, own.filter((t) => t.kind === 'teaching'));
      const endReason = state.brokenTargetId === id ? 'breakdown' : null;
      const summary = summarizeSession(target, own, endReason);
      s = applySession(s, summary, idx, day);
      if (summary.counted) s = applyProgress(s, target, idx, summary.independentRate);
    }
    if (state.set?.memberIds.includes(id)) s = { ...s, lastFieldSize: state.set.memberIds.length };
    for (const t of probesOf(target, own, 'generalization')) {
      s = { ...applyGeneralizationProbe(s, t), lastGeneralizationSessionIndex: idx };
    }
    for (const t of probesOf(target, own, 'maintenance')) {
      const before = s;
      s = applyMaintenanceProbe(s, t, idx);
      reason = s.phase === 'acquisition' ? 'maintenance_failed' : 'maintenance_passed';
      if (target.steps?.length && s.phase === 'acquisition') s = rollbackSteps(before, s, target, own);
    }
    if (TEACHING_PHASES.has(s.phase) && state.teachingTargetIds.includes(id)) {
      if (isMasteryMet(s)) {
        s = markMastered(s, idx);
        reason = 'criterion';
      } else if (isPromptDependent(s, [...(pastSessions[id] ?? []), { index: idx, trials: own }])) {
        s = applyPromptDependence(s, target, idx);
      }
    }
    if (reason && s.phase !== from) {
      phaseEvents.push({ kind: 'phase', at: iso(endedAt), targetId: id, from, to: s.phase, reason });
    }
    states[id] = s;
  }

  const canExchange = EXCHANGE_AT_END.has(state.endReason);
  const { board, exchanged } = canExchange ? tryExchange(state.board) : { board: state.board, exchanged: 0 };
  const exchangesMade = state.exchangesMade + (exchanged > 0 ? 1 : 0);
  const tokenTraining = applyStageSession(state.tokenTraining, state.band, {
    sessionIndex: idx,
    exchanges: exchangesMade,
    endReason: state.endReason,
  });
  const at = iso(endedAt);
  const events: AbaSessionEvent[] = [
    ...state.events,
    ...(exchanged > 0 ? [{ kind: 'exchange' as const, at, tokens: exchanged }] : []),
    ...(needsPairingCycle(state) ? [{ kind: 'pairing' as const, at }] : []),
    ...phaseEvents,
    ...(tokenTraining.stage !== state.tokenTraining.stage
      ? [{ kind: 'board_stage' as const, at, from: state.tokenTraining.stage, to: tokenTraining.stage }]
      : []),
  ];
  const last = lastTrial(state);

  return {
    session: {
      id: state.sessionId,
      index: idx,
      startedAt: iso(state.startedAt),
      endedAt: iso(endedAt),
      config: state.config,
      targetIds: [...new Set([...state.baselineTargetIds, ...state.teachingTargetIds])],
      reinforcerId: state.reinforcerId ?? '',
      reinforcerChosenBy: state.reinforcerChosenBy,
      tokensEarned: state.tokensEarned,
      exchangesMade,
      endReason: state.endReason,
      brokenTargetId: state.brokenTargetId,
      boardSize: state.board.size,
      endedOnSuccess: !last || SUCCESS.has(last.response),
      events,
    },
    states,
    trials: state.trials,
    board,
    exchanged,
    tokenTraining,
    identifySets: state.identifySets.map((x) => (x.id === state.set?.id ? { ...x, lastSetSessionIndex: idx } : x)),
  };
}
