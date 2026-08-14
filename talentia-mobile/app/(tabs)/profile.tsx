import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { NanoBananaIcon } from '../../src/components/NanoBananaIcon';
import { NANO_UI } from '../../src/constants/nanoBananaAssets';
import { useCollectiblesStore, COLLECTIBLES_META } from '../../src/store/collectiblesStore';
import { useProgressStore, getXPToNextLevel } from '../../src/store/progressStore';

import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { TaliVideo } from '../../src/components/TaliVideo';
import { Spacer } from '../../src/components/Spacer';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useAppTheme } from '../../src/theme';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useAuth } from '../../src/context/AuthContext';

const TALI_SKINS = [
  { id: 'default' as const, labelKey: 'profile.taliSkinDefault', color: '#0DBFB2' },
  { id: 'cool' as const, labelKey: 'profile.taliSkinCool', color: '#8B5CF6' },
  { id: 'explorer' as const, labelKey: 'profile.taliSkinExplorer', color: '#C4783B' },
  { id: 'scientist' as const, labelKey: 'profile.taliSkinScientist', color: '#5B5BE8' },
];

export default function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const profile = useAuth((s) => s.profile);

  const methodology = useSettingsStore((s) => s.methodology);
  const isPremium = useSettingsStore((s) => s.isPremium);
  const taliSkinId = useSettingsStore((s) => s.taliSkinId);
  const setTaliSkin = useSettingsStore((s) => s.setTaliSkin);

  const streakCount = useProgressStore((s) => s.streakCount);
  const topics = useProgressStore((s) => s.topics);
  const xp = useProgressStore((s) => s.xp);
  const level = useProgressStore((s) => s.level);
  const achievements = useProgressStore((s) => s.achievements);
  const globalCorrectCount = useProgressStore((s) => s.globalCorrectCount);
  const ownedCount = useCollectiblesStore((s) => s.ownedCount);

  const TOTAL_ACHIEVEMENTS = 10;

  const xpInfo = getXPToNextLevel(xp);
  const unlockedAchievements = Object.values(achievements).filter(Boolean).length;
  const totalAchievements = TOTAL_ACHIEVEMENTS;

  const lessonsCompleted = Object.values(topics).reduce(
    (sum, tp) => sum + Object.values(tp?.completedLessons ?? {}).filter(Boolean).length,
    0,
  );

  const childMode = profile?.child_mode ?? 'standard';
  const userEmail = user?.email ?? null;
  return (
    <Screen scroll>
      <AppText variant="title" accessibilityRole="header">
        {t('profile.title')}
      </AppText>

      <Spacer size="md" />

      {/* Hero card – level + XP */}
      <Card
        style={{
          alignItems: 'center',
          paddingVertical: theme.spacing.xl,
          backgroundColor: theme.colors.primary + '12',
          borderWidth: 2,
          borderColor: theme.colors.primary + '30',
        }}
      >
        <TaliVideo emotion="default" size={120} bgColor={theme.colors.primary + '12'} />
        <Spacer size="xs" />
        <AppText
          variant="subtitle"
          style={{ color: theme.colors.primary, fontWeight: '800' }}
        >
          {t('profile.progressLevel', { level })}
        </AppText>

        {/* XP bar */}
        <View style={{ width: '100%', marginTop: theme.spacing.md }}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}
          >
            <AppText variant="small" style={{ color: theme.colors.textMuted }}>
              {xpInfo.current} / {xpInfo.needed} XP
            </AppText>
            <AppText variant="small" style={{ color: theme.colors.primary, fontWeight: '700' }}>
              {t('profile.xpLabel', { xp })}
            </AppText>
          </View>
          <View
            style={{
              height: 10,
              backgroundColor: theme.colors.border,
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${Math.round((xpInfo.current / xpInfo.needed) * 100)}%`,
                backgroundColor: theme.colors.primary,
                borderRadius: 6,
              }}
            />
          </View>
        </View>
      </Card>

      <Spacer size="md" />

      {/* Stats row */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {/* Lessons card */}
        <Card
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: theme.spacing.lg,
            borderWidth: 2,
            borderColor: theme.colors.primary,
          }}
        >
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: theme.colors.primary + '22',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 6,
          }}>
            <NanoBananaIcon source={NANO_UI.book} size={24} />
          </View>
          <AppText
            style={{
              fontSize: 56,
              fontFamily: 'Nunito_800ExtraBold',
              color: theme.colors.primary,
              lineHeight: 64,
            }}
          >
            {lessonsCompleted}
          </AppText>
          <AppText variant="small" style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 2 }}>
            {t('profile.lessonsLabel', { count: lessonsCompleted })}
          </AppText>
        </Card>

        {/* Streak card */}
        <Card
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: theme.spacing.lg,
            borderWidth: 2,
            borderColor: '#FF7A38',
          }}
        >
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: '#FF7A3822',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 6,
          }}>
            <NanoBananaIcon source={NANO_UI.streak} size={24} />
          </View>
          <AppText
            style={{
              fontSize: 56,
              fontFamily: 'Nunito_800ExtraBold',
              color: '#FF7A38',
              lineHeight: 64,
            }}
          >
            {streakCount}
          </AppText>
          <AppText variant="small" style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 2 }}>
            {t('profile.streakDaysLabel', { count: streakCount })}
          </AppText>
        </Card>

        {/* Correct answers card */}
        <Card
          style={{
            flex: 1,
            alignItems: 'center',
            paddingVertical: theme.spacing.lg,
            borderWidth: 2,
            borderColor: theme.colors.success,
          }}
        >
          <View style={{
            width: 48, height: 48, borderRadius: 24,
            backgroundColor: theme.colors.success + '22',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 6,
          }}>
            <NanoBananaIcon source={NANO_UI.check} size={24} />
          </View>
          <AppText
            style={{
              fontSize: 56,
              fontFamily: 'Nunito_800ExtraBold',
              color: theme.colors.success,
              lineHeight: 64,
            }}
          >
            {globalCorrectCount}
          </AppText>
          <AppText variant="small" style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 2 }}>
            {t('profile.correctLabel')}
          </AppText>
        </Card>
      </View>

      <Spacer size="md" />

      {/* Achievements + Collection links */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => router.push('/achievements')}
          accessibilityRole="button"
        >
          <Card
            style={{
              alignItems: 'center',
              paddingVertical: theme.spacing.lg,
              backgroundColor: theme.colors.accent + '20',
              borderWidth: 2,
              borderColor: theme.colors.accent + '60',
            }}
          >
            <NanoBananaIcon source={NANO_UI.trophy} size={32} />
            <AppText
              variant="small"
              style={{ fontWeight: '700', marginTop: 6, textAlign: 'center' }}
            >
              {t('profile.achievementsLink')}
            </AppText>
            <AppText style={{ color: theme.colors.primary, fontWeight: '800', fontSize: 18 }}>
              {unlockedAchievements}/{totalAchievements}
            </AppText>
          </Card>
        </Pressable>

        <Pressable
          style={{ flex: 1 }}
          onPress={() => router.push('/collection')}
          accessibilityRole="button"
        >
          <Card
            style={{
              alignItems: 'center',
              paddingVertical: theme.spacing.lg,
              backgroundColor: theme.colors.secondary + '15',
              borderWidth: 2,
              borderColor: theme.colors.secondary + '40',
            }}
          >
            <NanoBananaIcon source={NANO_UI.backpack} size={32} />
            <AppText
              variant="small"
              style={{ fontWeight: '700', marginTop: 6, textAlign: 'center' }}
            >
              {t('profile.collectionLink')}
            </AppText>
            <AppText style={{ color: theme.colors.secondary, fontWeight: '800', fontSize: 18 }}>
              {ownedCount()} / {Object.keys(COLLECTIBLES_META).length}
            </AppText>
          </Card>
        </Pressable>
      </View>

      <Spacer size="md" />

      {/* Tali skin picker */}
      <Card style={{ marginBottom: theme.spacing.md }}>
        <AppText variant="subtitle" style={{ marginBottom: theme.spacing.sm }}>
          {t('profile.taliSkinTitle')}
        </AppText>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          {TALI_SKINS.map((skin) => {
            const selected = taliSkinId === skin.id;
            return (
              <Pressable
                key={skin.id}
                onPress={() => setTaliSkin(skin.id)}
                accessibilityRole="button"
                style={{ flex: 1, minWidth: '20%' }}
              >
                <View
                  style={{
                    alignItems: 'center',
                    paddingVertical: theme.spacing.sm,
                    paddingHorizontal: theme.spacing.xs,
                    borderRadius: theme.radii.md,
                    backgroundColor: selected ? skin.color + '20' : theme.colors.surfaceAlt,
                    borderWidth: 2,
                    borderColor: selected ? skin.color : theme.colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: skin.color,
                    }}
                  />
                  <AppText
                    style={{
                      fontSize: 9,
                      fontWeight: '700',
                      color: selected ? skin.color : theme.colors.textMuted,
                      textAlign: 'center',
                      marginTop: 3,
                    }}
                  >
                    {t(skin.labelKey)}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {/* Account info */}
      <Card>
        <AppText variant="subtitle" style={{ marginBottom: theme.spacing.sm }}>
          {t('profile.accountTitle')}
        </AppText>

        <View style={{ gap: theme.spacing.sm }}>
          {userEmail ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <MaterialIcons name="email" size={20} color={theme.colors.textMuted} />
              <View style={{ flex: 1 }}>
                <AppText variant="small" style={{ color: theme.colors.textMuted }}>
                  {t('profile.emailLabel')}
                </AppText>
                <AppText variant="small" style={{ fontWeight: '600' }}>{userEmail}</AppText>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <MaterialIcons name="sports-esports" size={20} color={theme.colors.textMuted} />
              <View style={{ flex: 1 }}>
                <AppText variant="small" style={{ color: theme.colors.textMuted }}>
                  {t('profile.modeLabel')}
                </AppText>
                <AppText variant="small" style={{ fontWeight: '600' }}>
                  {t('profile.demoMode')}
                </AppText>
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <NanoBananaIcon source={NANO_UI.book} size={20} />
            <View style={{ flex: 1 }}>
              <AppText variant="small" style={{ color: theme.colors.textMuted }}>
                {t('auth.childModeLabel')}
              </AppText>
              <AppText variant="small" style={{ fontWeight: '600' }}>
                {childMode === 'standard'
                  ? t('auth.childModeStandard')
                  : `${t('auth.childModeSpecial')} · ${methodology}`}
              </AppText>
            </View>
          </View>

          {isPremium && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <NanoBananaIcon source={NANO_UI.stars} size={20} />
              <View style={{ flex: 1 }}>
                <AppText variant="small" style={{ color: theme.colors.secondary, fontWeight: '700' }}>
                  Premium
                </AppText>
              </View>
            </View>
          )}
        </View>
      </Card>

      <Spacer size="md" />

      <Button
        variant="secondary"
        onPress={() => router.push('/parent-report')}
      >
        {t('profile.parentReportLink')}
      </Button>

      <Spacer size="sm" />

      <Button
        variant="secondary"
        onPress={() => router.push('/tali-safety-log')}
      >
        {t('taliSafetyLog.link')}
      </Button>

      <Spacer size="xl" />
    </Screen>
  );
}
