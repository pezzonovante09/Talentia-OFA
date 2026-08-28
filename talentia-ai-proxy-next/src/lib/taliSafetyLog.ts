import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TaliSafetyCategory } from "@/lib/taliSafety";
import { captureException } from "@/lib/sentry";

/** Same-category hits within this window that trigger a burst alert. */
export const SAFETY_BURST_THRESHOLD = 3;
export const SAFETY_BURST_WINDOW_MINUTES = 10;

/**
 * Persist a Tali safety-filter hit so a parent/specialist can review it later
 * (see tali_safety_events migration). Never stores the raw message text —
 * category + timestamp is enough for oversight without expanding what we
 * retain about a child's chat content.
 *
 * Best-effort: a logging failure must never break the chat response the
 * child is waiting on, so this always resolves and only console.errors.
 */
export async function logTaliSafetyEvent(event: {
  userId: string;
  side: "input" | "output";
  category?: TaliSafetyCategory | string;
  mode?: string;
  language?: string;
}): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const { error } = await supabaseAdmin.from("tali_safety_events").insert({
      user_id: event.userId,
      side: event.side,
      category: event.category ?? "unknown",
      mode: event.mode ?? null,
      language: event.language ?? null,
    });
    if (error) {
      // A broken safety-events table (migration drift, RLS misconfig) would
      // otherwise fail silently forever — this is the parent/specialist
      // oversight mechanism the whole feature exists for, so alert on it.
      captureException(new Error(`safety_event_log_failed: ${error.message}`), {
        userId: event.userId,
        side: event.side,
      });
      return;
    }
    await checkSafetyEventBurst(event.userId, event.category ?? "unknown");
  } catch (e) {
    captureException(e, { context: "logTaliSafetyEvent", userId: event.userId, side: event.side });
  }
}

/**
 * Passive logging alone means a burst of blocks (repeated jailbreak/bypass
 * attempts) sits unread until a parent happens to open the log screen. This
 * turns "N hits of the same category within M minutes" into an active
 * Sentry alert instead.
 *
 * Fires on every hit once the count reaches the threshold (not just the one
 * where it first crosses it) — an earlier version used `count === THRESHOLD`
 * to fire "only once", but under concurrent requests two inserts can land
 * before either count-query runs, so the count observed can jump straight
 * from below-threshold to above it (e.g. 2 -> 4), skipping the exact value
 * and silently never alerting for that burst at all. `>=` closes that gap.
 * This relies on Sentry grouping repeat calls with the same error message
 * (same category, no count in the message text) into one Issue rather than
 * paging on every event — a real alert-spam concern would be a Sentry
 * alert-rule tuning problem, not something to solve by racily under-firing.
 *
 * Best-effort and silent on its own failure: the primary write above already
 * alerts if the table itself is broken, so a failure here (e.g. a transient
 * count-query error) shouldn't also page anyone.
 */
async function checkSafetyEventBurst(userId: string, category: string): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const windowStart = new Date(Date.now() - SAFETY_BURST_WINDOW_MINUTES * 60_000).toISOString();
    const { count, error } = await supabaseAdmin
      .from("tali_safety_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("category", category)
      .gte("created_at", windowStart);
    if (error || count == null) return;
    if (count >= SAFETY_BURST_THRESHOLD) {
      captureException(
        new Error(
          `tali_safety_burst: ${SAFETY_BURST_THRESHOLD}+ "${category}" hits in ${SAFETY_BURST_WINDOW_MINUTES}m`,
        ),
        { userId, category, count },
      );
    }
  } catch {
    // best-effort — see doc comment above.
  }
}
