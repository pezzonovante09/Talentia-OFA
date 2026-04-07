import React, { memo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { NanoBananaIcon } from '../src/components/NanoBananaIcon';
import { NANO_UI } from '../src/constants/nanoBananaAssets';
import { Screen } from '../src/components/Screen';
import { AppText } from '../src/components/Text';
import { Spacer } from '../src/components/Spacer';
import { Card } from '../src/components/Card';
import { useAppTheme } from '../src/theme';
import { useCollectiblesStore, COLLECTIBLES_META } from '../src/store/collectiblesStore';
import type { CollectibleId } from '../src/data/worlds';

const RARITY_COLORS = {
  common: '#78909C',
  rare: '#1565C0',
  epic: '#6A1B9A',
} as const;

const ALL_ITEMS: CollectibleId[] = [
  'tali_egg',
  'banana_badge',
  'jungle_leaf',
  'canyon_gem',
  'spike_crystal',
  'star_fragment',
  'dino_egg_green',
  'dino_egg_red',
  'dino_egg_blue',
  'artifact_map',
];

const CollectionItem = memo(function CollectionItem({
  itemId,
  owned,
  theme,
  t,
}: {
  itemId: CollectibleId;
  owned: boolean;
  theme: ReturnType<typeof useAppTheme>;
  t: (key: string) => string;
}) {
  const meta = COLLECTIBLES_META[itemId];
  const rarityColor = RARITY_COLORS[meta.rarity];
  return (
    <View style={{ width: '44%', flex: 0 }}>
      <Card
        style={{
          alignItems: 'center',
          opacity: owned ? 1 : 0.35,
          borderWidth: owned ? 2 : 1,
          borderColor: owned ? rarityColor : theme.colors.border,
        }}
      >
        <View style={{ marginBottom: theme.spacing.xs, height: 44, justifyContent: 'center' }}>
          {owned ? (
            <NanoBananaIcon source={NANO_UI.gift} size={40} />
          ) : (
            <NanoBananaIcon source={NANO_UI.help} size={40} style={{ opacity: 0.55 }} />
          )}
        </View>
        <AppText
          variant="small"
          style={{
            fontWeight: '700',
            textAlign: 'center',
            color: owned ? theme.colors.text : theme.colors.textMuted,
          }}
        >
          {owned ? t(meta.nameKey) : '???'}
        </AppText>
        <View
          style={{
            marginTop: theme.spacing.xs,
            backgroundColor: rarityColor + '22',
            borderRadius: theme.radii.sm,
            paddingHorizontal: theme.spacing.xs,
            paddingVertical: 2,
          }}
        >
          <AppText
            variant="small"
            style={{ color: rarityColor, fontSize: 10, fontWeight: '600' }}
          >
            {t(`collection.rarity${meta.rarity.charAt(0).toUpperCase() + meta.rarity.slice(1)}`)}
          </AppText>
        </View>
      </Card>
    </View>
  );
});

export default function CollectionScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const hasItem = useCollectiblesStore((s) => s.hasItem);
  const ownedCount = useCollectiblesStore((s) => s.ownedCount);

  return (
    <Screen scroll>
      <AppText variant="title" accessibilityRole="header">
        {t('collection.title')}
      </AppText>
      <Spacer size="xs" />
      <AppText style={{ color: theme.colors.textMuted }}>{t('collection.subtitle')}</AppText>
      <Spacer size="sm" />
      <AppText variant="small" style={{ color: theme.colors.primary }}>
        {ownedCount()} / {ALL_ITEMS.length}
      </AppText>
      <Spacer size="lg" />

      {ownedCount() === 0 && (
        <Card>
          <AppText style={{ textAlign: 'center', color: theme.colors.textMuted }}>
            {t('collection.empty')}
          </AppText>
        </Card>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
        {ALL_ITEMS.map((itemId) => (
          <CollectionItem
            key={itemId}
            itemId={itemId}
            owned={hasItem(itemId)}
            theme={theme}
            t={t}
          />
        ))}
      </View>

      <Spacer size="xl" />
    </Screen>
  );
}
