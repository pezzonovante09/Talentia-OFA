/**
 * Системная настройка «уменьшить движение» (iOS Reduce Motion, Android «Удалить анимации»). Раньше жила в
 * `ui/aba/parts.tsx` и действовала только на карте, в атласе и в ABA; урок и первый запуск слушали лишь
 * `calmMode` (контрольный аудит 2026-11-09, Ж9 / этап B). Теперь провайдер темы складывает её с calm в
 * `theme.still`, и все экраны смотрят туда.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => live && setOn(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setOn(v));
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);
  return on;
}
