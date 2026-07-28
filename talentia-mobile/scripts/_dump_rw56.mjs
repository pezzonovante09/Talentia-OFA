// Dump rw56 lesson tasks with resolved RU text. Usage: node scripts/_dump_rw56.mjs id1 id2
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/data/rw56LessonTasks.ts'), 'utf8');
const lines = src.split('\n');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const t = (key) => {
  if (!key) return '';
  const parts = key.split('.');
  let cur = ru;
  for (const p of parts) { cur = cur?.[p]; if (cur === undefined) return '<MISS:' + key + '>'; }
  return cur;
};

for (const id of process.argv.slice(2)) {
  let start = lines.findIndex((l) => l.includes(`'${id}': [`));
  if (start < 0) { console.log('!!! not found ' + id); continue; }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s{2}'[\w-]+':\s*\[/.test(lines[i])) { end = i; break; }
  }
  const block = lines.slice(start, end).join('\n');
  console.log('\n######## ' + id + ' (rw56 lines ' + (start + 1) + '-' + end + ')');
  // split into task objects by "id": "...-t
  const taskRe = /"id":\s*"([\w-]+)",\s*"type":\s*"(\w+)",\s*"questionKey":\s*"([^"]+)"([\s\S]*?)(?=\n\s{2,4}\{\s*\n\s*"id":|\n\s*\]\s*,?\s*$)/g;
  let m;
  // simpler: iterate tasks by locating each "id": "xxx", "type"
  const idxs = [...block.matchAll(/"id":\s*"([\w-]+)",\n\s*"type":\s*"(\w+)"/g)];
  for (let k = 0; k < idxs.length; k++) {
    const seg = block.slice(idxs[k].index, k + 1 < idxs.length ? idxs[k + 1].index : block.length);
    const q = seg.match(/"questionKey":\s*"([^"]+)"/);
    const aud = /"audience":\s*"special_aba"/.test(seg) ? ' [ABA]' : '';
    console.log('  ' + idxs[k][1] + ' <' + idxs[k][2] + '>' + aud + ' Q: ' + (q ? t(q[1]) : '?'));
    for (const om of seg.matchAll(/"id":\s*"(\w+)",\s*"textKey":\s*"([^"]+)",\s*"correct":\s*(true|false)/g)) {
      console.log('      ' + om[1] + (om[3] === 'true' ? ' [v] ' : '     ') + t(om[2]) + '   {' + om[2].replace('data.tasks.', '') + '}');
    }
    const cam = seg.match(/"correctAnswerKey":\s*"([^"]+)"/);
    if (cam) console.log('      answer: ' + t(cam[1]) + '   {' + cam[1].replace('data.tasks.', '') + '}');
  }
}
