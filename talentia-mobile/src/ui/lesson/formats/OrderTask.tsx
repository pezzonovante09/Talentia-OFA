/**
 * `order` — по порядку (SCREENS.md 3.4): полоса-стрела 24 с засечками над центрами мест (на 5–6 —
 * без цифр), ряд мест, зазор 24, лоток того же размера. Механика «лоток → место» двумя тапами —
 * `domain/taskDraft.ts`. Предметы — абсолютно позиционированные плитки, перелёт между лотком и
 * местом — `Animated` за `motion.base` (в calm линейно, reduce motion — мгновенно).
 */
import { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { useDesign } from '../../../design';
import { lessonLayout, orderMark } from '../../../design/tokens';
import { emptyOrderDraft, orderAfterNarrowing, orderAnswerOf, orderShown, orderTap, orderWrongOf, slotOf, type OrderDraft } from '../../../domain/taskDraft';
import type { OrderTask as OrderTaskType } from '../../../types/task';
import { MediaContent, speaksOnTap } from '../MediaContent';
import { Tile, type TileState } from '../Tile';
import type { FormatProps, FormatSpec, TaskStep } from './types';

const NATIVE_DRIVER = Platform.OS !== 'web';
const locksOf = (step: TaskStep): Set<string> => new Set([...step.kept, ...(step.pinned ? [step.pinned] : [])]);

function itemState(id: string, props: FormatProps<OrderDraft>): TileState {
  const { step, draft, phase, wrong } = props;
  // Фаза экрана важнее остатка сужения: «верно» и крест видны и у оставшихся / закреплённых.
  switch (phase) {
    case 'done':
      return 'correct';
    case 'locked':
      return wrong.includes(id) ? 'error' : 'locked';
    case 'shownWait':
      return 'shown';
  }
  if (step.pinned === id) return 'pinned';
  if (step.kept.includes(id)) return 'kept';
  return draft.selected === id ? 'selected' : 'idle';
}

function FlyingTile({ to, duration, instant, children }: { to: { x: number; y: number }; duration: number; instant: boolean; children: React.ReactNode }) {
  const pos = useRef(new Animated.ValueXY(to)).current;
  useEffect(() => {
    if (instant) pos.setValue(to);
    else Animated.timing(pos, { toValue: to, duration, useNativeDriver: NATIVE_DRIVER }).start();
  }, [to.x, to.y, duration, instant, pos, to]);
  return <Animated.View style={{ position: 'absolute', transform: pos.getTranslateTransform() }}>{children}</Animated.View>;
}

export function OrderTaskView(rawProps: FormatProps<OrderDraft>) {
  const task = rawProps.step.task as OrderTaskType;
  const props = rawProps.draft ? rawProps : { ...rawProps, draft: emptyOrderDraft(task) };
  const theme = useDesign();
  const gap = theme.spacing.lg;
  const n = task.items.length;
  const tileW = (props.width - gap * (n - 1)) / n;
  const lift = theme.elevation.raised.offsetY;
  const tileH = Math.min(Math.floor((props.height - orderMark.strip - lessonLayout.trayGap - lift * 2) / 2), tileW * 1.4);
  const colX = (i: number) => i * (tileW + gap);
  const placesY = orderMark.strip;
  const trayY = placesY + tileH + lift + lessonLayout.trayGap;
  const maxChars = Math.max(...task.items.map((m) => String(m.numeral ?? '').length), 1);
  const instant = theme.calmMode;

  return (
    <View style={{ width: props.width, height: props.height, justifyContent: 'center' }} testID="task-order">
      <View style={{ height: trayY + tileH + lift }}>
        <Svg width={props.width} height={orderMark.strip} testID="order-strip" pointerEvents="none">
          <Line x1={colX(0) + tileW / 2} y1={orderMark.lineY} x2={colX(n - 1) + tileW / 2 + orderMark.tailPastLast} y2={orderMark.lineY} stroke={theme.colors.outline} strokeWidth={theme.stroke.base} strokeLinecap="round" />
          <Path
            d={`M${colX(n - 1) + tileW / 2 + orderMark.tailPastLast - orderMark.arrowHead} ${orderMark.lineY - orderMark.arrowHead / 2} l${orderMark.arrowHead} ${orderMark.arrowHead / 2} l-${orderMark.arrowHead} ${orderMark.arrowHead / 2}`}
            fill="none"
            stroke={theme.colors.outline}
            strokeWidth={theme.stroke.base}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {task.items.map((_, i) => (
            <Line key={i} x1={colX(i) + tileW / 2} y1={orderMark.lineY} x2={colX(i) + tileW / 2} y2={orderMark.lineY + orderMark.tick.length} stroke={theme.colors.outline} strokeWidth={theme.stroke.base} strokeLinecap="round" />
          ))}
        </Svg>

        {/* Места */}
        {task.items.map((_, i) => {
          const occupant = props.draft.slots[i];
          const state: TileState = occupant ? 'place' : props.draft.selected ? 'placeWaiting' : 'place';
          return (
            <View key={`place-${i}`} style={{ position: 'absolute', left: colX(i), top: placesY }}>
              <Tile
                state={state}
                width={tileW}
                height={tileH}
                listening={props.listening === `place:${i}`}
                onPress={() => props.onTap({ kind: 'slot', index: i })}
                onPressIn={props.onTouch}
                accessibilityLabel={props.t(i === 0 ? 'a11y.placeStart' : i === n - 1 ? 'a11y.placeEnd' : 'a11y.placeMiddle')}
                testID={`place-${i}`}
              />
            </View>
          );
        })}

        {/* Тени в лотке */}
        {task.items.map((item, i) => {
          const placed = slotOf(props.draft, item.id) >= 0;
          const state: TileState = !placed ? 'place' : props.draft.selected === item.id ? 'placeWaiting' : 'shadow';
          return (
            <View key={`shadow-${item.id}`} style={{ position: 'absolute', left: colX(i), top: trayY, opacity: placed ? 1 : 0 }} pointerEvents={placed ? 'auto' : 'none'}>
              <Tile state={state} width={tileW} height={tileH} onPress={() => props.onTap({ kind: 'tray', id: item.id })} onPressIn={props.onTouch} accessibilityLabel={props.t(item.labelKey)} testID={`shadow-${item.id}`} />
            </View>
          );
        })}

        {/* Предметы: в лотке или на месте, перелёт анимацией */}
        {task.items.map((item, i) => {
          const at = slotOf(props.draft, item.id);
          const to = at >= 0 ? { x: colX(at), y: placesY } : { x: colX(i), y: trayY };
          const state = itemState(item.id, props);
          const badgeKind = state === 'correct' ? 'check' : state === 'error' ? 'x' : null;
          return (
            <FlyingTile key={item.id} to={to} duration={theme.motion.base} instant={instant}>
              <Tile
                state={state}
                width={tileW}
                height={tileH}
                badge={badgeKind}
                onPress={() => props.onTap(at >= 0 ? { kind: 'slot', index: at } : { kind: 'tray', id: item.id })}
                onPressIn={props.onTouch}
                accessibilityLabel={speaksOnTap(item) ? props.t(item.labelKey) : props.t('a11y.pile', { n: i + 1 })}
                testID={`item-${item.id}`}
              >
                <MediaContent media={item} t={props.t} maxChars={maxChars} />
              </Tile>
            </FlyingTile>
          );
        })}
      </View>
    </View>
  );
}

export const orderSpec: FormatSpec<OrderDraft> = {
  Component: OrderTaskView,
  emptyDraft: (task) => emptyOrderDraft(task as OrderTaskType),
  tap: (draft, tap, step) => {
    if (tap.kind === 'element') return null;
    const r = orderTap(draft, tap, locksOf(step));
    return r.effect === 'none' ? null : r;
  },
  answerOf: (draft) => orderAnswerOf(draft),
  afterNarrowing: (_draft, task, step) => orderAfterNarrowing(task as OrderTaskType, step.kept, step.pinned),
  shown: (task) => orderShown(task as OrderTaskType),
  wrongOf: (draft, task) => orderWrongOf(draft, task as OrderTaskType),
  correctedOf: (task, step) => (task as OrderTaskType).items.map((i) => i.id).filter((id) => !step.kept.includes(id) && id !== step.pinned),
  listeningSequence: () => ['place:0'],
  chooseFirstKey: 'lesson.arrangeFirst',
};
