/**
 * Корень приложения на время пересборки. Экраны в коде не делаются: внешний вид собирается
 * в Claude Design, фронт потом пишется с нуля (REBUILD.md, «Как сейчас устроена работа»).
 * Прежнее приложение удалено 2026-10-01 — оно не было опубликовано.
 */
import { Slot } from 'expo-router';

import { DesignProvider } from '../src/design';

export default function RootLayout() {
  return (
    <DesignProvider>
      <Slot />
    </DesignProvider>
  );
}
