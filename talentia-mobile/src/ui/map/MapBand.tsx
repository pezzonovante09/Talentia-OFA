/**
 * Полоса-заголовок карты 64 (SCREENS.md 8.3; `mapFocus`): слева «к атласу» 60, в центре ориентир 32 +
 * название региона (`fitRegionTitle`), справа «ползунки» 60. Ориентир и название — не цель (часть
 * заголовка). Обе кнопки — роль `control`: подушка съедена на касание, действие по отпусканию (UX п. 8).
 */
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useDesign } from '../../design';
import { fitRegionTitle, lessonLayout, mapFocus, mapTitle } from '../../design/tokens';
import { fontFamilyFor } from '../fonts';
import { AppText } from '../AppText';
import { CushionPressable } from '../CushionPressable';
import { Icon } from '../Icon';
import type { ColorName } from '../colors';

export type MapBandProps = {
  title: string;
  /** Цвет текста и глифов на полосе: `onRegion` на заливке региона, `text` на песке. */
  ink: ColorName;
  /** Кнопка «к атласу»; без неё — пустое место той же ширины, чтобы название осталось по центру (атлас-коллекции пока нет, вопрос 60). */
  onAtlas?: () => void;
  onSettings: () => void;
};

export function MapBand({ title, ink, onAtlas, onSettings }: MapBandProps) {
  const theme = useDesign();
  const { t } = useTranslation();
  const size = fitRegionTitle(title) ?? mapTitle.minSize;
  const lineHeight = size === mapTitle.size ? mapTitle.lineHeight : mapTitle.minLineHeight;

  return (
    <View
      testID="map-band"
      style={{
        height: lessonLayout.topBar,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: mapFocus.edgeInset,
        gap: mapFocus.minGap,
      }}
    >
      {onAtlas ? (
        <CushionPressable role="control" width={mapFocus.atlasButton} height={mapFocus.atlasButton} radius="pill" fill="surface" onPress={onAtlas} accessibilityLabel={t('a11y.map.atlas')} testID="map-atlas">
          <Icon name="book" color="text" />
        </CushionPressable>
      ) : (
        <View style={{ width: mapFocus.atlasButton, height: mapFocus.atlasButton }} testID="map-atlas-slot" />
      )}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing.sm }} accessibilityRole="header" accessibilityLabel={title}>
        <Icon name="regionNumbers" size={mapFocus.landmark} color={ink} />
        <AppText
          role="subtitle"
          color={ink}
          cap="fixed"
          lines={mapTitle.maxLines}
          style={{ fontFamily: fontFamilyFor(theme.typography.subtitle), fontSize: size, lineHeight, maxWidth: mapTitle.width }}
          testID="map-title"
        >
          {title}
        </AppText>
      </View>
      <CushionPressable role="control" width={mapFocus.settings} height={mapFocus.settings} radius="pill" fill="surface" onPress={onSettings} accessibilityLabel={t('a11y.map.settings')} testID="map-settings">
        <Icon name="sliders" color="text" />
      </CushionPressable>
    </View>
  );
}
