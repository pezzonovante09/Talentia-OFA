/**
 * Fix 4 lessons rejected by Phase 3–4 coherence re-audit.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const wp = path.join(root, 'src/data/worlds.ts');
let worlds = fs.readFileSync(wp, 'utf8');

function setLocale(file, patches) {
  const p = path.join(root, 'src/i18n/locales', file);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [k, v] of Object.entries(patches)) {
    const parts = k.split('.');
    let cur = j;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = v;
  }
  fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`);
}

// --- g3e-tobe-l2: negation practice ---
const tobeOld = `            { id: 'g3etobel2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_he_blank_tall', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: false }] },
            { id: 'g3etobel2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_she_blank_kind', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: false }] },
            { id: 'g3etobel2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_it_blank_big', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: false }] },
            { id: 'g3etobel2t4', type: 'input', questionKey: 'data.tasks.g3e_is_question_tag', difficulty: 2, answer: "He is not late" },`;

const tobeNew = `            { id: 'g3etobel2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tobel2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_tobel2_opt_is_not', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_tobel2_opt_not_is', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_tobel2_opt_am_not', correct: false }] },
            { id: 'g3etobel2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tobel2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_tobel2_opt_isnt', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_tobel2_opt_arent', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_tobel2_opt_amnt', correct: false }] },
            { id: 'g3etobel2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tobel2_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g3etobel2t4', type: 'input', questionKey: 'data.tasks.g3e_tobel2_q4', difficulty: 2, answer: "He is not late" },`;

if (!worlds.includes(tobeOld.replace(/\n/g, '\r\n')) && !worlds.includes(tobeOld)) {
  console.log('MISS g3e-tobe-l2 block');
} else {
  worlds = worlds.includes(tobeOld) ? worlds.replace(tobeOld, tobeNew) : worlds.replace(tobeOld.replace(/\n/g, '\r\n'), tobeNew);
  console.log('OK g3e-tobe-l2');
}

// --- g2r-sent-l3 t3: real word combinations ---
const sentOld = `{ id: 'g2rsentl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] }`;
// may have different question key - find via dump: g2r uses question about сочетание
const sentRe =
  /\{ id: 'g2rsentl3t3', type: 'multiple_choice', questionKey: '[^']+', difficulty: \d+, options: \[\{ id: 'a', textKey: 'data\.tasks\.opt_yes', correct: true \}, \{ id: 'b', textKey: 'data\.tasks\.opt_no', correct: false \}\] \}/;
const sentNew =
  `{ id: 'g2rsentl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_sentl3_opt_red_ball', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_sentl3_opt_red_ball_bad', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_sentl3_opt_boy_go_bad', correct: false }] }`;
if (sentRe.test(worlds)) {
  worlds = worlds.replace(sentRe, sentNew);
  console.log('OK g2r-sent-l3 t3');
} else {
  console.log('MISS g2r-sent-l3 t3');
}

// --- g2s-bdy-l1 t3: correct = Нет ---
const bdyOld =
  `{ id: 'g2sbdyl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_bdyl1_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] }`;
const bdyRe =
  /\{ id: 'g2sbdyl1t3', type: 'multiple_choice', questionKey: '[^']+', difficulty: \d+, options: \[\{ id: 'a', textKey: 'data\.tasks\.opt_yes', correct: true \}, \{ id: 'b', textKey: 'data\.tasks\.opt_no', correct: false \}\] \}/;
const bdyNew =
  `{ id: 'g2sbdyl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_bdyl1_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] }`;
if (bdyRe.test(worlds)) {
  worlds = worlds.replace(bdyRe, bdyNew);
  console.log('OK g2s-bdy-l1 t3');
} else if (worlds.includes(bdyOld)) {
  worlds = worlds.replace(bdyOld, bdyNew);
  console.log('OK g2s-bdy-l1 t3 (exact)');
} else {
  console.log('MISS g2s-bdy-l1 t3');
}

// --- g4e-past-l2 t3: went not gone ---
const pastOld =
  `{ id: 'g4e-past-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4e_past2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_past2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_past2_q3_c', correct: true }] }`;
const pastRe =
  /\{ id: 'g4e-past-l2-t3', type: 'multiple_choice', questionKey: '[^']+', difficulty: \d+, options: \[\{ id: 'a', textKey: 'data\.tasks\.g4e_past2_q3_a', correct: false \}, \{ id: 'b', textKey: 'data\.tasks\.g4e_past2_q3_b', correct: false \}, \{ id: 'c', textKey: 'data\.tasks\.g4e_past2_q3_c', correct: true \}\] \}/;
const pastNew =
  `{ id: 'g4e-past-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4e_past2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4e_past2_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_past2_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_past2_q3_c', correct: false }] }`;
if (pastRe.test(worlds)) {
  worlds = worlds.replace(pastRe, pastNew);
  console.log('OK g4e-past-l2 t3');
} else if (worlds.includes(pastOld)) {
  worlds = worlds.replace(pastOld, pastNew);
  console.log('OK g4e-past-l2 t3 (exact)');
} else {
  console.log('MISS g4e-past-l2 t3');
}

fs.writeFileSync(wp, worlds);

const ruPatches = {
  'data.tasks.g3e_tobel2_q1': '«He ___ tall» — сделай отрицание (He is tall → …):',
  'data.tasks.g3e_tobel2_q2': 'Сокращение для «is not»:',
  'data.tasks.g3e_tobel2_q3': '«It isn\'t big» — это правильное отрицание?',
  'data.tasks.g3e_tobel2_q4': '«He is late» → отрицание (полностью):',
  'data.tasks.g3e_tobel2_opt_is_not': 'is not',
  'data.tasks.g3e_tobel2_opt_not_is': 'not is',
  'data.tasks.g3e_tobel2_opt_am_not': 'am not',
  'data.tasks.g3e_tobel2_opt_isnt': "isn't",
  'data.tasks.g3e_tobel2_opt_arent': "aren't",
  'data.tasks.g3e_tobel2_opt_amnt': "amn't",
  'data.tasks.g2r_sentl3_q3': 'Выбери правильное сочетание слов:',
  'data.tasks.g2r_sentl3_opt_red_ball': 'красный шар',
  'data.tasks.g2r_sentl3_opt_red_ball_bad': 'красная шар',
  'data.tasks.g2r_sentl3_opt_boy_go_bad': 'мальчик идут',
};

const enPatches = {
  'data.tasks.g3e_tobel2_q1': '"He ___ tall" — make it negative (He is tall → …):',
  'data.tasks.g3e_tobel2_q2': 'The short form of "is not":',
  'data.tasks.g3e_tobel2_q3': '"It isn\'t big" — is this a correct negative?',
  'data.tasks.g3e_tobel2_q4': '"He is late" → full negative form:',
  'data.tasks.g3e_tobel2_opt_is_not': 'is not',
  'data.tasks.g3e_tobel2_opt_not_is': 'not is',
  'data.tasks.g3e_tobel2_opt_am_not': 'am not',
  'data.tasks.g3e_tobel2_opt_isnt': "isn't",
  'data.tasks.g3e_tobel2_opt_arent': "aren't",
  'data.tasks.g3e_tobel2_opt_amnt': "amn't",
  'data.tasks.g2r_sentl3_q3': 'Choose the correct word combination:',
  'data.tasks.g2r_sentl3_opt_red_ball': 'красный шар',
  'data.tasks.g2r_sentl3_opt_red_ball_bad': 'красная шар',
  'data.tasks.g2r_sentl3_opt_boy_go_bad': 'мальчик идут',
};

const kyPatches = {
  'data.tasks.g3e_tobel2_q1': '«He ___ tall» — терс форманы жаса (He is tall → …):',
  'data.tasks.g3e_tobel2_q2': '«is not» үчүн кыска форма:',
  'data.tasks.g3e_tobel2_q3': '«It isn\'t big» — бул туура терс формабы?',
  'data.tasks.g3e_tobel2_q4': '«He is late» → толук терс форма:',
  'data.tasks.g3e_tobel2_opt_is_not': 'is not',
  'data.tasks.g3e_tobel2_opt_not_is': 'not is',
  'data.tasks.g3e_tobel2_opt_am_not': 'am not',
  'data.tasks.g3e_tobel2_opt_isnt': "isn't",
  'data.tasks.g3e_tobel2_opt_arent': "aren't",
  'data.tasks.g3e_tobel2_opt_amnt': "amn't",
  'data.tasks.g2r_sentl3_q3': 'Туура сөз айкашын танда:',
  'data.tasks.g2r_sentl3_opt_red_ball': 'красный шар',
  'data.tasks.g2r_sentl3_opt_red_ball_bad': 'красная шар',
  'data.tasks.g2r_sentl3_opt_boy_go_bad': 'мальчик идут',
};

setLocale('ru.json', ruPatches);
setLocale('en.json', enPatches);
setLocale('ky.json', kyPatches);
console.log('locales patched');
