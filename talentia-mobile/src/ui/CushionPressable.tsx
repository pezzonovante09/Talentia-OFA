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
 */
import { useRef } from 'react';
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
  /** Пунктир «здесь пусто»: без подушки в любой роли. */
  dashed?: boolean;
  selected?: boolean;
  selectedColor?: ColorName;
  /** Сжатие плоской роли; по умолчанию `pressScale.wide`. */
  scale?: number;
  guardMs?: number;
  disabled?: boolean;
  onPress?: () => void;
  onPressIn?: () => void;
  accessibilityLabel: string;
  accessibilityRole?: 'button' | 'radio' | 'none';
  testID?: string;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function CushionPressable({
  role,
  width,
  height,
  radius,
  fill,
  outlineColor = 'outline',
  dashed = false,
  selected = false,
  selectedColor = selectedStroke.lesson,
  scale = pressScale.wide,
  guardMs = 0,
  disabled = false,
  onPress,
  onPressIn,
  accessibilityLabel,
  accessibilityRole = 'button',
  testID,
  style,
  children,
}: CushionPressableProps) {
  const theme = useDesign();
  const raised = cushionByRole[role] === 'raised' && !dashed;
  const offsetY = theme.elevation.raised.offsetY;
  const borderRadius = radius === 'pill' ? theme.radii.pill : radius;

  const sink = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const squeeze = useRef(new Animated.Value(1)).current;
  const lastPress = useRef(0);

  const animate = (value: Animated.Value, toValue: number, duration: number) =>
    Animated.timing(value, { toValue, duration, useNativeDriver: NATIVE_DRIVER }).start();

  const translateY = sink.interpolate({ inputRange: [0, 1], outputRange: [0, offsetY] });

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      testID={testID}
      hitSlop={0}
      onPressIn={() => {
        if (raised) animate(sink, 1, theme.motion.quick);
        else animate(squeeze, scale, theme.motion.press);
        onPressIn?.();
      }}
      onPressOut={() => {
        if (raised) animate(sink, selected ? 1 : 0, theme.motion.quick);
        else animate(squeeze, 1, theme.motion.press);
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
          style={[
            StyleSheet.absoluteFillObject,
            { top: offsetY, bottom: 0, borderRadius, backgroundColor: theme.colors.outline },
          ]}
        />
      )}
      <Animated.View
        testID={testID ? `${testID}-face` : undefined}
        style={{
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors[fill],
          borderWidth: selected ? theme.stroke.bold : theme.stroke.base,
          borderColor: selected ? theme.colors[selectedColor] : theme.colors[outlineColor],
          borderStyle: dashed ? 'dashed' : 'solid',
          alignItems: 'center',
          justifyContent: 'center',
          transform: raised ? [{ translateY }] : [{ scale: squeeze }],
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
