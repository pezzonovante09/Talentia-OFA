/**
 * Лента карты: тропа, узлы, хвост-пунктир со знаком «?» и Tali у узла-указателя. Горизонтальное
 * панорамирование — Pan с порогом `mapLane.panThreshold` (до него касание — тап); без инерции, поэтому
 * «касание во время прокрутки» — это касание во время жеста. Автоцентровка на узле-указателе при каждом
 * появлении экрана: перелёт `motion.slow`, в calm и reduce motion — мгновенно. Анимация — RN `Animated`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';

import { useDesign } from '../../design';
import { mapLane, mapLayout, mapNodeState, taliSize } from '../../design/tokens';
import { centerOffset, clampOffset, laneWidth, nodeCenter, taliAnchor, visibleLaneItems, type LaneGeometry, type LaneItem } from '../../domain/mapLane';
import type { MapModel } from '../../state/mapModel';
import { TaliFigure } from '../TaliFigure';
import { MapNode } from './MapNode';

const NATIVE_DRIVER = Platform.OS !== 'web';

export type MapLaneProps = {
  model: MapModel;
  height: number;
  /** Ключ, по которому лента заново центруется (смена фокуса экрана). */
  focusKey: number;
  reduceMotion: boolean;
  onOpenLesson: (lessonId: string) => void;
  /** Активный узел «повторение» — сессия повторения (вопрос 56). */
  onOpenReview: () => void;
  onVoice: (key: string) => void;
  onTali: () => void;
  taliLabel: string;
};

export const LANE_GEOMETRY: LaneGeometry = {
  node: mapLayout.node,
  step: mapLayout.nodeGapMin + 16,
  inset: 24,
  wave: 16,
  tail: 96,
};

export function MapLane({ model, height, focusKey, reduceMotion, onOpenLesson, onOpenReview, onVoice, onTali, taliLabel }: MapLaneProps) {
  const theme = useDesign();
  const [viewport, setViewport] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  const offsetValue = useRef(0);
  const startOffset = useRef(0);
  const panning = useRef(false);

  const pointerIndex = model.pointer === 'review' ? 0 : model.pointer === null ? null : model.pointer + 1;
  const items = useMemo<LaneItem[]>(
    () =>
      visibleLaneItems(model.states, {
        visibleAhead: mapNodeState.visibleAhead,
        focus: theme.focusMode,
        pointer: model.pointer === 'review' || model.pointer === null ? null : model.pointer,
      }),
    [model.states, model.pointer, theme.focusMode],
  );
  const g = LANE_GEOMETRY;
  const baseY = Math.round(height * 0.55);
  const contentWidth = laneWidth(items, g);
  // Порция потрачена и повторять нечего (`pointer === null`): Tali не исчезает с карты, а стоит у
  // последнего пройденного узла и ни на что не указывает — «на сегодня всё» (разбор 2026-10-31, вопрос 72).
  const restIndex = useMemo(() => {
    const done = items.filter((i): i is Extract<LaneItem, { kind: 'lesson' }> => i.kind === 'lesson' && (i.state === 'done' || i.state === 'explored'));
    return done.length ? done[done.length - 1].index : 0;
  }, [items]);
  const taliIndex = pointerIndex ?? restIndex;

  useEffect(() => {
    offset.addListener(({ value }) => {
      offsetValue.current = value;
    });
    return () => offset.removeAllListeners();
  }, [offset]);

  // Автоцентровка при каждом появлении экрана и при смене указателя.
  useEffect(() => {
    if (!viewport) return;
    const target = nodeCenter(taliIndex, baseY, g).x;
    const to = centerOffset(contentWidth, viewport, target);
    if (reduceMotion || theme.calmMode) offset.setValue(to);
    else Animated.timing(offset, { toValue: to, duration: theme.motion.slow, useNativeDriver: NATIVE_DRIVER }).start();
  }, [focusKey, viewport, taliIndex, contentWidth, baseY, g, offset, reduceMotion, theme.calmMode, theme.motion.slow]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-mapLane.panThreshold, mapLane.panThreshold])
        .failOffsetY([-mapLane.panThreshold, mapLane.panThreshold])
        .onStart(() => {
          panning.current = true;
          startOffset.current = offsetValue.current;
        })
        .onUpdate((e) => {
          offset.setValue(clampOffset(startOffset.current + e.translationX, contentWidth, viewport));
        })
        .onFinalize(() => {
          // Отпускание после прокрутки не должно открыть узел под пальцем: снимаем флаг следующим тиком.
          setTimeout(() => {
            panning.current = false;
          }, 0);
        }),
    [contentWidth, viewport, offset],
  );

  const trail = items.filter((i) => i.kind !== 'tail').map((i) => nodeCenter(i.index, baseY, g));
  const tail = items.find((i) => i.kind === 'tail');
  const tailFrom = trail[trail.length - 1];
  const tailTo = tail && tailFrom ? { x: tailFrom.x + g.node / 2 + g.tail, y: tailFrom.y } : null;
  const taliAt = taliAnchor(nodeCenter(taliIndex, baseY, g), { nodeSize: g.node, tali: taliSize.map, gap: mapLane.taliNodeGap });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ height, overflow: 'hidden' }} onLayout={(e: LayoutChangeEvent) => setViewport(e.nativeEvent.layout.width)} testID="map-lane">
        <Animated.View style={{ width: contentWidth, height, transform: [{ translateX: offset }] }}>
          <Svg width={contentWidth} height={height} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
            {trail.length > 1 && (
              <Polyline points={trail.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={theme.colors.outline} strokeWidth={mapLayout.trailStroke} strokeLinecap="round" strokeLinejoin="round" />
            )}
            {tailTo && tailFrom && (
              <>
                <Line x1={tailFrom.x} y1={tailFrom.y} x2={tailTo.x - 20} y2={tailTo.y} stroke={theme.colors.textMuted} strokeWidth={mapLayout.trailStroke} strokeDasharray="6 8" strokeLinecap="round" />
                <SvgText x={tailTo.x} y={tailTo.y + 11} fontSize={32} fontWeight="700" fill={theme.colors.textMuted} textAnchor="middle">
                  ?
                </SvgText>
              </>
            )}
          </Svg>

          {items.map((item) => {
            if (item.kind === 'tail') return null;
            const c = nodeCenter(item.index, baseY, g);
            const node =
              item.kind === 'review'
                ? ({ kind: 'review', review: model.review, voice: model.reviewVoice } as const)
                : ({ kind: 'lesson', state: item.state, unavailable: model.unavailable.has(model.lessons[item.lesson].id), number: item.lesson + 1 } as const);
            const lessonId = item.kind === 'lesson' ? model.lessons[item.lesson].id : null;
            return (
              <View key={item.index} style={{ position: 'absolute', left: c.x - g.node / 2, top: c.y - g.node / 2 }}>
                <MapNode
                  node={node}
                  onOpen={lessonId && (item.kind === 'lesson' && (item.state === 'open' || item.state === 'done' || item.state === 'explored')) ? () => onOpenLesson(lessonId) : item.kind === 'review' && model.review === 'active' ? onOpenReview : undefined}
                  onVoice={onVoice}
                  panning={() => panning.current}
                  testID={item.kind === 'review' ? 'map-node-review' : `map-node-${item.lesson + 1}`}
                />
              </View>
            );
          })}

          <View style={{ position: 'absolute', left: Math.max(0, taliAt.x), top: taliAt.y }} testID="map-tali-slot">
            <TaliFigure pose={pointerIndex === null ? 'idle' : 'point'} size={taliSize.map} onPress={onTali} accessibilityLabel={taliLabel} testID="map-tali" />
          </View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
