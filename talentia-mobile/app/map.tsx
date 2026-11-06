/**
 * Карта региона «Мир чисел» (DESIGN_PROMPTS.md 1.2; docs/design/slice-screens-2026-10-24.md §2).
 * Название-наклейка стоит прямо на фоне карты; в calm, focus и у длинных названий safe area и полоса — цвет
 * региона (focus — `background`). Фон по `mapBackdrop`, лента узлов с Tali у доступного урока. «К атласу» (книга) появляется с первой страницей атласа и ведёт в коллекцию `/atlas` (D2),
 * «ползунки» — гейт родителя (№141) — `router.push('/parent')`. Тап по Tali называет регион и следующий шаг
 * (`mapTaliTap`).
 */
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDesign } from '../src/design';
import { fitStickerTitle, lessonLayout, mapTitleWidth } from '../src/design/tokens';
import { voice } from '../src/services/voice';
import { useChildSession } from '../src/state/childSession';
import { useMapModel } from '../src/state/mapModel';
import { MapBackdrop } from '../src/ui/map/MapBackdrop';
import { MapBand } from '../src/ui/map/MapBand';
import { MapLane } from '../src/ui/map/MapLane';
import { RequireSession } from '../src/ui/RequireSession';

function MapScreenBody() {
  const theme = useDesign();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const model = useMapModel(new Date());
  const atlasPages = useChildSession((s) => s.progress.atlas.length);
  const [focusKey, setFocusKey] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setFocusKey((k) => k + 1);
    }, []),
  );

  const title = t(`content.regions.${model.region}.title`);
  const onRegion = theme.focusMode || theme.calmMode ? ('text' as const) : ('onRegion' as const);
  const titleWidth = mapTitleWidth(width);
  const sticker = theme.focusMode || theme.calmMode ? null : fitStickerTitle(title, titleWidth);
  const bandColor = sticker ? 'transparent' : theme.focusMode ? theme.colors.background : theme.colors.regions[model.region];
  const laneHeight = height - insets.top - lessonLayout.topBar - Math.max(insets.bottom, theme.spacing.lg);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="map-screen">
      <MapBackdrop region={model.region} width={width} height={height} />
      <View style={{ height: insets.top, backgroundColor: bandColor }} />
      <View style={{ backgroundColor: bandColor }}>
        {/* «К атласу» — когда есть хотя бы одна страница (D2); до первого урока — пустое место той же ширины, не мёртвая цель */}
        <MapBand title={title} ink={onRegion} titleWidth={titleWidth} sticker={sticker} onAtlas={atlasPages >= 1 ? () => router.push('/atlas' as Href) : undefined} onSettings={() => router.push('/parent')} />
      </View>
      <MapLane
        model={model}
        height={laneHeight}
        focusKey={focusKey}
        reduceMotion={reduceMotion}
        onOpenLesson={(lessonId) => router.push({ pathname: '/lesson/[lessonId]', params: { lessonId } })}
        // typed routes узнают `/review` при следующей генерации (`expo start`); до неё — явный Href
        onOpenReview={() => router.push('/review' as Href)}
        onVoice={(key) => voice.say(key)}
        onTali={() => voice.say(model.pointer === null ? 'map.taliRest' : 'map.taliTap', { region: t(`content.regions.${model.region}.in`) })}
        taliLabel={t('a11y.tali')}
      />
    </View>
  );
}

export default function MapScreen() {
  return (
    <RequireSession>
      <MapScreenBody />
    </RequireSession>
  );
}
