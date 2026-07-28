/**
 * Wave 1 content fixes (A–D as approved).
 * Does NOT patch audit scores — reaudit comes after.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const worldsPath = path.join(root, 'src/data/worlds.ts');
const rw56Path = path.join(root, 'src/data/rw56LessonTasks.ts');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales', name), 'utf8'));
}
function save(name, doc) {
  fs.writeFileSync(path.join(root, 'src/i18n/locales', name), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}

function replaceOnce(src, oldStr, newStr, label) {
  if (!src.includes(oldStr)) {
    console.error('MISSING', label);
    process.exitCode = 1;
    return src;
  }
  const n = src.split(oldStr).length - 1;
  if (n !== 1) {
    console.error('COUNT', label, n);
    process.exitCode = 1;
    return src;
  }
  console.log('OK', label);
  return src.replace(oldStr, newStr);
}

let worlds = fs.readFileSync(worldsPath, 'utf8');

/* ========== A: restore 7 inputs ========== */

worlds = replaceOnce(
  worlds,
  `{ id: 'g2rspl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_which_is_noun', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kniga', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_sidit', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_krasivyi', correct: false }] },`,
  `{ id: 'g2rspl1t4', type: 'input', questionKey: 'data.tasks.g2r_which_is_noun', difficulty: 2, answer: "Книга" },`,
  'A g2r-sp-l1 t4→input',
);

worlds = replaceOnce(
  worlds,
  `{ id: 'g2sbdyl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_sport_good', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_sport_good_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_sport_good_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_sport_good_c', correct: false }] },`,
  `{ id: 'g2sbdyl3t4', type: 'input', questionKey: 'data.tasks.g2s_sport_good', difficulty: 1, answer: "мышцы" },`,
  'A g2s-bdy-l3 t4→input',
);

worlds = replaceOnce(
  worlds,
  `{ id: 'g3wecol1t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_ecol1_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_ecol1_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_ecol1_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_ecol1_q4_c', correct: false }] },`,
  `{ id: 'g3wecol1t4', type: 'input', questionKey: 'data.tasks.g3w_ecol1_q4', difficulty: 2, answer: "Аквариум с рыбками" },`,
  'A g3w-eco-l1 t4→input',
);

worlds = replaceOnce(
  worlds,
  `{ id: 'g1enuml2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_vosem_en', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_vosem_opt_7', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_vosem_opt_8', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_vosem_opt_9', correct: false }] },`,
  `{ id: 'g1enuml2t4', type: 'input', questionKey: 'data.tasks.g1e_vosem_en', difficulty: 2, answer: "eight" },`,
  'A g1e-num-l2 t4→input',
);

worlds = replaceOnce(
  worlds,
  `{ id: 'g2sanil3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_anil3_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },`,
  `{ id: 'g2sanil3t4', type: 'input', questionKey: 'data.tasks.g2s_anil3_q4', difficulty: 1, answer: "жабрами" },`,
  'A g2s-ani-l3 t4→input',
);

worlds = replaceOnce(
  worlds,
  `{ id: 'g2ephrl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phr3_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_phr3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_phr3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_phr3_q4_c', correct: false }] },`,
  `{ id: 'g2ephrl3t4', type: 'input', questionKey: 'data.tasks.g2e_phr3_q4', difficulty: 2, answer: "Нет, тебе нельзя есть мой бутерброд" },`,
  'A g2e-phr-l3 t4→input',
);

worlds = replaceOnce(
  worlds,
  `{ id: 'g4m-cm-l2-t4', type: 'multiple_choice', questionKey: 'data.tasks.g4m_cm2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4m_cm2_q4_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4m_cm2_q4_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4m_cm2_q4_c', correct: false }] },`,
  `{ id: 'g4m-cm-l2-t4', type: 'input', questionKey: 'data.tasks.g4m_cm2_q4', difficulty: 1, answer: "<" },`,
  'A g4m-cm-l2 t4→input',
);

/* ========== B: hijack — new dedicated keys in worlds ========== */

worlds = replaceOnce(
  worlds,
  `{ id: 'g3etobel3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_we_blank_ready', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: true }] },
            { id: 'g3etobel3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_they_blank_students', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_q_am_they', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_q_is_they', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_q_are_they', correct: true }] },
            { id: 'g3etobel3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_are_they_question', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_are_they', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_is_they', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_am_they', correct: false }] },
            { id: 'g3etobel3t4', type: 'input', questionKey: 'data.tasks.g3e_are_we_question', difficulty: 2, answer: "Are they home?" },`,
  `{ id: 'g3etobel3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tobel3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: true }] },
            { id: 'g3etobel3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tobel3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_q_am_they', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_opt_q_is_they', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_q_are_they', correct: true }] },
            { id: 'g3etobel3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_tobel3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_tobel3_opt_is_she', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_tobel3_opt_are_she', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_tobel3_opt_am_she', correct: false }] },
            { id: 'g3etobel3t4', type: 'input', questionKey: 'data.tasks.g3e_tobel3_q4', difficulty: 2, answer: "Are they home?" },`,
  'B g3e-tobe-l3 keys',
);

worlds = replaceOnce(
  worlds,
  `{ id: 'g3wnatl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_protect_nature_how', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_recycle', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_burn_trash', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_cut_trees', correct: false }] },
            { id: 'g3wnatl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_natl3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_natl3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_natl3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_natl3_q2_c', correct: false }] },
            { id: 'g3wnatl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_red_book_is', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_endangered', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_extinct', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_recipe_book', correct: false }] },
            { id: 'g3wnatl3t4', type: 'input', questionKey: 'data.tasks.g3w_natl3_q4', difficulty: 1, answer: "Выброс мусора в лесу" },`,
  `{ id: 'g3wnatl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_natl3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_natl3_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_natl3_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_natl3_q1_c', correct: false }] },
            { id: 'g3wnatl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_natl3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_natl3_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_natl3_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_natl3_q2_c', correct: false }] },
            { id: 'g3wnatl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_natl3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_natl3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_natl3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_natl3_q3_c', correct: false }] },
            { id: 'g3wnatl3t4', type: 'input', questionKey: 'data.tasks.g3w_natl3_q4', difficulty: 1, answer: "Выброс мусора в лесу" },`,
  'B g3w-nat-l3 keys',
);

worlds = replaceOnce(
  worlds,
  `{ id: 'g3radjl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_size_adj_examples', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_adjl2_q2_c', correct: false }] },
            { id: 'g3radjl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adjl2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_adjl2_q3_c', correct: false }] },
            { id: 'g3radjl2t4', type: 'input', questionKey: 'data.tasks.g3r_adj_for_fem', difficulty: 2, answer: "Медленнее" },`,
  `{ id: 'g3radjl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adjl2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_adjl2_q2_c', correct: false }] },
            { id: 'g3radjl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adjl2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_adjl2_q3_c', correct: false }] },
            { id: 'g3radjl2t4', type: 'input', questionKey: 'data.tasks.g3r_adjl2_q4', difficulty: 2, answer: "Медленнее" },`,
  'B g3r-adj-l2 keys',
);

/* ========== C + D worlds ========== */

// g2m-100-l2: options → 37/42/29
worlds = replaceOnce(
  worlds,
  `{ id: 'g2m100l2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2m_biggest_37_42_29', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2m_100l2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2m_100l2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_100l2_q2_c', correct: false }] },`,
  `{ id: 'g2m100l2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2m_biggest_37_42_29', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_37', correct: false }, { id: 'b', textKey: 'data.tasks.opt_42', correct: true }, { id: 'c', textKey: 'data.tasks.opt_29', correct: false }] },`,
  'C g2m-100-l2 t2 options',
);

// g2r-sh-l1: НОС → 2 consonants
worlds = replaceOnce(
  worlds,
  `{ id: 'g2rshl1t4', type: 'input', questionKey: 'data.tasks.g2r_hard_consonants_count', difficulty: 2, answer: "3" },`,
  `{ id: 'g2rshl1t4', type: 'input', questionKey: 'data.tasks.g2r_hard_consonants_count', difficulty: 2, answer: "2" },`,
  'C g2r-sh-l1 answer 2',
);

// g2s-plt-l1: routine_chain sleep images → fill_blank growth order
worlds = replaceOnce(
  worlds,
  `{ id: 'g2spltl1t3', type: 'routine_chain', questionKey: 'data.tasks.g2s_pltl1_rc_q', difficulty: 2, steps: [{ id: 'rc1', labelKey: 'data.tasks.g2s_pltl1_rc_seed', imageKey: 'aba_routine_sleep_pajamas', order: 1 }, { id: 'rc2', labelKey: 'data.tasks.g2s_pltl1_rc_sprout', imageKey: 'aba_routine_sleep_teeth', order: 2 }, { id: 'rc3', labelKey: 'data.tasks.g2s_pltl1_rc_plant', imageKey: 'aba_routine_sleep_read', order: 3 }, { id: 'rc4', labelKey: 'data.tasks.g2s_pltl1_rc_flower', imageKey: 'aba_routine_sleep_sleep', order: 4 }] },`,
  `{ id: 'g2spltl1t3', type: 'fill_blank', questionKey: 'data.tasks.g2s_pltl1_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g2s_pltl1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g2s_pltl1_fb_a', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g2s_pltl1_fb_b', correct: true }, { id: 'fb-c', textKey: 'data.tasks.g2s_pltl1_fb_c', correct: false }] },`,
  'C g2s-plt-l1 fill_blank',
);

// g2r-sp-l2 t2: locale Q fix only (structure already yes/no)

// g3e-tobe-l1 t4: affirmative practice, not negation
worlds = replaceOnce(
  worlds,
  `{ id: 'g3etobel1t4', type: 'input', questionKey: 'data.tasks.g3e_am_negative', difficulty: 2, answer: "I am not" },`,
  `{ id: 'g3etobel1t4', type: 'input', questionKey: 'data.tasks.g3e_tobel1_q4', difficulty: 2, answer: "I am happy" },`,
  'C g3e-tobe-l1 t4',
);

// g2s-bdy-l2 t2: remove heart-option duplicate distractor
worlds = replaceOnce(
  worlds,
  `{ id: 'g2sbdyl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_lungs_do', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_pumps_blood', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_opt_breathe_f', correct: true }, { id: 'c', textKey: 'data.tasks.g2s_opt_digest_f', correct: false }] },`,
  `{ id: 'g2sbdyl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_lungs_do', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_see_f', correct: false }, { id: 'b', textKey: 'data.tasks.g2s_opt_breathe_f', correct: true }, { id: 'c', textKey: 'data.tasks.g2s_opt_digest_f', correct: false }] },`,
  'D g2s-bdy-l2 t2',
);

// g2r-sent-l1 t1: subject word options
worlds = replaceOnce(
  worlds,
  `{ id: 'g2rsentl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_statement_type', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kto_chto', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_chto_delaet', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_kakoy', correct: false }] },`,
  `{ id: 'g2rsentl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_statement_type', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_sentl1_t1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_sentl1_t1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_sentl1_t1_c', correct: false }] },`,
  'D g2r-sent-l1 t1',
);

fs.writeFileSync(worldsPath, worlds, 'utf8');
console.log('worlds.ts written');

// g1w-bdy-l3 ABA: locale Q fix only (options already green/red)

/* ========== locales ========== */
const ru = load('ru.json');
const en = load('en.json');
const ky = load('ky.json');

function setTask(key, vals) {
  if (vals.ru != null) ru.data.tasks[key] = vals.ru;
  if (vals.en != null) en.data.tasks[key] = vals.en;
  if (vals.ky != null) ky.data.tasks[key] = vals.ky;
}
function setDialog(key, vals) {
  if (vals.ru != null) ru.data.dialog[key] = vals.ru;
  if (vals.en != null) en.data.dialog[key] = vals.en;
  if (vals.ky != null) ky.data.dialog[key] = vals.ky;
}

// Ensure number options exist
setTask('opt_37', { ru: '37', en: '37', ky: '37' });
setTask('opt_42', { ru: '42', en: '42', ky: '42' });
setTask('opt_29', { ru: '29', en: '29', ky: '29' });

// A texts
setTask('g2r_which_is_noun', {
  ru: 'Напиши существительное из списка: Книга / Сидит / Красивый',
  en: 'Write the noun from the list: Book / Sits / Beautiful',
  ky: 'Тизменин ичинен зат атоочту жаз: Книга / Сидит / Красивый',
});
setTask('g2s_sport_good', {
  ru: 'Арчи не хочет делать зарядку. Зачем нужны зарядка и спорт? Напиши одно слово (например: мышцы).',
  en: 'Archie does not want to exercise. Why do we need exercise and sport? Write one word (e.g. muscles).',
  ky: 'Арчи зарядка жасоону каалабайт. Зарядка жана спорт эмнеге керек? Бир сөз жаз (мис.: мышцы).',
});
setTask('g3w_ecol1_q4', {
  ru: 'Что из перечисленного — экосистема? Библиотека, аквариум с рыбками, завод. Напиши ответ.',
  en: 'Which of these is an ecosystem? A library, a fish aquarium, a factory. Write the answer.',
  ky: 'Төмөнкүлөрдүн кайсынысы экосистема? Китепкана, балыктуу аквариум, завод. Жоопту жаз.',
});
setTask('g1e_vosem_en', {
  ru: 'Как по-английски написать число 8? (словом)',
  en: 'How do you write the number 8 in English? (as a word)',
  ky: '8 санын англисче кандай жазабыз? (сөз менен)',
});
setTask('g2s_anil3_q4', {
  ru: 'Чем дышит рыба? (напиши одним словом)',
  en: 'What does a fish breathe with? (one word)',
  ky: 'Балык эмне менен дем алат? (бир сөз)',
});
setTask('g2e_phr3_q4', {
  ru: 'Переведи на русский: «No, you can’t eat my sandwich!»',
  en: 'What does this mean in Russian: “No, you can’t eat my sandwich!”',
  ky: 'Орусчага котор: «No, you can’t eat my sandwich!»',
});
setTask('g4m_cm2_q4', {
  ru: 'Digit даёт Тали задачку: 4 135 × 7 ○ 29 000. Какой знак поставить? Напиши < или = или >',
  en: 'Digit asks Tali: 4,135 × 7 ○ 29,000. Which sign? Write < or = or >',
  ky: 'Digit Талиге: 4 135 × 7 ○ 29 000. Кайсы белги? < же = же > жаз',
});

// B g3e-tobe-l3
setTask('g3e_tobel3_q1', {
  ru: '«We are ready» → вопрос: «___ we ready?» Какой глагол в начале?',
  en: '“We are ready” → question: “___ we ready?” Which verb goes first?',
  ky: '«We are ready» → суроо: «___ we ready?» Башына кайсы глагол?',
});
setTask('g3e_tobel3_q2', {
  ru: '«They are students.» → правильный вопрос:',
  en: '“They are students.” → the correct question is:',
  ky: '«They are students.» → туура суроо:',
});
setTask('g3e_tobel3_q3', {
  ru: 'Правильный вопрос к ответу «Yes, she is»:',
  en: 'The correct question for the answer “Yes, she is”:',
  ky: '«Yes, she is» жообуна туура суроо:',
});
setTask('g3e_tobel3_q4', {
  ru: '«Они дома?» по-английски (полный вопрос):',
  en: 'How do you ask “Are they home?” in English (full question):',
  ky: '«Алар үйдөбү?» англисче (толук суроо):',
});
setTask('g3e_tobel3_opt_is_she', { ru: 'Is she tired?', en: 'Is she tired?', ky: 'Is she tired?' });
setTask('g3e_tobel3_opt_are_she', { ru: 'Are she tired?', en: 'Are she tired?', ky: 'Are she tired?' });
setTask('g3e_tobel3_opt_am_she', { ru: 'Am she tired?', en: 'Am she tired?', ky: 'Am she tired?' });

// B g3w-nat-l3 — sync all locales to RU meaning
setTask('g3w_natl3_q1', {
  ru: 'Зачем создали Красную книгу?',
  en: 'Why was the Red Book created?',
  ky: 'Кызыл китеп эмне үчүн түзүлгөн?',
});
setTask('g3w_natl3_q1_a', {
  ru: 'Чтобы защитить редких животных и растения',
  en: 'To protect rare animals and plants',
  ky: 'Сейрек жаныбарларды жана өсүмдүктөрдү коргоо үчүн',
});
setTask('g3w_natl3_q1_b', {
  ru: 'Чтобы красиво выглядеть в библиотеке',
  en: 'To look nice in a library',
  ky: 'Китепканада кооз көрүнүү үчүн',
});
setTask('g3w_natl3_q1_c', {
  ru: 'Чтобы записывать погоду',
  en: 'To record the weather',
  ky: 'Аба ырайын жазып туруу үчүн',
});
setTask('g3w_natl3_q3', {
  ru: 'Деревья в городе дают:',
  en: 'Trees in the city give us:',
  ky: 'Шаардагы дарактар берет:',
});
setTask('g3w_natl3_q3_a', {
  ru: 'Кислород, тень и очищают воздух',
  en: 'Oxygen, shade, and cleaner air',
  ky: 'Кычкылтек, көлөкө жана таза аба',
});
setTask('g3w_natl3_q3_b', {
  ru: 'Только красоту',
  en: 'Only beauty',
  ky: 'Жалгыз сулуулукту',
});
setTask('g3w_natl3_q3_c', {
  ru: 'Только проблемы',
  en: 'Only problems',
  ky: 'Жалгыз көйгөйлөрдү',
});
// Keep q2/q4 RU; sync EN/KY from existing RU if needed
setTask('g3w_natl3_q2', {
  ru: ru.data.tasks.g3w_natl3_q2,
  en: 'In a nature reserve you must not hunt or cut trees. Why do we need reserves?',
  ky: 'Заповедникте аңчылык кылууга жана дарактарды кыюуга болбойт. Заповедниктер эмнеге керек?',
});
setTask('g3w_natl3_q4', {
  ru: ru.data.tasks.g3w_natl3_q4,
  en: 'Which action does NOT help protect nature?',
  ky: 'Кайсы аракет жаратылышты коргоого ЖАРДАМ БЕРБЕЙТ?',
});

// B g3r-adj-l2
setTask('g3r_adjl2_q2', {
  ru: 'Как образуется сравнительная степень от БЫСТРЫЙ?',
  en: 'How do you form the comparative of БЫСТРЫЙ (fast)?',
  ky: 'БЫСТРЫЙ сөзүнөн салыштырма даража кантип жасалат?',
});
setTask('g3r_adjl2_q4', {
  ru: 'Черепаха медленная. Улитка ___ черепахи. Напиши сравнительную степень.',
  en: 'The turtle is slow. The snail is ___ than the turtle. Write the comparative.',
  ky: 'Ташбака жай. Үлүлдүк ташбакадан ___. Салыштырма даражаны жаз.',
});

// C other texts
setTask('g2r_hard_consonants_count', {
  ru: 'В слове НОС две согласные. Тали говорит: «Обе твёрдые!» Сколько твёрдых согласных в слове НОС?',
  en: 'The word НОС has two consonants. Tali says: “Both are hard!” How many hard consonants are in НОС?',
  ky: 'НОС сөзүндө эки үнсүз бар. Тали: «Экөө тең катуу!» дейт. НОС сөзүндө канча катуу үнсүз бар?',
});
setTask('g2s_pltl1_fb_sent', {
  ru: 'Порядок роста растения: семя → ___ → растение → цветок',
  en: 'Plant growth order: seed → ___ → plant → flower',
  ky: 'Өсүмдүктүн өсүү тартиби: урук → ___ → өсүмдүк → гүл',
});
setTask('g2s_pltl1_fb_a', { ru: 'камень', en: 'stone', ky: 'таш' });
setTask('g2s_pltl1_fb_b', { ru: 'росток', en: 'sprout', ky: 'өркүн' });
setTask('g2s_pltl1_fb_c', { ru: 'книга', en: 'book', ky: 'китеп' });

setTask('g2r_idet_verb', {
  ru: 'Тали говорит: «ИДЁТ — это глагол!» Он прав?',
  en: 'Tali says: “ИДЁТ is a verb!” Is he right?',
  ky: 'Тали: «ИДЁТ — бул глагол!» дейт. Ал туурабы?',
});

setTask('g3e_tobel1_q4', {
  ru: 'Напиши по-английски: «Я счастлив» (I ___ happy — полная фраза)',
  en: 'Write in English: “I am happy” (full phrase)',
  ky: 'Англисче жаз: «Мен бактылуумун» (I am happy — толук фраза)',
});

setTask('g2s_opt_see_f', {
  ru: 'Для зрения',
  en: 'For seeing',
  ky: 'Көрүү үчүн',
});

setTask('g1w_bdyl3_a1', {
  ru: 'Какой свет светофора — можно идти?',
  en: 'Which traffic light colour means you may go?',
  ky: 'Светофордун кайсы жарыгында өтсө болот?',
});

setTask('g1r_vowl3_q3', {
  ru: 'Чем отличаются ДЕНЬ и ДЕН? (с мягким знаком и без)',
  en: 'How are ДЕНЬ and ДЕН different? (with and without the soft sign)',
  ky: 'ДЕНЬ менен ДЕН эмне менен айырмаланат? (жумшак белги менен жана ансыз)',
});
setTask('g1r_vowl3_q3_a', {
  ru: 'Ничем — это одно и то же',
  en: 'Nothing — they are the same',
  ky: 'Эч нерсе — экөө бирдей',
});
setTask('g1r_vowl3_q3_b', {
  ru: 'Ь меняет произношение — это разные слова',
  en: 'Ь changes the sound — they are different words',
  ky: 'Ь айтылышты өзгөртөт — бул башка сөздөр',
});
setTask('g1r_vowl3_q4', {
  ru: 'В слове МЯЧ есть мягкий знак?',
  en: 'Does the word МЯЧ have a soft sign?',
  ky: 'МЯЧ сөзүндө жумшак белги барбы?',
});
setTask('g1r_vowl3_q4_a', { ru: 'Да', en: 'Yes', ky: 'Ооба' });
setTask('g1r_vowl3_q4_b', { ru: 'Нет', en: 'No', ky: 'Жок' });
setTask('g1r_vowl3_q4_c', { ru: 'Только в конце', en: 'Only at the end', ky: 'Жалгыз аягында' });

// Fix g1r vow l3 task4 options in bank if needed - check bridged tasks
setTask('g2r_sentl1_t1_a', { ru: 'Кот', en: 'Cat (Кот)', ky: 'Кот' });
setTask('g2r_sentl1_t1_b', { ru: 'Бежит', en: 'Runs (Бежит)', ky: 'Бежит' });
setTask('g2r_sentl1_t1_c', { ru: 'Быстро', en: 'Quickly (Быстро)', ky: 'Быстро' });
setTask('g2r_statement_type', {
  ru: 'Тали написал «Бежит». Не хватает подлежащего. Какое слово подойдёт?',
  en: 'Tali wrote “Бежит”. A subject is missing. Which word fits?',
  ky: 'Тали «Бежит» деп жазды. Ээ жетишпейт. Кайсы сөз ылайык?',
});

// forest-syl-l2: fix t2 to S-syllables
setTask('nrw_fsyll2_t2_q', {
  ru: 'Тали хлопает: СА-СА. Сколько хлопков?',
  en: 'Tali claps: СА-СА. How many claps?',
  ky: 'Тали чапат: СА-СА. Канча чапкыч?',
});
setDialog('forest_syll2_0', {
  ru: 'Ёжик показывает Тали слоги на С: СА, СО, СУ. Повтори за ним!',
  en: 'The hedgehog shows Tali syllables with S: СА, СО, СУ. Repeat after him!',
  ky: 'Кирпи Талиге С менен муундарды көрсөтөт: СА, СО, СУ. Кайтала!',
});
setDialog('forest_syll2_1', {
  ru: 'СА — как в САНИ, СО — как в СОВА, СУ — как в СУМКА. Учимся слышать С!',
  en: 'СА — as in САНИ, СО — as in СОВА, СУ — as in СУМКА. We learn to hear S!',
  ky: 'СА — САНИ сыяктуу, СО — СОВА сыяктуу, СУ — СУМКА сыяктуу. С үнүн угабыз!',
});
function setIntro(key, vals) {
  if (vals.ru != null) ru.data.intro[key] = vals.ru;
  if (vals.en != null) en.data.intro[key] = vals.en;
  if (vals.ky != null) ky.data.intro[key] = vals.ky;
}
setIntro('forest_syll2_1_b', {
  ru: 'Прохлопай СОВА: СО-ВА — два хлопка! СА-СА — тоже два хлопка!',
  en: 'Clap СОВА: СО-ВА — two claps! СА-СА — also two claps!',
  ky: 'СОВАны чап: СО-ВА — эки чапкыч! СА-СА — да эки чапкыч!',
});

// island-anim-l1: keep cat/dog focus
setTask('nrw_ianiml1_t2_q', {
  ru: 'A dog says WOOF. A cat says MEOW. Does a cat say WOOF?',
  en: 'A dog says WOOF. A cat says MEOW. Does a cat say WOOF?',
  ky: 'Dog WOOF дейт. Cat MEOW дейт. Cat WOOF дейби?',
});
setTask('nrw_ianiml1_t2_a', { ru: 'No', en: 'No', ky: 'No' });
setTask('nrw_ianiml1_t2_b', { ru: 'Yes!', en: 'Yes!', ky: 'Yes!' });
// Need correct flag: No is correct - check worlds bank options order
setTask('nrw_ianiml1_t4_q', {
  ru: 'Тали собирает домашних животных: cat и dog. Кто лишний?',
  en: 'Tali collects pets: cat and dog. Who does not belong?',
  ky: 'Тали үй жаныбарларын чогултат: cat жана dog. Ким лишний?',
});
setTask('nrw_ianiml1_t4_a', { ru: 'Wolf 🐺', en: 'Wolf 🐺', ky: 'Wolf 🐺' });
setTask('nrw_ianiml1_t4_b', { ru: 'Cat 🐱', en: 'Cat 🐱', ky: 'Cat 🐱' });
setTask('nrw_ianiml1_t4_c', { ru: 'Dog 🐶', en: 'Dog 🐶', ky: 'Dog 🐶' });

save('ru.json', ru);
save('en.json', en);
save('ky.json', ky);
console.log('locales written');

/* Fix island-anim-l1 t4: Wolf is the odd one out (correct) */
let rw = fs.readFileSync(rw56Path, 'utf8');
const oldT4 =
  `"id": "ianiml1-t4",
    "type": "multiple_choice",
    "questionKey": "data.tasks.nrw_ianiml1_t4_q",
    "difficulty": 2,
    "options": [
      {
        "id": "a",
        "textKey": "data.tasks.nrw_ianiml1_t4_a",
        "correct": false
      },
      {
        "id": "b",
        "textKey": "data.tasks.nrw_ianiml1_t4_b",
        "correct": true
      },
      {
        "id": "c",
        "textKey": "data.tasks.nrw_ianiml1_t4_c",
        "correct": false
      }
    ]`;
const newT4 =
  `"id": "ianiml1-t4",
    "type": "multiple_choice",
    "questionKey": "data.tasks.nrw_ianiml1_t4_q",
    "difficulty": 2,
    "options": [
      {
        "id": "a",
        "textKey": "data.tasks.nrw_ianiml1_t4_a",
        "correct": true
      },
      {
        "id": "b",
        "textKey": "data.tasks.nrw_ianiml1_t4_b",
        "correct": false
      },
      {
        "id": "c",
        "textKey": "data.tasks.nrw_ianiml1_t4_c",
        "correct": false
      }
    ]`;
if (!rw.includes(oldT4)) {
  console.error('MISSING island-anim-l1 t4 block');
  process.exitCode = 1;
} else {
  rw = rw.replace(oldT4, newT4);
  fs.writeFileSync(rw56Path, rw, 'utf8');
  console.log('OK island-anim-l1 t4 wolf correct');
}

console.log('wave1 apply done');
