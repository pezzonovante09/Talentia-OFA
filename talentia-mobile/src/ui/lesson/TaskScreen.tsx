/**
 * Каркас фазы задания (SCREENS.md; docs/design/slice-screens-2026-10-24.md §3): панель 64 · 8 · вопрос 72 ·
 * 12 · зона X · 16 · пузырь 80 · 16 · нижняя панель 88 · низ. Общий для урока (`app/lesson/[lessonId]`,
 * где им же рисуется разобранный пример) и сессии повторения (`app/review`). Чистый вид: всё состояние
 * приходит пропсами, механика форматов — `ui/lesson/formats`.
 */
import type { TFunction } from 'i18next';
import { View } from 'react-native';

import type { TaliPose } from '../../assets/registry';
import { useDesign } from '../../design';
import { lessonLayout } from '../../design/tokens';
import { AppText } from '../AppText';
import { ExitLayer } from './ExitLayer';
import { BottomBar, Prompt, TaliBubble, TopBar, type ActionState } from './LessonChrome';
import type { FormatPhase, FormatProps, FormatTap, TaskStep } from './formats/types';

export type TaskScreenFormat = {
  Component: (props: FormatProps<unknown>) => React.JSX.Element;
  step: TaskStep;
  draft: unknown;
  phase: FormatPhase;
  /** Шаг примера `mistake`: элемент со знаком вопроса. */
  question?: string | null;
};

export type TaskScreenProps = {
  regionColor: string;
  insetTop: number;
  bottomInset: number;
  /** Ширина содержимого и высота зоны задания `X`. */
  W: number;
  X: number;
  progress: { segment: number; total: number };
  promptText: string;
  bubbleText: string | null;
  speaking: boolean;
  pose: TaliPose;
  pulse: number;
  action: ActionState;
  replaying: boolean;
  wrong: readonly string[];
  listening: readonly string[];
  marksKey: number;
  /** `null` — формат не поддержан: подпись `lesson.unsupported`. */
  format: TaskScreenFormat | null;
  exitOpen: boolean;
  /** Итог сохранится (сеанс с аккаунтом) — подпись слоя выхода; режим без записи — `false`. */
  persists: boolean;
  onTap: (tap: FormatTap) => void;
  onTouch: () => void;
  onAction: () => void;
  onTali: () => void;
  onExit: () => void;
  onReplay: () => void;
  onLeave: () => void;
  onStay: () => void;
  t: TFunction;
  testID?: string;
};

export function TaskScreen(p: TaskScreenProps) {
  const theme = useDesign();
  const { t } = p;
  const labels = { exit: t('lesson.exit'), replay: t('lesson.replay'), tali: t('a11y.tali'), check: t('lesson.check'), next: t('lesson.next') };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID={p.testID ?? 'lesson-screen'}>
      <View style={{ height: p.insetTop, backgroundColor: p.regionColor }} />
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: p.bottomInset }}>
        <TopBar
          segment={p.progress.segment}
          total={p.progress.total}
          onExit={p.onExit}
          onReplay={p.onReplay}
          replaying={p.replaying}
          labels={{ exit: labels.exit, replay: labels.replay, progress: t('lesson.progress', { n: p.progress.segment + 1, total: p.progress.total }) }}
        />
        <View style={{ height: lessonLayout.gapTopPrompt }} />
        <Prompt text={p.promptText} />
        <View style={{ height: lessonLayout.gapPromptTask }} />
        <View style={{ height: p.X, alignItems: 'center' }} testID="lesson-task-zone">
          {p.format ? (
            <p.format.Component
              step={p.format.step}
              draft={p.format.draft}
              phase={p.format.phase}
              wrong={p.wrong}
              listening={p.listening}
              width={p.W}
              height={p.X}
              onTap={p.onTap}
              onTouch={p.onTouch}
              t={t}
              marksKey={p.marksKey}
              question={p.format.question ?? null}
            />
          ) : (
            <AppText role="body" color="textMuted" align="center">
              {t('lesson.unsupported')}
            </AppText>
          )}
        </View>
        <View style={{ height: lessonLayout.gapTaskHint }} />
        <TaliBubble text={p.bubbleText} speaking={p.speaking} onPress={p.onTali} label={p.bubbleText ?? ''} />
        <View style={{ height: lessonLayout.gapHintBar }} />
        <BottomBar pose={p.pose} onTali={p.onTali} action={p.action} onAction={p.onAction} labels={{ tali: labels.tali, check: labels.check, next: labels.next }} pulse={p.pulse} />
      </View>
      <ExitLayer visible={p.exitOpen} regionColor={p.regionColor} persists={p.persists} onLeave={p.onLeave} onStay={p.onStay} />
    </View>
  );
}
