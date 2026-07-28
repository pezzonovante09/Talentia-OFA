import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));

const ids = ['g2e-days-l1', 'g2e-sch-l2', 'g2r-sh-l1', 'g2m-100-l3', 'g3e-food-l2', 'g3e-daily-l3'];
let out = '';
for (const id of ids) {
  out += `\n==== ${id} ====\n`;
  out += execSync(`node scripts/_dump_lesson.mjs ${id}`, { encoding: 'utf8', cwd: root });
}
const checks = [
  ['g2e_opt_monday', 'Monday'],
  ['g2e_opt_music', 'Music'],
  ['g2r_nos_consonant', null],
  ['g2r_zha_hard', null],
  ['g2r_la_is_what', null],
  ['g2m_smallest_78_82_91', null],
  ['g3e_food2_q2_a', null],
  ['g3e_daily3_q1_a', null],
  ['g2s_heart_does', null],
  ['g2e_board_en', null],
];
out += '\n==== KEY CHECKS ====\n';
for (const [k, expectKy] of checks) {
  const r = ru.data.tasks[k];
  const e = en.data.tasks[k];
  const y = ky.data.tasks[k];
  out += `${k}\n  RU: ${r}\n  EN: ${e}\n  KY: ${y}\n`;
  if (expectKy && y !== expectKy) out += `  !! KY expected ${expectKy}\n`;
  if (k === 'g2r_la_is_what' && /PA syllable/.test(e || '')) out += '  !! EN still PA\n';
  if (k === 'g2r_nos_consonant' && /letter H\b|“H”|Is H /.test(e || '')) out += '  !! EN still H\n';
  if (y && r && y.trim() === r.trim() && /[а-яё]{5,}/i.test(r) && !/НОС|Ж /.test(r)) {
    out += '  !! KY==RU leak?\n';
  }
}
fs.writeFileSync(path.join(root, 'scripts/_enky_verify_criticals.txt'), out, 'utf8');
console.log('wrote verify', out.length);
console.log(out.slice(-2000));
