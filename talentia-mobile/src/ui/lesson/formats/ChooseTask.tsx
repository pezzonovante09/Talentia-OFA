/**
 * `choose` — выбрать один (SCREENS.md 3.1, 3.8 «кучка → число»). Со стимулом: карточка стимула
 * сверху (не нажимается у счёта), варианты в ряд через 16. Без стимула: 2 — 1×2, 3 — 2 сверху + 1.
 */
import { View } from 'react-native';

import { useDesign } from '../../../design';
import { chooseAnswerOf, chooseCorrectId, chooseTap, emptyChooseDraft, type ChooseDraft } from '../../../domain/taskDraft';
import type { ChooseTask as ChooseTaskType } from '../../../types/task';
import { MediaContent } from '../MediaContent';
import { Pile } from '../Pile';
import { Tile, type TileState } from '../Tile';
import type { FormatProps, FormatSpec, TaskStep } from './types';

function optionState(id: string, props: FormatProps<ChooseDraft>, correct: string): TileState {
  const { step, draft, phase, wrong } = props;
  // Крест на время блокировки — раньше «снят»: оркестратор снимает вариант сразу по ответу.
  if (phase === 'locked' && wrong.includes(id)) return 'error';
  if (step.removed.includes(id)) return 'removed';
  switch (phase) {
    case 'locked':
      return 'locked';
    case 'shownWait':
      return id === correct ? 'shown' : 'removed';
    case 'done':
      if (step.attempt === 'shown') return id === correct ? 'selected' : 'removed';
      return id === draft.selected ? 'correct' : 'idle';
    default:
      return id === draft.selected ? 'selected' : 'idle';
  }
}

export function ChooseTaskView(rawProps: FormatProps<ChooseDraft>) {
  const props = rawProps.draft ? rawProps : { ...rawProps, draft: emptyChooseDraft() };
  const theme = useDesign();
  const task = props.step.task as ChooseTaskType;
  const gap = theme.spacing.lg;
  const correct = chooseCorrectId(task);
  const maxChars = Math.max(...task.options.map((o) => String(o.numeral ?? '').length), 1);
  const options = task.options;
  const withStimulus = !!task.stimulus;
  const cols = withStimulus ? options.length : Math.min(2, options.length);
  const tileW = (props.width - gap * (cols - 1)) / cols;
  const tileH = withStimulus ? 112 : options.length === 2 ? Math.min(196, props.height) : Math.min(129, (props.height - gap) / 2);
  const stimulusH = withStimulus ? props.height - gap - tileH - theme.elevation.raised.offsetY : 0;

  const renderOption = (o: ChooseTaskType['options'][number], i: number) => {
    const state = optionState(o.id, props, correct);
    const badge = state === 'correct' ? 'check' : state === 'error' ? 'x' : null;
    const silentPile = o.count !== undefined;
    return (
      <Tile
        key={o.id}
        state={state}
        width={tileW}
        height={tileH}
        badge={badge}
        listening={props.listening.includes(o.id)}
        onPress={() => props.onTap({ kind: 'element', id: o.id })}
        onPressIn={props.onTouch}
        accessibilityLabel={silentPile || o.voice === 'select' ? props.t('a11y.option', { n: i + 1 }) : props.t(o.labelKey)}
        testID={`option-${o.id}`}
      >
        <MediaContent media={o} t={props.t} maxChars={maxChars} />
      </Tile>
    );
  };

  return (
    <View style={{ width: props.width, height: props.height, justifyContent: 'center' }} testID="task-choose">
      {task.stimulus && (
        <View
          style={{
            width: props.width,
            height: stimulusH,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.surface,
            borderWidth: theme.stroke.base,
            borderColor: theme.colors.outline,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: gap,
          }}
          accessibilityRole="image"
          accessibilityLabel={props.t(task.stimulus.labelKey)}
          testID="stimulus"
        >
          <Pile media={task.stimulus} variant="stimulus" onTouch={props.onTouch} marksKey={props.marksKey} testID="stimulus-pile" />
        </View>
      )}
      {withStimulus || options.length === 2 ? (
        <View style={{ flexDirection: 'row', gap }}>{options.map(renderOption)}</View>
      ) : (
        <View style={{ gap }}>
          <View style={{ flexDirection: 'row', gap }}>{options.slice(0, 2).map(renderOption)}</View>
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>{options.slice(2).map((o) => renderOption(o, 2))}</View>
        </View>
      )}
    </View>
  );
}

export const chooseSpec: FormatSpec<ChooseDraft> = {
  Component: ChooseTaskView,
  emptyDraft: () => emptyChooseDraft(),
  tap: (draft, tap, step) => {
    if (tap.kind !== 'element') return null;
    const r = chooseTap(draft, tap.id, step.removed);
    return r.effect === 'none' ? null : r;
  },
  answerOf: (draft) => chooseAnswerOf(draft),
  afterNarrowing: () => emptyChooseDraft(),
  shown: () => emptyChooseDraft(),
  wrongOf: (draft, task) => (draft.selected && draft.selected !== chooseCorrectId(task as ChooseTaskType) ? [draft.selected] : []),
  correctedOf: (task) => [chooseCorrectId(task as ChooseTaskType)],
  correctedCues: (task) => [chooseCorrectId(task as ChooseTaskType)],
  listeningSequence: (task) => {
    const t = task as ChooseTaskType;
    // Карточки-числа навыка счёта перечисляются; немые карточки (`voice: 'select'`) — нет (3.8.1).
    return t.options.every((o) => o.numeral !== undefined && o.voice !== 'select') ? t.options.map((o) => o.id) : [];
  },
  chooseFirstKey: 'lesson.chooseFirst',
};

export const chooseStepIsSilent = (step: TaskStep) => (step.task as ChooseTaskType).options.some((o) => o.voice === 'select');
