import React from 'react';
import { Platform, Text as RNText, TextProps as RNTextProps } from 'react-native';

import { useAppTheme } from '../theme';

type Variant = 'title' | 'subtitle' | 'body' | 'small';

export type AppTextProps = RNTextProps & {
  variant?: Variant;
};

function getFontFamily(weight: string): string {
  if (weight === '800') return 'Nunito_800ExtraBold';
  if (weight === '700') return 'Nunito_700Bold';
  if (weight === '600') return 'Nunito_600SemiBold';
  return 'Nunito_400Regular';
}

export function AppText({ style, variant = 'body', ...rest }: AppTextProps) {
  const theme = useAppTheme();
  const isAndroid = Platform.OS === 'android';

  const fontSize =
    variant === 'title'
      ? theme.typography.title
      : variant === 'subtitle'
      ? theme.typography.subtitle
      : variant === 'small'
      ? theme.typography.small
      : theme.typography.body;

  const weightForVariant = variant === 'title' ? '800' : variant === 'subtitle' ? '700' : '500';
  /** Android: system sans (Roboto) has reliable Cyrillic; bundled Nunito often renders mojibake. */
  const androidVariantWeight =
    weightForVariant === '800' ? '700' : weightForVariant === '700' ? '600' : '400';

  return (
    <RNText
      {...rest}
      style={[
        {
          color: theme.colors.text,
          fontSize,
        },
        isAndroid
          ? { fontFamily: 'sans-serif', fontWeight: androidVariantWeight }
          : { fontFamily: getFontFamily(weightForVariant), fontWeight: 'normal' },
        style,
        isAndroid
          ? { fontFamily: 'sans-serif' }
          : { fontWeight: 'normal' },
      ]}
    />
  );
}

