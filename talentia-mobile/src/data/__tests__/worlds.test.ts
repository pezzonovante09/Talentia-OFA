import {
  filterTasksForProfile,
  getLesson,
  getWorldForLesson,
  withSpacedReviewTasks,
} from '../worlds';
import type { LessonTask } from '../worlds';

describe('worlds data helpers', () => {
  it('getLesson returns a known lesson', () => {
    const lesson = getLesson('jungle-add-1');
    expect(lesson).toBeDefined();
    expect(lesson?.id).toBe('jungle-add-1');
    expect(lesson?.tasks.length).toBeGreaterThan(0);
  });

  it('getLesson returns undefined for unknown id', () => {
    expect(getLesson('no-such-lesson')).toBeUndefined();
  });

  it('getWorldForLesson resolves world for lesson', () => {
    const world = getWorldForLesson('jungle-add-1');
    expect(world).toBeDefined();
    expect(world?.id).toBe('jungle');
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

  it('withSpacedReviewTasks injects a prior-lesson task on every 3rd lesson', () => {
    const lesson = getLesson('meadow-c5-l3');
    expect(lesson).toBeDefined();
    if (!lesson) return;
    const filtered = filterTasksForProfile(lesson.tasks, null);
    const withReview = withSpacedReviewTasks(lesson.id, filtered, null);
    expect(withReview.length).toBe(filtered.length + 1);
    expect(withReview.some((t) => t.id.startsWith('review__'))).toBe(true);
  });
});
