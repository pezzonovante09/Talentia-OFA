/**
 * Часы экранов ABA (этап 11). Тайминги пробы — окна ответа, подсказки, плашка, доступ — данные процедуры, а не
 * анимация: их тесты должны идти без реального ожидания и без поддельных таймеров Jest (они вешают `render`).
 * Поэтому время приходит через порт: в приложении — `Date.now` и `setTimeout`, в тестах — `manualClock`, который
 * двигают `advance(ms)`.
 *
 * Модели экрана (`model/*`) чистые и сами времени не берут: им передают `now`, а срок следующего события они
 * отдают как число (`dueAt`). Сработавший срок пишется **значением срока**, а не моментом, когда таймер JS
 * действительно проснулся (он плывёт и глушится в фоне); касания пишутся реальным `now()`.
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

export type AbaClock = {
  now(): number;
  /** Вызвать `fn` в момент `atMs` (абсолютное время часов); вернуть отмену. */
  at(atMs: number, fn: () => void): () => void;
};

export const realClock: AbaClock = {
  now: () => Date.now(),
  at(atMs, fn) {
    const id = setTimeout(fn, Math.max(0, atMs - Date.now()));
    return () => clearTimeout(id);
  },
};

export type ManualClock = AbaClock & {
  /** Сдвинуть время и вызвать всё, чей срок наступил, по порядку срока. */
  advance(ms: number): void;
  /** Сколько отложенных вызовов ждёт. */
  pending(): number;
};

export function manualClock(startMs = Date.UTC(2026, 9, 27, 8)): ManualClock {
  let t = startMs;
  let seq = 0;
  let queue: { at: number; seq: number; fn: () => void }[] = [];
  return {
    now: () => t,
    at(atMs, fn) {
      const item = { at: atMs, seq: (seq += 1), fn };
      queue.push(item);
      return () => {
        queue = queue.filter((q) => q !== item);
      };
    },
    advance(ms) {
      const until = t + ms;
      for (;;) {
        const due = queue.filter((q) => q.at <= until).sort((a, b) => a.at - b.at || a.seq - b.seq)[0];
        if (!due) break;
        queue = queue.filter((q) => q !== due);
        t = Math.max(t, due.at);
        due.fn();
      }
      t = until;
    },
    pending: () => queue.length,
  };
}

const ClockContext = createContext<AbaClock>(realClock);

export function AbaClockProvider({ clock, children }: { clock: AbaClock; children: ReactNode }) {
  return <ClockContext.Provider value={clock}>{children}</ClockContext.Provider>;
}

export const useAbaClock = (): AbaClock => useContext(ClockContext);

/**
 * Один таймер на срок модели: `dueAt` меняется — прежний снимается. `onDue` получает **срок**, а не момент
 * пробуждения таймера.
 */
export function useDue(dueAt: number | null, onDue: (dueAt: number) => void): void {
  const clock = useAbaClock();
  const cb = useRef(onDue);
  cb.current = onDue;
  useEffect(() => {
    if (dueAt === null) return;
    return clock.at(dueAt, () => cb.current(dueAt));
  }, [clock, dueAt]);
}
