/**
 * Прогресс ABA для родителя (разбор 2026-10-31, вопрос 66; №168; проверка `aba-pedagogy-specialist` 2026-11-01).
 * Три слова на цель и две цифры за занятие — без процентов, уровней подсказок и флагов (ABA.md «Что видит
 * родитель», №95, №96).
 *
 * - «учим» — базовая линия и обучение; «почти» — проверка переноса, сессии на критерии, флаги `needs_transfer`
 *   (рутина без переноса) и `needs_verification` (критерий без обученного наблюдателя); «освоено» — только по
 *   критерию или по проверенной базовой линии: «освоено по выводу» и «дома, без проверки» родителю как освоенное
 *   не показываются — это качество измерения, а не навыка, и для родителя оно «почти» (`transitionOffer` считает так же).
 * - Цель смешанного блока (`mixWith`, решение методиста 43; ревью 2026-11-18), освоенная по отдельности, пока блок не
 *   пройден, — «освоено отдельно, ждёт проверки вперемешку», а не «освоено». Блок снят с плана (флаг
 *   `mixed_not_established`, две сессии без итога) — «освоено отдельно, проверку вперемешку назначит специалист»:
 *   «ждёт» обещало бы проверку, которой план больше не ставит (финальная рецензия методиста).
 * - За занятие: N — пробы, где ребёнок отвечал по навыку (без прерванных, без разогрева и закрывающей пробы — они
 *   про настроение сессии; без коррекционной пробы — она успешна по построению и «сам» быть не может), M — из них
 *   самостоятельные; проба переноса считается — ответ без подсказки после отвлечения честно «сам».
 * - Было только сопряжение — отдельное состояние без цифр: родитель должен понять, что занятие было.
 */
import type { AbaFlag, AbaSession, AbaTargetState, AbaTrial } from '../types/aba';

export type ParentTargetStatus = 'learning' | 'almost' | 'mixed_pending' | 'mixed_by_specialist' | 'mastered';

type StatusInput = Pick<AbaTargetState, 'phase' | 'sessionsAtCriterion' | 'masteredBy' | 'mixedCheck'> & { flags?: readonly AbaFlag[] };

/** `mixes` — цель входит в группу смешанного блока программы (`mixGroups`: связь `mixWith` объявлена с одной стороны). */
export function parentTargetStatus(s: StatusInput, opts: { mixes?: boolean } = {}): ParentTargetStatus {
  const flags = s.flags ?? [];
  switch (s.phase) {
    case 'mastered':
    case 'maintenance':
      if (s.masteredBy === 'inferred' || s.masteredBy === 'home_unverified') return 'almost';
      if (!opts.mixes || s.mixedCheck?.done) return 'mastered';
      return flags.includes('mixed_not_established') ? 'mixed_by_specialist' : 'mixed_pending';
    case 'generalization_check':
      return 'almost';
    case 'acquisition':
      return s.sessionsAtCriterion > 0 || flags.includes('needs_transfer') || flags.includes('needs_verification') ? 'almost' : 'learning';
    case 'baseline':
      return 'learning';
  }
}

export type LastSessionSummary =
  | { kind: 'session'; trials: number; independent: number; day: string | null }
  /** Последним было только знакомство с наградами (сопряжение): проб не было, но занятие — было. */
  | { kind: 'pairing_only'; day: string };

/** Пробы, которые говорят о навыке: без разогрева, закрывающей, коррекционной и прерванных. */
const COUNTED_KINDS = new Set<AbaTrial['kind']>(['baseline', 'teaching', 'transfer', 'generalization', 'maintenance', 'verification']);

export function lastSessionSummary(session: Pick<AbaSession, 'day' | 'startedAt'> | null, trials: readonly AbaTrial[]): LastSessionSummary | null {
  if (!session) return null;
  const counted = trials.filter((t) => COUNTED_KINDS.has(t.kind) && t.response !== 'interrupted');
  return {
    kind: 'session',
    trials: counted.length,
    independent: counted.filter((t) => t.response === 'independent').length,
    day: session.day ?? session.startedAt.slice(0, 10),
  };
}

/** Порядок строк для родителя: сначала то, что учим, потом «почти», освоенное — внизу. */
const ORDER: Record<ParentTargetStatus, number> = { learning: 0, almost: 1, mixed_pending: 2, mixed_by_specialist: 2, mastered: 3 };

export function sortForParent<T extends { status: ParentTargetStatus }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
}
