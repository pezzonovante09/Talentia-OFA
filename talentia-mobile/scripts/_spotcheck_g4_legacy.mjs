/** Spot-check key lessons after wave2 audit. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const worldsSrc = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));

function getNested(obj, dotted) {
  let cur = obj;
  for (const p of dotted.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}
function t(L, k) {
  return getNested(L, k) ?? '<MISS>';
}

function extract(id) {
  const re = new RegExp(`id:\\s*'${id}'\\s*,`);
  let searchFrom = 0;
  let idx = -1;
  while (true) {
    const m = re.exec(worldsSrc.slice(searchFrom));
    if (!m) break;
    const abs = searchFrom + m.index;
    if (/topicId:/.test(worldsSrc.slice(abs, abs + 120))) {
      idx = abs;
      break;
    }
    searchFrom = abs + 1;
  }
  if (idx < 0) return null;
  let start = idx;
  while (start > 0 && worldsSrc[start] !== '{') start--;
  let depth = 0;
  for (let j = start; j < worldsSrc.length; j++) {
    if (worldsSrc[j] === '{') depth++;
    else if (worldsSrc[j] === '}') {
      depth--;
      if (depth === 0) return worldsSrc.slice(start, j + 1);
    }
  }
  return null;
}

function parse(block, lessonId) {
  const starts = [];
  for (const m of block.matchAll(/id:\s*'([^']+)'\s*,\s*type:\s*'(\w+)'/g)) {
    if (m[1] !== lessonId) starts.push({ index: m.index, id: m[1], type: m[2] });
  }
  for (const m of block.matchAll(/id:\s*'([^']+)'\s*,\s*\n\s*type:\s*'(\w+)'/g)) {
    if (m[1] !== lessonId && !starts.some((s) => s.id === m[1])) {
      starts.push({ index: m.index, id: m[1], type: m[2] });
    }
  }
  starts.sort((a, b) => a.index - b.index);
  const tasks = [];
  for (const s of starts) {
    let objStart = s.index;
    while (objStart > 0 && block[objStart] !== '{') objStart--;
    let depth = 0;
    let objEnd = objStart;
    for (let j = objStart; j < block.length; j++) {
      if (block[j] === '{') depth++;
      else if (block[j] === '}') {
        depth--;
        if (depth === 0) {
          objEnd = j + 1;
          break;
        }
      }
    }
    const body = block.slice(objStart, objEnd);
    if (/audience:\s*'special_aba'/.test(body)) continue;
    const qKey = (body.match(/questionKey:\s*'([^']+)'/) || [])[1];
    const answer =
      (body.match(/answer:\s*"([^"]+)"/) || body.match(/answer:\s*'([^']+)'/) || [])[1] || null;
    const options = [
      ...body.matchAll(/\{\s*id:\s*'([^']+)'\s*,\s*textKey:\s*'([^']+)'\s*,\s*correct:\s*(true|false)/g),
    ].map((om) => ({
      id: om[1],
      correct: om[3] === 'true',
      ru: t(ru, om[2]),
      en: t(en, om[2]),
    }));
    tasks.push({
      id: s.id,
      type: s.type,
      q: qKey ? t(ru, qKey) : '',
      qEn: qKey ? t(en, qKey) : '',
      options,
      answer,
    });
  }
  return tasks;
}

const ids = [
  'jungle-sub-2',
  'canyon-words-2',
  'canyon-words-1',
  'canyon-sent-1',
  'lab-animals-2',
  'space-solar-1',
  'jungle-add-2',
  'g4m-fr-l1',
  'g4m-fr-l2',
  'g4m-fr-l3',
  'g4m-cm-l2',
  'g4m-md-l3',
  'g4s-emo-l3',
  'g4s-turn-l3',
  'g4e-pres-l2',
  'g4e-past-l2',
  'lab-physics-1',
];

for (const id of ids) {
  const block = extract(id);
  const tasks = parse(block, id);
  console.log('\n####', id, 'n=' + tasks.length);
  tasks.forEach((tk, i) => {
    const c = tk.options.filter((o) => o.correct).map((o) => o.ru).join('|');
    console.log(' t' + (i + 1), '<' + tk.type + '>', tk.q.slice(0, 110));
    if (c) console.log('   ✓', c);
    if (tk.answer) console.log('   ans', tk.answer);
  });
}
