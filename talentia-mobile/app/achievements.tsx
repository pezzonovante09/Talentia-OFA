import React, { memo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

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
  emoji: string;
};

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { key: 'firstLessonCompleted', titleKey: 'achievements.firstLessonTitle', descKey: 'achievements.firstLessonDesc', emoji: '🌟' },
  { key: 'tenCorrectAnswers', titleKey: 'achievements.tenCorrectTitle', descKey: 'achievements.tenCorrectDesc', emoji: '🧠' },
  { key: 'threeDayStreak', titleKey: 'achievements.threeDayTitle', descKey: 'achievements.threeDayDesc', emoji: '🔥' },
  { key: 'firstWorldCompleted', titleKey: 'achievements.firstWorldTitle', descKey: 'achievements.firstWorldDesc', emoji: '🏆' },
  { key: 'sevenDayStreak', titleKey: 'achievements.sevenDayTitle', descKey: 'achievements.sevenDayDesc', emoji: '🔥🔥' },
  { key: 'fiftyCorrectAnswers', titleKey: 'achievements.fiftyCorrectTitle', descKey: 'achievements.fiftyCorrectDesc', emoji: '💡' },
  { key: 'perfectLesson', titleKey: 'achievements.perfectLessonTitle', descKey: 'achievements.perfectLessonDesc', emoji: '💎' },
  { key: 'islandExplorer', titleKey: 'achievements.islandExplorerTitle', descKey: 'achievements.islandExplorerDesc', emoji: '🗺️' },
  { key: 'hundredCorrectAnswers', titleKey: 'achievements.hundredCorrectTitle', descKey: 'achievements.hundredCorrectDesc', emoji: '👑' },
  { key: 'allWorldsStarted', titleKey: 'achievements.allWorldsTitle', descKey: 'achievements.allWorldsDesc', emoji: '🌍' },
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
          <AppText style={{ fontSize: 26 }}>{unlocked ? def.emoji : '🔒'}</AppText>
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
        {unlocked && <AppText style={{ fontSize: 20 }}>✅</AppText>}
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

      {/* Progress bar */}
      <View
        style={{
          height: 8,
          backgroundColor: theme.colors.border,
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: theme.spacing.lg,
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${(unlockedCount / ACHIEVEMENT_DEFS.length) * 100}%`,
            backgroundColor: theme.colors.primary,
            borderRadius: 4,
          }}
        />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        {ACHIEVEMENT_DEFS.map((def) => (
          <AchievementItem
            key={def.key}
            def={def}
            unlocked={achievements[def.key]}
            theme={theme}
            t={t}
          />
        ))}
      </View>

      <Spacer size="xl" />
    </Screen>
  );
}
