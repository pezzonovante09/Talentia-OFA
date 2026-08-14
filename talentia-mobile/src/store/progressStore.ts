import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getTopicForLesson, worlds } from '../data/worlds';
import { syncLessonCompletion, syncUserStats } from '../services/analyticsService';
import { syncWithRetry } from '../services/syncStatus';
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

/** Format a Date as local calendar YYYY-MM-DD (matches XP / streak date keys). */
export function formatLocalDateYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** One day in the rolling 7-day parent report window (local dates). */
export type WeeklyDayStat = {
  date: string;
  lessonsCompleted: number;
  correctAnswers: number;
  xpEarned: number;
};

type ProgressState = {
  topics: Record<string, TopicProgress>;
  achievements: Achievements;
  globalCorrectCount: number;
  streakCount: number;
  lastActivityDate: string | null;
  xp: number;
  level: number;
  lessonStars: Record<string, 1 | 2 | 3>;
  /**
   * Mastery gate: minimum star rating (see markLessonCompleted) a lesson must
   * reach before the NEXT lesson unlocks. Stars are already the existing
   * proxy for "how clean was the run" shown to parents (3 = perfect, 2 = up
   * to 2 mistakes, 1 = more) — reusing that scale keeps the gate legible
   * instead of introducing an invisible second percentage. Default 2 stars
   * (≤2 mistakes across the lesson) approximates an "≥80% correct, else
   * repeat" mastery criterion without requiring new per-lesson attempt
   * tracking. Configurable per profile (e.g. a parent/therapist may want a
   * stricter 3-star gate, or 1 to effectively disable gating).
   */
  masteryMinStars: 1 | 2 | 3;
  dailyLessonsCompleted: number;
  dailyGoalDate: string | null;
  dailyGoal: number;
  /** date (YYYY-MM-DD) → XP earned on that day */
  xpHistory: Record<string, number>;
  /** date (YYYY-MM-DD) → lessons completed that day */
  lessonsCompletedByDate: Record<string, number>;
  /** date (YYYY-MM-DD) → correct task answers that day */
  correctAnswersByDate: Record<string, number>;
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
  markLessonCompleted: (params: {
    topicId: string;
    lessonId: string;
    perfect?: boolean;
    mistakeCount?: number;
    hadSkips?: boolean;
  }) => void;
  addXP: (amount: number) => void;
  setDailyGoal: (goal: number) => void;
  setMasteryMinStars: (stars: 1 | 2 | 3) => void;
  resetAll: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTodayDateString() {
  return formatLocalDateYMD(new Date());
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

/**
 * Whether a lesson was already marked completed before this call.
 * Used to guard against re-awarding XP/tokens when a child replays a finished lesson.
 */
export function isLessonAlreadyCompleted(topicId: string, lessonId: string): boolean {
  const topic = useProgressStore.getState().topics[topicId];
  return !!topic?.completedLessons[lessonId];
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
      masteryMinStars: 2,
      dailyLessonsCompleted: 0,
      dailyGoalDate: null,
      dailyGoal: 3,
      xpHistory: {},
      lessonsCompletedByDate: {},
      correctAnswersByDate: {},

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
        // Mastery gate: don't hand out a NEW unlock until the prerequisite
        // lesson was completed at/above masteryMinStars. A lesson the child
        // has already completed stays 'completed' regardless of the
        // prerequisite's current star rating — this only blocks forward
        // progress, it never re-locks finished content. Missing star data
        // (e.g. legacy saves from before stars existed) is treated as
        // passing, so existing players are never retroactively gated.
        if (!thisCompleted) {
          const prevStars = state.lessonStars[prevId];
          const prevMastered = prevStars === undefined || prevStars >= state.masteryMinStars;
          if (!prevMastered) return 'locked';
        }
        return thisCompleted ? 'completed' : 'available';
      },

      addXP: (amount) => {
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
        });
        const s = get();
        void syncWithRetry('progressStore:addXP', () =>
          syncUserStats({
            xp: s.xp,
            level: s.level,
            streakCount: s.streakCount,
            lastActivityDate: s.lastActivityDate,
          }),
        );
      },

      recordAnswer: ({ topicId, lessonId, correct, taskId, taskIndex, promptLevel, latencyMs, successType, sessionId, attemptNo }) => {
        set((state) => {
          // Enqueue analytics event (fire-and-forget, persisted offline)
          try {
            const { enqueueEvent } = require('../store/analyticsQueueStore').useAnalyticsQueueStore.getState();
            const { methodology } = require('../store/settingsStore').useSettingsStore.getState();
            const eventTs = new Date().toISOString();
            const sid = sessionId ?? 'unknown';
            const tid = taskId ?? 'unknown';
            enqueueEvent({
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
              methodology: methodology ?? 'standard',
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

          let { correctStreak, incorrectStreak, skill } = topic;

          if (correct) {
            correctStreak += 1;
            incorrectStreak = 0;
            skill = clamp(skill + 3, 0, 100);
          } else {
            incorrectStreak += 1;
            correctStreak = 0;
            skill = clamp(skill - 2, 0, 100);
          }

          const totalAttempts = topic.totalAttempts + 1;
          const totalCorrect = topic.totalCorrect + (correct ? 1 : 0);

          const topics = {
            ...state.topics,
            [topicId]: { ...topic, correctStreak, incorrectStreak, skill, totalAttempts, totalCorrect },
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

          let correctAnswersByDate = state.correctAnswersByDate;
          if (correct) {
            correctAnswersByDate = {
              ...state.correctAnswersByDate,
              [today]: (state.correctAnswersByDate[today] ?? 0) + 1,
            };
          }

          return {
            topics,
            globalCorrectCount,
            achievements,
            streakCount,
            lastActivityDate,
            correctAnswersByDate,
          };
        });
        const s = get();
        void syncWithRetry('progressStore:recordAnswer', () =>
          syncUserStats({
            xp: s.xp,
            level: s.level,
            streakCount: s.streakCount,
            lastActivityDate: s.lastActivityDate,
          }),
        );
      },

      setDailyGoal: (goal) => set({ dailyGoal: goal }),

      setMasteryMinStars: (stars) => set({ masteryMinStars: stars }),

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
          lessonsCompletedByDate: {},
          correctAnswersByDate: {},
        }),

      markLessonCompleted: ({ topicId, lessonId, perfect, mistakeCount, hadSkips }) => {
        // Hoist star computation so values are accessible after set() for cloud sync
        const mistakes = mistakeCount ?? (perfect === false ? 3 : 0);
        const perfectRun = mistakes === 0 && !hadSkips;
        const stars: 1 | 2 | 3 = perfectRun ? 3 : mistakes <= 2 ? 2 : 1;

        let newStars: 1 | 2 | 3 = stars;
        const alreadyCompleted = !!get().topics[topicId]?.completedLessons[lessonId];

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

          const wasAlreadyCompleted = !!topic.completedLessons[lessonId];

          const updatedTopic: TopicProgress = {
            ...topic,
            completedLessons: { ...topic.completedLessons, [lessonId]: true },
          };

          const topics = { ...state.topics, [topicId]: updatedTopic };

          // Keep highest rating if lesson was already completed better before
          const prevStars = state.lessonStars[lessonId] ?? 0;
          newStars = Math.max(prevStars, stars) as 1 | 2 | 3;
          const lessonStars = { ...state.lessonStars, [lessonId]: newStars };

          // Daily / weekly lesson counters only move on first completion — replaying
          // a finished lesson must not farm the map daily goal or parent weekly stats.
          const today = getTodayDateString();
          let dailyLessonsCompleted = state.dailyLessonsCompleted;
          let dailyGoalDate = state.dailyGoalDate;
          let lessonsCompletedByDate = state.lessonsCompletedByDate;
          if (!wasAlreadyCompleted) {
            if (dailyGoalDate === today) {
              dailyLessonsCompleted += 1;
            } else {
              dailyLessonsCompleted = 1;
              dailyGoalDate = today;
            }
            lessonsCompletedByDate = {
              ...state.lessonsCompletedByDate,
              [today]: (state.lessonsCompletedByDate[today] ?? 0) + 1,
            };
          }

          let achievements = state.achievements;
          const anyCompletedBefore = Object.values(topic.completedLessons).some(Boolean);
          if (!anyCompletedBefore && !achievements.firstLessonCompleted) {
            achievements = { ...achievements, firstLessonCompleted: true };
          }
          // Perfect-run achievement only on first completion (blocks resume/skip bypass farming).
          if (!wasAlreadyCompleted && perfectRun && !achievements.perfectLesson) {
            achievements = { ...achievements, perfectLesson: true };
          }
          if (!achievements.firstWorldCompleted && checkWorldCompleted(topicId, topics)) {
            achievements = { ...achievements, firstWorldCompleted: true };
          }
          if (!achievements.islandExplorer && checkAllWorldsStarted(topics)) {
            achievements = { ...achievements, islandExplorer: true };
          }

          return {
            topics,
            achievements,
            lessonStars,
            dailyLessonsCompleted,
            dailyGoalDate,
            lessonsCompletedByDate,
          };
        });

        void syncWithRetry('progressStore:flushAnalyticsQueue', () =>
          require('../store/analyticsQueueStore').useAnalyticsQueueStore.getState().flushQueue(),
        );

        void syncWithRetry('progressStore:syncLessonCompletion', () =>
          syncLessonCompletion({
            lessonId,
            topicId,
            stars: newStars,
            mistakeCount: mistakes,
            isFirstCompletion: !alreadyCompleted,
          }),
        );
      },
    }),
    {
      name: 'talentia-progress',
      version: 1,
      migrate: (persistedState) => persistedState as Partial<ProgressState>,
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

/** Last 7 local calendar days from today − 6 through today; numeric fields are 0 when missing. */
export function getWeeklyStats(): WeeklyDayStat[] {
  const { xpHistory, lessonsCompletedByDate, correctAnswersByDate } = useProgressStore.getState();
  const out: WeeklyDayStat[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    const date = formatLocalDateYMD(d);
    out.push({
      date,
      lessonsCompleted: lessonsCompletedByDate[date] ?? 0,
      correctAnswers: correctAnswersByDate[date] ?? 0,
      xpEarned: xpHistory[date] ?? 0,
    });
  }
  return out;
}
