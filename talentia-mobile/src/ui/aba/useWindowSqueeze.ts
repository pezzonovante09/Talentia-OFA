/**
 * Окно перестало вмещать раскладку тира, выбранного на старте (№182: минимальная защита вместо полной паузы №155) —
 * разделённый экран, плавающее окно, поворот планшета. Сжатие идёт тем же путём, что уход в фон: проба не пишется,
 * экран пустеет, а когда окно снова вмещает раскладку — та же проба заново с SD и тем же тиром. Пока окно сжато,
 * возврат из фона занятие не продолжает.
 *
 * Первое измерение окна на старте бывает неточным: при первой проверке, ещё до того как ребёнок что-то увидел, тир
 * выбирается заново — самый крупный, что вмещается по высоте и по ширине. Позже — только пауза: ребёнок уже видел
 * стимул в этом тире (методист, `qa-engineer`, 2026-11-08). Высота и нижний отступ берутся из одного измерения.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { AbaTier } from '../../design/abaTokens';
import { useAbaClock } from './clock';
import { tierForWindow, windowFitsTier } from './model/sessionResume';

export function useWindowSqueeze(o: {
  tier: AbaTier | null;
  /** Одно измерение окна: высота внутри safe area и нижний отступ того же момента. */
  measured: { height: number; width: number; insetBottom: number } | null;
  enabled: boolean;
  onRetier: (tier: AbaTier) => void;
  onSqueeze: (now: number) => void;
  onRelease: (now: number) => void;
}): { readonly current: boolean } {
  const clock = useAbaClock();
  const squeezed = useRef(false);
  const startWidth = useRef<number | null>(null);
  const checked = useRef(false);
  // строка «Верните размер окна» на кадре ухода читает флаг — смена флага перерисовывает экран
  const [, redraw] = useState(0);
  const current = useRef(o);
  current.current = o;
  const { tier, measured, enabled } = o;
  useEffect(() => {
    if (!tier || !measured) return;
    // ширина на старте: уже ряда плит устройство могло быть с самого начала — паузой станет только дальнейшее сужение
    if (startWidth.current === null) startWidth.current = measured.width;
    if (!enabled) return;
    const first = !checked.current;
    checked.current = true;
    const fits = windowFitsTier({ tier, ...measured, startWidth: startWidth.current });
    const retier = !fits && first ? tierForWindow(measured) : null;
    if (retier) {
      startWidth.current = measured.width;
      current.current.onRetier(retier);
    } else if (!fits && !squeezed.current) {
      squeezed.current = true;
      redraw((n) => n + 1);
      current.current.onSqueeze(clock.now());
    } else if (fits && squeezed.current) {
      squeezed.current = false;
      redraw((n) => n + 1);
      // в фоне окно может вернуться раньше приложения: продолжит возврат из фона
      if (AppState.currentState !== 'background') current.current.onRelease(clock.now());
    }
  }, [tier, measured, enabled, clock]);
  return squeezed;
}
