import React from 'react';
import { View } from 'react-native';

import { useAppTheme } from '../theme';

type SpacerProps = {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
};

export function Spacer({ size = 'md' }: SpacerProps) {
  const theme = useAppTheme();
  const height = theme.spacing[size];
  return <View style={{ height }} />;
}

