/**
 * Провайдер дизайн-системы направления B.
 *
 * Живёт рядом со старым `src/theme/index.tsx` и не конфликтует с ним:
 * экраны, переведённые на новую систему, читают `useDesign()`,
 * остальные продолжают читать `useAppTheme()` из старой темы.
 */
import React, { PropsWithChildren, createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '../store/settingsStore';
import { type AppTheme, type Scheme, buildTheme } from './tokens';

export * from './tokens';

const DesignContext = createContext<AppTheme>(
  buildTheme({ scheme: 'light', calmMode: false, focusMode: false }),
);

export function DesignProvider({ children }: PropsWithChildren) {
  const calmMode = useSettingsStore((state) => state.calmMode);
  const focusMode = useSettingsStore((state) => state.focusMode);
  const systemScheme = useColorScheme();

  // Схема — независимая ось. Старая тема включала тёмные цвета только
  // при `calmMode && systemScheme === 'dark'`, поэтому ребёнок с системной
  // тёмной темой и без спокойного режима получал светлый фон ночью.
  const scheme: Scheme = systemScheme === 'dark' ? 'dark' : 'light';

  const theme = useMemo(
    () => buildTheme({ scheme, calmMode, focusMode }),
    [scheme, calmMode, focusMode],
  );

  return <DesignContext.Provider value={theme}>{children}</DesignContext.Provider>;
}

export function useDesign(): AppTheme {
  return useContext(DesignContext);
}

/**
 * Стиль «подушки» — замена тени в направлении B.
 *
 * Возвращает подложку, которую кладут ПОД фигуру: дубль того же силуэта
 * цветом контура, смещённый вниз. При нажатии фигура съезжает на ту же
 * величину и подушка исчезает — тактильность без прозрачности, одинаково
 * работает в обеих схемах.
 */
export function cushion(theme: AppTheme, level: 'flat' | 'raised' | 'overlay' = 'raised') {
  const offsetY = theme.elevation[level].offsetY;
  return {
    backgroundColor: theme.colors.outline,
    transform: [{ translateY: offsetY }],
  };
}

/** Смещение самой фигуры при нажатии: она садится на подушку. */
export function pressedOffset(theme: AppTheme, level: 'flat' | 'raised' | 'overlay' = 'raised') {
  return { transform: [{ translateY: theme.elevation[level].offsetY }] };
}
