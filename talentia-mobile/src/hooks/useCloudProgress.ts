import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { useSyncStatusStore } from '../services/syncStatus';

export type CloudProgress = {
  totalLessonsCompleted: number;
  totalStars: number;
  xp: number;
  level: number;
  streakCount: number;
  lastActivity: string | null;
  lessonsByTopic: Record<string, number>; // topicId → completed count
};

export function useCloudProgress(userId: string | undefined): {
  data: CloudProgress | null;
  loading: boolean;
  /** True if the last fetch attempt failed — data (if any) may be stale. */
  error: boolean;
} {
  const [data, setData] = useState<CloudProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    let cancelled = false;
    setLoading(true);
    setError(false);

    void (async () => {
      try {
        const [progressRes, statsRes] = await Promise.all([
          supabase
            .from('user_progress')
            .select('lesson_id, topic_id, stars')
            .eq('user_id', userId),
          supabase
            .from('user_stats')
            .select('xp, level, streak_count, last_activity')
            .eq('user_id', userId)
            .maybeSingle(),
        ]);
        if (progressRes.error) throw progressRes.error;
        if (statsRes.error) throw statsRes.error;

        const rows = progressRes.data ?? [];
        const stats = statsRes.data;

        const lessonsByTopic: Record<string, number> = {};
        let totalStars = 0;
        for (const row of rows) {
          lessonsByTopic[row.topic_id] = (lessonsByTopic[row.topic_id] ?? 0) + 1;
          totalStars += row.stars ?? 0;
        }

        if (cancelled) return;
        setData({
          totalLessonsCompleted: rows.length,
          totalStars,
          xp: stats?.xp ?? 0,
          level: stats?.level ?? 1,
          streakCount: stats?.streak_count ?? 0,
          lastActivity: stats?.last_activity ?? null,
          lessonsByTopic,
        });
        useSyncStatusStore.getState().reportSuccess('useCloudProgress');
      } catch (err) {
        if (cancelled) return;
        setError(true);
        useSyncStatusStore.getState().reportError('useCloudProgress', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { data, loading, error };
}
