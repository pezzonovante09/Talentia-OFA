// Usage: node scripts/_dump_lesson.mjs lessonId1 lessonId2 ...
// Prints tasks of each lesson with resolved RU texts and worlds.ts line numbers.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const lines = src.split('\n');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));

function t(key) {
  if (!key) return '';
  const parts = key.split('.');
  let cur = ru;
  for (const p of parts) { cur = cur?.[p]; if (cur === undefined) return '<MISSING:' + key + '>'; }
  return cur;
}

const ids = process.argv.slice(2);
for (const id of ids) {
  // find lesson start
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`id: '${id}', topicId:`).test(lines[i])) { start = i; break; }
  }
  if (start < 0) { console.log('!!! not found: ' + id); continue; }
  // find lesson end: next line matching id: 'xxx', topicId: or end of topic
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/id: '[a-z0-9-]+', topicId:/.test(lines[i]) || /^\s*\] \},\s*$/.test(lines[i]) && /topic|world/.test(lines[i + 1] || '')) { end = i; break; }
  }
  console.log('\n######## ' + id + ' (worlds.ts lines ' + (start + 1) + '-' + end + ')');
  const block = lines.slice(start, end).join('\n');
  // dialog
  for (const m of block.matchAll(/\{ speaker: '(\w+)', textKey: '([^']+)' \}/g)) {
    console.log('  [dialog ' + m[1] + '] ' + t(m[2]));
  }
  for (const m of block.matchAll(/\{ titleKey: '([^']+)', bodyKey: '([^']+)'/g)) {
    console.log('  [intro] ' + t(m[1]) + ' :: ' + String(t(m[2])).slice(0, 200));
  }
  // tasks: parse per-line
  for (let i = start; i < end; i++) {
    const ln = lines[i];
    const tm = ln.match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(ln)) continue;
    const qm = ln.match(/questionKey: '([^']+)'/);
    const aud = /audience: 'special_aba'/.test(ln) ? ' [ABA]' : '';
    console.log('  L' + (i + 1) + ' ' + tm[1] + ' <' + tm[2] + '>' + aud + ' Q: ' + (qm ? t(qm[1]) : '?'));
    for (const om of ln.matchAll(/\{ id: '(\w+)', textKey: '([^']+)', correct: (true|false)[^}]*\}/g)) {
      console.log('      ' + om[1] + (om[3] === 'true' ? ' [✓] ' : '     ') + t(om[2]) + '   {' + om[2].replace('data.tasks.', '') + '}');
    }
    const cam = ln.match(/correctAnswerKey: '([^']+)'/);
    if (cam) console.log('      answer: ' + t(cam[1]) + '   {' + cam[1].replace('data.tasks.', '') + '}');
  }
}
