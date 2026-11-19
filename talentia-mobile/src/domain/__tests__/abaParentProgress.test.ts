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

  it('флаги «почти» (методист 2026-11-01): рутина без переноса и критерий без обученного наблюдателя', () => {
    expect(parentTargetStatus({ phase: 'acquisition', sessionsAtCriterion: 0, flags: ['needs_transfer'] })).toBe('almost');
    expect(parentTargetStatus({ phase: 'acquisition', sessionsAtCriterion: 0, flags: ['needs_verification'] })).toBe('almost');
    expect(parentTargetStatus({ phase: 'acquisition', sessionsAtCriterion: 0, flags: ['prompt_dependent'] })).toBe('learning');
  });

  it('смешанный блок (решение 43): освоенное отдельно до пройденного блока — «ждёт проверки вперемешку»', () => {
    const own = { phase: 'mastered' as const, sessionsAtCriterion: 3, masteredBy: 'criterion' as const };
    expect(parentTargetStatus(own, { mixes: true })).toBe('mixed_pending');
    expect(parentTargetStatus({ ...own, mixedCheck: { days: ['2026-11-18'] } }, { mixes: true })).toBe('mixed_pending');
    expect(parentTargetStatus({ ...own, phase: 'maintenance', mixedCheck: { days: [], failsInRow: 1 } }, { mixes: true })).toBe('mixed_pending');
    expect(parentTargetStatus({ ...own, mixedCheck: { days: ['2026-11-18', '2026-11-19'], done: true } }, { mixes: true })).toBe('mastered');
    // цели без смешанного блока — как прежде
    expect(parentTargetStatus(own)).toBe('mastered');
    // «почти» сильнее: непроверенное освоение — сначала своя проверка
    expect(parentTargetStatus({ ...own, masteredBy: 'home_unverified' }, { mixes: true })).toBe('almost');
    expect(parentTargetStatus({ phase: 'acquisition', sessionsAtCriterion: 0 }, { mixes: true })).toBe('learning');
  });

  it('блок снят с плана (`mixed_not_established`) — «проверку вперемешку назначит специалист», а не «ждёт»', () => {
    const own = { phase: 'mastered' as const, sessionsAtCriterion: 3, masteredBy: 'criterion' as const, flags: ['mixed_not_established' as const] };
    expect(parentTargetStatus({ ...own, mixedCheck: { days: [] } }, { mixes: true })).toBe('mixed_by_specialist');
    expect(parentTargetStatus({ ...own, phase: 'maintenance', mixedCheck: { days: ['2026-11-18'] } }, { mixes: true })).toBe('mixed_by_specialist');
    // партнёр, успевший пройти блок, — освоен, флаг ему не мешает
    expect(parentTargetStatus({ ...own, mixedCheck: { days: ['2026-11-18', '2026-11-19'], done: true } }, { mixes: true })).toBe('mastered');
    // вернулась в обучение — «учим», как у всех
    expect(parentTargetStatus({ ...own, phase: 'acquisition', sessionsAtCriterion: 0 }, { mixes: true })).toBe('learning');
    expect(sortForParent([{ status: 'mastered' as const }, { status: 'mixed_by_specialist' as const }, { status: 'learning' as const }]).map((r) => r.status)).toEqual([
      'learning',
      'mixed_by_specialist',
      'mastered',
    ]);
  });

  it('за занятие: пробы без разогрева, закрывающей, коррекционной и прерванных; перенос считается; самостоятельные отдельно', () => {
    const trials = [
      trial('high_p', 'independent'),
      trial('teaching', 'independent'),
      trial('teaching', 'prompted'),
      trial('correction', 'prompted'),
      trial('transfer', 'independent'),
      trial('teaching', 'interrupted'),
      trial('closing', 'independent'),
    ];
    expect(lastSessionSummary({ day: '2026-11-01', startedAt: '2026-11-01T05:00:00.000Z' }, trials)).toEqual({ kind: 'session', trials: 3, independent: 2, day: '2026-11-01' });
    expect(lastSessionSummary({ startedAt: '2026-10-30T05:00:00.000Z' }, [])).toEqual({ kind: 'session', trials: 0, independent: 0, day: '2026-10-30' });
    expect(lastSessionSummary(null, trials)).toBeNull();
  });

  it('было только сопряжение — отдельное состояние без цифр (форма результата загрузчика)', () => {
    const last: ReturnType<typeof lastSessionSummary> = { kind: 'pairing_only', day: '2026-11-01' };
    expect(last.kind === 'pairing_only' && last.day).toBe('2026-11-01');
  });

  it('порядок строк: учим, почти, ждёт проверки вперемешку, освоено', () => {
    const rows = sortForParent([
      { id: 'd', status: 'mastered' as const },
      { id: 'c', status: 'mixed_pending' as const },
      { id: 'a', status: 'learning' as const },
      { id: 'b', status: 'almost' as const },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
