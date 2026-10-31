/**
 * Прогресс ABA для родителя (разбор 2026-10-31, вопрос 66; №168). Три слова на цель и две цифры за
 * занятие — без процентов, уровней подсказок и флагов (ABA.md «Что видит родитель», №95, №96).
 *
 * - «учим» — базовая линия и обучение; «почти» — проверка переноса или уже есть сессии на
 *   критерии; «освоено» — только по критерию или по проверенной базовой линии: «освоено по
 *   выводу» и «дома, без проверки» родителю как освоенное не показываются (`transitionOffer`
 *   считает так же).
 * - За занятие: N — пробы, где ребёнок отвечал (без прерванных, без разогрева и закрывающей пробы —
 *   они про настроение сессии, не про навык), M — из них самостоятельные.
 */
import type { AbaSession, AbaTargetState, AbaTrial } from '../types/aba';

export type ParentTargetStatus = 'learning' | 'almost' | 'mastered';

export function parentTargetStatus(s: Pick<AbaTargetState, 'phase' | 'sessionsAtCriterion' | 'masteredBy'>): ParentTargetStatus {
  switch (s.phase) {
    case 'mastered':
    case 'maintenance':
      return s.masteredBy === 'inferred' || s.masteredBy === 'home_unverified' ? 'almost' : 'mastered';
    case 'generalization_check':
      return 'almost';
    case 'acquisition':
      return s.sessionsAtCriterion > 0 ? 'almost' : 'learning';
    case 'baseline':
      return 'learning';
  }
}

export type LastSessionSummary = { trials: number; independent: number; day: string | null };

/** Пробы, которые говорят о навыке: без разогрева, закрывающей и прерванных. */
const COUNTED_KINDS = new Set<AbaTrial['kind']>(['baseline', 'teaching', 'correction', 'transfer', 'generalization', 'maintenance', 'verification']);

export function lastSessionSummary(session: Pick<AbaSession, 'day' | 'startedAt'> | null, trials: readonly AbaTrial[]): LastSessionSummary | null {
  if (!session) return null;
  const counted = trials.filter((t) => COUNTED_KINDS.has(t.kind) && t.response !== 'interrupted');
  return {
    trials: counted.length,
    independent: counted.filter((t) => t.response === 'independent').length,
    day: session.day ?? session.startedAt.slice(0, 10),
  };
}

/** Порядок строк для родителя: сначала то, что учим, потом «почти», освоенное — внизу. */
const ORDER: Record<ParentTargetStatus, number> = { learning: 0, almost: 1, mastered: 2 };

export function sortForParent<T extends { status: ParentTargetStatus }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
}
