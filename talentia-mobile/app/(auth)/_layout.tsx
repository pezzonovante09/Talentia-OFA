import React from 'react';
import { Stack } from 'expo-router';

import { useAppTheme } from '../../src/theme';

export default function AuthLayout() {
  const theme = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontSize: theme.typography.subtitle, fontWeight: '700' },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: '' }} />
      <Stack.Screen name="signup" options={{ title: '' }} />
      <Stack.Screen name="parent-setup" options={{ title: '', headerBackTitle: '' }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
    </Stack>
  );
}
