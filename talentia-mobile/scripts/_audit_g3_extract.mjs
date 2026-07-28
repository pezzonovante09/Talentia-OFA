// Extract all g3 lesson tasks with RU/EN/KY for audit
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
const ids = JSON.parse(fs.readFileSync(path.join(__dirname, '_reaudit2_ids_g3.json'), 'utf8'));

function t(obj, key) {
  if (!key) return '';
  let cur = obj;
  for (const p of key.split('.')) {
    cur = cur?.[p];
    if (cur === undefined) return '<MISSING:' + key + '>';
  }
  return cur;
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
  const lesson = {
    id,
    title: meta.title,
    subject: meta.subject,
    world: meta.world,
    types: meta.types,
    dialog: [],
    intros: [],
    tasks: [],
  };
  for (const m of block.matchAll(/\{ speaker: '(\w+)', textKey: '([^']+)' \}/g)) {
    lesson.dialog.push({
      speaker: m[1],
      ru: t(ru, m[2]),
      en: t(en, m[2]),
      ky: t(ky, m[2]),
      key: m[2],
    });
  }
  for (const m of block.matchAll(/\{ titleKey: '([^']+)', bodyKey: '([^']+)'/g)) {
    lesson.intros.push({
      titleRu: t(ru, m[1]),
      bodyRu: t(ru, m[2]),
      titleEn: t(en, m[1]),
      bodyEn: t(en, m[2]),
    });
  }
  for (let i = start; i < end; i++) {
    const ln = lines[i];
    const tm = ln.match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(ln)) continue;
    const qm = ln.match(/questionKey: '([^']+)'/);
    const qKey = qm ? qm[1] : null;
    const task = {
      tid: tm[1],
      type: tm[2],
      aba: /audience: 'special_aba'/.test(ln),
      qKey,
      qRu: qKey ? t(ru, qKey) : null,
      qEn: qKey ? t(en, qKey) : null,
      qKy: qKey ? t(ky, qKey) : null,
      options: [],
      answerRu: null,
      answerEn: null,
      answerKy: null,
      answerKey: null,
    };
    for (const om of ln.matchAll(/\{ id: '(\w+)', textKey: '([^']+)', correct: (true|false)[^}]*\}/g)) {
      task.options.push({
        id: om[1],
        correct: om[3] === 'true',
        key: om[2],
        ru: t(ru, om[2]),
        en: t(en, om[2]),
        ky: t(ky, om[2]),
      });
    }
    const cam = ln.match(/correctAnswerKey: '([^']+)'/);
    if (cam) {
      task.answerKey = cam[1];
      task.answerRu = t(ru, cam[1]);
      task.answerEn = t(en, cam[1]);
      task.answerKy = t(ky, cam[1]);
    }
    // flag RU≠EN topic hijack heuristics on question
    if (task.qRu && task.qEn && !String(task.qEn).startsWith('<MISSING')) {
      // leave for human audit; just store
    }
    lesson.tasks.push(task);
  }
  out.push(lesson);
}

fs.writeFileSync(path.join(__dirname, '_audit_g3_live_tasks.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote', out.length, 'lessons to _audit_g3_live_tasks.json');

// Focus wave1 criticals
const focus = ['g3e-tobe-l3', 'g3w-nat-l3', 'g3r-adj-l2', 'g3w-eco-l1', 'g3e-tobe-l1'];
for (const id of focus) {
  const L = out.find((x) => x.id === id);
  console.log('\n========', id, '========');
  if (!L) {
    console.log('MISSING');
    continue;
  }
  console.log('TITLE', L.title);
  for (const tsk of L.tasks) {
    console.log(`\n[${tsk.tid}] ${tsk.type}`);
    console.log('  Q RU:', tsk.qRu);
    console.log('  Q EN:', tsk.qEn);
    console.log('  Q KY:', tsk.qKy);
    for (const o of tsk.options) {
      console.log(`  ${o.id}${o.correct ? ' ✓' : '  '} RU:${o.ru} | EN:${o.en}`);
    }
    if (tsk.answerRu != null) {
      console.log('  ANS RU:', tsk.answerRu, '| EN:', tsk.answerEn, '| KY:', tsk.answerKy);
    }
  }
}
