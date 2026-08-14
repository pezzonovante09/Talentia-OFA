import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  useFonts,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';

import { AppThemeProvider, useAppTheme } from '../src/theme';
import i18n from '../src/i18n';
import { checkEnvInDev } from '../src/utils/envCheck';
import { useSettingsStore } from '../src/store/settingsStore';
import { useTranslation } from 'react-i18next';
import { AuthProvider } from '../src/context/AuthContext';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { initSentry, Sentry } from '../src/services/sentry';

SplashScreen.preventAutoHideAsync();
checkEnvInDev();
initSentry();

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function RootStack() {
  const { t } = useTranslation();
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontSize: theme.typography.subtitle,
          fontWeight: '700',
        },
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="lesson/[lessonId]"
        options={{
          headerShown: true,
          title: t('lesson.header'),
        }}
      />
      <Stack.Screen
        name="tali"
        options={{
          headerShown: true,
          title: t('tali.title'),
        }}
      />
      <Stack.Screen
        name="parent-report"
        options={{
          headerShown: true,
          title: t('parentReport.title'),
        }}
      />
      <Stack.Screen
        name="tali-safety-log"
        options={{
          headerShown: true,
          title: t('taliSafetyLog.title'),
        }}
      />
      <Stack.Screen
        name="collection"
        options={{
          headerShown: true,
          title: t('collection.title'),
        }}
      />
      <Stack.Screen
        name="achievements"
        options={{
          headerShown: true,
          title: t('achievements.title'),
        }}
      />
    </Stack>
  );
}

function RootLayout() {
  const language = useSettingsStore((state) => state.language);
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        const { syncWithRetry } = require('../src/services/syncStatus');
        void syncWithRetry('layout:flushAnalyticsQueue', () =>
          require('../src/store/analyticsQueueStore').useAnalyticsQueueStore.getState().flushQueue(),
        );
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <AppThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <StatusBar style="dark" />
          <RootStack />
        </AuthProvider>
      </ErrorBoundary>
    </AppThemeProvider>
  );
}

export default Sentry.wrap(RootLayout);
