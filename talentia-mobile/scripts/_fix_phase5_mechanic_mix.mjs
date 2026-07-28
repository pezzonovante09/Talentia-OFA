/**
 * Phase 5: for each pure-MC lesson, convert 1 non-ABA MC task → input.
 * Handles inline worlds.ts tasks and rw56LessonTasks.ts banks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const inv = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_inventory.json'), 'utf8'));

function t(key) {
  if (!key) return '';
  const parts = key.replace(/^data\./, '').split('.');
  let cur = ru.data;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) return '';
  }
  return typeof cur === 'string' ? cur : '';
}

function answerFromText(txt) {
  if (!txt) return 'ok';
  // strip story, keep short answer
  let s = txt.trim();
  // prefer number
  const num = s.match(/^-?\d+(?:[.,]\d+)?$/);
  if (num) return num[0].replace(',', '.');
  // letter alone
  if (/^[A-Za-zА-Яа-яЁё]$/.test(s)) return s.toUpperCase();
  // English short word / phrase up to 3 tokens
  if (/^[A-Za-z][A-Za-z' !?.-]{0,40}$/.test(s)) return s.replace(/[.!]+$/, '').trim();
  // Russian short
  const clean = s.replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  if (words.length <= 4 && clean.length <= 40) return clean;
  // take first meaningful token
  const m = clean.match(/[A-Za-zА-Яа-яЁё0-9>+<=]+/);
  return m ? m[0] : 'ok';
}

const pureIds = new Set(inv.pureMcIds || []);
console.log('pure MC lessons from inventory:', pureIds.size);

// --- 1) worlds.ts inline lessons ---
const wp = path.join(root, 'src/data/worlds.ts');
let worlds = fs.readFileSync(wp, 'utf8');
const nl = worlds.includes('\r\n') ? '\r\n' : '\n';

const lessonRe = /\{\s*id:\s*'([^']+)',\s*topicId:\s*'([^']+)',\s*titleKey:\s*'([^']+)'/g;
let m;
const lessonSpans = [];
while ((m = lessonRe.exec(worlds))) {
  const start = m.index;
  const next = worlds.slice(start + 1).search(/\{\s*id:\s*'[^']+',\s*topicId:/);
  const end = next === -1 ? worlds.length : start + 1 + next;
  lessonSpans.push({ id: m[1], start, end, block: worlds.slice(start, end) });
}

let worldsConverted = 0;
const convertedIds = [];
const skipIds = [];

for (const lesson of lessonSpans) {
  if (!pureIds.has(lesson.id)) continue;
  const block = lesson.block;
  // Skip if tasks are imported constants / RW56 refs without inline type
  if (!/type:\s*'multiple_choice'/.test(block)) {
    skipIds.push(lesson.id + ':no-inline-mc');
    continue;
  }
  if (/type:\s*'(?!multiple_choice)[a-z_]+'/.test(block.replace(/type:\s*'multiple_choice'/g, ''))) {
    // already mixed somehow
    skipIds.push(lesson.id + ':already-mixed');
    continue;
  }

  // Find last non-ABA MC task line (single-line compact style preferred)
  const lines = block.split(/\r?\n/);
  let targetIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!/type:\s*'multiple_choice'/.test(line)) continue;
    if (/audience:\s*'special_aba'/.test(line)) continue;
    // Prefer compact one-liner with options
    if (/options:\s*\[/.test(line) && /correct:\s*true/.test(line)) {
      targetIdx = i;
      break;
    }
  }
  if (targetIdx < 0) {
    // multiline JSON-ish not expected in worlds for g2+; try span of MC object
    skipIds.push(lesson.id + ':no-oneline-mc');
    continue;
  }

  const line = lines[targetIdx];
  const idM = line.match(/id:\s*'([^']+)'/);
  const qM = line.match(/questionKey:\s*'([^']+)'/);
  const dM = line.match(/difficulty:\s*(\d+)/);
  const correctM = line.match(/\{\s*id:\s*'[^']+',\s*textKey:\s*'([^']+)',\s*correct:\s*true/);
  if (!idM || !qM || !correctM) {
    skipIds.push(lesson.id + ':parse-fail');
    continue;
  }
  const ans = answerFromText(t(correctM[1]));
  const indent = line.match(/^\s*/)[0];
  const newLine = `${indent}{ id: '${idM[1]}', type: 'input', questionKey: '${qM[1]}', difficulty: ${dM ? dM[1] : 1}, answer: ${JSON.stringify(ans)} },`;
  lines[targetIdx] = newLine;
  const newBlock = lines.join(nl);
  worlds = worlds.slice(0, lesson.start) + newBlock + worlds.slice(lesson.end);
  // update span offsets for subsequent? safer to re-scan — rebuild spans after each change is expensive.
  // Instead apply from end to start:
  lesson._newBlock = newBlock;
  lesson._done = true;
  worldsConverted++;
  convertedIds.push(lesson.id);
}

// Re-apply from end so offsets stay valid
const done = lessonSpans.filter((l) => l._done).sort((a, b) => b.start - a.start);
worlds = fs.readFileSync(wp, 'utf8'); // reset
for (const lesson of done) {
  const start = worlds.indexOf(`id: '${lesson.id}',`);
  // find lesson object start
  const objStart = worlds.lastIndexOf('{', start);
  const next = worlds.slice(start + 1).search(/\{\s*id:\s*'[^']+',\s*topicId:/);
  const end = next === -1 ? worlds.length : start + 1 + next;
  // Use the previously computed newBlock but recompute from current block for safety
  const block = worlds.slice(objStart, end);
  const lines = block.split(/\r?\n/);
  let targetIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!/type:\s*'multiple_choice'/.test(line)) continue;
    if (/audience:\s*'special_aba'/.test(line)) continue;
    if (/options:\s*\[/.test(line) && /correct:\s*true/.test(line)) {
      targetIdx = i;
      break;
    }
  }
  if (targetIdx < 0) continue;
  const line = lines[targetIdx];
  const idM = line.match(/id:\s*'([^']+)'/);
  const qM = line.match(/questionKey:\s*'([^']+)'/);
  const dM = line.match(/difficulty:\s*(\d+)/);
  const correctM = line.match(/textKey:\s*'([^']+)',\s*correct:\s*true/);
  if (!idM || !qM || !correctM) continue;
  const ans = answerFromText(t(correctM[1]));
  const indent = line.match(/^\s*/)[0];
  lines[targetIdx] = `${indent}{ id: '${idM[1]}', type: 'input', questionKey: '${qM[1]}', difficulty: ${dM ? dM[1] : 1}, answer: ${JSON.stringify(ans)} },`;
  worlds = worlds.slice(0, objStart) + lines.join(nl) + worlds.slice(end);
}

fs.writeFileSync(wp, worlds);
console.log('worlds.ts converted:', done.length);

// --- 2) rw56LessonTasks.ts for grade-0 pure MC that use RW56 ---
const rp = path.join(root, 'src/data/rw56LessonTasks.ts');
let rw = fs.readFileSync(rp, 'utf8');
const rwNl = rw.includes('\r\n') ? '\r\n' : '\n';

// Map lesson id → rw56 key when worlds says tasks: RW56_LESSON_TASKS['xxx']
const rwMap = {};
for (const mm of worlds.matchAll(/id:\s*'([^']+)'[\s\S]{0,400}?tasks:\s*RW56_LESSON_TASKS\['([^']+)'\]/g)) {
  rwMap[mm[1]] = mm[2];
}

let rwConverted = 0;
for (const lessonId of pureIds) {
  const key = rwMap[lessonId] || lessonId;
  // only convert if this lesson is pure MC and bank exists
  const startRe = new RegExp(`'${key.replace(/-/g, '\\-')}':\\s*\\[`);
  const sm = rw.match(startRe);
  if (!sm) continue;
  const start = sm.index;
  // find end of array at next top-level key
  let end = rw.length;
  const after = rw.slice(start + sm[0].length);
  const nextKey = after.search(/\n  '[\w-]+':\s*\[/);
  if (nextKey >= 0) end = start + sm[0].length + nextKey;
  const block = rw.slice(start, end);
  if (!/"type":\s*"multiple_choice"/.test(block)) continue;
  // already has non-mc?
  if (/"type":\s*"(?!multiple_choice)[^"]+"/.test(block.replace(/"type":\s*"multiple_choice"/g, ''))) {
    continue;
  }

  // Find last non-ABA MC task object
  const taskStarts = [...block.matchAll(/\n  \{\n    "id":/g)];
  let chosen = null;
  for (let i = taskStarts.length - 1; i >= 0; i--) {
    const ts = taskStarts[i].index;
    const te = i + 1 < taskStarts.length ? taskStarts[i + 1].index : block.length;
    const seg = block.slice(ts, te);
    if (!/"type":\s*"multiple_choice"/.test(seg)) continue;
    if (/"audience":\s*"special_aba"/.test(seg)) continue;
    const q = seg.match(/"questionKey":\s*"([^"]+)"/);
    const id = seg.match(/"id":\s*"([^"]+)"/);
    const diff = seg.match(/"difficulty":\s*(\d+)/);
    const correct = seg.match(/"textKey":\s*"([^"]+)",\s*"correct":\s*true/);
    if (!q || !id || !correct) continue;
    chosen = { ts, te, id: id[1], q: q[1], diff: diff ? diff[1] : '1', ans: answerFromText(t(correct[1])) };
    break;
  }
  if (!chosen) continue;

  const newSeg =
    `\n  {\n` +
    `    "id": "${chosen.id}",\n` +
    `    "type": "input",\n` +
    `    "questionKey": "${chosen.q}",\n` +
    `    "difficulty": ${chosen.diff},\n` +
    `    "answer": ${JSON.stringify(chosen.ans)}\n` +
    `  },`;
  // preserve trailing comma style - chosen.te may include comma after }
  const newBlock = block.slice(0, chosen.ts) + newSeg + block.slice(chosen.te).replace(/^\s*\},?/, '');
  // Fix: better replace only the task object
  const taskObjMatch = block.slice(chosen.ts, chosen.te).match(/^(\s*\{[\s\S]*?\n  \}),?/);
  if (!taskObjMatch) continue;
  const replaced = block.slice(0, chosen.ts) + newSeg + block.slice(chosen.ts + taskObjMatch[0].length);
  rw = rw.slice(0, start) + replaced + rw.slice(end);
  rwConverted++;
  convertedIds.push(lessonId + '@rw56:' + key);
}

fs.writeFileSync(rp, rw);
console.log('rw56 converted:', rwConverted);

// --- 3) g1worldRewrittenTasks + ensure g1 bridged pure-MC get a conversion via worlds if they use constants ---
// Convert one task in each G1W_* exported array if still all MC
const g1wp = path.join(root, 'src/data/g1worldRewrittenTasks.ts');
if (fs.existsSync(g1wp)) {
  let g1 = fs.readFileSync(g1wp, 'utf8');
  let n = 0;
  g1 = g1.replace(
    /export const (G1W_[A-Z0-9_]+): LessonTask\[] = \[([\s\S]*?)\];/g,
    (full, name, body) => {
      if (/type: 'input'|type: 'fill_blank'|type: 'sorting'/.test(body)) return full;
      // convert last non-aba MC line
      const lines = body.split(/\r?\n/);
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!/type: 'multiple_choice'/.test(line)) continue;
        if (/special_aba/.test(line)) continue;
        const idM = line.match(/id: '([^']+)'/);
        const qM = line.match(/questionKey: '([^']+)'/);
        const dM = line.match(/difficulty: (\d+)/);
        const cM = line.match(/textKey: '([^']+)', correct: true/);
        if (!idM || !qM || !cM) continue;
        const ans = answerFromText(t(cM[1]));
        const indent = line.match(/^\s*/)[0];
        lines[i] = `${indent}{ id: '${idM[1]}', type: 'input', questionKey: '${qM[1]}', difficulty: ${dM ? dM[1] : 1}, answer: ${JSON.stringify(ans)} },`;
        n++;
        convertedIds.push(name);
        break;
      }
      return `export const ${name}: LessonTask[] = [${lines.join(nl)}];`;
    },
  );
  fs.writeFileSync(g1wp, g1);
  console.log('g1worldRewrittenTasks converted arrays:', n);
}

fs.writeFileSync(
  path.join(root, 'scripts/_phase5_converted.json'),
  JSON.stringify({ convertedIds, skipIds, worldsConverted: done.length, rwConverted }, null, 2),
);
console.log('total converted entries:', convertedIds.length);
console.log('skipped:', skipIds.length);
