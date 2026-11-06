/**
 * Кучка фигур (SCREENS.md 3.8): раскладка по `countPositions` (= гард `countSilhouette`), фигуры и
 * шаг — токены `countSizes` для стимула (40 / 48) и плитки (24 / 28, поле 80). Корзинка для нуля
 * (`Media.container: 'basket'`, №136) — слой иллюстрации `basketArt`, одинаковый в обеих схемах. В
 * тёмной схеме поле фигур лежит на `picturePlate`.
 *
 * Метки «сосчитано» (`countMark`, №83) — только у стимула: касание ставит точку на ближайшей фигуре
 * в радиусе 32, повтор по отмеченной — рост кольца, мимо — знак промаха; без звука, не ответ.
 */
import { useRef, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useDesign } from '../../design';
import { basketArt, countMark, countSizes } from '../../design/tokens';
import { placeFigures } from '../../domain/countPositions';
import type { Media } from '../../types/task';
import { CountableShape } from './CountableShape';

export type PileProps = {
  media: Media;
  /** Стимул — фигуры 40 с метками; плитка — поле 80 с фигурами 24. */
  variant: 'stimulus' | 'tile';
  /** Касание фигур стимула — сброс таймера напоминания (1.5). */
  onTouch?: () => void;
  /** Сброс меток (ошибка) — меняется извне. */
  marksKey?: number;
  /** Страница атласа: метки «сосчитано» стоят на всех фигурах статично (состояние конца задания), касание их не меняет. */
  markedAll?: boolean;
  testID?: string;
};

type Mark = { index: number; at: number };

export function Pile({ media, variant, onTouch, marksKey = 0, markedAll = false, testID = 'pile' }: PileProps) {
  const theme = useDesign();
  const count = media.count ?? 0;
  const figure = variant === 'stimulus' ? countSizes.figureStimulus : countSizes.tileFigure;
  const step = variant === 'stimulus' ? countSizes.figureStimulus + countSizes.stimulusGap : countSizes.tileStep;
  const placed = placeFigures(media.layout, count, { figure, step });
  const field = variant === 'tile' ? countSizes.tileField : Math.max(placed.width, figure);
  const fieldH = variant === 'tile' ? countSizes.tileField : Math.max(placed.height, figure);
  const pad = media.container === 'basket' ? (variant === 'stimulus' ? basketArt.padInStimulus : 6) : 0;
  const w = field + pad * 2;
  const h = fieldH + pad * 2;
  const offX = (field - placed.width) / 2 + pad;
  const offY = (fieldH - placed.height) / 2 + pad;

  const [marks, setMarks] = useState<Mark[]>([]);
  const [miss, setMiss] = useState<{ x: number; y: number } | null>(null);
  const seenKey = useRef(marksKey);
  if (seenKey.current !== marksKey) {
    seenKey.current = marksKey;
    if (marks.length) setMarks([]);
  }

  const touch = (e: GestureResponderEvent) => {
    onTouch?.();
    if (variant !== 'stimulus' || media.container === 'basket' || markedAll) return;
    const { locationX, locationY } = e.nativeEvent;
    let best = -1;
    let bestD = Infinity;
    placed.points.forEach((p, i) => {
      const d = Math.hypot(p.x + offX - locationX, p.y + offY - locationY);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0 && bestD <= countMark.snapRadius) {
      setMarks((m) => (m.some((x) => x.index === best) ? m.map((x) => (x.index === best ? { ...x, at: Date.now() } : x)) : [...m, { index: best, at: Date.now() }]));
    } else {
      setMiss({ x: locationX, y: locationY });
      setTimeout(() => setMiss(null), 300);
    }
  };

  return (
    <View
      style={{ width: w, height: h, backgroundColor: theme.scheme === 'dark' ? theme.colors.picturePlate : 'transparent', borderRadius: theme.radii.sm, overflow: 'hidden' }}
      onStartShouldSetResponder={() => variant === 'stimulus'}
      onResponderGrant={touch}
      testID={testID}
      accessibilityRole="image"
    >
      {media.container === 'basket' && (
        <Svg width={w} height={h} style={{ position: 'absolute' }} pointerEvents="none" testID={`${testID}-basket`}>
          <Path
            d={`M${pad * 0.4} ${h * 0.35} L${w - pad * 0.4} ${h * 0.35} L${w - pad} ${h - 2} L${pad} ${h - 2} Z`}
            fill={basketArt.fill}
            stroke={basketArt.outline}
            strokeWidth={theme.stroke.base}
            strokeLinejoin="round"
          />
          <Path d={`M${w * 0.3} ${h * 0.35} Q${w / 2} ${h * 0.02} ${w * 0.7} ${h * 0.35}`} fill="none" stroke={basketArt.outline} strokeWidth={theme.stroke.base} strokeLinecap="round" />
        </Svg>
      )}
      {media.shape &&
        placed.points.map((p, i) => (
          <View key={i} style={{ position: 'absolute', left: p.x + offX - figure / 2, top: p.y + offY - figure / 2 }} pointerEvents="none">
            <CountableShape kind={media.shape!} size={figure} />
          </View>
        ))}
      {(markedAll ? placed.points.map((_, index) => ({ index, at: 0 })) : marks).map((m) => {
        const p = placed.points[m.index];
        const fresh = Date.now() - m.at < 300;
        const ring = fresh && marks.length > 0 ? countMark.ring : countMark.ring;
        return (
          <View key={m.index} style={{ position: 'absolute', left: p.x + offX - countMark.dot / 2 - ring, top: p.y + offY - countMark.dot / 2 - ring }} pointerEvents="none" testID={`${testID}-mark-${m.index}`}>
            <Svg width={countMark.dot + ring * 2} height={countMark.dot + ring * 2}>
              <Circle cx={(countMark.dot + ring * 2) / 2} cy={(countMark.dot + ring * 2) / 2} r={countMark.dot / 2 + ring} fill={countMark.ringColor} />
              <Circle cx={(countMark.dot + ring * 2) / 2} cy={(countMark.dot + ring * 2) / 2} r={countMark.dot / 2} fill={countMark.dotColor} />
            </Svg>
          </View>
        );
      })}
      {miss && (
        <View style={{ position: 'absolute', left: miss.x - 32, top: miss.y - 32 }} pointerEvents="none" testID={`${testID}-miss`}>
          <Svg width={64} height={64}>
            <Circle cx={32} cy={32} r={30} fill="none" stroke="#FFFFFF" strokeWidth={7} />
            <Circle cx={32} cy={32} r={30} fill="none" stroke="#6E564A" strokeWidth={3} strokeDasharray="8 6" />
          </Svg>
        </View>
      )}
    </View>
  );
}
