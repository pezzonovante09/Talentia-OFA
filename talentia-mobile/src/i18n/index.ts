/**
 * Инициализация i18next (AUDIT.md А23, решение №78 «нет перевода — нет урока»).
 *
 * Запасного языка нет: `fallbackLng: false`. Ребёнок с ky-интерфейсом не должен услышать русскую
 * реплику под видом кыргызской — отсутствие ключа видно (`i18n.exists`), и урок без перевода на
 * карте помечается, а не открывается (`domain/lessonKeys.ts`, `lessonAvailable`). По той же причине
 * язык интерфейса включается только с полным словарём (`UI_LANGS`, Ж17): иначе экран взрослых показал бы ключи.
 *
 * Ресурсы лежат в бандле, инициализация синхронна (`initImmediate: false`): к первому рендеру
 * строки уже есть, экран не мигает ключами.
 */
import { getLocales } from 'expo-localization';
import { createInstance, type i18n, type TFunction } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import type { InterfaceLang } from '../domain/regionVisibility';
import en from './locales/en.json';
import ky from './locales/ky.json';
import ru from './locales/ru.json';
import { PENDING_KEYS } from './pendingKeys';

export const INTERFACE_LANGS: readonly InterfaceLang[] = ['ru', 'en', 'ky'];

export const resources = {
  ru: { translation: ru },
  en: { translation: en },
  ky: { translation: ky },
} as const;

type Tree = { [k: string]: string | Tree };
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Основы ключей словаря: plural-суффиксы сворачиваются (у ru четыре формы, у en и ky две). */
function keyBases(tree: Tree, prefix = '', out = new Set<string>()): Set<string> {
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === 'string') out.add((prefix + k).replace(PLURAL_SUFFIX, ''));
    else keyBases(v, `${prefix}${k}.`, out);
  }
  return out;
}

/**
 * Что язык обязан покрыть, чтобы интерфейс включился: все ключи ru, **кроме** ждущих экранов (`PENDING_KEYS` — их
 * носитель не переводит) и текстов уроков (`content.<регион>.*`: непереведённый урок помечается на карте и не
 * открывается, №78, `lessonAvailable`). Общие разделы `content.common/skills/skillTips/regions/objects` — интерфейс
 * карты и раздела взрослых, они нужны (`localization-qa` по диффу этапа C).
 */
const CONTENT_SHARED = /^content\.(common|skills|skillTips|regions|objects)\./;
const gateKey = (k: string) => !PENDING_KEYS.includes(k) && (!k.startsWith('content.') || CONTENT_SHARED.test(k));
const RU_KEYS = new Set([...keyBases(ru as Tree)].filter(gateKey));
/** Словарь покрывает каждый ключ ru — без запасного языка это единственное условие, при котором экран не покажет ключ. */
const coversRu = (tree: Tree): boolean => {
  const own = keyBases(tree);
  for (const k of RU_KEYS) if (!own.has(k)) return false;
  return true;
};

/**
 * Языки, которые интерфейс вправе включить (Ж17): словарь полный относительно ru. Пока `ky.json` пишет носитель (№108),
 * ky здесь нет, и устройство с кыргызским получает русский интерфейс, а не сырые ключи. Список считается на старте по
 * бандлу; когда ky заполнится, язык включится сам — тогда же вернуть `ky` в `CFBundleLocalizations` (`app.json`).
 */
export const UI_LANGS: readonly InterfaceLang[] = INTERFACE_LANGS.filter((lang) => lang === 'ru' || coversRu(resources[lang].translation as Tree));

/**
 * Язык устройства: первый из списка языков устройства по порядку, чей словарь полный (`UI_LANGS`); иначе русский
 * (основной язык выпуска, №126). Весь список, а не первый (№190, `localization-qa`): у «Deutsch, English» —
 * английский, а не русский. Кыргызский, закрытый гейтом, сразу даёт русский, а не язык после него: «Кыргызча,
 * English» — семья из КР, и пятилетка английский не прочтёт. Когда ky откроется, правило отпадёт само.
 */
export function deviceLang(): InterfaceLang {
  for (const { languageCode } of getLocales()) {
    if (!languageCode) continue;
    if ((UI_LANGS as readonly string[]).includes(languageCode)) return languageCode as InterfaceLang;
    if (languageCode === 'ky') return 'ru';
  }
  return 'ru';
}

const i18next: i18n = createInstance();

/**
 * Два языка (№190, `localization-qa`): общий экземпляр — язык детских экранов (язык профиля ребёнка, пока идёт его
 * сессия, `setChildLang`), его клон — язык взрослого, то есть устройства: раздел взрослого, выбор профиля и экраны ABA
 * получают его через `I18nextProvider`, а не через `changeLanguage` по маршруту (раздел взрослого — модалка поверх
 * карты: карта под ним перерисовывалась бы туда и обратно, `consentLang` получил бы гонку). Словарь у них общий.
 */
let adult: i18n | null = null;

/**
 * Один раз на старте приложения, `lng` — язык устройства; повторный вызов (тесты) переключает оба экземпляра.
 */
export function initI18n({ lng }: { lng: InterfaceLang }): i18n {
  if (i18next.isInitialized) {
    if (i18next.language !== lng) void i18next.changeLanguage(lng);
    if (adult && adult.language !== lng) void adult.changeLanguage(lng);
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
  adult = i18next.cloneInstance({ lng });
  return i18next;
}

/** Экземпляр на языке взрослого (устройства) — для `I18nextProvider` раздела взрослого, выбора профиля и ABA. */
export function adultI18n(): i18n {
  if (!adult) throw new Error('initI18n ещё не вызван');
  return adult;
}

/**
 * Язык детских экранов (№190): язык профиля ребёнка, пока идёт его сессия; без сессии и для языка не из `UI_LANGS`
 * (ky закрыт гейтом) — язык взрослого. Имена навыков в разделе взрослого (`content.skills.*`) гейт `UI_LANGS` требует
 * от каждого языка, так что сырого ключа там не будет и без запасного языка.
 */
export function setChildLang(lang: InterfaceLang | null): void {
  // закрытый ky — русский, как у `deviceLang`: ребёнок из КР английский не прочтёт
  const target = lang === null ? adultI18n().language : (UI_LANGS as readonly string[]).includes(lang) ? lang : lang === 'ky' ? 'ru' : adultI18n().language;
  if (i18next.language !== target) void i18next.changeLanguage(target);
}

/**
 * `t` на языке ребёнка внутри экранов на языке взрослого — то, что в ABA обращено к ребёнку: SD, «За что играем?»,
 * «Держи жетон!», конец, «Возвращаемся» (№190). Панель, подсказки взрослому и данные — обычным `useTranslation`.
 */
export function useChildT(): TFunction {
  return useTranslation(undefined, { i18n: i18next }).t;
}

/** Есть ли ключ в текущем языке — без запасного языка это и есть «переведено». */
export const keyExists = (key: string): boolean => i18next.exists(key);

/**
 * Язык, на котором текст согласия показан на самом деле. Запасного языка нет (`fallbackLng: false`), а ky-тексты
 * согласий — долг носителя (№108): на ky-устройстве экран показал бы ключи, а в журнал легла бы версия `ky-…`
 * текста, которого родитель не видел (контрольный аудит 2026-11-09, `child-privacy-compliance` по диффу этапа A).
 * Экран рендерит текст через `t(key, { lng })` этим языком и этим же языком берёт версию.
 */
export function consentLang(lang: InterfaceLang, bodyKey: string): InterfaceLang {
  return i18next.exists(bodyKey, { lng: lang }) ? lang : 'ru';
}

export default i18next;
