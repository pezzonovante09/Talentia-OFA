/**
 * Страница атласа в конце урока (DESIGN_PROMPTS.md 1.5; docs/design/atlas-firstrun-2026-10-31.md D1).
 * При открытии один раз записывает итог урока через порт прогресса (`finishLesson` → `commitLesson`);
 * без аккаунта запись отвечает `LessonConsentRequiredError`, итог остаётся в памяти сеанса, страница
 * та же. В рамке находки — стимул первого задания навыка урока (`FindingPreview`), печать `regionsInk`
 * ложится после голосовой фразы (`atlasPage.stampAfterMs`) сжатием 1.4 → 1, Tali `write` → `cheer`.
 * Лента: 3 слота «?» и хвост тропы до края — плоская зона с тем же голосом. Бюджет на SE — 654
 * (`atlasPageHeight`), без прокрутки. Звёзд нет (№7, 5–6).
 *
 * `?readOnly=1` — вход из коллекции (D2): записи итога нет, печать стоит сразу, Tali `idle`, ленты нет,
 * внизу «К атласу» (книга) → `router.navigate('/atlas')`.
 */
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, Platform, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { lessonById, regionOfLesson } from '../../src/content';
import { useDesign } from '../../src/design';
import { atlasPage, pressScale, taliSize } from '../../src/design/tokens';
import { uuidV4 } from '../../src/domain/ids';
import { randomBytes } from '../../src/services/random';
import { voice } from '../../src/services/voice';
import { useChildSession } from '../../src/state/childSession';
import { progressPort } from '../../src/state/port';
import { AppText } from '../../src/ui/AppText';
import { FindingPreview } from '../../src/ui/atlas/FindingPreview';
import { CushionPressable } from '../../src/ui/CushionPressable';
import { Icon } from '../../src/ui/Icon';
import { RequireSession } from '../../src/ui/RequireSession';
import { Screen } from '../../src/ui/Screen';
import { TaliFigure } from '../../src/ui/TaliFigure';

/** На web нативного драйвера анимаций нет — RN предупреждает на каждом касании. */
const NATIVE_DRIVER = Platform.OS !== 'web';

/** Хвост тропы за слотами: пунктир 2 pt `textMuted` по вертикальному центру ряда, под плоской зоной с голосом. */
function FutureTrail() {
  const theme = useDesign();
  const trail = atlasPage.futureTrail;
  return (
    <Svg width="100%" height={trail.stroke} pointerEvents="none" testID="atlas-trail">
      <Line x1={0} y1={trail.stroke / 2} x2="100%" y2={trail.stroke / 2} stroke={theme.colors[trail.color]} strokeWidth={trail.stroke} strokeDasharray={`${trail.dash} ${trail.gap}`} />
    </Svg>
  );
}

function AtlasBody({ lessonId, readOnly }: { lessonId: string; readOnly: boolean }) {
  const theme = useDesign();
  const { t } = useTranslation();
  const router = useRouter();
  const lesson = lessonById(lessonId);
  const region = regionOfLesson(lessonId) ?? 'numbers';
  const pendingResult = useChildSession((s) => s.pendingResult);
  const activeLesson = useChildSession((s) => s.activeLesson);
  const [status, setStatus] = useState<'pending' | 'ready' | 'failed'>(readOnly || pendingResult?.run.lessonId === lessonId ? 'ready' : 'pending');
  const [stamped, setStamped] = useState(readOnly);
  const [reduceMotion, setReduceMotion] = useState(false);
  const started = useRef(false);
  const stampScale = useRef(new Animated.Value(readOnly ? atlasPage.stampEnter.to : atlasPage.stampEnter.from)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Итог записывается ровно один раз (StrictMode и повторный рендер — через ref); в readOnly — не пишется вовсе.
  useEffect(() => {
    if (readOnly || started.current) return;
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
  }, [lessonId, readOnly]);

  // Голос — вывод; печать — после фразы (длительность неизвестна → `stampAfterMs`, не позже `stampMaxWaitMs`).
  useEffect(() => {
    if (status !== 'ready' || !lesson) return;
    voice.say(lesson.atlasEntryKey);
    if (readOnly) return;
    const id = setTimeout(() => setStamped(true), Math.min(atlasPage.stampAfterMs, atlasPage.stampMaxWaitMs));
    return () => clearTimeout(id);
  }, [status, lesson, readOnly]);

  // Появление печати: сжатие 1.4 → 1 за `motion.base`; calm / reduce motion — сразу.
  useEffect(() => {
    if (!stamped) return;
    if (readOnly || theme.calmMode || reduceMotion) {
      stampScale.setValue(atlasPage.stampEnter.to);
      return;
    }
    Animated.timing(stampScale, { toValue: atlasPage.stampEnter.to, duration: theme.motion.base, useNativeDriver: NATIVE_DRIVER }).start();
  }, [stamped, readOnly, theme.calmMode, reduceMotion, theme.motion.base, stampScale]);

  if (!lesson || status === 'failed') return <Redirect href="/map" />;
  if (status === 'pending' && !activeLesson) return <Redirect href="/map" />;
  if (status === 'pending') return <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="atlas-pending" />;

  const sayEntry = () => voice.say(lesson.atlasEntryKey);
  const sayAhead = () => voice.say('atlas.pageAhead');
  const taliPose = readOnly ? 'idle' : stamped ? atlasPage.taliAfterStamp : 'write';
  const cardHeight = theme.spacing.lg + atlasPage.findingFrame + theme.spacing.md + theme.typography.body.lineHeight * atlasPage.findingLines + theme.spacing.md + atlasPage.plate + theme.spacing.lg;

  return (
    <Screen testID="atlas-screen">
      <View style={{ height: theme.spacing.lg }} />
      <View style={{ height: theme.focusMode ? theme.touch.min : taliSize.crop, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {theme.focusMode ? <View /> : <TaliFigure pose={taliPose} size={taliSize.crop} crop onPress={sayEntry} accessibilityLabel={t('a11y.tali')} testID="atlas-tali" />}
        <CushionPressable role="control" width={theme.touch.min} height={theme.touch.min} radius="pill" fill="surface" onPress={sayEntry} accessibilityLabel={t('atlas.replay')} testID="atlas-replay">
          <Icon name="sound" color="primaryInk" />
        </CushionPressable>
      </View>
      <View style={{ height: theme.spacing.lg }} />
      <CushionPressable
        role="stimulus"
        width="100%"
        height={cardHeight}
        radius={theme.radii.lg}
        fill="surface"
        onPress={sayEntry}
        accessibilityLabel={t(lesson.atlasEntryKey)}
        testID="atlas-card"
        faceStyle={{ backgroundColor: theme.colors.regions[region], padding: theme.spacing.lg, justifyContent: 'flex-start', alignItems: 'stretch' }}
      >
        <View
          style={{ height: atlasPage.findingFrame, borderRadius: theme.radii.sm, backgroundColor: theme.colors.picturePlate, borderWidth: theme.stroke.base, borderColor: theme.colors.outline, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          testID="atlas-finding"
        >
          <FindingPreview lesson={lesson} fit="page" testID="atlas-finding" />
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
            <Animated.View style={{ transform: [{ scale: stampScale }] }} testID="atlas-stamp">
              <Icon name="stampOpen" size={atlasPage.stamp} color="text" tint={theme.colors.regionsInk[region]} />
            </Animated.View>
          )}
        </View>
      </CushionPressable>
      <View style={{ height: theme.spacing.lg }} />
      {!theme.focusMode && !readOnly && (
        <View style={{ height: atlasPage.futureSlot, flexDirection: 'row', alignItems: 'center', gap: theme.touch.gap }} testID="atlas-future">
          {Array.from({ length: atlasPage.futureSlots }, (_, i) => (
            <CushionPressable
              key={i}
              role="tali"
              dashed
              width={atlasPage.futureSlot}
              height={atlasPage.futureSlot}
              radius={theme.radii.md}
              fill="surfaceSunken"
              outlineColor="textMuted"
              scale={pressScale.tali}
              onPress={sayAhead}
              accessibilityLabel={t('atlas.pageAhead')}
              testID={`atlas-slot-${i}`}
            >
              <AppText role="label" color="textMuted">
                ?
              </AppText>
            </CushionPressable>
          ))}
          {/* Хвост: остаток ряда до края экрана — живая плоская зона без сжатия, чтобы рядом с «?» не было мёртвого места */}
          <View style={{ flex: 1, marginRight: -theme.spacing.lg }}>
            <CushionPressable
              role="tali"
              width="100%"
              height={atlasPage.futureSlot}
              radius={0}
              fill="background"
              outlineColor="background"
              outlineWidth={0}
              scale={1}
              onPress={sayAhead}
              accessibilityLabel={t('atlas.pageAhead')}
              testID="atlas-tail"
            >
              <FutureTrail />
            </CushionPressable>
          </View>
        </View>
      )}
      <View style={{ flex: 1, minHeight: theme.spacing.lg }} />
      {readOnly ? (
        <CushionPressable role="control" width="100%" height={theme.touch.primary} radius={theme.radii.lg} fill="primary" guardMs={theme.motion.slow} onPress={() => router.navigate('/atlas' as Href)} accessibilityLabel={t('atlas.toAtlas')} testID="atlas-to-atlas">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Icon name="book" color="onPrimary" />
            <AppText role="label" color="onPrimary" cap="action" lines={1}>
              {t('atlas.toAtlas')}
            </AppText>
          </View>
        </CushionPressable>
      ) : (
        <CushionPressable role="control" width="100%" height={theme.touch.primary} radius={theme.radii.lg} fill="primary" guardMs={theme.motion.slow} onPress={() => router.navigate('/map')} accessibilityLabel={t('atlas.toMap')} testID="atlas-to-map">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Icon name="map" color="onPrimary" />
            <AppText role="label" color="onPrimary" cap="action" lines={1}>
              {t('atlas.toMap')}
            </AppText>
          </View>
        </CushionPressable>
      )}
    </Screen>
  );
}

export default function AtlasScreen() {
  const { lessonId, readOnly } = useLocalSearchParams<{ lessonId: string; readOnly?: string }>();
  return <RequireSession>{lessonId ? <AtlasBody lessonId={String(lessonId)} readOnly={readOnly === '1'} /> : <Redirect href="/map" />}</RequireSession>;
}
