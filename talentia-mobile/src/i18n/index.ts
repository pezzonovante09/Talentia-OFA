import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import ru from './locales/ru.json';
import ky from './locales/ky.json';

export const resources = {
  en: { translation: en },
  ru: { translation: ru },
  ky: { translation: ky },
} as const;

export type SupportedLanguage = keyof typeof resources;

const fallback: SupportedLanguage = 'ru';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: fallback,
    /** Если в en/ky нет строки задания — показываем русский текст вместо сырого ключа. */
    fallbackLng: {
      en: ['en', 'ru'],
      ky: ['ky', 'ru'],
      default: ['ru'],
    },
    compatibilityJSON: 'v4',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });
}

export default i18n;

