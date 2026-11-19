/**
 * Пузыри (Ц2.9): тап по пузырю (зона 72, рисунок 56) — лопается кольцом 220 мс; тап по пустому — новый пузырь
 * поднимается из точки тапа; на потолке (6) тап по пустому лопает ближайший. Конец — новые не появляются, оставшиеся
 * лопаются по одному. Calm — не больше 3, поднимаются медленнее, лопаются сжатием без кольца.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { abaRewardScene } from '../../../design/abaTokens';
import { SceneFrame, sceneColors, type SceneProps, type SceneSize } from './SceneFrame';

const K = abaRewardScene.bubbles;
const NATIVE = Platform.OS !== 'web';

/** `y` — точка появления; пузырь поднимается на `K.rise` за `riseMs` с момента `born`. */
type Bubble = { id: number; x: number; y: number; born: number; popping: boolean };

/** Где пузырь виден сейчас: подъём с тем же замедлением, что у анимации (`Easing.out(quad)`). */
function visibleY(b: Bubble, now: number, riseMs: number): number {
  const p = Math.min(1, Math.max(0, (now - b.born) / riseMs));
  return b.y - K.rise * (1 - (1 - p) * (1 - p));
}

export function BubblesScene({ ended, still }: SceneProps) {
  const max = still ? K.calmMax : K.max;
  const [size, setSize] = useState<SceneSize | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const nextId = useRef(1);
  const seeded = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bubblesNow = useRef<Bubble[]>([]);
  bubblesNow.current = bubbles;
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const pop = useCallback((id: number) => {
    setBubbles((bs) => bs.map((b) => (b.id === id ? { ...b, popping: true } : b)));
    timers.current.push(setTimeout(() => setBubbles((bs) => bs.filter((b) => b.id !== id)), K.popMs));
  }, []);

  // первые пузыри — чтобы сцена не была пустой
  useEffect(() => {
    if (!size || seeded.current) return;
    seeded.current = true;
    const n = Math.min(K.start, max);
    const born = Date.now();
    setBubbles(Array.from({ length: n }, (_, i) => ({ id: nextId.current++, x: (size.w * (i + 1)) / (n + 1), y: size.h * (0.45 + 0.12 * (i % 2)), born, popping: false })));
  }, [size, max]);

  // конец: новых нет, оставшиеся лопаются по одному
  useEffect(() => {
    if (!ended) return;
    bubblesNow.current
      .filter((b) => !b.popping)
      .forEach((b, i) => timers.current.push(setTimeout(() => pop(b.id), K.tailStepMs * (i + 1))));
  }, [ended, pop]);

  const onTap = (x: number, y: number) => {
    const now = Date.now();
    const riseMs = still ? K.calmRiseMs : K.riseMs;
    const live = bubbles.filter((b) => !b.popping);
    // попадание — по видимому месту пузыря, а не по точке появления (`qa-engineer`): он уже поднялся
    const dist = (b: Bubble) => Math.hypot(b.x - x, visibleY(b, now, riseMs) - y);
    const nearest = [...live].sort((a, b) => dist(a) - dist(b))[0];
    if (nearest && dist(nearest) <= K.hit / 2) return pop(nearest.id);
    if (live.length >= max) return nearest ? pop(nearest.id) : undefined;
    setBubbles((bs) => [...bs, { id: nextId.current++, x, y, born: now, popping: false }]);
  };

  return (
    <SceneFrame ended={ended} onTap={onTap} onSize={setSize}>
      {bubbles.map((b) => (
        <BubbleView key={b.id} bubble={b} still={still} />
      ))}
    </SceneFrame>
  );
}

function BubbleView({ bubble, still }: { bubble: Bubble; still: boolean }) {
  const ink = sceneColors(still);
  const rise = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: still ? K.calmRiseMs : K.riseMs, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }).start();
  }, [rise, still]);
  useEffect(() => {
    if (bubble.popping) Animated.timing(pop, { toValue: 1, duration: K.popMs, useNativeDriver: NATIVE }).start();
  }, [bubble.popping, pop]);
  const s = K.size;
  // кольцо при лопании: пузырь раздувается и тает; calm — сжатие без кольца
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: still ? [1, 0] : [1, 1.6] });
  const opacity = pop.interpolate({ inputRange: [0, 1], outputRange: [1, still ? 1 : 0] });
  const translateY = rise.interpolate({ inputRange: [0, 1], outputRange: [0, -K.rise] });
  return (
    <Animated.View style={{ position: 'absolute', left: bubble.x - s / 2, top: bubble.y - s / 2, width: s, height: s, opacity, transform: [{ translateY }, { scale }] }}>
      <Svg width={s} height={s} viewBox="0 0 56 56">
        <Circle cx={28} cy={28} r={25} fill={bubble.popping && !still ? 'none' : ink.lavender} stroke={ink.ink} strokeWidth={2.5} />
        {!bubble.popping && <Path d="M16 22 Q18 14 26 13" stroke={ink.white} strokeWidth={4} strokeLinecap="round" fill="none" />}
      </Svg>
    </Animated.View>
  );
}
