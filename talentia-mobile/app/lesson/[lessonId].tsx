/**
 * Экран урока (SCREENS.md; docs/design/slice-screens-2026-10-24.md §3). Каркас не прокручивается:
 * safe area регион · панель 64 · 8 · вопрос 72 · 12 · зона X · 16 · пузырь 80 · 16 · нижняя панель 88 ·
 * низ. Экран рисует `LessonStep` оркестратора; механика форматов — `ui/lesson/formats`.
 */
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDesign } from '../../src/design';
import { lessonLayout } from '../../src/design/tokens';
import { randomSeed } from '../../src/services/random';
import { completedLessons, useChildSession } from '../../src/state/childSession';
import { AppText } from '../../src/ui/AppText';
import { ExitLayer } from '../../src/ui/lesson/ExitLayer';
import { HookScreen } from '../../src/ui/lesson/HookScreen';
import { BottomBar, Prompt, TaliBubble, TopBar } from '../../src/ui/lesson/LessonChrome';
import { FORMATS } from '../../src/ui/lesson/formats';
import { useLessonController } from '../../src/ui/lesson/useLessonController';
import { RequireSession } from '../../src/ui/RequireSession';
import type { Lesson, Task } from '../../src/types/task';
import type { TaskStep } from '../../src/ui/lesson/formats/types';

const REGION = 'numbers' as const;

function LessonBody({ lessonId }: { lessonId: string }) {
  const theme = useDesign();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const opened = useRef(false);

  // Открыть (или продолжить) урок в сторе один раз на монтирование.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const s = useChildSession.getState();
    if (s.activeLesson?.lessonId === lessonId) return;
    s.openLesson({ lessonId, now: new Date(), seed: randomSeed(), nodeState: completedLessons(s).has(lessonId) ? 'done' : 'open' });
  }, [lessonId]);

  const onFinished = useCallback(() => router.replace({ pathname: '/atlas/[lessonId]', params: { lessonId } }), [router, lessonId]);
  // Карта уже в стеке под уроком: `navigate` возвращается к ней, не плодя второй экран карты.
  const onLeave = useCallback(() => router.navigate('/map'), [router]);
  const c = useLessonController(lessonId, onFinished, onLeave);
  const { t, ui, step, taskStep, task, spec } = c;

  if (!c.lesson) return <Redirect href="/map" />;
  if (!c.state || !step) return <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="lesson-loading" />;

  const regionColor = theme.focusMode ? theme.colors.background : theme.colors.regions[REGION];
  const W = width - theme.spacing.lg * 2;
  const bottomInset = Math.max(insets.bottom, theme.spacing.lg);
  const X =
    height - insets.top - lessonLayout.topBar - lessonLayout.gapTopPrompt - lessonLayout.prompt - lessonLayout.gapPromptTask - lessonLayout.gapTaskHint - lessonLayout.bubble - lessonLayout.gapHintBar - lessonLayout.actionBar - bottomInset;

  const labels = { exit: t('lesson.exit'), replay: t('lesson.replay'), tali: t('a11y.tali'), check: t('lesson.check'), next: t('lesson.next') };

  if (step.kind === 'hook') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="lesson-screen">
        <View style={{ height: insets.top, backgroundColor: regionColor }} />
        <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: bottomInset }}>
          <HookScreen
            lesson={c.lesson as Lesson}
            region={REGION}
            text={t(c.lesson.hook.lineKey)}
            width={W}
            height={height - insets.top - bottomInset}
            onReplay={() => undefined}
            onHelp={c.onAction}
            labels={{ replay: labels.replay, help: t('lesson.helpTali'), tali: labels.tali }}
          />
        </View>
      </View>
    );
  }

  // Разобранный пример (model) и задание (task) делят каркас. Пример показывает элементы примера
  // без механики: реплика шага — в пузыре, «Дальше» ведёт по шагам, на «теперь ты» — тап по верному.
  const isModel = step.kind === 'model';
  const model = c.lesson.model;
  const modelTask: Task | null = isModel && model ? ({ ...model.example, id: `${c.lesson.id}-model`, skill: model.skill, hintKey: '' } as Task) : null;
  const shownTask = isModel ? modelTask : task;
  const shownSpec = isModel && modelTask ? FORMATS[modelTask.format] ?? null : spec;
  const pseudoStep: TaskStep | null =
    isModel && modelTask
      ? { kind: 'task', task: modelTask, transferProbe: false, review: false, progress: { segment: 0, total: c.state.segments }, attempt: 'first', stage: 'answer', narrowing: null, removed: [], rightOrder: null, kept: [], pinned: null, demo: false, answerCue: true, activeResponse: null, feedback: null, mirrored: false, counts: false }
      : taskStep;
  const promptText = shownTask ? t(shownTask.promptKey) : '';
  const bubbleText = isModel && step.kind === 'model' ? (step.nowYou ? t('lesson.nowYou') : t(model!.steps[Math.min(step.step, model!.steps.length - 1)].lineKey)) : ui.bubble;
  const progress = taskStep?.progress ?? { segment: 0, total: c.state.segments };
  const FormatComponent = (isModel ? (modelTask ? FORMATS[modelTask.format]?.Component : null) : spec?.Component) ?? null;
  const modelReveal = isModel && step.kind === 'model' && model ? model.steps[Math.min(step.step, model.steps.length - 1)]?.reveal ?? null : null;
  const modelDraft = modelTask?.format === 'choose' ? { selected: modelReveal && modelReveal !== 'stimulus' ? modelReveal : null } : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="lesson-screen">
      <View style={{ height: insets.top, backgroundColor: regionColor }} />
      <View style={{ flex: 1, paddingHorizontal: theme.spacing.lg, paddingBottom: bottomInset }}>
        <TopBar segment={progress.segment} total={progress.total} onExit={c.openExit} onReplay={c.replayPrompt} replaying={ui.replaying} labels={{ exit: labels.exit, replay: labels.replay, progress: t('lesson.progress', { n: progress.segment + 1, total: progress.total }) }} />
        <View style={{ height: lessonLayout.gapTopPrompt }} />
        <Prompt text={promptText} />
        <View style={{ height: lessonLayout.gapPromptTask }} />
        <View style={{ height: X, alignItems: 'center' }} testID="lesson-task-zone">
          {FormatComponent && shownTask && pseudoStep ? (
            <FormatComponent
              step={pseudoStep}
              draft={isModel ? modelDraft ?? shownSpec?.emptyDraft(shownTask, pseudoStep) : ui.draft}
              phase={isModel ? 'answer' : ui.phase}
              wrong={ui.wrong}
              listening={ui.listening}
              width={W}
              height={X}
              onTap={(tap) => {
                if (!isModel) return c.onTap(tap);
                if (step.kind === 'model' && step.nowYou && tap.kind === 'element' && modelTask?.format === 'choose' && tap.id === modelTask.options.find((o) => o.correct)?.id) c.onAction();
              }}
              onTouch={c.onTouch}
              t={t}
              marksKey={ui.marksKey}
            />
          ) : (
            <AppText role="body" color="textMuted" align="center">
              {t('lesson.unsupported')}
            </AppText>
          )}
        </View>
        <View style={{ height: lessonLayout.gapTaskHint }} />
        <TaliBubble text={bubbleText} speaking={ui.speaking} onPress={c.onTali} label={bubbleText ?? ''} />
        <View style={{ height: lessonLayout.gapHintBar }} />
        <BottomBar
          pose={isModel ? (step.kind === 'model' && step.nowYou ? 'point' : 'point') : ui.pose}
          onTali={c.onTali}
          action={isModel ? (step.kind === 'model' && step.nowYou ? 'checkDisabled' : 'next') : c.action}
          onAction={isModel && step.kind === 'model' && step.nowYou ? () => c.onAction() : c.onAction}
          labels={{ tali: labels.tali, check: labels.check, next: labels.next }}
          pulse={ui.pulse}
        />
      </View>
      <ExitLayer visible={ui.exitOpen} regionColor={regionColor} persists={false} onLeave={c.leave} onStay={c.stay} />
    </View>
  );
}

export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  return <RequireSession>{lessonId ? <LessonBody lessonId={String(lessonId)} /> : <Redirect href="/map" />}</RequireSession>;
}
