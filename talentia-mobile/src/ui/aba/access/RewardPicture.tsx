/**
 * Неподвижный кадр сцены награды — картинка карточки выбора и обмена, а одним цветом (`mono`) — силуэт в полосе
 * «работаю за…» и в кольце доступа (`aba-pedagogy-specialist`, проверка правок 2026-11-12: «картинка = то, что
 * будет в сцене»). Карточки из ассетов (`REWARD_ART`) — главнее, сюда доходят только награды без них; горка — кадр из
 * деталей самой сцены. `null` — для этой награды картинки нет.
 */
import type * as React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { ICONS } from '../../../assets/registry';
import { abaRewardScene } from '../../../design/abaTokens';
import { TaliFigure } from '../../TaliFigure';
import { KaleidoscopePicture } from './KaleidoscopeScene';
import { MarbleRunPicture } from './MarbleRunScene';
import { blob, drop } from './PaintDropScene';

const INK = abaRewardScene.colors;
const Note = ICONS.note;

function BubblesPicture({ size, mono }: { size: number; mono?: string }) {
  const fill = mono ?? INK.lavender;
  const line = mono ?? INK.ink;
  const bubbles = [
    { x: 20, y: 34, r: 14 },
    { x: 38, y: 21, r: 11 },
    { x: 42, y: 42, r: 8 },
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {bubbles.map((b) => (
        <Circle key={`${b.x}`} cx={b.x} cy={b.y} r={b.r} fill={fill} stroke={line} strokeWidth={2} />
      ))}
      {!mono && bubbles.map((b) => <Path key={`s${b.x}`} d={`M${b.x - b.r * 0.55} ${b.y - b.r * 0.1}Q${b.x - b.r * 0.45} ${b.y - b.r * 0.6} ${b.x} ${b.y - b.r * 0.65}`} stroke={INK.white} strokeWidth={2.5} strokeLinecap="round" fill="none" />)}
    </Svg>
  );
}

function PaintPicture({ size, mono }: { size: number; mono?: string }) {
  const s = size;
  return (
    <Svg width={s} height={s}>
      <Path d={drop(s * 0.36)} transform={`translate(${s * 0.32} 0)`} fill={mono ?? INK.violet} stroke={mono ?? INK.ink} strokeWidth={2} />
      <Path d={blob(s * 0.7, 6, 1.7)} transform={`translate(${s * 0.15} ${s * 0.3})`} fill={mono ?? INK.lavender} stroke={mono ?? INK.ink} strokeWidth={2} />
    </Svg>
  );
}

export function rewardPicture(id: string, size: number, label: string, mono?: string): React.JSX.Element | null {
  switch (id) {
    case 'bubbles':
      return <BubblesPicture size={size} mono={mono} />;
    case 'kaleidoscope':
      return <KaleidoscopePicture side={size} mono={mono} />;
    case 'paint_drop':
      return <PaintPicture size={size} mono={mono} />;
    case 'tali_dance':
      // силуэт мелкий — Tali «по пояс», в цвете: одним цветом его не перекрасить
      return <TaliFigure pose="cheer" size={size} crop={!!mono} accessibilityLabel={label} testID={`aba-reward-picture-${id}`} />;
    case 'sing_together':
      // как в сцене: Tali и ноты — иначе карточка не отличается от «Танца Tali» (`aba-pedagogy-specialist`)
      return mono ? (
        <Note width={size} height={size} color={mono} stroke={mono} />
      ) : (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }} testID={`aba-reward-picture-${id}`}>
          <View style={{ position: 'absolute', top: 0, flexDirection: 'row', gap: size * 0.04 }}>
            {[INK.violet, INK.lavender, INK.violet].map((color, i) => (
              <Note key={i} width={size * 0.24} height={size * 0.24} color={color} stroke={INK.ink} />
            ))}
          </View>
          <TaliFigure pose="hello" size={size * 0.74} accessibilityLabel={label} />
        </View>
      );
    case 'marble_run':
      return mono ? null : <MarbleRunPicture size={size} />;
    default:
      return null;
  }
}
