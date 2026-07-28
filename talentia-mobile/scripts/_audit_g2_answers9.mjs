import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const src = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const lines = src.split('\n');
const ids = JSON.parse(fs.readFileSync(path.join(__dirname, '_reaudit2_ids_g2.json'), 'utf8')).map((x) => x.id);

function t(obj, key) {
  if (!key) return '';
  let cur = obj;
  for (const p of key.split('.')) {
    cur = cur?.[p];
    if (cur === undefined) return '<MISS:' + key + '>';
  }
  return String(cur);
}

for (const id of ids) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`id: '${id}', topicId:`).test(lines[i])) {
      start = i;
      break;
    }
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/id: '[a-z0-9-]+', topicId:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  // multi-line task blocks: from task id line until next task or lesson end
  let taskStarts = [];
  for (let i = start; i < end; i++) {
    if (/id: '[\w-]+', type: '/.test(lines[i]) && !/topicId/.test(lines[i])) taskStarts.push(i);
  }
  for (let ti = 0; ti < taskStarts.length; ti++) {
    const ts = taskStarts[ti];
    const te = ti + 1 < taskStarts.length ? taskStarts[ti + 1] : end;
    const block = lines.slice(ts, te).join('\n');
    const tm = lines[ts].match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm) continue;
    if (tm[2] !== 'input') continue;
    const cam = block.match(/correctAnswerKey:\s*'([^']+)'/);
    const ca = block.match(/correctAnswer:\s*'([^']+)'/);
    const accepted = block.match(/acceptedAnswers:\s*\[([^\]]*)\]/);
    let ans = null;
    if (cam) ans = { key: cam[1], R: t(ru, cam[1]), E: t(en, cam[1]), K: t(ky, cam[1]) };
    else if (ca) ans = { literal: ca[1] };
    console.log(id, tm[1], ans ? JSON.stringify(ans) : 'NO_ANSWER', accepted ? 'accepted:' + accepted[1].slice(0, 80) : '');
  }
}
