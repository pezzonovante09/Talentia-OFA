-- Preflight before applying 20260724230000_profiles_consent_required.sql in production.
-- Run in Supabase SQL Editor. Expected after a successful backfill: 0.

-- Rows that would violate profiles_consent_when_named (named profile, missing consent):
SELECT count(*) AS named_without_consent
FROM public.profiles
WHERE char_length(trim(child_name)) > 0
  AND (guardian_attested = false OR parental_consent_at IS NULL);

-- Sample those rows (review before grandfather backfill):
SELECT user_id, child_name, guardian_attested, parental_consent_at, created_at, updated_at
FROM public.profiles
WHERE char_length(trim(child_name)) > 0
  AND (guardian_attested = false OR parental_consent_at IS NULL)
LIMIT 50;

-- After migration applied, confirm constraint exists:
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'profiles_consent_when_named';
