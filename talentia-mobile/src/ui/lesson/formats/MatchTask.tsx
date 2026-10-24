/**
 * `match` — соединить пары (SCREENS.md 3.3): верхний ряд — левые стороны в порядке `pairs`, нижний
 * — правые в порядке `step.rightOrder`, желоб 48 под линии пар с гнёздами 24 на обращённых краях.
 * Единое правило составных форматов — в `domain/taskDraft.ts`.
 */
import { View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { useDesign } from '../../../design';
import { badge, lessonLayout } from '../../../design/tokens';
import { emptyMatchDraft, matchAfterNarrowing, matchAnswerOf, matchShown, matchTap, matchWrongOf, type MatchDraft, type MatchSide } from '../../../domain/taskDraft';
import type { MatchTask as MatchTaskType } from '../../../types/task';
import { Icon } from '../../Icon';
import { MediaContent, speaksOnTap } from '../MediaContent';
import type { BadgeKind } from '../Badge';
import { Tile, type TileState } from '../Tile';
import type { FormatProps, FormatSpec, TaskStep } from './types';

const locksOf = (step: TaskStep): Set<string> => new Set([...step.kept, ...(step.pinned ? [step.pinned] : [])]);

function plateState(side: MatchSide, id: string, props: FormatProps<MatchDraft>): TileState {
  const { step, draft, phase, wrong } = props;
  const pairedLeft = side === 'left' ? id : Object.entries(draft.pairs).find(([, r]) => r === id)?.[0];
  if (step.pinned && pairedLeft === step.pinned) return 'pinned';
  if (pairedLeft && step.kept.includes(pairedLeft)) return 'kept';
  switch (phase) {
    case 'locked':
      return pairedLeft && wrong.includes(pairedLeft) ? 'error' : 'locked';
    case 'shownWait':
      return 'shown';
    case 'done':
      return 'correct';
    default:
      if (draft.selected?.side === side && draft.selected.id === id) return 'selected';
      if (draft.selected && draft.selected.side !== side) return 'waiting';
      return 'idle';
  }
}

export function MatchTaskView(rawProps: FormatProps<MatchDraft>) {
  const props = rawProps.draft ? rawProps : { ...rawProps, draft: emptyMatchDraft() };
  const theme = useDesign();
  const task = props.step.task as MatchTaskType;
  const gap = theme.spacing.lg;
  const n = task.pairs.length;
  const tileW = (props.width - gap * (n - 1)) / n;
  const tileH = Math.min(Math.floor((props.height - lessonLayout.matchGutter) / 2) - theme.elevation.raised.offsetY, tileW * 1.4);
  const rightOrder = props.step.rightOrder ?? task.pairs.map((p) => p.id);
  const colX = (i: number) => i * (tileW + gap) + tileW / 2;
  const topY = tileH + theme.elevation.raised.offsetY;
  const bottomY = topY + lessonLayout.matchGutter;
  const maxChars = Math.max(...task.pairs.flatMap((p) => [p.left, p.right]).map((m) => String(m.numeral ?? '').length), 1);
  const shapeOf = (leftId: string): BadgeKind => `pair${task.pairs.findIndex((p) => p.id === leftId) % 4}` as BadgeKind;
  const lineColor = props.phase === 'done' ? theme.colors.success : theme.colors.outline;

  const plate = (side: MatchSide, id: string, i: number) => {
    const media = side === 'left' ? task.pairs.find((p) => p.id === id)!.left : task.pairs.find((p) => p.id === id)!.right;
    const state = plateState(side, id, props);
    const pairedLeft = side === 'left' ? (draftHas(props.draft, id) ? id : null) : Object.entries(props.draft.pairs).find(([, r]) => r === id)?.[0] ?? null;
    const badgeKind = state === 'error' ? 'x' : pairedLeft ? shapeOf(pairedLeft) : null;
    const socket = state === 'waiting' ? (side === 'left' ? 'bottom' : 'top') : null;
    const partner = pairedLeft ? (side === 'left' ? task.pairs.find((p) => p.id === props.draft.pairs[pairedLeft])!.right : task.pairs.find((p) => p.id === pairedLeft)!.left) : null;
    return (
      <Tile
        key={`${side}-${id}`}
        state={state}
        width={tileW}
        height={tileH}
        badge={badgeKind}
        socket={socket}
        listening={props.listening === `${side}:${id}`}
        onPress={() => props.onTap({ kind: 'element', id, side })}
        onPressIn={props.onTouch}
        accessibilityLabel={speaksOnTap(media) ? props.t(media.labelKey) : props.t('a11y.pile', { n: i + 1 })}
        accessibilityValue={partner ? props.t('a11y.pairedWith', { name: props.t(partner.labelKey) }) : undefined}
        testID={`${side}-${id}`}
      >
        <MediaContent media={media} t={props.t} maxChars={maxChars} />
      </Tile>
    );
  };

  return (
    <View style={{ width: props.width, height: props.height, justifyContent: 'center' }} testID="task-match">
      <View style={{ height: bottomY + tileH + theme.elevation.raised.offsetY }}>
        <Svg width={props.width} height={bottomY + tileH} style={{ position: 'absolute' }} pointerEvents="none" testID="pair-lines">
          {Object.entries(props.draft.pairs).map(([l, r]) => {
            const li = task.pairs.findIndex((p) => p.id === l);
            const ri = rightOrder.indexOf(r);
            return <Line key={l} x1={colX(li)} y1={topY} x2={colX(ri)} y2={bottomY} stroke={lineColor} strokeWidth={theme.stroke.base} strokeLinecap="round" />;
          })}
        </Svg>
        <View style={{ flexDirection: 'row', gap }}>{task.pairs.map((p, i) => plate('left', p.id, i))}</View>
        <View style={{ height: lessonLayout.matchGutter }} />
        <View style={{ flexDirection: 'row', gap }}>{rightOrder.map((id, i) => plate('right', id, i))}</View>
        {Object.entries(props.draft.pairs).map(([l, r]) => {
          if (props.phase !== 'done' && l !== props.step.pinned) return null;
          const li = task.pairs.findIndex((p) => p.id === l);
          const ri = rightOrder.indexOf(r);
          const mx = (colX(li) + colX(ri)) / 2;
          const my = (topY + bottomY) / 2;
          return (
            <View key={`mid-${l}`} style={{ position: 'absolute', left: mx - badge.pin / 2, top: my - badge.pin / 2 }} pointerEvents="none" testID={`pair-mid-${l}`}>
              <Icon name={props.phase === 'done' ? 'check' : 'pin'} size={badge.pin} color={props.phase === 'done' ? 'success' : 'outline'} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const draftHas = (draft: MatchDraft, leftId: string) => leftId in draft.pairs;

export const matchSpec: FormatSpec<MatchDraft> = {
  Component: MatchTaskView,
  emptyDraft: () => emptyMatchDraft(),
  tap: (draft, tap, step) => {
    if (tap.kind !== 'element' || !tap.side) return null;
    const r = matchTap(draft, { side: tap.side, id: tap.id }, locksOf(step));
    return r.effect === 'none' ? null : r;
  },
  answerOf: (draft, task) => matchAnswerOf(draft, task as MatchTaskType),
  afterNarrowing: (_draft, _task, step) => matchAfterNarrowing(step.kept, step.pinned),
  shown: (task) => matchShown(task as MatchTaskType),
  wrongOf: (draft) => matchWrongOf(draft),
  correctedOf: (task, step) => (task as MatchTaskType).pairs.map((p) => p.id).filter((id) => !step.kept.includes(id) && id !== step.pinned),
  listeningSequence: (task, step) => {
    const t = task as MatchTaskType;
    const order = step.rightOrder ?? t.pairs.map((p) => p.id);
    return t.pairs.every((p) => p.right.numeral !== undefined && p.right.voice !== 'select') ? order.map((id) => `right:${id}`) : [];
  },
  chooseFirstKey: 'lesson.connectFirst',
};
