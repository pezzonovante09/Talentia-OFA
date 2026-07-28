import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));

function t(doc, k) {
  const parts = String(k).replace(/^data\./, '').split('.');
  let cur = doc.data;
  for (const x of parts) cur = cur?.[x];
  return typeof cur === 'string' ? cur : '';
}

function sliceLesson(id) {
  const needle = `id: '${id}'`;
  const idx = worlds.indexOf(needle);
  if (idx < 0) return null;
  const rest = worlds.slice(idx + needle.length);
  const next = rest.search(/\n\s{8}id: '/);
  return worlds.slice(idx, idx + needle.length + (next > 0 ? next : 2500));
}

function dumpTasks(id) {
  const slice = sliceLesson(id);
  if (!slice) return { id, error: 'missing' };
  // match each task block roughly
  const taskRe =
    /\{\s*id:\s*'([^']+)',\s*type:\s*'([^']+)',\s*questionKey:\s*'([^']+)'([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
  const tasks = [];
  let m;
  while ((m = taskRe.exec(slice))) {
    const taskId = m[1];
    if (taskId === id) continue;
    const type = m[2];
    const qKey = m[3];
    const body = m[0];
    const answer = /answer:\s*'([^']*)'|answer:\s*"([^"]*)"/.exec(body);
    const opts = [...body.matchAll(/textKey:\s*'([^']+)',\s*correct:\s*(true|false)/g)].map((o) => ({
      text: t(ru, o[1]),
      en: t(en, o[1]),
      correct: o[2] === 'true',
      key: o[1].replace(/^data\.tasks\./, ''),
    }));
    tasks.push({
      taskId,
      type,
      qKey: qKey.replace(/^data\.tasks\./, ''),
      qRu: t(ru, qKey),
      qEn: t(en, qKey),
      answer: answer ? answer[1] ?? answer[2] : null,
      options: opts,
    });
  }
  return { id, tasks };
}

const seven = [
  'g2r-sp-l1',
  'g2s-bdy-l3',
  'g3w-eco-l1',
  'g1e-num-l2',
  'g2s-ani-l3',
  'g2e-phr-l3',
  'g4m-cm-l2',
];
const three = ['g2s-bdy-l1', 'g2s-bdy-l2', 'g2r-sent-l1'];

const out = {
  sevenCurrent: Object.fromEntries(seven.map((id) => [id, dumpTasks(id)])),
  threeReview: Object.fromEntries(three.map((id) => [id, dumpTasks(id)])),
};
fs.writeFileSync(path.join(root, 'scripts/_wave_diag_structured.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');

for (const id of [...seven, ...three]) {
  const d = out.sevenCurrent[id] || out.threeReview[id];
  console.log(`\n======== ${id} ========`);
  for (const task of d.tasks || []) {
    console.log(`[${task.taskId}] ${task.type}`);
    console.log(`  Q(RU): ${task.qRu}`);
    if (task.type === 'input') console.log(`  answer: ${task.answer}`);
    for (const o of task.options) {
      console.log(`  ${o.correct ? '✓' : '·'} ${o.text}  {${o.key}}`);
    }
  }
}
