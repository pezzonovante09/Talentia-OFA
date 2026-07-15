import { create } from 'zustand';

type SyncStatusState = {
  /** True while at least one background sync source has an unresolved failure. */
  hasSyncErrors: boolean;
  /** source id → last error message (for diagnostics; not shown to the child). */
  errorsBySource: Record<string, string>;
  reportError: (source: string, error: unknown) => void;
  reportSuccess: (source: string) => void;
};

/**
 * Tracks background cloud-sync health across the app (progress, analytics,
 * ABA live sessions, ...). Nothing here blocks the child's local play —
 * it exists so failures are observable (e.g. a future "not synced" badge)
 * instead of vanishing into a swallowed `.catch(() => {})`.
 */
export const useSyncStatusStore = create<SyncStatusState>((set) => ({
  hasSyncErrors: false,
  errorsBySource: {},
  reportError: (source, error) =>
    set((state) => {
      const message = error instanceof Error ? error.message : String(error);
      const errorsBySource = { ...state.errorsBySource, [source]: message };
      return { errorsBySource, hasSyncErrors: true };
    }),
  reportSuccess: (source) =>
    set((state) => {
      if (!(source in state.errorsBySource)) return state;
      const errorsBySource = { ...state.errorsBySource };
      delete errorsBySource[source];
      return { errorsBySource, hasSyncErrors: Object.keys(errorsBySource).length > 0 };
    }),
}));

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn`, retrying a couple of times with backoff before giving up.
 * Replaces bare `.catch(() => {})` / `.catch(console.error)` fire-and-forget
 * sync calls: transient network blips get a real retry, and a persistent
 * failure is recorded via useSyncStatusStore instead of disappearing silently.
 * Never throws — safe to call with `void` from UI event handlers.
 */
export async function syncWithRetry(
  source: string,
  fn: () => Promise<unknown>,
  opts: { retries?: number; baseDelayMs?: number } = {},
): Promise<void> {
  const { retries = 2, baseDelayMs = 500 } = opts;
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fn();
      useSyncStatusStore.getState().reportSuccess(source);
      return;
    } catch (error) {
      if (attempt >= retries) {
        useSyncStatusStore.getState().reportError(source, error);
        if (__DEV__) {
          console.warn(`[sync:${source}] giving up after ${attempt + 1} attempt(s)`, error);
        }
        return;
      }
      await delay(baseDelayMs * 2 ** attempt);
    }
  }
}
