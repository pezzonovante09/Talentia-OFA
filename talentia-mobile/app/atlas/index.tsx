/**
 * Коллекция атласа (docs/design/atlas-firstrun-2026-10-31.md D2; вопрос 60, №168): полоса 64 с «К карте» 60
 * слева (`map` — та же иконка, что на странице), глифом книги и заголовком «Атлас»; ниже прокручиваемая сетка
 * карточек 164×216 в два столбца (focus — один) по порядку `firstLesson`, после последней — одна пунктирная
 * «?». Тап по карточке → страница в режиме «только смотреть» (`/atlas/[lessonId]?readOnly=1`); общий `opening`
 * против двойного тапа по двум карточкам (как `app/index.tsx`). Пустое состояние: Tali `idle` 88, «Атлас пока
 * пустой», одна «?» и «К карте» 88 — крупный путь назад. Звёзд нет (№7).
 */
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, useWindowDimensions, View } from 'react-native';

import { lessonById, regionOfLesson } from '../../src/content';
import { useDesign } from '../../src/design';
import { atlasCardWidth, atlasGrid, lessonLayout, mapFocus, mapTitle, taliSize } from '../../src/design/tokens';
import type { AtlasEntry } from '../../src/domain/lessonAssembly';
import { voice } from '../../src/services/voice';
import { useChildSession } from '../../src/state/childSession';
import { AppText } from '../../src/ui/AppText';
import { AtlasCard, AtlasFutureCard } from '../../src/ui/atlas/AtlasCard';
import { CushionPressable } from '../../src/ui/CushionPressable';
import { Icon } from '../../src/ui/Icon';
import { RequireSession } from '../../src/ui/RequireSession';
import { Screen } from '../../src/ui/Screen';
import { TaliFigure } from '../../src/ui/TaliFigure';

type Item = { kind: 'page'; entry: AtlasEntry } | { kind: 'future' };

function AtlasCollectionBody() {
  const theme = useDesign();
  const { t } = useTranslation();
  const router = useRouter();
  const atlas = useChildSession((s) => s.progress.atlas);
  const opening = useRef(false);

  useEffect(() => {
    voice.say('atlas.title');
  }, []);

  const items = useMemo<Item[]>(() => {
    const pages: Item[] = [...atlas]
      .filter((e) => lessonById(e.lessonId))
      .sort((a, b) => a.firstLesson - b.firstLesson)
      .map((entry) => ({ kind: 'page', entry }));
    return [...pages, ...Array.from({ length: atlasGrid.futureCards }, (): Item => ({ kind: 'future' }))];
  }, [atlas]);

  const columns = theme.focusMode ? atlasGrid.columnsFocus : atlasGrid.columns;
  const { width: windowW } = useWindowDimensions();
  // две карточки 164 с зазором 16 не входят в 320 pt (аудит 2026-11-09, UX п. 12): ширина — от окна
  const cardW = atlasCardWidth(windowW, columns, theme.spacing.lg);
  const toMap = () => router.navigate('/map');
  const sayAhead = () => voice.say('atlas.pageAhead');
  const openPage = (lessonId: string) => {
    if (opening.current) return;
    opening.current = true;
    router.push(`/atlas/${lessonId}?readOnly=1` as Href);
    setTimeout(() => {
      opening.current = false;
    }, theme.motion.slow);
  };

  const band = (
    <View style={{ height: lessonLayout.topBar, flexDirection: 'row', alignItems: 'center', gap: mapFocus.minGap }} testID="atlas-band">
      <CushionPressable role="control" width={mapFocus.atlasButton} height={mapFocus.atlasButton} radius="pill" fill="surface" guardMs={theme.motion.slow} onPress={toMap} accessibilityLabel={t('atlas.toMap')} testID="atlas-band-map">
        <Icon name="map" color="text" />
      </CushionPressable>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }} accessibilityRole="header" accessibilityLabel={t('atlas.title')}>
        <Icon name="book" color="text" />
        <AppText role={mapTitle.style} color="text" cap="fixed" lines={1} style={{ fontSize: mapTitle.size, lineHeight: mapTitle.lineHeight }} testID="atlas-title">
          {t('atlas.title')}
        </AppText>
      </View>
      <View style={{ width: mapFocus.atlasButton, height: mapFocus.atlasButton }} />
    </View>
  );

  if (atlas.length === 0) {
    return (
      <Screen testID="atlas-collection">
        {band}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} testID="atlas-empty">
          {!theme.focusMode && <TaliFigure pose={atlasGrid.emptyTali} size={taliSize.crop} crop onPress={() => voice.say('atlas.empty')} accessibilityLabel={t('a11y.tali')} testID="atlas-empty-tali" />}
          <View style={{ height: theme.spacing.lg }} />
          <AppText role="subtitle" color="text" align="center" lines={2}>
            {t('atlas.empty')}
          </AppText>
          <View style={{ height: theme.spacing.xl }} />
          <AtlasFutureCard onPress={sayAhead} />
        </View>
        <View style={{ height: theme.spacing.lg }} />
        <CushionPressable role="control" width="100%" height={theme.touch.primary} radius={theme.radii.lg} fill="primary" guardMs={theme.motion.slow} onPress={toMap} accessibilityLabel={t('atlas.toMap')} testID="atlas-to-map">
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

  return (
    <Screen testID="atlas-collection">
      {band}
      <FlatList
        key={columns}
        data={items}
        numColumns={columns}
        keyExtractor={(item) => (item.kind === 'page' ? item.entry.lessonId : 'future')}
        contentContainerStyle={{ paddingTop: theme.spacing.lg, gap: atlasGrid.gap, alignItems: columns === 1 ? 'center' : undefined }}
        columnWrapperStyle={columns > 1 ? { gap: atlasGrid.gap, justifyContent: 'center' } : undefined}
        showsVerticalScrollIndicator={false}
        testID="atlas-grid"
        renderItem={({ item, index }) => {
          if (item.kind === 'future') return <AtlasFutureCard onPress={sayAhead} width={cardW} />;
          const lesson = lessonById(item.entry.lessonId)!;
          return <AtlasCard lesson={lesson} region={regionOfLesson(lesson.id) ?? 'numbers'} onPress={() => openPage(lesson.id)} width={cardW} testID={`atlas-card-${index + 1}`} />;
        }}
      />
    </Screen>
  );
}

export default function AtlasCollectionScreen() {
  return (
    <RequireSession>
      <AtlasCollectionBody />
    </RequireSession>
  );
}
