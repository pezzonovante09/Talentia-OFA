import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');

const ids = [
  'g2s-plt-l1',
  'g2s-ani-l1',
  'g2s-ani-l2',
  'g2s-ani-l3',
  'g2s-bdy-l1',
  'g2s-bdy-l2',
  'g2r-sp-l2',
  'g2r-sp-l3',
  'g2r-sh-l3',
  'g3m-1000-l1',
  'g2m-100-l1',
  'g3r-adj-l3',
  'g3r-gen-l3',
  'g3r-verb-l3',
];

for (const id of ids) {
  const re = new RegExp(`id: '${id}'[\\s\\S]*?tasks: \\[[\\s\\S]*?\\] \\}`);
  const m = worlds.match(re);
  console.log(`\n==== ${id}`);
  if (!m) {
    console.log('NO MATCH');
    continue;
  }
  const keys = [...new Set([...m[0].matchAll(/data\.tasks\.([a-zA-Z0-9_]+)/g)].map((x) => x[1]))];
  for (const k of keys) {
    const r = ru.data.tasks[k] || '';
    const e = en.data.tasks[k] || '';
    const y = ky.data.tasks[k] || '';
    console.log(k);
    console.log(' RU:', r.slice(0, 120));
    console.log(' EN:', e.slice(0, 120));
    console.log(' KY:', y.slice(0, 120));
  }
}
