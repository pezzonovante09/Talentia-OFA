/**
 * Прогон рутины самообслуживания — в её естественный момент, вне сессии (решение №74; раунд 2,
 * Р3, спецификация `aba-pedagogy-specialist` 2026-10-11). Взрослый в момент действия («перед
 * едой — руки») выбирает рутину из списка «ждут прогона» (`routinesDue`); вид прогона решается
 * при выборе (`routineRunKind`). Одна рутина — один прогон в календарный день.
 *
 * Здесь порядок прогона, а не правила звена: ожидаемая проба и сверка записи — общие с сессией
 * (`abaTrialStep.ts`), критерий — `abaCriterion.ts` (`applyRoutineRun`, `applyRoutineBaseline`,
 * `isRoutineMaintenanceDue`), затухание — `abaPrompting.ts`. Номер сессии прогон не двигает:
 * поддержание обычных целей считается по сессиям.
 *
 * Экран: `startRoutineRun` → `nextRoutineStep` / `recordRoutineStep` по звеньям (перерыв по
 * карточке и «Отказ» — шаг `break`, затем `resumeRoutineRun` и то же звено) → (`interruptRoutineRun`
 * → `finishRoutineByAdult`) → `finishRoutineRun` → `commitRoutineRun` (хранилище, Т1): сразу после
 * последнего звена — запись прогона с местом «как обычно», жетон и обмен по живой доске
 * (`settleRoutineBoard`). Затем форма «где и с кем»: отметка не «как обычно» — `commitRoutineSetting`
 * (Т2) пересчитывает итог прогона с этим местом; брошенная форма — «как обычно» (раунд 4, Д2).
 * Состояние — обычный объект с генератором (`seed`): прогон переживает сворачивание.
 */
import {
  CHILD_BREAK_MS,
  COUNTS_TOWARD_MASTERY,
  MAINTENANCE_GAP,
  REFUSAL_CARD_OFFER_MS,
  REFUSAL_QUIET_MS,
  ROUTINE_VERIFICATION_RUNS,
  type AbaObserver,
  type PromptLevel,
  type AbaRoutineRun,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
  type RoutineRunKind,
  type RoutineSetting,
} from '../types/aba';
import type { AgeBand } from '../types/task';
import {
  applyMaintenanceProbe,
  applyRoutineBaseline,
  applyRoutineBreakdown,
  applyRoutineRun,
  isRoutine,
  isRoutineMaintenanceDue,
  routineRunRecord,
} from './abaCriterion';
import {
  answerLevel,
  applyRoutineDependence,
  applyTrialToFading,
  clearDependenceOnMastery,
  initialTargetState,
  promptStateOf,
  routineDependentSteps,
  trialInvariantErrors,
  type SessionTrials,
} from './abaPrompting';
import { seeded } from './abaRandom';
import { MASTERED_PHASES, probesOf, rollbackSteps, TEACHING_PHASES, withAssentConcern } from './abaSession';
import { targetErrors } from './abaTargetRules';
import {
  addTokens,
  isBoardFull,
  MIN_REINFORCER_POOL,
  participationAward,
  reinforcerChoices,
  type TokenBoard,
} from './abaTokens';
import type { BoardStage, TokenTrainingState } from './abaTokenTraining';
import { buildTrialStep, scoreAgainst, type AbaTrialInput, type PlannedTrial, type TrialStep } from './abaTrialStep';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Ведущий наблюдатель обучен — освоение и проверка у цели взрослого подтверждаются им (блок 5). */
function primaryTrained(observers: readonly AbaObserver[] | undefined, primaryObserverId: string | null | undefined): boolean {
  return (observers ?? []).some((o) => o.id === primaryObserverId && o.trained);
}

/**
 * Вид прогона рутины сейчас: правила по порядку, срабатывает первое (методист, Р3, п. 3).
 * `null` — сегодня прогон уже был; `undefined` — рутины в списке нет (освоена, срок не подошёл).
 */
export function routineRunKind(
  s: AbaTargetState | undefined,
  day: string,
  ctx: { observers?: readonly AbaObserver[]; primaryObserverId?: string | null } = {},
): RoutineRunKind | null | undefined {
  if (s?.lastRoutineRunDay === day) return null;
  if (!s || s.phase === 'baseline') return 'baseline';
  if (TEACHING_PHASES.has(s.phase)) return 'teaching';
  if (MASTERED_PHASES.has(s.phase)) {
    // проверка «получается дома» — вместо поддержания в тот же день
    if (s.masteredBy === 'home_unverified' && primaryTrained(ctx.observers, ctx.primaryObserverId)) return 'verification';
    if (isRoutineMaintenanceDue(s, day)) return 'maintenance';
  }
  return undefined;
}

/**
 * Рутины, ждущие прогона: с освоенными предпосылками, в порядке программы — порядок стабилен,
 * выбор определяет момент, а не приоритет. «Сегодня уже было» (`kind: null`) — в конце, экран
 * показывает их неактивными. Освоенные без срока поддержания в список не входят: «ещё раз» не
 * предлагаем.
 */
export function routinesDue(input: {
  targets: readonly AbaTarget[];
  states: Readonly<Record<string, AbaTargetState>>;
  day: string;
  observers?: readonly AbaObserver[];
  primaryObserverId?: string | null;
}): { targetId: string; kind: RoutineRunKind | null; hint?: 'transfer' }[] {
  if (!DAY.test(input.day)) throw new Error('День прогона — локальная дата YYYY-MM-DD');
  const mastered = (id: string) => input.states[id] !== undefined && MASTERED_PHASES.has(input.states[id].phase);
  const rows = input.targets
    .filter((t) => isRoutine(t) && (t.prerequisiteTargetIds ?? []).every(mastered))
    .map((t) => ({
      targetId: t.id,
      kind: routineRunKind(input.states[t.id], input.day, input),
      // «почти освоено»: нужен прогон в другом месте или с другим взрослым (Г4); не напоминание, только метка в списке
      ...(input.states[t.id]?.flags.includes('needs_transfer') ? { hint: 'transfer' as const } : {}),
    }))
    .filter((r): r is { targetId: string; kind: RoutineRunKind | null; hint?: 'transfer' } => r.kind !== undefined);
  return [...rows.filter((r) => r.kind !== null), ...rows.filter((r) => r.kind === null)];
}

export type RoutineRunInput = {
  runId: string;
  /** Локальная дата устройства (`YYYY-MM-DD`) — считает вызывающий код (В5). */
  day: string;
  target: AbaTarget;
  state?: AbaTargetState;
  /** Полоса размера доски — та же, по которой считает сессия (с учётом параметров специалиста). */
  band: AgeBand;
  /**
   * Доски во входе нет: она общая с сессиями и живёт в `abaBoard`. Жетон и обмен прогона решает
   * `commitRoutineRun` по доске на момент фиксации (`settleRoutineBoard`), а не по снимку со старта.
   */
  tokenTraining: TokenTrainingState;
  reinforcerPool: string[];
  physicalPromptAllowed?: boolean;
  observers?: AbaObserver[];
  primaryObserverId: string | null;
  startedAt: number;
  seed: number;
  /**
   * Свёрнутый незаписанный прогон (`abaRoutineRunInProgress`), если есть. Второй прогон при
   * висящем начать нельзя (раунд 4, В5): экран предлагает продолжить или отменить
   * (`closeHangingRoutineRun`, затем запись).
   */
  pending?: RoutineRunState | null;
};

/**
 * Перерыв посреди прогона (раунд 4, Д3): по детской карточке — `CHILD_BREAK_MS` полосы; после
 * «Отказа» — тихая пауза `REFUSAL_QUIET_MS` с подсвеченной карточкой `offerCardMs`. Касание
 * подсвеченной карточки (`takeRoutineBreakCard`) — полный перерыв, но не просьба.
 */
export type RoutinePause =
  | { by: 'child_card'; maxMs: number }
  | { by: 'refusal'; maxMs: number; offerCardMs: number; cardTaken?: true };

/** Прерываний (просьба о перерыве или «Отказ», в любом сочетании), на котором прогон кончается. */
export const ROUTINE_INTERRUPTIONS_TO_END = 2;

export type RoutineRunState = {
  runId: string;
  day: string;
  kind: RoutineRunKind;
  target: AbaTarget;
  /** Состояние до прогона — для записи в окно и отката при внешнем обрыве. */
  before: AbaTargetState;
  state: AbaTargetState;
  physicalPromptAllowed: boolean;
  observers: AbaObserver[];
  primaryObserverId: string | null;
  /** Звенья в естественном порядке. */
  stepIds: string[];
  /** Сколько звеньев записано. */
  done: number;
  trials: AbaTrial[];
  band: AgeBand;
  reinforcerPool: string[];
  status: 'running' | 'adult_finish' | 'finished';
  interrupted: AbaRoutineRun['interrupted'];
  setting: RoutineSetting;
  startedAt: number;
  /**
   * Конец прогона — запись последнего звена или обрыв (раунд 4, Д2): длительность прогона не
   * включает передачу устройства, форму места и довод взрослым. `null` — прогон ещё идёт.
   */
  endedAt: number | null;
  /** Просьбы ребёнка о перерыве (карточка) за прогон. */
  requests: number;
  /** «Отказы» за прогон. */
  refusals: number;
  /** Идёт перерыв: звено ждёт его конца (`resumeRoutineRun`). */
  pause: RoutinePause | null;
  /** Проба звена, снятая перерывом или отказом: повтор того же звена ссылается на неё. */
  requeueOf: string | null;
  seed: number;
};

/** Начать прогон: вид прогона пересчитывается здесь же — списку на экране не доверяем. */
export function startRoutineRun(input: RoutineRunInput): RoutineRunState {
  const { target } = input;
  if (!DAY.test(input.day)) throw new Error('День прогона — локальная дата YYYY-MM-DD');
  if (!isRoutine(target)) throw new Error(`Цель ${target.id} — не рутина самообслуживания`);
  const errors = targetErrors(target);
  if (errors.length) throw new Error(`Цель ${target.id}: ${errors.join('; ')}`);
  // висящий прогон не теряется молча: его продолжают или отменяют и записывают (В5)
  if (input.pending) throw new Error(`Не записан прогон ${input.pending.runId}: продолжите или отмените его`);
  if (!input.tokenTraining.pairingDone) throw new Error('Сопряжение не закончено: сначала сессия сопряжения');
  if (input.reinforcerPool.length < MIN_REINFORCER_POOL) throw new Error(`Пул подкрепителей меньше ${MIN_REINFORCER_POOL}`);
  const state = input.state ?? initialTargetState(target);
  const kind = routineRunKind(state, input.day, input);
  if (kind === null) throw new Error(`Рутина ${target.id}: сегодня прогон уже был`);
  if (kind === undefined) throw new Error(`Рутина ${target.id}: прогона сейчас не ждёт`);
  return {
    runId: input.runId,
    day: input.day,
    kind,
    target,
    before: state,
    state,
    physicalPromptAllowed: input.physicalPromptAllowed === true,
    observers: input.observers ?? [],
    primaryObserverId: input.primaryObserverId,
    stepIds: [...target.steps!].sort((a, b) => a.order - b.order).map((s) => s.id),
    done: 0,
    trials: [],
    band: input.band,
    reinforcerPool: input.reinforcerPool,
    status: 'running',
    interrupted: null,
    setting: 'usual',
    startedAt: input.startedAt,
    endedAt: null,
    requests: 0,
    refusals: 0,
    pause: null,
    requeueOf: null,
    seed: input.seed,
  };
}

/**
 * Проба звена. Обучение — со стартового уровня звена, least-to-most; базовая линия и проверка —
 * без подсказок; поддержание — с L0 без эскалации (`measureOnly`). Несделанное звено в
 * измерительных прогонах доделывает взрослый (`adultCompleted`), ребёнок продолжает.
 */
function planned(run: RoutineRunState, stepId: string): PlannedTrial {
  const exemplarId = run.target.exemplars.find((e) => e.role === 'teaching')!.id;
  return {
    kind: run.kind,
    targetId: run.target.id,
    exemplarId,
    stepId,
    runIndex: 0,
    ...(run.kind === 'maintenance' ? { measureOnly: true as const } : {}),
  };
}

function expectedStep(run: RoutineRunState, stepId: string): TrialStep {
  return buildTrialStep(run.target, run.state, planned(run, stepId), {
    withAdult: true,
    l4Available: run.physicalPromptAllowed,
    scoredBy: 'adult',
    pendingPauseMs: 0,
  });
}

export type RoutineStep =
  | TrialStep
  /** Прогон оборван срывом: взрослый доводит оставшиеся звенья вместе с ребёнком, проб не пишется. */
  | { kind: 'adult_finish_chain'; targetId: string; stepIds: string[] }
  /** Перерыв посреди звена: по его концу — `resumeRoutineRun`, затем то же звено с SD. */
  | { kind: 'break'; by: RoutinePause['by']; maxMs: number; offerCardMs?: number }
  /** Звенья кончились: итог (Т1), затем отметка «где и с кем». */
  | { kind: 'end' };

export function nextRoutineStep(run: RoutineRunState): RoutineStep {
  if (run.status === 'adult_finish') return { kind: 'adult_finish_chain', targetId: run.target.id, stepIds: run.stepIds.slice(run.done) };
  if (run.status === 'finished' || run.done >= run.stepIds.length) return { kind: 'end' };
  if (run.pause) {
    const p = run.pause;
    return { kind: 'break', by: p.by, maxMs: p.maxMs, ...(p.by === 'refusal' && !p.cardTaken ? { offerCardMs: p.offerCardMs } : {}) };
  }
  return expectedStep(run, run.stepIds[run.done]);
}

export type RoutineRecordResult = { ok: true; run: RoutineRunState; trial: AbaTrial } | { ok: false; errors: string[] };

/**
 * Записать звено. Жетонов за звено нет: жетон — после прогона (`finishRoutineRun`). `now` — момент
 * записи: после последнего звена это конец прогона (`endedAt`, Д2).
 *
 * Прерванное звено (раунд 4, Д3; методист 2026-10-19, переспросить) — тоже проба звена, с
 * `interruptedBy`, и в зачёт не идёт:
 * - детская карточка — перерыв `CHILD_BREAK_MS` полосы, затем то же звено с SD (`requeuedFromTrialId`);
 * - «Отказ» — тихая пауза с подсвеченной карточкой, затем то же звено;
 * - второе прерывание за прогон (карточка или отказ в любом сочетании) и «Сопротивляется» — конец
 *   прогона `assent_withdrawn`: в окно и в срывы не идёт, день занят, жетона нет, остаток не пишется.
 * Внешний обрыв — не запись звена, а `interruptRoutineRun`.
 */
export function recordRoutineStep(run: RoutineRunState, input: AbaTrialInput, now: number): RoutineRecordResult {
  if (run.status !== 'running' || run.done >= run.stepIds.length) return { ok: false, errors: ['прогон сейчас не ждёт звено'] };
  if (run.pause) return { ok: false, errors: ['идёт перерыв: звено — после resumeRoutineRun'] };
  const expected = expectedStep(run, run.stepIds[run.done]);
  const checked = scoreAgainst(input, expected, run.runId, run.target.format);
  if (!checked.ok) return { ok: false, errors: checked.errors };
  // повтор снятого звена ссылается на снятую пробу — по состоянию прогона, а не по входу экрана
  const { requeuedFromTrialId: _r, ...full } = checked.full;
  const trial: AbaTrial = { ...full, ...(run.requeueOf ? { requeuedFromTrialId: run.requeueOf } : {}), tokens: 0 };
  const errors = trialInvariantErrors(trial);
  if (errors.length) return { ok: false, errors };
  const trials = [...run.trials, trial];

  if (trial.response === 'interrupted') {
    const ended = (): RoutineRunState => ({ ...run, trials, pause: null, requeueOf: null, status: 'finished', interrupted: 'assent_withdrawn', endedAt: now });
    if (trial.interruptedBy === 'l4_resisted') return { ok: true, trial, run: ended() };
    // прерывание взрослым или приложением — не просьба ребёнка: против него оно не пишется
    if (trial.interruptedBy !== 'child_break' && trial.interruptedBy !== 'assent') {
      return { ok: false, errors: ['обрыв по внешней причине — interruptRoutineRun, а не запись звена'] };
    }
    const child = trial.interruptedBy === 'child_break';
    const requests = run.requests + (child ? 1 : 0);
    const refusals = run.refusals + (child ? 0 : 1);
    if (requests + refusals >= ROUTINE_INTERRUPTIONS_TO_END) return { ok: true, trial, run: { ...ended(), requests, refusals } };
    const pause: RoutinePause = child
      ? { by: 'child_card', maxMs: CHILD_BREAK_MS[run.band] }
      : { by: 'refusal', maxMs: REFUSAL_QUIET_MS, offerCardMs: REFUSAL_CARD_OFFER_MS };
    return { ok: true, trial, run: { ...run, trials, requests, refusals, pause, requeueOf: trial.requeuedFromTrialId ?? trial.id } };
  }

  const counts = COUNTS_TOWARD_MASTERY[trial.scoredBy];
  const done = run.done + 1;
  return {
    ok: true,
    trial,
    run: {
      ...run,
      trials,
      done,
      requeueOf: null,
      endedAt: done >= run.stepIds.length ? now : run.endedAt,
      state: counts ? applyTrialToFading(run.state, trial, run.target) : run.state,
    },
  };
}

/** После «Отказа» ребёнок коснулся подсвеченной карточки: полный перерыв, но не просьба (Д3). */
export function takeRoutineBreakCard(run: RoutineRunState): RoutineRunState {
  const p = run.pause;
  if (!p || p.by !== 'refusal' || p.cardTaken) throw new Error('Подсвеченной карточки сейчас нет');
  return { ...run, pause: { ...p, maxMs: CHILD_BREAK_MS[run.band], cardTaken: true } };
}

/** Перерыв кончился: дальше то же звено с SD. */
export function resumeRoutineRun(run: RoutineRunState): RoutineRunState {
  if (!run.pause) throw new Error('Перерыва нет');
  return { ...run, pause: null };
}

/**
 * Обрыв прогона (В1). Срыв (проблемное поведение) — записанные звенья остаются, остаток
 * доводит взрослый (`adult_finish_chain`, без проб); в окно не идёт, день занят. Внешняя
 * причина (прервал взрослый) — записи остаются с пометкой, в окно и критерий не идут, день не
 * занят: иначе посторонний обрыв стал бы промахом ребёнка. `now` — конец прогона: довод взрослым
 * в длительность не входит.
 */
export function interruptRoutineRun(run: RoutineRunState, reason: 'breakdown' | 'external', now: number): RoutineRunState {
  if (run.status !== 'running') throw new Error('Прогон не идёт');
  // после последнего звена рутина уже сделана: обрыв стёр бы целый прогон (методист, Р3)
  if (run.done >= run.stepIds.length) throw new Error('Все звенья записаны: прогон обрывать нечего');
  const base = { ...run, pause: null, requeueOf: null, endedAt: now };
  if (reason === 'external') return { ...base, interrupted: 'external', status: 'finished' };
  return { ...base, interrupted: 'breakdown', status: 'adult_finish' };
}

/** Взрослый довёл оставшиеся звенья — проб не пишется. */
export function finishRoutineByAdult(run: RoutineRunState): RoutineRunState {
  if (run.status !== 'adult_finish') throw new Error('Довести прогон взрослому сейчас нечего');
  return { ...run, status: 'finished' };
}

/**
 * Висящий незаписанный прогон (свёрнут и брошен, или прошлого дня) — к записи (раунд 4, В5;
 * методист 2026-10-19): идущий — внешний обрыв (не промах ребёнка, день не занят); срыв, который
 * доводил взрослый, — срыв (сигнал о согласии не теряется); с записанным последним звеном или уже
 * законченный — как есть. Затем `finishRoutineRun` и запись.
 */
export function closeHangingRoutineRun(run: RoutineRunState, now: number): RoutineRunState {
  if (run.status === 'adult_finish') return { ...run, status: 'finished' };
  if (run.status === 'finished' || run.done >= run.stepIds.length) return run;
  return { ...run, pause: null, requeueOf: null, interrupted: 'external', status: 'finished', endedAt: now };
}

/** Где и с кем прошёл прогон — один выбор взрослого в конце (В3; по умолчанию — как обычно). */
export function setRoutineSetting(run: RoutineRunState, setting: RoutineSetting): RoutineRunState {
  return { ...run, setting };
}

/** Запись прогона без того, что решает доска на момент фиксации: жетон и обмен (`settleRoutineBoard`). */
export type RoutineRunRecordBase = Omit<AbaRoutineRun, 'token' | 'exchangeOffer'>;

/**
 * Заявка прогона на жетон: что он заработал по ходу. Доску прогон не трогает — выплату решает
 * `settleRoutineBoard` по живой доске (Р3): жетон за участие зависит от места на ней.
 */
export type RoutineClaim = {
  token: AbaRoutineRun['token'];
  tokens: 0 | 1;
  /** Жетон не за результат — идёт в счёт `nonContingent` и ограничен местом на доске. */
  nonContingent: boolean;
};

export type RoutineRunResult = {
  /** Пробы звеньев — уже записаны по ходу (`recordRoutineStep`); здесь для итога. */
  trials: AbaTrial[];
  state: AbaTargetState;
  /** Состояние цели до прогона: `commitRoutineRun` не пишет итог поверх чужой записи той же цели. */
  before: AbaTargetState;
  claim: RoutineClaim;
  record: RoutineRunRecordBase;
  /** Для расчёта в `commitRoutineRun`: полоса (размер доски), пул подкрепителей, затравка вариантов. */
  band: AgeBand;
  reinforcerPool: string[];
  seed: number;
  /** Законченный прогон и входы итога — для пересчёта с местом (Т2) и исправления последнего звена. */
  run: RoutineRunState;
  sessionIndex: number;
  history: RoutineHistory;
  /** Просьбы о перерыве в прогоне — на карточку ребёнка (`applyBreakCardRoutine`). */
  breakRequests: { requests: number; ended: boolean };
};

/**
 * Прогон записан (Т1), форма «где и с кем» открыта (`abaRoutineSettingOpen`): законченный прогон,
 * состояние цели после Т1 (для сверки перед пересчётом) и входы итога.
 */
export type RoutineSettingOpen = {
  run: RoutineRunState;
  t1State: AbaTargetState;
  sessionIndex: number;
  history: RoutineHistory;
};

/** Пересчитать итог записанного прогона с отметкой места (Т2): чистая, от состояния до прогона. */
export function routineResultWithSetting(open: RoutineSettingOpen, setting: RoutineSetting): RoutineRunResult {
  return finishRoutineRun(setRoutineSetting(open.run, setting), open.sessionIndex, open.history);
}

/**
 * Жетон после прогона — аналог №11 (методист, Р3, п. 8): обучение — за прогон, где каждое звено
 * сделано не выше своего стартового уровня без эскалации и без взрослого; поддержание и проверка —
 * только за прогон целиком сам; базовая линия — за участие, в пределах жетонов не за результат
 * (`size − 1` на цикл доски — проверяет `settleRoutineBoard`). Обрыв — без жетона; заработанные
 * жетоны не отнимаются.
 */
function routineClaim(run: RoutineRunState): RoutineClaim {
  const none: RoutineClaim = { token: null, tokens: 0, nonContingent: false };
  if (run.interrupted) return none;
  // проба, снятая просьбой о перерыве, в зачёт не идёт: одна просьба при всех звеньях «сам» — целиком сам (Д3)
  const steps = run.trials.filter((t) => t.response !== 'interrupted');
  const whole = steps.length === run.stepIds.length && steps.every((t) => t.response === 'independent');
  switch (run.kind) {
    case 'teaching': {
      const atStart =
        steps.length === run.stepIds.length &&
        steps.every(
          (t) => !t.adultCompleted && t.promptLevelUsed <= t.startPromptLevel && (t.response === 'independent' || t.response === 'prompted'),
        );
      return atStart ? { token: 'at_start_level', tokens: 1, nonContingent: false } : none;
    }
    case 'maintenance':
    case 'verification':
      return whole ? { token: 'whole_independent', tokens: 1, nonContingent: false } : none;
    case 'baseline':
      return { token: 'participation', tokens: 1, nonContingent: true };
  }
}

export type RoutineSettlement = {
  board: Pick<TokenBoard, 'earned' | 'nonContingent'>;
  /** Жетон, выплаченный на самом деле: за участие мог не поместиться на доску — тогда `null`. */
  token: AbaRoutineRun['token'];
  /**
   * Доска заполнилась — предложен обмен: экран даёт выбор из `options`. Доска при этом **не**
   * обнуляется: жетоны уходят только вместе с выбором (`commitRoutineExchange`).
   */
  offer?: { tokens: number; boardSize: BoardStage; options: string[] };
};

/**
 * Выплата по живой доске: заявка прогона ложится на доску, как она лежит на момент фиксации, а не
 * как лежала на старте (Р3). Участие — только пока на доске есть место для жетонов не за результат
 * (`participationAward`); размер доски — по текущей ступени; полная доска (`earned >= size`) —
 * обмен всех жетонов, варианты подкрепителей — по живой истории выборов и затравке прогона.
 */
export function settleRoutineBoard(
  live: Pick<TokenBoard, 'earned' | 'nonContingent'>,
  size: BoardStage,
  claim: RoutineClaim,
  ctx: { pool: string[]; history: string[]; seed: number },
): RoutineSettlement {
  const current: TokenBoard = { size, earned: live.earned, nonContingent: live.nonContingent };
  const paid = claim.nonContingent ? participationAward(current).tokens : claim.tokens;
  let board = addTokens(current, paid, claim.nonContingent);
  let offer: RoutineSettlement['offer'];
  // предложение — только если прогон выплатил жетон: доска, полная с прошлой сессии, ждёт своего
  // момента, а не предлагается сразу после срыва (методист, 2026-10-12)
  if (paid > 0 && isBoardFull(board)) {
    offer = { tokens: board.earned, boardSize: size, options: reinforcerChoices(ctx.pool, ctx.history, seeded(ctx.seed).rng) };
  }
  return {
    board: { earned: board.earned, nonContingent: board.nonContingent },
    token: paid ? claim.token : null,
    ...(offer ? { offer } : {}),
  };
}

/**
 * Прошлые прогоны обучения рутины для детектора зависимости, свежие в конце. `index` — сквозной
 * номер прогона (`AbaRoutineRun.runNo`, как номер сессии у обычной цели): флаг зависимости
 * запоминает номер прогона, и следующее окно смотрит только на прогоны после флага. Номер этого
 * прогона берёт сама `finishRoutineRun` из счётчика в состоянии цели (`routineRunSeq`), а не из
 * журнала: срок хранения сдвигает позиции в журнале.
 */
export type RoutineHistory = { runs: readonly SessionTrials[] };

/**
 * Итог прогона по виду: обучение — запись в окно (`applyRoutineRun`); базовая линия — день
 * базовой линии; поддержание — проба поддержания прогоном (провал — `maintenanceFailsInRow`, два
 * подряд — повторное обучение со звеньями от их последнего успеха); проверка — `verificationVerdict`,
 * успешная — «освоено по критерию» и день поддержания (П1).
 *
 * `history` — прошлые прогоны обучения этой рутины для детектора зависимости от подсказки (раунд 3,
 * методист В2): `routineHistoryOf` в `abaLog.ts`. Обязателен, как `extra` у `finishAbaSession`: забытый список молча отключил бы детектор.
 * Детектор у рутины — по звену (`routineDependentSteps`, раунд 4, В8): окно — пять прогонов, у звена
 * не меньше пяти подсказанных проб. Реакция — только флаг `prompt_dependent` и звенья специалисту
 * (В2): уровни звеньев не трогаются. Флаг снимается освоением (`clearDependenceOnMastery`, В3).
 *
 * Конец прогона — `run.endedAt` (последнее звено или обрыв, Д2), а не момент вызова. Прогон,
 * кончившийся отказом (`assent_withdrawn`, Д3), — в окно и срывы не идёт, день занят.
 */
export function finishRoutineRun(run: RoutineRunState, sessionIndex: number, history: RoutineHistory): RoutineRunResult {
  if (run.status === 'adult_finish') throw new Error('Взрослый ещё доводит прогон');
  if (run.status === 'running' && run.done < run.stepIds.length) throw new Error('Прогон ещё идёт');
  if (run.endedAt === null) throw new Error('У прогона нет момента конца');
  const { target, before, day } = run;
  const iso = (ms: number) => new Date(ms).toISOString();
  const breakdown = run.interrupted === 'breakdown';
  const withdrawn = run.interrupted === 'assent_withdrawn';
  const verified = primaryTrained(run.observers, run.primaryObserverId);
  const scored = run.trials.filter((t) => t.response !== 'interrupted');

  let s: AbaTargetState;
  let runNo: number | undefined;
  if (run.interrupted === 'external') {
    // в окно и критерий не идёт, день не занят: состояние — как до прогона
    s = before;
  } else if (withdrawn) {
    // ребёнок попросил закончить: не промах навыка и не срыв — день занят, затухание записанных звеньев остаётся
    runNo = (before.routineRunSeq ?? 0) + 1;
    s = withAssentConcern({ ...run.state, lastRoutineRunDay: day, routineRunSeq: runNo }, true);
  } else {
    runNo = (before.routineRunSeq ?? 0) + 1;
    s = { ...run.state, lastRoutineRunDay: day, routineRunSeq: runNo };
    switch (run.kind) {
      case 'teaching':
        if (breakdown) {
          // срыв — не промах навыка: в окно не идёт, копится отдельно (методист 2026-10-12)
          s = applyRoutineBreakdown(s, { day, kind: 'teaching', setting: run.setting, atStep: run.done });
          break;
        }
        s = applyRoutineRun(
          s,
          routineRunRecord(target, before, run.trials, day, { setting: run.setting }),
          sessionIndex,
          verified ? 'criterion' : 'home_unverified',
          'with_adult',
        );
        // зависимость от подсказки — по звену, пока рутина учится и «почти» не наступило
        if (TEACHING_PHASES.has(s.phase) && !s.flags.includes('needs_transfer')) {
          const own = scored.filter((t) => COUNTS_TOWARD_MASTERY[t.scoredBy]);
          const dependent = routineDependentSteps(s, [...history.runs, { index: runNo, trials: own }], run.stepIds);
          if (dependent.length) s = applyRoutineDependence(s, runNo, dependent);
        }
        break;
      case 'baseline':
        // срыв на базовой линии ни в каком случае не засчитывается; день занят
        if (breakdown) s = applyRoutineBreakdown(s, { day, kind: 'baseline', setting: run.setting, atStep: run.done });
        else s = applyRoutineBaseline(s, run.trials, day, sessionIndex, target, 'with_adult', false, run.setting);
        break;
      case 'maintenance': {
        // срыв — «не показал навык в этом контексте», а не провал навыка: пробы поддержания нет,
        // `maintenanceFailsInRow` и `lastMaintenanceDay` не двигаются, рутина снова ждёт завтра
        if (breakdown) {
          s = applyRoutineBreakdown(s, { day, kind: 'maintenance', setting: run.setting, atStep: run.done });
          break;
        }
        const probe = probesOf(target, scored, 'maintenance')[0];
        if (probe) {
          // прогон не двигает индексы сессий: поддержание обычных целей считается по сессиям
          const keep = { lastSessionIndex: s.lastSessionIndex, lastMaintenanceSessionIndex: s.lastMaintenanceSessionIndex };
          const after = { ...applyMaintenanceProbe(s, probe, sessionIndex), ...keep };
          s = after.phase === 'acquisition' ? rollbackSteps(s, after, target, scored) : after;
          s = { ...s, lastMaintenanceDay: day };
        }
        break;
      }
      case 'verification': {
        // оборванная срывом проверка ничего не решает: рутина остаётся «получается дома»
        if (breakdown) s = applyRoutineBreakdown(s, { day, kind: 'verification', setting: run.setting, atStep: run.done });
        else if (verified) s = routineVerificationVerdict(s, target, scored, runNo, day);
        break;
      }
    }
    // два тревожных прогона подряд (любой вид) — `assent_concern`: срыв или «Сопротивляется»;
    // спокойный прогон, в том числе с одной просьбой о перерыве, счётчик обнуляет
    s = withAssentConcern(s, breakdown || run.trials.some((t) => t.interruptedBy === 'l4_resisted'));
  }
  if (runNo !== undefined) s = clearDependenceOnMastery(before.phase, s, runNo);

  const record: RoutineRunRecordBase = {
    id: run.runId,
    targetId: target.id,
    day,
    kind: run.kind,
    startedAt: iso(run.startedAt),
    endedAt: iso(run.endedAt),
    interrupted: run.interrupted,
    ...(runNo !== undefined ? { runNo } : {}),
    setting: run.setting,
    phase: s.phase !== before.phase ? { from: before.phase, to: s.phase } : null,
    primaryObserverId: run.primaryObserverId,
  };
  return {
    trials: run.trials,
    state: s,
    before,
    claim: routineClaim(run),
    record,
    band: run.band,
    reinforcerPool: run.reinforcerPool,
    seed: run.seed,
    run,
    sessionIndex,
    history,
    // «кончился по просьбе» — только если конец дала сама просьба (карточка), а не «Отказ» или сопротивление
    breakRequests: { requests: run.requests, ended: withdrawn && run.trials[run.trials.length - 1]?.interruptedBy === 'child_break' },
  };
}

/**
 * Проверка «получается дома» у рутины (раунд 4, В1; методист 2026-10-19, переспросить): нужно
 * `ROUTINE_VERIFICATION_RUNS` прогонов **целиком сами** — каждое звено самостоятельно, ни одно не
 * доделано взрослым. Правило цепочки 80% для рутины мягче её критерия. Первый же не целиком
 * самостоятельный прогон — провал сразу: проваленные звенья — со старта уровня, несущего ответ,
 * остальные — с L0; обучение (без проверок IOA: они ведутся по сессиям). Неполный прогон ничего не решает.
 */
export function routineVerificationVerdict(
  s: AbaTargetState,
  target: AbaTarget,
  scored: readonly AbaTrial[],
  runNo: number,
  day: string,
): AbaTargetState {
  const steps = target.steps ?? [];
  const v = scored.filter((t) => t.kind === 'verification');
  if (!steps.every((st) => v.some((t) => t.stepId === st.id))) return s;
  const failed = steps.filter((st) => {
    const t = v.find((x) => x.stepId === st.id)!;
    return t.response !== 'independent' || t.adultCompleted === true;
  });
  if (!failed.length) {
    const runs = [...(s.routineVerificationRuns ?? []), { runNo, day }];
    if (runs.length < ROUTINE_VERIFICATION_RUNS) return { ...s, routineVerificationRuns: runs };
    return {
      ...s,
      masteredBy: 'criterion',
      routineVerificationRuns: [],
      lastMaintenanceDay: day,
      maintenanceGapIndex: Math.min(s.maintenanceGapIndex + 1, MAINTENANCE_GAP.length - 1) as AbaTargetState['maintenanceGapIndex'],
      maintenanceFailsInRow: 0,
    };
  }
  const failedIds = new Set(failed.map((st) => st.id));
  const stepPrompts = Object.fromEntries(
    steps.map((st) => {
      const level: PromptLevel = failedIds.has(st.id) ? answerLevel(target) : 0;
      const prev = promptStateOf(s, st.id);
      return [
        st.id,
        { ...prev, startPromptLevel: level, lastSuccessfulPromptLevel: level, consecutiveIndependentAtStart: 0, consecutiveAboveStart: 0, consecutiveFailures: 0 },
      ];
    }),
  );
  return {
    ...s,
    phase: 'acquisition',
    masteredBy: undefined,
    sessionsAtCriterion: 0,
    criterionDays: [],
    exemplarsAtCriterion: [],
    criterionSessions: [],
    routineVerificationRuns: [],
    routineRuns: [],
    // проверок IOA после провала у рутины нет: IOA ведётся по сессиям, а рутина в сессии не бывает —
    // счётчик не уменьшился бы никогда; повторное освоение и так требует обученного наблюдателя
    stepPrompts,
  };
}
