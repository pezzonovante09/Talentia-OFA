// Resolve g3 lesson tasks with RU/EN/KY for fresh audit.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const lines = worlds.split('\n');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const idsMeta = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_g3.json'), 'utf8'));

function get(obj, key) {
  if (!key) return undefined;
  let cur = obj;
  for (const p of key.split('.')) {
    cur = cur?.[p];
    if (cur === undefined) return undefined;
  }
  return cur;
}

function looksCyrillic(s) {
  return typeof s === 'string' && /[А-Яа-яЁё]/.test(s);
}
function looksLatin(s) {
  return typeof s === 'string' && /[A-Za-z]/.test(s) && !looksCyrillic(s);
}

const report = [];
const enkyIssues = [];

for (const meta of idsMeta) {
  const id = meta.id;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`id: '${id}', topicId:`).test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) {
    report.push({ id, error: 'not found' });
    continue;
  }
  let end = lines.length;
  for (let i = start + 1; i < end; i++) {
    if (/id: '[a-z0-9-]+', topicId:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const block = lines.slice(start, end).join('\n');
  const dialog = [];
  for (const m of block.matchAll(/\{ speaker: '(\w+)', textKey: '([^']+)' \}/g)) {
    dialog.push({ speaker: m[1], ru: get(ru, m[2]), en: get(en, m[2]), ky: get(ky, m[2]), key: m[2] });
  }
  const intros = [];
  for (const m of block.matchAll(/\{ titleKey: '([^']+)', bodyKey: '([^']+)'/g)) {
    intros.push({
      title: { ru: get(ru, m[1]), en: get(en, m[1]), ky: get(ky, m[1]) },
      body: { ru: get(ru, m[2]), en: get(en, m[2]), ky: get(ky, m[2]) },
    });
  }
  const tasks = [];
  for (let i = start; i < end; i++) {
    const ln = lines[i];
    const tm = ln.match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(ln)) continue;
    const qm = ln.match(/questionKey: '([^']+)'/);
    const cam = ln.match(/correctAnswerKey: '([^']+)'/);
    const qk = qm?.[1];
    const ak = cam?.[1];
    const opts = [...ln.matchAll(/\{ id: '(\w+)', textKey: '([^']+)', correct: (true|false)[^}]*\}/g)].map((m) => {
      const key = m[2];
      const o = {
        id: m[1],
        correct: m[3] === 'true',
        key,
        ru: get(ru, key),
        en: get(en, key),
        ky: get(ky, key),
      };
      if (o.en == null || o.en === o.ru || (looksCyrillic(o.en) && meta.world !== 'g3eng')) {
        enkyIssues.push({ id, task: tm[1], kind: 'opt_en', key, en: o.en, ru: o.ru });
      }
      if (o.ky == null || o.ky === o.ru || (looksCyrillic(o.ky) && !/[үөңһјәіғқұһ]/.test(String(o.ky || '')) && looksCyrillic(o.ky) && o.ky === o.ru)) {
        if (o.ky == null || o.ky === o.ru) enkyIssues.push({ id, task: tm[1], kind: 'opt_ky', key, ky: o.ky, ru: o.ru });
      }
      return o;
    });
    const q = {
      key: qk,
      ru: get(ru, qk),
      en: get(en, qk),
      ky: get(ky, qk),
    };
    if (qk) {
      if (q.en == null || q.en === q.ru) enkyIssues.push({ id, task: tm[1], kind: 'q_en_missing_or_ru', key: qk, en: q.en });
      if (q.ky == null || q.ky === q.ru) enkyIssues.push({ id, task: tm[1], kind: 'q_ky_missing_or_ru', key: qk, ky: q.ky });
      // For English world: EN question should often be EN; for others EN should be translated
      if (meta.world !== 'g3eng' && looksCyrillic(q.en)) {
        enkyIssues.push({ id, task: tm[1], kind: 'q_en_still_cyrillic', key: qk, en: q.en });
      }
    }
    const answer = ak
      ? { key: ak, ru: get(ru, ak), en: get(en, ak), ky: get(ky, ak) }
      : null;
    if (answer) {
      if (answer.en == null || answer.en === answer.ru) enkyIssues.push({ id, task: tm[1], kind: 'ans_en', key: ak });
      if (answer.ky == null || answer.ky === answer.ru) enkyIssues.push({ id, task: tm[1], kind: 'ans_ky', key: ak });
    }
    // fill_blank options may be on following lines — keep simple
    tasks.push({
      line: i + 1,
      id: tm[1],
      type: tm[2],
      aba: /audience: 'special_aba'/.test(ln),
      q,
      opts,
      answer,
    });
  }
  report.push({ ...meta, dialog, intros, tasks });
}

fs.writeFileSync(path.join(root, 'scripts/_reaudit2_g3_resolved.json'), JSON.stringify(report, null, 2), 'utf8');

// compact printable
let out = '';
for (const L of report) {
  out += `\n======== ${L.id} | ${L.title} | ${L.subject}/${L.world}\n`;
  for (const d of L.dialog || []) out += `  [${d.speaker}] ${d.ru}\n`;
  for (const [ti, intro] of (L.intros || []).entries()) out += `  [intro${ti + 1}] ${intro.title.ru} :: ${String(intro.body.ru).slice(0, 160)}\n`;
  for (const [ti, t] of L.tasks.entries()) {
    out += `  T${ti + 1} ${t.id} <${t.type}> Q: ${t.q.ru}\n`;
    for (const o of t.opts) out += `      ${o.id}${o.correct ? ' [✓]' : '    '} ${o.ru}\n`;
    if (t.answer) out += `      answer: ${t.answer.ru} | en=${t.answer.en} | ky=${t.answer.ky}\n`;
  }
}
fs.writeFileSync(path.join(root, 'scripts/_reaudit2_dump_g3_utf8.txt'), out, 'utf8');

// summarize enky unique by lesson
const byLesson = {};
for (const x of enkyIssues) {
  byLesson[x.id] = byLesson[x.id] || [];
  byLesson[x.id].push(x.kind + ':' + (x.key || ''));
}
fs.writeFileSync(
  path.join(root, 'scripts/_reaudit2_g3_enky_flags.json'),
  JSON.stringify({ count: enkyIssues.length, byLesson, sample: enkyIssues.slice(0, 80) }, null, 2),
  'utf8',
);
console.log('lessons', report.length, 'enkyIssues', enkyIssues.length);
console.log('flagged lessons', Object.keys(byLesson).length);
