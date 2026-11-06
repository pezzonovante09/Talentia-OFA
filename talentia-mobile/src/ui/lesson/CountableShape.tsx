/**
 * Фигуры счёта (SCREENS.md 3.8, `Media.shape`): камень, ягода, лист, точка кубика. Слой иллюстрации
 * с фиксированными цветами (`taliArt.outline` контур): фигуры не перекрашиваются темой, в тёмной
 * схеме лежат на `picturePlate`. Камень — неправильный силуэт с бликом не-кругом (метка «сосчитано»
 * не сливается), точка кубика — одна плоская круглая форма.
 */
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import { taliArt } from '../../design/tokens';
import type { Media } from '../../types/task';

export type ShapeKind = NonNullable<Media['shape']>;

export const SHAPE_FILL: Record<ShapeKind, string> = {
  stone: '#B9A48A',
  berry: '#D93A1E',
  leaf: '#3FC08A',
  dot: '#2A1A12',
};

export function CountableShape({ kind, size }: { kind: ShapeKind; size: number }) {
  const o = taliArt.outline;
  const sw = 2.5;
  switch (kind) {
    case 'stone':
      return (
        <Svg width={size} height={size} viewBox="0 0 40 40">
          <Path d="M6 24c-1-7 5-16 15-17 9-1 15 6 14 14-1 7-7 12-15 12S7 30 6 24Z" fill={SHAPE_FILL.stone} stroke={o} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M13 15c3-3 7-4 11-3" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" fill="none" />
        </Svg>
      );
    case 'berry':
      return (
        <Svg width={size} height={size} viewBox="0 0 40 40">
          <Circle cx="20" cy="23" r="13" fill={SHAPE_FILL.berry} stroke={o} strokeWidth={sw} />
          <Path d="M20 10c0-4 3-6 6-6" stroke={o} strokeWidth={sw} strokeLinecap="round" fill="none" />
          <Ellipse cx="15" cy="18" rx="3" ry="2" fill="#FFFFFF" transform="rotate(-30 15 18)" />
        </Svg>
      );
    case 'leaf':
      return (
        <Svg width={size} height={size} viewBox="0 0 40 40">
          <Path d="M7 33C7 18 18 7 34 7c0 16-11 27-27 26Z" fill={SHAPE_FILL.leaf} stroke={o} strokeWidth={sw} strokeLinejoin="round" />
          <Path d="M10 30 29 11" stroke={o} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      );
    case 'dot':
      return (
        <Svg width={size} height={size} viewBox="0 0 40 40">
          <Circle cx="20" cy="20" r="14" fill={SHAPE_FILL.dot} />
        </Svg>
      );
  }
}
