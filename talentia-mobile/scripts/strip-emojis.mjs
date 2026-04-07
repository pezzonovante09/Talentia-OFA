/**
 * Удаляет эмодзи из строк (локали + worlds.ts).
 * Запуск: node scripts/strip-emojis.mjs
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function stripEmojisFromString(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\uFE0F/g, '')
    .replace(/\u200D/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}

function walkJson(val) {
  if (typeof val === 'string') return stripEmojisFromString(val);
  if (Array.isArray(val)) return val.map(walkJson);
  if (val && typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = walkJson(v);
    }
    return out;
  }
  return val;
}

function processJsonFile(fp) {
  const raw = fs.readFileSync(fp, 'utf8');
  const data = JSON.parse(raw);
  const next = walkJson(data);
  fs.writeFileSync(fp, JSON.stringify(next, null, 2) + '\n', 'utf8');
  console.log('OK', path.relative(root, fp));
}

function processTextFile(fp) {
  let t = fs.readFileSync(fp, 'utf8');
  const before = t;
  t = t.replace(/\p{Extended_Pictographic}/gu, '').replace(/\uFE0F/g, '').replace(/\u200D/g, '');
  // Порванные комментарии (мусор после битой кодировки)
  t = t.replace(/^  \/\/ РІвЂўС’.*$/gm, '  // ---');
  if (t !== before) {
    fs.writeFileSync(fp, t, 'utf8');
    console.log('OK', path.relative(root, fp));
  }
}

const localeDir = path.join(root, 'src', 'i18n', 'locales');
for (const name of ['ru.json', 'en.json', 'ky.json']) {
  processJsonFile(path.join(localeDir, name));
}

processTextFile(path.join(root, 'src', 'data', 'worlds.ts'));
