/**
 * Экраны детского пути существуют только внутри сеанса ребёнка: без него (холодный старт по
 * глубокой ссылке, перезагрузка на web) — на первый запуск.
 */
import { Redirect } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { useChildSession } from '../state/childSession';

export function RequireSession({ children }: PropsWithChildren) {
  const mode = useChildSession((s) => s.mode);
  if (mode === 'none') return <Redirect href="/" />;
  return <>{children}</>;
}
