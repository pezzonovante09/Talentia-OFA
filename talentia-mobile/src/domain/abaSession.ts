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
  ALONE_SILENT_TO_END,
  ALONE_SILENT_TO_OFFER_BREAK,
  INTERRUPTIONS_FOR_CONCERN,
  APP_MAX_PROMPT,
  CHILD_BREAKS_TO_END,
  CHILD_BREAK_MS,
  COUNTS_TOWARD_MASTERY,
  MAINTENANCE_GAP,
  ROUTINE,
  MASTERY,
  REFUSALS_TO_END,
  IOA_AFTER_FAILED_VERIFICATION,
  VERIFICATION_CHAIN_RUNS,
  VERIFICATION_TRIALS,
  REFUSAL_CARD_OFFER_MS,
  REFUSAL_QUIET_MS,
  UNRELIABLE_AFTER,
  VOICE_VOLUME_HOLD_MS,
  type AbaConfig,
  type AbaExemplar,
  type AbaFormat,
  type AbaIoaRecord,
  type AbaObserver,
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
  answerLevel,
  initialTargetState,
  isBreakdown,
  isPromptDependent,
  promptDelayMs,
  promptStateOf,
  responseWindowMs,
  trialInvariantErrors,
  type SessionTrials,
} from './abaPrompting';
import { scoreTrial, type ScoredFields } from './abaScoring';
import { applyChoiceBias, sessionSignals, type SessionSignal, type SignalSession } from './abaBarriers';
import {
  applyPlacementProbe,
  aloneFormatKey,
  formatUnlockedAlone,
  ladderBelow,
  placementCandidates,
  placementPassed,
} from './abaPlacement';
import { sessionParamsErrors, type AbaSessionParams } from './abaSessionParams';
import { ioaPasses, isVerified, masteryVerdict } from './abaIoa';
import {
  applyBaseline,
  applyGeneralizationProbe,
  applyMaintenanceProbe,
  applyRoutineBaseline,
  applyRoutineRun,
  applySession,
  BASELINE_CHAIN_RUNS,
  BASELINE_TRIALS,
  chainRuns,
  MATCH_BASELINE,
  generalizationPasses,
  isMaintenanceDue,
  isMasteryMet,
  isRoutine,
  isRoutineMaintenanceDue,
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
import { programErrors, targetErrors } from './abaTargetRules';
import { pick, seeded, shuffle } from './abaRandom';
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
  /** Поле `identify` и `match`; заполняется, когда проба становится текущей. */
  field?: string[];
  /** `match`: карточка-образец (она же верная); у сортировки — верная категория. */
  sampleCardId?: string;
  pauseBeforeMs?: number;
  /** Со взрослым: после полной модели попросить взрослого помочь (L4). */
  adultAssist?: true;
  /** Проба коррекции доводится до верного ответа при любом провале, не только при молчании. */
  escalateOnIncorrect?: true;
  /** Повтор пробы, снятой перерывом ребёнка или отказом. */
  requeuedFromTrialId?: string;
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
  /** Перерыв: по расписанию, по детской карточке или по отказу (тогда с потолком длительности). */
  | { kind: 'break'; initiatedBy?: 'child_card' | 'adult'; maxMs?: number; offerCardMs?: number; cardTaken?: true }
  /** Доступ к подкрепителю после обмена при обучении доске. */
  | { kind: 'access'; durationMs: number }
  /** Взрослый доводит прогон цепочки до конца без записи проб (снятая проверка сверху вниз). */
  | { kind: 'adult_finish_chain'; targetId: string; stepIds: string[] };

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
  /**
   * `match`: образец сверху — эта карточка, она же верная среди `field`; у сортировки — верная
   * категория, а образец — предмет `exemplarId`. Варианты неактивны, пока не коснулись образца.
   */
  sampleCardId?: string;
  startPromptLevel: PromptLevel;
  /**
   * Сколько ждать после конца SD до первой подсказки на старте L0; `null` — подсказки по
   * задержке нет (старт L1+, измерительные пробы, разогрев, закрывающая).
   *
   * Ход пробы на экране: SD → `promptDelayMs ?? responseWindowMs` → если ответа нет и
   * эскалация разрешена — подсказка → `responseWindowMs` → … Ответ до конца
   * `promptDelayMs` — самостоятельный.
   */
  promptDelayMs: number | null;
  /** Окно ответа после каждого предъявления, включая полную модель. */
  responseWindowMs: number;
  /** Только `voice_volume`: после начала звука — сколько ещё ждать удержания громкости. */
  voiceHoldMs?: number;
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
  | {
      kind: 'break';
      canExchange: boolean;
      pauseBeforeMs: number;
      /** Не по расписанию: по детской карточке или по отказу. Возврат — по действию ребёнка. */
      initiatedBy?: 'child_card' | 'adult';
      /** Потолок перерыва; ребёнок может закончить раньше. */
      maxMs?: number;
      /**
       * После отказа: столько подсвечена карточка «перерыв» (взрослый показывает на неё жестом).
       * Коснулся — `takeBreakCard`, полный перерыв; нет — тихая пауза до `maxMs`.
       */
      offerCardMs?: number;
    }
  /** Доступ к подкрепителю после обмена: экран показывает его и зовёт `finishAccess`. */
  | { kind: 'access'; durationMs: number }
  /**
   * Проверка сверху вниз снята посреди цепочки: рутина не обрывается (руки не остаются в мыле) —
   * экран просит взрослого довести оставшиеся звенья вместе с ребёнком. Проб не пишется; дальше —
   * `finishChainByAdult`.
   */
  | { kind: 'adult_finish_chain'; targetId: string; stepIds: string[] }
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
  physicalPromptAllowed: boolean;
  observers: AbaObserver[];
  primaryObserverId: string | null;
  /** Ребёнок сопротивлялся физическому ведению: до конца сессии L4 нет ни у одной цели. */
  l4Stopped: boolean;
  /** Просьбы о перерыве по детской карточке (перерывы по расписанию не в счёт). */
  childBreaks: number;
  /** «Отказ» от взрослого за сессию. */
  refusals: number;
  /** «Сам»: пробы подряд без активности устройства. */
  aloneSilentRun: number;
  /** «Сам»: по целям — пробы подряд с активностью, но без засчитанной реакции. */
  unreliableRun: Record<string, number>;
  /** Цели, снятые до конца сессии: измерение ненадёжно. Для них сессия нейтральна. */
  unreliableTargetIds: string[];
  band: AgeBand;
  /** Окно ответа по формату, удлинённое специалистом (`AbaSessionParams.responseWindowMs`). */
  windowOverrideMs?: Partial<Record<AbaFormat, number>>;
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
  /** Цели базовой линии на проверке сверху вниз — взятые планом из `placementCandidates`. */
  placementTargetIds: string[];
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
  /** Календарный день сессии (YYYY-MM-DD) — для поддержания рутин по дням; по умолчанию из `startedAt`. */
  day?: string;
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
  /** Параметры специалиста (решение №61, `abaSessionParams.ts`). */
  params?: AbaSessionParams;
  /**
   * Автоподбор старта без специалиста (решение №56): на свежих лестницах — проверка сверху вниз
   * (`abaPlacement.ts`). Со специалистом — выключен: стартовые цели выбирает он.
   */
  autoPlacement?: boolean;
  /**
   * Разрешена ли физическая подсказка (L4) — из ABA-состояния ребёнка, по умолчанию нет.
   * Включает специалист или родитель за PIN после правила «мягко направлять, прекращать при
   * сопротивлении» (ABA.md, «Условия приватности для блоков 4 и 5»).
   */
  physicalPromptAllowed?: boolean;
  /** Наблюдатели ребёнка (ABA-состояние, без имён). Есть обученный — освоение подтверждается. */
  observers?: AbaObserver[];
  /** Кто ведёт сессию; `null` в «Сам». */
  primaryObserverId?: string | null;
  startedAt: number;
  seed: number;
};

// ---------------------------------------------------------------------------
// План
// ---------------------------------------------------------------------------

const MASTERED_PHASES = new Set(['mastered', 'maintenance']);
const TEACHING_PHASES = new Set(['acquisition', 'generalization_check']);
const MEASURING_KINDS: ReadonlySet<AbaTrialKind> = new Set(['baseline', 'generalization', 'maintenance', 'verification']);
const SUCCESS: ReadonlySet<AbaResponse> = new Set(['independent', 'prompted', 'approximation']);
/** Причины, по которым в конце сессии бывает обмен. Уход и остановка взрослым — нет. */
// отказ не отнимает заработанное: обмен — как при лимите
const EXCHANGE_AT_END: ReadonlySet<AbaSessionEndReason> = new Set(['completed', 'time_limit', 'breakdown', 'assent_withdrawn']);

/**
 * Кто засчитывает пробу в этой конфигурации. «Со взрослым» — источник цели. «Сам» —
 * устройство: громкость для `voice_volume`, касание для `identify`, остальное — детектор
 * начала звука без права на критерий.
 */
export function sessionScoring(target: AbaTarget, config: AbaConfig): ScoringSource {
  if (config === 'with_adult') return target.scoredBy;
  if (target.format === 'voice_volume') return 'device_loudness';
  if (target.format === 'identify' || target.format === 'match') return 'device_tap';
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
    // рутина — один естественный прогон за сессию, а не три подряд (А8)
    return Array.from({ length: isRoutine(target) ? 1 : CHAIN_RUNS_PER_BLOCK }, (_, run) =>
      chainRun(target, { kind: 'teaching', targetId: target.id, exemplarId: at(run) }, run),
    ).flat();
  }
  if (target.matchMode === 'sort') return sortBlock(target, rng).map((exemplarId) => ({ kind: 'teaching' as const, targetId: target.id, exemplarId }));
  return Array.from({ length: target.blockSize }, (_, i) => ({
    kind: 'teaching' as const,
    targetId: target.id,
    exemplarId: at(i),
  }));
}

/**
 * Блок сортировки: категории поровну (в блоке 5 — 3/2, какой три — случайно; в 10 — 5/5), одна
 * категория не больше двух раз подряд; предметы категории — по кругу.
 */
function sortBlock(target: AbaTarget, rng: Rng): string[] {
  const [a, b] = shuffle([...target.sortCategories!], rng);
  const n = target.blockSize;
  const left: Record<string, number> = { [a]: Math.ceil(n / 2), [b]: Math.floor(n / 2) };
  const items = (c: string) => shuffle(teachingExemplars(target).filter((e) => e.category === c), rng);
  const queue: Record<string, AbaExemplar[]> = { [a]: items(a), [b]: items(b) };
  const out: string[] = [];
  const cats: string[] = [];
  for (let i = 0; i < n; i += 1) {
    const run = cats.length >= MAX_SAME_POSITION && cats.slice(-MAX_SAME_POSITION).every((c) => c === cats[cats.length - 1]);
    const options = [a, b].filter((c) => left[c] > 0 && !(run && c === cats[cats.length - 1]));
    // больше осталось — тот и первый: иначе в конце блока выпадет серия
    const c = (options.length ? options : [a, b].filter((x) => left[x] > 0)).sort((x, y) => left[y] - left[x])[0];
    const list = queue[c];
    const e = list[cats.filter((x) => x === c).length % list.length];
    left[c] -= 1;
    cats.push(c);
    out.push(e.id);
  }
  return out;
}

/**
 * Базовая линия: три пробы без подсказки минимум на двух обучающих экземплярах, между
 * ними — высоковероятные пробы, если есть освоенные. У цепочки — два прогона без
 * подсказок; проваленное звено выполняет взрослый, и прогон идёт дальше.
 */
function baselineBlock(target: AbaTarget, highP: AbaTarget[], rng: Rng): PlannedTrial[] {
  const at = rotation(target, rng);
  if (target.steps?.length) {
    // рутина — по прогону в сессию, базовая линия копится по дням (`applyRoutineBaseline`)
    return Array.from({ length: isRoutine(target) ? 1 : BASELINE_CHAIN_RUNS }, (_, run) =>
      chainRun(target, { kind: 'baseline', targetId: target.id, exemplarId: at(run) }, run),
    ).flat();
  }
  const out: PlannedTrial[] = [];
  const n = target.format === 'match' ? MATCH_BASELINE.trials : BASELINE_TRIALS;
  for (let i = 0; i < n; i += 1) {
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

/** Просрочка поддержания рутины — в днях, как и её интервалы. */
function routineOverdue(s: AbaTargetState, day: string): number {
  if (!s.lastMaintenanceDay) return ROUTINE.maintenanceGapDays[s.maintenanceGapIndex];
  const days = Math.round((Date.parse(day) - Date.parse(s.lastMaintenanceDay)) / 86_400_000);
  return days - ROUTINE.maintenanceGapDays[s.maintenanceGapIndex];
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
/** Полоса параметров специалиста — полоса сессии и каждой цели (решение №61). */
function withParamsBand(input: StartInput): StartInput {
  const band = input.params?.paramsBand;
  if (!band || band === input.band) return input;
  return { ...input, band, targets: input.targets.map((t) => ({ ...t, band })) };
}

/** Форма ответа: касанием, голосом или телом. */
const RESPONSE_FORM: Record<AbaFormat, 'tap' | 'voice' | 'body'> = {
  identify: 'tap',
  match: 'tap',
  imitate_sound: 'voice',
  repeat_word: 'voice',
  voice_volume: 'voice',
  say: 'voice',
  do_action: 'body',
};

/**
 * Цели на базовую линию: без повторов, не больше `room`; две — из разных областей и с разной формой
 * ответа (методист, 2026-10-02), иначе вторая ждёт следующей сессии.
 */
function baselineChoice(candidates: readonly AbaTarget[], room: number): AbaTarget[] {
  const out: AbaTarget[] = [];
  for (const t of candidates) {
    if (out.length >= room) break;
    if (out.some((x) => x.id === t.id || x.area === t.area || RESPONSE_FORM[x.format] === RESPONSE_FORM[t.format])) continue;
    out.push(t);
  }
  return out;
}

export function startAbaSession(raw: StartInput): AbaSessionState {
  const paramErrors = sessionParamsErrors(raw.params, raw.band);
  if (paramErrors.length) throw new Error(paramErrors.join('; '));
  // полоса параметров специалиста заменяет полосу профиля во всех параметрах сразу (№61)
  const input = withParamsBand(raw);
  const { config, band, sessionIndex } = input;
  // день сессии — для интервалов поддержания рутин (в днях, а не в сессиях)
  const sessionDay = input.day ?? new Date(input.startedAt).toISOString().slice(0, 10);
  const r = seeded(input.seed);
  const rng = r.rng;

  for (const t of input.targets) {
    const errors = targetErrors(t);
    if (errors.length) throw new Error(`Цель ${t.id}: ${errors.join('; ')}`);
  }
  const pools = [...poolErrors(input.targets), ...programErrors(input.targets)];
  if (pools.length) throw new Error(pools.join('; '));

  if (!input.tokenTraining.pairingDone) {
    throw new Error('Сопряжение не закончено: сначала сессия сопряжения, а не рабочая');
  }

  const states: Record<string, AbaTargetState> = {};
  for (const t of input.targets) states[t.id] = input.states[t.id] ?? initialTargetState(t);

  // В «сам» нет do_action и say: неверное слово получило бы то же последствие, что и верное.
  const offered = input.targets.filter((t) => !(config === 'alone' && (t.format === 'do_action' || t.format === 'say')));
  const isMastered = (id: string) => states[id] !== undefined && MASTERED_PHASES.has(states[id].phase);
  const ready = (t: AbaTarget) => counts(t, config) && (t.prerequisiteTargetIds ?? []).every(isMastered);
  // «Сам»: обучать новому — только в формате, освоенном со взрослым (№60); до этого — поддержание
  const teachableHere = (t: AbaTarget) => config !== 'alone' || formatUnlockedAlone(aloneFormatKey(t), input.targets, states);
  const maxTeaching = input.params?.maxTeachingTargets ?? MAX_TEACHING_TARGETS;

  const single = offered.filter((t) => t.format !== 'identify');
  // застрявшая цель уступает слот следующей по программе; сама — если больше некому
  const stuck = (t: AbaTarget) => Number(states[t.id].flags.includes('no_progress'));
  const regular = single
    .filter((t) => TEACHING_PHASES.has(states[t.id].phase) && ready(t) && teachableHere(t))
    .sort((a, b) => stuck(a) - stuck(b))
    .slice(0, maxTeaching);

  // identify — только набором. Набор занимает оба слота обучения; готовы и набор, и
  // обычные цели — сессии чередуются
  const identifySets = updateSets(input.identifySets ?? [], offered, states, sessionIndex, ready);
  // наборов несколько (пулов несколько) — давнее обучавшийся первым
  const candidate = teachableHere({ format: 'identify' } as AbaTarget)
    ? ([...identifySets].sort((a, b) => a.lastSetSessionIndex - b.lastSetSessionIndex)[0] ?? null)
    : null;
  const regularLast = Math.max(-1, ...regular.map((t) => states[t.id].lastSessionIndex));
  const set = candidate && (regular.length === 0 || candidate.lastSetSessionIndex <= regularLast) ? candidate : null;
  const setMembers = set ? set.memberIds.map((id) => input.targets.find((t) => t.id === id)!) : [];
  const teaching = set ? setMembers.filter((t) => TEACHING_PHASES.has(states[t.id].phase)) : regular;
  // 5–6: базовая линия занимает слоты обучения — иначе сессия малыша вдвое длиннее нормы
  const baselineRoom = Math.min(
    band === '5-6' ? maxTeaching - teaching.length : MAX_BASELINE_TARGETS,
    // на ступенях 1–2 обучения доске — не больше одной новой цели
    input.tokenTraining.stage <= 2 ? 1 : MAX_BASELINE_TARGETS,
  );
  const setBaselineLimit = input.tokenTraining.stage <= 2 ? 1 : MAX_BASELINE_TARGETS;
  // проверка сверху вниз — только цели из `placementCandidates`: цель специалиста поверх
  // неосвоенных предпосылок идёт обычной базовой линией (А21)
  const placement =
    set || !(input.autoPlacement && config === 'with_adult') ? [] : placementCandidates(single, states).filter((t) => counts(t, config));
  const baseline = set
    ? baselineMembers(set, states, setBaselineLimit).map((id) => setMembers.find((t) => t.id === id)!)
    : baselineChoice(
        [
          // проверка сверху вниз — первой: она может снять с лестницы сразу несколько целей
          ...placement,
          ...single.filter((t) => states[t.id].phase === 'baseline' && ready(t) && teachableHere(t)),
        ],
        Math.max(0, baselineRoom),
      );
  const placementTargetIds = baseline.filter((t) => placement.some((p) => p.id === t.id)).map((t) => t.id);
  const mastered = offered.filter((t) => isMastered(t.id));

  // освоено «дома, без проверки», а сессию ведёт обученный наблюдатель — проверочная проба
  // одной такой цели (давнее встречавшейся первой): 5 проб или у цепочки один полный прогон
  const primaryTrained =
    config === 'with_adult' && (input.observers ?? []).some((o) => o.id === input.primaryObserverId && o.trained);
  const toVerify = primaryTrained
    ? mastered
        .filter((t) => states[t.id].masteredBy === 'home_unverified' && counts(t, config))
        .sort((a, b) => states[a.id].lastSessionIndex - states[b.id].lastSessionIndex)[0]
    : undefined;

  const due = mastered
    .filter(
      (t) =>
        t.id !== toVerify?.id &&
        counts(t, config) &&
        (isRoutine(t) ? isRoutineMaintenanceDue(states[t.id], sessionDay) : isMaintenanceDue(states[t.id], sessionIndex)),
    )
    .sort((a, b) => {
      const retest = Number(states[b.id].maintenanceFailsInRow > 0) - Number(states[a.id].maintenanceFailsInRow > 0);
      const late = (t: AbaTarget) => (isRoutine(t) ? routineOverdue(states[t.id], sessionDay) : overdue(states[t.id], sessionIndex));
      return retest || late(b) - late(a);
    });

  // поддержание участника набора — внутри блока набора, первой его пробой
  const setDue = set ? due.filter((t) => set.memberIds.includes(t.id)).map((t) => t.id) : [];
  const probes: PlannedTrial[][] = [];
  const genTarget = teaching
    // у рутины экранных проб переноса нет: перенос — отметка взрослого вне экрана
    .filter((t) => !isRoutine(t) && needsGeneralizationProbe(states[t.id]))
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

  if (toVerify) {
    const at = rotation(toVerify, rng);
    probes.unshift(
      toVerify.steps?.length
        ? unit(toVerify, { kind: 'verification', targetId: toVerify.id, exemplarId: at(0) })
        : Array.from({ length: VERIFICATION_TRIALS }, (_, i): PlannedTrial => ({ kind: 'verification', targetId: toVerify.id, exemplarId: at(i) })),
    );
  }

  const maintenanceIds = [
    ...setDue,
    ...probes.filter((p) => p[0].kind === 'maintenance').map((p) => p[0].targetId),
    ...(toVerify ? [toVerify.id] : []),
  ];
  // для разогрева и отвлекающих — проверенные навыки, если они есть: непроверенный ненадёжен
  const highPAll = mastered.filter((t) => !t.steps?.length && !maintenanceIds.includes(t.id));
  const highPChecked = highPAll.filter((t) => states[t.id].masteredBy !== 'home_unverified');
  const highP = highPChecked.length ? highPChecked : highPAll;

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
    physicalPromptAllowed: input.physicalPromptAllowed === true,
    observers: input.observers ?? [],
    primaryObserverId: config === 'alone' ? null : (input.primaryObserverId ?? null),
    l4Stopped: false,
    childBreaks: 0,
    refusals: 0,
    aloneSilentRun: 0,
    unreliableRun: {},
    unreliableTargetIds: [],
    band,
    ...(input.params?.responseWindowMs ? { windowOverrideMs: input.params.responseWindowMs } : {}),
    startedAt: input.startedAt,
    workStartedAt: null,
    timeLimitMs: Math.min(input.timeLimitMs ?? Infinity, input.params?.timeLimitMs ?? SESSION_TIME_LIMIT_MS[band]),
    pausedMs: 0,
    breakStartedAt: null,
    accessStartedAt: null,
    pendingPauseMs: 0,
    targets: Object.fromEntries(input.targets.map((t) => [t.id, t])),
    states,
    baselineTargetIds: baseline.map((t) => t.id),
    placementTargetIds,
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

/** Можно ли сейчас просить взрослого о физической подсказке. */
function l4Available(state: AbaSessionState): boolean {
  return state.config === 'with_adult' && state.physicalPromptAllowed && !state.l4Stopped;
}

function trialStep(state: AbaSessionState, p: PlannedTrial): TrialStep {
  const target = state.targets[p.targetId];
  const s = state.states[p.targetId];
  const planned: PromptLevel =
    p.fixedStart ?? (MEASURING_KINDS.has(p.kind) ? 0 : clampToApp(promptStateOf(s, p.stepId).startPromptLevel));
  // старт 4 — только с просьбой к взрослому: коррекцию поставили до сопротивления или без
  // помощи взрослого — теперь это полная модель
  const start: PromptLevel = planned === 4 && !(l4Available(state) && p.adultAssist) ? APP_MAX_PROMPT : planned;
  const withAdult = state.config === 'with_adult';
  const own = responseWindowMs(target, p.stepId);
  const override = state.windowOverrideMs?.[target.format];
  // у звена — не короче его собственного окна: «закрыть кран» и «намылить» разной длины
  const windowMs = override ? Math.max(own, override) : own;
  return {
    kind: 'trial',
    trialKind: p.kind,
    targetId: p.targetId,
    exemplarId: p.exemplarId,
    ...(p.stepId ? { stepId: p.stepId } : {}),
    ...(p.runIndex !== undefined ? { runIndex: p.runIndex } : {}),
    ...(p.sdVariantKey ? { sdVariantKey: p.sdVariantKey } : {}),
    ...(p.field ? { field: p.field } : {}),
    ...(p.sampleCardId ? { sampleCardId: p.sampleCardId } : {}),
    startPromptLevel: start,
    promptDelayMs: promptDelayMs(s, target, p.kind, start, windowMs, p.stepId),
    responseWindowMs: windowMs,
    ...(target.format === 'voice_volume' ? { voiceHoldMs: VOICE_VOLUME_HOLD_MS } : {}),
    pauseBeforeMs: Math.max(p.pauseBeforeMs ?? 0, state.pendingPauseMs),
    scoredBy: sessionScoring(target, state.config),
    allowEscalation: p.kind !== 'generalization' && p.kind !== 'baseline' && p.kind !== 'verification',
    askAdultForL4: l4Available(state) && (p.adultAssist === true || (Boolean(p.stepId) && p.kind === 'teaching')),
    // звено цепочки: ошибка сразу поднимает уровень, цепочка завершается верно (блок 1)
    escalateOnIncorrect:
      p.escalateOnIncorrect === true || (Boolean(p.stepId) && (p.kind === 'teaching' || p.kind === 'transfer')),
    praiseAttentionBeforeSd: p.kind === 'baseline',
    adultCompletesOnFail:
      withAdult && Boolean(p.stepId) && (p.kind === 'baseline' || p.kind === 'generalization' || p.kind === 'verification'),
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
  if (target.format === 'match') return withMatchField(state, head.trial, target);
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
    .filter((t) => t.field && state.targets[t.targetId]?.format === 'identify')
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

/** Устойчивый хеш строки (djb2): одинаковый на всех устройствах. */
function stableHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Наименее использованное из `options`, кроме `avoid` (если есть другие); равные — случайно. */
function leastUsed<T>(options: readonly T[], used: readonly T[], rng: Rng, avoid: readonly T[] = []): T {
  const allowed = options.filter((o) => !avoid.includes(o));
  const pool = allowed.length ? allowed : options;
  const count = (o: T) => used.filter((u) => u === o).length;
  const min = Math.min(...pool.map(count));
  return pick(pool.filter((o) => count(o) === min), rng);
}

/**
 * Поле `match` (ABA.md, «Спецификация первой версии»). Сопоставление: образец — карточка экземпляра,
 * реже других бывшая образцом в этой сессии и не та же, что в прошлый раз (контрбалансировка: иначе
 * учится любимая карточка); его место в поле — реже других занятое верной у этой цели и не третий
 * раз подряд. Сортировка: поле — две карточки категорий, их порядок неизменен в сессии; верная —
 * категория предмета.
 */
function withMatchField(state: AbaSessionState, planned: PlannedTrial, target: AbaTarget): AbaSessionState {
  const r = seeded(state.seed);
  const before = state.trials.filter((t) => t.targetId === target.id && t.field);
  const exemplar = target.exemplars.find((e) => e.id === planned.exemplarId)!;
  let field: string[];
  let sample: string;
  if (target.matchMode === 'sort') {
    // порядок неизменен в сессии и меняется местами между сессиями **этой цели**: иначе позиция
    // совпадала бы с категорией, и смещение по позиции не отличить от предпочтения карточки.
    // Номер сессии не годится — обычные цели и наборы чередуются, и сортировка попадала бы всегда
    // на одну чётность (проверка методиста). Стартовый порядок — от id цели.
    const [a, b] = target.sortCategories!;
    const flip = (state.states[target.id].sortFlipped ? 1 : 0) ^ (stableHash(target.id) % 2);
    field = flip ? [b, a] : [a, b];
    sample = exemplar.category!;
  } else {
    const cards = exemplar.cards!;
    const samples = before.filter((t) => t.exemplarId === exemplar.id).map((t) => t.sampleCardId!);
    sample = leastUsed(cards, samples, r.rng, samples.slice(-1));
    const positions = before.map((t) => t.field!.indexOf(t.sampleCardId!));
    const last2 = positions.slice(-MAX_SAME_POSITION);
    const ban = last2.length === MAX_SAME_POSITION && last2.every((p) => p === last2[0]) ? [last2[0]] : [];
    const at = leastUsed(cards.map((_, i) => i), positions, r.rng, ban);
    const rest = shuffle(cards.filter((c) => c !== sample), r.rng);
    field = [...rest.slice(0, at), sample, ...rest.slice(at)];
  }
  const trial = { ...planned, field, sampleCardId: sample };
  return { ...state, queue: [{ kind: 'trial', trial }, ...state.queue.slice(1)], seed: r.seed() };
}

/**
 * Проверка сверху вниз требует 100%: после первой ошибки остаток её проб — провалы без пользы для
 * измерения и риск избегания. Остаток снимается; вместо него — высоковероятные пробы освоенных
 * целей, если они есть (методист, 2026-10-02).
 */
function stopPlacementOnFailure(state: AbaSessionState, trial: AbaTrial, r: { rng: Rng }): AbaSessionState {
  if (trial.kind !== 'baseline' || trial.response === 'independent' || trial.response === 'interrupted') return state;
  const target = state.targets[trial.targetId];
  if (!state.placementTargetIds.includes(target.id)) return state;
  // снимается весь остаток, у цепочки — и остаток прогона: его доводит взрослый, без записи
  const isRest = (q: QueueItem) => q.kind === 'trial' && q.trial.targetId === trial.targetId && q.trial.kind === 'baseline';
  const removedAt = state.queue.findIndex(isRest);
  if (removedAt < 0) return state;
  // вместе с остатком — высоковероятные, вставленные между его пробами (`baselineBlock`), и та, что
  // стоит сразу после проваленной: всё это один блок
  let lastRest = removedAt;
  state.queue.forEach((q, i) => {
    if (isRest(q)) lastRest = i;
  });
  const inBlock = (q: QueueItem, i: number) => i < lastRest && q.kind === 'trial' && q.trial.kind === 'high_p';
  const before = state.queue.slice(0, removedAt).filter((q, i) => !inBlock(q, i)).length;
  // у цепочки оставшиеся звенья текущего прогона доводит взрослый — без записи проб
  const runRest = trial.stepId
    ? state.queue.flatMap((q) => (isRest(q) && q.kind === 'trial' && q.trial.runIndex === trial.runIndex && q.trial.stepId ? [q.trial.stepId] : []))
    : [];
  let queue: QueueItem[] = state.queue.filter((q, i) => !(isRest(q) || inBlock(q, i)));
  if (runRest.length) queue = [...queue.slice(0, before), { kind: 'adult_finish_chain', targetId: trial.targetId, stepIds: runRest }, ...queue.slice(before)];
  const at = before + (runRest.length ? 1 : 0);
  // взамен — не больше двух высоковероятных проб освоенных целей
  const highP = state.highPTargetIds.map((id) => state.targets[id]);
  const fill: QueueItem[] = highP.length
    ? Array.from({ length: PLACEMENT_FILL_MAX }, () => ({ kind: 'trial' as const, trial: highPTrial(pick(highP, r.rng), r.rng) }))
    : [];
  // освоенных нет, а дальше снова измерение — сначала обучающая проба на её стартовом уровне
  const next = queue.slice(at).find((q) => q.kind === 'trial');
  const teach = state.teachingTargetIds.map((id) => state.targets[id]).find((t) => !t.steps?.length);
  if (!fill.length && next?.kind === 'trial' && MEASURING_KINDS.has(next.trial.kind) && teach) {
    fill.push({ kind: 'trial', trial: { kind: 'teaching', targetId: teach.id, exemplarId: pick(teachingExemplars(teach), r.rng).id } });
  }
  queue = [...queue.slice(0, at), ...fill, ...queue.slice(at)];
  return { ...state, queue };
}

/** Высоковероятных проб взамен снятой проверки сверху вниз — не больше. */
export const PLACEMENT_FILL_MAX = 2;

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
        endedOnSuccess: st.endReason !== 'assent_withdrawn' && (!last || SUCCESS.has(last.response)),
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
      return done(
        { ...st, pendingPauseMs: 0 },
        {
          kind: 'break',
          canExchange: isBoardFull(st.board),
          pauseBeforeMs: pause,
          ...(head.initiatedBy ? { initiatedBy: head.initiatedBy } : {}),
          ...(head.maxMs ? { maxMs: head.maxMs } : {}),
          ...(head.offerCardMs && !head.cardTaken ? { offerCardMs: head.offerCardMs } : {}),
        },
      );
    case 'access':
      if (st.accessStartedAt === null) st = { ...st, accessStartedAt: now };
      return done(st, { kind: 'access', durationMs: head.durationMs });
    case 'adult_finish_chain':
      return done({ ...st, pendingPauseMs: 0 }, { kind: 'adult_finish_chain', targetId: head.targetId, stepIds: head.stepIds });
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
  const head = state.queue[0];
  const events: AbaSessionEvent[] = [
    ...state.events,
    {
      kind: 'break',
      startedAt: iso(startedAt),
      endedAt: iso(now),
      initiatedBy: head.initiatedBy ?? 'schedule',
      ...(head.cardTaken ? { cardTaken: true as const } : {}),
    },
  ];
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
/** Взрослый довёл прогон цепочки до конца — данных нет, сессия идёт дальше. */
export function finishChainByAdult(state: AbaSessionState): AbaSessionState {
  if (state.queue[0]?.kind !== 'adult_finish_chain') throw new Error('Сейчас не доведение прогона взрослым');
  return { ...state, queue: state.queue.slice(1) };
}

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

/**
 * Сессия кончается по отказу ребёнка (блок 4, ABA.md): без закрывающей пробы-требования,
 * только сопряжение без жетона в доску; жетоны не сгорают и обмениваются в конце, как при
 * лимите. Экран зовёт её, когда после перерыва нет возврата (`RETURN_INVITE_AFTER_MS`,
 * повторное приглашение — тоже нет) или ребёнок отказывается вне пробы; внутри пробы отказ
 * приходит исходом журнала и разбирается в `recordTrial`.
 */
export function withdrawAssent(
  state: AbaSessionState,
  now: number,
  by: 'child_card' | 'adult_observed' | 'device_inactivity',
  where: { targetId?: string; trialId?: string } = {},
): AbaSessionState {
  if (state.endReason !== null) return state;
  const pausedMs = state.breakStartedAt !== null ? state.pausedMs + (now - state.breakStartedAt) : state.pausedMs;
  return {
    ...state,
    endReason: 'assent_withdrawn',
    queue: state.queue.filter((q) => q.kind === 'access'),
    participationOwed: null,
    openBlockTargetId: null,
    breakStartedAt: null,
    pausedMs,
    events: [
      ...state.events,
      { kind: 'assent', at: iso(now), by, action: state.workStartedAt === null ? 'not_started' : 'end', ...where },
    ],
  };
}

/**
 * Защитное окно после возврата с перерыва (решение методиста): открыто, пока в очереди ждёт
 * повтор снятой пробы, — в него входят и высоковероятная, и сам повтор. Карточка в окне
 * кончает сессию.
 */
function inGuardWindow(state: AbaSessionState): boolean {
  return state.queue.some((q) => q.kind === 'trial' && q.trial.requeuedFromTrialId !== undefined);
}

/**
 * Проба снята перерывом ребёнка или отказом (блок 4 и решения методиста после его проверки):
 * - карточка — полный перерыв, высоковероятная, та же проба снова; третья просьба или
 *   просьба в защитном окне — конец;
 * - отказ — требование снимается, карточка подсвечивается на `REFUSAL_CARD_OFFER_MS`:
 *   коснулся — полный перерыв (в счётчик карточек не идёт), нет — тихая пауза до
 *   `REFUSAL_QUIET_MS`; дальше тот же возврат; второй отказ — конец;
 * - сопротивление L4 — проба не возвращается, L4 выключается до конца сессии.
 */
function handleInterruption(state: AbaSessionState, trial: AbaTrial, planned: PlannedTrial, now: number): AbaSessionState {
  const where = { targetId: trial.targetId, trialId: trial.id };
  if (trial.interruptedBy === 'l4_resisted') {
    return {
      ...state,
      events: [...state.events, { kind: 'assent', at: iso(now), by: 'adult_observed', action: 'l4_stopped', ...where }],
    };
  }
  const child = trial.interruptedBy === 'child_break';
  if (!child && trial.interruptedBy !== 'assent') return state;

  const childBreaks = state.childBreaks + (child ? 1 : 0);
  const refusals = state.refusals + (child ? 0 : 1);
  const by = child ? ('child_card' as const) : ('adult_observed' as const);
  // в защитном окне любое прерывание — второй уход от того же требования (решение методиста)
  const ends = inGuardWindow(state) || (child ? childBreaks >= CHILD_BREAKS_TO_END : refusals >= REFUSALS_TO_END);
  if (ends) return withdrawAssent({ ...state, childBreaks, refusals }, now, by, where);

  const r = seeded(state.seed);
  const others = state.highPTargetIds.filter((id) => id !== trial.targetId);
  // повторяется исходная проба: повтор, снятый снова, ссылается на исходную
  const origin = planned.requeuedFromTrialId ?? trial.id;
  // высоковероятной нет — перед повтором нейтральная пауза, как в коррекции
  const again: QueueItem = {
    kind: 'trial',
    trial: { ...planned, requeuedFromTrialId: origin, ...(others.length ? {} : { pauseBeforeMs: NEUTRAL_PAUSE_MS }) },
  };
  const pause: QueueItem = child
    ? { kind: 'break', initiatedBy: 'child_card', maxMs: CHILD_BREAK_MS[state.band] }
    : { kind: 'break', initiatedBy: 'adult', maxMs: REFUSAL_QUIET_MS, offerCardMs: REFUSAL_CARD_OFFER_MS };
  const queue: QueueItem[] = [
    pause,
    ...(others.length ? [{ kind: 'trial' as const, trial: highPTrial(state.targets[pick(others, r.rng)], r.rng) }] : []),
    again,
    ...state.queue,
  ];
  return {
    ...state,
    childBreaks,
    refusals,
    queue,
    seed: r.seed(),
    events: [...state.events, { kind: 'assent', at: iso(now), by, action: 'break', ...where }],
  };
}

/**
 * После отказа ребёнок коснулся подсвеченной карточки (сам или после жеста взрослого) в
 * течение `REFUSAL_CARD_OFFER_MS`: тихая пауза становится полным перерывом. Пишется как ход
 * отказа, в счётчик карточек не идёт.
 */
export function takeBreakCard(state: AbaSessionState, now: number): AbaSessionState {
  const head = state.queue[0];
  if (head?.kind !== 'break' || !head.offerCardMs || head.cardTaken) throw new Error('Сейчас карточку не предлагали');
  const startedAt = state.breakStartedAt ?? now;
  if (now - startedAt > head.offerCardMs) throw new Error('Время предложения карточки вышло');
  return {
    ...state,
    queue: [{ ...head, cardTaken: true, maxMs: CHILD_BREAK_MS[state.band] }, ...state.queue.slice(1)],
  };
}

/**
 * «Сам»: у цели три пробы подряд с активностью, но без засчитанной реакции — измерение
 * ненадёжно: цель снимается до конца сессии (сессия для неё нейтральна). Не осталось проб —
 * конец с технической причиной, не отказ.
 */
function trackUnreliable(state: AbaSessionState, trial: AbaTrial, now: number): AbaSessionState {
  if (state.config !== 'alone') return state;
  const active = trial.presentationLog.some((p) => p.activity === true);
  const unscored = trial.response === 'no_response' && active;
  const run = unscored ? (state.unreliableRun[trial.targetId] ?? 0) + 1 : 0;
  const unreliableRun = { ...state.unreliableRun, [trial.targetId]: run };
  if (run < UNRELIABLE_AFTER || state.unreliableTargetIds.includes(trial.targetId)) return { ...state, unreliableRun };
  const queue = state.queue.filter((q) => !(q.kind === 'trial' && q.trial.targetId === trial.targetId));
  const next: AbaSessionState = {
    ...state,
    unreliableRun,
    unreliableTargetIds: [...state.unreliableTargetIds, trial.targetId],
    queue,
    events: [...state.events, { kind: 'measurement', at: iso(now), targetId: trial.targetId, action: 'unreliable' }],
  };
  if (queue.some((q) => q.kind === 'trial')) return next;
  return {
    ...next,
    endReason: 'unreliable_measurement',
    queue: queue.filter((q) => q.kind === 'access'),
    participationOwed: null,
    openBlockTargetId: null,
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
  // конец по отказу — без требования, только сопряжение без жетона в доску
  if (reason === 'assent_withdrawn') return true;
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
  // отказ, уход, остановка взрослым — без закрывающей пробы
  if (state.endReason !== null && !CLOSABLE.has(state.endReason)) return { ...state, participationOwed: null };
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
/**
 * Что присылает экран: всё о пробе, кроме того, что выводится из журнала предъявлений
 * (`ScoredFields`), и жетона — их считает сессия.
 */
export type AbaTrialInput = Omit<AbaTrial, 'tokens' | 'tokenReason' | keyof ScoredFields>;

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
      /** «Сам»: две пробы подряд без активности — Tali предлагает перерыв (детская карточка). */
      suggestBreak: boolean;
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
  if (!same(input.sampleCardId, expected.sampleCardId)) errors.push('не тот образец');
  // данные касаний — только у проб касанием, и выбранная карточка — из поля
  const touch = expected.field !== undefined;
  if (!touch && (input.chosenCardId !== undefined || input.tapCount !== undefined || input.fieldSizeAtResponse !== undefined)) {
    errors.push('касания пишутся только в пробах с полем карточек');
  }
  if (touch && input.chosenCardId !== undefined && !expected.field!.includes(input.chosenCardId)) errors.push('выбрана карточка не из поля');
  if (input.tapCount !== undefined && !(Number.isInteger(input.tapCount) && input.tapCount >= 0)) errors.push('число касаний — целое ≥ 0');
  if ((input.observingPrompted || input.observingLatencyMs !== undefined) && state.targets[expected.targetId].format !== 'match') {
    errors.push('реакция наблюдения — только у match');
  }
  if (!same(input.closes, expected.closes)) errors.push('не то, что закрывает проба');
  if (input.startPromptLevel !== expected.startPromptLevel) errors.push('не тот стартовый уровень');
  if (input.promptDelayMs !== expected.promptDelayMs) errors.push('не та задержка до подсказки');
  if (input.responseWindowMs !== expected.responseWindowMs) errors.push('не то окно ответа');
  if (input.scoredBy !== expected.scoredBy) errors.push('не тот источник оценки');
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
  const headFormat = state.targets[head.trial.targetId].format;
  if ((headFormat === 'identify' || headFormat === 'match') && !head.trial.field) {
    return { ok: false, errors: ['поле карточек ещё не выложено: сначала nextStep'] };
  }
  const expected = trialStep(state, head.trial);
  const target = state.targets[input.targetId] ?? state.targets[expected.targetId];
  const targetState = state.states[target.id];
  const countsHere = COUNTS_TOWARD_MASTERY[input.scoredBy];
  // сначала — та ли это проба, что ждала сессия: иначе журнал оценивался бы по чужому шагу
  const wrong = mismatch(input, expected, state);
  if (wrong.length) return { ok: false, errors: wrong };
  const scored = scoreTrial(input.presentationLog, {
    startPromptLevel: expected.startPromptLevel,
    scoredBy: expected.scoredBy,
    allowEscalation: expected.allowEscalation,
    escalateOnIncorrect: expected.escalateOnIncorrect,
    askAdultForL4: expected.askAdultForL4,
    chainStep: Boolean(expected.stepId),
    promptDelayMs: expected.promptDelayMs,
    responseWindowMs: expected.responseWindowMs,
  });
  if (!scored.ok) return { ok: false, errors: scored.errors };
  // образца не коснулись вовремя — дана L1, самостоятельной проба быть не может
  if (input.observingPrompted && scored.fields.response === 'independent') {
    return { ok: false, errors: ['после подсказки к образцу проба не бывает самостоятельной'] };
  }
  const full = { ...input, ...scored.fields };

  const r = seeded(state.seed);
  const award = awardForTrial(full, {
    phase: targetState.phase,
    schedule: state.schedule,
    board: state.board,
    rng: r.rng,
    highPTokenPaid: state.highPTokenPaid,
    counts: countsHere,
  });
  const trial: AbaTrial = {
    ...full,
    ...(head.trial.requeuedFromTrialId ? { requeuedFromTrialId: head.trial.requeuedFromTrialId } : {}),
    tokens: award.tokens,
    ...(award.reason ? { tokenReason: award.reason } : {}),
  };
  const errors = trialInvariantErrors(trial);
  if (errors.length) return { ok: false, errors };

  let st: AbaSessionState = {
    ...state,
    trials: [...state.trials, trial],
    queue: state.queue.slice(1),
    board: addTokens(state.board, award.tokens, award.nonContingent === true),
    tokensEarned: state.tokensEarned + award.tokens,
    schedule: award.schedule,
    highPTokenPaid: state.highPTokenPaid || (trial.kind === 'high_p' && award.tokens > 0),
    l4Stopped: state.l4Stopped || trial.interruptedBy === 'l4_resisted',
    states: countsHere ? { ...state.states, [trial.targetId]: applyTrialToFading(targetState, trial, state.targets[trial.targetId]) } : state.states,
    // блок набора — один блок: участие пишется на набор, как и в конце половины
    openBlockTargetId:
      trial.kind === 'teaching'
        ? (state.set?.memberIds.includes(trial.targetId) ? state.set.id : trial.targetId)
        : state.openBlockTargetId,
    seed: r.seed(),
  };
  const exchangesBefore = state.exchangesMade;

  // согласие ребёнка (блок 4): перерыв по карточке, «Отказ», сопротивление L4
  if (trial.response === 'interrupted') st = handleInterruption(st, trial, head.trial, now);
  st = trackUnreliable(st, trial, now);
  // «Сам»: пробы без всякой активности устройства подряд — предложить перерыв, потом конец
  const silent =
    st.config === 'alone' && trial.response === 'no_response' && !trial.presentationLog.some((p) => p.activity === true);
  st = { ...st, aloneSilentRun: silent ? st.aloneSilentRun + 1 : trial.response === 'interrupted' ? st.aloneSilentRun : 0 };
  if (st.endReason === null && st.aloneSilentRun >= ALONE_SILENT_TO_END) {
    st = withdrawAssent(st, now, 'device_inactivity', { targetId: trial.targetId, trialId: trial.id });
  }
  const suggestBreak = st.endReason === null && st.aloneSilentRun === ALONE_SILENT_TO_OFFER_BREAK;

  const failed = trial.response === 'incorrect' || trial.response === 'no_response';
  // цель только что снята как ненадёжная — сессия для неё нейтральна: ни срыва, ни коррекции
  if (countsHere && st.endReason === null && !st.unreliableTargetIds.includes(trial.targetId)) {
    const counted = st.trials.filter((t) => COUNTS_TOWARD_MASTERY[t.scoredBy]);
    if (isBreakdown(counted, trial.targetId)) {
      st = closeOut(st, 'breakdown', now, trial.targetId);
    } else if (failed && trial.kind === 'teaching' && !trial.stepId) {
      st = st.set?.memberIds.includes(trial.targetId)
        ? { ...st, queue: setCorrection(st, trial) }
        : { ...st, queue: [...correctionFor(st, trial), ...st.queue] };
    }
  }

  st = stopPlacementOnFailure(st, trial, r);
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
  return { ok: true, state: st, trial, award, participation, exchanged, suggestBreak };
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
  const level = correctionLevel(state.states[failed.targetId], failed, state.targets[failed.targetId]);
  // молчание и на полной модели: если L4 разрешена — одна полная модель, которую взрослый
  // сразу выполняет вместе с ребёнком (старт 4); иначе шаг пропускается
  const start: PromptLevel | null = level ?? (l4Available(state) ? 4 : null);
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
 *
 * Прерванная проба пробой не считается: звено, прерванное взрослым или приложением, давало
 * «провал поддержания» освоенной цели из-за сбоя, а не ребёнка (методист, 2026-10-09). Прогоны
 * — через `chainRuns`: по `runIndex`, прогон без какого-то звена неполон и не считается.
 */
/** Экспорт — для тестов (методист, 2026-10-09). */
export function probesOf(target: AbaTarget, own: AbaTrial[], kind: 'generalization' | 'maintenance'): AbaTrial[] {
  const probe = (t: AbaTrial) => t.kind === kind && t.response !== 'interrupted';
  if (!target.steps?.length) return own.filter(probe);
  return chainRuns(target, own, probe)
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
          currentDelayMs: prev.currentDelayMs,
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
  /**
   * Сигналы сессии (перебор, слабая мотивация) — если передана история сессий ребёнка
   * (`abaBarriers.sessionSignals`). Только сигнал специалисту и родителю.
   */
  signals?: SessionSignal[];
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
 * `pastSessions` — прошлые сессии цели для проверки зависимости, свежие в конце. `ioa` —
 * запись второго наблюдателя, если её внесли до итога; внесённую позже учитывает
 * `abaIoa.applyLateIoa`.
 *
 * Освоение цели, которую оценивает взрослый, — только с подтверждённой сессией в серии
 * (`masteryVerdict`, блок 5).
 */
/**
 * Итог проверочной пробы цели `home_unverified` (обученный наблюдатель):
 * - дискретная — 5 проб с L0; ≥ 80% самостоятельных — освоено по критерию и засчитано как
 *   пройденная проба поддержания; меньше — обучение: при 0–2 из 5 со старта первого уровня,
 *   несущего ответ, при 3 — с последнего успешного;
 * - цепочка — по одному полному прогону в сессию; решают два: каждый ≥ 80% звеньев сам и ни
 *   одно звено не провалено в обоих; иначе в обучение возвращаются только проваленные звенья
 *   (решения методиста 2026-10-01).
 * Прерванная или неполная проверка не решает ничего. После провала — `ioaDueSessions`.
 */
/** Экспорт — для тестов проверки (А26); в сессии вызывается из `finishAbaSession`. */
export function verificationVerdict(
  s: AbaTargetState,
  target: AbaTarget,
  own: AbaTrial[],
  idx: number,
): { state: AbaTargetState; reason: PhaseReason | null } | null {
  const v = own.filter((t) => t.kind === 'verification' && t.response !== 'interrupted');
  const passed = (st: AbaTargetState): { state: AbaTargetState; reason: PhaseReason } => ({
    state: {
      ...st,
      masteredBy: 'criterion',
      chainVerificationRuns: [],
      lastMaintenanceSessionIndex: idx,
      maintenanceGapIndex: Math.min(st.maintenanceGapIndex + 1, MAINTENANCE_GAP.length - 1) as AbaTargetState['maintenanceGapIndex'],
      maintenanceFailsInRow: 0,
    },
    reason: 'verification_passed',
  });
  const backToTeaching = (st: AbaTargetState): AbaTargetState => ({
    ...st,
    phase: 'acquisition',
    masteredBy: undefined,
    sessionsAtCriterion: 0,
    criterionDays: [],
    exemplarsAtCriterion: [],
    criterionSessions: [],
    chainVerificationRuns: [],
    ioaDueSessions: IOA_AFTER_FAILED_VERIFICATION,
  });

  const steps = target.steps ?? [];
  if (!steps.length) {
    if (v.length < VERIFICATION_TRIALS) return null;
    const independent = v.filter((t) => t.response === 'independent').length;
    if (independent / v.length >= MASTERY.minIndependentRate) return passed(s);
    const start = independent <= 2 ? answerLevel(target) : s.lastSuccessfulPromptLevel;
    return { state: { ...backToTeaching(s), startPromptLevel: start }, reason: 'verification_failed' };
  }

  // цепочка: прогон в зачёт, только если в нём есть все звенья
  if (!steps.every((st) => v.some((t) => t.stepId === st.id))) return null;
  const failedStepIds = steps.filter((st) => v.find((t) => t.stepId === st.id)!.response !== 'independent').map((st) => st.id);
  const runs = [
    ...(s.chainVerificationRuns ?? []),
    { sessionIndex: idx, failedStepIds, independentRate: (steps.length - failedStepIds.length) / steps.length },
  ];
  // первый прогон ещё ничего не решает: цепочка остаётся «получается дома»
  if (runs.length < VERIFICATION_CHAIN_RUNS) return { state: { ...s, chainVerificationRuns: runs }, reason: null };
  const [r1, r2] = runs.slice(-VERIFICATION_CHAIN_RUNS);
  const failedBoth = r1.failedStepIds.filter((id) => r2.failedStepIds.includes(id));
  if (runs.slice(-VERIFICATION_CHAIN_RUNS).every((r) => r.independentRate >= MASTERY.minIndependentRate) && !failedBoth.length) {
    return passed(s);
  }
  // в обучение — только звенья, проваленные хоть в одном прогоне; остальные — с L0
  const failedAny = new Set([...r1.failedStepIds, ...r2.failedStepIds]);
  const stepPrompts = Object.fromEntries(
    steps.map((st) => {
      const prev = promptStateOf(s, st.id);
      const level: PromptLevel = failedAny.has(st.id) ? answerLevel(target) : 0;
      return [
        st.id,
        { ...prev, startPromptLevel: level, lastSuccessfulPromptLevel: level, consecutiveIndependentAtStart: 0, consecutiveAboveStart: 0, consecutiveFailures: 0 },
      ];
    }),
  );
  return { state: { ...backToTeaching(s), stepPrompts }, reason: 'verification_failed' };
}

/** Проба цели снята (перерыв, отказ, сопротивление L4) и в этой сессии не предъявлена снова. */
function hasUnpresentedDrop(trials: readonly AbaTrial[], targetId: string): boolean {
  // повтор ссылается на исходную пробу; снятая проба (исходная или повтор, снятый снова)
  // предъявлена, если её исходную потом предъявили без прерывания
  const presented = new Set(trials.filter((t) => t.response !== 'interrupted').map((t) => t.requeuedFromTrialId));
  return trials.some(
    (t) =>
      t.targetId === targetId &&
      t.response === 'interrupted' &&
      t.interruptedBy !== undefined &&
      !presented.has(t.requeuedFromTrialId ?? t.id),
  );
}

/**
 * Тревожна ли сессия для цели: на её пробе было «Сопротивляется» или хотя бы два прерывания
 * пришлись на её пробы. Конец по тишине, отказ вне пробы и разбросанные по целям прерывания
 * цели не приписываются (решение методиста).
 */
/** Экспорт — для тестов (А26). */
export function isConcerning(own: readonly AbaTrial[]): boolean {
  const interrupted = own.filter(
    (t) => t.interruptedBy === 'child_break' || t.interruptedBy === 'assent' || t.interruptedBy === 'l4_resisted',
  );
  return interrupted.some((t) => t.interruptedBy === 'l4_resisted') || interrupted.length >= INTERRUPTIONS_FOR_CONCERN;
}

/**
 * Две тревожные сессии подряд (среди сессий, где цель предъявлялась) — флаг специалисту.
 * Спокойная обнуляет счётчик. Сам флаг не снимается — только `reviewAssentConcern`.
 */
function withAssentConcern(s: AbaTargetState, concern: boolean): AbaTargetState {
  const inRow = concern ? (s.assentSessionsInRow ?? 0) + 1 : 0;
  const flags = inRow >= 2 && !s.flags.includes('assent_concern') ? [...s.flags, 'assent_concern' as const] : s.flags;
  return { ...s, assentSessionsInRow: inRow, flags };
}

/**
 * Взрослый за PIN отметил «цель пересмотрена»: `assent_concern` снимается, счётчик
 * обнуляется, пишется роль снявшего (без имени).
 */
export function reviewAssentConcern(
  s: AbaTargetState,
  role: 'owner' | 'guardian' | 'specialist',
  at: string,
): AbaTargetState {
  return {
    ...s,
    flags: s.flags.filter((f) => f !== 'assent_concern'),
    assentSessionsInRow: 0,
    assentConcernReviewed: { role, at },
  };
}

export function finishAbaSession(
  state: AbaSessionState,
  day: string,
  endedAt: number,
  pastSessions: Readonly<Record<string, SessionTrials[]>> = {},
  ioa?: AbaIoaRecord,
  /** История сессий ребёнка (свежие в конце) и сигналы после прошлой — для сигналов сессии. */
  signalHistory?: { sessions: readonly SignalSession[]; previous: readonly SessionSignal[] },
): AbaSessionResult {
  if (state.endReason === null) throw new Error('Сессия ещё идёт');
  if (ioa && ioa.sessionId !== state.sessionId) throw new Error('IOA другой сессии');
  const observer = (id: string | null | undefined) => state.observers.find((o) => o.id === id) ?? null;
  const primary = observer(state.primaryObserverId);
  const secondary = ioa ? observer(ioa.secondaryObserverId) : null;
  const hasTrainedObserver = state.observers.some((o) => o.trained);
  const idx = state.sessionIndex;
  const states = { ...state.states };
  const touched = [
    ...new Set(state.trials.map((t) => t.targetId)),
  ];

  const phaseEvents: AbaSessionEvent[] = [];

  for (const id of touched) {
    const target = state.targets[id];
    const own = state.trials.filter((t) => t.targetId === id && COUNTS_TOWARD_MASTERY[t.scoredBy]);
    const from = states[id].phase;
    let s: AbaTargetState = { ...states[id], lastSessionIndex: idx };
    let reason: PhaseReason | null = null;

    // измерение ненадёжно — сессия для цели нейтральна в любой фазе
    const unreliable = state.unreliableTargetIds.includes(id);
    if (state.baselineTargetIds.includes(id) && !unreliable) {
      if (state.placementTargetIds.includes(id)) {
        // проверка сверху вниз: прошла — освоена, предпосылки по лестнице выведены
        const placed = applyPlacementProbe({ ...states, [id]: s }, Object.values(state.targets), target, own, idx, state.config);
        const passed = placementPassed(target, own);
        if (passed !== null) phaseEvents.push({ kind: 'placement', at: iso(endedAt), targetId: id, passed });
        for (const p of ladderBelow(target, Object.values(state.targets))) {
          if (placed[p.id] && states[p.id] && placed[p.id].phase !== states[p.id].phase) {
            phaseEvents.push({ kind: 'phase', at: iso(endedAt), targetId: p.id, from: states[p.id].phase, to: placed[p.id].phase, reason: 'inferred' });
          }
        }
        for (const [k, v] of Object.entries(placed)) if (k !== id) states[k] = v;
        s = placed[id];
      } else if (isRoutine(target)) {
        s = applyRoutineBaseline(s, own, day, idx, target, state.config);
      } else {
        s = applyBaseline(s, own, idx, target, state.config);
      }
      reason = 'baseline';
    }
    if (state.teachingTargetIds.includes(id)) {
      s = applyBlockToDelay(s, target, own.filter((t) => t.kind === 'teaching'));
      const endReason = state.brokenTargetId === id ? 'breakdown' : null;
      const raw = summarizeSession(target, own, endReason);
      // сессия, кончившаяся по отказу или со снятой и не предъявленной снова пробой, серию
      // не продлевает; «рвёт» по-прежнему рвёт
      const neutral =
        state.endReason === 'assent_withdrawn' || hasUnpresentedDrop(state.trials, id) || state.unreliableTargetIds.includes(id);
      const summary = neutral && raw.outcome === 'meets' ? { ...raw, outcome: 'neutral' as const } : raw;
      const result = ioa?.byTarget[id];
      const verified = isVerified({ primary, ...(secondary ? { ioa: { secondary, result } } : {}) });
      s = applySession(s, summary, idx, day, verified);
      // рутина: прогон — в окно критерия по дням; подтверждённая сессия даёт «освоено по критерию»
      const routineRun = isRoutine(target) && !neutral ? chainRuns(target, own.filter((t) => t.kind === 'teaching'))[0] : undefined;
      if (routineRun) {
        const before = s.phase;
        s = applyRoutineRun(s, routineRun, day, idx, verified ? 'criterion' : 'home_unverified', state.config);
        if (s.phase !== before) reason = 'criterion';
      }
      // оба обучены, а согласие ниже порога — определение цели допускает толкование
      if (primary?.trained && secondary?.trained && result && !ioaPasses(result) && !s.flags.includes('ioa_low')) {
        s = { ...s, flags: [...s.flags, 'ioa_low'] };
      }
      if (summary.counted) s = applyProgress(s, target, idx, summary.independentRate);
    }
    if (state.set?.memberIds.includes(id)) s = { ...s, lastFieldSize: state.set.memberIds.length };
    for (const t of unreliable ? [] : probesOf(target, own, 'generalization')) {
      s = { ...applyGeneralizationProbe(s, t), lastGeneralizationSessionIndex: idx };
    }
    for (const t of unreliable ? [] : probesOf(target, own, 'maintenance')) {
      const before = s;
      s = applyMaintenanceProbe(s, t, idx);
      if (isRoutine(target)) s = { ...s, lastMaintenanceDay: day };
      reason =
        before.masteredBy === 'inferred' && s.phase === 'baseline'
          ? 'inferred_not_confirmed'
          : t.response === 'independent'
            ? 'maintenance_passed'
            : 'maintenance_failed';
      if (target.steps?.length && s.phase === 'acquisition') s = rollbackSteps(before, s, target, own);
    }
    if (primary?.trained && !unreliable) {
      const verdict = verificationVerdict(s, target, own, idx);
      if (verdict) {
        s = verdict.state;
        if (verdict.reason) reason = verdict.reason;
      }
    }
    // после проваленной проверки — проверка IOA, пока сессии с целью не подтверждены
    if ((s.ioaDueSessions ?? 0) > 0 && reason !== 'verification_failed') {
      const result = ioa?.byTarget[id];
      if (isVerified({ primary, ...(secondary ? { ioa: { secondary, result } } : {}) }) && secondary) {
        s = { ...s, ioaDueSessions: (s.ioaDueSessions ?? 0) - 1 };
      }
    }
    if (TEACHING_PHASES.has(s.phase) && state.teachingTargetIds.includes(id)) {
      if (isMasteryMet(s)) {
        const verdict = masteryVerdict(target, s, hasTrainedObserver);
        if (verdict === 'needs_verification') {
          s = s.flags.includes('needs_verification') ? s : { ...s, flags: [...s.flags, 'needs_verification'] };
        } else {
          s = markMastered(s, idx, verdict, state.config);
          reason = 'criterion';
        }
      } else if (isPromptDependent(s, [...(pastSessions[id] ?? []), { index: idx, trials: own }])) {
        s = applyPromptDependence(s, target, idx);
      }
    }
    s = withAssentConcern(s, isConcerning(state.trials.filter((t) => t.targetId === id)));
    if (!unreliable) s = applyChoiceBias(s, biasWindow(state, id, pastSessions), target.format);
    // сортировка: в следующей сессии с целью карточки категорий меняются местами
    if (target.matchMode === 'sort' && own.some((t) => t.field)) s = { ...s, sortFlipped: !s.sortFlipped };
    if (reason && (s.phase !== from || reason === 'verification_passed')) {
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
      endedOnSuccess: state.endReason !== 'assent_withdrawn' && (!last || SUCCESS.has(last.response)),
      events,
      primaryObserverId: state.primaryObserverId,
    },
    states,
    trials: state.trials,
    board,
    exchanged,
    tokenTraining,
    identifySets: state.identifySets.map((x) => (x.id === state.set?.id ? { ...x, lastSetSessionIndex: idx } : x)),
    ...(signalHistory
      ? {
          signals: sessionSignals(
            [...signalHistory.sessions, { index: idx, trials: state.trials, formatOf: (id: string) => state.targets[id].format }],
            signalHistory.previous,
          ),
        }
      : {}),
  };
}

/**
 * Окно флагов смещения: у участника набора `identify` — пробы всего набора по сессиям (любимую
 * карточку видно на пробах других целей, а проб на L0 одной цели набора за три сессии мало); у
 * остальных — пробы цели.
 */
function biasWindow(state: AbaSessionState, id: string, pastSessions: Readonly<Record<string, SessionTrials[]>>): SessionTrials[] {
  const members = state.set?.memberIds.includes(id) ? state.set.memberIds : [id];
  const byIndex = new Map<number, AbaTrial[]>();
  for (const m of members) for (const x of pastSessions[m] ?? []) byIndex.set(x.index, [...(byIndex.get(x.index) ?? []), ...x.trials]);
  const past = [...byIndex].sort((a, b) => a[0] - b[0]).map(([index, trials]) => ({ index, trials }));
  const now = state.trials.filter((t) => members.includes(t.targetId) && COUNTS_TOWARD_MASTERY[t.scoredBy]);
  return [...past, { index: state.sessionIndex, trials: now }];
}
