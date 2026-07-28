import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');

const checks = [
  ['g4m-cm-l1-t2', 'g4m_cm_q2_b'],
  ['g4m-cm-l1-t3', 'g4m_cm_q3_b'],
  ['g4m-cm-l2-t1', 'g4m_cm2_q1_b'],
  ['g4m-cm-l2-t2', 'g4m_cm2_q2_a'],
  ['g4m-cm-l2-t3', 'g4m_cm2_q3_b'],
  ['g4m-cm-l3-t1', 'g4m_cm3_q1_b'],
  ['g4m-cm-l3-t3', 'g4m_cm3_q3_b'],
  ['g4m-fr-l1-t2', 'g4m_fr_q2_a'],
  ['g4m-fr-l1-t3', 'g4m_fr_q3_a'],
  ['g4m-fr-l2-t1', 'g4m_fr2_q1_a'],
  ['g4m-fr-l2-t3', 'g4m_fr2_q3_b'],
  ['g4m-fr-l3-t2', 'g4m_fr3_q2_a'],
  ['g4m-fr-l3-t3', 'g4m_fr3_q3_a'],
  ['g4e-pres-l2-t2', 'g4e_pres2_q2_b'],
  ['g4e-pres-l2-t3', 'g4e_pres2_q3_b'],
  ['g4s-emo-l3-t3', 'g4s_emo3_q3_b'],
  ['g4s-turn-l3-t1', 'g4s_turn3_q1_c'],
  ['g4s-turn-l3-t2', 'g4s_turn3_q2_b'],
];

let ok = 0;
let bad = 0;
for (const [tid, key] of checks) {
  const re = new RegExp(`id: '${tid}'[^\\n]*`);
  const m = src.match(re);
  if (!m) {
    console.log('MISSING', tid);
    bad++;
    continue;
  }
  const om = m[0].match(new RegExp(`textKey: 'data\\.tasks\\.${key}', correct: (true|false)`));
  if (!om) {
    console.log('NO OPT', tid, key);
    bad++;
    continue;
  }
  if (om[1] === 'true') {
    ok++;
    console.log('OK', tid, '->', key);
  } else {
    bad++;
    console.log('FAIL', tid, '->', key, 'got', om[1]);
  }
}

const inputs = [
  ['g4m-cm-l1-t4', 'Нет, правильно 884'],
  ['g4m-fr-l2-t4', 'answer: "5"'],
  ['g4s-emo-l3-t4', 'Приятное: неожиданный комплимент'],
  ['g4s-turn-l3-t4', 'Сначала нужно договориться со всеми'],
];
for (const [tid, ans] of inputs) {
  const re = new RegExp(`id: '${tid}'[^\\n]*`);
  const m = src.match(re);
  const okI = m && m[0].includes(ans);
  console.log(okI ? 'OK' : 'FAIL', tid, 'input');
  if (okI) ok++;
  else bad++;
}

console.log('RESULT ok', ok, 'bad', bad);
console.log(
  'arith',
  124 * 4,
  312 * 3,
  1346 * 5,
  2417 * 3,
  3208 * 6,
  236 * 12,
  418 * 13,
  221 * 4
);
