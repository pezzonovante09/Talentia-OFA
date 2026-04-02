import React, { PropsWithChildren, createContext, useContext, useMemo } from 'react';
import { DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '../store/settingsStore';

export type AppTheme = {
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    textMuted: string;
    border: string;
    success: string;
    error: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  typography: {
    title: number;
    subtitle: number;
    body: number;
    small: number;
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
    pill: number;
  };
  calmMode: boolean;
  focusMode: boolean;
};

const baseTheme: Omit<AppTheme, 'calmMode' | 'focusMode'> = {
  colors: {
    background: '#EBF9FF',
    surface: '#FFFFFF',
    surfaceAlt: '#D6F5EF',
    primary: '#0DBFB2',
    secondary: '#FF7A38',
    accent: '#FFD060',
    text: '#0E2B3B',
    textMuted: '#5D7D8E',
    border: '#BAE0EC',
    success: '#05C896',
    error: '#FF3D60',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 14,
    lg: 22,
    xl: 32,
  },
  typography: {
    title: 28,
    subtitle: 20,
    body: 17,
    small: 14,
  },
  radii: {
    sm: 14,
    md: 24,
    lg: 32,
    pill: 999,
  },
};

const ThemeContext = createContext<AppTheme>({
  ...baseTheme,
  calmMode: false,
  focusMode: false,
});

function buildTheme({
  calmMode,
  focusMode,
  systemScheme,
}: {
  calmMode: boolean;
  focusMode: boolean;
  systemScheme: 'light' | 'dark' | null | undefined;
}): AppTheme {
  const multiplier = focusMode ? 1.2 : 1;

  const colors =
    calmMode && systemScheme === 'dark'
      ? {
          ...baseTheme.colors,
          background: '#0F2027',
          surface: '#172A34',
          surfaceAlt: '#1F3642',
          text: '#F5FCFF',
          textMuted: '#9CB4C0',
          border: '#284452',
          primary: '#16A5B0',
          secondary: '#FF9E66',
          accent: '#FFDF85',
        }
      : calmMode
      ? {
          background: '#EEF8F2',
          surface: '#F5FCF8',
          surfaceAlt: '#E0F2EA',
          primary: '#3BBFB7',
          secondary: '#E8AC7A',
          accent: '#F0DA90',
          text: '#1A2E26',
          textMuted: '#6A9880',
          border: '#BAE0CE',
          success: '#28B278',
          error: '#E05A6A',
        }
      : baseTheme.colors;

  return {
    colors,
    spacing: {
      xs: baseTheme.spacing.xs * multiplier,
      sm: baseTheme.spacing.sm * multiplier,
      md: baseTheme.spacing.md * multiplier,
      lg: baseTheme.spacing.lg * multiplier,
      xl: baseTheme.spacing.xl * multiplier,
    },
    typography: {
      title: baseTheme.typography.title * multiplier,
      subtitle: baseTheme.typography.subtitle * multiplier,
      body: baseTheme.typography.body * multiplier,
      small: baseTheme.typography.small * multiplier,
    },
    radii: baseTheme.radii,
    calmMode,
    focusMode,
  };
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const calmMode = useSettingsStore((state) => state.calmMode);
  const focusMode = useSettingsStore((state) => state.focusMode);
  const systemScheme = useColorScheme();

  const appTheme = useMemo(
    () => buildTheme({ calmMode, focusMode, systemScheme }),
    [calmMode, focusMode, systemScheme],
  );

  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: appTheme.colors.background,
        card: appTheme.colors.surface,
        primary: appTheme.colors.primary,
        text: appTheme.colors.text,
        border: appTheme.colors.border,
      },
    }),
    [appTheme],
  );

  return (
    <ThemeContext.Provider value={appTheme}>
      <NavigationThemeProvider value={navigationTheme}>{children}</NavigationThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

