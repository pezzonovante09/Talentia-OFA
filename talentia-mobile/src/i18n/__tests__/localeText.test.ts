/**
 * Гарды текста локалей по всем языкам (раунд 3, `localization-qa`, В3–В5).
 *
 * - В3: форма обращения по аудитории. Ребёнку — на «ты» (ru «ты», ky «сен»), взрослому — на
 *   «вы» / «сиз». «Сиз» в тексте для ребёнка и «вы» в тексте для ребёнка — красно.
 * - В4: длина вопроса и подсказки меряется во всех языках, а не только в ru. Предел ru —
 *   `TEXT_LIMITS`; в других языках строка длиннее (кыргызская до ×2.3), предел умножается.
 * - В5: у реплики Tali, примера и объяснения есть предел длины — пузырь `BUBBLE_CHARS`.
 *
 * Имя в репликах проверяет одна функция — `nameOutsideVocative` (см. `companionLines.test.ts`).
 */
import { BUBBLE_CHARS, TEXT_LIMITS } from '../../domain/lessonLimits';
import en from '../locales/en.json';
import ky from '../locales/ky.json';
import ru from '../locales/ru.json';
import glossary from '../glossary.json';

type Tree = { [k: string]: string | Tree };
type Lang = 'ru' | 'en' | 'ky';

function flat(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [k, v]) => {
    if (typeof v === 'string') acc[prefix + k] = v;
    else Object.assign(acc, flat(v, `${prefix}${k}.`));
    return acc;
  }, {});
}

/** Во сколько раз строка другого языка может быть длиннее русской при той же вёрстке. */
export const LENGTH_FACTOR: Record<Lang, number> = { ru: 1, en: 1.5, ky: 2.3 };

const chars = (s: string) => [...s].length;

/** Аудитория по первому сегменту ключа: кому адресован текст. */
export type Audience = 'child' | 'adult' | 'both';
const AUDIENCE: Record<string, Audience> = {
  content: 'child',
  companion: 'child',
  abaReinforcement: 'child',
  abaReinforcer: 'child',
  abaBreak: 'both', // «Хочешь отдохнуть?» — ребёнку, «Закончили на сегодня» — безлично
  a11y: 'both',
  abaPanel: 'adult',
  abaScreen: 'adult',
  abaRoutine: 'adult',
  profile: 'adult',
  // строки «что делать дома» (вопрос 57) живут под `content` рядом с названиями навыков, но адресованы родителю
  'content.skillTips': 'adult',
};
/** Аудитория по самому длинному известному префиксу: `content.skillTips` раньше `content`. */
export const audienceOf = (key: string): Audience | undefined => {
  const parts = key.split('.');
  for (let n = Math.min(2, parts.length); n >= 1; n -= 1) {
    const a = AUDIENCE[parts.slice(0, n).join('.')];
    if (a) return a;
  }
  return undefined;
};

const L = String.raw`\p{L}`;
const word = (alt: string) => new RegExp(`(?<!${L})(?:${alt})(?!${L})`, 'iu');
/** Формы «вы» в ru и «сиз» в ky — вежливое обращение ко взрослому. */
const POLITE: Record<Lang, RegExp> = {
  ru: word(String.raw`вы|вас|вам|вами|ваш\p{L}*`),
  en: /(?!)/u,
  ky: word(String.raw`сиз|сиздин|сизде|сизге|сизди|сизден|сиздер\p{L}*`),
};
/** Обращение на «ты» / «сен» — для ребёнка. */
const FAMILIAR: Record<Lang, RegExp> = {
  ru: word('ты|тебя|тебе|тобой|твой|твоя|твоё|твои'),
  en: /(?!)/u,
  ky: word('сен|сенин|сенде|сага|сени|сенден'),
};

export function addressProblems(lang: Lang, bank: Record<string, string>): string[] {
  const bad: string[] = [];
  for (const [key, text] of Object.entries(bank)) {
    const who = audienceOf(key);
    if (who === 'child' && POLITE[lang].test(text)) bad.push(`${lang} ${key}: ребёнку — на «ты»/«сен», а тут вежливое «вы»/«сиз»`);
    if (who === 'adult' && FAMILIAR[lang].test(text)) bad.push(`${lang} ${key}: взрослому — на «вы»/«сиз», а тут «ты»/«сен»`);
  }
  return bad;
}

const TASK_TEXT = /(?:^|\.)(prompt|hint)$/;
const BUBBLE_TEXT = /^companion\.|\.(?:explain\d?|hook|atlas|s\d+)$/;

export function lengthProblems(lang: Lang, bank: Record<string, string>): string[] {
  const bad: string[] = [];
  const f = LENGTH_FACTOR[lang];
  for (const [key, text] of Object.entries(bank)) {
    const kind = key.match(TASK_TEXT)?.[1];
    if (kind) {
      const max = Math.floor((kind === 'prompt' ? TEXT_LIMITS.promptChars : TEXT_LIMITS.hintChars) * f);
      if (chars(text) > max) bad.push(`${lang} ${key}: ${kind === 'prompt' ? 'вопрос' : 'подсказка'} ${chars(text)} знаков, нужно ≤ ${max}`);
    }
    if (BUBBLE_TEXT.test(key) && chars(text) > BUBBLE_CHARS) bad.push(`${lang} ${key}: реплика ${chars(text)} знаков, пузырь вмещает ${BUBBLE_CHARS}`);
  }
  return bad;
}

const banks: Record<Lang, Record<string, string>> = { ru: flat(ru as Tree), en: flat(en as Tree), ky: flat(ky as Tree) };

describe.each(['ru', 'en', 'ky'] as const)('текст локали %s', (lang) => {
  it('форма обращения по аудитории: ребёнку «ты», взрослому «вы»', () => {
    expect(addressProblems(lang, banks[lang])).toEqual([]);
  });

  it('вопрос, подсказка и реплики укладываются в пределы вёрстки', () => {
    expect(lengthProblems(lang, banks[lang])).toEqual([]);
  });
});

describe('правила на примерах', () => {
  it('«сиз» в тексте для ребёнка — красно; для взрослого — можно', () => {
    expect(addressProblems('ky', { 'companion.x.0': 'Сиз жакшы эмгектендиңиз' }).join()).toMatch(/ребёнку/);
    expect(addressProblems('ky', { 'content.a.prompt': 'Сиздин жообуңуз?' }).join()).toMatch(/ребёнку/);
    expect(addressProblems('ky', { 'abaPanel.x': 'Сизге жардам керекпи?' })).toEqual([]);
    expect(addressProblems('ky', { 'companion.x.0': 'Сен жакшы санадың!' })).toEqual([]);
  });

  it('«вы» ребёнку и «ты» взрослому в ru — красно', () => {
    expect(addressProblems('ru', { 'companion.x.0': 'Вы молодцы!' }).join()).toMatch(/ребёнку/);
    expect(addressProblems('ru', { 'abaScreen.x': 'Ты можешь закрыть окно' }).join()).toMatch(/взрослому/);
    expect(addressProblems('ru', { 'abaScreen.x': 'Закройте второе окно' })).toEqual([]);
  });

  it('длина: предел ru умножается на коэффициент языка; реплика — не больше пузыря', () => {
    const long = 'я'.repeat(TEXT_LIMITS.promptChars + 1);
    expect(lengthProblems('ru', { 'content.a.t1.prompt': long }).join()).toMatch(/вопрос/);
    expect(lengthProblems('ky', { 'content.a.t1.prompt': long })).toEqual([]);
    expect(lengthProblems('ky', { 'content.a.t1.hint': 'ы'.repeat(Math.floor(TEXT_LIMITS.hintChars * LENGTH_FACTOR.ky) + 1) }).join()).toMatch(/подсказка/);
    expect(lengthProblems('en', { 'companion.x.0': 'a'.repeat(BUBBLE_CHARS + 1) }).join()).toMatch(/пузырь/);
    expect(lengthProblems('ky', { 'content.a.l1.model.s1': 'а'.repeat(BUBBLE_CHARS + 1) }).join()).toMatch(/пузырь/);
  });
});

describe('глоссарий', () => {
  const terms = (glossary as { terms: { id: string; domain: string; source: string; ru?: string; en?: string; ky?: string; status: string }[] }).terms;

  it('id уникальны, у каждого термина есть ru и en и допустимый статус', () => {
    expect(new Set(terms.map((t) => t.id)).size).toBe(terms.length);
    for (const t of terms) {
      expect({ id: t.id, ru: !!t.ru, en: !!t.en }).toEqual({ id: t.id, ru: true, en: true });
      expect(['draft', 'needs-native', 'approved']).toContain(t.status);
    }
  });

  it('кыргызский термин — только после носителя: у draft и approved без ky нельзя approved', () => {
    expect(terms.filter((t) => t.status === 'approved' && !t.ky).map((t) => t.id)).toEqual([]);
  });
});
