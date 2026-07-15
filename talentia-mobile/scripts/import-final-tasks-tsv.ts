/**
 * Импорт текстов вопросов из final_tasks.tsv в ru.json, en.json, ky.json.
 * Удаляются только «мета»-скобки (не спеши, подумай дважды, …), не примеры в скобках.
 *
 * Запуск из talentia-mobile:
 *   npx tsx scripts/import-final-tasks-tsv.ts [путь-к-final_tasks.tsv]
 *
 * По умолчанию: scripts/input/final_tasks.tsv
 *
 * Для EN, если в en.json уже был кириллический текст, ядро вопроса переводится через MyMemory (ru→en),
 * затем добавляется тот же английский префикс, что и у русской рамки.
 *
 * Кэш переводов: scripts/.cache/mymemory-ru-en.json (в .gitignore). Повтор запроса с backoff при сбое API.
 * Перед записью файлов: если для любого ключа из TSV в EN осталась кириллица — exit 1, json не перезаписываются.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseTsvLine } from './final-tasks-common';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MYMEMORY_CACHE_PATH = path.join(__dirname, '.cache', 'mymemory-ru-en.json');

/** Скобки с подсказками-повторюшками — убираем; примеры вроде (Я остался дома) не трогаем */
const HINT_IN_PARENS = new RegExp(
  String.raw`\s*\((?:не спеши|подумай дважды|будь внимателен|проверь себя|по-английски)\)\s*`,
  'gi',
);

const PREFIXES_RU = [
  'Сравни числа и выбери правильный ответ: ',
  'Подумай и выбери: ',
  'Продолжи последовательность: ',
  'Введи ответ: ',
  'Разберись: ',
] as const;

const PREFIX_EN: Record<string, string> = {
  'Сравни числа и выбери правильный ответ: ': 'Compare the numbers and pick the right answer: ',
  'Подумай и выбери: ': 'Think and choose: ',
  'Продолжи последовательность: ': 'Continue the pattern: ',
  'Введи ответ: ': 'Enter your answer: ',
  'Разберись: ': 'Think it through: ',
};

const PREFIX_KY: Record<string, string> = {
  'Сравни числа и выбери правильный ответ: ': 'Сандарды салыштырып, туура жоопту танда: ',
  'Подумай и выбери: ': 'Ойлонуп, танда: ',
  'Продолжи последовательность: ': 'Улантманы улант: ',
  'Введи ответ: ': 'Жоопту жаз: ',
  'Разберись: ': 'Ойлонуп көр: ',
};

function stripHintParens(s: string): string {
  let out = s;
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(HINT_IN_PARENS, ' ').replace(/\s+/g, ' ').trim();
  }
  return out;
}

function stripAnyPrefix(ru: string): { prefixRu: string | null; core: string } {
  for (const p of PREFIXES_RU) {
    if (ru.startsWith(p)) {
      return { prefixRu: p, core: ru.slice(p.length).trim() };
    }
  }
  return { prefixRu: null, core: ru.trim() };
}

function getTaskString(doc: Record<string, unknown>, fullKey: string): string | null {
  if (!fullKey.startsWith('data.tasks.')) return null;
  const short = fullKey.replace(/^data\.tasks\./, '');
  const data = doc.data as Record<string, unknown> | undefined;
  const tasks = data?.tasks as Record<string, unknown> | undefined;
  const v = tasks?.[short];
  return typeof v === 'string' ? v : null;
}

function setTaskString(doc: Record<string, unknown>, fullKey: string, value: string): void {
  const short = fullKey.replace(/^data\.tasks\./, '');
  const data = doc.data as Record<string, unknown>;
  const tasks = data.tasks as Record<string, unknown>;
  tasks[short] = value;
}

const CYRILLIC = /[\u0400-\u04FF]/;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function loadTranslationCache(): Record<string, string> {
  try {
    if (fs.existsSync(MYMEMORY_CACHE_PATH)) {
      return JSON.parse(fs.readFileSync(MYMEMORY_CACHE_PATH, 'utf8')) as Record<string, string>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function saveTranslationCache(cache: Record<string, string>): void {
  const dir = path.dirname(MYMEMORY_CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MYMEMORY_CACHE_PATH, `${JSON.stringify(cache, null, 0)}\n`, 'utf8');
}

/** Бесплатный ru→en (качество среднее; для школьных коротких вопросов достаточно) */
async function translateRuToEnMyMemory(
  text: string,
  cache: Record<string, string>,
): Promise<string> {
  const q = text.slice(0, 450);
  const cacheKey = q;
  const hit = cache[cacheKey];
  if (hit && hit.length > 0 && !CYRILLIC.test(hit)) return hit;

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=ru|en`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      const j = (await res.json()) as { responseData?: { translatedText?: string } };
      const t = j.responseData?.translatedText?.trim();
      if (t && t.length > 0 && !CYRILLIC.test(t)) {
        cache[cacheKey] = t;
        return t;
      }
    } catch {
      /* retry */
    }
    await sleep(500 * 2 ** attempt);
  }
  return text;
}

function assertNoCyrillicEnForTsvKeys(
  en: Record<string, unknown>,
  tsvKeys: Iterable<string>,
): string[] {
  const bad: string[] = [];
  for (const fullKey of tsvKeys) {
    const s = getTaskString(en, fullKey);
    if (s != null && CYRILLIC.test(s)) bad.push(fullKey);
  }
  return bad;
}

async function main() {
  const root = path.join(__dirname, '..');
  const defaultTsv = path.join(__dirname, 'input', 'final_tasks.tsv');
  const tsvPath = process.argv[2] ?? defaultTsv;

  if (!fs.existsSync(tsvPath)) {
    console.error('TSV not found:', tsvPath);
    process.exit(1);
  }

  const localeDir = path.join(root, 'src', 'i18n', 'locales');
  const paths = {
    ru: path.join(localeDir, 'ru.json'),
    en: path.join(localeDir, 'en.json'),
    ky: path.join(localeDir, 'ky.json'),
  };

  const ru = JSON.parse(fs.readFileSync(paths.ru, 'utf8')) as Record<string, unknown>;
  const en = JSON.parse(fs.readFileSync(paths.en, 'utf8')) as Record<string, unknown>;
  const ky = JSON.parse(fs.readFileSync(paths.ky, 'utf8')) as Record<string, unknown>;

  const lines = fs.readFileSync(tsvPath, 'utf8').trim().split(/\r?\n/);
  const header = parseTsvLine(lines[0]);
  const qi = header.indexOf('questionKey');
  const ri = header.indexOf('questionRu');
  if (qi < 0 || ri < 0) throw new Error('TSV missing questionKey or questionRu column');

  const translationCache = loadTranslationCache();

  const lastByKey = new Map<string, string>();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseTsvLine(lines[i]);
    const qk = cols[qi];
    const rawRu = cols[ri] ?? '';
    lastByKey.set(qk, stripHintParens(rawRu));
  }

  let updatedRu = 0;
  let updatedEn = 0;
  let updatedKy = 0;
  let prefixEnKy = 0;
  let translatedEn = 0;
  let mismatch = 0;
  const mismatchKeys: string[] = [];

  type PendingEn = { fullKey: string; pe: string; core: string };
  const pendingEn: PendingEn[] = [];

  for (const [fullKey, newRuClean] of lastByKey) {
    const oldRu = getTaskString(ru, fullKey);
    if (oldRu == null) {
      console.warn('Missing key in ru.json:', fullKey);
      continue;
    }

    setTaskString(ru, fullKey, newRuClean);
    updatedRu++;

    const { prefixRu, core } = stripAnyPrefix(newRuClean);
    const oldRuNorm = stripHintParens(oldRu).trim();
    const { core: oldCore } = stripAnyPrefix(oldRuNorm);

    const oldEn = getTaskString(en, fullKey);
    const oldKy = getTaskString(ky, fullKey);
    if (oldEn == null || oldKy == null) {
      console.warn('Missing key in en/ky:', fullKey);
      continue;
    }

    if (prefixRu && (core === oldRuNorm || core === oldCore)) {
      const pe = PREFIX_EN[prefixRu] ?? '';
      const pk = PREFIX_KY[prefixRu] ?? '';
      const enCyr = CYRILLIC.test(oldEn);
      let nextEn: string;
      if (!enCyr) {
        nextEn = pe && oldEn.startsWith(pe) ? oldEn : `${pe}${oldEn}`.trim();
      } else {
        pendingEn.push({ fullKey, pe, core });
        nextEn = oldEn;
      }
      const nextKy = pk && oldKy.startsWith(pk) ? oldKy : `${pk}${oldKy}`.trim();
      setTaskString(en, fullKey, nextEn);
      setTaskString(ky, fullKey, nextKy);
      prefixEnKy++;
      updatedEn++;
      updatedKy++;
      continue;
    }

    if (newRuClean === oldRuNorm) {
      setTaskString(en, fullKey, oldEn.trim());
      setTaskString(ky, fullKey, oldKy.trim());
      updatedEn++;
      updatedKy++;
      continue;
    }

    mismatch++;
    mismatchKeys.push(fullKey);
    setTaskString(en, fullKey, oldEn);
    setTaskString(ky, fullKey, oldKy);
  }

  let i = 0;
  for (const { fullKey, pe, core } of pendingEn) {
    const coreEn = await translateRuToEnMyMemory(core, translationCache);
    const combined = `${pe}${coreEn}`.trim();
    setTaskString(en, fullKey, combined);
    translatedEn++;
    i++;
    if (i % 20 === 0) console.error('Translated EN', i, '/', pendingEn.length);
    await sleep(350);
    if (i % 40 === 0) saveTranslationCache(translationCache);
  }
  saveTranslationCache(translationCache);

  const cyrillicEnKeys = assertNoCyrillicEnForTsvKeys(en, lastByKey.keys());
  if (cyrillicEnKeys.length > 0) {
    console.error(
      '[import-final-tasks-tsv] Self-check failed: Cyrillic still present in en.json for TSV keys:',
      cyrillicEnKeys.slice(0, 40),
    );
    if (cyrillicEnKeys.length > 40) console.error('… +' + (cyrillicEnKeys.length - 40));
    console.error('Locale files were not written. Fix translations or cache and re-run.');
    process.exit(1);
  }

  fs.writeFileSync(paths.ru, `${JSON.stringify(ru, null, 2)}\n`, 'utf8');
  fs.writeFileSync(paths.en, `${JSON.stringify(en, null, 2)}\n`, 'utf8');
  fs.writeFileSync(paths.ky, `${JSON.stringify(ky, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        tsvPath,
        keys: lastByKey.size,
        updatedRu,
        updatedEn,
        updatedKy,
        prefixEnKyPairs: prefixEnKy,
        translatedEnViaMyMemory: translatedEn,
        mismatchCoreNoPrefixMap: mismatch,
        mismatchKeys,
      },
      null,
      2,
    ),
  );
}

void main();
