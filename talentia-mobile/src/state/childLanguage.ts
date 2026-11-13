/**
 * Язык детских экранов следует за сессией ребёнка (№190): начало сессии — язык его профиля, конец — язык взрослого.
 * Подписка на стор, а не эффект экрана: язык меняется синхронно со сменой сессии, до перерисовки карты.
 */
import type { InterfaceLang } from '../domain/regionVisibility';
import { setChildLang } from '../i18n';
import { useChildSession } from './childSession';

export function bindChildLanguage(): () => void {
  let last: InterfaceLang | null | undefined;
  const apply = () => {
    const s = useChildSession.getState();
    const lang = s.mode === 'none' ? null : s.settings.interfaceLang;
    if (lang === last) return;
    last = lang;
    setChildLang(lang);
  };
  apply();
  return useChildSession.subscribe(apply);
}
