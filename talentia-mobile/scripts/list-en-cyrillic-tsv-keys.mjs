import fs from 'fs';

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

const re = /[\u0400-\u04FF]/;
const tsv = fs.readFileSync('input/final_tasks.tsv', 'utf8').trim().split(/\r?\n/);
const h = parseTsvLine(tsv[0]);
const qi = h.indexOf('questionKey');
const keys = new Set();
for (let i = 1; i < tsv.length; i++) {
  keys.add(parseTsvLine(tsv[i])[qi].replace(/^data\.tasks\./, ''));
}
const j = JSON.parse(fs.readFileSync('../src/i18n/locales/en.json', 'utf8'));
const t = j.data.tasks;
const bad = [];
for (const k of keys) {
  const v = t[k];
  if (typeof v === 'string' && re.test(v)) bad.push(k);
}
console.log('cyrillic en count among TSV keys', bad.length);
console.log(bad.slice(0, 25).join('\n'));
