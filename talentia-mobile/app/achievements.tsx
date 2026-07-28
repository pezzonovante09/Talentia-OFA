import React, { memo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { NanoBananaIcon } from '../src/components/NanoBananaIcon';
import { NANO_UI } from '../src/constants/nanoBananaAssets';

import { ConsentGate } from '../src/components/ConsentGate';
import { Screen } from '../src/components/Screen';
import { AppText } from '../src/components/Text';
import { Spacer } from '../src/components/Spacer';
import { Card } from '../src/components/Card';
import { useAppTheme } from '../src/theme';
import { useProgressStore, type Achievements } from '../src/store/progressStore';

type AchievementDef = {
  key: keyof Achievements;
  titleKey: string;
  descKey: string;
};

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { key: 'firstLessonCompleted', titleKey: 'achievements.firstLessonTitle', descKey: 'achievements.firstLessonDesc' },
  { key: 'tenCorrectAnswers', titleKey: 'achievements.tenCorrectTitle', descKey: 'achievements.tenCorrectDesc' },
  { key: 'threeDayStreak', titleKey: 'achievements.threeDayTitle', descKey: 'achievements.threeDayDesc' },
  { key: 'firstWorldCompleted', titleKey: 'achievements.firstWorldTitle', descKey: 'achievements.firstWorldDesc' },
  { key: 'sevenDayStreak', titleKey: 'achievements.sevenDayTitle', descKey: 'achievements.sevenDayDesc' },
  { key: 'fiftyCorrectAnswers', titleKey: 'achievements.fiftyCorrectTitle', descKey: 'achievements.fiftyCorrectDesc' },
  { key: 'perfectLesson', titleKey: 'achievements.perfectLessonTitle', descKey: 'achievements.perfectLessonDesc' },
  { key: 'islandExplorer', titleKey: 'achievements.islandExplorerTitle', descKey: 'achievements.islandExplorerDesc' },
  { key: 'hundredCorrectAnswers', titleKey: 'achievements.hundredCorrectTitle', descKey: 'achievements.hundredCorrectDesc' },
  { key: 'allWorldsStarted', titleKey: 'achievements.allWorldsTitle', descKey: 'achievements.allWorldsDesc' },
];

const AchievementItem = memo(function AchievementItem({
  def,
  unlocked,
  theme,
  t,
}: {
  def: AchievementDef;
  unlocked: boolean;
  theme: ReturnType<typeof useAppTheme>;
  t: (key: string) => string;
}) {
  return (
    <Card
      style={{
        opacity: unlocked ? 1 : 0.5,
        borderLeftWidth: 4,
        borderLeftColor: unlocked ? theme.colors.success : theme.colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: unlocked ? theme.colors.success + '22' : theme.colors.surfaceAlt,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <NanoBananaIcon
            source={unlocked ? NANO_UI.stars : NANO_UI.lock}
            size={28}
            style={unlocked ? undefined : { opacity: 0.85 }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <AppText
            variant="small"
            style={{
              fontWeight: '700',
              color: unlocked ? theme.colors.text : theme.colors.textMuted,
            }}
          >
            {unlocked ? t(def.titleKey) : t('achievements.locked')}
          </AppText>
          <AppText variant="small" style={{ color: theme.colors.textMuted, marginTop: 2 }}>
            {t(def.descKey)}
          </AppText>
        </View>
        {unlocked ? (
          <NanoBananaIcon source={NANO_UI.check} size={22} />
        ) : null}
      </View>
    </Card>
  );
});

export default function AchievementsScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const achievements = useProgressStore((s) => s.achievements);

  const unlockedCount = ACHIEVEMENT_DEFS.filter((d) => achievements[d.key]).length;

  return (
    <ConsentGate>
      <Screen scroll>
      <AppText variant="title" accessibilityRole="header">
        {t('achievements.title')}
      </AppText>
      <Spacer size="xs" />
      <AppText style={{ color: theme.colors.textMuted }}>{t('achievements.subtitle')}</AppText>
      <Spacer size="sm" />
      <AppText variant="small" style={{ color: theme.colors.primary }}>
        {unlockedCount} / {ACHIEVEMENT_DEFS.length}
      </AppText>
      <Spacer size="md" />

      <View style={{ gap: theme.spacing.sm }}>
        {ACHIEVEMENT_DEFS.map((def) => (
          <AchievementItem key={def.key} def={def} unlocked={!!achievements[def.key]} theme={theme} t={t} />
        ))}
      </View>
    </Screen>
    </ConsentGate>
  );
}
