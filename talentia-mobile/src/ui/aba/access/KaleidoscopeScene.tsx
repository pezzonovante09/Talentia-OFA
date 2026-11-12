/**
 * Калейдоскоп (Ц2.9): тап — узор перекладывается в следующую из 8 симметричных раскладок (смена 220 мс), ничего не
 * вращается. Конец — возвращается к раскладке 1. Calm — смена кадром, calm-палитра. Узор — только лепестки и завитки:
 * без кругов, квадратов, треугольников и ромбов, иначе награда — картинки цели «форма» (аудит контента 2026-11-12).
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { abaRewardScene } from '../../../design/abaTokens';
import { SceneFrame, sceneColors, type SceneProps, type SceneSize } from './SceneFrame';

const K = abaRewardScene.kaleidoscope;
const NATIVE = Platform.OS !== 'web';

/** Лепесток-капля от центра вверх: длина `l`, ширина `w`. */
const petal = (l: number, w: number) => `M0 0C${w} ${-l * 0.35} ${w * 0.8} ${-l * 0.85} 0 ${-l}C${-w * 0.8} ${-l * 0.85} ${-w} ${-l * 0.35} 0 0Z`;
/** Завиток: короткая спираль между лепестками. */
const swirl = (r: number) => `M0 ${-r}c${r * 0.5} 0 ${r * 0.6} ${r * 0.6} ${r * 0.1} ${r * 0.8}c${-r * 0.4} ${r * 0.15} ${-r * 0.55} ${-r * 0.25} ${-r * 0.25} ${-r * 0.4}`;

/** Раскладка k: число лепестков, сдвиг внутреннего ряда, чередование цветов, завитки. */
const LAYOUTS = Array.from({ length: K.layouts }, (_, k) => ({
  outer: [6, 8, 10, 12, 8, 6, 12, 10][k],
  inner: [6, 8, 5, 6, 8, 12, 6, 10][k],
  innerTurn: k % 2 === 0 ? 0.5 : 0,
  swap: k % 3 === 1,
  swirls: k % 2 === 1,
}));

function Rosette({ k, side, still, mono }: { k: number; side: number; still: boolean; mono?: string }) {
  const colors = sceneColors(still);
  // силуэт — один цвет, без завитков
  const ink = mono ? { violet: mono, lavender: mono, cream: mono, white: mono, ink: mono } : colors;
  const L = mono ? { ...LAYOUTS[k], swirls: false } : LAYOUTS[k];
  const c = side / 2;
  const R = side * 0.44;
  const [a, b] = L.swap ? [ink.lavender, ink.violet] : [ink.violet, ink.lavender];
  const outer = Array.from({ length: L.outer }, (_, i) => (360 / L.outer) * i);
  const inner = Array.from({ length: L.inner }, (_, i) => (360 / L.inner) * (i + L.innerTurn));
  return (
    <Svg width={side} height={side}>
      <G transform={`translate(${c} ${c})`}>
        {outer.map((deg, i) => (
          <Path key={`o${deg}`} d={petal(R, R * 0.22)} transform={`rotate(${deg})`} fill={i % 2 === 0 ? a : b} stroke={ink.ink} strokeWidth={2} />
        ))}
        {inner.map((deg) => (
          <Path key={`i${deg}`} d={petal(R * 0.5, R * 0.14)} transform={`rotate(${deg})`} fill={ink.cream} stroke={ink.ink} strokeWidth={2} />
        ))}
        {L.swirls &&
          outer.map((deg) => (
            <Path key={`s${deg}`} d={swirl(R * 0.12)} transform={`rotate(${deg + 180 / L.outer}) translate(0 ${-R * 0.72})`} stroke={ink.white} strokeWidth={3} strokeLinecap="round" fill="none" />
          ))}
      </G>
    </Svg>
  );
}

export function KaleidoscopeScene({ ended, still }: SceneProps) {
  const [size, setSize] = useState<SceneSize | null>(null);
  // новый узор проявляется поверх прежнего: без пустого кадра — частые касания не дают мигания (`aba-pedagogy-specialist`)
  const [view, setView] = useState({ under: 0, over: 0 });
  const fade = useRef(new Animated.Value(1)).current;
  // конец — к раскладке 1
  useEffect(() => {
    if (ended) setView({ under: 0, over: 0 });
  }, [ended]);
  const onTap = () => {
    setView((v) => ({ under: v.over, over: (v.over + 1) % K.layouts }));
    if (still) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: K.swapMs, useNativeDriver: NATIVE }).start();
  };
  const side = size ? Math.min(size.w, size.h) * 0.9 : 0;
  const centered = [StyleSheet.absoluteFill, { alignItems: 'center' as const, justifyContent: 'center' as const }];
  return (
    <SceneFrame ended={ended} onTap={onTap} onSize={setSize}>
      {side > 0 && !still && (
        <Animated.View style={centered}>
          <Rosette k={view.under} side={side} still={still} />
        </Animated.View>
      )}
      {side > 0 && (
        <Animated.View style={[...centered, { opacity: still ? 1 : fade }]} testID={`aba-kaleidoscope-${view.over}`}>
          <Rosette k={view.over} side={side} still={still} />
        </Animated.View>
      )}
    </SceneFrame>
  );
}

/** Неподвижный кадр сцены для карточки и силуэта: раскладка 1; `mono` — одним цветом (силуэт 24). */
export function KaleidoscopePicture({ side, mono }: { side: number; mono?: string }) {
  return <Rosette k={0} side={side} still={false} mono={mono} />;
}
