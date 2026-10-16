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
 * Экран: `startRoutineRun` → `nextRoutineStep` / `recordRoutineStep` по звеньям →
 * (`interruptRoutineRun` → `finishRoutineByAdult`) → `setRoutineSetting` → `finishRoutineRun` →
 * `commitRoutineRun` (хранилище): жетон и обмен решает он, по живой доске (`settleRoutineBoard`).
 * Состояние — обычный объект с генератором (`seed`): прогон переживает сворачивание.
 */
import {
  COUNTS_TOWARD_MASTERY,
  type AbaObserver,
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
  applyRoutineRun,
  isRoutine,
  isRoutineMaintenanceDue,
  routineRunRecord,
} from './abaCriterion';
import { applyTrialToFading, initialTargetState, trialInvariantErrors } from './abaPrompting';
import { seeded } from './abaRandom';
import { MASTERED_PHASES, probesOf, rollbackSteps, TEACHING_PHASES, verificationVerdict } from './abaSession';
import { targetErrors } from './abaTargetRules';
import {
  addTokens,
  isBoardFull,
  MIN_REINFORCER_POOL,
  participationAward,
  reinforcerChoices,
  tryExchange,
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
};

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
  interrupted: 'breakdown' | 'external' | null;
  setting: RoutineSetting;
  startedAt: number;
  seed: number;
};

/** Начать прогон: вид прогона пересчитывается здесь же — списку на экране не доверяем. */
export function startRoutineRun(input: RoutineRunInput): RoutineRunState {
  const { target } = input;
  if (!DAY.test(input.day)) throw new Error('День прогона — локальная дата YYYY-MM-DD');
  if (!isRoutine(target)) throw new Error(`Цель ${target.id} — не рутина самообслуживания`);
  const errors = targetErrors(target);
  if (errors.length) throw new Error(`Цель ${target.id}: ${errors.join('; ')}`);
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
  /** Звенья кончились: отметка «где и с кем» и итог. */
  | { kind: 'end' };

export function nextRoutineStep(run: RoutineRunState): RoutineStep {
  if (run.status === 'adult_finish') return { kind: 'adult_finish_chain', targetId: run.target.id, stepIds: run.stepIds.slice(run.done) };
  if (run.status === 'finished' || run.done >= run.stepIds.length) return { kind: 'end' };
  return expectedStep(run, run.stepIds[run.done]);
}

export type RoutineRecordResult = { ok: true; run: RoutineRunState; trial: AbaTrial } | { ok: false; errors: string[] };

/**
 * Записать звено. Жетонов за звено нет: жетон — после прогона (`finishRoutineRun`). Обрыв — не
 * запись звена, а `interruptRoutineRun`.
 */
export function recordRoutineStep(run: RoutineRunState, input: AbaTrialInput): RoutineRecordResult {
  if (run.status !== 'running' || run.done >= run.stepIds.length) return { ok: false, errors: ['прогон сейчас не ждёт звено'] };
  const expected = expectedStep(run, run.stepIds[run.done]);
  const checked = scoreAgainst(input, expected, run.runId, run.target.format);
  if (!checked.ok) return { ok: false, errors: checked.errors };
  if (checked.full.response === 'interrupted') return { ok: false, errors: ['обрыв прогона — interruptRoutineRun, а не запись звена'] };
  const trial: AbaTrial = { ...checked.full, tokens: 0 };
  const errors = trialInvariantErrors(trial);
  if (errors.length) return { ok: false, errors };
  const counts = COUNTS_TOWARD_MASTERY[trial.scoredBy];
  return {
    ok: true,
    trial,
    run: {
      ...run,
      trials: [...run.trials, trial],
      done: run.done + 1,
      state: counts ? applyTrialToFading(run.state, trial, run.target) : run.state,
    },
  };
}

/**
 * Обрыв прогона (В1). Срыв (отказ, проблемное поведение) — записанные звенья остаются, остаток
 * доводит взрослый (`adult_finish_chain`, без проб); в окно — «не целиком», день занят. Внешняя
 * причина (прервал взрослый) — записи остаются с пометкой, в окно и критерий не идут, день не
 * занят: иначе посторонний обрыв стал бы промахом ребёнка.
 */
export function interruptRoutineRun(run: RoutineRunState, reason: 'breakdown' | 'external'): RoutineRunState {
  if (run.status !== 'running') throw new Error('Прогон не идёт');
  // после последнего звена рутина уже сделана: обрыв стёр бы целый прогон (методист, Р3)
  if (run.done >= run.stepIds.length) throw new Error('Все звенья записаны: прогон обрывать нечего');
  if (reason === 'external') return { ...run, interrupted: 'external', status: 'finished' };
  const rest = run.done < run.stepIds.length;
  return { ...run, interrupted: 'breakdown', status: rest ? 'adult_finish' : 'finished' };
}

/** Взрослый довёл оставшиеся звенья — проб не пишется. */
export function finishRoutineByAdult(run: RoutineRunState): RoutineRunState {
  if (run.status !== 'adult_finish') throw new Error('Довести прогон взрослому сейчас нечего');
  return { ...run, status: 'finished' };
}

/** Где и с кем прошёл прогон — один выбор взрослого в конце (В3; по умолчанию — как обычно). */
export function setRoutineSetting(run: RoutineRunState, setting: RoutineSetting): RoutineRunState {
  return { ...run, setting };
}

/** Запись прогона без того, что решает доска на момент фиксации: жетон и обмен (`settleRoutineBoard`). */
export type RoutineRunRecordBase = Omit<AbaRoutineRun, 'token' | 'exchanged' | 'exchangeOptions'>;

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
};

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
  const steps = run.trials;
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
  /** Доска заполнилась — обмен сразу после прогона: экран предлагает выбор из `options`. */
  exchange?: { tokens: number; options: string[] };
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
  let exchange: RoutineSettlement['exchange'];
  // обмен — только если прогон выплатил жетон: доска, полная с прошлой сессии, ждёт своего момента,
  // а не обменивается сразу после срыва (методист, 2026-10-12)
  if (paid > 0 && isBoardFull(board)) {
    const ex = tryExchange(board);
    board = ex.board;
    exchange = { tokens: ex.exchanged, options: reinforcerChoices(ctx.pool, ctx.history, seeded(ctx.seed).rng) };
  }
  return {
    board: { earned: board.earned, nonContingent: board.nonContingent },
    token: paid ? claim.token : null,
    ...(exchange ? { exchange } : {}),
  };
}

/**
 * Итог прогона по виду: обучение — запись в окно (`applyRoutineRun`); базовая линия — день
 * базовой линии; поддержание — проба поддержания прогоном (провал — `maintenanceFailsInRow`, два
 * подряд — повторное обучение со звеньями от их последнего успеха); проверка — `verificationVerdict`,
 * успешная — «освоено по критерию» и день поддержания (П1).
 */
export function finishRoutineRun(run: RoutineRunState, endedAt: number, sessionIndex: number): RoutineRunResult {
  if (run.status === 'adult_finish') throw new Error('Взрослый ещё доводит прогон');
  if (run.status === 'running' && run.done < run.stepIds.length) throw new Error('Прогон ещё идёт');
  const { target, before, day } = run;
  const iso = (ms: number) => new Date(ms).toISOString();
  const breakdown = run.interrupted === 'breakdown';
  const verified = primaryTrained(run.observers, run.primaryObserverId);

  let s: AbaTargetState;
  if (run.interrupted === 'external') {
    // в окно и критерий не идёт, день не занят: состояние — как до прогона
    s = before;
  } else {
    s = { ...run.state, lastRoutineRunDay: day };
    switch (run.kind) {
      case 'teaching':
        s = applyRoutineRun(
          s,
          routineRunRecord(target, before, run.trials, day, { ...(breakdown ? { interrupted: true as const } : {}), setting: run.setting }),
          sessionIndex,
          verified ? 'criterion' : 'home_unverified',
          'with_adult',
        );
        break;
      case 'baseline':
        s = applyRoutineBaseline(s, run.trials, day, sessionIndex, target, 'with_adult', breakdown, run.setting);
        break;
      case 'maintenance': {
        // оборванный срывом — провал поддержания
        const probe = breakdown
          ? { ...(run.trials[0] ?? fallbackProbe(run)), stepId: undefined, response: 'incorrect' as const }
          : probesOf(target, run.trials, 'maintenance')[0];
        if (probe) {
          // прогон не двигает индексы сессий: поддержание обычных целей считается по сессиям
          const keep = { lastSessionIndex: s.lastSessionIndex, lastMaintenanceSessionIndex: s.lastMaintenanceSessionIndex };
          const after = { ...applyMaintenanceProbe(s, probe, sessionIndex), ...keep };
          s = after.phase === 'acquisition' ? rollbackSteps(s, after, target, run.trials) : after;
          s = { ...s, lastMaintenanceDay: day };
        }
        break;
      }
      case 'verification': {
        // оборванная срывом проверка ничего не решает: рутина остаётся «получается дома»
        const verdict = breakdown || !verified ? null : verificationVerdict(s, target, run.trials, sessionIndex);
        if (verdict) s = verdict.state.masteredBy === 'criterion' ? { ...verdict.state, lastMaintenanceDay: day } : verdict.state;
        break;
      }
    }
  }

  const record: RoutineRunRecordBase = {
    id: run.runId,
    targetId: target.id,
    day,
    kind: run.kind,
    startedAt: iso(run.startedAt),
    endedAt: iso(endedAt),
    interrupted: run.interrupted,
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
  };
}

/** Срыв до первого звена: проба поддержания без записанных звеньев — провал по форме первого звена. */
function fallbackProbe(run: RoutineRunState): AbaTrial {
  const step = expectedStep(run, run.stepIds[0]);
  return {
    id: `${run.runId}#breakdown`,
    sessionId: run.runId,
    targetId: run.target.id,
    exemplarId: step.exemplarId,
    index: 0,
    kind: 'maintenance',
    startPromptLevel: 0,
    promptLevelUsed: 0,
    presentations: 0,
    response: 'incorrect',
    emittedBeforePrompt: false,
    latencyMs: null,
    latencyFromFirstSdMs: null,
    latencySource: null,
    promptDelayMs: null,
    responseWindowMs: step.responseWindowMs,
    presentationLog: [],
    sdEndedAt: new Date(run.startedAt).toISOString(),
    scoredBy: 'adult',
    tokens: 0,
  };
}
