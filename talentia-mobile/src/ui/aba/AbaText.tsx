/**
 * Текст ABA-экранов на Golos Text («Тихий кабинет», №203; до него — Nunito, №176 / Ж18). Роль — готовый стиль, новых
 * ролей в разметке нет: детское — `typography.subtitle` / `title` (инструкция, плашка, кнопки, кадр «свёрнуто», экран
 * конца), взрослое — `parentTypography` (панель взрослого, подписи, экран «слишком мал»), подпись листа —
 * `abaTypography.sheetCaption`. Детская роль переводится на Golos через `abaTypeFor` (кегль и интерлиньяж прежние,
 * вес 800 → 700, 700 → 600), поэтому урок и `glyphFit` остаются на Nunito, а ABA — целиком на Golos. Файл шрифта
 * по весу — `fontFamilyFor`. Цвет — явно из `abaColors` / `abaAdultPanelColors`: у ABA своя палитра, не детская тема.
 * Потолок системного масштаба — по месту (`max`).
 */
import type { ComponentProps } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { abaTypeFor, type AbaTypeStyle } from '../../design/abaTokens';
import { fontFamilyFor } from '../fonts';

export type AbaTextRole = AbaTypeStyle;

export type AbaTextProps = Omit<ComponentProps<typeof Text>, 'style' | 'maxFontSizeMultiplier' | 'numberOfLines'> & {
  /** Стиль роли (`typography.*`, `parentTypography.*`, `abaTypography.*`); не `role` — так у Text называется роль доступности. */
  type: AbaTextRole;
  color: string;
  /** `maxFontSizeMultiplier`: 1.2 у детских кадров и панели, 1.3 у свободного текста взрослому, 1 — где места нет. */
  max: number;
  lines?: number;
  style?: StyleProp<TextStyle>;
};

export function AbaText({ type, color, max, lines, style, ...rest }: AbaTextProps) {
  const t = abaTypeFor(type);
  return (
    <Text
      maxFontSizeMultiplier={max}
      numberOfLines={lines}
      style={[{ color, fontFamily: fontFamilyFor(t), fontWeight: t.weight, fontSize: t.size, lineHeight: t.lineHeight }, style]}
      {...rest}
    />
  );
}
