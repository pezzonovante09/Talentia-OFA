/**
 * Apply EN/KY pedagogy fixes from scripts/input/en_ky_pedagogy_fix.json
 * into locale JSON files (tasks + dialog).
 *
 * Run: node scripts/apply-pedagogy-en-ky-fix.mjs
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const fixPath = path.join(__dirname, 'input', 'en_ky_pedagogy_fix.json');
const fix = JSON.parse(fs.readFileSync(fixPath, 'utf8'));

function applyLocale(localeFile, lang) {
  const p = path.join(root, 'src', 'i18n', 'locales', localeFile);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const [key, pair] of Object.entries(fix.tasks || {})) {
    if (!pair?.[lang]) continue;
    if (!data.data) data.data = {};
    if (!data.data.tasks) data.data.tasks = {};
    data.data.tasks[key] = pair[lang];
    n++;
  }
  for (const [key, pair] of Object.entries(fix.dialog || {})) {
    if (!pair?.[lang]) continue;
    if (!data.data) data.data = {};
    if (!data.data.dialog) data.data.dialog = {};
    data.data.dialog[key] = pair[lang];
    n++;
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return n;
}

const enN = applyLocale('en.json', 'en');
const kyN = applyLocale('ky.json', 'ky');
console.log(`Applied ${enN} EN keys, ${kyN} KY keys`);
