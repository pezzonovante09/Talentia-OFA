import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const lines = worlds.split('\n');
const locales = {
  ru: JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8')),
  en: JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8')),
  ky: JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8')),
};

function t(obj, key) {
  if (!key) return '';
  const parts = key.split('.');
  let cur = obj;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) return '<MISSING:' + key + '>';
  }
  return cur;
}

const ids = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_g3.json'), 'utf8')).map((x) => x.id);
const out = [];

for (const id of ids) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`id: '${id}', topicId:`).test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    out.push({ id, error: 'not found' });
    continue;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/id: '[a-z0-9-]+', topicId:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const block = lines.slice(start, end).join('\n');
  const dialog = [...block.matchAll(/\{ speaker: '(\w+)', textKey: '([^']+)' \}/g)].map((m) => ({
    speaker: m[1],
    key: m[2],
    ru: t(locales.ru, m[2]),
    en: t(locales.en, m[2]),
    ky: t(locales.ky, m[2]),
  }));
  const intros = [...block.matchAll(/\{ titleKey: '([^']+)', bodyKey: '([^']+)'/g)].map((m) => ({
    title: { ru: t(locales.ru, m[1]), en: t(locales.en, m[1]), ky: t(locales.ky, m[1]) },
    body: { ru: t(locales.ru, m[2]), en: t(locales.en, m[2]), ky: t(locales.ky, m[2]) },
  }));
  const tasks = [];
  for (let i = start; i < end; i++) {
    const ln = lines[i];
    const tm = ln.match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(ln)) continue;
    const qm = ln.match(/questionKey: '([^']+)'/);
    const task = {
      id: tm[1],
      type: tm[2],
      q: qm
        ? { key: qm[1], ru: t(locales.ru, qm[1]), en: t(locales.en, qm[1]), ky: t(locales.ky, qm[1]) }
        : null,
      opts: [],
      answer: null,
    };
    for (const om of ln.matchAll(/\{ id: '(\w+)', textKey: '([^']+)', correct: (true|false)[^}]*\}/g)) {
      task.opts.push({
        id: om[1],
        correct: om[3] === 'true',
        key: om[2],
        ru: t(locales.ru, om[2]),
        en: t(locales.en, om[2]),
        ky: t(locales.ky, om[2]),
      });
    }
    const cam = ln.match(/correctAnswerKey: '([^']+)'/);
    if (cam) {
      task.answer = {
        key: cam[1],
        ru: t(locales.ru, cam[1]),
        en: t(locales.en, cam[1]),
        ky: t(locales.ky, cam[1]),
      };
    }
    tasks.push(task);
  }
  out.push({ id, dialog, intros, tasks });
}

fs.writeFileSync(path.join(root, 'scripts/_g3_live_trilocale.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('wrote', out.length, 'lessons');
