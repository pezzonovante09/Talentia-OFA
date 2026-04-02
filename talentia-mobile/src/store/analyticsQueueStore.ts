import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AnalyticsEvent = {
  /** Unique key for deduplication: sessionId + taskId + eventTs */
  eventKey: string;
  sessionId: string;
  eventTs: string;
  lessonId: string;
  topicId: string;
  taskId: string | null;
  taskIndex: number | null;
  promptLevel: 0 | 1 | 2;
  isCorrect: boolean;
  attemptNo: number;
  latencyMs: number | null;
  successType: 'pure' | 'assisted' | null;
  methodology: string;
  appVersion: string;
};

type QueueState = {
  queue: AnalyticsEvent[];
  enqueue: (event: AnalyticsEvent) => void;
  dequeue: (keys: string[]) => void;
  clearAll: () => void;
};

export const useAnalyticsQueueStore = create<QueueState>()(
  persist(
    (set) => ({
      queue: [],
      enqueue: (event) =>
        set((state) => ({
          queue: [...state.queue, event],
        })),
      dequeue: (keys) =>
        set((state) => ({
          queue: state.queue.filter((e) => !keys.includes(e.eventKey)),
        })),
      clearAll: () => set({ queue: [] }),
    }),
    {
      name: 'talentia-analytics-queue',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ queue: state.queue }),
    },
  ),
);
