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
  if (!key) return '';
  const parts = key.split('.');
  let cur = obj;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) return '<MISS:' + key + '>';
  }
  return cur;
}

function isMostlyNumeric(s) {
  return /^[\d\s×÷+\-=<>.,!?«»"'()%°]+$/.test(String(s).trim());
}

function cyrCount(s) {
  return (String(s).match(/[А-Яа-яЁёӨөҮүҢң]/g) || []).length;
}

const out = [];
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
    out.push({ id, error: 'not found' });
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
    const k = m[2];
    dialog.push({ speaker: m[1], key: k, ru: get(ru, k), en: get(en, k), ky: get(ky, k) });
  }
  const intros = [];
  for (const m of block.matchAll(/\{ titleKey: '([^']+)', bodyKey: '([^']+)'/g)) {
    intros.push({
      title: { key: m[1], ru: get(ru, m[1]), en: get(en, m[1]), ky: get(ky, m[1]) },
      body: { key: m[2], ru: get(ru, m[2]), en: get(en, m[2]), ky: get(ky, m[2]) },
    });
  }
  const tasks = [];
  for (let i = start; i < end; i++) {
    const ln = lines[i];
    const tm = ln.match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(ln)) continue;
    const qm = ln.match(/questionKey: '([^']+)'/);
    const cam = ln.match(/correctAnswerKey: '([^']+)'/);
    const qk = qm ? qm[1] : null;
    const opts = [];
    for (const om of ln.matchAll(/\{ id: '(\w+)', textKey: '([^']+)', correct: (true|false)[^}]*\}/g)) {
      opts.push({
        id: om[1],
        correct: om[3] === 'true',
        key: om[2],
        ru: get(ru, om[2]),
        en: get(en, om[2]),
        ky: get(ky, om[2]),
      });
    }
    tasks.push({
      id: tm[1],
      type: tm[2],
      aba: /audience: 'special_aba'/.test(ln),
      qKey: qk,
      q: { ru: qk ? get(ru, qk) : '', en: qk ? get(en, qk) : '', ky: qk ? get(ky, qk) : '' },
      opts,
      ans: cam
        ? { key: cam[1], ru: get(ru, cam[1]), en: get(en, cam[1]), ky: get(ky, cam[1]) }
        : null,
    });
  }

  const autoFlags = [];
  function check(label, ruT, enT, kyT) {
    if (typeof ruT !== 'string' || typeof enT !== 'string' || typeof kyT !== 'string') return;
    if (!ruT || isMostlyNumeric(ruT)) return;
    // KY leaked RU when EN is a real translation
    if (kyT === ruT && enT !== ruT && cyrCount(ruT) >= 3) {
      autoFlags.push(`KY===RU (EN differs): ${label}: «${ruT.slice(0, 80)}»`);
    }
    // EN still Cyrillic / looks like RU
    if (cyrCount(enT) >= 5 && enT === ruT) {
      autoFlags.push(`EN===RU (untranslated): ${label}: «${ruT.slice(0, 80)}»`);
    }
    // EN topic-ish: if EN contains "dozen" for tens lessons etc — leave to manual
  }
  dialog.forEach((d, i) => check(`dialog${i}`, d.ru, d.en, d.ky));
  intros.forEach((d, i) => {
    check(`intro${i}.title`, d.title.ru, d.title.en, d.title.ky);
    check(`intro${i}.body`, d.body.ru, d.body.en, d.body.ky);
  });
  tasks.forEach((t, ti) => {
    check(`t${ti + 1}.q`, t.q.ru, t.q.en, t.q.ky);
    t.opts.forEach((o) => check(`t${ti + 1}.${o.id}`, o.ru, o.en, o.ky));
    if (t.ans) check(`t${ti + 1}.ans`, t.ans.ru, t.ans.en, t.ans.ky);
  });

  out.push({
    id,
    title: meta.title,
    subject: meta.subject,
    world: meta.world,
    types: [...new Set(tasks.map((t) => t.type))],
    dialog,
    intros,
    tasks,
    autoFlags,
  });
}

fs.writeFileSync(path.join(root, 'scripts/_audit_g3_extracted.json'), JSON.stringify(out, null, 2), 'utf8');

// Human-readable dump
let dump = '';
for (const L of out) {
  dump += `\n######## ${L.id} — ${L.title} [${L.types.join(',')}]\n`;
  for (const d of L.dialog) {
    dump += `  [dialog ${d.speaker}]\n    RU: ${d.ru}\n    EN: ${d.en}\n    KY: ${d.ky}\n`;
  }
  L.tasks.forEach((t, i) => {
    dump += `  t${i + 1} <${t.type}>${t.aba ? ' [ABA]' : ''}\n`;
    dump += `    Q RU: ${t.q.ru}\n    Q EN: ${t.q.en}\n    Q KY: ${t.q.ky}\n`;
    for (const o of t.opts) {
      dump += `    ${o.id}${o.correct ? ' ✓' : '  '} RU:${o.ru} | EN:${o.en} | KY:${o.ky}\n`;
    }
    if (t.ans) dump += `    ANS RU:${t.ans.ru} | EN:${t.ans.en} | KY:${t.ans.ky}\n`;
  });
  if (L.autoFlags.length) {
    dump += `  AUTOFLAGS:\n`;
    for (const f of L.autoFlags) dump += `    - ${f}\n`;
  }
}
fs.writeFileSync(path.join(root, 'scripts/_audit_g3_fresh_dump.txt'), dump, 'utf8');

const flagLessons = out.filter((x) => x.autoFlags.length);
console.log('lessons', out.length);
console.log('lessons_with_autoflags', flagLessons.length);
console.log('total_autoflags', out.reduce((s, x) => s + x.autoFlags.length, 0));
for (const x of flagLessons) {
  console.log(x.id, x.autoFlags.length);
}
