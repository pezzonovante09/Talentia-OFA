import { useEffect, useState } from 'react';

/** Minimum ms between re-renders, regardless of `speed` — caps to ~25fps. */
const MIN_TICK_MS = 40;

/**
 * Reveals `text` progressively at `speed` ms per character.
 * Batches multiple characters per state update so the total typing
 * duration matches `text.length * speed` without triggering a
 * re-render on every single character (which is wasteful for fast speeds).
 */
export function useTypingText(text: string, speed = 22): { displayed: string; done: boolean } {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed('');
    setDone(false);
    if (!text) { setDone(true); return; }

    const tickMs = Math.max(speed, MIN_TICK_MS);
    const charsPerTick = Math.max(1, Math.round(tickMs / speed));

    let i = 0;
    const interval = setInterval(() => {
      i = Math.min(i + charsPerTick, text.length);
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { setDone(true); clearInterval(interval); }
    }, tickMs);
    return () => clearInterval(interval);
  }, [text, speed]);
  return { displayed, done };
}
