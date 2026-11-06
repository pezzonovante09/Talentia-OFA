/**
 * Полоса-заголовок карты 64 (SCREENS.md 8.3; `mapFocus`): слева «к атласу» 60, справа «ползунки» 60, между
 * ними по оси экрана название региона (`mapTitle`). Название не цель. Обе кнопки — роль `control`: подушка
 * съедена на касание, действие по отпусканию (UX п. 8).
 *
 * Наклейка: контур собран из копий текста по кругу, заливка лежит поверх. В RN нет обводки текста, а копии
 * идут обычным путём шрифтов на обеих платформах. Для скринридера узел один — заголовок с `title`.
 */
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { fitRegionTitle, mapFocus, mapTitle, lessonLayout, type StickerTitleFit } from '../../design/tokens';
import { AppText } from '../AppText';
import { CushionPressable } from '../CushionPressable';
import { Icon } from '../Icon';
import type { ColorName } from '../colors';

export type MapBandProps = {
  title: string;
  /** Цвет плоской надписи: `onRegion` на заливке региона, `text` на песке. */
  ink: ColorName;
  /** Ширина между кнопками (`mapTitleWidth`). */
  titleWidth: number;
  /** Наклейка, если она входит и режим её допускает; `null` — плоская надпись. */
  sticker: StickerTitleFit | null;
  /** Кнопка «к атласу» (с первой страницы атласа, D2); без неё — пустое место той же ширины, чтобы название осталось по центру. */
  onAtlas?: () => void;
  onSettings: () => void;
};

function StickerTitle({ title, fit, width }: { title: string; fit: StickerTitleFit; width: number }) {
  const { fill, outlineColor, outlineSteps, tracking } = mapTitle.sticker;
  const text = { fontSize: fit.size, lineHeight: fit.lineHeight, letterSpacing: tracking };
  return (
    <View style={{ width, height: fit.lineHeight }} testID="map-title-sticker">
      {Array.from({ length: outlineSteps }, (_, i) => {
        const angle = (2 * Math.PI * i) / outlineSteps;
        const x = fit.outline * Math.cos(angle);
        const y = fit.outline * Math.sin(angle);
        return (
          <AppText
            key={i}
            role={mapTitle.style}
            cap="fixed"
            align="center"
            lines={1}
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ ...text, color: outlineColor, position: 'absolute', top: y, left: x, right: -x }}
          >
            {title}
          </AppText>
        );
      })}
      <AppText role={mapTitle.style} cap="fixed" align="center" lines={1} style={{ ...text, color: fill }} testID="map-title">
        {title}
      </AppText>
    </View>
  );
}

export function MapBand({ title, ink, titleWidth, sticker, onAtlas, onSettings }: MapBandProps) {
  const { t } = useTranslation();
  const flat = fitRegionTitle(title, titleWidth) ?? { size: mapTitle.minSize, lineHeight: mapTitle.minLineHeight };

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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} accessible accessibilityRole="header" accessibilityLabel={title}>
        {sticker ? (
          <StickerTitle title={title} fit={sticker} width={titleWidth} />
        ) : (
          <AppText role={mapTitle.style} color={ink} cap="fixed" align="center" lines={mapTitle.maxLines} style={{ fontSize: flat.size, lineHeight: flat.lineHeight, maxWidth: titleWidth }} testID="map-title">
            {title}
          </AppText>
        )}
      </View>
      <CushionPressable role="control" width={mapFocus.settings} height={mapFocus.settings} radius="pill" fill="surface" onPress={onSettings} accessibilityLabel={t('a11y.map.settings')} testID="map-settings">
        <Icon name="sliders" color="text" />
      </CushionPressable>
    </View>
  );
}
