import { supabase, isSupabaseConfigured } from './supabase';
import { useAnalyticsQueueStore } from '../store/analyticsQueueStore';

/**
 * Flush all queued analytics events to Supabase.
 * Called on lesson screen mount and after each answer when online.
 * Safe to call even when offline — Supabase insert will simply fail,
 * and events remain in the queue for the next flush attempt.
 */
export async function flushAnalyticsQueue(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !userId) return;

  const { queue, dequeue } = useAnalyticsQueueStore.getState();
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

  if (!error) {
    dequeue(queue.map((e) => e.eventKey));
  }
}
