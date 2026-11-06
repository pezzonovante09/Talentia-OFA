/**
 * Тема родительского раздела — отдельная от детской (`PARENT.md`, «Визуальный язык»): та же
 * бумага без теплоты, без контура, подушки и Tali. Схема — системная; calm / focus /
 * density сюда не проходят.
 */
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { buildParentTheme, parentPressed, type ParentTheme } from '../../design/parentTokens';

export type ParentThemeWithPressed = ParentTheme & { pressed: (typeof parentPressed)['light'] };

const Ctx = createContext<ParentThemeWithPressed>({ ...buildParentTheme('light'), pressed: parentPressed.light });

export function ParentThemeProvider({ children }: PropsWithChildren) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = useMemo(() => ({ ...buildParentTheme(scheme), pressed: parentPressed[scheme] }), [scheme]);
  return <Ctx.Provider value={theme}>{children}</Ctx.Provider>;
}

export const useParentTheme = (): ParentThemeWithPressed => useContext(Ctx);
