import React, { useRef, useEffect } from 'react';
import { Animated, Platform, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../src/theme';
import { TaliFAB } from '../../src/components/TaliFAB';
import { NanoBananaIcon } from '../../src/components/NanoBananaIcon';
import { NANO_UI } from '../../src/constants/nanoBananaAssets';
import { useAuth } from '../../src/context/AuthContext';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

function AnimatedTabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: IconName;
  color: string;
  size: number;
  focused: boolean;
}) {
  const scale = useRef(new Animated.Value(focused ? 1.15 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.15 : 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 10,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <MaterialIcons name={name} color={color} size={size + 4} />
    </Animated.View>
  );
}

function AnimatedTabRasterIcon({
  source,
  size,
  focused,
}: {
  source: ImageSourcePropType;
  size: number;
  focused: boolean;
}) {
  const scale = useRef(new Animated.Value(focused ? 1.15 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.15 : 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 10,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <NanoBananaIcon
        source={source}
        size={size + 4}
        style={{ opacity: focused ? 1 : 0.62 }}
      />
    </Animated.View>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const session = useAuth((s) => s.session);
  const profileCompleted = useAuth((s) => s.profileCompleted);
  const loading = useAuth((s) => s.loading);

  // Deep links into /(tabs)/* must not bypass parental-consent / parent-setup.
  if (!loading && session && !profileCompleted) {
    return <Redirect href="/(auth)/parent-setup" />;
  }

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      initialRouteName="map"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          shadowColor: '#0E2B3B',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: 2,
          ...(Platform.OS === 'android'
            ? { fontFamily: 'sans-serif', fontWeight: '600' }
            : { fontFamily: 'Nunito_600SemiBold' }),
        },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: t('tabs.map'),
          tabBarLabel: t('tabs.map'),
          tabBarAccessibilityLabel: t('tabs.map'),
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="map" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarLabel: t('tabs.profile'),
          tabBarAccessibilityLabel: t('tabs.profile'),
          tabBarIcon: ({ size, focused }) => (
            <AnimatedTabRasterIcon source={NANO_UI.book} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarLabel: t('tabs.settings'),
          tabBarAccessibilityLabel: t('tabs.settings'),
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon name="tune" color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs>
    <TaliFAB withTabBar />
    </View>
  );
}
