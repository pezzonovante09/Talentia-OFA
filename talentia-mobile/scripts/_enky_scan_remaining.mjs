import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');

const ids = [
  'g2m-100-l1',
  'g2m-100-l3',
  'g2m-add2-l1',
  'g2m-add2-l3',
  'g2m-times-l1',
  'g2m-times-l2',
  'g2m-times-l3',
  'g2e-phr-l1',
  'g2e-sch-l1',
  'g3m-1000-l1',
  'g2r-sp-l2',
  'g2r-sp-l3',
  'g2r-sh-l3',
  'g2s-plt-l1',
  'g2s-ani-l1',
  'g2s-ani-l2',
  'g2s-ani-l3',
  'g2s-bdy-l1',
  'g2s-bdy-l2',
  'g3r-adj-l3',
  'g3r-gen-l3',
  'g3r-verb-l3',
  'g3e-daily-l3',
  'g2e-days-l1',
  'g2r-sh-l1',
  'g2e-sch-l2',
];

const stubRe =
  /Hello!|Numbers up to|Multiplying by|Adding tens|Harder!|Super!|Tell me in English|Fish live|Insects —|Polite words|In the classroom|Times table|Classroom —|100, 200/;
const kyRuPhrase =
  /Какое|Кто из|Для чего|На какой|Слог |Запиши|Буква|Верно\?|перед 100|самое маленькое|Что делает|Главный признак/;

const rows = [];
for (const id of ids) {
  const re = new RegExp(`id: '${id}'[\\s\\S]*?tasks: \\[[\\s\\S]*?\\] \\}`, '');
  const m = worlds.match(re);
  if (!m) {
    console.log('no block', id);
    continue;
  }
  const keys = [...m[0].matchAll(/data\.(tasks|dialog|intro)\.([a-zA-Z0-9_]+)/g)].map(
    (x) => `${x[1]}.${x[2]}`,
  );
  console.log(`\n==== ${id}`);
  for (const full of [...new Set(keys)]) {
    const [sec, k] = full.split('.');
    const r = ru.data[sec][k] || '';
    const e = en.data[sec][k] || '';
    const y = ky.data[sec][k] || '';
    const leak = y && r && y.replace(/\s/g, '') === r.replace(/\s/g, '') && /[А-Яа-я]/.test(r);
    const short =
      e &&
      r &&
      e.length < Math.min(35, r.length * 0.4) &&
      !/^[0-9×x\s=?−\-]+$/.test(e.trim()) &&
      !/^[A-Za-z]+$/.test(e.trim());
    const flags = [];
    if (leak) flags.push('ky_eq_ru');
    if (kyRuPhrase.test(y) && /[А-Яа-я]/.test(y)) flags.push('ky_ru_phrase');
    if (short) flags.push('en_short');
    if (stubRe.test(e)) flags.push('en_stub');
    if (/Is the PA syllable|English board:|Compare the numbers and pick/.test(e)) flags.push('en_mismatch');
    if (!flags.length) continue;
    console.log(flags.join(','), full);
    console.log('  RU:', r.slice(0, 100));
    console.log('  EN:', e.slice(0, 100));
    console.log('  KY:', y.slice(0, 100));
    rows.push({ id, key: full, flags, r, e, y });
  }
}
fs.writeFileSync(path.join(root, 'scripts/_enky_remaining.json'), JSON.stringify(rows, null, 2));
console.log('\nrows', rows.length);
