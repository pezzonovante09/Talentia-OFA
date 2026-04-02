/**
 * Logs warnings in development when required env vars are missing.
 * Does not block the app — useful for onboarding new developers.
 */
export function checkEnvInDev(): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;

  const missing: string[] = [];
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL === 'https://placeholder.supabase.co') {
    missing.push('EXPO_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY === 'placeholder-anon-key') {
    missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (!process.env.EXPO_PUBLIC_BACKEND_URL) {
    missing.push('EXPO_PUBLIC_BACKEND_URL (optional for Tali AI)');
  }

  if (missing.length > 0) {
    console.warn(
      '[Talentia] Missing or placeholder env vars. Copy .env.example to .env and fill values:',
      missing.join(', '),
    );
  }
}
