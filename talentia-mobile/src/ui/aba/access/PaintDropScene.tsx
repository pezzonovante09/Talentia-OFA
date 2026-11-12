/**
 * Капля краски (правка 2, 2026-11-12; в Ц2.9 не было — по аудиту контента): тап роняет каплю, она падает 300 мс и
 * растекается волнистым пятном там, где коснулись; пятна копятся, на поле не больше 14 — старое уходит. Конец — новых
 * капель нет, падающая докатывается. Calm — пятно появляется сразу, без падения. Пятно и капля — не круги и не цвета
 * целей: волнистая клякса фиолетовой семьи.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { abaRewardScene } from '../../../design/abaTokens';
import { SceneFrame, sceneColors, type SceneProps } from './SceneFrame';

const K = abaRewardScene.paintDrop;
const NATIVE = Platform.OS !== 'web';

type Spot = { id: number; x: number; y: number; tone: 'violet' | 'lavender'; lobes: number; turn: number };

/** Волнистая клякса в квадрате `s`: радиус колеблется по `lobes` волнам — не круг; гребни волн не выходят за квадрат. */
export function blob(s: number, lobes: number, turn: number): string {
  const n = 48;
  const c = s / 2;
  const r = (c - 2) / 1.16;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 + 0.16 * Math.sin(lobes * a + turn));
    return `${(c + rr * Math.cos(a)).toFixed(1)} ${(c + rr * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join('L')}Z`;
}
/** Капля-слеза остриём вверх в квадрате `s`. */
export const drop = (s: number) => `M${s / 2} 0C${s * 0.62} ${s * 0.3} ${s * 0.85} ${s * 0.5} ${s * 0.85} ${s * 0.68}A${s * 0.35} ${s * 0.32} 0 0 1 ${s * 0.15} ${s * 0.68}C${s * 0.15} ${s * 0.5} ${s * 0.38} ${s * 0.3} ${s / 2} 0Z`;

export function PaintDropScene({ ended, still }: SceneProps) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const nextId = useRef(1);
  const onTap = (x: number, y: number) => {
    const id = nextId.current++;
    setSpots((ss) => [...ss.slice(-(K.max - 1)), { id, x, y, tone: id % 2 === 0 ? 'lavender' : 'violet', lobes: 5 + (id % 3), turn: id * 1.7 }]);
  };
  return (
    <SceneFrame ended={ended} onTap={onTap}>
      {spots.map((s) => (
        <SpotView key={s.id} spot={s} still={still} />
      ))}
    </SceneFrame>
  );
}

function SpotView({ spot, still }: { spot: Spot; still: boolean }) {
  const ink = sceneColors(still);
  const fall = useRef(new Animated.Value(still ? 1 : 0)).current;
  const spread = useRef(new Animated.Value(still ? 1 : 0)).current;
  const [landed, setLanded] = useState(still);
  useEffect(() => {
    if (still) return;
    Animated.timing(fall, { toValue: 1, duration: K.fallMs, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }).start(({ finished }) => {
      // каплю сняли посреди падения (лимит пятен, конец сцены) — растекаться нечему
      if (!finished) return;
      setLanded(true);
      Animated.timing(spread, { toValue: 1, duration: K.spreadMs, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
    });
  }, [fall, spread, still]);
  const s = K.size;
  const fill = ink[spot.tone];
  // капля видна сразу, невысоко над пальцем: первый кадр отклика ≤ 100 мс (Ц2.8), а не разгон из-за края сцены
  const dropY = fall.interpolate({ inputRange: [0, 1], outputRange: [-Math.min(spot.y, K.dropFrom), 0] });
  const scale = spread.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  return landed ? (
    <Animated.View style={{ position: 'absolute', left: spot.x - s / 2, top: spot.y - s / 2, width: s, height: s, transform: [{ scale }] }}>
      <Svg width={s} height={s}>
        <Path d={blob(s, spot.lobes, spot.turn)} fill={fill} stroke={ink.ink} strokeWidth={2} />
      </Svg>
    </Animated.View>
  ) : (
    <Animated.View style={{ position: 'absolute', left: spot.x - s / 4, top: spot.y - s / 2, width: s / 2, height: s / 2, transform: [{ translateY: dropY }] }}>
      <Svg width={s / 2} height={s / 2}>
        <Path d={drop(s / 2)} fill={fill} stroke={ink.ink} strokeWidth={2} />
      </Svg>
    </Animated.View>
  );
}
