import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const merged = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_merged.json'), 'utf8'),
);
const lessons = Array.isArray(merged.lessons) ? merged.lessons : merged;
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');

function t(doc, k) {
  const parts = String(k).replace(/^data\./, '').split('.');
  let cur = doc.data;
  for (const x of parts) cur = cur?.[x];
  return cur ?? '';
}

function extractTask(id) {
  // non-greedy until next task or closing of array-ish: stop at `},` that starts next `{ id:`
  const re = new RegExp(
    `\\{ id: '${id}'[\\s\\S]*?(?=\\n\\s*\\{ id: '|\\n\\s*\\]\\s*,|\\n\\s*\\]\\s*\\})`,
  );
  const m = worlds.match(re);
  return m ? m[0] : null;
}

function show(id) {
  const sn = extractTask(id);
  console.log('\n====', id, '====');
  if (!sn) {
    console.log('NOT FOUND');
    return;
  }
  console.log(sn.slice(0, 600));
  const q = /questionKey: '([^']+)'/.exec(sn)?.[1];
  const ans = /answer:\s*'([^']*)'|answer:\s*"([^"]*)"/.exec(sn);
  console.log('Q RU:', t(ru, q));
  console.log('Q EN:', t(en, q));
  if (ans) console.log('answer field:', ans[1] ?? ans[2]);
  const opts = [...sn.matchAll(/\{ id: '([^']+)', textKey: '([^']+)', correct: (true|false) \}/g)];
  for (const m of opts) {
    console.log(
      `  ${m[3] === 'true' ? '✓' : '·'} [${m[1]}] ${t(ru, m[2])} || EN: ${t(en, m[2])}`,
    );
  }
}

for (const id of [
  'g4r-text-l3-t3',
  'g4e-quest-l2-t1',
  'g4s-emo-l2-t4',
  'lab-ph-1-t1',
  'lab-ph-1-t2',
  'lab-ph-1-t3',
  'g2m100l2t1',
]) {
  show(id);
}

const crit = lessons
  .filter((l) => l.verdict === 'critical')
  .sort((a, b) => a.coherence - b.coherence || a.id.localeCompare(b.id));
const lowC = lessons
  .filter((l) => l.coherence < 4)
  .sort((a, b) => a.coherence - b.coherence || a.id.localeCompare(b.id));

console.log('\n\n===== CRITICAL', crit.length, '=====');
for (const l of crit) {
  const main = l.problems?.[0]?.issue || '(no problem text)';
  console.log(
    `${l.id}\tC=${l.c}\tU=${l.u}\tE=${l.e}\tD=${l.d}\t${l.title}\t${main.replace(/\n/g, ' ')}`,
  );
}

console.log('\n===== C<4', lowC.length, '=====');
for (const l of lowC) {
  const main = l.problems?.[0]?.issue || '(no problem text)';
  console.log(
    `${l.id}\tC=${l.c}\tverdict=${l.verdict}\t${l.title}\t${main.replace(/\n/g, ' ')}`,
  );
}

// verify compose key
console.log('\ncompose RU', ru.data.tasks.g2m_compose_3t_6u);
console.log('compose EN', en.data.tasks.g2m_compose_3t_6u);
