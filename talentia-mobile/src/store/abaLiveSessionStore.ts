import { create } from 'zustand';

import { supabase } from '@/src/services/supabase';

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
    void (async () => {
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
    })().catch(console.error);
  },

  setTaskProgress: (taskIndex, totalTasks) => {
    set({
      taskIndex,
      totalTasks,
      lastUpdated: Date.now(),
    });
    void (async () => {
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
    })().catch(console.error);
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
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      const st = get();
      await supabase
        .from('aba_live_sessions')
        .update({
          last_result: result,
          tasks_completed: st.tasksCompleted,
          tasks_skipped: st.tasksSkipped,
          mistakes: st.mistakes,
          last_updated: new Date().toISOString(),
        })
        .eq('user_id', uid)
        .eq('status', 'active');
    })().catch(console.error);
  },

  finishSession: (tokensEarned) => {
    const s = get();
    if (!s.lessonId || !s.lessonTitleKey) {
      set({ active: false });
      void (async () => {
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
      })().catch(console.error);
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
    void (async () => {
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
    })().catch(console.error);
  },

  clearSession: () => {
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
    void (async () => {
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
    })().catch(console.error);
  },
}));
