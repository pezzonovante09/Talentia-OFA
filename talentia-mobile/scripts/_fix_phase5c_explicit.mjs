import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const wp = path.join(root, 'src/data/worlds.ts');
let s = fs.readFileSync(wp, 'utf8');

const reps = [
  [
    `{
                id: 'jungle-add-1-t3',
                type: 'multiple_choice',
                questionKey: 'data.tasks.q_count_apples',
                difficulty: 1,
                visualCount: 5,
                visualEmoji: '🍎',
                options: [
                  { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false },
                  { id: 'opt-5', textKey: 'data.tasks.opt_five', correct: true },
                  { id: 'opt-6', textKey: 'data.tasks.opt_six', correct: false },
                ],
              }`,
    `{ id: 'jungle-add-1-t3', type: 'input', questionKey: 'data.tasks.q_count_apples', difficulty: 1, answer: '5' }`,
  ],
  [
    `{
                id: 'canyon-w2-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.canyon_q_color_grass',
                difficulty: 2,
                options: [
                  { id: 'opt-blue', textKey: 'data.tasks.opt_blue', correct: false },
                  { id: 'opt-red', textKey: 'data.tasks.opt_red', correct: false },
                  { id: 'opt-green', textKey: 'data.tasks.opt_green', correct: true },
                ],
              }`,
    `{ id: 'canyon-w2-t2', type: 'input', questionKey: 'data.tasks.canyon_q_color_grass', difficulty: 2, answer: 'Зелёный' }`,
  ],
  [
    `{
                id: 'lab-an-1-t3',
                type: 'multiple_choice',
                questionKey: 'data.tasks.lab_q_cat_legs',
                difficulty: 2,
                options: [
                  { id: 'opt-2', textKey: 'data.tasks.opt_two', correct: false },
                  { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: true },
                  { id: 'opt-6', textKey: 'data.tasks.opt_six', correct: false },
                ],
              }`,
    `{ id: 'lab-an-1-t3', type: 'input', questionKey: 'data.tasks.lab_q_cat_legs', difficulty: 2, answer: '4' }`,
  ],
  [
    `{
                id: 'lab-an-2-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.lab_q_logic_pattern',
                difficulty: 2,
                options: [
                  { id: 'opt-circle', textKey: 'data.tasks.opt_circle', correct: true },
                  { id: 'opt-square', textKey: 'data.tasks.opt_square', correct: false },
                  { id: 'opt-triangle', textKey: 'data.tasks.opt_triangle', correct: false },
                ],
              }`,
    `{ id: 'lab-an-2-t2', type: 'input', questionKey: 'data.tasks.lab_q_logic_pattern', difficulty: 2, answer: 'Круг' }`,
  ],
  [
    `{
                id: 'space-pl-2-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.space_q_largest_planet',
                difficulty: 3,
                options: [
                  { id: 'opt-earth', textKey: 'data.tasks.opt_earth', correct: false },
                  { id: 'opt-saturn', textKey: 'data.tasks.opt_saturn', correct: false },
                  { id: 'opt-jupiter', textKey: 'data.tasks.opt_jupiter', correct: true },
                ],
              }`,
    `{ id: 'space-pl-2-t2', type: 'input', questionKey: 'data.tasks.space_q_largest_planet', difficulty: 3, answer: 'Юпитер' }`,
  ],
  [
    `{
      id: 'mc5l3-t4',
      type: 'multiple_choice',
      questionKey: 'data.tasks.mc5l3_q_which_bigger_1_or_4',
      difficulty: 2,
      options: [
        { id: 'a', textKey: 'data.tasks.opt_one', correct: false },
        { id: 'b', textKey: 'data.tasks.opt_four', correct: true },
        { id: 'c', textKey: 'data.tasks.mc5l3_opt_numbers_same', correct: false },
      ],
    }`,
    `{ id: 'mc5l3-t4', type: 'input', questionKey: 'data.tasks.mc5l3_q_which_bigger_1_or_4', difficulty: 2, answer: '4' }`,
  ],
];

let n = 0;
for (const [a, b] of reps) {
  // normalize CRLF in file vs LF in patterns
  const aCr = a.replace(/\n/g, '\r\n');
  if (s.includes(a)) {
    s = s.replace(a, b);
    n++;
    console.log('OK LF', b.match(/id: '([^']+)'/)[1]);
  } else if (s.includes(aCr)) {
    s = s.replace(aCr, b);
    n++;
    console.log('OK CRLF', b.match(/id: '([^']+)'/)[1]);
  } else {
    console.log('MISS', b.match(/id: '([^']+)'/)[1]);
  }
}
fs.writeFileSync(wp, s);
console.log('worlds done', n);

// g1worldRewrittenTasks — convert last non-ABA MC in each array (semi-compact)
const g1p = path.join(root, 'src/data/g1worldRewrittenTasks.ts');
let g1 = fs.readFileSync(g1p, 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
function t(key) {
  const parts = key.replace(/^data\./, '').split('.');
  let cur = ru.data;
  for (const p of parts) cur = cur?.[p];
  return typeof cur === 'string' ? cur : '';
}
function answerFromText(txt) {
  if (!txt) return 'ok';
  const s0 = txt.trim();
  if (/^-?\d+$/.test(s0)) return s0;
  if (/^[A-Za-zА-Яа-яЁё]$/.test(s0)) return s0.toUpperCase();
  const clean = s0.replace(/[«»"]/g, '').replace(/\s+/g, ' ').trim();
  if (clean.split(' ').length <= 4 && clean.length <= 40) return clean;
  const num = clean.match(/\b(\d+)\b/);
  if (num) return num[1];
  return clean.split(' ')[0] || 'ok';
}

const g1nl = g1.includes('\r\n') ? '\r\n' : '\n';
let g1n = 0;
g1 = g1.replace(
  /export const (G1W_[A-Z0-9_]+): LessonTask\[] = \[([\s\S]*?)\];/g,
  (full, name, body) => {
    if (/type:\s*'input'/.test(body)) return full;
    // Find last non-ABA task: line with type multiple_choice + following options block until ],
    const taskRe =
      /(\n\s*\{ id: '([^']+)', type: 'multiple_choice', (?:audience: 'special_aba', )?questionKey: '([^']+)', difficulty: (\d+), options: \[[\s\S]*?\n\s*\] \},)/g;
    let m;
    let last = null;
    while ((m = taskRe.exec(body))) {
      if (/audience: 'special_aba'/.test(m[1])) continue;
      const cM = m[1].match(/textKey: '([^']+)', correct: true/);
      if (!cM) continue;
      last = { full: m[1], id: m[2], q: m[3], d: m[4], ans: answerFromText(t(cM[1])), index: m.index };
    }
    if (!last) {
      console.log('g1 miss', name);
      return full;
    }
    const repl = `${g1nl}  { id: '${last.id}', type: 'input', questionKey: '${last.q}', difficulty: ${last.d}, answer: ${JSON.stringify(last.ans)} },`;
    const newBody = body.slice(0, last.index) + repl + body.slice(last.index + last.full.length);
    g1n++;
    console.log('g1 OK', name, last.id, '→', last.ans);
    return `export const ${name}: LessonTask[] = [${newBody}];`;
  },
);
fs.writeFileSync(g1p, g1);
console.log('g1 done', g1n);
