/**
 * Wave3 planning evidence: A dumps, B ky_eq_ru checks, D MC+input list.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const inv = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_inventory.json'), 'utf8'),
);
const after5 = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_merged.snapshot_after_wave2.json'), 'utf8'),
);

function t(doc, key) {
  if (!key) return '';
  const parts = String(key).replace(/^data\./, '').split('.');
  let cur = doc.data;
  for (const p of parts) cur = cur?.[p];
  return cur ?? '';
}

function extractLessonTasks(id) {
  const re = new RegExp(
    `id: '${id}'[\\s\\S]*?tasks: \\[([\\s\\S]*?)\\]\\s*[,}]`,
  );
  const m = worlds.match(re);
  return m ? m[1] : null;
}

function showTaskLine(line) {
  const id = /id: '([^']+)'/.exec(line)?.[1];
  const type = /type: '([^']+)'/.exec(line)?.[1];
  const qk = /questionKey: '([^']+)'/.exec(line)?.[1];
  const ans = /answer: '([^']*)'|answer: "([^"]*)"/.exec(line);
  const opts = [...line.matchAll(/\{ id: '([^']+)', textKey: '([^']+)', correct: (true|false) \}/g)];
  return { id, type, qk, ans: ans ? ans[1] ?? ans[2] : null, opts };
}

console.log('========== A: top-4 dumps ==========');
for (const id of ['g2m-times-l3', 'g2r-sent-l2', 'g2e-days-l3', 'canyon-words-2']) {
  console.log('\n####', id);
  const block = extractLessonTasks(id);
  if (!block) {
    // try rw56
    console.log('(not inline in worlds — check rw56)');
    continue;
  }
  // dialog
  const dRe = new RegExp(`id: '${id}'[\\s\\S]*?dialog: \\[([\\s\\S]*?)\\],\\s*intro`);
  const dM = worlds.match(dRe);
  if (dM) {
    for (const tk of dM[1].matchAll(/textKey: '([^']+)'/g)) {
      console.log('DIALOG', t(ru, tk[1]));
    }
  }
  for (const line of block.split(/\n/).filter((l) => l.includes("id: '"))) {
    const info = showTaskLine(line);
    if (!info.id) continue;
    console.log(`\n${info.id} [${info.type}]`);
    console.log('  Q RU:', t(ru, info.qk));
    console.log('  Q EN:', t(en, info.qk));
    if (info.ans != null) console.log('  answer:', info.ans);
    for (const o of info.opts) {
      console.log(`  ${o[3] === 'true' ? '✓' : '·'} ${t(ru, o[2])} | EN: ${t(en, o[2])}`);
    }
  }
}

// canyon may be in rw56
const rw56 = fs.readFileSync(path.join(root, 'src/data/rw56LessonTasks.ts'), 'utf8');
if (rw56.includes("'canyon-words-2'")) {
  console.log('\n#### canyon-words-2 from rw56');
  const m = rw56.match(/'canyon-words-2': \[([\s\S]*?)\],\s*'/);
  if (m) {
    const tasks = JSON.parse(`[${m[1].replace(/,\s*$/, '')}]`.replace(/'/g, '"').replace(/(\w+):/g, '"$1":').replace(/,\s*]/g, '}'));
    // fallback simpler: regex keys
  }
  for (const mk of m[1].matchAll(/"questionKey":\s*"([^"]+)"|"answer":\s*"([^"]*)"|questionKey:\s*'([^']+)'|answer:\s*"([^"]*)"|answer:\s*'([^']*)'/g)) {
    // skip
  }
  // dump via keys in block
  for (const qk of [...m[1].matchAll(/questionKey["']?\s*:\s*["']([^"']+)["']/g)].map((x) => x[1])) {
    console.log('Q', qk, '→', t(ru, qk.replace(/^data\./, '').includes('.') ? qk : `data.tasks.${qk.replace(/^data\.tasks\./, '')}`));
  }
}

console.log('\n========== B: ky_eq_ru stubs ==========');
const kyEqLessons = [
  'canyon-sent-1',
  'g4r-cases-l1',
  'g4r-cases-l2',
  'g4r-cases-l3',
  'g4r-conj-l1',
  'g4r-conj-l2',
  'g4r-conj-l3',
  'g4r-text-l3',
  'jungle-sub-1',
  'space-planets-1',
  'space-planets-2',
  'space-solar-1',
];
const lessons5 = after5.lessons || after5;
for (const id of kyEqLessons) {
  const L = lessons5.find((l) => l.id === id);
  const flags = (L?.enkyFlags || []).filter((f) => /ky_eq_ru/i.test(String(f)));
  console.log('\n', id);
  for (const f of flags) {
    const key = String(f).replace(/^ky_eq_ru:/, '');
    const parts = key.replace(/^data\./, '').split('.');
    let r = ru.data;
    let e = en.data;
    let k = ky.data;
    for (const p of parts) {
      r = r?.[p];
      e = e?.[p];
      k = k?.[p];
    }
    const eq = r === k;
    const enDiff = e !== r;
    console.log(`  ${key}`);
    console.log(`    RU: ${JSON.stringify(r)}`);
    console.log(`    KY: ${JSON.stringify(k)}`);
    console.log(`    EN: ${JSON.stringify(e)}`);
    console.log(`    KY===RU: ${eq} | EN!==RU: ${enDiff}`);
  }
  if (!flags.length) console.log('  (no ky_eq_ru in after_wave2 flags — check manually)');
}

console.log('\n========== D: MC+input only ==========');
const lessons = inv.lessons || [];
const mcInput = lessons.filter((l) => {
  const u = [...(l.uniqueTypes || [])].sort();
  return u.length === 2 && u[0] === 'input' && u[1] === 'multiple_choice';
});
const pureMc = lessons.filter((l) => {
  const u = l.uniqueTypes || [];
  return u.length === 1 && u[0] === 'multiple_choice';
});
console.log('total lessons', lessons.length);
console.log('pureMc', pureMc.length, pureMc.map((l) => l.id).join(', '));
console.log('mc+input only', mcInput.length);
console.log(mcInput.map((l) => `${l.id}\tg${l.grade}\t${l.taskCount || ''}`).join('\n'));
