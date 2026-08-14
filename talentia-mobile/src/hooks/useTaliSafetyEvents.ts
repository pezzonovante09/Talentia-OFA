import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';

export type TaliSafetyEvent = {
  id: string;
  side: 'input' | 'output';
  category: string;
  mode: string | null;
  language: string | null;
  createdAt: string;
};

/**
 * Reads the child's own tali_safety_events rows (owner-select RLS policy —
 * the app is single-account-per-child, so a parent reviews via the child's
 * own authenticated session, gated by the parent PIN screen). Never fetches
 * or displays raw chat text — only category/side/timestamp, matching what
 * logTaliSafetyEvent persists server-side.
 */
export function useTaliSafetyEvents(userId: string | undefined): {
  data: TaliSafetyEvent[];
  loading: boolean;
  error: boolean;
} {
  const [data, setData] = useState<TaliSafetyEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    let cancelled = false;
    setLoading(true);
    setError(false);

    void (async () => {
      try {
        const { data: rows, error: fetchError } = await supabase
          .from('tali_safety_events')
          .select('id, side, category, mode, language, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (fetchError) throw fetchError;
        if (cancelled) return;
        setData(
          (rows ?? []).map((row) => ({
            id: String(row.id),
            side: row.side === 'output' ? 'output' : 'input',
            category: String(row.category ?? 'unknown'),
            mode: row.mode != null ? String(row.mode) : null,
            language: row.language != null ? String(row.language) : null,
            createdAt: String(row.created_at),
          })),
        );
      } catch {
        if (cancelled) return;
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { data, loading, error };
}
