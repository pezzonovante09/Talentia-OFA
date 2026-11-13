/**
 * Выход из занятия ABA: на карту ребёнка. Если ради занятия сменили живую сессию (`openedForAba`, `app/parent/aba`), — к
 * выбору профиля: на карте нет имени и пути обратно, и следующие уроки первого ребёнка ушли бы второму. Режимы calm и focus
 * ребёнка переживают сброс: экран выбора не меняет ему тему. Карта та же проверка страхует все прочие пути (`app/map.tsx`).
 */
import type { useRouter } from 'expo-router';

import { ABA_ONLY } from '../../services/buildScope';
import { useChildSession } from '../../state/childSession';

export function leaveAba(router: ReturnType<typeof useRouter>): void {
  const session = useChildSession.getState();
  // в сборке «только ABA» (№195) карты нет — всегда к выбору профиля
  if (!session.openedForAba && !ABA_ONLY) {
    router.dismissTo('/map');
    return;
  }
  const { calmMode, focusMode } = session.settings;
  session.reset();
  useChildSession.getState().setSettings({ calmMode, focusMode });
  // в сборке «только ABA» первый экран часто уже в стеке: вернуться к нему, а не класть копию (правка 8);
  // если его нет — `dismissTo` заменяет текущий экран, как `replace`
  if (ABA_ONLY) router.dismissTo('/');
  else router.replace('/');
}
