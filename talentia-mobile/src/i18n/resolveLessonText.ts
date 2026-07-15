import abaTextOverridesRu from './locales/abaTextOverrides.generated.json';
import abaTextOverridesEn from './locales/abaTextOverrides.en.generated.json';
import abaTextOverridesKy from './locales/abaTextOverrides.ky.generated.json';
import type { SupportedLanguage } from './index';

const BY_LOCALE: Record<SupportedLanguage, Record<string, string>> = {
  ru: abaTextOverridesRu as Record<string, string>,
  en: abaTextOverridesEn as Record<string, string>,
  ky: abaTextOverridesKy as Record<string, string>,
};

function normalizeLang(lng: string | undefined): SupportedLanguage {
  if (lng === 'en' || lng === 'ky' || lng === 'ru') return lng;
  return 'ru';
}

/** ABA-override для конкретного языка (без fallback на другие локали). */
export function getAbaTextOverride(key: string, lng: SupportedLanguage | string = 'ru'): string | undefined {
  const lang = normalizeLang(lng);
  const over = BY_LOCALE[lang][key];
  return typeof over === 'string' && over.trim() ? over : undefined;
}

/**
 * ABA-редакция текстов урока (0–4 класс).
 * EN/KY без ABA-перевода → стандартный t(key), не русский ABA-текст.
 */
export function resolveLessonTextKey(
  key: string,
  t: (k: string) => string,
  useAbaPedagogy: boolean,
  lng: SupportedLanguage | string = 'ru',
): string {
  if (!useAbaPedagogy) return t(key);

  const lang = normalizeLang(lng);
  const localized = getAbaTextOverride(key, lang);
  if (localized) return localized;

  if (lang === 'ru') {
    const ruOver = getAbaTextOverride(key, 'ru');
    if (ruOver) return ruOver;
  } else {
    const standard = t(key);
    if (standard !== key) return standard;
    const ruOver = getAbaTextOverride(key, 'ru');
    if (ruOver) return ruOver;
  }

  return t(key);
}

export const ABA_TEXT_OVERRIDE_COUNT = Object.keys(BY_LOCALE.ru).length;
