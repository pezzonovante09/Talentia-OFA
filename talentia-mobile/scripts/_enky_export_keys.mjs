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
  'g2r-sh-l2',
  'g2r-sh-l3',
  'g2m-100-l1',
  'g2m-100-l3',
  'g3m-1000-l1',
  'g3e-daily-l3',
  'g3r-adj-l3',
  'g3r-gen-l3',
  'g3r-verb-l3',
  'g2e-sch-l1',
  'g2e-phr-l1',
];

const out = {};
for (const id of ids) {
  const re = new RegExp(`id: '${id}'[\\s\\S]*?tasks: \\[[\\s\\S]*?\\] \\}`);
  const m = worlds.match(re);
  if (!m) continue;
  const keys = [...new Set([...m[0].matchAll(/data\.(tasks|dialog|intro)\.([a-zA-Z0-9_]+)/g)].map((x) => `${x[1]}.${x[2]}`))];
  out[id] = {};
  for (const full of keys) {
    const [sec, k] = full.split('.');
    out[id][full] = {
      ru: ru.data[sec][k] || null,
      en: en.data[sec][k] || null,
      ky: ky.data[sec][k] || null,
    };
  }
}
fs.writeFileSync(path.join(root, 'scripts/_enky_full_keys.json'), JSON.stringify(out, null, 2));
console.log('lessons', Object.keys(out).length, 'bytes', JSON.stringify(out).length);
