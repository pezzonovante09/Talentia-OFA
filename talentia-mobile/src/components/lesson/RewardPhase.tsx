import React from 'react';
import { View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { useTranslation } from 'react-i18next';

import { NanoBananaIcon } from '../NanoBananaIcon';
import { NANO_UI } from '../../constants/nanoBananaAssets';
import { Screen } from '../Screen';
import { TaliVideo } from '../TaliVideo';
import { AppText } from '../Text';
import { Spacer } from '../Spacer';
import { Card } from '../Card';
import { Button } from '../Button';
import { useAppTheme } from '../../theme';
import { useSettingsStore } from '../../store/settingsStore';
import { Confetti } from './Confetti';
import { StarsRow } from './StarsRow';

export function RewardPhase({
  earnedXP,
  earnedItemEmoji,
  leveledUp,
  newLevel,
  earnedStars,
  isReplay,
  lessonTitle,
  theme,
  backgroundImage,
  backgroundImageTint,
  onGoToMap,
}: {
  earnedXP: number;
  earnedItemEmoji: string | null;
  leveledUp: boolean;
  newLevel: number;
  earnedStars: 1 | 2 | 3;
  isReplay: boolean;
  lessonTitle: string;
  theme: ReturnType<typeof useAppTheme>;
  backgroundImage: ImageSourcePropType;
  backgroundImageTint: 'default' | 'light';
  onGoToMap: () => void;
}) {
  const { t } = useTranslation();
  const reduceMotion = useSettingsStore((s) => s.reduceMotion);
  return (
    <Screen scroll backgroundImage={backgroundImage} backgroundImageTint={backgroundImageTint}>
      <View style={{ alignItems: 'center', paddingTop: theme.spacing.xl, position: 'relative' }}>
        {!reduceMotion && <Confetti />}

        <TaliVideo emotion="energetic" size={140} bgColor={theme.colors.background} />
        <Spacer size="sm" />
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {t('lesson.rewardTitle')}
        </AppText>
        <Spacer size="sm" />
        <AppText style={{ color: theme.colors.textMuted, textAlign: 'center' }}>{lessonTitle}</AppText>
        <Spacer size="md" />

        {/* Stars */}
        <StarsRow stars={earnedStars} size={36} />
        <AppText variant="small" style={{ color: theme.colors.textMuted, marginTop: 6 }}>
          {t('lesson.starsEarned', { stars: earnedStars })}
        </AppText>

        <Spacer size="lg" />

        <Card style={{ width: '100%', alignItems: 'center', gap: theme.spacing.md }}>
          {isReplay ? (
            <View
              style={{
                backgroundColor: theme.colors.textMuted + '22',
                borderRadius: theme.radii.lg,
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.md,
                alignItems: 'center',
                width: '100%',
              }}
            >
              <AppText
                variant="small"
                style={{ color: theme.colors.textMuted, textAlign: 'center' }}
              >
                {t('lesson.rewardReplayNotice')}
              </AppText>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: theme.colors.success + '22',
                borderRadius: theme.radii.lg,
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.md,
                alignItems: 'center',
                width: '100%',
              }}
            >
              <NanoBananaIcon source={NANO_UI.lightning} size={40} accessibilityLabel="XP" />
              <AppText
                variant="subtitle"
                style={{ color: theme.colors.success, fontWeight: '700', marginTop: theme.spacing.xs }}
              >
                {t('lesson.rewardXP', { xp: earnedXP })}
              </AppText>
            </View>
          )}

          {earnedItemEmoji && (
            <View
              style={{
                backgroundColor: theme.colors.secondary + '22',
                borderRadius: theme.radii.lg,
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.md,
                alignItems: 'center',
                width: '100%',
              }}
            >
              <NanoBananaIcon source={NANO_UI.gift} size={40} accessibilityLabel="" />
              <AppText
                variant="small"
                style={{ color: theme.colors.secondary, fontWeight: '700', marginTop: theme.spacing.xs }}
              >
                {t('lesson.rewardItem', { item: earnedItemEmoji })}
              </AppText>
            </View>
          )}

          {leveledUp && (
            <View
              style={{
                backgroundColor: theme.colors.primary + '22',
                borderRadius: theme.radii.lg,
                paddingHorizontal: theme.spacing.xl,
                paddingVertical: theme.spacing.md,
                alignItems: 'center',
                width: '100%',
              }}
            >
              <NanoBananaIcon source={NANO_UI.levelUp} size={40} accessibilityLabel="" />
              <AppText
                variant="small"
                style={{ color: theme.colors.primary, fontWeight: '700', marginTop: theme.spacing.xs }}
              >
                {t('lesson.rewardLevelUp', { level: newLevel })}
              </AppText>
            </View>
          )}
        </Card>

        <Spacer size="xl" />
        <Button onPress={onGoToMap} style={{ width: '100%' }}>
          {t('lesson.goToMap')}
        </Button>
      </View>
      <Spacer size="xl" />
    </Screen>
  );
}
