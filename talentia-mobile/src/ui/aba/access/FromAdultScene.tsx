/**
 * «Награда от взрослого» (решение 14 методиста, 2026-11-18): что дать, решает взрослый рядом, вне приложения. Сцена —
 * только значок-подарок (примитив кодом, без ассета) и подсказка взрослому сверху его шрифтом, как у «Поём вместе»;
 * касание сцены ничего не начинает. Кольцо доступа — в строке 72 (`AccessView`), «Готово» взрослого — там же, поверх
 * низа сцены. Что именно дали, приложение не спрашивает и не записывает.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { abaRewardScene } from '../../../design/abaTokens';
import { parentTypography } from '../../../design/parentTokens';
import { AbaText } from '../AbaText';
import { useAbaColors } from '../parts';
import { SceneFrame, sceneColors, type SceneProps, type SceneSize } from './SceneFrame';

const K = abaRewardScene.fromAdult;
const INK = abaRewardScene.colors;

/** Подарок: коробка, крышка, лента и бант. `mono` — силуэт одним цветом (кольцо доступа, полоса «работаю за…»). */
export function GiftPicture({ size, mono, ink = INK }: { size: number; mono?: string; ink?: { violet: string; lavender: string; ink: string } }) {
  const body = mono ?? ink.lavender;
  const band = mono ?? ink.violet;
  const line = mono ?? ink.ink;
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Path d="M28 17C22 8 14 10 17 15C19 18 24 17 28 17C32 17 37 18 39 15C42 10 34 8 28 17Z" fill={band} stroke={line} strokeWidth={2} strokeLinejoin="round" />
      <Rect x={10} y={26} width={36} height={24} rx={3} fill={body} stroke={line} strokeWidth={2} />
      <Rect x={7} y={17} width={42} height={10} rx={3} fill={body} stroke={line} strokeWidth={2} />
      <Rect x={25} y={17} width={6} height={33} fill={band} stroke={line} strokeWidth={2} />
    </Svg>
  );
}

export function FromAdultScene({ ended, still }: SceneProps) {
  const { t } = useTranslation();
  const c = useAbaColors();
  const ink = sceneColors(still);
  const [size, setSize] = useState<SceneSize | null>(null);
  const side = size ? Math.min(size.w, size.h) * K.share : 0;
  return (
    <SceneFrame ended={ended} onTap={() => {}} onSize={setSize}>
      <View style={{ paddingTop: 12, paddingHorizontal: 16 }}>
        {/* подсказка взрослому, не ребёнку: на языке устройства, взрослым шрифтом */}
        <AbaText type={parentTypography.body} color={c.ink} max={1.3} lines={3} style={{ textAlign: 'center' }} testID="aba-from-adult-hint">
          {t('abaSession.fromAdultHint')}
        </AbaText>
      </View>
      {side > 0 && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} testID="aba-from-adult-gift">
          <GiftPicture size={side} ink={ink} />
        </View>
      )}
    </SceneFrame>
  );
}
