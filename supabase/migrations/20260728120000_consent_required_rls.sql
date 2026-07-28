-- Gate child-data writes on verified parental consent (defense in depth alongside app/proxy checks).

CREATE OR REPLACE FUNCTION public.profile_has_parental_consent(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = p_user_id
      AND char_length(trim(p.child_name)) > 0
      AND p.guardian_attested = true
      AND p.parental_consent_at IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.profile_has_parental_consent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_has_parental_consent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_has_parental_consent(uuid) TO service_role;

-- user_progress
DROP POLICY IF EXISTS "progress: owner insert" ON public.user_progress;
CREATE POLICY "progress: owner insert" ON public.user_progress
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.profile_has_parental_consent(auth.uid())
  );

DROP POLICY IF EXISTS "progress: owner upsert" ON public.user_progress;
CREATE POLICY "progress: owner upsert" ON public.user_progress
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.profile_has_parental_consent(auth.uid())
  );

-- user_stats
DROP POLICY IF EXISTS "stats: owner insert" ON public.user_stats;
CREATE POLICY "stats: owner insert" ON public.user_stats
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.profile_has_parental_consent(auth.uid())
  );

DROP POLICY IF EXISTS "stats: owner update" ON public.user_stats;
CREATE POLICY "stats: owner update" ON public.user_stats
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.profile_has_parental_consent(auth.uid())
  );

-- lesson_analytics
DROP POLICY IF EXISTS "analytics: owner insert" ON public.lesson_analytics;
CREATE POLICY "analytics: owner insert" ON public.lesson_analytics
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.profile_has_parental_consent(auth.uid())
  );

DROP POLICY IF EXISTS "analytics: owner update" ON public.lesson_analytics;
CREATE POLICY "analytics: owner update" ON public.lesson_analytics
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.profile_has_parental_consent(auth.uid())
  );

-- aba_live_sessions
DROP POLICY IF EXISTS "aba_live_sessions: owner insert" ON public.aba_live_sessions;
CREATE POLICY "aba_live_sessions: owner insert" ON public.aba_live_sessions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND public.profile_has_parental_consent(auth.uid())
  );

DROP POLICY IF EXISTS "aba_live_sessions: owner update" ON public.aba_live_sessions;
CREATE POLICY "aba_live_sessions: owner update" ON public.aba_live_sessions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.profile_has_parental_consent(auth.uid())
  );
