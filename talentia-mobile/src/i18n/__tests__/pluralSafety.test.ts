/**
 * Страховки локалей по проверке `localization-qa` диффа этапа C (контрольный аудит 2026-11-09, Ж15).
 *
 * 1. Полнота plural-набора: у основы с суффиксами в языке есть **все** категории `Intl.PluralRules(язык)` — иначе при
 *    count из недостающей категории экран показал бы сырой ключ (`fallbackLng: false`). Голый ключ без суффиксов —
 *    тоже годится: i18next откатывается на него при любом count.
 * 2. Без `Intl.PluralRules` (Hermes его не реализует) i18next выбирает «1 → one, остальное → other». Поэтому у ru
 *    `_other` — форма `_many`: 0 и 5+ звучат верно, как до plural; при живом Intl целые числа в other не попадают.
 * 3. Голос пустого места в `order` собирается шаблоном `lesson.place${…}` (`useLessonController`) — ключи должны быть.
 */
import { createInstance } from 'i18next';

import { placeVoice } from '../../domain/taskDraft';
import en from '../locales/en.json';
import ky from '../locales/ky.json';
import ru from '../locales/ru.json';

type Tree = { [k: string]: string | Tree };
const PLURAL = /_(zero|one|two|few|many|other)$/;

function flat(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === 'string') out.set(prefix + k, v);
    else for (const [kk, vv] of flat(v, `${prefix}${k}.`)) out.set(kk, vv);
  }
  return out;
}

describe.each([
  ['ru', ru],
  ['en', en],
  ['ky', ky],
] as const)('plural-наборы %s полные', (lang, tree) => {
  it('у каждой основы с суффиксами есть все категории языка (или голый ключ)', () => {
    const keys = flat(tree as Tree);
    const categories = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
    const bases = new Set([...keys.keys()].filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, '')));
    const bad = [...bases].flatMap((base) => {
      if (keys.has(base)) return [];
      const missing = categories.filter((c) => !keys.has(`${base}_${c}`));
      return missing.length ? [`${base}: нет ${missing.join(', ')}`] : [];
    });
    expect(bad).toEqual([]);
  });
});

describe('plural без Intl.PluralRules (как на Hermes)', () => {
  const original = Intl.PluralRules;
  afterEach(() => {
    (Intl as { PluralRules?: typeof Intl.PluralRules }).PluralRules = original;
  });

  it('ru: 0 и 5+ — форма «многих», 1 — «один»; никогда не сырой ключ', () => {
    delete (Intl as { PluralRules?: typeof Intl.PluralRules }).PluralRules;
    const i = createInstance();
    void i.init({ lng: 'ru', resources: { ru: { translation: ru } }, fallbackLng: false, initImmediate: false });
    // 21 без Intl уходит в other («уроков»): хуже, чем «21 урок», но не сырой ключ и не «21 урока»
    expect([0, 1, 5, 11, 21, 100].map((count) => i.t('parent.home.lessons', { count }))).toEqual(['уроков', 'урок', 'уроков', 'уроков', 'уроков', 'уроков']);
    expect(i.t('parent.home.minutes', { count: 12 })).toBe('минут');
  });

  it('с Intl.PluralRules (Node, проверка формы на устройстве — К2): 1, 2, 5, 21 — верные формы', () => {
    const i = createInstance();
    void i.init({ lng: 'ru', resources: { ru: { translation: ru } }, fallbackLng: false, initImmediate: false });
    expect([1, 2, 5, 21].map((count) => i.t('parent.home.lessons', { count }))).toEqual(['урок', 'урока', 'уроков', 'урок']);
  });
});

describe('голос пустого места в order', () => {
  it.each([
    ['ru', ru],
    ['en', en],
  ] as const)('%s: ключи lesson.place* для начала, середины и конца есть', (_lang, tree) => {
    const keys = flat(tree as Tree);
    const voices = new Set([0, 1, 2].map((i) => placeVoice(i, 3)));
    const missing = [...voices].map((v) => `lesson.place${v[0].toUpperCase()}${v.slice(1)}`).filter((k) => !keys.has(k));
    expect(missing).toEqual([]);
  });
});
