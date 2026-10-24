/**
 * Карта региона «Числовая долина» (DESIGN_PROMPTS.md 1.2; docs/design/slice-screens-2026-10-24.md §2).
 * Safe area и полоса — цвет региона (focus — `background`), фон по `mapBackdrop`, лента узлов с Tali у
 * доступного урока. «К атласу» в срезе — только отклик (атлас целиком — позже), «ползунки» — гейт родителя
 * (№141). Тап по Tali называет регион и следующий шаг (`mapTaliTap`).
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDesign } from '../src/design';
import { lessonLayout } from '../src/design/tokens';
import { voice } from '../src/services/voice';
import { useMapModel } from '../src/state/mapModel';
import { AdultGateStub } from '../src/ui/AdultGateStub';
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
  const [gateOpen, setGateOpen] = useState(false);
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
  const bandColor = theme.focusMode ? theme.colors.background : theme.colors.regions[model.region];
  const laneHeight = height - insets.top - lessonLayout.topBar - Math.max(insets.bottom, theme.spacing.lg);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID="map-screen">
      <MapBackdrop region={model.region} width={width} height={height} />
      <View style={{ height: insets.top, backgroundColor: bandColor }} />
      <View style={{ backgroundColor: bandColor }}>
        <MapBand title={title} ink={onRegion} onAtlas={() => voice.say('map.atlasLater')} onSettings={() => setGateOpen(true)} />
      </View>
      <MapLane
        model={model}
        height={laneHeight}
        focusKey={focusKey}
        reduceMotion={reduceMotion}
        onOpenLesson={(lessonId) => router.push({ pathname: '/lesson/[lessonId]', params: { lessonId } })}
        onVoice={(key) => voice.say(key)}
        onTali={() => voice.say('map.taliTap', { region: t(`content.regions.${model.region}.in`) })}
        taliLabel={t('a11y.tali')}
      />
      <AdultGateStub visible={gateOpen} onClose={() => setGateOpen(false)} />
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
