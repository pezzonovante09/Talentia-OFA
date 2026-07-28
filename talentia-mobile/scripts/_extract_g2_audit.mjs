// Extract g2 lessons as structured UTF-8 JSON for audit.
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
const ids = JSON.parse(fs.readFileSync(path.join(__dirname, '_reaudit2_ids_g2.json'), 'utf8'));

function t(obj, key) {
  if (!key) return '';
  let cur = obj;
  for (const p of key.split('.')) {
    cur = cur?.[p];
    if (cur === undefined) return '<MISSING:' + key + '>';
  }
  return cur;
}

function hasCyrillic(s) {
  return typeof s === 'string' && /[а-яА-ЯёЁ]/.test(s);
}
function looksKy(s) {
  return typeof s === 'string' && /[ңүөҮӨҢәі]/.test(s);
}

const out = [];
for (const meta of ids) {
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
  const dialog = [...block.matchAll(/\{ speaker: '(\w+)', textKey: '([^']+)' \}/g)].map((m) => ({
    speaker: m[1],
    ru: t(ru, m[2]),
    en: t(en, m[2]),
    ky: t(ky, m[2]),
    key: m[2],
  }));
  const intros = [...block.matchAll(/\{ titleKey: '([^']+)', bodyKey: '([^']+)'/g)].map((m) => ({
    title: t(ru, m[1]),
    body: t(ru, m[2]),
    titleEn: t(en, m[1]),
    bodyEn: t(en, m[2]),
    titleKy: t(ky, m[1]),
    bodyKy: t(ky, m[2]),
  }));
  const tasks = [];
  const keys = new Set();
  for (const m of block.matchAll(/'((?:data\.(?:tasks|lessons)\.)[^']+)'/g)) keys.add(m[1]);
  for (let i = start; i < end; i++) {
    const ln = lines[i];
    const tm = ln.match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(ln)) continue;
    const qm = ln.match(/questionKey: '([^']+)'/);
    const qKey = qm?.[1];
    const task = {
      id: tm[1],
      type: tm[2],
      qRu: qKey ? t(ru, qKey) : null,
      qEn: qKey ? t(en, qKey) : null,
      qKy: qKey ? t(ky, qKey) : null,
      qKey,
      options: [],
      answer: null,
    };
    for (const om of ln.matchAll(/\{ id: '(\w+)', textKey: '([^']+)', correct: (true|false)[^}]*\}/g)) {
      task.options.push({
        id: om[1],
        correct: om[3] === 'true',
        ru: t(ru, om[2]),
        en: t(en, om[2]),
        ky: t(ky, om[2]),
        key: om[2],
      });
    }
    const cam = ln.match(/correctAnswerKey: '([^']+)'/);
    if (cam) {
      task.answer = { ru: t(ru, cam[1]), en: t(en, cam[1]), ky: t(ky, cam[1]), key: cam[1] };
    }
    tasks.push(task);
  }
  const enkyFlags = [];
  for (const k of keys) {
    const r = t(ru, k);
    const e = t(en, k);
    const y = t(ky, k);
    if (String(e).startsWith('<MISSING')) enkyFlags.push('EN_MISS:' + k.replace('data.tasks.', ''));
    if (String(y).startsWith('<MISSING')) enkyFlags.push('KY_MISS:' + k.replace('data.tasks.', ''));
    if (hasCyrillic(e) && e === r) enkyFlags.push('EN=RU:' + k.replace('data.tasks.', ''));
    else if (hasCyrillic(e)) enkyFlags.push('EN_RU_LEAK:' + k.replace('data.tasks.', ''));
    if (hasCyrillic(y) && !looksKy(y) && y === r) enkyFlags.push('KY=RU:' + k.replace('data.tasks.', ''));
    else if (hasCyrillic(y) && !looksKy(y) && /[а-яА-ЯёЁ]{4,}/.test(y))
      enkyFlags.push('KY_RU_LEAK?:' + k.replace('data.tasks.', '') + '=' + JSON.stringify(y).slice(0, 60));
  }
  // option/question mismatches EN vs RU intent for compare tasks
  for (const task of tasks) {
    if (!task.qEn || !task.options.length) continue;
    const q = String(task.qEn).toLowerCase();
    const opts = task.options.map((o) => String(o.en).toLowerCase()).join(' | ');
    if (q.includes('smallest') && opts.includes('found more')) {
      enkyFlags.push('CRITICAL:en_q_options_mismatch:' + (task.qKey || task.id));
    }
    if (String(task.qKy).includes('самое маленькое') || String(task.qKy).toLowerCase().includes('smallest')) {
      if (opts.includes('found more') || task.options.some((o) => String(o.ru).includes('больше'))) {
        enkyFlags.push('CRITICAL:ky_stale_smallest_vs_who_more:' + (task.qKey || task.id));
      }
    }
  }
  out.push({
    id,
    title: meta.title,
    subject: meta.subject,
    world: meta.world,
    types: meta.types,
    dialog,
    intros,
    tasks,
    enkyFlags,
  });
}

fs.writeFileSync(path.join(__dirname, '_g2_live_extract.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('wrote', out.length, 'lessons');
for (const L of out) {
  console.log('\n====', L.id, L.title, '====');
  for (const d of L.dialog) console.log('  [d]', d.speaker + ':', d.ru);
  for (const i of L.intros) console.log('  [i]', i.title, '::', String(i.body).slice(0, 160));
  for (const tsk of L.tasks) {
    console.log('  [' + tsk.type + ']', tsk.id, 'Q:', tsk.qRu);
    for (const o of tsk.options) console.log('      ', o.correct ? '✓' : ' ', o.ru);
    if (tsk.answer) console.log('      A:', tsk.answer.ru);
  }
  if (L.enkyFlags.length) console.log('  FLAGS:', L.enkyFlags.join(' | '));
}
