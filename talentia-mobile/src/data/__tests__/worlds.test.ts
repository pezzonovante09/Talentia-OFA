import {
  filterTasksForProfile,
  getLesson,
  getWorldForLesson,
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

  it('filterTasksForProfile standard mode excludes special_aba tasks', () => {
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

  it('filterTasksForProfile special mode uses same tasks as standard (excludes special_aba rows)', () => {
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
    const standardOut = filterTasksForProfile(tasks, {
      child_mode: 'standard',
      methodology: null,
    });
    const specialOut = filterTasksForProfile(tasks, {
      child_mode: 'special',
      methodology: 'aba',
    });
    expect(specialOut.map((t) => t.id)).toEqual(['a']);
    expect(specialOut.map((t) => t.id)).toEqual(standardOut.map((t) => t.id));
  });

  it('filterTasksForProfile null profile behaves like standard', () => {
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
    expect(filterTasksForProfile(tasks, null)).toHaveLength(0);
  });
});
