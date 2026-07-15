import { useEffect, useRef, useState } from 'react';

/** Minutes of active lesson time before nudging the child to take a break. */
const SESSION_BREAK_REMINDER_MINUTES = 20;

/**
 * Tracks how long the child has been actively working on tasks and surfaces
 * a one-off "take a break" prompt after SESSION_BREAK_REMINDER_MINUTES.
 * The timer resets whenever the reminder is dismissed.
 */
export function useBreakReminder(params: { enabled: boolean; active: boolean }) {
  const { enabled, active } = params;
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
      if (elapsed >= SESSION_BREAK_REMINDER_MINUTES) {
        setVisible(true);
        sessionStartRef.current = null;
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [enabled, active, visible]);

  const dismiss = () => {
    setVisible(false);
    sessionStartRef.current = Date.now();
  };

  return { visible, dismiss };
}
