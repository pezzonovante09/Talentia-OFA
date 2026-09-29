/**
 * getWorldStats — чистая агрегация по темам мира.
 *
 * Мир берётся из фикстуры, а не из корпуса: прежняя версия проверяла
 * `jungle` из реального контента и падала, как только контент удалили.
 * Агрегация от наполнения курса не зависит, и тест не должен зависеть тоже.
 */
jest.mock('../../data/worlds', () => ({
  worlds: [
    {
      id: 'fixture-world',
      nameKey: 'x',
      descKey: 'x',
      biome: 'b',
      accentColor: '#000000',
      ageBands: ['7'],
      topics: [
        { id: 'fixture-addition', nameKey: 'x', subject: 'math', lessons: [] },
        { id: 'fixture-reading', nameKey: 'x', subject: 'russian', lessons: [] },
      ],
    },
  ],
}));

import { getWorldStats } from '../reportService';
import type { TopicProgress } from '../../store/progressStore';

describe('getWorldStats', () => {
  it('returns null for unknown worldId', () => {
    expect(getWorldStats('nonexistent-world', {})).toBeNull();
  });

  it('aggregates accuracy by raw subject key (localized server-side) for known world with topic progress', () => {
    const topics: Record<string, TopicProgress> = {
      'fixture-addition': {
        topicId: 'fixture-addition',
        skill: 0,
        difficulty: 1,
        correctStreak: 0,
        incorrectStreak: 0,
        completedLessons: {},
        totalCorrect: 8,
        totalAttempts: 10,
      },
    };
    const result = getWorldStats('fixture-world', topics);
    expect(result).not.toBeNull();
    expect(result!.totalCorrect).toBe(8);
    expect(result!.totalAttempts).toBe(10);
    // Raw subject id, not a display label — the proxy translates this key
    // into the requested report language via its own subjectLabel map.
    expect(result!.accuracyBySubject['math']).toBe(80);
  });

  it('returns zeros when world exists but no matching topic progress', () => {
    const result = getWorldStats('fixture-world', {});
    expect(result).not.toBeNull();
    expect(result!.totalCorrect).toBe(0);
    expect(result!.totalAttempts).toBe(0);
    expect(Object.keys(result!.accuracyBySubject)).toHaveLength(0);
  });
});
