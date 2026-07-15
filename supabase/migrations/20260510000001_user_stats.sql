CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp             integer NOT NULL DEFAULT 0,
  level          integer NOT NULL DEFAULT 1,
  streak_count   integer NOT NULL DEFAULT 0,
  last_activity  date,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stats: owner select" ON public.user_stats FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "stats: owner insert" ON public.user_stats FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "stats: owner update" ON public.user_stats FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "stats: parent select" ON public.user_stats FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.parent_child WHERE parent_id = auth.uid() AND child_id = user_stats.user_id)
);
