/**
 * Текст по роли типографики из токенов. Кегль никогда не масштабируется темой (длинная кыргызская
 * строка переполнила бы слот), системный шрифт ограничен `lessonFontCaps` по роли: вопрос и реплика —
 * чуть, подписи на плитках и цифры — никогда (`fixed`).
 *
 * `fit="title"` — заголовок в слоте на две строки: если текст его перерос, кегль опускается до
 * `TITLE_MIN_SIZE` (метрики `subtitle`). Это детерминированный пересчёт, а не `adjustsFontSizeToFit`:
 * тот на web не работает, а блок всё равно резервирует полную высоту. Замер — по `onLayout` и с лимитом
 * на строку больше слота: `onTextLayout` не отдаёт строк сверх `numberOfLines`, а на web его нет.
 * До замера текст прозрачен, чтобы не мелькнул крупным и обрезанным (`useFitReveal`).
 */
import { useEffect, useState } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { useDesign } from '../design';
import { lessonFontCaps, textFit, TITLE_MAX_LINES, type TypographyTokens } from '../design/tokens';
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

/**
 * Показ текста, который подбирает вид по замеру: до первого «вошло» он прозрачен. Если замер не придёт,
 * текст всё равно появится через `textFit.revealMax`: экран не должен остаться без него.
 */
export function useFitReveal(active = true): [measured: boolean, markMeasured: () => void] {
  const [measured, setMeasured] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setMeasured(true), textFit.revealMax);
    return () => clearTimeout(timer);
  }, [active]);
  return [measured, () => setMeasured(true)];
}

export function AppText({ role, color = 'text', cap, align, lines, fit, style, onLayout, ...rest }: AppTextProps) {
  const theme = useDesign();
  const fitting = fit === 'title';
  const [shrunk, setShrunk] = useState(false);
  const [measured, markMeasured] = useFitReveal(fitting);
  const base = theme.typography[role];
  const metrics = fitting && shrunk ? theme.typography.subtitle : base;
  const maxLines = lines ?? (fitting ? (shrunk ? TITLE_MAX_LINES : TITLE_MAX_LINES + 1) : undefined);

  return (
    <Text
      {...rest}
      numberOfLines={maxLines}
      maxFontSizeMultiplier={lessonFontCaps[cap ?? DEFAULT_CAP[role]]}
      onLayout={(e) => {
        onLayout?.(e);
        if (!fitting) return;
        if (!shrunk && e.nativeEvent.layout.height > TITLE_MAX_LINES * base.lineHeight + textFit.tolerance) setShrunk(true);
        else markMeasured();
      }}
      style={[
        {
          fontFamily: fontFamilyFor(base),
          fontWeight: base.weight,
          fontSize: metrics.size,
          lineHeight: metrics.lineHeight,
          color: theme.colors[color],
          textAlign: align,
          ...(fitting && { opacity: measured || shrunk ? 1 : 0 }),
        },
        style,
      ]}
    />
  );
}
