-- aba_live_sessions: real-time ABA session state consumed by the parent dashboard
-- (talentia-mobile/src/store/abaLiveSessionStore.ts, app/parent-report.tsx).
-- This table existed only in the deployed Supabase project without a tracked
-- migration or RLS policies; this migration makes the schema reproducible and
-- closes the gap where the table could otherwise be readable/writable by any
-- authenticated user.
CREATE TABLE IF NOT EXISTS public.aba_live_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id        text NOT NULL,
  lesson_title_key text NOT NULL,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  task_index       integer NOT NULL DEFAULT 0,
  total_tasks      integer NOT NULL DEFAULT 0,
  last_result      text CHECK (last_result IN ('correct', 'incorrect', 'skipped')),
  last_updated     timestamptz NOT NULL DEFAULT now(),
  tasks_completed  integer NOT NULL DEFAULT 0,
  tasks_skipped    integer NOT NULL DEFAULT 0,
  mistakes         integer NOT NULL DEFAULT 0,
  tokens_earned    integer,
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz
);

ALTER TABLE public.aba_live_sessions ENABLE ROW LEVEL SECURITY;

-- Owner (the child's device) can fully manage its own live-session rows.
CREATE POLICY "aba_live_sessions: owner select" ON public.aba_live_sessions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "aba_live_sessions: owner insert" ON public.aba_live_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "aba_live_sessions: owner update" ON public.aba_live_sessions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "aba_live_sessions: owner delete" ON public.aba_live_sessions
  FOR DELETE USING (user_id = auth.uid());

-- Parents can watch (read-only) their linked child's live session.
CREATE POLICY "aba_live_sessions: parent select" ON public.aba_live_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.parent_child
      WHERE parent_id = auth.uid() AND child_id = aba_live_sessions.user_id
    )
  );

-- Realtime subscriptions in parent-report.tsx filter by user_id; the mobile
-- client also queries/updates the single active row per user very frequently.
CREATE INDEX IF NOT EXISTS idx_aba_live_sessions_user_status
  ON public.aba_live_sessions (user_id, status);

-- The parent dashboard subscribes via supabase.channel(...).on('postgres_changes', ...),
-- which requires the table to be part of the `supabase_realtime` publication.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'aba_live_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.aba_live_sessions;
  END IF;
END $$;
