/**
 * Phase 5b: convert 1 multiline MC → input in remaining pure-MC lessons
 * and in g1worldRewrittenTasks.ts banks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));

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
  let s = txt.trim();
  if (/^-?\d+(?:[.,]\d+)?$/.test(s)) return s.replace(',', '.');
  if (/^[A-Za-zА-Яа-яЁё]$/.test(s)) return s.toUpperCase();
  if (/^[A-Za-z][A-Za-z' !?.-]{0,40}$/.test(s)) return s.replace(/[.!]+$/, '').trim();
  const clean = s.replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  if (words.length <= 4 && clean.length <= 40) return clean;
  // Prefer number inside phrase
  const num = clean.match(/\b(\d+)\b/);
  if (num) return num[1];
  const m = clean.match(/[A-Za-zА-Яа-яЁё0-9>+<=]+/);
  return m ? m[0] : 'ok';
}

/** Convert last non-ABA multiline MC object in a tasks array string → input */
function convertMultilineTasksBody(body, nl) {
  // Match task objects that start with { id: ... type: 'multiple_choice'
  const re =
    /(\n)(\s*)\{\s*\n\s*id:\s*'([^']+)',\s*\n\s*type:\s*'multiple_choice',([\s\S]*?)\n\2\},?/g;
  let match;
  let last = null;
  while ((match = re.exec(body))) {
    const full = match[0];
    if (/audience:\s*'special_aba'/.test(full)) continue;
    const qM = full.match(/questionKey:\s*'([^']+)'/);
    const dM = full.match(/difficulty:\s*(\d+)/);
    const cM = full.match(/textKey:\s*'([^']+)',\s*correct:\s*true/);
    if (!qM || !cM) continue;
    last = {
      start: match.index,
      end: match.index + full.length,
      indent: match[2],
      id: match[3],
      q: qM[1],
      diff: dM ? dM[1] : '1',
      ans: answerFromText(t(cM[1])),
      hadTrailingComma: /,\s*$/.test(full),
    };
  }
  if (!last) return null;
  const comma = last.hadTrailingComma ? ',' : '';
  const repl =
    `${nl}${last.indent}{ id: '${last.id}', type: 'input', questionKey: '${last.q}', difficulty: ${last.diff}, answer: ${JSON.stringify(last.ans)} }${comma}`;
  return body.slice(0, last.start) + repl + body.slice(last.end);
}

const lessonIds = [
  'jungle-add-1',
  'canyon-words-2',
  'lab-animals-1',
  'lab-animals-2',
  'space-planets-2',
  'meadow-c5-l3',
];

const wp = path.join(root, 'src/data/worlds.ts');
let worlds = fs.readFileSync(wp, 'utf8');
const nl = worlds.includes('\r\n') ? '\r\n' : '\n';
let worldsN = 0;

for (const id of lessonIds) {
  const idTok = `id: '${id}',`;
  const idPos = worlds.indexOf(idTok);
  if (idPos < 0) {
    console.log('missing lesson', id);
    continue;
  }
  const objStart = worlds.lastIndexOf('{', idPos);
  const after = worlds.slice(idPos + 1);
  const next = after.search(/\{\s*id:\s*'[^']+',\s*topicId:/);
  const end = next === -1 ? worlds.length : idPos + 1 + next;
  const block = worlds.slice(objStart, end);
  if (/type:\s*'input'/.test(block)) {
    console.log('already mixed', id);
    continue;
  }
  const tasksM = block.match(/tasks:\s*\[([\s\S]*?)\]\s*,?\s*(?:\}|$)/);
  if (!tasksM) {
    console.log('no tasks', id);
    continue;
  }
  const newBody = convertMultilineTasksBody(tasksM[1], nl);
  if (!newBody) {
    console.log('convert fail', id);
    continue;
  }
  const newBlock = block.replace(tasksM[1], newBody);
  worlds = worlds.slice(0, objStart) + newBlock + worlds.slice(end);
  worldsN++;
  console.log('converted', id);
}

fs.writeFileSync(wp, worlds);
console.log('worlds multiline converted:', worldsN);

// g1worldRewrittenTasks — convert one MC per export array
const g1wp = path.join(root, 'src/data/g1worldRewrittenTasks.ts');
let g1 = fs.readFileSync(g1wp, 'utf8');
const g1nl = g1.includes('\r\n') ? '\r\n' : '\n';
let g1n = 0;
g1 = g1.replace(
  /export const (G1W_[A-Z0-9_]+): LessonTask\[] = \[([\s\S]*?)\];/g,
  (full, name, body) => {
    if (/type:\s*'input'|type:\s*'fill_blank'|type:\s*'sorting'|type:\s*'routine_chain'/.test(body)) {
      return full;
    }
    const newBody = convertMultilineTasksBody(body, g1nl);
    if (!newBody) {
      console.log('g1 convert fail', name);
      return full;
    }
    g1n++;
    console.log('converted array', name);
    return `export const ${name}: LessonTask[] = [${newBody}];`;
  },
);
fs.writeFileSync(g1wp, g1);
console.log('g1world arrays converted:', g1n);
