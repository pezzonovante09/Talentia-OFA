/**
 * Текст по роли типографики из токенов. Кегль никогда не масштабируется темой (длинная кыргызская
 * строка переполнила бы слот), системный шрифт ограничен `lessonFontCaps` по роли: вопрос и реплика —
 * чуть, подписи на плитках и цифры — никогда (`fixed`).
 *
 * `fit="title"` — заголовок на две строки: если текст не вошёл в `TITLE_MAX_LINES`, кегль опускается
 * до `TITLE_MIN_SIZE` (метрики `subtitle`). Это детерминированный пересчёт по `onTextLayout`, а не
 * `adjustsFontSizeToFit`: тот на web не работает, а блок всё равно резервирует полную высоту.
 */
import { useState } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { useDesign } from '../design';
import { lessonFontCaps, TITLE_MAX_LINES, type TypographyTokens } from '../design/tokens';
import type { ColorName } from './colors';
import { fontFamilyFor } from './fonts';

export type TextRole = keyof TypographyTokens;
export type FontCap = keyof typeof lessonFontCaps;

const DEFAULT_CAP: Record<TextRole, FontCap> = {
  display: 'fixed',
  title: 'prompt',
  subtitle: 'prompt',
  body: 'bubble',
  label: 'fixed',
  caption: 'fixed',
};

export type AppTextProps = Omit<TextProps, 'style' | 'role'> & {
  role: TextRole;
  color?: ColorName;
  cap?: FontCap;
  align?: TextStyle['textAlign'];
  lines?: number;
  fit?: 'title';
  style?: TextStyle;
};

export function AppText({ role, color = 'text', cap, align, lines, fit, style, onTextLayout, ...rest }: AppTextProps) {
  const theme = useDesign();
  const [shrunk, setShrunk] = useState(false);
  const base = theme.typography[role];
  const metrics = fit === 'title' && shrunk ? theme.typography.subtitle : base;
  const maxLines = lines ?? (fit === 'title' ? TITLE_MAX_LINES : undefined);

  return (
    <Text
      {...rest}
      numberOfLines={maxLines}
      maxFontSizeMultiplier={lessonFontCaps[cap ?? DEFAULT_CAP[role]]}
      onTextLayout={(e) => {
        onTextLayout?.(e);
        if (fit === 'title' && !shrunk && e.nativeEvent.lines.length > TITLE_MAX_LINES) setShrunk(true);
      }}
      style={[
        {
          fontFamily: fontFamilyFor(base),
          fontWeight: base.weight,
          fontSize: metrics.size,
          lineHeight: metrics.lineHeight,
          color: theme.colors[color],
          textAlign: align,
        },
        style,
      ]}
    />
  );
}
