/**
 * Инициализация i18next (AUDIT.md А23, решение №78 «нет перевода — нет урока»).
 *
 * Запасного языка нет: `fallbackLng: false`. Ребёнок с ky-интерфейсом не должен услышать русскую
 * реплику под видом кыргызской — отсутствие ключа видно (`i18n.exists`), и урок без перевода на
 * карте помечается, а не открывается (`domain/lessonKeys.ts`, `lessonAvailable`).
 *
 * Ресурсы лежат в бандле, инициализация синхронна (`initImmediate: false`): к первому рендеру
 * строки уже есть, экран не мигает ключами.
 */
import { getLocales } from 'expo-localization';
import { createInstance, type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { InterfaceLang } from '../domain/regionVisibility';
import en from './locales/en.json';
import ky from './locales/ky.json';
import ru from './locales/ru.json';

export const INTERFACE_LANGS: readonly InterfaceLang[] = ['ru', 'en', 'ky'];

export const resources = {
  ru: { translation: ru },
  en: { translation: en },
  ky: { translation: ky },
} as const;

/** Язык устройства, если он один из трёх; иначе русский (основной язык выпуска, №126). */
export function deviceLang(): InterfaceLang {
  const code = getLocales()[0]?.languageCode ?? '';
  return (INTERFACE_LANGS as readonly string[]).includes(code) ? (code as InterfaceLang) : 'ru';
}

const i18next: i18n = createInstance();

/** Один раз на старте приложения; повторный вызов только переключает язык. */
export function initI18n({ lng }: { lng: InterfaceLang }): i18n {
  if (i18next.isInitialized) {
    if (i18next.language !== lng) void i18next.changeLanguage(lng);
    return i18next;
  }
  void i18next.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: false,
    initImmediate: false,
    returnNull: false,
    // Пустой ключ — ошибка контента, не повод показать «что-то»: экран проверяет `exists` заранее.
    returnEmptyString: false,
    interpolation: { escapeValue: false },
  });
  return i18next;
}

/** Есть ли ключ в текущем языке — без запасного языка это и есть «переведено». */
export const keyExists = (key: string): boolean => i18next.exists(key);

export default i18next;
