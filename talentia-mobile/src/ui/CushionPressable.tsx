/**
 * Нажимаемая фигура направления B (решения №68, №69; SCREENS.md 2.1, 2.3).
 *
 * - Роль с подушкой (`raised`): под фигурой лежит тень-подушка цвета `outline`, при касании фигура
 *   садится на неё (`pressedOffset`) за `motion.quick`; «выбрано» — фигура вдавлена и держит контур
 *   `stroke.bold` цветом `selectedStroke`.
 * - Плоская роль (`flat`): подушки нет, отклик — сжатие `pressScale` за `motion.press`.
 * Амплитуда одинакова во всех режимах; calm делает подушку и контур тоньше через тему. Повторные
 * касания в течение `guardMs` игнорируются (защита от двойного тапа, `lessonTiming.nextGuard`).
 * Анимация — RN `Animated` без worklets: одинаково на устройстве и в Expo Web.
 *
 * Плитка задания (`ui/lesson/Tile`) переопределяет вид состояний через `raised`, `sunk`,
 * `outlineWidth`, `pressScale` — сами состояния описаны там, здесь только механика.
 */
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useDesign } from '../design';
import { cushionByRole, pressScale, selectedStroke, type CushionRole } from '../design/tokens';
import type { ColorName } from './colors';

/** На web нативного драйвера анимаций нет — RN предупреждает на каждом касании. */
const NATIVE_DRIVER = Platform.OS !== 'web';

export type CushionPressableProps = {
  role: CushionRole;
  width: number | '100%';
  height: number;
  /** Скругление: число или `'pill'`. */
  radius: number | 'pill';
  fill: ColorName;
  outlineColor?: ColorName;
  /** Толщина контура; по умолчанию `stroke.base`, у «выбрано» — `stroke.bold`. */
  outlineWidth?: number;
  /** Пунктир «здесь пусто»: без подушки в любой роли. */
  dashed?: boolean;
  /** Подушка есть/нет независимо от роли (состояния плитки 2.3). */
  raised?: boolean;
  /** Фигура сидит на подушке постоянно («выбрано», «заблокировано», «ошибка»). */
  sunk?: boolean;
  selected?: boolean;
  selectedColor?: ColorName;
  /** Сжатие на касание: плоская роль — всегда; с подушкой — когда `squeezeOnPress`. */
  scale?: number;
  squeezeOnPress?: boolean;
  /** Сжатие держится до отпускания (повторный тап по выбранному, пустое место `order`). */
  holdScale?: boolean;
  guardMs?: number;
  disabled?: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button' | 'radio' | 'none' | 'image';
  accessibilityValue?: { text: string };
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
  testID?: string;
  style?: StyleProp<ViewStyle>;
  faceStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function CushionPressable({
  role,
  width,
  height,
  radius,
  fill,
  outlineColor = 'outline',
  outlineWidth,
  dashed = false,
  raised: raisedProp,
  sunk = false,
  selected = false,
  selectedColor = selectedStroke.lesson,
  scale = pressScale.wide,
  squeezeOnPress,
  holdScale = false,
  guardMs = 0,
  disabled = false,
  onPress,
  onPressIn,
  onPressOut,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityValue,
  accessibilityElementsHidden,
  importantForAccessibility,
  testID,
  style,
  faceStyle,
  children,
}: CushionPressableProps) {
  const theme = useDesign();
  const raised = (raisedProp ?? cushionByRole[role] === 'raised') && !dashed;
  const squeeze = squeezeOnPress ?? !raised;
  const offsetY = theme.elevation.raised.offsetY;
  const borderRadius = radius === 'pill' ? theme.radii.pill : radius;
  const restSunk = selected || sunk;

  const sink = useRef(new Animated.Value(restSunk ? 1 : 0)).current;
  const squeezeValue = useRef(new Animated.Value(1)).current;
  const lastPress = useRef(0);

  const animate = (value: Animated.Value, toValue: number, duration: number) =>
    Animated.timing(value, { toValue, duration, useNativeDriver: NATIVE_DRIVER }).start();

  useEffect(() => {
    Animated.timing(sink, { toValue: restSunk ? 1 : 0, duration: theme.motion.quick, useNativeDriver: NATIVE_DRIVER }).start();
  }, [restSunk, sink, theme.motion.quick]);

  const translateY = sink.interpolate({ inputRange: [0, 1], outputRange: [0, offsetY] });
  const borderWidth = outlineWidth ?? (selected ? theme.stroke.bold : theme.stroke.base);

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityValue={accessibilityValue}
      accessibilityState={{ selected, disabled }}
      accessibilityElementsHidden={accessibilityElementsHidden}
      importantForAccessibility={importantForAccessibility}
      testID={testID}
      hitSlop={0}
      onPressIn={() => {
        if (raised && !restSunk) animate(sink, 1, theme.motion.quick);
        if (squeeze) animate(squeezeValue, scale, theme.motion.press);
        onPressIn?.();
      }}
      onPressOut={() => {
        if (raised && !restSunk) animate(sink, 0, theme.motion.quick);
        if (squeeze) animate(squeezeValue, 1, holdScale ? theme.motion.press : theme.motion.press);
        onPressOut?.();
      }}
      onPress={() => {
        const now = Date.now();
        if (guardMs > 0 && now - lastPress.current < guardMs) return;
        lastPress.current = now;
        onPress?.();
      }}
      style={[{ width, height: raised ? height + offsetY : height }, style]}
    >
      {raised && (
        <View
          testID={testID ? `${testID}-cushion` : undefined}
          style={[StyleSheet.absoluteFillObject, { top: offsetY, bottom: 0, borderRadius, backgroundColor: theme.colors.outline }]}
        />
      )}
      <Animated.View
        testID={testID ? `${testID}-face` : undefined}
        style={[
          {
            width: '100%',
            height,
            borderRadius,
            backgroundColor: theme.colors[fill],
            borderWidth,
            borderColor: selected ? theme.colors[selectedColor] : theme.colors[outlineColor],
            borderStyle: dashed ? 'dashed' : 'solid',
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ translateY: raised ? translateY : 0 }, { scale: squeezeValue }],
          },
          faceStyle,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
