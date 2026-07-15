-- Curriculum content (worlds / lessons / tasks). JSONB holds type-specific fields.
CREATE TABLE public.worlds (
  id text PRIMARY KEY,
  subject text NOT NULL,
  order_index integer NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.lessons (
  id text PRIMARY KEY,
  world_id text NOT NULL REFERENCES public.worlds (id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.tasks (
  id text PRIMARY KEY,
  lesson_id text NOT NULL REFERENCES public.lessons (id) ON DELETE CASCADE,
  task_type text NOT NULL,
  data jsonb NOT NULL,
  aba_only boolean DEFAULT false,
  order_index integer NOT NULL
);

ALTER TABLE public.worlds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "worlds: public read" ON public.worlds FOR SELECT USING (true);
CREATE POLICY "lessons: public read" ON public.lessons FOR SELECT USING (true);
CREATE POLICY "tasks: public read" ON public.tasks FOR SELECT USING (true);
