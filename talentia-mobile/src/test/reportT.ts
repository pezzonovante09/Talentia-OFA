/**
 * `t` на русском словаре для тестов отчёта специалисту (`specialistReportHtml.ts`): отдельный экземпляр i18next,
 * без `initI18n` приложения, с теми же настройками — без запасного языка, без экранирования (его делает отчёт).
 */
import { createInstance } from 'i18next';

import en from '../i18n/locales/en.json';
import ru from '../i18n/locales/ru.json';
import type { ReportT } from '../services/local/specialistReportHtml';

export function reportT(lng: 'ru' | 'en' = 'ru'): ReportT {
  const i18n = createInstance();
  void i18n.init({
    resources: { ru: { translation: ru }, en: { translation: en } },
    lng,
    fallbackLng: false,
    initImmediate: false,
    returnNull: false,
    returnEmptyString: false,
    interpolation: { escapeValue: false },
  });
  return (key, options) => i18n.t(key, options);
}
