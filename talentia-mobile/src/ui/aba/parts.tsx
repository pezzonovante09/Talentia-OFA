/**
 * Общие детали детских экранов ABA (этап 11, направление `docs/design/aba-screens-2026-10-25.md`): цвета режима,
 * глифы-заглушки для недостающих иконок, выход удержанием, детская кнопка с правилом касания (`abaTouchCommits`).
 * Цвета и размеры — только токены `design/abaTokens.ts`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, useColorScheme, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { abaColors, abaControls, ABA_CONTROL_STROKE, abaTouchCommits, type AbaColors } from '../../design/abaTokens';
import { radii } from '../../design/tokens';
import { useAbaClock } from './clock';

export function useAbaColors(): AbaColors {
  return abaColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

/**
 * Глифы, которых ещё нет в `ICONS` (`pause_bars` — «перерыв», `finger_ring` — подсказка выхода, `ui-replay`):
 * простая геометрия кодом до ассета (скилл `asset-pipeline`). Одноцветные, как иконки направления.
 */
export function PlaceholderGlyph({ name, size, color }: { name: 'pause_bars' | 'pause_bars_outline' | 'finger_ring' | 'ui-replay'; size: number; color: string }) {
  const s = size;
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'pause_bars' && (
        <>
          <Rect x={6} y={4} width={4} height={16} rx={1} fill={color} />
          <Rect x={14} y={4} width={4} height={16} rx={1} fill={color} />
        </>
      )}
      {name === 'pause_bars_outline' && (
        <>
          <Rect x={6} y={4} width={4} height={16} rx={1} stroke={color} strokeWidth={2} fill="none" />
          <Rect x={14} y={4} width={4} height={16} rx={1} stroke={color} strokeWidth={2} fill="none" />
        </>
      )}
      {name === 'finger_ring' && (
        <>
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} fill="none" />
          <Circle cx={12} cy={12} r={3} fill={color} />
        </>
      )}
      {name === 'ui-replay' && <Path d="M12 5a7 7 0 1 1-6.6 4.7M5 4v5h5" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />}
    </Svg>
  );
}

/**
 * Детская кнопка ABA: касание засчитывается по правилу `abaTouchCommits` (пункт 4 проверки цикла 2) — начато не
 * раньше показа кадра (`frameShownAt`), только первый палец, отпущено внутри цели со сдвигом < 10 pt.
 */
export function ChildPressable({
  frameShownAt,
  onCommit,
  onDownAt,
  disabled,
  children,
  style,
  testID,
  accessibilityLabel,
}: {
  frameShownAt: number;
  onCommit: (at: number) => void;
  /** Момент касания (для очереди панели взрослого и «активности» пробы) — даже если касание не засчитается. */
  onDownAt?: (at: number) => void;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const clock = useAbaClock();
  const down = useRef<{ at: number; x: number; y: number; id: number } | null>(null);
  const onPressIn = (e: GestureResponderEvent) => {
    const at = clock.now();
    down.current = { at, x: e.nativeEvent?.pageX ?? 0, y: e.nativeEvent?.pageY ?? 0, id: Number(e.nativeEvent?.identifier ?? 0) };
    onDownAt?.(at);
  };
  const onPress = (e: GestureResponderEvent) => {
    const d = down.current ?? { at: clock.now(), x: 0, y: 0, id: 0 };
    down.current = null;
    const slop = Math.hypot((e.nativeEvent?.pageX ?? d.x) - d.x, (e.nativeEvent?.pageY ?? d.y) - d.y);
    if (abaTouchCommits({ startedAt: d.at, frameShownAt, pointerIndex: d.id, endedInside: true, slopPt: slop })) onCommit(clock.now());
  };
  return (
    // отклик на касание — сжатие 0.94 до отпускания у любой детской цели, и у неактивной (`inactiveChoice.tapPress`)
    <Pressable
      onPressIn={onPressIn}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [style, pressed ? { transform: [{ scale: 0.94 }] } : null]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
}

/**
 * Выход удержанием (`abaControls.exitHoldMs` 1500, первые 300 — без отклика): ребёнок до конца не удержит, взрослый
 * выйдет. Короткий тап — тихая подсказка «держите» на 1200 мс (`exitTapHint`), не выход. Для скринридера —
 * `accessibilityAction` без удержания.
 */
export function ExitHold({ onExit, label, hintLabel }: { onExit: () => void; label: string; hintLabel: string }) {
  const c = useAbaColors();
  const clock = useAbaClock();
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const cancel = useRef<(() => void) | null>(null);
  const hintCancel = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      cancel.current?.();
      hintCancel.current?.();
    },
    [],
  );
  const start = () => {
    const t0 = clock.now();
    const idle = clock.at(t0 + abaControls.exitHoldIdleMs, () => setHolding(true));
    const done = clock.at(t0 + abaControls.exitHoldMs, () => {
      setHolding(false);
      cancel.current = null;
      onExit();
    });
    cancel.current = () => {
      idle();
      done();
    };
  };
  const stop = () => {
    if (!cancel.current) return;
    cancel.current();
    cancel.current = null;
    setHolding(false);
    setHint(true);
    hintCancel.current?.();
    hintCancel.current = clock.at(clock.now() + abaControls.exitTapHint.durationMs, () => setHint(false));
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable
        onPressIn={start}
        onPressOut={stop}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityActions={[{ name: 'activate', label }]}
        onAccessibilityAction={onExit}
        testID="aba-exit"
        style={{
          width: abaControls.exitSize,
          height: abaControls.exitSize,
          borderRadius: radii.md,
          borderWidth: ABA_CONTROL_STROKE,
          borderColor: c.controlInk,
          backgroundColor: c.controlFill,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Svg width={28} height={28} viewBox="0 0 24 24">
          <Path d="M15 5l-7 7 7 7" stroke={c.controlInk} strokeWidth={3} fill="none" strokeLinecap="round" />
          {holding && <Circle cx={12} cy={12} r={11} stroke={c.controlInk} strokeWidth={2} fill="none" />}
        </Svg>
      </Pressable>
      {hint && (
        <View testID="aba-exit-hint" accessibilityLabel={hintLabel}>
          <PlaceholderGlyph name="finger_ring" size={32} color={c.ink} />
        </View>
      )}
    </View>
  );
}
