-- tali_safety_events: audit log of Tali input/output safety-filter hits.
-- Previously a blocked/flagged message left zero durable record anywhere —
-- only a console.warn on the proxy server, invisible to any parent or ABA
-- specialist. This table lets a parent see that their child triggered a
-- safety filter (e.g. self_harm, adult_contact, repeated jailbreak
-- attempts) without storing the raw message text, which would be a bigger
-- privacy footprint than needed for this purpose.
CREATE TABLE IF NOT EXISTS public.tali_safety_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  side       text NOT NULL CHECK (side IN ('input', 'output')),
  category   text NOT NULL,
  mode       text,
  language   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tali_safety_events ENABLE ROW LEVEL SECURITY;

-- Read-only at the RLS layer for everyone: only the proxy's service-role
-- client (talentia-ai-proxy-next/src/lib/supabaseAdmin.ts, which bypasses
-- RLS) ever writes here. No INSERT/UPDATE/DELETE policy is granted to
-- `authenticated` on purpose — a child or parent account must not be able
-- to forge or erase its own safety log.
CREATE POLICY "tali_safety_events: owner select" ON public.tali_safety_events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tali_safety_events: parent select" ON public.tali_safety_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.parent_child
      WHERE parent_id = auth.uid() AND child_id = tali_safety_events.user_id
    )
  );

CREATE INDEX IF NOT EXISTS idx_tali_safety_events_user_created
  ON public.tali_safety_events (user_id, created_at DESC);
