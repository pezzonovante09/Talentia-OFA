-- Enforce parental consent when a child profile name is present.
-- Backfill existing named profiles (created before consent columns), then CHECK.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parental_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS guardian_attested boolean NOT NULL DEFAULT false;

-- Grandfather existing named profiles so the CHECK can be applied safely.
UPDATE public.profiles
SET
  guardian_attested = true,
  parental_consent_at = COALESCE(parental_consent_at, updated_at, created_at, now())
WHERE char_length(trim(child_name)) > 0
  AND (guardian_attested = false OR parental_consent_at IS NULL);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_consent_when_named'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_consent_when_named;
  END IF;

  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_consent_when_named
    CHECK (
      char_length(trim(child_name)) = 0
      OR (
        guardian_attested = true
        AND parental_consent_at IS NOT NULL
      )
    );
END $$;
