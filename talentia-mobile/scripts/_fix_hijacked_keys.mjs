// Find option keys whose RU text diverges semantically from EN (hijacked shared keys).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const lines = src.split('\n');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8')).data.tasks;
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8')).data.tasks;

function findLessonId(lineIdx) {
  for (let j = lineIdx; j >= 0; j--) {
    const m = lines[j].match(/id: '([a-z0-9-]+)', topicId:/);
    if (m) return m[1];
  }
  return '?';
}

// Collect all option textKeys with usage locations
const usage = {};
for (let i = 0; i < lines.length; i++) {
  for (const m of lines[i].matchAll(/textKey: 'data\.tasks\.([\w]+)', correct: (true|false)/g)) {
    (usage[m[1]] ||= []).push({ lesson: findLessonId(i), correct: m[2] === 'true', line: i + 1 });
  }
}

// Heuristics for hijack: EN is short numeric/word but RU is long sentence, or key name implies number/month/day/grammar word and RU doesn't match
const suspects = [];
for (const [key, uses] of Object.entries(usage)) {
  const r = ru[key], e = en[key];
  if (r === undefined || e === undefined) continue;
  const numName = key.match(/^opt_(\d+)$/);
  if (numName && String(r).trim() !== numName[1]) {
    suspects.push({ key, ru: r, en: e, expected: numName[1], uses });
    continue;
  }
  // EN pure number, RU not the same number
  if (/^\d+$/.test(String(e).trim()) && String(r).trim() !== String(e).trim()) {
    suspects.push({ key, ru: r, en: e, expected: e, uses });
    continue;
  }
  // EN single latin word (grammar/month/day), RU is a long RU sentence (>25 chars) — likely hijack
  if (/^[A-Za-z''\s?.!,-]+$/.test(String(e)) && String(e).length <= 25 && String(r).length > 30) {
    suspects.push({ key, ru: r, en: e, expected: null, uses });
  }
}

for (const s of suspects) {
  console.log('KEY ' + s.key + '  EN=' + JSON.stringify(s.en) + '  RU=' + JSON.stringify(s.ru) + (s.expected ? '  expected=' + s.expected : ''));
  for (const u of s.uses) console.log('    ' + u.lesson + ' L' + u.line + (u.correct ? ' [✓]' : ''));
}
console.log('total suspects:', suspects.length);
fs.writeFileSync(path.join(__dirname, '_fix_hijacked_keys.json'), JSON.stringify(suspects, null, 2));
