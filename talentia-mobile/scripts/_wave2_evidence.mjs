import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));

function t(doc, k) {
  const parts = String(k).replace(/^data\./, '').split('.');
  let cur = doc.data;
  for (const x of parts) cur = cur?.[x];
  return typeof cur === 'string' ? cur : '';
}

function sliceLesson(id) {
  const needle = `id: '${id}'`;
  const idx = worlds.indexOf(needle);
  if (idx < 0) return null;
  const rest = worlds.slice(idx + needle.length);
  const next = rest.search(/\n\s{8}id: '/);
  return worlds.slice(idx, idx + needle.length + (next > 0 ? Math.min(next, 4000) : 4000));
}

function dump(id) {
  const slice = sliceLesson(id);
  console.log('\n========', id, '========');
  if (!slice) {
    console.log('NOT FOUND');
    return;
  }
  const taskRe = /\{\s*id:\s*'([^']+)',\s*type:\s*'([^']+)',\s*questionKey:\s*'([^']+)'([\s\S]*?)(?=\{\s*id:\s*'|\n\s{10}\]|$)/g;
  let m;
  let n = 0;
  while ((m = taskRe.exec(slice)) && n < 6) {
    const taskId = m[1];
    if (taskId === id) continue;
    n++;
    const type = m[2];
    const qKey = m[3];
    const body = m[0];
    const answer = /answer:\s*'([^']*)'|answer:\s*"([^"]*)"/.exec(body);
    const opts = [...body.matchAll(/textKey:\s*'([^']+)',\s*correct:\s*(true|false)/g)];
    console.log(`[${taskId}] ${type}`);
    console.log('  Q(RU):', t(ru, qKey));
    console.log('  Q(EN):', t(en, qKey));
    if (answer) console.log('  answer:', answer[1] ?? answer[2]);
    for (const o of opts) {
      console.log(`  ${o[2] === 'true' ? '✓' : '·'} ${t(ru, o[1])}  | EN: ${t(en, o[1])}  {${o[1].replace(/^data\.tasks\./, '')}}`);
    }
  }
}

for (const id of [
  'g2m-100-l2',
  'g4r-text-l3',
  'g4e-quest-l2',
  'g4s-emo-l2',
  'lab-physics-1',
  'g3r-gen-l1',
  'g3r-verb-l2',
  'g3r-adj-l1',
]) {
  dump(id);
}
