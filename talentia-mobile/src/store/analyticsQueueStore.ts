import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isSupabaseConfigured, supabase } from '../services/supabase';

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
  /** Append one analytics row locally (no network). */
  enqueueEvent: (event: AnalyticsEvent) => void;
  dequeue: (keys: string[]) => void;
  clearAll: () => void;
  /** Send all queued rows to Supabase in one insert, then clear sent items on success. */
  flushQueue: () => Promise<void>;
};

export const useAnalyticsQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      enqueueEvent: (event) =>
        set((state) => ({
          queue: [...state.queue, event],
        })),
      dequeue: (keys) =>
        set((state) => ({
          queue: state.queue.filter((e) => !keys.includes(e.eventKey)),
        })),
      clearAll: () => set({ queue: [] }),
      flushQueue: async () => {
        if (!isSupabaseConfigured) return;
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;

        const { queue, dequeue } = get();
        if (queue.length === 0) return;

        const rows = queue.map((e) => ({
          user_id: userId,
          session_id: e.sessionId,
          event_ts: e.eventTs,
          lesson_id: e.lessonId,
          topic_id: e.topicId,
          task_id: e.taskId,
          task_index: e.taskIndex,
          prompt_level: e.promptLevel,
          is_correct: e.isCorrect,
          attempt_no: e.attemptNo,
          latency_ms: e.latencyMs,
          success_type: e.successType,
          methodology: e.methodology,
          app_version: e.appVersion,
        }));

        const { error } = await supabase.from('lesson_analytics').insert(rows);
        if (error) {
          throw error;
        }
        dequeue(queue.map((e) => e.eventKey));
      },
    }),
    {
      name: 'talentia-analytics-queue',
      version: 1,
      migrate: (persistedState) => persistedState as Pick<QueueState, 'queue'>,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ queue: state.queue }),
    },
  ),
);
