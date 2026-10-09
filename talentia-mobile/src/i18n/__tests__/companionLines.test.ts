/**
 * Гард банка реплик Tali — `companion.*` в локалях (TALI.md, «Подстановки» и «Форма обращения к
 * ребёнку»; `localization-qa`, аудит 2026-10-06, А15, А23). Банка ещё нет: проверка обходит
 * то, что есть, и на пустом банке молчит; правила проверяются на примерах ниже.
 */
import { AFFIX_AFTER_SLOT } from '../../content/__tests__/corpusRules';
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

/**
 * Безродовая реплика о ребёнке — без «сам / сама», «ты …л(а)» и прошедшего времени частых
 * глаголов. Tali о себе говорит в мужском роде — поэтому после «я» можно. Эвристика: ловит не
 * всё, ручная проверка остаётся.
 */
const PAST_ROOTS = ['справил', 'смог', 'нашёл', 'нашел', 'нашл', 'угадал', 'решил', 'сделал', 'посчитал', 'понял', 'запомнил', 'путал'];
const GENDERED_RU = [
  /(?<!\p{L})(сам|сама)(?!\p{L})/iu,
  /(?<!\p{L})ты\s+(\p{L}+\s+)?\p{L}+(л|ла|лся|лась)(?!\p{L})/iu,
  new RegExp(`(?<!(?<!\\p{L})я\\s{1,3})(?<!\\p{L})(${PAST_ROOTS.join('|')})\\p{L}*`, 'iu'),
];

/** Имя — только обращением через запятую в начале или в конце реплики. */
const NAME_OK = /^\{\{\s*name\s*\}\},|,\s*\{\{\s*name\s*\}\}[.!?]?$/;

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
      if (AFFIX_AFTER_SLOT.test(text)) bad.push(`${lang} ${key}: к подстановке приклеен аффикс`);
      for (const s of slotsIn(text)) {
        if (!(COMPANION_SLOTS as readonly string[]).includes(s)) bad.push(`${lang} ${key}: подстановки {{${s}}} нет в списке`);
      }
      if (slotsIn(text).includes('name') && !NAME_OK.test(text.trim())) bad.push(`${lang} ${key}: имя — только обращением в начале или в конце`);
      if (lang === 'ru' && !gendered && GENDERED_RU.some((re) => re.test(text))) bad.push(`ru ${key}: в безродовой реплике род ребёнка`);
      // набор подстановок — как у ru-основы той же реплики
      const ruBase = Object.entries(ruBank).find(([k]) => base(k) === base(key) && !GENDER.test(k));
      if (ruBase && holders(ruBase[1]) !== holders(text)) bad.push(`${lang} ${key}: подстановки ${holders(text)} вместо ${holders(ruBase[1])}`);
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
      expect(one('ky', { 'companion.x.0_one': '{{count}} жемиш', 'companion.x.0_other': '{{count}} жемиш' })).toEqual([]);
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
