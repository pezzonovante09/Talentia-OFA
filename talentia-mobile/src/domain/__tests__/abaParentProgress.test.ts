import { lastSessionSummary, parentTargetStatus, sortForParent } from '../abaParentProgress';
import type { AbaResponse, AbaTrial, AbaTrialKind } from '../../types/aba';

const trial = (kind: AbaTrialKind, response: AbaResponse): AbaTrial => ({ kind, response } as unknown as AbaTrial);

describe('прогресс ABA для родителя (вопрос 66)', () => {
  it('статус цели: учим / почти / освоено — без выведенного и непроверенного «освоено»', () => {
    expect(parentTargetStatus({ phase: 'baseline', sessionsAtCriterion: 0 })).toBe('learning');
    expect(parentTargetStatus({ phase: 'acquisition', sessionsAtCriterion: 0 })).toBe('learning');
    expect(parentTargetStatus({ phase: 'acquisition', sessionsAtCriterion: 1 })).toBe('almost');
    expect(parentTargetStatus({ phase: 'generalization_check', sessionsAtCriterion: 2 })).toBe('almost');
    expect(parentTargetStatus({ phase: 'mastered', sessionsAtCriterion: 3, masteredBy: 'criterion' })).toBe('mastered');
    expect(parentTargetStatus({ phase: 'maintenance', sessionsAtCriterion: 3, masteredBy: 'baseline' })).toBe('mastered');
    expect(parentTargetStatus({ phase: 'mastered', sessionsAtCriterion: 0, masteredBy: 'inferred' })).toBe('almost');
    expect(parentTargetStatus({ phase: 'mastered', sessionsAtCriterion: 0, masteredBy: 'home_unverified' })).toBe('almost');
  });

  it('за занятие: пробы без разогрева, закрывающей и прерванных; самостоятельные отдельно', () => {
    const trials = [
      trial('high_p', 'independent'),
      trial('teaching', 'independent'),
      trial('teaching', 'prompted'),
      trial('correction', 'prompted'),
      trial('transfer', 'independent'),
      trial('teaching', 'interrupted'),
      trial('closing', 'independent'),
    ];
    expect(lastSessionSummary({ day: '2026-11-01', startedAt: '2026-11-01T05:00:00.000Z' }, trials)).toEqual({ trials: 4, independent: 2, day: '2026-11-01' });
    expect(lastSessionSummary({ startedAt: '2026-10-30T05:00:00.000Z' }, [])).toEqual({ trials: 0, independent: 0, day: '2026-10-30' });
    expect(lastSessionSummary(null, trials)).toBeNull();
  });

  it('порядок строк: учим, почти, освоено', () => {
    const rows = sortForParent([{ id: 'c', status: 'mastered' as const }, { id: 'a', status: 'learning' as const }, { id: 'b', status: 'almost' as const }]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});
