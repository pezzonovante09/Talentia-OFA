import fs from 'fs';

function stripParens(s) {
  return s.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

const PREFIXES = [
  'Сравни числа и выбери правильный ответ: ',
  'Подумай и выбери: ',
  'Продолжи последовательность: ',
  'Введи ответ: ',
  'Разберись: ',
];

function stripPrefix(s) {
  for (const p of PREFIXES) {
    if (s.startsWith(p)) return s.slice(p.length).trim();
  }
  return s;
}

function parseTsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      q = !q;
      continue;
    }
    if (!q && ch === '\t') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function getTask(ruDoc, key) {
  const short = key.replace(/^data\.tasks\./, '');
  let o = ruDoc.data.tasks;
  return typeof o[short] === 'string' ? o[short] : null;
}

const tsvPath = 'c:/Users/User/Downloads/final_tasks.tsv';
const ruPath = 'c:/Users/User/Desktop/Talentia-v1.0/talentia-mobile/src/i18n/locales/ru.json';
const tsv = fs.readFileSync(tsvPath, 'utf8').trim().split(/\r?\n/);
const hdr = parseTsvLine(tsv[0]);
const qi = hdr.indexOf('questionKey');
const ri = hdr.indexOf('questionRu');
const ruDoc = JSON.parse(fs.readFileSync(ruPath, 'utf8'));
const last = new Map();
for (let i = 1; i < tsv.length; i++) {
  const c = parseTsvLine(tsv[i]);
  last.set(c[qi], stripParens(c[ri]));
}
let ok = 0;
let bad = 0;
const badKeys = [];
for (const [qk, clean] of last) {
  const core = stripPrefix(clean);
  const old = getTask(ruDoc, qk);
  if (!old) {
    bad++;
    if (badKeys.length < 20) badKeys.push([qk, 'NO_OLD']);
    continue;
  }
  const ot = old.trim();
  if (core === ot || clean === ot) ok++;
  else {
    bad++;
    if (badKeys.length < 20) badKeys.push([qk, ot.substring(0, 50), '!=', core.substring(0, 50)]);
  }
}
console.log(JSON.stringify({ keys: last.size, ok, bad, badKeys }, null, 2));
