import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TaliSafetyCategory } from "@/lib/taliSafety";
import { captureException } from "@/lib/sentry";

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
    }
  } catch (e) {
    captureException(e, { context: "logTaliSafetyEvent", userId: event.userId, side: event.side });
  }
}
