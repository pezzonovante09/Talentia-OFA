import fs from 'fs';

const p = 'src/data/worlds.ts';
let s = fs.readFileSync(p, 'utf8');
const before = s;

s = s.replace(
  /(id: 'jungle-sub-2-t2',[\s\S]*?answer: ')6(')/,
  (_m, a, b) => a + '5' + b
);

s = s.replace(
  "{ id: 'g2spltl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_carrot_part', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_root_p', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_fruit_p', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_leaf_p', correct: false }] }",
  "{ id: 'g2spltl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_carrot_part', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_veg_cat', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_fruit_cat', correct: false }] }"
);

s = s.replace(
  "{ id: 'g2spltl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_tomato_part', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_root_p', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_opt_fruit_p', correct: true }, { id: 'c', textKey: 'data.tasks.g2s_opt_leaf_p', correct: false }] }",
  "{ id: 'g2spltl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_tomato_part', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_veg_cat', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_opt_fruit_cat', correct: true }] }"
);

if (s === before) {
  console.log('NO CHANGES — checking current state');
  console.log('jungle', /jungle-sub-2-t2[\s\S]{0,160}answer: '(\d+)'/.exec(s)?.[1]);
  console.log('plt1 has veg?', /g2spltl3t1[\s\S]{0,220}/.exec(s)?.[0]);
  process.exit(1);
}

const tmp = p + '.tmp';
fs.writeFileSync(tmp, s);
fs.renameSync(tmp, p);
console.log('patched ok');
console.log('jungle answer', /jungle-sub-2-t2[\s\S]{0,160}answer: '(\d+)'/.exec(s)?.[1]);
console.log('plt1', /g2spltl3t1[\s\S]{0,200}/.exec(s)?.[0]);
