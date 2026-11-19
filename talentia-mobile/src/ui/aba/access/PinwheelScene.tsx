/**
 * Вертушка (Ц2.9; ассеты партии 1, 2026-11-13): тап — толчок, вертушка делает оборот и замедляется; тап на ходу
 * добавляет оборот (в запасе не больше двух). Конец — доворачивается до остановки, новых толчков нет. Calm — пик
 * ≤ 0.5 об/с. Головка — `REWARD_PARTS.pinwheelHead` (ось в центре кадра), палочка — кодом.
 */
import { useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { REWARD_PARTS } from '../../../assets/registry';
import { abaRewardScene } from '../../../design/abaTokens';
import { SceneFrame, sceneColors, type SceneProps, type SceneSize } from './SceneFrame';

const K = abaRewardScene.pinwheel;
const NATIVE = Platform.OS !== 'web';
const Head = REWARD_PARTS.pinwheelHead;

export function PinwheelScene({ ended, still }: SceneProps) {
  const ink = sceneColors(still);
  const [size, setSize] = useState<SceneSize | null>(null);
  const turns = useRef(new Animated.Value(0)).current;
  const target = useRef(0);
  const onTap = () => {
    // текущее положение — из идущей анимации; запас оборотов ограничен, скорость не растёт без конца
    turns.stopAnimation((now) => {
      const left = Math.min(target.current - now + 1, K.maxTurns);
      target.current = now + left;
      Animated.timing(turns, {
        toValue: target.current,
        duration: (still ? K.calmTurnMs : K.turnMs) * left,
        easing: Easing.out(Easing.sin),
        useNativeDriver: NATIVE,
      }).start();
    });
  };
  const side = size ? Math.min(size.w, size.h) * K.share : 0;
  const rotate = turns.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const stickW = side * K.stick;
  return (
    <SceneFrame ended={ended} onTap={onTap} onSize={setSize}>
      {side > 0 && (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ width: side, height: side * 1.45 }}>
            {/* палочка от оси вниз */}
            <View style={{ position: 'absolute', left: side / 2 - stickW / 2, top: side / 2, width: stickW, height: side * 0.95, backgroundColor: ink.cream, borderColor: ink.ink, borderWidth: 2, borderRadius: stickW / 2 }} />
            <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: side, height: side, transform: [{ rotate }] }} testID="aba-pinwheel-head">
              <Head width={side} height={side} />
            </Animated.View>
          </View>
        </View>
      )}
    </SceneFrame>
  );
}
