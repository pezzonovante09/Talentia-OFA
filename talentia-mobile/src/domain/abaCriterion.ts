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
  type AbaSessionEndReason,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
  type PromptLevel,
  type StepPromptState,
} from '../types/aba';
import { clampToApp } from './abaPrompting';

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
 * Прогоны цепочки. Номер прогона — `runIndex`; без него k-я проба каждого звена
 * считается k-м прогоном. Прогон в зачёте, только если в нём есть все звенья.
 */
export function chainRuns(target: AbaTarget, trials: AbaTrial[]): AbaTrial[][] {
  const steps = target.steps ?? [];
  const seen = new Map<string, number>();
  const runs = new Map<number, AbaTrial[]>();
  for (const t of trials.filter(countable)) {
    const step = t.stepId ?? '';
    const k = t.runIndex ?? seen.get(step) ?? 0;
    seen.set(step, (seen.get(step) ?? 0) + 1);
    runs.set(k, [...(runs.get(k) ?? []), t]);
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

function baselineTrials(trials: AbaTrial[]): AbaTrial[] {
  return trials.filter(
    (t) => t.kind === 'baseline' && t.response !== 'interrupted' && COUNTS_TOWARD_MASTERY[t.scoredBy],
  );
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

  if (target.format === 'identify') {
    if (own.length < IDENTIFY_BASELINE.trials) return s;
    const ok = own.filter((t) => t.response === 'independent').length;
    const level: PromptLevel = ok >= IDENTIFY_BASELINE.fromL0 ? 0 : ok >= IDENTIFY_BASELINE.fromL1 ? 1 : APP_MAX_PROMPT;
    return { ...s, phase: 'acquisition', ...fresh(level, s.currentDelayMs) };
  }

  if (own.length < BASELINE_TRIALS) return s;
  const independent = own.filter((t) => t.response === 'independent').length;
  if (independent === own.length) return markMastered(s, sessionIndex, 'baseline');
  return { ...s, phase: 'acquisition', ...fresh(independent > 0 ? 1 : APP_MAX_PROMPT, s.currentDelayMs) };
}

/** Перевести освоенную цель в поддержание: расписание начинается с этой сессии и первого интервала. */
export function markMastered(
  s: AbaTargetState,
  sessionIndex: number,
  by: 'criterion' | 'baseline' | 'home_unverified' | 'inferred' = 'criterion',
): AbaTargetState {
  return {
    ...s,
    phase: 'mastered',
    masteredBy: by,
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
