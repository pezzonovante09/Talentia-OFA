/**
 * Сворачивание и возврат приложения на экранах ABA (фаза 8) — тонкий хук над `AppState`, по образцу `pairing.tsx`:
 * `background` → `onLeave(now)`, следующий `active` → `onReturn(now)`; `inactive` (шторка, звонок) игнорируется.
 * Что делать с состоянием — решает экран; здесь только событие и его время по часам ABA (`useAbaClock`), чтобы
 * тесты шли на ручных часах. Колбэки читаются через ref: подписка одна на всё время жизни экрана.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAbaClock } from './clock';

export function useAbaBackground(o: { enabled: boolean; onLeave: (now: number) => void; onReturn: (now: number) => void }): void {
  const clock = useAbaClock();
  const left = useRef(false);
  const current = useRef(o);
  current.current = o;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        if (left.current || !current.current.enabled) return;
        left.current = true;
        current.current.onLeave(clock.now());
      } else if (state === 'active' && left.current) {
        left.current = false;
        current.current.onReturn(clock.now());
      }
    });
    return () => sub.remove();
  }, [clock]);
  // ушли, пока экран грузился (подписка выключена): событие потеряно — уход отмечается, как только экран готов
  useEffect(() => {
    if (o.enabled && !left.current && AppState.currentState === 'background') {
      left.current = true;
      current.current.onLeave(clock.now());
    }
  }, [o.enabled, clock]);
}
