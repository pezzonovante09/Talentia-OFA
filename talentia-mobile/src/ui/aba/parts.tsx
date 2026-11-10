/**
 * Общие детали детских экранов ABA (этап 11, направление `docs/design/aba-screens-2026-10-25.md`): цвета режима,
 * глифы-заглушки для недостающих иконок, выход удержанием, детская кнопка с правилом касания (`abaTouchCommits`).
 * Цвета и размеры — только токены `design/abaTokens.ts`.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, useColorScheme, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { abaColors, abaControls, abaNonTrialRow, ABA_CONTROL_STROKE, abaTouchCommits, inactiveChoice, type AbaColors } from '../../design/abaTokens';
import { radii } from '../../design/tokens';
import { useAbaClock } from './clock';

export function useAbaColors(): AbaColors {
  return abaColors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

/** Системное «уменьшить движение»: вместе с calm — только смены кадра (полёт жетонов, раскрытие и сворачивание сцены). */
/** Системное «уменьшить движение» — общий хук темы (этап B аудита 2026-11-09); здесь — для прежних импортов. */
export { useReduceMotion } from '../../design/useReduceMotion';

/**
 * Глифы, которых ещё нет в `ICONS` (`pause_bars` — «перерыв», `finger_ring` — подсказка выхода, `ui-replay`) или
 * есть только с контуром набора (`map` — геометрия `ui-map.svg` одним цветом для «Готово», Ц3.8): простая геометрия
 * кодом до ассета (скилл `asset-pipeline`). Одноцветные, как иконки направления. `stroke` — штрих контурного глифа в
 * pt на его размере (планки 120 второго приглашения — 6, Ц3.1).
 */
export function PlaceholderGlyph({
  name,
  size,
  color,
  stroke,
  cut,
}: {
  name: 'pause_bars' | 'pause_bars_outline' | 'finger_ring' | 'ui-replay' | 'map';
  size: number;
  color: string;
  stroke?: number;
  /** Цвет выреза сгибов у `map` — заливка кнопки под глифом. */
  cut?: string;
}) {
  const s = size;
  const sw = stroke === undefined ? 2 : (stroke * 24) / size;
  // явный `stroke` (планки 120) — штрих внутрь, габарит как у сплошных; по умолчанию (32 на «Вернуться») — по центру
  // линии: внутрь штрих 2 закрасил бы планку шириной 4 целиком, и «опустевшие» планки читались бы сплошными (V-4б)
  const inset = stroke === undefined ? 0 : sw / 2;
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
          {/* штрих внутрь: внешний габарит совпадает со сплошными планками — смена кадра без прыжка */}
          <Rect x={6 + inset} y={4 + inset} width={4 - 2 * inset} height={16 - 2 * inset} rx={1} stroke={color} strokeWidth={sw} fill="none" />
          <Rect x={14 + inset} y={4 + inset} width={4 - 2 * inset} height={16 - 2 * inset} rx={1} stroke={color} strokeWidth={sw} fill="none" />
        </>
      )}
      {name === 'finger_ring' && (
        <>
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} fill="none" />
          <Circle cx={12} cy={12} r={3} fill={color} />
        </>
      )}
      {/* силуэт `ui-map.svg` (сложенная карта) одним цветом: заливка, сгибы — вырезом цвета `cut` (Ц3.8, огр. 8) */}
      {name === 'map' && (
        <>
          <Path d="M1.9 6.4l6.8-2.6 6.8 2.6 6.8-2.6v13.9l-6.8 2.6-6.8-2.6-6.8 2.6z" fill={color} />
          <Path d="M8.6 3.8v13.9M15.4 6.4v13.9" stroke={cut ?? 'none'} strokeWidth={1.5} strokeLinecap="round" />
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
  onUpAt,
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
  /** Палец снят — или цель ушла с экрана, пока он лежал (смена кадра ждёт касание, Ц4 огр. 1). */
  onUpAt?: (at: number) => void;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const clock = useAbaClock();
  const down = useRef<{ at: number; x: number; y: number; id: number } | null>(null);
  const pressing = useRef(false);
  const onUpRef = useRef(onUpAt);
  onUpRef.current = onUpAt;
  useEffect(
    () => () => {
      if (pressing.current) onUpRef.current?.(clock.now());
    },
    [clock],
  );
  const onPressIn = (e: GestureResponderEvent) => {
    const at = clock.now();
    down.current = { at, x: e.nativeEvent?.pageX ?? 0, y: e.nativeEvent?.pageY ?? 0, id: Number(e.nativeEvent?.identifier ?? 0) };
    pressing.current = true;
    onDownAt?.(at);
  };
  const onPressOut = () => {
    if (!pressing.current) return;
    pressing.current = false;
    onUpAt?.(clock.now());
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
      onPressOut={onPressOut}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [style, pressed ? { transform: [{ scale: inactiveChoice.tapPress.scale }] } : null]}
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
  // выход в конце удержания видит экран на этот момент, а не на момент касания: за 1500 мс доступ мог дойти до T, и
  // время сцены в журнале (№171) кончается в T, а не в момент выхода
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
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
      onExitRef.current();
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
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
        // поверх соседей, а не в ряду: подсказка не сдвигает заголовок, кольцо и подпись взрослому
        <View testID="aba-exit-hint" accessibilityLabel={hintLabel} style={{ position: 'absolute', left: abaControls.exitSize + 8 }}>
          <PlaceholderGlyph name="finger_ring" size={32} color={c.ink} />
        </View>
      )}
    </View>
  );
}

/**
 * Строка 72 вне пробы (`abaNonTrialRow`, Ц3.0 п. 3, Ц3.6): выход удержанием на y 6–66 слева, центр (кольцо доступа,
 * заголовок), справа пустой слот 60. Одна для выбора, сопряжения, обмена, доступа и ожидания цикла — выход не прыгает.
 */
export function NonTrialRow({ onExit, exitLabel, exitHint, children }: { onExit?: () => void; exitLabel: string; exitHint: string; children?: ReactNode }) {
  const r = abaNonTrialRow;
  return (
    <View style={{ height: r.height, flexDirection: 'row', alignItems: 'flex-start', paddingTop: r.exitTopInset }} testID="aba-row-72">
      <View style={{ width: r.rightSlot }}>{onExit && <ExitHold onExit={onExit} label={exitLabel} hintLabel={exitHint} />}</View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: abaControls.exitSize }}>{children}</View>
      <View style={{ width: r.rightSlot }} />
    </View>
  );
}

/**
 * Не цель, но касание не молчит (I-6, `inactiveChoice.tapPress`): сжатие до отпускания, без звука, записи и действия.
 * Для Tali и значков, которые ребёнок трогает на экранах ожидания и обмена.
 */
export function PressOnly({
  children,
  accessibilityLabel,
  selected,
  testID,
}: {
  children: ReactNode;
  accessibilityLabel: string;
  /** Принятая просьба (след карточки «перерыв», Ц4 огр. 3). */
  selected?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected ? { selected: true } : undefined}
      testID={testID}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? inactiveChoice.tapPress.scale : 1 }] })}
    >
      {children}
    </Pressable>
  );
}
