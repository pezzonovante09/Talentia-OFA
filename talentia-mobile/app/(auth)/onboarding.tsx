import React, { useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NanoBananaIcon } from '../../src/components/NanoBananaIcon';
import { NANO_UI } from '../../src/constants/nanoBananaAssets';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { Spacer } from '../../src/components/Spacer';
import { Button } from '../../src/components/Button';
import { TaliVideo } from '../../src/components/TaliVideo';
import { useAppTheme } from '../../src/theme';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useProgressStore } from '../../src/store/progressStore';
import { useCollectiblesStore } from '../../src/store/collectiblesStore';

const STEPS = [
  {
    titleKey: 'onboarding.step1Title',
    bodyKey: 'onboarding.step1Body',
    bg: '#18C1B5',
    video: true as const,
  },
  {
    titleKey: 'onboarding.step2Title',
    bodyKey: 'onboarding.step2Body',
    bg: '#FF9E66',
    icon: 'explore' as const,
  },
  {
    titleKey: 'onboarding.step3Title',
    bodyKey: 'onboarding.step3Body',
    bg: '#4CAF50',
    icon: 'park' as const,
  },
];

const WELCOME_XP = 20;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();
  const setOnboardingCompleted = useSettingsStore((s) => s.setOnboardingCompleted);
  const addXP = useProgressStore((s) => s.addXP);
  const addItem = useCollectiblesStore((s) => s.addItem);

  const [step, setStep] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const pulse = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.2, duration: 180, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const handleNext = () => {
    pulse();
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    addXP(WELCOME_XP);
    addItem('tali_egg');
    setOnboardingCompleted();
    router.replace('/(tabs)/map');
  };

  const handleSkip = () => {
    addXP(WELCOME_XP);
    addItem('tali_egg');
    setOnboardingCompleted();
    router.replace('/(tabs)/map');
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: theme.spacing.lg }}>

        {/* Header skip */}
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable onPress={handleSkip} accessibilityRole="button">
            <AppText variant="small" style={{ color: theme.colors.textMuted }}>
              {t('onboarding.skipButton')}
            </AppText>
          </Pressable>
        </View>

        {/* Main card */}
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View
              style={{
                width: 140,
                height: 140,
                borderRadius: 70,
                backgroundColor: current.bg + '22',
                borderWidth: 3,
                borderColor: current.bg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: theme.spacing.xl,
                overflow: 'hidden',
              }}
            >
              {'video' in current && current.video ? (
                <TaliVideo emotion="friendly" size={130} bgColor={current.bg + '22'} />
              ) : (
                <MaterialIcons name={'icon' in current ? current.icon : 'explore'} size={72} color={current.bg} />
              )}
            </View>
          </Animated.View>

          <AppText
            variant="title"
            style={{ textAlign: 'center', color: theme.colors.text }}
            accessibilityRole="header"
          >
            {t(current.titleKey)}
          </AppText>
          <Spacer size="md" />
          <AppText
            style={{
              textAlign: 'center',
              color: theme.colors.textMuted,
              paddingHorizontal: theme.spacing.lg,
              lineHeight: 24,
            }}
          >
            {t(current.bodyKey)}
          </AppText>

          {isLast && (
            <>
              <Spacer size="lg" />
              <View
                style={{
                  backgroundColor: theme.colors.success + '22',
                  borderRadius: theme.radii.lg,
                  padding: theme.spacing.md,
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <NanoBananaIcon source={NANO_UI.gift} size={36} />
                <Spacer size="xs" />
                <AppText
                  variant="small"
                  style={{ color: theme.colors.success, fontWeight: '700', textAlign: 'center' }}
                >
                  {t('onboarding.welcomeReward')}
                </AppText>
                <AppText variant="small" style={{ color: theme.colors.textMuted, textAlign: 'center' }}>
                  {t('onboarding.reward', { xp: WELCOME_XP })}
                </AppText>
              </View>
            </>
          )}
        </View>

        {/* Step dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: theme.spacing.lg }}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === step ? theme.colors.primary : theme.colors.border,
              }}
            />
          ))}
        </View>

        {/* Buttons */}
        <Button onPress={handleNext}>
          {isLast ? t('onboarding.startButton') : t('onboarding.nextButton')}
        </Button>
      </View>
    </Screen>
  );
}
