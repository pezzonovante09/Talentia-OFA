import {
  filterTasksForProfile,
  getLesson,
  getTopicForLesson,
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

  describe('jungle-aba-showcase split (was a single 23-task lesson)', () => {
    const SHOWCASE_IDS = [
      'jungle-aba-showcase-1',
      'jungle-aba-showcase-2',
      'jungle-aba-showcase-3',
      'jungle-aba-showcase-4',
      'jungle-aba-showcase-5',
    ];

    it('splits the old 23-task marathon into 5 short lessons of at most 5 tasks each', () => {
      const lessons = SHOWCASE_IDS.map((id) => getLesson(id));
      expect(lessons.every((l) => l !== undefined)).toBe(true);
      const totalTasks = lessons.reduce((sum, l) => sum + (l?.tasks.length ?? 0), 0);
      expect(totalTasks).toBe(23);
      for (const l of lessons) {
        expect(l!.tasks.length).toBeLessThanOrEqual(5);
      }
    });

    it('keeps every task id unique across the 5 split lessons (no duplicated/dropped tasks)', () => {
      const allIds = SHOWCASE_IDS.flatMap((id) => getLesson(id)?.tasks.map((t) => t.id) ?? []);
      expect(new Set(allIds).size).toBe(allIds.length);
    });

    it('are all part of the jungle-addition topic, in order, right after jungle-add-2', () => {
      const topic = getTopicForLesson('jungle-aba-showcase-1');
      expect(topic?.id).toBe('jungle-addition');
      const lessonIds = topic!.lessons.map((l) => l.id);
      const addTwoIdx = lessonIds.indexOf('jungle-add-2');
      expect(lessonIds.slice(addTwoIdx + 1, addTwoIdx + 6)).toEqual(SHOWCASE_IDS);
    });

    it('total reward XP across the split matches the original single lesson (25)', () => {
      const total = SHOWCASE_IDS.reduce((sum, id) => sum + (getLesson(id)?.reward?.xp ?? 0), 0);
      expect(total).toBe(25);
    });

    it('ABA-mode (special) profile sees the special_aba tasks in every split lesson', () => {
      const abaProfile = { child_mode: 'special' as const, methodology: 'aba' as const };
      for (const id of SHOWCASE_IDS) {
        const lesson = getLesson(id)!;
        const visible = filterTasksForProfile(lesson.tasks, abaProfile);
        expect(visible.length).toBeGreaterThan(0);
      }
    });

    it('standard profile still sees only the one standard-audience warmup task in lesson 1 (matches pre-split behavior)', () => {
      const lesson1 = getLesson('jungle-aba-showcase-1')!;
      const visible = filterTasksForProfile(lesson1.tasks, { child_mode: 'standard', methodology: null });
      expect(visible.map((t) => t.id)).toEqual(['jungle-aba-t0']);
    });
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
