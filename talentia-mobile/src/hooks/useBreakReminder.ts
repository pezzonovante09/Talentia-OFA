import { useEffect, useRef, useState } from 'react';

/** Fallback minutes of active lesson time before nudging for a break, when no age band is known. */
const DEFAULT_BREAK_REMINDER_MINUTES = 20;

export type AgeBand = '5-6' | '7' | '8' | '9-10';

/**
 * Age-appropriate default for how long a child works before a break nudge.
 * Younger children have shorter sustained attention spans, so the session
 * before prompting a break should be shorter, not a single 20-minute value
 * for every age. Values are a reasonable default, not a clinical
 * prescription - callers may override via `thresholdMinutes`.
 */
export function defaultBreakReminderMinutesForAgeBand(ageBand: AgeBand | string | undefined | null): number {
  switch (ageBand) {
    case '5-6':
      return 8;
    case '7':
      return 12;
    case '8':
      return 16;
    case '9-10':
      return DEFAULT_BREAK_REMINDER_MINUTES;
    default:
      return DEFAULT_BREAK_REMINDER_MINUTES;
  }
}

/**
 * Tracks how long the child has been actively working on tasks and surfaces
 * a one-off "take a break" prompt after `thresholdMinutes` (defaults to
 * DEFAULT_BREAK_REMINDER_MINUTES if not given). The timer resets whenever
 * the reminder is dismissed.
 */
export function useBreakReminder(params: { enabled: boolean; active: boolean; thresholdMinutes?: number }) {
  const { enabled, active, thresholdMinutes = DEFAULT_BREAK_REMINDER_MINUTES } = params;
  const [visible, setVisible] = useState(false);
  const sessionStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !active) return;
    if (sessionStartRef.current === null) {
      sessionStartRef.current = Date.now();
    }
    const interval = setInterval(() => {
      const start = sessionStartRef.current;
      if (!start || visible) return;
      const elapsed = (Date.now() - start) / (60 * 1000);
      if (elapsed >= thresholdMinutes) {
        setVisible(true);
        sessionStartRef.current = null;
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [enabled, active, visible, thresholdMinutes]);

  const dismiss = () => {
    setVisible(false);
    sessionStartRef.current = Date.now();
  };

  return { visible, dismiss };
}
