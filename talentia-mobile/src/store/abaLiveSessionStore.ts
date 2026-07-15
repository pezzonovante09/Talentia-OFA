import { create } from 'zustand';

import { supabase } from '@/src/services/supabase';
import { syncWithRetry } from '@/src/services/syncStatus';

/**
 * Per-task progress/result updates from the child device happen frequently
 * (roughly once per task). Without throttling, each one fires an immediate
 * Supabase UPDATE, which in turn triggers a Postgres Realtime broadcast to
 * any subscribed parent screen — a burst of quick task transitions (e.g. a
 * skipped task followed instantly by the next one) can otherwise flood the
 * channel with several writes within a second or two.
 *
 * `throttledRemoteUpdate` coalesces rapid successive writes into at most one
 * every `REMOTE_UPDATE_THROTTLE_MS`, always keeping the *latest* pending
 * write (trailing-edge throttle) so the remote row still ends up reflecting
 * the most recent state.
 */
const REMOTE_UPDATE_THROTTLE_MS = 2500;
let lastRemoteWriteAt = 0;
let pendingUpdateTimer: ReturnType<typeof setTimeout> | null = null;
let pendingUpdateRun: (() => void) | null = null;

function cancelPendingRemoteUpdate() {
  if (pendingUpdateTimer) {
    clearTimeout(pendingUpdateTimer);
    pendingUpdateTimer = null;
  }
  pendingUpdateRun = null;
}

function throttledRemoteUpdate(run: () => void) {
  const now = Date.now();
  const elapsed = now - lastRemoteWriteAt;
  if (elapsed >= REMOTE_UPDATE_THROTTLE_MS) {
    cancelPendingRemoteUpdate();
    lastRemoteWriteAt = now;
    run();
    return;
  }
  pendingUpdateRun = run;
  if (!pendingUpdateTimer) {
    pendingUpdateTimer = setTimeout(() => {
      pendingUpdateTimer = null;
      lastRemoteWriteAt = Date.now();
      const fn = pendingUpdateRun;
      pendingUpdateRun = null;
      fn?.();
    }, REMOTE_UPDATE_THROTTLE_MS - elapsed);
  }
}

export type AbaSessionResult = 'correct' | 'incorrect' | 'skipped';

export type AbaSessionSummary = {
  lessonId: string;
  lessonTitleKey: string;
  tasksCompleted: number;
  tasksSkipped: number;
  mistakes: number;
  tokensEarned: number;
  endedAt: number;
};

type AbaLiveSessionState = {
  active: boolean;
  lessonId: string | null;
  lessonTitleKey: string | null;
  taskIndex: number;
  totalTasks: number;
  lastResult: AbaSessionResult | null;
  lastUpdated: number | null;
  tasksCompleted: number;
  tasksSkipped: number;
  mistakes: number;
  lastSummary: AbaSessionSummary | null;
  startSession: (lessonId: string, lessonTitleKey: string, totalTasks: number) => void;
  setTaskProgress: (taskIndex: number, totalTasks: number) => void;
  recordResult: (result: AbaSessionResult) => void;
  finishSession: (tokensEarned: number) => void;
  clearSession: () => void;
};

export const useAbaLiveSessionStore = create<AbaLiveSessionState>((set, get) => ({
  active: false,
  lessonId: null,
  lessonTitleKey: null,
  taskIndex: 0,
  totalTasks: 0,
  lastResult: null,
  lastUpdated: null,
  tasksCompleted: 0,
  tasksSkipped: 0,
  mistakes: 0,
  lastSummary: null,

  startSession: (lessonId, lessonTitleKey, totalTasks) => {
    set({
      active: true,
      lessonId,
      lessonTitleKey,
      taskIndex: 0,
      totalTasks,
      lastResult: null,
      lastUpdated: Date.now(),
      tasksCompleted: 0,
      tasksSkipped: 0,
      mistakes: 0,
      lastSummary: null,
    });
    cancelPendingRemoteUpdate();
    void syncWithRetry('abaLiveSession:startSession', async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      await supabase.from('aba_live_sessions').delete().eq('user_id', uid).eq('status', 'active');
      const st = get();
      if (!st.lessonId || !st.lessonTitleKey) return;
      const now = new Date().toISOString();
      await supabase.from('aba_live_sessions').insert({
        user_id: uid,
        lesson_id: st.lessonId,
        lesson_title_key: st.lessonTitleKey,
        status: 'active',
        task_index: st.taskIndex,
        total_tasks: st.totalTasks,
        last_result: null,
        last_updated: now,
        tasks_completed: st.tasksCompleted,
        tasks_skipped: st.tasksSkipped,
        mistakes: st.mistakes,
        tokens_earned: null,
        started_at: now,
        finished_at: null,
      });
    });
  },

  setTaskProgress: (taskIndex, totalTasks) => {
    set({
      taskIndex,
      totalTasks,
      lastUpdated: Date.now(),
    });
    throttledRemoteUpdate(() => {
      void syncWithRetry('abaLiveSession:setTaskProgress', async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) return;
        await supabase
          .from('aba_live_sessions')
          .update({
            task_index: taskIndex,
            total_tasks: totalTasks,
            last_updated: new Date().toISOString(),
          })
          .eq('user_id', uid)
          .eq('status', 'active');
      });
    });
  },

  recordResult: (result) => {
    const s = get();
    set({
      lastResult: result,
      lastUpdated: Date.now(),
      tasksCompleted: result === 'correct' ? s.tasksCompleted + 1 : s.tasksCompleted,
      tasksSkipped: result === 'skipped' ? s.tasksSkipped + 1 : s.tasksSkipped,
      mistakes: result === 'incorrect' ? s.mistakes + 1 : s.mistakes,
    });
    throttledRemoteUpdate(() => {
      void syncWithRetry('abaLiveSession:recordResult', async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) return;
        const st = get();
        await supabase
          .from('aba_live_sessions')
          .update({
            last_result: st.lastResult,
            tasks_completed: st.tasksCompleted,
            tasks_skipped: st.tasksSkipped,
            mistakes: st.mistakes,
            last_updated: new Date().toISOString(),
          })
          .eq('user_id', uid)
          .eq('status', 'active');
      });
    });
  },

  finishSession: (tokensEarned) => {
    cancelPendingRemoteUpdate();
    const s = get();
    if (!s.lessonId || !s.lessonTitleKey) {
      set({ active: false });
      void syncWithRetry('abaLiveSession:finishSession:empty', async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (!uid) return;
        const now = new Date().toISOString();
        await supabase
          .from('aba_live_sessions')
          .update({
            status: 'finished',
            finished_at: now,
            last_updated: now,
          })
          .eq('user_id', uid)
          .eq('status', 'active');
      });
      return;
    }
    const tasksCompleted = s.tasksCompleted;
    const tasksSkipped = s.tasksSkipped;
    const mistakes = s.mistakes;
    set({
      active: false,
      lastSummary: {
        lessonId: s.lessonId,
        lessonTitleKey: s.lessonTitleKey,
        tasksCompleted: s.tasksCompleted,
        tasksSkipped: s.tasksSkipped,
        mistakes: s.mistakes,
        tokensEarned,
        endedAt: Date.now(),
      },
      lastUpdated: Date.now(),
    });
    void syncWithRetry('abaLiveSession:finishSession', async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      const now = new Date().toISOString();
      await supabase
        .from('aba_live_sessions')
        .update({
          status: 'finished',
          tasks_completed: tasksCompleted,
          tasks_skipped: tasksSkipped,
          mistakes,
          tokens_earned: tokensEarned,
          finished_at: now,
          last_updated: now,
        })
        .eq('user_id', uid)
        .eq('status', 'active');
    });
  },

  clearSession: () => {
    cancelPendingRemoteUpdate();
    const wasActive = get().active;
    const clearingLessonId = get().lessonId;
    set({
      active: false,
      lessonId: null,
      lessonTitleKey: null,
      taskIndex: 0,
      totalTasks: 0,
      lastResult: null,
      lastUpdated: null,
      tasksCompleted: 0,
      tasksSkipped: 0,
      mistakes: 0,
    });
    // If finishSession already flipped active→false, skip the remote write —
    // otherwise a late clear can race finish and close the row without tokens.
    if (!wasActive) return;
    void syncWithRetry('abaLiveSession:clearSession', async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      const now = new Date().toISOString();
      // Scope by the lesson we abandoned so an in-flight clear cannot finish a
      // newer startSession row for a different lessonId.
      let q = supabase
        .from('aba_live_sessions')
        .update({
          status: 'finished',
          finished_at: now,
          last_updated: now,
        })
        .eq('user_id', uid)
        .eq('status', 'active');
      if (clearingLessonId) {
        q = q.eq('lesson_id', clearingLessonId);
      }
      await q;
    });
  },
}));
