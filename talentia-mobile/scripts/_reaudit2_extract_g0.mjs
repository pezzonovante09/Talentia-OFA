import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const rw56 = fs.readFileSync(path.join(root, 'src/data/rw56LessonTasks.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const abaEn = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/abaTextOverrides.en.generated.json'), 'utf8'));
const abaKy = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/abaTextOverrides.ky.generated.json'), 'utf8'));

function t(obj, key) {
  if (!key) return '';
  const parts = key.split('.');
  let c = obj;
  for (const p of parts) {
    c = c?.[p];
    if (c === undefined) return '<MISS:' + key + '>';
  }
  return c;
}
const tRu = (k) => t(ru, k);

function abaLookup(qKey) {
  const short = qKey.replace(/^data\.tasks\./, '');
  return {
    en: abaEn[short] || abaEn[qKey] || t(en, qKey),
    ky: abaKy[short] || abaKy[qKey] || t(ky, qKey),
  };
}

function extractWorldsTasks(tasksBlock) {
  const tasks = [];
  // Support both single-line and multiline `{ id: '...', type: '...' }`
  const taskStarts = [
    ...tasksBlock.matchAll(/\{\s*\n?\s*id:\s*'([\w-]+)',\s*\n?\s*type:\s*'(\w+)'/g),
  ];
  for (let ti = 0; ti < taskStarts.length; ti++) {
    const tm = taskStarts[ti];
    const segStart = tm.index;
    const segEnd = ti + 1 < taskStarts.length ? taskStarts[ti + 1].index : tasksBlock.length;
    const seg = tasksBlock.slice(segStart, segEnd);
    const qm = seg.match(/questionKey:\s*'([^']+)'/);
    const aud = /audience:\s*'special_aba'/.test(seg);
    const task = {
      id: tm[1],
      type: tm[2],
      aba: aud,
      q: qm ? tRu(qm[1]) : '?',
      qKey: qm?.[1] || null,
      options: [],
      answer: null,
      sentence: null,
    };
    for (const om of seg.matchAll(/\{\s*id:\s*'(\w+)',\s*textKey:\s*'([^']+)',\s*correct:\s*(true|false)/g)) {
      task.options.push({ id: om[1], text: tRu(om[2]), correct: om[3] === 'true', key: om[2] });
    }
    const ans = seg.match(/answer:\s*["']([^"']+)["']/);
    const cak = seg.match(/correctAnswerKey:\s*'([^']+)'/);
    if (ans) task.answer = ans[1];
    if (cak) task.answer = tRu(cak[1]);
    const sk = seg.match(/sentenceKey:\s*'([^']+)'/);
    if (sk) task.sentence = tRu(sk[1]);
    if (aud && qm) Object.assign(task, abaLookup(qm[1]));
    tasks.push(task);
  }
  return tasks;
}

function extractRw56Tasks(tid) {
  const lines = rw56.split('\n');
  let s = -1;
  let e = lines.length;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`'${tid}': [`)) {
      s = i;
      break;
    }
  }
  if (s < 0) return [];
  for (let i = s + 1; i < lines.length; i++) {
    if (/^  '[\w-]+': \[/.test(lines[i])) {
      e = i;
      break;
    }
  }
  const tasksBlock = lines.slice(s, e).join('\n');
  const tasks = [];
  const idxs = [...tasksBlock.matchAll(/"id":\s*"([\w-]+)",\n\s*"type":\s*"(\w+)"/g)];
  for (let k = 0; k < idxs.length; k++) {
    const seg = tasksBlock.slice(idxs[k].index, k + 1 < idxs.length ? idxs[k + 1].index : tasksBlock.length);
    const q = seg.match(/"questionKey":\s*"([^"]+)"/);
    const aud = /"audience":\s*"special_aba"/.test(seg);
    const task = {
      id: idxs[k][1],
      type: idxs[k][2],
      aba: aud,
      q: q ? tRu(q[1]) : '?',
      qKey: q?.[1] || null,
      options: [],
      answer: null,
    };
    for (const om of seg.matchAll(/"id":\s*"(\w+)",\s*"textKey":\s*"([^"]+)",\s*"correct":\s*(true|false)/g)) {
      task.options.push({ id: om[1], text: tRu(om[2]), correct: om[3] === 'true', key: om[2] });
    }
    const cak = seg.match(/"correctAnswerKey":\s*"([^"]+)"/);
    if (cak) task.answer = tRu(cak[1]);
    if (aud && q) Object.assign(task, abaLookup(q[1]));
    tasks.push(task);
  }
  return tasks;
}

const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '_reaudit2_ids_g0.json'), 'utf8'));
const out = [];

for (const item of meta) {
  const id = item.id;
  const startIdx = worlds.search(new RegExp(`id: '${id}',`));
  if (startIdx < 0) {
    out.push({ id, error: 'not found' });
    continue;
  }
  const after = worlds.slice(startIdx + 10);
  const nextLesson = after.search(/\n\s*id: '[a-z0-9-]+',\s*\n\s*topicId:/);
  const endIdx = nextLesson >= 0 ? startIdx + 10 + nextLesson : worlds.length;
  const block = worlds.slice(startIdx, endIdx);

  const dialog = [];
  for (const dm of block.matchAll(/\{ speaker: '(\w+)', textKey: '([^']+)' \}/g)) {
    dialog.push({ speaker: dm[1], text: tRu(dm[2]) });
  }

  const tasksRef = block.match(/tasks:\s*RW56_LESSON_TASKS\['([^']+)'\]/);
  let source = 'worlds';
  let tasks;
  if (tasksRef) {
    source = 'rw56';
    tasks = extractRw56Tasks(tasksRef[1]);
  } else {
    const tm = block.match(/tasks:\s*\[([\s\S]*)/);
    tasks = extractWorldsTasks(tm ? tm[0] : block);
  }

  out.push({
    id,
    title: item.title,
    subject: item.subject,
    world: item.world,
    source,
    dialog,
    tasks,
    types: [...new Set(tasks.filter((x) => !x.aba).map((x) => x.type))],
  });
}

fs.writeFileSync(path.join(__dirname, '_reaudit2_g0_live.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('lessons', out.length);
for (const o of out) {
  console.log(`${o.id}|${o.source}|n=${o.tasks?.length}|types=${(o.types || []).join(',')}`);
}
