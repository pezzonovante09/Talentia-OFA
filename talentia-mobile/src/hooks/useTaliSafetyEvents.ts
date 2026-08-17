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

/** Mirrors the server-side burst thresholds in talentia-ai-proxy-next/src/lib/taliSafetyLog.ts. */
export const SAFETY_BURST_THRESHOLD = 3;
export const SAFETY_BURST_WINDOW_MINUTES = 10;

/**
 * True when the same category has hit the burst threshold within the recent window, computed
 * from events already fetched by useTaliSafetyEvents (no extra query) — a real-time echo of the
 * same signal the server sends to Sentry, so the parent doesn't have to wait to notice it here.
 */
export function hasRecentSafetyBurst(
  events: TaliSafetyEvent[],
  thresholdCount: number = SAFETY_BURST_THRESHOLD,
  windowMinutes: number = SAFETY_BURST_WINDOW_MINUTES,
): boolean {
  const windowStart = Date.now() - windowMinutes * 60_000;
  const countsByCategory = new Map<string, number>();
  for (const event of events) {
    if (new Date(event.createdAt).getTime() < windowStart) continue;
    countsByCategory.set(event.category, (countsByCategory.get(event.category) ?? 0) + 1);
  }
  return [...countsByCategory.values()].some((count) => count >= thresholdCount);
}
