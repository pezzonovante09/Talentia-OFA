/**
 * Проверка согласованности локалей с final_tasks.tsv (ключи из TSV).
 * — кириллица в EN для этих ключей → exit 1
 * — эвристика «русский хвост» в KY → exit 1
 * — отсутствует ключ в ru/en/ky → exit 1
 * — дубликаты questionKey в TSV → отчёт (не фейл)
 *
 * Запуск из talentia-mobile:
 *   npx tsx scripts/verify-final-tasks-locales.ts [путь-к-tsv]
 *   npx tsx scripts/verify-final-tasks-locales.ts --audit-extra-ru
 *
 * По умолчанию TSV: scripts/input/final_tasks.tsv
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseTsvLine } from './final-tasks-common';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CYRILLIC = /[\u0400-\u04FF]/;

/** Остатки русской методической формулировки в строке KY (узкий список). */
/**
 * Только «утёкшие» русские шаблоны целиком (не отдельные слова вроде «Выбери» в русскоязычном
 * упражнении g4r_* после кыргызского префикса).
 */
const RU_PHRASES_IN_KY = [
  'Что такое',
  'Что это значит',
  'Разберись:',
  'Подумай и выбери:',
  'Сравни числа и выбери правильный ответ:',
  'Продолжи последовательность:',
  'Введи ответ:',
];

function loadTsvKeys(tsvPath: string): {
  keys: string[];
  shortKeys: string[];
  rowCountByFullKey: Map<string, number>;
} {
  const lines = fs.readFileSync(tsvPath, 'utf8').trim().split(/\r?\n/);
  const header = parseTsvLine(lines[0]);
  const qi = header.indexOf('questionKey');
  if (qi < 0) throw new Error('TSV missing questionKey column');

  const rowCountByFullKey = new Map<string, number>();
  const order: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseTsvLine(lines[i]);
    const fullKey = cols[qi]?.trim() ?? '';
    if (!fullKey.startsWith('data.tasks.')) continue;
    rowCountByFullKey.set(fullKey, (rowCountByFullKey.get(fullKey) ?? 0) + 1);
    order.push(fullKey);
  }

  const unique = [...new Set(order)];
  const shortKeys = unique.map((k) => k.replace(/^data\.tasks\./, ''));
  return { keys: unique, shortKeys, rowCountByFullKey };
}

function getTask(
  doc: Record<string, unknown>,
  shortKey: string,
): string | undefined {
  const tasks = (doc.data as Record<string, unknown> | undefined)?.tasks as
    | Record<string, unknown>
    | undefined;
  const v = tasks?.[shortKey];
  return typeof v === 'string' ? v : undefined;
}

function main() {
  const root = path.join(__dirname, '..');
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const auditExtraRu = process.argv.includes('--audit-extra-ru');
  const tsvArg = args.find((a) => !a.startsWith('--'));
  const defaultTsv = path.join(__dirname, 'input', 'final_tasks.tsv');
  const tsvPath = tsvArg ?? defaultTsv;

  if (!fs.existsSync(tsvPath)) {
    console.error('TSV not found:', tsvPath);
    process.exit(1);
  }

  const localeDir = path.join(root, 'src', 'i18n', 'locales');
  const ruPath = path.join(localeDir, 'ru.json');
  const enPath = path.join(localeDir, 'en.json');
  const kyPath = path.join(localeDir, 'ky.json');

  let ru: Record<string, unknown>;
  let en: Record<string, unknown>;
  let ky: Record<string, unknown>;
  try {
    ru = JSON.parse(fs.readFileSync(ruPath, 'utf8'));
    en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    ky = JSON.parse(fs.readFileSync(kyPath, 'utf8'));
  } catch (e) {
    console.error('Invalid locale JSON:', e);
    process.exit(1);
  }

  const { keys: fullKeys, shortKeys, rowCountByFullKey } = loadTsvKeys(tsvPath);

  const duplicates = [...rowCountByFullKey.entries()].filter(([, n]) => n > 1);
  if (duplicates.length > 0) {
    console.error(
      `[verify-final-tasks-locales] TSV duplicate questionKey rows (last row wins in import); count=${duplicates.length}`,
    );
    for (const [k, n] of duplicates.slice(0, 25)) {
      console.error(`  ${n}× ${k}`);
    }
    if (duplicates.length > 25) console.error(`  … +${duplicates.length - 25} more`);
  }

  const missingRu: string[] = [];
  const missingEn: string[] = [];
  const missingKy: string[] = [];
  const cyrillicEn: string[] = [];
  const heuristicKy: string[] = [];

  for (let i = 0; i < fullKeys.length; i++) {
    const sk = shortKeys[i];
    const ruS = getTask(ru, sk);
    const enS = getTask(en, sk);
    const kyS = getTask(ky, sk);
    if (ruS === undefined) missingRu.push(fullKeys[i]);
    if (enS === undefined) missingEn.push(fullKeys[i]);
    if (kyS === undefined) missingKy.push(fullKeys[i]);
    if (enS !== undefined && CYRILLIC.test(enS)) cyrillicEn.push(sk);
    if (kyS !== undefined) {
      for (const ph of RU_PHRASES_IN_KY) {
        if (kyS.includes(ph)) {
          heuristicKy.push(`${sk} (contains "${ph.trim()}")`);
          break;
        }
      }
    }
  }

  let failed = false;
  if (missingRu.length) {
    failed = true;
    console.error(`[verify-final-tasks-locales] Missing in ru.json (${missingRu.length}):`, missingRu.slice(0, 20));
    if (missingRu.length > 20) console.error(`  … +${missingRu.length - 20}`);
  }
  if (missingEn.length) {
    failed = true;
    console.error(`[verify-final-tasks-locales] Missing in en.json (${missingEn.length}):`, missingEn.slice(0, 20));
    if (missingEn.length > 20) console.error(`  … +${missingEn.length - 20}`);
  }
  if (missingKy.length) {
    failed = true;
    console.error(`[verify-final-tasks-locales] Missing in ky.json (${missingKy.length}):`, missingKy.slice(0, 20));
    if (missingKy.length > 20) console.error(`  … +${missingKy.length - 20}`);
  }
  if (cyrillicEn.length) {
    failed = true;
    console.error(`[verify-final-tasks-locales] Cyrillic in en.json for TSV keys (${cyrillicEn.length}):`, cyrillicEn.slice(0, 30));
    if (cyrillicEn.length > 30) console.error(`  … +${cyrillicEn.length - 30}`);
  }
  if (heuristicKy.length) {
    failed = true;
    console.error(
      `[verify-final-tasks-locales] Possible Russian leftovers in ky.json (${heuristicKy.length}):`,
      heuristicKy.slice(0, 25),
    );
    if (heuristicKy.length > 25) console.error(`  … +${heuristicKy.length - 25}`);
  }

  if (auditExtraRu) {
    const tasks = ((ru.data as Record<string, unknown> | undefined)?.tasks ?? {}) as Record<string, unknown>;
    const tsvShort = new Set(shortKeys);
    const extra: string[] = [];
    for (const k of Object.keys(tasks)) {
      if (!/^g[1-4]/.test(k)) continue;
      if (!tsvShort.has(k)) extra.push(k);
    }
    extra.sort();
    console.error(
      `[verify-final-tasks-locales] --audit-extra-ru: ru.data.tasks keys g1–g4 not listed in TSV (${extra.length})`,
    );
    console.error(extra.slice(0, 40).join(', ') + (extra.length > 40 ? ' …' : ''));
  }

  console.log(
    JSON.stringify(
      {
        tsvPath,
        uniqueQuestionKeys: fullKeys.length,
        audit: {
          tsvDuplicateQuestionKeyKinds: duplicates.length,
          missingInRu: missingRu.length,
          missingInEn: missingEn.length,
          missingInKy: missingKy.length,
          cyrillicEnForTsvKeys: cyrillicEn.length,
          heuristicRuPhrasesInKy: heuristicKy.length,
        },
        ok: !failed,
        hint: auditExtraRu ? null : 'Pass --audit-extra-ru to list g1–g4 ru.data.tasks keys absent from TSV',
      },
      null,
      2,
    ),
  );

  if (failed) process.exit(1);
}

main();
