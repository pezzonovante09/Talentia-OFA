/**
 * One-off / repeatable: strip emoji-like characters from i18n JSON string values
 * and clear all intro slide `emoji:` fields in worlds.ts.
 * Run: node scripts/strip-app-emojis.mjs
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function stripEmojis(s) {
  if (typeof s !== 'string') return s;
  return (
    s
      // Keycap sequences (e.g. 6⃣)
      .replace(/[0-9#*]\uFE0F?\u20E3/g, '')
      .replace(/\p{Extended_Pictographic}/gu, '')
      .replace(/[\uFE00-\uFE0F]/g, '')
      .replace(/\u200D/g, '')
      .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

function walkJsonStrings(obj, fn) {
  if (obj === null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) walkJsonStrings(item, fn);
    return;
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'string') {
      obj[k] = fn(v);
    } else if (v !== null && typeof v === 'object') {
      walkJsonStrings(v, fn);
    }
  }
}

function main() {
  const localesDir = path.join(root, 'src', 'i18n', 'locales');
  for (const name of ['ru.json', 'en.json', 'ky.json']) {
    const p = path.join(localesDir, name);
    if (!fs.existsSync(p)) continue;
    const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
    walkJsonStrings(doc, stripEmojis);
    fs.writeFileSync(p, JSON.stringify(doc, null, 2) + '\n', 'utf8');
    console.log('Updated', p);
  }

  const worldsPath = path.join(root, 'src', 'data', 'worlds.ts');
  let w = fs.readFileSync(worldsPath, 'utf8');
  w = w.replace(/emoji:\s*'[^']*'/g, "emoji: ''");
  fs.writeFileSync(worldsPath, w, 'utf8');
  console.log('Cleared intro emoji fields in worlds.ts');
}

main();
