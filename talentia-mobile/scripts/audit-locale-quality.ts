/**
 * Эвристики качества для строк по тем же ключам, что и check-i18n.js
 * (worlds.ts + rw56LessonTasks.ts):
 * — узкий список русских «хвостов» в KY → exit 1
 *
 * (Кириллица в EN не проверяется: в en.json намеренно встречаются кириллические
 * буквы в заданиях по чтению/алфавиту и двуязычных фразах.)
 *
 * Запуск из talentia-mobile:
 *   npx tsx scripts/audit-locale-quality.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RU_PHRASES_IN_KY = [
  'Что такое',
  'Что это значит',
  'Разберись:',
  'Подумай и выбери:',
  'Сравни числа и выбери правильный ответ:',
  'Продолжи последовательность:',
  'Введи ответ:',
];

const KEY_RE = /['"`](data\.[A-Za-z0-9_.]+)['"`]/g;

function extractContentKeys(root: string): Set<string> {
  const files = [
    path.join(root, 'src', 'data', 'worlds.ts'),
    path.join(root, 'src', 'data', 'rw56LessonTasks.ts'),
  ].filter((f) => fs.existsSync(f));
  const keys = new Set<string>();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    let m: RegExpExecArray | null;
    const re = new RegExp(KEY_RE.source, 'g');
    while ((m = re.exec(text)) !== null) keys.add(m[1]);
  }
  return keys;
}

function getByPath(obj: Record<string, unknown>, dotted: string): string | undefined {
  const parts = dotted.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function main(): void {
  const root = path.join(__dirname, '..');
  const contentKeys = extractContentKeys(root);
  const kyPath = path.join(root, 'src/i18n/locales/ky.json');
  const ky = JSON.parse(fs.readFileSync(kyPath, 'utf8')) as Record<string, unknown>;

  const badKy: string[] = [];
  for (const k of contentKeys) {
    const v = getByPath(ky, k);
    if (typeof v !== 'string') continue;
    for (const phrase of RU_PHRASES_IN_KY) {
      if (v.includes(phrase)) {
        badKy.push(`${k} (${phrase})`);
        break;
      }
    }
  }

  if (badKy.length > 0) {
    console.error('[audit-locale-quality] Russian phrase tails in KY for content keys (' + badKy.length + '):');
    badKy.slice(0, 40).forEach((k) => console.error(' ', k));
    if (badKy.length > 40) console.error(' ... +' + (badKy.length - 40));
  }

  if (badKy.length) process.exit(1);
  console.log(
    'audit-locale-quality: OK (' + contentKeys.size + ' content keys, KY phrase heuristics)',
  );
}

main();
