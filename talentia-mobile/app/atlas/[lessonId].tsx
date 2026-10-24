/**
 * Страница атласа в конце урока (DESIGN_PROMPTS.md 1.5; docs/design/slice-screens-2026-10-24.md §4).
 * При открытии один раз записывает итог урока через порт прогресса (`finishLesson` → `commitLesson`);
 * без аккаунта запись отвечает `LessonConsentRequiredError`, итог остаётся в памяти сеанса, страница
 * та же. Бюджет высоты на SE — 646 (`atlasPageHeight`), без прокрутки. Звёзд нет (№7, 5–6).
 */
import { Redirect, useRouter } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { lessonById } from '../../src/content';
import { useDesign } from '../../src/design';
import { atlasPage, taliSize } from '../../src/design/tokens';
import { uuidV4 } from '../../src/domain/ids';
import { randomBytes } from '../../src/services/random';
import { voice } from '../../src/services/voice';
import { useChildSession } from '../../src/state/childSession';
import { progressPort } from '../../src/state/port';
import { AppText } from '../../src/ui/AppText';
import { CushionPressable } from '../../src/ui/CushionPressable';
import { Icon } from '../../src/ui/Icon';
import { RequireSession } from '../../src/ui/RequireSession';
import { Screen } from '../../src/ui/Screen';
import { TaliFigure } from '../../src/ui/TaliFigure';

const REGION = 'numbers' as const;

function AtlasBody({ lessonId }: { lessonId: string }) {
  const theme = useDesign();
  const { t } = useTranslation();
  const router = useRouter();
  const lesson = lessonById(lessonId);
  const pendingResult = useChildSession((s) => s.pendingResult);
  const activeLesson = useChildSession((s) => s.activeLesson);
  const [status, setStatus] = useState<'pending' | 'ready' | 'failed'>(pendingResult?.run.lessonId === lessonId ? 'ready' : 'pending');
  const [stamped, setStamped] = useState(false);
  const started = useRef(false);

  // Итог записывается ровно один раз (StrictMode и повторный рендер — через ref).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const s = useChildSession.getState();
    if (s.pendingResult?.run.lessonId === lessonId) return;
    if (s.activeLesson?.lessonId !== lessonId || s.activeLesson.phase !== 'done') {
      setStatus('failed');
      return;
    }
    s.finishLesson({ port: progressPort(), runId: uuidV4(randomBytes), at: new Date().toISOString() })
      .then(() => setStatus('ready'))
      .catch(() => setStatus('failed'));
  }, [lessonId]);

  useEffect(() => {
    if (status !== 'ready' || !lesson) return;
    voice.say(lesson.atlasEntryKey);
    const id = setTimeout(() => setStamped(true), theme.calmMode ? 0 : theme.motion.base);
    return () => clearTimeout(id);
  }, [status, lesson, theme.calmMode, theme.motion.base]);

  if (!lesson || status === 'failed') return <Redirect href="/map" />;
  if (status === 'pending' && !activeLesson) return <Redirect href="/map" />;
  if (status === 'pending') return <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="atlas-pending" />;

  const slots = theme.calmMode ? atlasPage.futureSlotsCalm : atlasPage.futureSlots;
  const sayEntry = () => voice.say(lesson.atlasEntryKey);

  return (
    <Screen testID="atlas-screen">
      <View style={{ height: theme.spacing.lg }} />
      <View style={{ height: taliSize.crop, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {theme.focusMode ? <View /> : <TaliFigure pose="write" size={taliSize.crop} crop onPress={sayEntry} accessibilityLabel={t('a11y.tali')} testID="atlas-tali" />}
        <CushionPressable role="control" width={theme.touch.min} height={theme.touch.min} radius="pill" fill="surface" onPress={sayEntry} accessibilityLabel={t('atlas.replay')} testID="atlas-replay">
          <Icon name="sound" color="primaryInk" />
        </CushionPressable>
      </View>
      <View style={{ height: theme.spacing.lg }} />
      <CushionPressable
        role="stimulus"
        width="100%"
        height={theme.spacing.lg + atlasPage.findingFrame + theme.spacing.md + theme.typography.body.lineHeight * atlasPage.findingLines + theme.spacing.md + atlasPage.plate + theme.spacing.lg}
        radius={theme.radii.lg}
        fill="surface"
        onPress={sayEntry}
        accessibilityLabel={t(lesson.atlasEntryKey)}
        testID="atlas-card"
        faceStyle={{ backgroundColor: theme.colors.regions[REGION], padding: theme.spacing.lg, justifyContent: 'flex-start', alignItems: 'stretch' }}
      >
        <View
          style={{ height: atlasPage.findingFrame, borderRadius: theme.radii.sm, backgroundColor: theme.colors.picturePlate, borderWidth: theme.stroke.base, borderColor: theme.colors.outline, alignItems: 'center', justifyContent: 'center' }}
          testID="atlas-finding"
        >
          <Icon name="regionNumbers" size={64} color="onRegion" />
        </View>
        <View style={{ height: theme.spacing.md }} />
        <View style={{ height: theme.typography.body.lineHeight * atlasPage.findingLines }}>
          <AppText role="body" color="onRegion" lines={atlasPage.findingLines} testID="atlas-entry">
            {t(lesson.atlasEntryKey)}
          </AppText>
        </View>
        <View style={{ height: theme.spacing.md }} />
        <View
          style={{ height: atlasPage.plate, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface, borderWidth: theme.stroke.base, borderColor: theme.colors.outline, alignItems: 'center', justifyContent: 'center' }}
          testID="atlas-plate"
        >
          {stamped && (
            <View testID="atlas-stamp">
              <Icon name="stampOpen" size={atlasPage.stamp} color="text" />
            </View>
          )}
        </View>
      </CushionPressable>
      <View style={{ height: theme.spacing.lg }} />
      {!theme.focusMode && (
        <View style={{ height: atlasPage.futureSlot, flexDirection: 'row', gap: theme.touch.gap, overflow: 'hidden' }} testID="atlas-future">
          {Array.from({ length: slots }, (_, i) => (
            <CushionPressable
              key={i}
              role="tali"
              dashed
              width={atlasPage.futureSlot}
              height={atlasPage.futureSlot}
              radius={theme.radii.md}
              fill="surfaceSunken"
              outlineColor="textMuted"
              scale={0.96}
              onPress={() => voice.say('atlas.pageAhead')}
              accessibilityLabel={t('atlas.pageAhead')}
              testID={`atlas-slot-${i}`}
            >
              <AppText role="label" color="textMuted">
                ?
              </AppText>
            </CushionPressable>
          ))}
        </View>
      )}
      <View style={{ flex: 1, minHeight: theme.spacing.lg }} />
      <CushionPressable role="control" width="100%" height={theme.touch.primary} radius={theme.radii.lg} fill="primary" guardMs={theme.motion.slow} onPress={() => router.navigate('/map')} accessibilityLabel={t('atlas.toMap')} testID="atlas-to-map">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Icon name="map" color="onPrimary" />
          <AppText role="label" color="onPrimary" cap="action" lines={1}>
            {t('atlas.toMap')}
          </AppText>
        </View>
      </CushionPressable>
    </Screen>
  );
}

export default function AtlasScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  return <RequireSession>{lessonId ? <AtlasBody lessonId={String(lessonId)} /> : <Redirect href="/map" />}</RequireSession>;
}
