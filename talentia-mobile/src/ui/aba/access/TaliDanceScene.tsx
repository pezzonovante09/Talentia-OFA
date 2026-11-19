/**
 * Танец Tali (Ц2.9): тап — следующее из трёх движений, держится 600 мс, затем `idle`; тап во время движения — сразу
 * следующее; без тапов Tali стоит. Конец — Tali в `idle`. Calm — 1200 мс, только две позы, без движения.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';

import type { TaliPose } from '../../../assets/registry';
import { abaRewardScene } from '../../../design/abaTokens';
import { TaliFigure } from '../../TaliFigure';
import { SceneFrame, type SceneProps, type SceneSize } from './SceneFrame';

const K = abaRewardScene.taliDance;
const NATIVE = Platform.OS !== 'web';

type Move = { pose: TaliPose; kind: 'hop' | 'sway' | 'bounce' | 'none' };
const MOVES: readonly Move[] = [
  { pose: 'cheer', kind: 'hop' },
  { pose: 'hello', kind: 'sway' },
  { pose: 'found', kind: 'bounce' },
];
const CALM_MOVES: readonly Move[] = [
  { pose: 'cheer', kind: 'none' },
  { pose: 'hello', kind: 'none' },
];

export function TaliDanceScene({ ended, still }: SceneProps) {
  const { t } = useTranslation();
  const moves = still ? CALM_MOVES : MOVES;
  const hold = still ? K.calmHoldMs : K.holdMs;
  const [size, setSize] = useState<SceneSize | null>(null);
  const [move, setMove] = useState(-1);
  const next = useRef(0);
  const p = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  // конец — Tali в `idle`
  useEffect(() => {
    if (!ended) return;
    if (timer.current) clearTimeout(timer.current);
    setMove(-1);
  }, [ended]);

  const onTap = () => {
    const i = next.current % moves.length;
    next.current += 1;
    setMove(i);
    if (!still) {
      p.setValue(0);
      Animated.timing(p, { toValue: 1, duration: hold, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE }).start();
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMove(-1), hold);
  };

  const m = move >= 0 ? moves[move] : null;
  // туда и обратно за время движения
  const there = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 0] });
  const transform =
    m?.kind === 'hop'
      ? [{ translateY: there.interpolate({ inputRange: [0, 1], outputRange: [0, -K.hop] }) }]
      : m?.kind === 'sway'
        ? [{ rotate: p.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: ['0deg', `${K.swayDeg}deg`, `${-K.swayDeg}deg`, '0deg'] }) }]
        : m?.kind === 'bounce'
          ? [{ scale: there.interpolate({ inputRange: [0, 1], outputRange: [1, K.bounce] }) }]
          : [];
  const side = size ? Math.min(size.w, size.h) * K.share : 0;
  return (
    <SceneFrame ended={ended} onTap={onTap} onSize={setSize}>
      {side > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Animated.View style={{ transform }}>
            <TaliFigure pose={m?.pose ?? 'idle'} size={side} accessibilityLabel={t('a11y.tali')} testID="aba-tali-dance" />
          </Animated.View>
        </Animated.View>
      )}
    </SceneFrame>
  );
}
