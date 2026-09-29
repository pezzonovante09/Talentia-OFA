import { filterTasksForProfile, getLesson } from '../worlds';
import type { LessonTask } from '../worlds';

/**
 * Чистые функции выборки заданий. Проверки, опиравшиеся на конкретные уроки
 * прежнего корпуса, убраны вместе с ним; инварианты нового корпуса живут в
 * corpus.test.ts.
 */
describe('worlds data helpers', () => {

  it('getLesson returns undefined for unknown id', () => {
    expect(getLesson('no-such-lesson')).toBeUndefined();
  });

  it('filterTasksForProfile standard mode excludes special_aba when standard exists', () => {
    const tasks: LessonTask[] = [
      {
        id: 'a',
        type: 'multiple_choice',
        questionKey: 'x',
        difficulty: 1,
        audience: 'standard',
        options: [{ id: '1', textKey: 'y', correct: true }],
      },
      {
        id: 'b',
        type: 'multiple_choice',
        questionKey: 'x',
        difficulty: 1,
        audience: 'special_aba',
        options: [{ id: '1', textKey: 'y', correct: true }],
      },
    ];
    const out = filterTasksForProfile(tasks, {
      child_mode: 'standard',
      methodology: null,
    });
    expect(out.map((t) => t.id)).toEqual(['a']);
  });

  it('filterTasksForProfile special mode prefers special_aba rows', () => {
    const tasks: LessonTask[] = [
      {
        id: 'a',
        type: 'multiple_choice',
        questionKey: 'x',
        difficulty: 1,
        audience: 'standard',
        options: [{ id: '1', textKey: 'y', correct: true }],
      },
      {
        id: 'b',
        type: 'multiple_choice',
        questionKey: 'x',
        difficulty: 1,
        audience: 'special_aba',
        options: [{ id: '1', textKey: 'y', correct: true }],
      },
    ];
    const specialOut = filterTasksForProfile(tasks, {
      child_mode: 'special',
      methodology: 'aba',
    });
    expect(specialOut.map((t) => t.id)).toEqual(['b']);
  });

  it('filterTasksForProfile falls back to special_aba when lesson is ABA-only (showcase)', () => {
    const tasks: LessonTask[] = [
      {
        id: 'b',
        type: 'multiple_choice',
        questionKey: 'x',
        difficulty: 1,
        audience: 'special_aba',
        options: [{ id: '1', textKey: 'y', correct: true }],
      },
    ];
    expect(filterTasksForProfile(tasks, null).map((t) => t.id)).toEqual(['b']);
    expect(
      filterTasksForProfile(tasks, { child_mode: 'standard', methodology: null }).map((t) => t.id),
    ).toEqual(['b']);
  });

});
