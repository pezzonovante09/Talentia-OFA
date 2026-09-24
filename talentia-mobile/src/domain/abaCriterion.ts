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
  MAINTENANCE_GAP,
  MASTERY,
  type AbaTarget,
  type AbaTargetState,
  type AbaTrial,
} from '../types/aba';

/** С какой доли самостоятельных цель получает пробы переноса. */
export const GENERALIZATION_PROBE_FROM = 0.6;

/** Итог сессии по одной цели. */
export type AbaSessionSummary = {
  /** Проб в зачёт: обучающие, не прерванные, оценённые источником с правом на критерий. */
  trials: number;
  independentRate: number;
  /** Сессия в зачёт трёх подряд: проб не меньше минимума и доля не ниже порога. */
  meetsCriterion: boolean;
  /** Сессия вообще имеет право на голос: проб хватило. Иначе она не рвёт и не продлевает серию. */
  counts: boolean;
  /** Обучающие экземпляры, на которых был самостоятельный ответ. */
  independentExemplars: string[];
};

/**
 * Проба, которая имеет право двигать критерий.
 *
 * Разогрев, перенос и коррекция в процент не складываются: у них другое
 * назначение. Проба, засчитанная детектором начала звука, «ответил / нет» знает,
 * а верно ли — нет.
 */
function countable(t: AbaTrial): boolean {
  return t.kind === 'teaching' && t.response !== 'interrupted' && COUNTS_TOWARD_MASTERY[t.scoredBy];
}

function summarizeGroup(trials: AbaTrial[]): AbaSessionSummary {
  const counted = trials.filter(countable);
  const independent = counted.filter((t) => t.response === 'independent');
  const independentRate = counted.length ? independent.length / counted.length : 0;
  const counts = counted.length >= MASTERY.minTrialsPerSession;
  return {
    trials: counted.length,
    independentRate,
    counts,
    meetsCriterion: counts && independentRate >= MASTERY.minIndependentRate,
    independentExemplars: [...new Set(independent.map((t) => t.exemplarId))],
  };
}

/**
 * Итог сессии по цели.
 *
 * У цепочки критерий — **все шаги**, а не 80% шагов: ребёнок, стабильно
 * сыплющийся на третьем звене, руки не моет. Поэтому каждый шаг считается как
 * отдельная цель, и сессия в зачёт, только если в зачёт каждый.
 */
export function summarizeSession(target: AbaTarget, sessionTrials: AbaTrial[]): AbaSessionSummary {
  const own = sessionTrials.filter((t) => t.targetId === target.id);
  if (!target.steps?.length) return summarizeGroup(own);

  const perStep = target.steps.map((step) => summarizeGroup(own.filter((t) => t.stepId === step.id)));
  const all = summarizeGroup(own);
  return {
    ...all,
    counts: perStep.every((s) => s.counts),
    meetsCriterion: perStep.every((s) => s.meetsCriterion),
  };
}

/**
 * Сессия прошла: обновить серию критерия.
 *
 * Сессия, в которой проб меньше минимума, не рвёт серию и не продлевает её.
 * Сессия ниже порога рвёт: «три подряд» значит подряд. Сессия в тот же день, что
 * уже засчитанная, продлевает серию, но нового дня не добавляет — критерий
 * требует разных дней, а не просто трёх сессий.
 */
export function applySession(
  s: AbaTargetState,
  summary: AbaSessionSummary,
  sessionIndex: number,
  day: string,
): AbaTargetState {
  const base = { ...s, lastSessionIndex: sessionIndex };
  if (!summary.counts) return base;

  const recentIndependentRates = [...s.recentIndependentRates, summary.independentRate].slice(-10);
  if (!summary.meetsCriterion) {
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
  return {
    ...s,
    generalizationProbes: [...s.generalizationProbes, t.response].slice(-MASTERY.generalizationWindow),
  };
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
  const passes = s.generalizationProbes.filter((r) => r === 'independent').length;
  if (passes < MASTERY.minGeneralizationPasses) gaps.push('generalization');
  return gaps;
}

export function isMasteryMet(s: AbaTargetState): boolean {
  return criterionGaps(s).length === 0;
}

/** Перевести освоенную цель в поддержание: расписание начинается с первого интервала. */
export function markMastered(s: AbaTargetState): AbaTargetState {
  return { ...s, phase: 'mastered', maintenanceGapIndex: 0 };
}

/**
 * Пора ли проба поддержания. Интервалы 1, 2, 5, 12 — **в сессиях**, а не в днях:
 * пропуск недели не обнуляет расписание.
 */
export function isMaintenanceDue(s: AbaTargetState, sessionIndex: number): boolean {
  if (s.phase !== 'mastered' && s.phase !== 'maintenance') return false;
  return sessionIndex - s.lastSessionIndex >= MAINTENANCE_GAP[s.maintenanceGapIndex];
}

/**
 * Итог пробы поддержания.
 *
 * Успех отодвигает следующую. Провал возвращает цель **на уровень подсказки, где
 * она в последний раз была успешна**, а не к полной модели, как коробки Лейтнера в
 * `mastery.ts`: откат к нулю у ребёнка, который навык почти держит, — регресс,
 * назначенный процедурой.
 */
export function applyMaintenanceProbe(
  s: AbaTargetState,
  t: AbaTrial,
  sessionIndex: number,
): AbaTargetState {
  if (t.kind !== 'maintenance' || t.response === 'interrupted') return s;
  if (t.response === 'independent') {
    return {
      ...s,
      phase: 'maintenance',
      lastSessionIndex: sessionIndex,
      lastSuccessfulPromptLevel: 0,
      maintenanceGapIndex: Math.min(MAINTENANCE_GAP.length - 1, s.maintenanceGapIndex + 1) as
        | 0
        | 1
        | 2
        | 3,
    };
  }
  return {
    ...s,
    phase: 'maintenance',
    lastSessionIndex: sessionIndex,
    maintenanceGapIndex: 0,
    startPromptLevel: s.lastSuccessfulPromptLevel,
    consecutiveIndependentAtStart: 0,
    consecutiveAboveStart: 0,
  };
}
