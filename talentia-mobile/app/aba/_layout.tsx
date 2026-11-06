/**
 * Детский путь занятия ABA (этап 11): только внутри сеанса ребёнка с аккаунтом — без записи (режим без записи) ABA
 * нет совсем: без согласия на данные сессии не бывает (спецификация п. 12).
 */
import { Redirect, Stack } from 'expo-router';

import { useChildSession } from '../../src/state/childSession';
import { RequireSession } from '../../src/ui/RequireSession';

export default function AbaLayout() {
  const mode = useChildSession((s) => s.mode);
  if (mode === 'no_record') return <Redirect href="/map" />;
  return (
    <RequireSession>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false, animation: 'none' }} />
    </RequireSession>
  );
}
