import { formatLocalDateYMD, getLevelFromXP, isLessonAlreadyCompleted, useProgressStore } from '../progressStore';

const TOPIC_ID = 'test-topic';
const LESSON_ID = 'test-lesson';

function today(): string {
  return formatLocalDateYMD(new Date());
}

describe('progressStore', () => {
  beforeEach(() => {
    useProgressStore.getState().resetAll();
  });

  describe('addXP', () => {
    it('increases xp and recomputes level', () => {
      useProgressStore.getState().addXP(50);
      const state = useProgressStore.getState();
      expect(state.xp).toBe(50);
      expect(state.level).toBe(getLevelFromXP(50));
    });

    it('accumulates xpHistory for the current day across multiple calls', () => {
      useProgressStore.getState().addXP(20);
      useProgressStore.getState().addXP(30);
      const state = useProgressStore.getState();
      expect(state.xp).toBe(50);
      expect(state.xpHistory[today()]).toBe(50);
    });
  });

  describe('recordAnswer', () => {
    it('increases skill and correctStreak on a correct answer, resets incorrectStreak', () => {
      useProgressStore.getState().recordAnswer({ topicId: TOPIC_ID, lessonId: LESSON_ID, correct: true });
      const topic = useProgressStore.getState().topics[TOPIC_ID];
      expect(topic.totalAttempts).toBe(1);
      expect(topic.totalCorrect).toBe(1);
      expect(topic.correctStreak).toBe(1);
      expect(topic.incorrectStreak).toBe(0);
      expect(topic.skill).toBe(3);
    });

    it('decreases skill and increments incorrectStreak on a wrong answer, resets correctStreak', () => {
      useProgressStore.getState().recordAnswer({ topicId: TOPIC_ID, lessonId: LESSON_ID, correct: true });
      useProgressStore.getState().recordAnswer({ topicId: TOPIC_ID, lessonId: LESSON_ID, correct: false });
      const topic = useProgressStore.getState().topics[TOPIC_ID];
      expect(topic.totalAttempts).toBe(2);
      expect(topic.totalCorrect).toBe(1);
      expect(topic.correctStreak).toBe(0);
      expect(topic.incorrectStreak).toBe(1);
      expect(topic.skill).toBe(1); // 3 - 2
    });

    it('clamps skill within [0, 100]', () => {
      for (let i = 0; i < 10; i++) {
        useProgressStore.getState().recordAnswer({ topicId: TOPIC_ID, lessonId: LESSON_ID, correct: false });
      }
      expect(useProgressStore.getState().topics[TOPIC_ID].skill).toBe(0);
    });

    it('only increments globalCorrectCount on correct answers', () => {
      useProgressStore.getState().recordAnswer({ topicId: TOPIC_ID, lessonId: LESSON_ID, correct: true });
      useProgressStore.getState().recordAnswer({ topicId: TOPIC_ID, lessonId: LESSON_ID, correct: false });
      useProgressStore.getState().recordAnswer({ topicId: TOPIC_ID, lessonId: LESSON_ID, correct: true });
      expect(useProgressStore.getState().globalCorrectCount).toBe(2);
    });

    it('unlocks the tenCorrectAnswers achievement at 10 global correct answers', () => {
      for (let i = 0; i < 10; i++) {
        useProgressStore.getState().recordAnswer({ topicId: TOPIC_ID, lessonId: LESSON_ID, correct: true });
      }
      expect(useProgressStore.getState().achievements.tenCorrectAnswers).toBe(true);
    });

    it('starts a 1-day streak on the first ever answer', () => {
      useProgressStore.getState().recordAnswer({ topicId: TOPIC_ID, lessonId: LESSON_ID, correct: true });
      const state = useProgressStore.getState();
      expect(state.streakCount).toBe(1);
      expect(state.lastActivityDate).toBe(today());
    });
  });

  describe('markLessonCompleted (anti-farming / stars)', () => {
    it('marks the lesson completed and reports it via isLessonAlreadyCompleted', () => {
      expect(isLessonAlreadyCompleted(TOPIC_ID, LESSON_ID)).toBe(false);
      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: LESSON_ID, mistakeCount: 0 });
      expect(isLessonAlreadyCompleted(TOPIC_ID, LESSON_ID)).toBe(true);
    });

    it('awards 3 stars for a perfect run (no mistakes, no skips)', () => {
      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: LESSON_ID, mistakeCount: 0, hadSkips: false });
      expect(useProgressStore.getState().lessonStars[LESSON_ID]).toBe(3);
    });

    it('caps stars at 2 when any task was skipped, even with zero mistakes', () => {
      // Regression test for the "skip -> free 3 stars" exploit: skipping must not be
      // a free path to a perfect score.
      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: LESSON_ID, mistakeCount: 0, hadSkips: true });
      expect(useProgressStore.getState().lessonStars[LESSON_ID]).toBe(2);
    });

    it('awards 2 stars for up to 2 mistakes, 1 star for more', () => {
      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: 'lesson-2-mistakes', mistakeCount: 2 });
      expect(useProgressStore.getState().lessonStars['lesson-2-mistakes']).toBe(2);

      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: 'lesson-3-mistakes', mistakeCount: 3 });
      expect(useProgressStore.getState().lessonStars['lesson-3-mistakes']).toBe(1);
    });

    it('never downgrades a previously earned star rating on a worse replay', () => {
      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: LESSON_ID, mistakeCount: 0 });
      expect(useProgressStore.getState().lessonStars[LESSON_ID]).toBe(3);

      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: LESSON_ID, mistakeCount: 5 });
      expect(useProgressStore.getState().lessonStars[LESSON_ID]).toBe(3);
    });

    it('upgrades stars on a better replay', () => {
      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: LESSON_ID, mistakeCount: 5 });
      expect(useProgressStore.getState().lessonStars[LESSON_ID]).toBe(1);

      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: LESSON_ID, mistakeCount: 0 });
      expect(useProgressStore.getState().lessonStars[LESSON_ID]).toBe(3);
    });

    it('tracks daily lesson completions and resets the counter on a new day', () => {
      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: 'lesson-a', mistakeCount: 0 });
      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: 'lesson-b', mistakeCount: 0 });
      const state = useProgressStore.getState();
      expect(state.dailyLessonsCompleted).toBe(2);
      expect(state.dailyGoalDate).toBe(today());
      expect(state.lessonsCompletedByDate[today()]).toBe(2);
    });

    it('does not increment daily/weekly lesson counters on replay', () => {
      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: LESSON_ID, mistakeCount: 0 });
      expect(useProgressStore.getState().dailyLessonsCompleted).toBe(1);
      expect(useProgressStore.getState().lessonsCompletedByDate[today()]).toBe(1);

      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: LESSON_ID, mistakeCount: 0 });
      expect(useProgressStore.getState().dailyLessonsCompleted).toBe(1);
      expect(useProgressStore.getState().lessonsCompletedByDate[today()]).toBe(1);
    });

    it('does not unlock perfectLesson achievement on a perfect replay after a imperfect first run', () => {
      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: LESSON_ID, mistakeCount: 3 });
      expect(useProgressStore.getState().achievements.perfectLesson).toBe(false);

      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: LESSON_ID, mistakeCount: 0, hadSkips: false });
      expect(useProgressStore.getState().achievements.perfectLesson).toBe(false);
      expect(useProgressStore.getState().lessonStars[LESSON_ID]).toBe(3);
    });
  });

  describe('resetAll', () => {
    it('clears xp, stars and completed lessons back to defaults', () => {
      useProgressStore.getState().addXP(100);
      useProgressStore.getState().markLessonCompleted({ topicId: TOPIC_ID, lessonId: LESSON_ID, mistakeCount: 0 });
      useProgressStore.getState().resetAll();
      const state = useProgressStore.getState();
      expect(state.xp).toBe(0);
      expect(state.level).toBe(1);
      expect(state.lessonStars).toEqual({});
      expect(isLessonAlreadyCompleted(TOPIC_ID, LESSON_ID)).toBe(false);
    });
  });
});
