/**
 * Провайдер дизайн-системы направления B.
 *
 * Экраны читают `useDesign()`. Спокойный и фокус-режим передаёт тот, кто хранит
 * настройки ребёнка, — провайдер сам их не хранит.
 */
import React, { PropsWithChildren, createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { type AppTheme, type Scheme, buildTheme } from './tokens';
import { useReduceMotion } from './useReduceMotion';

export * from './tokens';
export { useReduceMotion } from './useReduceMotion';

const DesignContext = createContext<AppTheme>(
  buildTheme({ scheme: 'light', calmMode: false, focusMode: false }),
);

export function DesignProvider({
  children,
  calmMode = false,
  focusMode = false,
}: PropsWithChildren<{ calmMode?: boolean; focusMode?: boolean }>) {
  const systemScheme = useColorScheme();

  // Схема — независимая ось. Старая тема включала тёмные цвета только
  // при `calmMode && systemScheme === 'dark'`, поэтому ребёнок с системной
  // тёмной темой и без спокойного режима получал светлый фон ночью.
  const scheme: Scheme = systemScheme === 'dark' ? 'dark' : 'light';
  // системное «уменьшить движение» складывается с calm в `theme.still` (аудит 2026-11-09, Ж9)
  const reduceMotion = useReduceMotion();

  const theme = useMemo(
    () => buildTheme({ scheme, calmMode, focusMode, reduceMotion }),
    [scheme, calmMode, focusMode, reduceMotion],
  );

  return <DesignContext.Provider value={theme}>{children}</DesignContext.Provider>;
}

export function useDesign(): AppTheme {
  return useContext(DesignContext);
}
