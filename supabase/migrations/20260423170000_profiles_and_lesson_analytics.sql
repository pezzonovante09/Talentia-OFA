-- Base tables that the later RLS migration (20260423180000) assumes already
-- exist. Previously only ALTER TABLE + CREATE POLICY were tracked, so a fresh
-- `supabase db reset` / migrate from empty would fail (or leave tables created
-- ad-hoc in the dashboard without reproducible schema).
-- Idempotent: safe to apply on projects that already have these tables.

CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  child_name   text NOT NULL DEFAULT '',
  age_band     text NOT NULL DEFAULT '5-6',
  language     text NOT NULL DEFAULT 'ru',
  avatar_id    text NOT NULL DEFAULT 'sun',
  child_mode   text NOT NULL DEFAULT 'standard'
                 CHECK (child_mode IN ('standard', 'special')),
  methodology  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- Event stream flushed from analyticsQueueStore (ABA/task telemetry).
CREATE TABLE IF NOT EXISTS public.lesson_analytics (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    text,
  event_ts      timestamptz NOT NULL DEFAULT now(),
  lesson_id     text,
  topic_id      text,
  task_id       text,
  task_index    integer,
  prompt_level  integer,
  is_correct    boolean,
  attempt_no    integer,
  latency_ms    integer,
  success_type  text,
  methodology   text,
  app_version   text
);

CREATE INDEX IF NOT EXISTS idx_lesson_analytics_user_id ON public.lesson_analytics (user_id);
