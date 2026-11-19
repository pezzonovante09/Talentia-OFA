/**
 * «Поём вместе» (Ц2.9): поёт взрослый — сверху подсказка ему взрослым шрифтом (правка 5); тап — Tali одно покачивание
 * 1200 мс, ноты — статичные значки. Конец — Tali в `idle`. Calm — без покачивания: тап — сжатие Tali 0.94.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { ICONS } from '../../../assets/registry';
import { abaRewardScene } from '../../../design/abaTokens';
import { parentTypography } from '../../../design/parentTokens';
import { TaliFigure } from '../../TaliFigure';
import { AbaText } from '../AbaText';
import { useAbaColors } from '../parts';
import { SceneFrame, sceneColors, type SceneProps, type SceneSize } from './SceneFrame';

const K = abaRewardScene.singTogether;
const NATIVE = Platform.OS !== 'web';
const Note = ICONS.note;

export function SingTogetherScene({ ended, still }: SceneProps) {
  const { t } = useTranslation();
  const c = useAbaColors();
  const ink = sceneColors(still);
  const [size, setSize] = useState<SceneSize | null>(null);
  const p = useRef(new Animated.Value(0)).current;
  const onTap = () => {
    p.setValue(0);
    Animated.timing(p, { toValue: 1, duration: still ? K.swayMs / 4 : K.swayMs, useNativeDriver: NATIVE }).start();
  };
  const transform = still
    ? [{ scale: p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, K.calmScale, 1] }) }]
    : [{ rotate: p.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: ['0deg', `${K.swayDeg}deg`, `${-K.swayDeg}deg`, '0deg'] }) }];
  const side = size ? Math.min(size.w, size.h) * K.share : 0;
  return (
    <SceneFrame ended={ended} onTap={onTap} onSize={setSize}>
      <View style={{ paddingTop: 12, paddingHorizontal: 16 }}>
        {/* подсказка взрослому, не ребёнку: на языке устройства, взрослым шрифтом */}
        <AbaText type={parentTypography.body} color={c.ink} max={1.3} lines={2} style={{ textAlign: 'center' }} testID="aba-sing-together-hint">
          {t('abaSession.singTogetherHint')}
        </AbaText>
      </View>
      {side > 0 && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {[ink.violet, ink.lavender, ink.violet].map((color, i) => (
              <Note key={i} width={K.note} height={K.note} color={color} stroke={ink.ink} />
            ))}
          </View>
          <Animated.View style={{ transform }}>
            <TaliFigure pose={ended ? 'idle' : 'hello'} size={side} accessibilityLabel={t('a11y.tali')} testID="aba-sing-together-tali" />
          </Animated.View>
        </View>
      )}
    </SceneFrame>
  );
}
