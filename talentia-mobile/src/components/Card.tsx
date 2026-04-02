import React from 'react';
import { View, ViewProps } from 'react-native';

import { useAppTheme } from '../theme';

export type CardProps = ViewProps & {
  highlighted?: boolean;
};

export function Card({ style, highlighted, ...rest }: CardProps) {
  const theme = useAppTheme();

  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: highlighted ? theme.colors.primary + '12' : theme.colors.surface,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.lg,
          borderWidth: highlighted ? 2.5 : 1,
          borderColor: highlighted ? theme.colors.primary + '60' : theme.colors.border,
          shadowColor: highlighted ? theme.colors.primary : '#0E2B3B',
          shadowOpacity: theme.calmMode ? 0.04 : highlighted ? 0.15 : 0.06,
          shadowRadius: theme.calmMode ? 6 : highlighted ? 14 : 10,
          shadowOffset: { width: 0, height: highlighted ? 4 : 2 },
          elevation: theme.calmMode ? 1 : highlighted ? 6 : 3,
        },
        style,
      ]}
    />
  );
}
