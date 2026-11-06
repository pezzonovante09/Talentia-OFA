/**
 * Полотно экрана: safe area сверху (цвет — экрана: регион на карте и уроке, `background` в остальных),
 * боковые поля `spacing.lg` (focus → 24 через `density`), низ `max(safeBottom, 16)`.
 * Экраны среза не прокручиваются — всё, что внутри, обязано войти в бюджет высоты (`tokens`).
 */
import type { PropsWithChildren } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDesign } from '../design';
import type { ColorName } from './colors';

export type ScreenProps = PropsWithChildren<{
  safeAreaColor?: ColorName;
  /** Цвет поля под safe area; по умолчанию — `background`. */
  background?: ColorName;
  /** Без боковых полей (карта: лента на всю ширину). */
  bleed?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function Screen({ safeAreaColor, background = 'background', bleed = false, style, testID, children }: ScreenProps) {
  const theme = useDesign();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors[safeAreaColor ?? background] }} testID={testID}>
      <View style={{ height: insets.top }} />
      <View
        style={[
          {
            flex: 1,
            backgroundColor: theme.colors[background],
            paddingHorizontal: bleed ? 0 : theme.spacing.lg,
            paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
