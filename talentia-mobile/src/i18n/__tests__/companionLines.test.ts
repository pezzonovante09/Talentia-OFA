/**
 * Гард банка реплик Tali — `companion.*` в локалях (TALI.md, «Подстановки» и «Форма обращения к
 * ребёнку»; `localization-qa`, аудит 2026-10-06, А15, А23). Банка ещё нет: проверка обходит
 * то, что есть, и на пустом банке молчит; правила проверяются на примерах ниже.
 */
import { AFFIX_AFTER_SLOT, childGenderHits, nameOutsideVocative } from '../../content/__tests__/corpusRules';
import { COMPANION_SLOTS } from '../../domain/companionSituations';
import en from '../locales/en.json';
import ky from '../locales/ky.json';
import ru from '../locales/ru.json';

type Bank = Record<string, string>;
type Lang = 'ru' | 'en' | 'ky';

/** Плоский банк `companion.*`: ключ → строка. */
function flatten(node: unknown, prefix = 'companion'): Bank {
  if (typeof node === 'string') return { [prefix]: node };
  if (typeof node !== 'object' || node === null) return {};
  return Object.entries(node as Record<string, unknown>).reduce<Bank>(
    (acc, [k, v]) => ({ ...acc, ...flatten(v, `${prefix}.${k}`) }),
    {},
  );
}

const PLURAL = /_(zero|one|two|few|many|other)$/;
/** Родовой вариант — суффиксом, как context в i18next: `…_f`, `…_m`, с числом `…_f_one`. */
const GENDER = /_(f|m)(?=(_(zero|one|two|few|many|other))?$)/;
const slotsIn = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
const holders = (s: string) => slotsIn(s).sort().join(',');
/** Основа реплики: без plural-суффикса и родовой надстройки. */
const base = (key: string) => key.replace(PLURAL, '').replace(GENDER, '');

/*
 * Число с предметом (TALI.md, «Подстановки», «Число»; раунд 2, Р16, `localization-qa`):
 * одной подстановкой {{object_count}} в именительной позиции. Склейка «{{count}} + слово»,
 * {{count}} рядом с {{object_count}}, «найди {{object_count}}» и en is / are перед ним — красно.
 */
const COUNT_GLUED = /\{\{\s*count\s*\}\}\s*\p{L}/u;
const OBJECT_COUNT_AFTER_ACC_RU = /(?<!\p{L})(найди|возьми|положи|дай|собери|покажи|принеси)\s+\{\{\s*object_count/iu;
/** en is / are и ru глагол настоящего времени мн. ч. перед числом с предметом — только в plural-ключе. */
const OBJECT_COUNT_AFTER_BE_EN = /\b(is|are|was|were)\s+\{\{\s*object_count/i;
const OBJECT_COUNT_AFTER_VERB_RU = /\p{L}+(ят|ат|ут|ют)\s+\{\{\s*object_count/iu;

export function companionProblems(banks: Partial<Record<Lang, Bank>>): string[] {
  const bad: string[] = [];
  const ruBank = banks.ru ?? {};
  for (const [lang, bank] of Object.entries(banks) as [Lang, Bank][]) {
    const categories = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
    const pluralBases = new Set(Object.keys(bank).filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, '')));
    for (const b of pluralBases) {
      const missing = categories.filter((c) => !(`${b}_${c}` in bank));
      if (missing.length) bad.push(`${lang} ${b}: нет plural-форм ${missing.join(', ')}`);
    }
    for (const [key, text] of Object.entries(bank)) {
      const gendered = GENDER.test(key);
      if (gendered && lang !== 'ru') bad.push(`${lang} ${key}: родовые варианты — только в ru`);
      if (gendered && !Object.keys(bank).some((k) => !GENDER.test(k) && base(k) === base(key))) {
        bad.push(`${lang} ${key}: у родовой реплики нет безродовой основы`);
      }
      if (slotsIn(text).includes('count') && !PLURAL.test(key)) bad.push(`${lang} ${key}: {{count}} — только в plural-ключе`);
      if (slotsIn(text).includes('count') && slotsIn(text).includes('object_count')) {
        bad.push(`${lang} ${key}: {{count}} и {{object_count}} в одной реплике — число с предметом только через {{object_count}}`);
      }
      if (COUNT_GLUED.test(text)) bad.push(`${lang} ${key}: склейка {{count}} + слово — число с предметом через {{object_count}}`);
      if (lang === 'ru' && OBJECT_COUNT_AFTER_ACC_RU.test(text)) bad.push(`${lang} ${key}: после «найди / возьми» число с предметом не ставится`);
      if (lang === 'en' && !PLURAL.test(key) && OBJECT_COUNT_AFTER_BE_EN.test(text)) {
        bad.push(`${lang} ${key}: is / are рядом с {{object_count}} — реплику plural-ключом или без глагола`);
      }
      if (lang === 'ru' && !PLURAL.test(key) && OBJECT_COUNT_AFTER_VERB_RU.test(text)) {
        bad.push(`${lang} ${key}: глагол согласуется с {{object_count}} — реплику plural-ключом или без глагола`);
      }
      if (AFFIX_AFTER_SLOT.test(text)) bad.push(`${lang} ${key}: к подстановке приклеен аффикс`);
      for (const s of slotsIn(text)) {
        if (!(COMPANION_SLOTS as readonly string[]).includes(s)) bad.push(`${lang} ${key}: подстановки {{${s}}} нет в списке`);
      }
      if (slotsIn(text).includes('name') && nameOutsideVocative(text)) bad.push(`${lang} ${key}: имя — только обращением в начале или в конце`);
      if (lang === 'ru' && !gendered && childGenderHits(text).length) bad.push(`ru ${key}: в безродовой реплике род ребёнка`);
      // набор подстановок — как у ru-основы той же реплики
      const ruBase = Object.entries(ruBank).find(([k]) => base(k) === base(key) && !GENDER.test(k));
      if (ruBase && holders(ruBase[1]) !== holders(text)) bad.push(`${lang} ${key}: подстановки ${holders(text)} вместо ${holders(ruBase[1])}`);
    }
  }
  return bad;
}

/**
 * Словарь форм «число с предметом» — `content.objects.<id>.count_*` (TALI.md, «Число»): в каждой
 * форме есть {{count}} и других подстановок нет, plural-набор полный для языка.
 */
export function objectCountProblems(objects: Partial<Record<Lang, Bank>>): string[] {
  const bad: string[] = [];
  for (const [lang, bank] of Object.entries(objects) as [Lang, Bank][]) {
    const categories = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
    const forms = Object.entries(bank).filter(([k]) => /\.count_(zero|one|two|few|many|other)$/.test(k));
    for (const b of new Set(forms.map(([k]) => k.replace(PLURAL, '')))) {
      const missing = categories.filter((c) => !(`${b}_${c}` in bank));
      if (missing.length) bad.push(`${lang} ${b}: нет plural-форм ${missing.join(', ')}`);
    }
    for (const [key, text] of forms) {
      if (!slotsIn(text).includes('count')) bad.push(`${lang} ${key}: в форме нет {{count}}`);
      const other = slotsIn(text).filter((s) => s !== 'count');
      if (other.length) bad.push(`${lang} ${key}: в форме лишние подстановки ${other.join(', ')}`);
    }
  }
  return bad;
}

describe('банк реплик Tali', () => {
  it('реплики в локалях проходят правила подстановки и формы обращения', () => {
    const banks = {
      ru: flatten((ru as Record<string, unknown>).companion ?? {}),
      en: flatten((en as Record<string, unknown>).companion ?? {}),
      ky: flatten((ky as Record<string, unknown>).companion ?? {}),
    };
    expect(companionProblems(banks)).toEqual([]);
  });

  it('формы «число с предметом» в словаре — с {{count}} и полным plural-набором', () => {
    const objects = (locale: unknown) => {
      const content = (locale as Record<string, Record<string, unknown>>).content;
      return flatten(content?.objects ?? {}, 'content.objects');
    };
    expect(objectCountProblems({ ru: objects(ru), en: objects(en), ky: objects(ky) })).toEqual([]);
  });

  describe('правила на примерах', () => {
    const one = (lang: Lang, bank: Bank) => companionProblems({ [lang]: bank });

    it('годная реплика молчит; Tali о себе в мужском роде — можно', () => {
      expect(one('ru', { 'companion.correct-first.0': 'У тебя получилось!', 'companion.correct-first.0_f': 'Ты справилась!' })).toEqual([]);
      expect(one('ru', { 'companion.error-first.0': 'Ой, я перепутал!' })).toEqual([]);
    });

    it('{{count}} вне plural-ключа — красно; неполный plural-набор — красно', () => {
      expect(one('ru', { 'companion.x.0': 'Тут {{count}} ягод' }).join()).toMatch(/plural-ключе/);
      expect(one('ru', { 'companion.x.0_many': 'Тут {{count}} ягод' }).join()).toMatch(/нет plural-форм few, one, other/);
      expect(one('ky', { 'companion.x.0_other': '{{count}} жемиш' }).join()).toMatch(/нет plural-форм one/);
      expect(one('ky', { 'companion.x.0_one': '{{count}}!', 'companion.x.0_other': '{{count}}!' })).toEqual([]);
    });

    it('число с предметом — только {{object_count}} в именительной позиции', () => {
      expect(one('ru', { 'companion.x.0': 'Вот {{object_count}}!' })).toEqual([]);
      const plural = (text: string) =>
        Object.fromEntries(['one', 'few', 'many', 'other'].map((c) => [`companion.x.0_${c}`, text]));
      expect(one('ru', plural('{{count}} — это {{object_count}}')).join()).toMatch(/в одной реплике/);
      expect(one('ru', plural('Тут {{count}} ягод')).join()).toMatch(/склейка/);
      expect(one('ru', { 'companion.x.0': 'Найди {{object_count}}.' }).join()).toMatch(/после «найди/);
      expect(one('en', { 'companion.x.0': 'Here are {{object_count}}!' }).join()).toMatch(/is \/ are/);
      expect(one('ru', plural('Вот лежат {{object_count}}.'))).toEqual([]);
      expect(one('ru', { 'companion.x.0': 'Вот лежат {{object_count}}.' }).join()).toMatch(/глагол согласуется/);
      expect(one('en', { 'companion.x.0_one': 'Here is {{object_count}}!', 'companion.x.0_other': 'Here are {{object_count}}!' })).toEqual([]);
    });

    it('форма предмета в словаре — с {{count}}, без чужих подстановок, полным набором', () => {
      const ruForms = {
        'content.objects.berry.count_one': '{{count}} ягода',
        'content.objects.berry.count_few': '{{count}} ягоды',
        'content.objects.berry.count_many': '{{count}} ягод',
        'content.objects.berry.count_other': '{{count}} ягоды',
      };
      expect(objectCountProblems({ ru: ruForms })).toEqual([]);
      expect(objectCountProblems({ ru: { ...ruForms, 'content.objects.berry.count_one': 'ягода' } }).join()).toMatch(/нет \{\{count\}\}/);
      expect(objectCountProblems({ ru: { ...ruForms, 'content.objects.berry.count_one': '{{count}} {{name}}' } }).join()).toMatch(/лишние/);
      expect(objectCountProblems({ ky: { 'content.objects.berry.count_other': '{{count}} жемиш' } }).join()).toMatch(/нет plural-форм one/);
    });

    it('аффикс к подстановке (и через кавычку, дефис) — красно; чужая подстановка — красно', () => {
      expect(one('ky', { 'companion.x.0': 'Салам, {{name}}га' }).join()).toMatch(/аффикс/);
      expect(one('ky', { 'companion.x.0': 'Салам, {{name}}-га' }).join()).toMatch(/аффикс/);
      expect(one('ru', { 'companion.x.0': 'Найди {{object}}' }).join()).toMatch(/нет в списке/);
      expect(one('ru', { 'companion.x.0': 'Найди {{object_acc}}!' })).toEqual([]);
    });

    it('имя не обращением — красно', () => {
      expect(one('ru', { 'companion.x.0': 'Смотри, как {{name}} считает' }).join()).toMatch(/обращением/);
      expect(one('ru', { 'companion.x.0': '{{name}}, у тебя получилось!' })).toEqual([]);
    });

    it('род ребёнка в безродовой — красно; родовая — только в ru и при основе', () => {
      expect(one('ru', { 'companion.x.0': 'Ты справился сам!' }).join()).toMatch(/род ребёнка/);
      expect(one('ru', { 'companion.x.0': 'Справился!' }).join()).toMatch(/род ребёнка/);
      expect(one('ru', { 'companion.x.0': 'Ты всё сделал!' }).join()).toMatch(/род ребёнка/);
      expect(one('en', { 'companion.x.0': 'Well done!', 'companion.x.0_m': 'Good boy!' }).join()).toMatch(/только в ru/);
      expect(one('ru', { 'companion.x.0_f': 'Ты справилась!' }).join()).toMatch(/нет безродовой основы/);
    });

    it('подстановки в en и ky — как у ru', () => {
      const bad = companionProblems({
        ru: { 'companion.x.0': '{{name}}, у тебя получилось!' },
        en: { 'companion.x.0': 'You did it!' },
      });
      expect(bad.join()).toMatch(/подстановки/);
    });
  });
});
