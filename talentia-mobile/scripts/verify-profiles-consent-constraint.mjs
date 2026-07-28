/**
 * Verifies DB CHECK profiles_consent_when_named rejects named profiles without consent.
 *
 * Prerequisites: migration 20260724230000 applied.
 * Env (talentia-mobile/.env):
 *   SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 *   npm run verify:consent-constraint
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const url = process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey) {
  console.error(
    'Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in talentia-mobile/.env',
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const email = `consent-verify-${Date.now()}@example.com`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: `TmpConsentVerify-Aa1-${Date.now()}`,
  });
  if (createErr || !created.user) {
    throw new Error(`createUser failed: ${createErr?.message}`);
  }
  const userId = created.user.id;

  try {
    const { error } = await admin.from('profiles').insert({
      user_id: userId,
      child_name: 'ConsentTestChild',
      age_band: '5-6',
      language: 'ru',
      avatar_id: 'sun',
      child_mode: 'standard',
      methodology: null,
      guardian_attested: false,
      parental_consent_at: null,
    });

    if (!error) {
      console.error('FAIL: insert without consent succeeded (constraint missing or not applied)');
      process.exitCode = 1;
      return;
    }

    const msg = `${error.message} ${error.code ?? ''} ${error.details ?? ''} ${error.hint ?? ''}`;
    const looksLikeCheck =
      /profiles_consent_when_named|check constraint|23514|violates check/i.test(msg);

    if (!looksLikeCheck) {
      console.error('FAIL: insert failed, but not with expected check constraint:', error);
      process.exitCode = 1;
      return;
    }

    console.log('OK: named profile without consent rejected by DB');
    console.log('  ', error.message);
  } finally {
    await admin.from('profiles').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
