/**
 * Критерий освоения ABA-цели и поддержание. Спецификация — «Критерий освоения —
 * полный» и «Поддержание» в `ABA.md`.
 *
 * «80% в трёх сессиях» недоопределено: без минимума проб, разных дней и разных
 * экземпляров критерий берётся одной удачной серией на одной картинке за вечер.
 * В прежней версии критерия в коде не было вовсе.
 */
import {
  APP_MAX_PROMPT,
  COUNTS_TOWARD_MASTERY,
  MAINTENANCE_FAILS_TO_REACQUIRE,
  MAINTENANCE_GAP,
  MASTERY,
  ROUTINE,
  type AbaConfig,
  type AbaSessionEndReason,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
  type PromptLevel,
  type RoutineRunRecord,
  type RoutineSetting,
  type StepPromptState,
} from '../types/aba';
import { clampToApp, promptStateOf } from './abaPrompting';

/** С какой доли самостоятельных цель получает пробы переноса. */
export const GENERALIZATION_PROBE_FROM = 0.6;

/**
 * Что сессия делает с серией критерия: продлевает, рвёт или ничего — если проб
 * мало, а 80% ещё были достижимы.
 */
export type SessionOutcome = 'meets' | 'breaks' | 'neutral';

/** Итог сессии по одной цели. */
export type AbaSessionSummary = {
  /**
   * Проб в зачёт: обучающие, не прерванные, оценённые источником с правом на критерий.
   * У цепочки — полных прогонов.
   */
  trials: number;
  independentRate: number;
  outcome: SessionOutcome;
  /** Проб хватило, чтобы доля что-то значила. Только такие идут в историю долей. */
  counted: boolean;
  /** Обучающие экземпляры, на которых был самостоятельный ответ. */
  independentExemplars: string[];
};

/**
 * Проба, которая имеет право двигать критерий.
 *
 * Разогрев, коррекция и перенос в процент не складываются: у них другое
 * назначение. Проба, засчитанная детектором начала звука, «ответил / нет» знает,
 * а верно ли — нет.
 */
function countable(t: AbaTrial): boolean {
  return t.kind === 'teaching' && t.response !== 'interrupted' && COUNTS_TOWARD_MASTERY[t.scoredBy];
}

/** Сколько несамостоятельных допускает минимальная сессия, не теряя 80%. */
function allowedMisses(min: number): number {
  return min - Math.ceil(MASTERY.minIndependentRate * min - 1e-9);
}

function summarizeCounts(total: number, independent: number, min: number, exemplars: string[]): AbaSessionSummary {
  const independentRate = total ? independent / total : 0;
  const enough = total >= min;

  let outcome: SessionOutcome;
  if (enough) outcome = independentRate >= MASTERY.minIndependentRate ? 'meets' : 'breaks';
  else outcome = total - independent > allowedMisses(min) ? 'breaks' : 'neutral';

  return { trials: total, independentRate, outcome, counted: enough, independentExemplars: [...new Set(exemplars)] };
}

function summarizeGroup(trials: AbaTrial[], min: number): AbaSessionSummary {
  const counted = trials.filter(countable);
  const independent = counted.filter((t) => t.response === 'independent');
  return summarizeCounts(counted.length, independent.length, min, independent.map((t) => t.exemplarId));
}

/**
 * Прогоны цепочки по `runIndex`. Прогон в зачёте, только если в нём есть все звенья. Проба звена
 * без `runIndex` в прогоны не идёт: прежний запасной путь («k-я проба звена — k-й прогон») после
 * прерванного звена склеивал звенья разных прогонов в один «полный» (аудит 2026-10-06, А21) —
 * оркестратор пишет `runIndex` всегда. `filter` — какие пробы считаются: обучающие по умолчанию,
 * базовой линии — `baselineTrials`.
 */
export function chainRuns(
  target: AbaTarget,
  trials: readonly AbaTrial[],
  filter: (t: AbaTrial) => boolean = countable,
): AbaTrial[][] {
  const steps = target.steps ?? [];
  const runs = new Map<number, AbaTrial[]>();
  for (const t of trials.filter(filter)) {
    if (t.runIndex === undefined) continue;
    runs.set(t.runIndex, [...(runs.get(t.runIndex) ?? []), t]);
  }
  return [...runs.values()].filter((run) => steps.every((st) => run.some((t) => t.stepId === st.id)));
}

/**
 * Итог сессии по цели.
 *
 * Короткая сессия серию не продлевает. Рвёт — если неудач уже столько, что 80%
 * в полной сессии были бы недостижимы, или если она оборвалась по критерию
 * остановки: короткими бывают как раз худшие сессии.
 *
 * У цепочки считаются **прогоны, выполненные целиком самостоятельно**: сессия в зачёт,
 * если таких не меньше 80% при минимуме в три прогона. «80% на каждом звене» пропускал
 * бы сессию, где ни один прогон не выполнен целиком — в каждом сыплется своё звено;
 * «все звенья в каждом прогоне» — это 100%, строже дискретных целей без причины.
 * Данные по звеньям остаются для диагностики (решение методиста, `ABA.md`).
 */
export function summarizeSession(
  target: AbaTarget,
  sessionTrials: AbaTrial[],
  endReason: AbaSessionEndReason | null = null,
): AbaSessionSummary {
  const own = sessionTrials.filter((t) => t.targetId === target.id);

  // рутина в сессию не входит: её прогон — `abaRoutineRun.ts`, критерий — окно прогонов по дням
  if (isRoutine(target)) throw new Error(`Рутина ${target.id} не проходит через сессию: прогон рутины — abaRoutineRun`);

  let summary: AbaSessionSummary;
  if (!target.steps?.length) {
    summary = summarizeGroup(own, MASTERY.minTrialsPerSession);
  } else {
    const runs = chainRuns(target, own);
    const whole = runs.filter((run) => run.every((t) => t.response === 'independent'));
    summary = summarizeCounts(
      runs.length,
      whole.length,
      MASTERY.minChainRunsPerSession,
      whole.map((run) => run[0].exemplarId),
    );
  }

  if (endReason === 'breakdown' && summary.outcome !== 'breaks') return { ...summary, outcome: 'breaks' };
  return summary;
}

/**
 * Сессия прошла: обновить серию критерия.
 *
 * Сессия в тот же день, что уже засчитанная, продлевает серию, но нового дня не
 * добавляет: «три сессии подряд в разные дни» читается как «три разных дня, и
 * каждая сессия в них — не ниже порога». Строже, но иначе критерий берётся за
 * один вечер. Специалисту показываются дни, а не сессии.
 */
export function applySession(
  s: AbaTargetState,
  summary: AbaSessionSummary,
  sessionIndex: number,
  day: string,
  /** Сессия подтверждена обученным наблюдателем (`abaIoa.isVerified`). */
  verified = false,
): AbaTargetState {
  const base = { ...s, lastSessionIndex: sessionIndex };
  const recentIndependentRates = summary.counted
    ? [...s.recentIndependentRates, summary.independentRate].slice(-10)
    : s.recentIndependentRates;

  if (summary.outcome === 'neutral') return { ...base, recentIndependentRates };
  if (summary.outcome === 'breaks') {
    return {
      ...base,
      recentIndependentRates,
      sessionsAtCriterion: 0,
      criterionDays: [],
      exemplarsAtCriterion: [],
      criterionSessions: [],
    };
  }
  return {
    ...base,
    recentIndependentRates,
    sessionsAtCriterion: s.sessionsAtCriterion + 1,
    criterionDays: s.criterionDays.includes(day) ? s.criterionDays : [...s.criterionDays, day],
    exemplarsAtCriterion: [...new Set([...s.exemplarsAtCriterion, ...summary.independentExemplars])],
    criterionSessions: [...(s.criterionSessions ?? []), { sessionIndex, verified }],
  };
}

/** Пора ли давать пробы переноса: цель уже держится хотя бы на 60%. */
export function needsGeneralizationProbe(s: AbaTargetState): boolean {
  const last = s.recentIndependentRates.at(-1);
  return last !== undefined && last >= GENERALIZATION_PROBE_FROM;
}

/** Записать итог пробы переноса. Хранится окно из последних, старые выпадают. */
export function applyGeneralizationProbe(s: AbaTargetState, t: AbaTrial): AbaTargetState {
  if (t.kind !== 'generalization' || t.response === 'interrupted') return s;
  const probe = { response: t.response, exemplarId: t.exemplarId, sdVariantKey: t.sdVariantKey };
  return {
    ...s,
    generalizationProbes: [...s.generalizationProbes, probe].slice(-MASTERY.generalizationWindow),
  };
}

/**
 * Зачётные пробы переноса. Повтор того же экземпляра с той же формулировкой не
 * считается второй раз: после первой пробы стимул ребёнку уже знаком.
 */
export function generalizationPasses(s: AbaTargetState): number {
  const keys = s.generalizationProbes
    .filter((p) => p.response === 'independent')
    .map((p) => `${p.exemplarId}|${p.sdVariantKey ?? ''}`);
  return new Set(keys).size;
}

/** Какой пункт критерия ещё не выполнен. Пустой список — цель освоена. */
export type CriterionGap = 'sessions' | 'distinct_days' | 'exemplars' | 'generalization';

export function criterionGaps(s: AbaTargetState): CriterionGap[] {
  const gaps: CriterionGap[] = [];
  if (s.sessionsAtCriterion < MASTERY.sessionsInRow) gaps.push('sessions');
  if (MASTERY.requireDistinctDays && s.criterionDays.length < MASTERY.sessionsInRow) {
    gaps.push('distinct_days');
  }
  if (s.exemplarsAtCriterion.length < MASTERY.minDistinctExemplars) gaps.push('exemplars');
  if (generalizationPasses(s) < MASTERY.minGeneralizationPasses) gaps.push('generalization');
  return gaps;
}

export function isMasteryMet(s: AbaTargetState): boolean {
  return criterionGaps(s).length === 0;
}

/** Проб базовой линии на дискретную цель. */
export const BASELINE_TRIALS = 3;

/**
 * Прогонов базовой линии цепочки — проверка task analysis с множеством возможностей
 * (multiple-opportunity probe): проваленное звено выполняет взрослый, пробой ребёнка
 * это не пишется, и прогон идёт дальше.
 */
export const BASELINE_CHAIN_RUNS = 2;

/** Новых целей на базовой линии за сессию — не больше. */
export const MAX_BASELINE_TARGETS = 2;

/**
 * Базовая линия цели набора `identify`: 5 проб вперемешку с целями набора. С выбором
 * угадывание сильнее: при поле из трёх 3/5 и больше выпадают случайно в ~21% случаев,
 * 4/5 — в ~4.5%, поэтому пороги строже, и даже 5/5 — не «освоено», а обучение с L0.
 */
export const IDENTIFY_BASELINE = { trials: 5, fromL0: 5, fromL1: 4 } as const;

/**
 * Базовая линия `match` (методист, 2026-10-02): 5 проб в поле полного размера. 5/5 при поле ≥ 3 —
 * сразу освоено (угадать — 0,4%); при поле 2 и у сортировки — обучение с L0 (угадать 5/5 — 3%);
 * 4/5 — старт L1; меньше — L3.
 */
export const MATCH_BASELINE = { trials: 5, masteredFrom: 5, fromL1: 4, minFieldForMastery: 3 } as const;

/** Рутина самообслуживания: цепочка области `self_care` (`ROUTINE`). Отдельного флага нет — один источник истины. */
export function isRoutine(t: Pick<AbaTarget, 'area' | 'steps'>): boolean {
  return t.area === 'self_care' && !!t.steps?.length;
}

/** Выполнен ли критерий рутины на последних прогонах (без условия переноса — `routineTransferMet`). */
export function routineCriterionMet(runs: readonly { day: string; whole: boolean }[]): boolean {
  const w = runs.slice(-ROUTINE.windowRuns);
  return (
    w.length === ROUTINE.windowRuns &&
    w.filter((r) => r.whole).length >= ROUTINE.minWhole &&
    new Set(w.map((r) => r.day)).size >= ROUTINE.minDistinctDays &&
    w[w.length - 1].whole
  );
}

/**
 * Перенос (генерализация) рутины: в окне критерия есть целиком самостоятельный прогон, без срыва,
 * вне привычного контекста — другой взрослый ИЛИ другое место (`setting ≠ usual`, методист
 * 2026-10-12, Г4). Без отметки `setting` — `usual`: засчитывается безопасная сторона. Прогон вне
 * окна из последних `windowRuns` не считается — свежесть доказательства важнее удобства.
 */
export function routineTransferMet(runs: readonly { whole: boolean; interrupted?: true; setting?: RoutineSetting }[]): boolean {
  return runs
    .slice(-ROUTINE.windowRuns)
    .some((r) => r.whole && !r.interrupted && (r.setting === 'other_adult' || r.setting === 'other_place'));
}

/** Рутина освоена по окну прогонов: критерий выполнен **и** перенос подтверждён. */
export function routineMasteryMet(
  runs: readonly { day: string; whole: boolean; interrupted?: true; setting?: RoutineSetting }[],
): boolean {
  return routineCriterionMet(runs) && routineTransferMet(runs);
}

/**
 * Запись прогона обучения для окна: целиком сам — каждое звено самостоятельно (доделанное
 * взрослым — промах), сумма стартовых уровней звеньев — по состоянию до прогона.
 */
export function routineRunRecord(
  target: AbaTarget,
  before: AbaTargetState,
  run: readonly AbaTrial[],
  day: string,
  extra: Pick<RoutineRunRecord, 'interrupted' | 'setting'> = {},
): RoutineRunRecord {
  const steps = target.steps ?? [];
  const complete = steps.every((st) => run.some((t) => t.stepId === st.id));
  return {
    day,
    whole: !extra.interrupted && complete && run.every((t) => t.response === 'independent'),
    ...(extra.interrupted ? { interrupted: true as const } : {}),
    startLevelSum: steps.reduce((sum, st) => sum + clampToApp(promptStateOf(before, st.id).startPromptLevel), 0),
    ...(extra.setting ? { setting: extra.setting } : {}),
  };
}

/**
 * Прогон рутины в обучении — в окно (по прогону в день, `abaRoutineRun.ts`). Промах — любое звено
 * не самостоятельно, в том числе доделанное взрослым, и прогон, оборванный срывом (В1). Критерий
 * выполнен — «освоено»: `by` — `criterion`, если прогон вёл обученный наблюдатель, иначе
 * `home_unverified` (блок 5: освоение у цели взрослого — только с подтверждением). Номер сессии
 * прогон не двигает: поддержание обычных целей считается по сессиям.
 */
export function applyRoutineRun(
  s: AbaTargetState,
  record: RoutineRunRecord,
  sessionIndex: number,
  by: 'criterion' | 'home_unverified',
  config?: AbaConfig,
): AbaTargetState {
  const routineRuns = [...(s.routineRuns ?? []), record].slice(-ROUTINE.keepRuns);
  const others = s.flags.filter((f) => f !== 'no_progress' && f !== 'needs_transfer');
  if (routineMasteryMet(routineRuns)) {
    // окно обнуляется: после возврата в обучение освоение снова требует своих прогонов и дней,
    // а не одного прогона поверх старых (методист, 2026-10-09)
    return { ...markMastered({ ...s, routineRuns: [], flags: others }, sessionIndex, by, config), lastMaintenanceDay: record.day };
  }
  // критерий выполнен, переноса нет — «почти»: фаза прежняя, окно сохранено, флаг родителю и специалисту
  if (routineCriterionMet(routineRuns)) return { ...s, routineRuns, flags: [...others, 'needs_transfer'] };
  return { ...s, routineRuns, flags: routineStuck(routineRuns) ? [...others, 'no_progress'] : others };
}

/**
 * Рутина застряла — аналог `no_progress` по окну прогонов: `ROUTINE.noProgressRuns` прогонов
 * не меньше чем за `noProgressDays` разных дней, а во второй половине окна **и** доля целиком
 * самостоятельных не выше, чем в первой, **и** стартовые уровни звеньев не снизились (В2,
 * методист 2026-10-11): при нормальном затухании подсказок доля целиком самих растёт поздно, и
 * без второго условия флаг ложный. Иначе рутина стояла бы неделями, и специалист не увидел бы.
 */
export function routineStuck(runs: readonly RoutineRunRecord[]): boolean {
  // ребёнок на 100% в усвоенном контексте и ждёт переноса не застрял: доли равны, уровни уже 0
  if (routineCriterionMet(runs)) return false;
  if (runs.length < ROUTINE.noProgressRuns || new Set(runs.map((r) => r.day)).size < ROUTINE.noProgressDays) return false;
  const half = Math.floor(runs.length / 2);
  const [early, late] = [runs.slice(0, half), runs.slice(half)];
  const share = (xs: readonly RoutineRunRecord[]) => xs.filter((r) => r.whole).length / xs.length;
  const start = (xs: readonly RoutineRunRecord[]) => xs.reduce((sum, r) => sum + r.startLevelSum, 0) / xs.length;
  return share(late) <= share(early) && start(late) >= start(early);
}

/**
 * Базовая линия рутины — `ROUTINE.baselineRuns` прогона **в разные дни**, по одному в сессию,
 * множеством возможностей (несделанное звено доделывает взрослый, ребёнок продолжает). Второй
 * прогон в тот же день не в счёт. Оба целиком сами **и был целиком самостоятельный прогон вне
 * привычного контекста** — освоено по базовой линии (перенос, Г4; методист 2026-10-12); иначе
 * старт звена: сам в обоих — L0, в одном — L1, ни в одном — полная модель.
 *
 * Оба целиком сами, но переноса не было — фаза остаётся `baseline` с флагом `needs_transfer`;
 * следующий прогон решает: целиком сам вне контекста — освоено; любое звено не сам — обучение;
 * целиком сам в привычном — состояние держится; срыв — без изменений.
 */
export function applyRoutineBaseline(
  s: AbaTargetState,
  trials: readonly AbaTrial[],
  day: string,
  sessionIndex: number,
  target: AbaTarget,
  config?: AbaConfig,
  /**
   * Прогон оборван срывом, остаток довёл взрослый без записи (В1): день засчитывается,
   * недойденные звенья — «не сам». Сдвиг в сторону большей помощи — безопасный.
   */
  interrupted = false,
  /** Где и с кем прошёл прогон; нет отметки — `usual`. */
  setting: RoutineSetting = 'usual',
): AbaTargetState {
  if (s.phase !== 'baseline') return s;
  const run = interrupted
    ? trials.filter((t) => t.targetId === target.id && isBaselineCountable(t))
    : chainRuns(target, trials, isBaselineCountable)[0];
  const acc = s.routineBaseline ?? { days: [], independentByStep: {} };
  if (!run || acc.days.includes(day)) return s;
  const steps = target.steps ?? [];
  const independentNow = new Set(run.filter((t) => t.stepId && t.response === 'independent').map((t) => t.stepId!));
  const wholeNow = !interrupted && steps.every((st) => independentNow.has(st.id));
  const held = acc.days.length >= ROUTINE.baselineRuns;
  // срыв на ожидающей переноса базовой линии про навык ничего не говорит
  if (held && interrupted) return s;

  const independentByStep = { ...acc.independentByStep };
  for (const t of run) {
    if (t.stepId && t.response === 'independent') independentByStep[t.stepId] = (independentByStep[t.stepId] ?? 0) + 1;
  }
  const days = [...acc.days, day];
  const transferSeen = acc.transferSeen === true || (wholeNow && setting !== 'usual');
  const rest = s.flags.filter((f) => f !== 'needs_transfer');
  if (days.length < ROUTINE.baselineRuns) return { ...s, routineBaseline: { days, independentByStep, transferSeen } };

  const allIndependent = steps.every((st) => (independentByStep[st.id] ?? 0) >= ROUTINE.baselineRuns);
  const done: AbaTargetState = { ...s, flags: rest };
  delete done.routineBaseline;
  // в held-состоянии звено, не сделанное самим в этом прогоне, возвращает в обучение, даже если счёт накопленный
  if (allIndependent && (!held || wholeNow)) {
    if (transferSeen) return { ...markMastered(done, sessionIndex, 'baseline', config), lastMaintenanceDay: day };
    return { ...s, flags: [...rest, 'needs_transfer'], routineBaseline: { days, independentByStep, transferSeen } };
  }
  const stepPrompts = Object.fromEntries(
    steps.map((st) => {
      const ok = independentByStep[st.id] ?? 0;
      let level: PromptLevel;
      if (held) level = independentNow.has(st.id) ? 0 : ok > 0 ? 1 : APP_MAX_PROMPT;
      else level = ok >= ROUTINE.baselineRuns ? 0 : ok > 0 ? 1 : APP_MAX_PROMPT;
      return [st.id, fresh(level, s.currentDelayMs)];
    }),
  );
  return { ...done, phase: 'acquisition', stepPrompts };
}

/**
 * Пора ли проба поддержания рутины: интервалы `ROUTINE.maintenanceGapDays` — в днях от последней
 * пробы (или освоения). Индекс интервала — общий `maintenanceGapIndex`.
 */
export function isRoutineMaintenanceDue(s: AbaTargetState, day: string): boolean {
  if (s.phase !== 'mastered' && s.phase !== 'maintenance') return false;
  if (!s.lastMaintenanceDay) return true;
  const days = Math.round((Date.parse(day) - Date.parse(s.lastMaintenanceDay)) / 86_400_000);
  return days >= ROUTINE.maintenanceGapDays[s.maintenanceGapIndex];
}

/** Проба базовой линии, которая имеет право решать о старте: не прервана, засчитана не детектором. */
export function isBaselineCountable(t: AbaTrial): boolean {
  return t.kind === 'baseline' && t.response !== 'interrupted' && COUNTS_TOWARD_MASTERY[t.scoredBy];
}

function baselineTrials(trials: AbaTrial[]): AbaTrial[] {
  return trials.filter(isBaselineCountable);
}

/** Состояние подсказки после базовой линии; задержка — прежняя (у звена — задержка цели). */
const fresh = (start: PromptLevel, currentDelayMs: number): StepPromptState => ({
  currentDelayMs,
  startPromptLevel: start,
  lastSuccessfulPromptLevel: start,
  consecutiveIndependentAtStart: 0,
  consecutiveAboveStart: 0,
  consecutiveFailures: 0,
});

/**
 * Итог базовой линии: с чего начинать обучение. Не набралось проб (сессию прервали) —
 * базовая линия повторяется в следующей сессии.
 *
 * Дискретная цель, три пробы без подсказки:
 * - все три самостоятельно — навык уже есть: сразу в поддержание с первого интервала,
 *   ближайшая проба поддержания сама перепроверит (`masteredBy: 'baseline'`);
 * - одна-две — обучение со старта L1: ребёнок почти умеет, полная модель научила бы его
 *   ждать модель;
 * - ни одной — обучение с полной модели, безошибочный старт.
 *
 * Цепочка, два прогона: у каждого звена свой старт — самостоятельно в обоих прогонах
 * L0, в одном — L1, ни в одном — L3. Цепочка идёт в обучение.
 *
 * Цель набора `identify` — `IDENTIFY_BASELINE`: 5/5 — L0, 4/5 — L1, меньше — L3.
 */
export function applyBaseline(
  s: AbaTargetState,
  trials: AbaTrial[],
  sessionIndex: number,
  target: AbaTarget,
  config?: AbaConfig,
): AbaTargetState {
  if (s.phase !== 'baseline') return s;
  const own = baselineTrials(trials);

  if (target.steps?.length) {
    const byStep = target.steps.map((st) => own.filter((t) => t.stepId === st.id));
    if (byStep.some((x) => x.length < BASELINE_CHAIN_RUNS)) return s;
    const stepPrompts = Object.fromEntries(
      target.steps.map((st, i) => {
        const ok = byStep[i].filter((t) => t.response === 'independent').length;
        const level: PromptLevel = ok >= BASELINE_CHAIN_RUNS ? 0 : ok > 0 ? 1 : APP_MAX_PROMPT;
        return [st.id, fresh(level, s.currentDelayMs)];
      }),
    );
    return { ...s, phase: 'acquisition', stepPrompts };
  }

  if (target.format === 'match') {
    if (own.length < MATCH_BASELINE.trials) return s;
    const ok = own.filter((t) => t.response === 'independent').length;
    const wide = target.matchMode !== 'sort' && (target.fieldSize ?? 2) >= MATCH_BASELINE.minFieldForMastery;
    if (ok >= MATCH_BASELINE.masteredFrom && wide) return markMastered(s, sessionIndex, 'baseline', config);
    const level: PromptLevel = ok >= MATCH_BASELINE.masteredFrom ? 0 : ok >= MATCH_BASELINE.fromL1 ? 1 : APP_MAX_PROMPT;
    return { ...s, phase: 'acquisition', ...fresh(level, s.currentDelayMs) };
  }

  if (target.format === 'identify') {
    if (own.length < IDENTIFY_BASELINE.trials) return s;
    const ok = own.filter((t) => t.response === 'independent').length;
    const level: PromptLevel = ok >= IDENTIFY_BASELINE.fromL0 ? 0 : ok >= IDENTIFY_BASELINE.fromL1 ? 1 : APP_MAX_PROMPT;
    return { ...s, phase: 'acquisition', ...fresh(level, s.currentDelayMs) };
  }

  if (own.length < BASELINE_TRIALS) return s;
  const independent = own.filter((t) => t.response === 'independent').length;
  if (independent === own.length) return markMastered(s, sessionIndex, 'baseline', config);
  return { ...s, phase: 'acquisition', ...fresh(independent > 0 ? 1 : APP_MAX_PROMPT, s.currentDelayMs) };
}

/** Перевести освоенную цель в поддержание: расписание начинается с этой сессии и первого интервала. */
export function markMastered(
  s: AbaTargetState,
  sessionIndex: number,
  by: 'criterion' | 'baseline' | 'home_unverified' | 'inferred' = 'criterion',
  config?: AbaConfig,
): AbaTargetState {
  return {
    ...s,
    phase: 'mastered',
    masteredBy: by,
    ...(config ? { masteredConfig: config } : {}),
    flags: s.flags.filter((f) => f !== 'needs_verification'),
    maintenanceGapIndex: 0,
    maintenanceFailsInRow: 0,
    lastMaintenanceSessionIndex: sessionIndex,
  };
}

/**
 * Пора ли проба поддержания. Интервалы 1, 2, 5, 12 — **в сессиях**, а не в днях:
 * пропуск недели не обнуляет расписание. Отсчёт — от прошлой пробы поддержания,
 * а не от любой встречи с целью: разогрев на освоенной цели расписание не двигает.
 */
export function isMaintenanceDue(s: AbaTargetState, sessionIndex: number): boolean {
  if (s.phase !== 'mastered' && s.phase !== 'maintenance') return false;
  return sessionIndex - s.lastMaintenanceSessionIndex >= MAINTENANCE_GAP[s.maintenanceGapIndex];
}

type GapIndex = AbaTargetState['maintenanceGapIndex'];

/**
 * Итог пробы поддержания.
 *
 * Самостоятельный ответ отодвигает следующую. Всё остальное — провал, и
 * следующая проба на следующей же сессии — снова **без подсказки**: проба
 * поддержания измеряет, и со старта L1 самостоятельный ответ был бы невозможен,
 * а второй провал — назначен заранее. Запоминается только уровень, на котором
 * ребёнок справился: ответил с L1 — значит L1.
 *
 * Два провала подряд — навык распался: цель возвращается в обучение с
 * непрерывным подкреплением и стартом **на уровне последнего успеха**, а не с
 * полной модели — откат к нулю у ребёнка, который навык почти держит, это
 * регресс, назначенный процедурой. Серия критерия и история долей начинаются
 * заново: иначе старая доля со времён освоения сразу открыла бы пробы переноса.
 */
export function applyMaintenanceProbe(
  s: AbaTargetState,
  t: AbaTrial,
  sessionIndex: number,
): AbaTargetState {
  if (t.kind !== 'maintenance' || t.response === 'interrupted') return s;
  const base = { ...s, lastSessionIndex: sessionIndex, lastMaintenanceSessionIndex: sessionIndex };

  if (t.response === 'independent') {
    return {
      ...base,
      phase: 'maintenance',
      lastSuccessfulPromptLevel: 0,
      maintenanceFailsInRow: 0,
      maintenanceGapIndex: Math.min(MAINTENANCE_GAP.length - 1, s.maintenanceGapIndex + 1) as GapIndex,
    };
  }

  // Выведенная по проверке сверху вниз (автоподбор) — назад на базовую линию с первого провала:
  // уровня последнего успеха у неё нет, учить с него нечего (методист, 2026-10-02).
  if (s.masteredBy === 'inferred') {
    return {
      ...base,
      phase: 'baseline',
      masteredBy: undefined,
      maintenanceGapIndex: 0 as GapIndex,
      maintenanceFailsInRow: 0,
    };
  }
  const lastSuccessfulPromptLevel =
    t.response === 'prompted' ? clampToApp(t.promptLevelUsed) : clampToApp(s.lastSuccessfulPromptLevel);
  const fails = s.maintenanceFailsInRow + 1;

  if (fails >= MAINTENANCE_FAILS_TO_REACQUIRE) {
    return {
      ...base,
      phase: 'acquisition',
      startPromptLevel: lastSuccessfulPromptLevel,
      lastSuccessfulPromptLevel,
      consecutiveIndependentAtStart: 0,
      consecutiveAboveStart: 0,
      maintenanceGapIndex: 0,
      maintenanceFailsInRow: 0,
      recentIndependentRates: [],
      sessionsAtCriterion: 0,
      criterionDays: [],
      exemplarsAtCriterion: [],
      generalizationProbes: [],
    };
  }
  return {
    ...base,
    phase: 'maintenance',
    lastSuccessfulPromptLevel,
    maintenanceGapIndex: 0 as GapIndex,
    maintenanceFailsInRow: fails,
  };
}
