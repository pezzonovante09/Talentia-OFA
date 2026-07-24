import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env */
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

/** True only when real Supabase env vars are set (not placeholder). Enables demo/local auth when false. */
export const isSupabaseConfigured =
  !!process.env.EXPO_PUBLIC_SUPABASE_URL &&
  !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.EXPO_PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export type ChildProfileRow = {
  id?: string;
  user_id: string;
  child_name: string;
  age_band: string;
  language: string;
  avatar_id: string;
  child_mode: 'standard' | 'special';
  methodology: string | null;
  parental_consent_at?: string | null;
  guardian_attested?: boolean;
  created_at?: string;
  updated_at?: string;
};
