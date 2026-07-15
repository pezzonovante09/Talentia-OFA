import React from 'react';
import { View } from 'react-native';

import { NanoBananaIcon } from '../NanoBananaIcon';
import { NANO_UI } from '../../constants/nanoBananaAssets';

export function StarsRow({ stars, size = 28 }: { stars: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
      {[1, 2, 3].map((i) => (
        <NanoBananaIcon
          key={i}
          source={NANO_UI.stars}
          size={size}
          style={{ opacity: i <= stars ? 1 : 0.25 }}
        />
      ))}
    </View>
  );
}
