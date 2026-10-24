/**
 * Рендер экранов в тестах: i18n на нужном языке, тема (calm / focus / схема) и безопасные зоны SE.
 * Роутер мокается в самом тесте (`jest.mock('expo-router', ...)`), чтобы проверять переходы.
 */
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { DesignProvider } from '../design';
import type { InterfaceLang } from '../domain/regionVisibility';
import { initI18n } from '../i18n';

/** iPhone SE: safe area 20 сверху, 0 снизу — устройство-минимум спецификации. */
export const SE_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 375, height: 667 },
  insets: { top: 20, left: 0, right: 0, bottom: 0 },
};

export type RenderWithProvidersOptions = RenderOptions & {
  lng?: InterfaceLang;
  calmMode?: boolean;
  focusMode?: boolean;
  metrics?: Metrics;
};

export function renderWithProviders(ui: ReactElement, { lng = 'ru', calmMode = false, focusMode = false, metrics = SE_METRICS, ...options }: RenderWithProvidersOptions = {}) {
  initI18n({ lng });
  return render(ui, {
    wrapper: ({ children }) => (
      <SafeAreaProvider initialMetrics={metrics}>
        <DesignProvider calmMode={calmMode} focusMode={focusMode}>{children}</DesignProvider>
      </SafeAreaProvider>
    ),
    ...options,
  });
}

export * from '@testing-library/react-native';
