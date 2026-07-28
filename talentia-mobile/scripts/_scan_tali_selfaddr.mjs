import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const t = (key) => { const parts = key.replace(/^data\./, '').split('.'); let cur = ru.data; for (const p of parts) { cur = cur?.[p]; if (cur === undefined) return null; } return cur; };

// find all lessons and their dialog, look for speaker:'tali' whose text addresses Тали
const lessonRe = /id: '([\w-]+)',\s*(?:topicId|titleKey)/g;
let m;
const hits = [];
const idxs = [];
while ((m = lessonRe.exec(src))) idxs.push({ id: m[1], idx: m.index });
for (let i = 0; i < idxs.length; i++) {
  const id = idxs[i].id;
  if (/^g4/.test(id)) continue; // g4 already handled
  const start = idxs[i].idx;
  const end = i + 1 < idxs.length ? idxs[i + 1].idx : src.length;
  const seg = src.slice(start, end);
  const dlg = seg.match(/dialog:\s*\[([\s\S]*?)\]/);
  if (!dlg) continue;
  for (const e of dlg[1].matchAll(/speaker:\s*'(\w+)',\s*textKey:\s*'([^']+)'/g)) {
    if (e[1] !== 'tali') continue;
    const txt = t(e[2]);
    if (txt && /(^|["«\s])Тали[,!.:\s]/.test(txt)) {
      hits.push(`${id}  {${e[2]}}  ${txt.slice(0, 100)}`);
    }
  }
}
console.log('tali-speaker lines addressing "Тали" (' + hits.length + '):');
console.log(hits.join('\n'));
