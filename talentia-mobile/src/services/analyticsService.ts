import { isSupabaseConfigured, supabase } from '../services/supabase';
import { useAnalyticsQueueStore } from '../store/analyticsQueueStore';

/**
 * Flush all queued analytics events to Supabase.
 * Called on lesson screen mount and after each answer when online.
 * Safe to call even when offline — Supabase insert will simply fail,
 * and events remain in the queue for the next flush attempt.
 */
export async function flushAnalyticsQueue(_userId: string): Promise<void> {
  await useAnalyticsQueueStore.getState().flushQueue();
}

/**
 * Upsert a lesson completion record into user_progress.
 * On replay: only update when stars improve (or stay equal with fewer/equal mistakes);
 * never overwrite a better prior `mistake_count` or refresh `completed_at` on a worse run.
 */
export async function syncLessonCompletion({
  lessonId,
  topicId,
  stars,
  mistakeCount,
  isFirstCompletion = true,
}: {
  lessonId: string;
  topicId: string;
  stars: 1 | 2 | 3;
  mistakeCount: number;
  isFirstCompletion?: boolean;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return;

  if (!isFirstCompletion) {
    const { data: existing, error: selectError } = await supabase
      .from('user_progress')
      .select('stars, mistake_count, completed_at')
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .maybeSingle();
    if (selectError) throw selectError;

    if (existing) {
      const prevStars = typeof existing.stars === 'number' ? existing.stars : 0;
      const prevMistakes =
        typeof existing.mistake_count === 'number' ? existing.mistake_count : Number.POSITIVE_INFINITY;
      // Skip cloud write when this replay is strictly worse (fewer stars, or same stars with more mistakes).
      if (stars < prevStars || (stars === prevStars && mistakeCount > prevMistakes)) {
        return;
      }
      const { error } = await supabase
        .from('user_progress')
        .update({
          stars,
          mistake_count: Math.min(prevMistakes, mistakeCount),
          topic_id: topicId,
          // Keep original completed_at on replay; only bump stars/mistakes when improved.
          completed_at: existing.completed_at ?? new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('lesson_id', lessonId);
      if (error) throw error;
      return;
    }
  }

  const { error } = await supabase.from('user_progress').upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      topic_id: topicId,
      stars,
      mistake_count: mistakeCount,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,lesson_id' },
  );
  if (error) throw error;
}

export async function syncUserStats({
  xp,
  level,
  streakCount,
  lastActivityDate,
}: {
  xp: number;
  level: number;
  streakCount: number;
  lastActivityDate: string | null;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return;

  const { error } = await supabase.from('user_stats').upsert(
    {
      user_id: userId,
      xp,
      level,
      streak_count: streakCount,
      last_activity: lastActivityDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}
