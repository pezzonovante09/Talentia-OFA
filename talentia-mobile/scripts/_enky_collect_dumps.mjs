import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ids = [
  'g2r-sh-l2',
  'g2r-sh-l3',
  'g2m-100-l1',
  'g2m-100-l3',
  'g2m-add2-l1',
  'g2m-add2-l3',
  'g2m-times-l1',
  'g2m-times-l2',
  'g2e-sch-l1',
  'g2e-phr-l1',
  'g3m-1000-l1',
  'g2r-sp-l2',
  'g2r-sp-l3',
  'g2s-plt-l1',
  'g2s-ani-l1',
  'g2s-ani-l2',
  'g2s-ani-l3',
  'g2s-bdy-l1',
  'g2s-bdy-l2',
  'g3r-adj-l3',
  'g3r-gen-l3',
  'g3r-verb-l3',
];

let out = '';
for (const id of ids) {
  const o = execSync(`node scripts/_dump_lesson.mjs ${id}`, { encoding: 'utf8', cwd: root });
  out += `\n==== ${id} ====\n`;
  for (const line of o.split(/\n/)) {
    if (/Q RU:|Q EN:|Q KY:|^\s*D |answer:|dialog|■|\[dialog|fill_blank|multiple_choice|input\]/.test(line) || line.includes('########')) {
      out += line + '\n';
    }
  }
}
fs.writeFileSync(path.join(root, 'scripts/_enky_dumps.txt'), out, 'utf8');
console.log('wrote dumps', out.length);
