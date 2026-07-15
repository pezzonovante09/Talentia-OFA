import React, { useEffect, useMemo } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from './Text';
import { Button } from './Button';
import { Spacer } from './Spacer';
import { useAppTheme } from '../theme';

const TOKEN_COIN = require('../../assets/images/aba/aba-token-coin.webp');

const STAGGER_MS = 60;
const POP_DURATION_MS = 360;

type Props = {
  tokensEarned: number;
  onContinue: () => void;
};

export function ABATokenReward({ tokensEarned, onContinue }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const count = Math.max(0, tokensEarned);

  const progressValues = useMemo(
    () => Array.from({ length: count }, () => new Animated.Value(0)),
    [count],
  );

  useEffect(() => {
    progressValues.forEach((v: Animated.Value) => v.setValue(0));
    if (progressValues.length === 0) return;
    const animations = progressValues.map((v: Animated.Value) =>
      Animated.timing(v, {
        toValue: 1,
        duration: POP_DURATION_MS,
        easing: Easing.out(Easing.back(1.35)),
        useNativeDriver: true,
      }),
    );
    Animated.stagger(STAGGER_MS, animations).start();
  }, [count, progressValues]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.xl }}>
      <AppText variant="title" style={{ textAlign: 'center', marginBottom: theme.spacing.md }}>
        {t('lesson.abaTokenRewardTitle')}
      </AppText>
      <AppText
        variant="body"
        style={{ textAlign: 'center', color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}
      >
        {t('lesson.abaTokenRewardBody', { count: tokensEarned })}
      </AppText>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
        {Array.from({ length: count }, (_, i) => {
          const v = progressValues[i]!;
          const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });
          const opacity = v;
          return (
            <Animated.View
              key={i}
              style={{
                opacity,
                transform: [{ scale }],
              }}
            >
              <Image
                source={TOKEN_COIN}
                style={{ width: 56, height: 56 }}
                resizeMode="contain"
                accessibilityLabel="token"
              />
            </Animated.View>
          );
        })}
      </View>
      <Spacer size="xl" />
      <Button onPress={onContinue}>{t('lesson.abaTokenContinue')}</Button>
    </View>
  );
}
