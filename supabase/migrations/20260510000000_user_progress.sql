CREATE TABLE IF NOT EXISTS public.user_progress (
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id      text NOT NULL,
  topic_id       text NOT NULL,
  stars          smallint NOT NULL CHECK (stars BETWEEN 1 AND 3),
  mistake_count  integer NOT NULL DEFAULT 0,
  completed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress: owner select" ON public.user_progress FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "progress: owner insert" ON public.user_progress FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "progress: owner upsert" ON public.user_progress FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "progress: parent select" ON public.user_progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.parent_child WHERE parent_id = auth.uid() AND child_id = user_progress.user_id)
);
