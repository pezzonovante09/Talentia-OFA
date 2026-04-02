import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getTopicForLesson, worlds } from '../data/worlds';
import { getLevelFromXP } from '../utils/xpUtils';

export type TopicProgress = {
  topicId: string;
  skill: number;
  difficulty: number;
  correctStreak: number;
  incorrectStreak: number;
  totalCorrect: number;
  totalAttempts: number;
  completedLessons: Record<string, boolean>;
};

export type Achievements = {
  firstLessonCompleted: boolean;
  tenCorrectAnswers: boolean;
  threeDayStreak: boolean;
  firstWorldCompleted: boolean;
  sevenDayStreak: boolean;
  fiftyCorrectAnswers: boolean;
  perfectLesson: boolean;
  islandExplorer: boolean;
  hundredCorrectAnswers: boolean;
  allWorldsStarted: boolean;
};

export type LessonStatus = 'locked' | 'available' | 'completed';

export { getLevelFromXP, getXPToNextLevel } from '../utils/xpUtils';

type ProgressState = {
  topics: Record<string, TopicProgress>;
  achievements: Achievements;
  globalCorrectCount: number;
  streakCount: number;
  lastActivityDate: string | null;
  xp: number;
  level: number;
  lessonStars: Record<string, 1 | 2 | 3>;
  dailyLessonsCompleted: number;
  dailyGoalDate: string | null;
  dailyGoal: number;
  /** date (YYYY-MM-DD) → XP earned on that day */
  xpHistory: Record<string, number>;
  getTopicProgress: (topicId: string) => TopicProgress;
  getLessonStatus: (lessonId: string, orderedLessonIds: string[]) => LessonStatus;
  recordAnswer: (params: {
    topicId: string;
    lessonId: string;
    correct: boolean;
    taskId?: string;
    taskIndex?: number;
    promptLevel?: 0 | 1 | 2;
    latencyMs?: number;
    successType?: 'pure' | 'assisted';
    sessionId?: string;
    attemptNo?: number;
  }) => void;
  markLessonCompleted: (params: { topicId: string; lessonId: string; perfect?: boolean; mistakeCount?: number }) => void;
  addXP: (amount: number) => void;
  setDailyGoal: (goal: number) => void;
  resetAll: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isYesterday(previous: string, today: string) {
  const [py, pm, pd] = previous.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const prevDate = new Date(py, pm - 1, pd);
  const todayDate = new Date(ty, tm - 1, td);
  const diffMs = todayDate.getTime() - prevDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

function checkAllWorldsStarted(topics: Record<string, TopicProgress>): boolean {
  const worldIds = worlds.map((w) => w.id);
  return worldIds.every((worldId) => {
    const world = worlds.find((w) => w.id === worldId);
    if (!world) return false;
    return world.topics.some((topic) => {
      const tp = topics[topic.id];
      return tp && (tp.totalAttempts > 0 || Object.values(tp.completedLessons).some(Boolean));
    });
  });
}

function checkWorldCompleted(topicId: string, topics: Record<string, TopicProgress>): boolean {
  const topic = worlds.flatMap((w) => w.topics).find((t) => t.id === topicId);
  if (!topic) return false;
  const world = worlds.find((w) => w.id === topic.worldId);
  if (!world) return false;
  return world.topics.every((t) => {
    const tp = topics[t.id];
    return tp && t.lessons.every((l) => !!tp.completedLessons[l.id]);
  });
}

/** Returns worlds where all topics have all lessons completed */
export function getCompletedWorlds(topics: Record<string, TopicProgress>): typeof worlds {
  return worlds.filter((world) =>
    world.topics.every((t) => {
      const tp = topics[t.id];
      return tp && t.lessons.every((l) => !!tp.completedLessons[l.id]);
    }),
  );
}


export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      topics: {},
      achievements: {
        firstLessonCompleted: false,
        tenCorrectAnswers: false,
        threeDayStreak: false,
        firstWorldCompleted: false,
        sevenDayStreak: false,
        fiftyCorrectAnswers: false,
        perfectLesson: false,
        islandExplorer: false,
        hundredCorrectAnswers: false,
        allWorldsStarted: false,
      },
      globalCorrectCount: 0,
      streakCount: 0,
      lastActivityDate: null,
      xp: 0,
      level: 1,
      lessonStars: {},
      dailyLessonsCompleted: 0,
      dailyGoalDate: null,
      dailyGoal: 3,
      xpHistory: {},

      getTopicProgress: (topicId) => {
        const state = get();
        const found = state.topics[topicId];
        if (found) return found;
        const initial: TopicProgress = {
          topicId,
          skill: 0,
          difficulty: 1,
          correctStreak: 0,
          incorrectStreak: 0,
          totalCorrect: 0,
          totalAttempts: 0,
          completedLessons: {},
        };
        set((prev) => ({
          topics: { ...prev.topics, [topicId]: initial },
        }));
        return initial;
      },

      getLessonStatus: (lessonId, orderedLessonIds) => {
        const state = get();
        const index = orderedLessonIds.indexOf(lessonId);
        if (index < 0) return 'locked';
        const topic = getTopicForLesson(lessonId);
        const thisTopic = topic ? state.topics[topic.id] : undefined;
        const thisCompleted = !!thisTopic?.completedLessons[lessonId];
        if (index === 0) return thisCompleted ? 'completed' : 'available';
        const prevId = orderedLessonIds[index - 1];
        const prevTopic = getTopicForLesson(prevId);
        const prevCompleted = prevTopic
          ? !!state.topics[prevTopic.id]?.completedLessons[prevId]
          : false;
        if (!prevCompleted) return 'locked';
        return thisCompleted ? 'completed' : 'available';
      },

      addXP: (amount) =>
        set((state) => {
          const newXP = state.xp + amount;
          const newLevel = getLevelFromXP(newXP);
          const today = getTodayDateString();
          return {
            xp: newXP,
            level: newLevel,
            xpHistory: {
              ...state.xpHistory,
              [today]: (state.xpHistory[today] ?? 0) + amount,
            },
          };
        }),

      recordAnswer: ({ topicId, lessonId, correct, taskId, taskIndex, promptLevel, latencyMs, successType, sessionId, attemptNo }) =>
        set((state) => {
          // Enqueue analytics event (fire-and-forget, persisted offline)
          try {
            const { enqueue } = require('../store/analyticsQueueStore').useAnalyticsQueueStore.getState();
            const eventTs = new Date().toISOString();
            const sid = sessionId ?? 'unknown';
            const tid = taskId ?? 'unknown';
            enqueue({
              eventKey: `${sid}-${tid}-${eventTs}`,
              sessionId: sid,
              eventTs,
              lessonId,
              topicId,
              taskId: taskId ?? null,
              taskIndex: taskIndex ?? null,
              promptLevel: promptLevel ?? 0,
              isCorrect: correct,
              attemptNo: attemptNo ?? 1,
              latencyMs: latencyMs ?? null,
              successType: successType ?? null,
              methodology: 'aba',
              appVersion: '1.0.0',
            });
          } catch {
            // analytics queue not critical
          }
          const topic = state.topics[topicId] ?? {
            topicId,
            skill: 0,
            difficulty: 1,
            correctStreak: 0,
            incorrectStreak: 0,
            totalCorrect: 0,
            totalAttempts: 0,
            completedLessons: {},
          };

          let { correctStreak, incorrectStreak, difficulty, skill } = topic;

          if (correct) {
            correctStreak += 1;
            incorrectStreak = 0;
            if (correctStreak >= 3 && difficulty < 5) {
              difficulty += 1;
              correctStreak = 0;
            }
            skill = clamp(skill + 3, 0, 100);
          } else {
            incorrectStreak += 1;
            correctStreak = 0;
            if (incorrectStreak >= 2 && difficulty > 1) {
              difficulty -= 1;
              incorrectStreak = 0;
            }
            skill = clamp(skill - 2, 0, 100);
          }

          const totalAttempts = topic.totalAttempts + 1;
          const totalCorrect = topic.totalCorrect + (correct ? 1 : 0);

          const topics = {
            ...state.topics,
            [topicId]: { ...topic, correctStreak, incorrectStreak, difficulty, skill, totalAttempts, totalCorrect },
          };

          let { globalCorrectCount, achievements, streakCount, lastActivityDate } = state;
          if (correct) {
            globalCorrectCount += 1;
            if (!achievements.tenCorrectAnswers && globalCorrectCount >= 10) {
              achievements = { ...achievements, tenCorrectAnswers: true };
            }
            if (!achievements.fiftyCorrectAnswers && globalCorrectCount >= 50) {
              achievements = { ...achievements, fiftyCorrectAnswers: true };
            }
            if (!achievements.hundredCorrectAnswers && globalCorrectCount >= 100) {
              achievements = { ...achievements, hundredCorrectAnswers: true };
            }
          }

          const today = getTodayDateString();
          if (!lastActivityDate) {
            streakCount = 1;
            lastActivityDate = today;
          } else if (lastActivityDate === today) {
            // keep current streak
          } else if (isYesterday(lastActivityDate, today)) {
            streakCount += 1;
            lastActivityDate = today;
          } else {
            streakCount = 1;
            lastActivityDate = today;
          }

          if (!achievements.threeDayStreak && streakCount >= 3) {
            achievements = { ...achievements, threeDayStreak: true };
          }
          if (!achievements.sevenDayStreak && streakCount >= 7) {
            achievements = { ...achievements, sevenDayStreak: true };
          }
          if (!achievements.allWorldsStarted && checkAllWorldsStarted(topics)) {
            achievements = { ...achievements, allWorldsStarted: true };
          }

          return { topics, globalCorrectCount, achievements, streakCount, lastActivityDate };
        }),

      setDailyGoal: (goal) => set({ dailyGoal: goal }),

      resetAll: () =>
        set({
          topics: {},
          achievements: {
            firstLessonCompleted: false,
            tenCorrectAnswers: false,
            threeDayStreak: false,
            firstWorldCompleted: false,
            sevenDayStreak: false,
            fiftyCorrectAnswers: false,
            perfectLesson: false,
            islandExplorer: false,
            hundredCorrectAnswers: false,
            allWorldsStarted: false,
          },
          globalCorrectCount: 0,
          streakCount: 0,
          lastActivityDate: null,
          xp: 0,
          level: 1,
          lessonStars: {},
          dailyLessonsCompleted: 0,
          dailyGoalDate: null,
          dailyGoal: 3,
          xpHistory: {},
        }),

      markLessonCompleted: ({ topicId, lessonId, perfect, mistakeCount }) =>
        set((state) => {
          const topic = state.topics[topicId] ?? {
            topicId,
            skill: 0,
            difficulty: 1,
            correctStreak: 0,
            incorrectStreak: 0,
            totalCorrect: 0,
            totalAttempts: 0,
            completedLessons: {},
          };

          const updatedTopic: TopicProgress = {
            ...topic,
            completedLessons: { ...topic.completedLessons, [lessonId]: true },
          };

          const topics = { ...state.topics, [topicId]: updatedTopic };

          // Compute star rating: 3 = perfect, 2 = 1-2 mistakes, 1 = 3+ mistakes
          const mistakes = mistakeCount ?? (perfect === false ? 3 : 0);
          const stars: 1 | 2 | 3 = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
          // Keep highest rating if lesson was already completed better before
          const prevStars = state.lessonStars[lessonId] ?? 0;
          const newStars = Math.max(prevStars, stars) as 1 | 2 | 3;
          const lessonStars = { ...state.lessonStars, [lessonId]: newStars };

          // Daily goal tracking
          const today = getTodayDateString();
          let dailyLessonsCompleted = state.dailyLessonsCompleted;
          let dailyGoalDate = state.dailyGoalDate;
          if (dailyGoalDate === today) {
            dailyLessonsCompleted += 1;
          } else {
            dailyLessonsCompleted = 1;
            dailyGoalDate = today;
          }

          let achievements = state.achievements;
          const anyCompletedBefore = Object.values(topic.completedLessons).some(Boolean);
          if (!anyCompletedBefore && !achievements.firstLessonCompleted) {
            achievements = { ...achievements, firstLessonCompleted: true };
          }
          if (mistakes === 0 && !achievements.perfectLesson) {
            achievements = { ...achievements, perfectLesson: true };
          }
          if (!achievements.firstWorldCompleted && checkWorldCompleted(topicId, topics)) {
            achievements = { ...achievements, firstWorldCompleted: true };
          }
          if (!achievements.islandExplorer && checkAllWorldsStarted(topics)) {
            achievements = { ...achievements, islandExplorer: true };
          }

          return { topics, achievements, lessonStars, dailyLessonsCompleted, dailyGoalDate };
        }),
    }),
    {
      name: 'talentia-progress',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persistedState: unknown, currentState: ProgressState): ProgressState => {
        const persisted = (persistedState ?? {}) as Partial<ProgressState>;
        return {
          ...currentState,
          ...persisted,
          // Always ensure all achievement keys exist (handles app updates adding new achievements)
          achievements: {
            ...currentState.achievements,
            ...(persisted.achievements ?? {}),
          },
        };
      },
    },
  ),
);
