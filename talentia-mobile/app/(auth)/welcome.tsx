import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '../../src/components/Screen';
import { AppText } from '../../src/components/Text';
import { Spacer } from '../../src/components/Spacer';
import { Button } from '../../src/components/Button';
import { useAppTheme } from '../../src/theme';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: theme.spacing.xl }}>
        <AppText variant="title" style={{ textAlign: 'center', lineHeight: 36 }}>
          {t('auth.welcomeTitle')}
        </AppText>
        <Spacer size="lg" />
        <AppText style={{ textAlign: 'center', color: theme.colors.textMuted, lineHeight: 22, fontSize: 16 }}>
          {t('auth.welcomeSubtitle')}
        </AppText>
        <Spacer size="xl" />
        <Button
          onPress={() => router.push('/(auth)/login')}
          style={{ minWidth: 220 }}
        >
          {t('auth.login')}
        </Button>
        <Spacer size="md" />
        <Button
          variant="secondary"
          onPress={() => router.push('/(auth)/signup')}
          style={{ minWidth: 220 }}
        >
          {t('auth.signUp')}
        </Button>
      </View>
    </Screen>
  );
}
