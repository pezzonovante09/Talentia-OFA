/**
 * Карточка коллекции атласа 164×216 (D2): заливка региона, контур, подушка `raised` — это кнопка, ведёт на
 * страницу в режиме «только смотреть». Внутри: рамка находки 140×96 с плиточным примитивом, название урока
 * `label` ≤ 2 строк `onRegion`, плашка 32 с печатью 24 `regionsInk` — статичной. Пунктирная «?» —
 * следующая страница: `surfaceSunken`, без подушки, сжатие 0.96 и голос (как слот ленты на странице).
 */
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useDesign } from '../../design';
import { atlasGrid, emptyOutlineColor, pressScale, type RegionId } from '../../design/tokens';
import type { Lesson } from '../../types/task';
import { AppText } from '../AppText';
import { CushionPressable } from '../CushionPressable';
import { Icon } from '../Icon';
import { FindingPreview } from './FindingPreview';

export type AtlasCardProps = {
  lesson: Lesson;
  region: RegionId;
  onPress: () => void;
  testID?: string;
};

export function AtlasCard({ lesson, region, onPress, testID = 'atlas-card' }: AtlasCardProps) {
  const theme = useDesign();
  const { t } = useTranslation();
  const pad = theme.spacing.md;
  return (
    <CushionPressable
      role="control"
      width={atlasGrid.card.w}
      height={atlasGrid.card.h}
      radius={theme.radii.lg}
      fill="surface"
      guardMs={theme.motion.slow}
      onPress={onPress}
      accessibilityLabel={t(lesson.titleKey)}
      testID={testID}
      faceStyle={{ backgroundColor: theme.colors.regions[region], padding: pad, justifyContent: 'flex-start', alignItems: 'stretch' }}
    >
      <View
        style={{ height: atlasGrid.frame, borderRadius: theme.radii.sm, backgroundColor: theme.colors.picturePlate, borderWidth: theme.stroke.base, borderColor: theme.colors.outline, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
        testID={`${testID}-frame`}
      >
        <FindingPreview lesson={lesson} fit="tile" testID={`${testID}-finding`} />
      </View>
      <View style={{ height: theme.spacing.sm }} />
      <View style={{ height: theme.typography.label.lineHeight * atlasGrid.titleLines, justifyContent: 'center' }}>
        <AppText role="label" color="onRegion" align="center" lines={atlasGrid.titleLines} testID={`${testID}-title`}>
          {t(lesson.titleKey)}
        </AppText>
      </View>
      <View style={{ height: theme.spacing.sm }} />
      <View
        style={{ height: atlasGrid.plate, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface, borderWidth: theme.stroke.base, borderColor: theme.colors.outline, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="stampOpen" size={atlasGrid.stamp} color="text" tint={theme.colors.regionsInk[region]} testID={`${testID}-stamp`} />
      </View>
    </CushionPressable>
  );
}

/** Пунктирная карточка «?» — следующая страница (одна после последней, в любом режиме). */
export function AtlasFutureCard({ onPress, testID = 'atlas-future-card' }: { onPress: () => void; testID?: string }) {
  const theme = useDesign();
  const { t } = useTranslation();
  return (
    <CushionPressable
      role="tali"
      dashed
      width={atlasGrid.card.w}
      height={atlasGrid.card.h}
      radius={theme.radii.lg}
      fill="surfaceSunken"
      outlineColor={emptyOutlineColor}
      scale={pressScale.tali}
      onPress={onPress}
      accessibilityLabel={t('atlas.pageAhead')}
      testID={testID}
    >
      <AppText role="label" color="textMuted">
        ?
      </AppText>
    </CushionPressable>
  );
}
