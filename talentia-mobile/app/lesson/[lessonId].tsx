/**
 * Экран урока (SCREENS.md; docs/design/slice-screens-2026-10-24.md §3). Каркас не прокручивается:
 * safe area регион · панель 64 · 8 · вопрос 72 · 12 · зона X · 16 · пузырь 80 · 16 · нижняя панель 88 ·
 * низ. Экран рисует `LessonStep` оркестратора; каркас фазы задания — `ui/lesson/TaskScreen` (общий с
 * сессией повторения `app/review`), механика форматов — `ui/lesson/formats`.
 */
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDesign } from '../../src/design';
import { lessonLayout } from '../../src/design/tokens';
import { randomSeed } from '../../src/services/random';
import { voice } from '../../src/services/voice';
import { completedLessons, useChildSession } from '../../src/state/childSession';
import { companionLine } from '../../src/state/companionMemory';
import { ExitLayer } from '../../src/ui/lesson/ExitLayer';
import { HookScreen } from '../../src/ui/lesson/HookScreen';
import { TaskScreen, type TaskScreenFormat } from '../../src/ui/lesson/TaskScreen';
import { FORMATS } from '../../src/ui/lesson/formats';
import { useLessonController } from '../../src/ui/lesson/useLessonController';
import { RequireSession } from '../../src/ui/RequireSession';
import type { Lesson, Task } from '../../src/types/task';
import type { FormatProps, TaskStep } from '../../src/ui/lesson/formats/types';

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
    if (s.activeLesson?.lessonId === lessonId) {
      // вернулись в брошенный урок (ситуация `lesson-resume`, вопрос 71; реплика из банка, Ж14)
      voice.say(companionLine('lesson-resume', s.settings.addressForm));
      return;
    }
    s.openLesson({ lessonId, now: new Date(), seed: randomSeed(), nodeState: completedLessons(s).has(lessonId) ? 'done' : 'open' });
  }, [lessonId]);

  const onFinished = useCallback(() => router.replace({ pathname: '/atlas/[lessonId]', params: { lessonId } }), [router, lessonId]);
  // Карта уже в стеке под уроком: `navigate` возвращается к ней, не плодя второй экран карты.
  const onLeave = useCallback(() => router.navigate('/map'), [router]);
  const c = useLessonController(lessonId, onFinished, onLeave);
  const { t, ui, step, taskStep, task, spec } = c;
  // подпись «прогресс сохранится» — только в сеансе с аккаунтом (аудит 2026-11-09, UX п. 9)
  const persists = useChildSession((s) => s.mode !== 'no_record');

  if (!c.lesson) return <Redirect href="/map" />;
  if (!c.state || !step) return <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="lesson-loading" />;

  const regionColor = theme.focusMode ? theme.colors.background : theme.colors.regions[REGION];
  const W = width - theme.spacing.lg * 2;
  const bottomInset = Math.max(insets.bottom, theme.spacing.lg);
  const X =
    height - insets.top - lessonLayout.topBar - lessonLayout.gapTopPrompt - lessonLayout.prompt - lessonLayout.gapPromptTask - lessonLayout.gapTaskHint - lessonLayout.bubble - lessonLayout.gapHintBar - lessonLayout.actionBar - bottomInset;

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
            onReplay={c.replayHook}
            onHelp={c.onAction}
            labels={{ replay: t('lesson.replay'), help: t('lesson.helpTali'), helpA11y: t('a11y.helpTali'), tali: t('a11y.tali') }}
          />
        </View>
        {/* системная «назад» на завязке — тот же слой выхода, что в задании (Ж7) */}
        <ExitLayer visible={ui.exitOpen} regionColor={regionColor} persists={persists} onLeave={c.leave} onStay={c.stay} />
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
  // пузырь примера: реплика шага или «теперь ты»; подсказка контроллера («Покажи, где верно») — поверх
  const bubbleText = isModel && step.kind === 'model' ? (ui.bubble ?? (step.nowYou ? t('lesson.nowYou') : t(model!.steps[Math.min(step.step, model!.steps.length - 1)].lineKey))) : ui.bubble;
  const progress = taskStep?.progress ?? { segment: 0, total: c.state.segments };
  const FormatComponent = ((isModel ? (modelTask ? FORMATS[modelTask.format]?.Component : null) : spec?.Component) ?? null) as ((props: FormatProps<unknown>) => React.JSX.Element) | null;
  const modelStep = isModel && step.kind === 'model' && model ? model.steps[Math.min(step.step, model.steps.length - 1)] : null;
  const modelReveal = modelStep?.reveal ?? null;
  // шаг «Tali ошибся» (№70): над плиткой знак вопроса, не крест; на следующих шагах она гаснет как «снятая»
  const mistakeNow = modelStep?.mistake === true && !(step.kind === 'model' && step.nowYou);
  const mistakenBefore = isModel && step.kind === 'model' && model ? model.steps.slice(0, step.nowYou ? model.steps.length : step.step).filter((s) => s.mistake && s.reveal).map((s) => s.reveal as string) : [];
  const modelDraft = modelTask?.format === 'choose' ? { selected: modelReveal && modelReveal !== 'stimulus' && !mistakeNow ? modelReveal : null } : null;
  const modelPseudoStep: TaskStep | null = pseudoStep && isModel ? { ...pseudoStep, removed: mistakenBefore } : pseudoStep;
  const format: TaskScreenFormat | null =
    FormatComponent && shownTask && modelPseudoStep
      ? {
          Component: FormatComponent,
          step: modelPseudoStep,
          draft: isModel ? modelDraft ?? shownSpec?.emptyDraft(shownTask, modelPseudoStep) : ui.draft,
          phase: isModel ? 'answer' : ui.phase,
          question: mistakeNow ? modelReveal : null,
        }
      : null;

  return (
    <TaskScreen
      regionColor={regionColor}
      insetTop={insets.top}
      bottomInset={bottomInset}
      W={W}
      X={X}
      progress={progress}
      promptText={promptText}
      bubbleText={bubbleText}
      speaking={ui.speaking}
      pose={isModel ? (mistakeNow ? 'puzzled' : 'point') : ui.pose}
      pulse={ui.pulse}
      action={c.action}
      replaying={ui.replaying}
      wrong={ui.wrong}
      listening={ui.listening}
      marksKey={ui.marksKey}
      format={format}
      exitOpen={ui.exitOpen}
      persists={persists}
      onTap={isModel ? c.onModelTap : c.onTap}
      onTouch={c.onTouch}
      onAction={c.onAction}
      onTali={c.onTali}
      onExit={c.openExit}
      onReplay={c.replayPrompt}
      onLeave={c.leave}
      onStay={c.stay}
      t={t}
    />
  );
}

export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  return <RequireSession>{lessonId ? <LessonBody lessonId={String(lessonId)} /> : <Redirect href="/map" />}</RequireSession>;
}
