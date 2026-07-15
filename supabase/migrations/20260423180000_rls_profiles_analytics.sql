-- Таблица parent_child (если не существует)
CREATE TABLE IF NOT EXISTS public.parent_child (
  parent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (parent_id, child_id)
);
ALTER TABLE public.parent_child ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parent sees own links"
  ON public.parent_child FOR SELECT
  USING (parent_id = auth.uid());

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles: owner select"   ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "profiles: owner insert"   ON public.profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles: owner update"   ON public.profiles FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles: parent select"  ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.parent_child WHERE parent_id = auth.uid() AND child_id = profiles.user_id)
);

-- lesson_analytics
ALTER TABLE public.lesson_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics: owner select"  ON public.lesson_analytics FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "analytics: owner insert"  ON public.lesson_analytics FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "analytics: owner update"  ON public.lesson_analytics FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "analytics: parent select" ON public.lesson_analytics FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.parent_child WHERE parent_id = auth.uid() AND child_id = lesson_analytics.user_id)
);
