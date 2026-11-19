/**
 * Сессия повторения с узла «повторение» карты (разбор 2026-10-31, вопрос 56). Только задания-повторения
 * (`startReviewSession`), без завязки, примера и страницы атласа: тот же каркас задания `TaskScreen` и
 * тот же контроллер, что у урока. Вход — одна реплика Tali (`review.intro`), конец — `ReviewDone`:
 * итог записывается один раз (`finishLesson` → `reviewCommitOf`), порция дня не тратится, атлас прежний.
 * Повторять нечего — назад на карту.
 */
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDesign } from '../src/design';
import { lessonLayout, taliSize } from '../src/design/tokens';
import { uuidV4 } from '../src/domain/ids';
import { REVIEW_LESSON_ID } from '../src/domain/parentReport';
import { randomBytes, randomSeed } from '../src/services/random';
import { voice } from '../src/services/voice';
import { useChildSession } from '../src/state/childSession';
import { progressPort } from '../src/state/port';
import { AppText } from '../src/ui/AppText';
import { CushionPressable } from '../src/ui/CushionPressable';
import { Icon } from '../src/ui/Icon';
import { TaskScreen } from '../src/ui/lesson/TaskScreen';
import { useLessonController } from '../src/ui/lesson/useLessonController';
import { RequireSession } from '../src/ui/RequireSession';
import { Screen } from '../src/ui/Screen';
import { TaliFigure } from '../src/ui/TaliFigure';
import type { FormatProps } from '../src/ui/lesson/formats/types';

const REGION = 'numbers' as const;

/** Конец повторения: итог пишется ровно один раз (как на странице атласа), потом «К карте». */
function ReviewDone() {
  const theme = useDesign();
  const { t } = useTranslation();
  const router = useRouter();
  const [status, setStatus] = useState<'pending' | 'ready' | 'failed'>(useChildSession.getState().pendingResult?.run.lessonId === REVIEW_LESSON_ID ? 'ready' : 'pending');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const s = useChildSession.getState();
    if (s.pendingResult?.run.lessonId === REVIEW_LESSON_ID) return;
    if (s.activeLesson?.lessonId !== REVIEW_LESSON_ID || s.activeLesson.phase !== 'done') {
      setStatus('failed');
      return;
    }
    s.finishLesson({ port: progressPort(), runId: uuidV4(randomBytes), at: new Date().toISOString() })
      .then(() => setStatus('ready'))
      .catch(() => setStatus('failed'));
  }, []);

  useEffect(() => {
    if (status === 'ready') voice.say('review.done');
  }, [status]);

  if (status === 'failed') return <Redirect href="/map" />;
  if (status === 'pending') return <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="review-pending" />;

  return (
    <Screen testID="review-done">
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg }}>
        {!theme.focusMode && <TaliFigure pose="cheer" size={taliSize.hero} onPress={() => voice.say('review.done')} accessibilityLabel={t('a11y.tali')} testID="review-tali" />}
        <AppText role="title" align="center" testID="review-done-text">
          {t('review.done')}
        </AppText>
      </View>
      <CushionPressable role="control" width="100%" height={theme.touch.primary} radius={theme.radii.lg} fill="primary" onPress={() => router.navigate('/map')} accessibilityLabel={t('atlas.toMap')} testID="review-to-map">
        {/* иконка карты, как у той же кнопки в атласе и слое выхода: навигация без чтения (аудит 2026-11-09, UX п. 10) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Icon name="map" color="onPrimary" />
          <AppText role="label" color="onPrimary" cap="action" lines={1}>
            {t('atlas.toMap')}
          </AppText>
        </View>
      </CushionPressable>
      <View style={{ height: Math.max(theme.spacing.lg, 0) }} />
    </Screen>
  );
}

function ReviewBody() {
  const theme = useDesign();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [empty, setEmpty] = useState(false);
  // Повторение дошло до итога: `ReviewDone` остаётся на экране и после того, как `finishLesson` закроет
  // сессию (`activeLesson: null`), — иначе он размонтируется посреди записи, и вместо «Повторили!»
  // ребёнок видит пустой экран.
  const [finished, setFinished] = useState(false);
  const opened = useRef(false);

  // Открыть (или продолжить) повторение один раз на монтирование; нечего повторять — на карту.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const s = useChildSession.getState();
    if (s.activeLesson?.lessonId === REVIEW_LESSON_ID) return;
    const state = s.openReview({ now: new Date(), seed: randomSeed() });
    if (!state) setEmpty(true);
    else voice.say('review.intro');
  }, []);

  const onFinished = useCallback(() => undefined, []);
  const onLeave = useCallback(() => router.navigate('/map'), [router]);
  const c = useLessonController(REVIEW_LESSON_ID, onFinished, onLeave);
  const { t, ui, step, taskStep, task, spec } = c;

  if (step?.kind === 'done' && !finished) setFinished(true);

  if (empty) return <Redirect href="/map" />;
  if (finished || step?.kind === 'done') return <ReviewDone />;
  if (!c.state || !step) return <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="review-loading" />;
  if (step.kind !== 'task' || !taskStep || !task) return <Redirect href="/map" />;

  const regionColor = theme.focusMode ? theme.colors.background : theme.colors.regions[REGION];
  const W = width - theme.spacing.lg * 2;
  const bottomInset = Math.max(insets.bottom, theme.spacing.lg);
  const X =
    height - insets.top - lessonLayout.topBar - lessonLayout.gapTopPrompt - lessonLayout.prompt - lessonLayout.gapPromptTask - lessonLayout.gapTaskHint - lessonLayout.bubble - lessonLayout.gapHintBar - lessonLayout.actionBar - bottomInset;
  const Component = (spec?.Component ?? null) as ((props: FormatProps<unknown>) => React.JSX.Element) | null;

  return (
    <TaskScreen
      testID="review-screen"
      regionColor={regionColor}
      insetTop={insets.top}
      bottomInset={bottomInset}
      W={W}
      X={X}
      progress={taskStep.progress}
      promptText={t(task.promptKey)}
      bubbleText={ui.bubble}
      speaking={ui.speaking}
      pose={ui.pose}
      pulse={ui.pulse}
      action={c.action}
      replaying={ui.replaying}
      wrong={ui.wrong}
      listening={ui.listening}
      marksKey={ui.marksKey}
      format={Component ? { Component, step: taskStep, draft: ui.draft, phase: ui.phase } : null}
      exitOpen={ui.exitOpen}
      persists={useChildSession.getState().mode !== 'no_record'}
      onTap={c.onTap}
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

export default function ReviewScreen() {
  return (
    <RequireSession>
      <ReviewBody />
    </RequireSession>
  );
}
