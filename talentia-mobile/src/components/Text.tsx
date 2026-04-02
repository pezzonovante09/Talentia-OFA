import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';

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

  const fontSize =
    variant === 'title'
      ? theme.typography.title
      : variant === 'subtitle'
      ? theme.typography.subtitle
      : variant === 'small'
      ? theme.typography.small
      : theme.typography.body;

  const fontWeight = variant === 'title' ? '800' : variant === 'subtitle' ? '700' : '500';

  return (
    <RNText
      {...rest}
      style={[
        {
          color: theme.colors.text,
          fontSize,
          fontWeight,
          fontFamily: getFontFamily(fontWeight),
        },
        style,
      ]}
    />
  );
}

