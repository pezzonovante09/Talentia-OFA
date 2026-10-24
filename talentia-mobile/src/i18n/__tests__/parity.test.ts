/**
 * Гард парности локалей ru / en / ky (раунд 3, Г10; решение №79: гард парности — блокер выпуска).
 *
 * Правило: любой ключ из ru есть в en и ky, с теми же подстановками `{{…}}`, без пустых значений,
 * без кириллицы в en, без русского текста под видом перевода, без «(а)» в ru. Plural-суффиксы
 * (`_one` / `_few` / `_many` / `_other`) сворачиваются в основу: у ru их четыре, у en и ky два.
 *
 * Долг, который пока нельзя закрыть, — **явный список префиксов** с причиной. Тест падает и когда
 * в ключах без долга чего-то нет, и когда префикс из списка уже полностью переведён: список только
 * сокращается. Кыргызский пишет носитель (решение №108); английский пилота переведён, список долга en пуст.
 */
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

/** Основа plural-ключа → все строки с этой основой. */
function byBase(m: Map<string, string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [k, v] of m) {
    const base = k.replace(PLURAL, '');
    out.set(base, [...(out.get(base) ?? []), v]);
  }
  return out;
}

const placeholders = (s: string) => [...new Set([...s.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]))].sort();

/** Долг по переводу: префикс → причина. Только сокращается. */
const PENDING: Record<'en' | 'ky', Record<string, string>> = {
  // Английский пилота переведён; новые тексты вне пилота добавляются сразу с en — долга по en нет.
  en: {},
  ky: {
    abaPanel: 'кыргызские подписи панели пишет носитель (№108)',
    abaScreen: 'кыргызский текст предупреждения пишет носитель (№108)',
    abaBreak: 'кыргызские тексты перерыва пишет носитель (№108)',
    abaRoutine: 'кыргызские тексты рутины пишет носитель (№108)',
    abaReinforcer: 'кыргызский текст пишет носитель (№108)',
    abaReinforcement: 'кыргызский текст пишет носитель (№108)',
    profile: 'кыргызский текст пишет носитель (№108)',
    firstRun: 'кыргызские тексты первого запуска пишет носитель (№108)',
    parentGate: 'кыргызские тексты гейта родителя пишет носитель (№108)',
    map: 'кыргызские реплики карты пишет носитель (№108)',
    lesson: 'кыргызские подписи экрана урока пишет носитель (№108)',
    atlas: 'кыргызские подписи страницы атласа пишет носитель (№108)',
    a11y: 'кыргызские подписи для скринридера пишет носитель (№108)',
    content: 'пилот Числовой долины пока только по-русски (№78); кыргызский — носитель (№108)',
  },
};

const R = byBase(flat(ru as Tree));
const LOCALES = { en: byBase(flat(en as Tree)), ky: byBase(flat(ky as Tree)) } as const;
const pendingPrefix = (lang: 'en' | 'ky', key: string) => Object.keys(PENDING[lang]).find((p) => key === p || key.startsWith(`${p}.`));

describe.each(['en', 'ky'] as const)('парность ru ↔ %s', (lang) => {
  const L = LOCALES[lang];

  it('каждый ключ ru есть и в локали, кроме явного долга', () => {
    const missing = [...R.keys()].filter((k) => !L.has(k) && !pendingPrefix(lang, k));
    expect(missing).toEqual([]);
  });

  it('лишних ключей нет: каждый ключ локали есть в ru', () => {
    expect([...L.keys()].filter((k) => !R.has(k))).toEqual([]);
  });

  it('долг не устарел: у каждого префикса из списка есть хотя бы один непереведённый ключ', () => {
    for (const prefix of Object.keys(PENDING[lang])) {
      const keys = [...R.keys()].filter((k) => k === prefix || k.startsWith(`${prefix}.`));
      expect({ prefix, exists: keys.length > 0 }).toEqual({ prefix, exists: true });
      const done = keys.every((k) => L.has(k));
      expect({ prefix, fullyTranslated: done }).toEqual({ prefix, fullyTranslated: false });
    }
  });

  it('подстановки {{…}} совпадают у переведённых ключей', () => {
    const bad: string[] = [];
    for (const [k, vals] of L) {
      const ruVals = R.get(k);
      if (!ruVals) continue;
      const a = [...new Set(ruVals.flatMap(placeholders))].sort().join(',');
      const b = [...new Set(vals.flatMap(placeholders))].sort().join(',');
      if (a !== b) bad.push(`${k}: ru {${a}} ≠ ${lang} {${b}}`);
    }
    expect(bad).toEqual([]);
  });

  it('пустых значений нет', () => {
    const empty = [...L].filter(([, vals]) => vals.some((v) => v.trim() === '')).map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it('значение не равно русскому: не заглушка под видом перевода', () => {
    const same = [...L].filter(([k, vals]) => (R.get(k) ?? []).some((r) => vals.includes(r) && r.trim() !== '')).map(([k]) => k);
    expect(same).toEqual([]);
  });
});

describe('en', () => {
  it('кириллицы нет', () => {
    const bad = [...LOCALES.en].filter(([, vals]) => vals.some((v) => /[А-Яа-яЁё]/.test(v))).map(([k]) => k);
    expect(bad).toEqual([]);
  });
});

describe('ru', () => {
  it('«(а)» и прочие скобочные окончания рода в ru-текстах нет (№71)', () => {
    const bad = [...flat(ru as Tree)].filter(([, v]) => /\((а|ла|ся|ая|ый|ой|ен|на)\)/.test(v)).map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it('подписи a11y.option обязаны нести {{n}} во всех локалях, где они есть', () => {
    for (const tree of [ru, en, ky] as Tree[]) {
      const v = flat(tree).get('a11y.option');
      if (v !== undefined) expect(v).toContain('{{n}}');
    }
  });
});
