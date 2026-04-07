import React from 'react';
import type { ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';

type Props = {
  source: ImageSourcePropType;
  size: number;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
};

export function NanoBananaIcon({ source, size, style, accessibilityLabel }: Props) {
  return (
    <Image
      source={source}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessibilityLabel={accessibilityLabel}
    />
  );
}
