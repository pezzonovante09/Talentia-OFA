-- Parental consent + guardian attestation for Families / COPPA readiness.
-- Also tighten age_band and child_name length at the DB layer.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parental_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS guardian_attested boolean NOT NULL DEFAULT false;

-- Soft constraints (existing rows keep defaults; new writes should set consent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_age_band_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_age_band_check
      CHECK (age_band IN ('5-6', '7', '8', '9-10'));
  END IF;
EXCEPTION
  WHEN check_violation THEN
    -- Existing bad data: skip constraint; ops must clean before re-applying.
    RAISE NOTICE 'profiles_age_band_check skipped due to existing rows';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_child_name_len'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_child_name_len
      CHECK (char_length(child_name) <= 80);
  END IF;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'profiles_child_name_len skipped due to existing rows';
END $$;
