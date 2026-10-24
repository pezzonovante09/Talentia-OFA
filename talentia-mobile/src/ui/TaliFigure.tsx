/**
 * Tali: одна из семи поз (`TALI_POSES`). Два вида:
 * - `crop` — «по пояс» в слот 88 (`taliCrop`): кадр масштабируется так, чтобы доля `w` кадра стала
 *   размером слота, и сдвигается на `x`/`y`; обрезка — `overflow: hidden`, не viewBox, чтобы web и
 *   устройство показывали одно и то же;
 * - полный рост (карта 96, первый запуск 120).
 * Тап — сжатие `pressScale.tali` (`taliIdleTap` без пузыря повторяет реплику — за это отвечает экран).
 * Сумка и поза не различаются касанием (`taliSatchelRule`): вся фигура — одна цель.
 */
import { useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { TALI_POSES, type TaliPose } from '../assets/registry';
import { useDesign } from '../design';
import { pressScale, taliCrop } from '../design/tokens';

export type TaliFigureProps = {
  pose: TaliPose;
  size: number;
  crop?: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
  testID?: string;
};

export function TaliFigure({ pose, size, crop = false, onPress, accessibilityLabel, testID = 'tali' }: TaliFigureProps) {
  const theme = useDesign();
  const Svg = TALI_POSES[pose];
  const squeeze = useRef(new Animated.Value(1)).current;
  const frame = crop ? size / taliCrop.w : size;
  const offsetX = crop ? -taliCrop.x * frame : 0;
  const offsetY = crop ? -taliCrop.y * frame : 0;

  const figure = (
    <Animated.View style={{ width: size, height: size, overflow: 'hidden', transform: [{ scale: squeeze }] }} testID={testID}>
      <View style={{ position: 'absolute', left: offsetX, top: offsetY, width: frame, height: frame }}>
        <Svg width={frame} height={frame} testID={`${testID}-svg`} />
      </View>
    </Animated.View>
  );

  if (!onPress) return figure;
  const to = (v: number) => Animated.timing(squeeze, { toValue: v, duration: theme.motion.press, useNativeDriver: true }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => to(pressScale.tali)}
      onPressOut={() => to(1)}
      onPress={onPress}
      testID={`${testID}-press`}
    >
      {figure}
    </Pressable>
  );
}
