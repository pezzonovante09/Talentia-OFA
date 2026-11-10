/**
 * Текст ABA-экранов на Nunito (решение №176; контрольный аудит 2026-11-09, Ж18: ABA был набран системным шрифтом).
 * Роль — готовый стиль, новых ролей нет (`design-lead`, этап F): детское — из `typography` (`subtitle` у инструкции,
 * плашки, кнопок и кадра «свёрнуто», `title` у экрана конца), взрослое — из `parentTypography` (панель взрослого,
 * подписи, экран «слишком мал»). Файл шрифта по весу — `fontFamilyFor`, только загруженные 400/700/800. Цвет — явно из
 * `abaColors` / `parentColors`: у ABA своя палитра, не детская тема. Потолок системного масштаба — по месту (`max`).
 */
import type { ComponentProps } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import type { TypeStyle } from '../../design/tokens';
import { fontFamilyFor } from '../fonts';

export type AbaTextRole = Pick<TypeStyle, 'size' | 'lineHeight' | 'weight' | 'family'>;

export type AbaTextProps = Omit<ComponentProps<typeof Text>, 'style' | 'maxFontSizeMultiplier' | 'numberOfLines'> & {
  /** Стиль роли (`typography.*` или `parentTypography.*`); не `role` — так у Text называется роль доступности. */
  type: AbaTextRole;
  color: string;
  /** `maxFontSizeMultiplier`: 1.2 у детских кадров и панели, 1.3 у свободного текста взрослому, 1 — где места нет. */
  max: number;
  lines?: number;
  style?: StyleProp<TextStyle>;
};

export function AbaText({ type, color, max, lines, style, ...rest }: AbaTextProps) {
  return (
    <Text
      maxFontSizeMultiplier={max}
      numberOfLines={lines}
      style={[{ color, fontFamily: fontFamilyFor(type), fontWeight: type.weight, fontSize: type.size, lineHeight: type.lineHeight }, style]}
      {...rest}
    />
  );
}
