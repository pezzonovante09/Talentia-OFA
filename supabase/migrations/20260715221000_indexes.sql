-- Indexes for foreign-key / filter columns that had none, found during the
-- production-readiness audit. Without these, lookups by lesson/world/user
-- degrade to sequential scans as tasks/lessons/analytics grow.

-- tasks.lesson_id / lessons.world_id: contentService.ts fetches tasks "in"
-- a set of lesson ids, and lessons "in" a set of world ids.
CREATE INDEX IF NOT EXISTS idx_tasks_lesson_id ON public.tasks (lesson_id);
CREATE INDEX IF NOT EXISTS idx_lessons_world_id ON public.lessons (world_id);

-- lesson_analytics: analyticsService flushes batches filtered/ordered by
-- user_id and event_ts; parent dashboard reads by user_id.
CREATE INDEX IF NOT EXISTS idx_lesson_analytics_user_id_event_ts
  ON public.lesson_analytics (user_id, event_ts);

-- parent_child.child_id: every RLS "parent select" policy on profiles,
-- user_progress, user_stats, lesson_analytics and aba_live_sessions runs
-- `EXISTS (... WHERE parent_id = auth.uid() AND child_id = <row>.user_id)`,
-- which needs an index on child_id (the primary key already covers
-- parent_id as its leading column, but not child_id on its own).
CREATE INDEX IF NOT EXISTS idx_parent_child_child_id ON public.parent_child (child_id);
