/**
 * Критерий освоения ABA-цели и поддержание. Спецификация — «Критерий освоения —
 * полный» и «Поддержание» в `ABA.md`.
 *
 * «80% в трёх сессиях» недоопределено: без минимума проб, разных дней и разных
 * экземпляров критерий берётся одной удачной серией на одной картинке за вечер.
 * В прежней версии критерия в коде не было вовсе.
 */
import {
  COUNTS_TOWARD_MASTERY,
  MAINTENANCE_FAILS_TO_REACQUIRE,
  MAINTENANCE_GAP,
  MASTERY,
  type AbaSessionEndReason,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
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
  /** Проб в зачёт: обучающие, не прерванные, оценённые источником с правом на критерий. */
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

function summarizeGroup(trials: AbaTrial[], min: number): AbaSessionSummary {
  const counted = trials.filter(countable);
  const independent = counted.filter((t) => t.response === 'independent');
  const independentRate = counted.length ? independent.length / counted.length : 0;
  const enough = counted.length >= min;

  let outcome: SessionOutcome;
  if (enough) outcome = independentRate >= MASTERY.minIndependentRate ? 'meets' : 'breaks';
  else outcome = counted.length - independent.length > allowedMisses(min) ? 'breaks' : 'neutral';

  return {
    trials: counted.length,
    independentRate,
    outcome,
    counted: enough,
    independentExemplars: [...new Set(independent.map((t) => t.exemplarId))],
  };
}

/**
 * Итог сессии по цели.
 *
 * Короткая сессия серию не продлевает. Рвёт — если неудач уже столько, что 80%
 * в полной сессии были бы недостижимы, или если она оборвалась по критерию
 * остановки: короткими бывают как раз худшие сессии.
 *
 * У цепочки каждый шаг считается как отдельная цель, минимум — в прогонах, и
 * сессия в зачёт, только если в зачёт каждый шаг: ребёнок, стабильно
 * сыплющийся на третьем звене, руки не моет.
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
    const min = MASTERY.minChainRunsPerSession;
    const perStep = target.steps.map((step) => summarizeGroup(own.filter((t) => t.stepId === step.id), min));
    const all = summarizeGroup(own, min * target.steps.length);
    let outcome: SessionOutcome = 'neutral';
    if (perStep.some((x) => x.outcome === 'breaks')) outcome = 'breaks';
    else if (perStep.every((x) => x.outcome === 'meets')) outcome = 'meets';
    summary = { ...all, outcome, counted: perStep.every((x) => x.counted) };
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
    };
  }
  return {
    ...base,
    recentIndependentRates,
    sessionsAtCriterion: s.sessionsAtCriterion + 1,
    criterionDays: s.criterionDays.includes(day) ? s.criterionDays : [...s.criterionDays, day],
    exemplarsAtCriterion: [...new Set([...s.exemplarsAtCriterion, ...summary.independentExemplars])],
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

/** Перевести освоенную цель в поддержание: расписание начинается с этой сессии и первого интервала. */
export function markMastered(s: AbaTargetState, sessionIndex: number): AbaTargetState {
  return {
    ...s,
    phase: 'mastered',
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
 * следующая проба на следующей же сессии, со стартом **на уровне, где цель в
 * последний раз была успешна**: если ребёнок ответил с подсказкой L1 — с L1, а
 * не с полной модели. Откат к нулю у ребёнка, который навык почти держит, —
 * регресс, назначенный процедурой.
 *
 * Два провала подряд — навык распался: цель возвращается в обучение с
 * непрерывным подкреплением, серия критерия начинается заново. Иначе в данных
 * она оставалась бы «освоенной» без единого обучающего блока.
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
  const reset = {
    startPromptLevel: lastSuccessfulPromptLevel,
    lastSuccessfulPromptLevel,
    consecutiveIndependentAtStart: 0,
    consecutiveAboveStart: 0,
    maintenanceGapIndex: 0 as GapIndex,
  };

  if (fails >= MAINTENANCE_FAILS_TO_REACQUIRE) {
    return {
      ...base,
      ...reset,
      phase: 'acquisition',
      maintenanceFailsInRow: 0,
      sessionsAtCriterion: 0,
      criterionDays: [],
      exemplarsAtCriterion: [],
      generalizationProbes: [],
    };
  }
  return { ...base, ...reset, phase: 'maintenance', maintenanceFailsInRow: fails };
}
