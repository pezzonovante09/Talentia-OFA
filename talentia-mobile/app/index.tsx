import React, { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/theme';
import { useSettingsStore } from '../src/store/settingsStore';

export default function Index() {
  const session = useAuth((s) => s.session);
  const profileCompleted = useAuth((s) => s.profileCompleted);
  const loading = useAuth((s) => s.loading);
  const theme = useAppTheme();
  const onboardingCompleted = useSettingsStore((s) => s.onboardingCompleted);

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!profileCompleted) {
    return <Redirect href="/(auth)/parent-setup" />;
  }

  if (!onboardingCompleted) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(tabs)/map" />;
}
