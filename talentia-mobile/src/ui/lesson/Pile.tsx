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
  /** Знак промаха держится до отпускания пальца + `missRing.tailMs` (`shownUntil: 'touch_up'`): под пальцем его не видно. */
  const [miss, setMiss] = useState<{ x: number; y: number; until: number | null } | null>(null);
  const missTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Повторное касание уже сосчитанной фигуры: кольцо метки растёт до `repeatRing.to` и держится до отпускания
   * пальца + `tailMs` (контрольный аудит 2026-11-09, Ж9: раньше обе ветки давали кольцо 2, и ребёнок не видел,
   * что фигура уже сосчитана). `until === null` — палец ещё на фигуре.
   */
  const [peak, setPeak] = useState<{ index: number; until: number | null } | null>(null);
  const peakTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      const repeated = marks.some((x) => x.index === best);
      setMarks((m) => (m.some((x) => x.index === best) ? m.map((x) => (x.index === best ? { ...x, at: Date.now() } : x)) : [...m, { index: best, at: Date.now() }]));
      if (repeated) {
        if (peakTimer.current) clearTimeout(peakTimer.current);
        setPeak({ index: best, until: null });
      }
    } else {
      if (missTimer.current) clearTimeout(missTimer.current);
      setMiss({ x: locationX, y: locationY, until: null });
    }
  };

  /** Отпустили палец: выросшее кольцо и знак промаха держатся ещё `tailMs`, потом снимаются. */
  const release = () => {
    if (peak && peak.until === null) {
      setPeak({ ...peak, until: Date.now() + countMark.repeatRing.tailMs });
      peakTimer.current = setTimeout(() => setPeak(null), countMark.repeatRing.tailMs);
    }
    if (miss && miss.until === null) {
      setMiss({ ...miss, until: Date.now() + countMark.missRing.tailMs });
      missTimer.current = setTimeout(() => setMiss(null), countMark.missRing.tailMs);
    }
  };

  return (
    <View
      style={{ width: w, height: h, backgroundColor: theme.scheme === 'dark' ? theme.colors.picturePlate : 'transparent', borderRadius: theme.radii.sm, overflow: 'hidden' }}
      onStartShouldSetResponder={() => variant === 'stimulus'}
      onResponderGrant={touch}
      onResponderRelease={release}
      onResponderTerminate={release}
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
        const peaked = !markedAll && peak !== null && peak.index === m.index;
        const ring = peaked ? countMark.repeatRing.to : countMark.ring;
        // на пике кольцо обводит контур `peakOutline`: белое кольцо на белой или жёлтой фигуре иначе не видно
        const outline = peaked ? countMark.repeatRing.peakOutline.width : 0;
        const size = countMark.dot + ring * 2 + outline * 2;
        const c = size / 2;
        return (
          <View key={m.index} style={{ position: 'absolute', left: p.x + offX - c, top: p.y + offY - c }} pointerEvents="none" testID={`${testID}-mark-${m.index}${peaked ? '-peak' : ''}`}>
            <Svg width={size} height={size}>
              {peaked && <Circle cx={c} cy={c} r={countMark.dot / 2 + ring + outline / 2} fill="none" stroke={countMark.repeatRing.peakOutline.color} strokeWidth={outline} />}
              <Circle cx={c} cy={c} r={countMark.dot / 2 + ring} fill={countMark.ringColor} />
              <Circle cx={c} cy={c} r={countMark.dot / 2} fill={countMark.dotColor} />
            </Svg>
          </View>
        );
      })}
      {miss && (
        // знак промаха — из токена `missRing`, не литералами (аудит 2026-11-09, `design-lead` п. 5)
        <View style={{ position: 'absolute', left: miss.x - countMark.missRing.size / 2, top: miss.y - countMark.missRing.size / 2 }} pointerEvents="none" testID={`${testID}-miss`}>
          <Svg width={countMark.missRing.size} height={countMark.missRing.size}>
            <Circle cx={countMark.missRing.size / 2} cy={countMark.missRing.size / 2} r={countMark.missRing.size / 2 - countMark.missRing.stroke / 2 - countMark.missRing.halo.pad} fill="none" stroke={countMark.missRing.halo.color} strokeWidth={countMark.missRing.stroke + countMark.missRing.halo.pad * 2} />
            <Circle cx={countMark.missRing.size / 2} cy={countMark.missRing.size / 2} r={countMark.missRing.size / 2 - countMark.missRing.stroke / 2 - countMark.missRing.halo.pad} fill="none" stroke={countMark.missRing.color} strokeWidth={countMark.missRing.stroke} strokeDasharray={`${countMark.missRing.dash} ${countMark.missRing.gap}`} />
          </Svg>
        </View>
      )}
    </View>
  );
}
