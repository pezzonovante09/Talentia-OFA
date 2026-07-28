/**
 * Wave 3 content fixes (A–D approved). One pass for overlapping A/C/D lessons.
 * Does NOT patch audit scores — reaudit #7 comes after.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const worldsPath = path.join(root, 'src/data/worlds.ts');

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

const ru = load('ru.json');
const en = load('en.json');
const ky = load('ky.json');
const abaRu = load('abaTextOverrides.generated.json');
const abaEn = load('abaTextOverrides.en.generated.json');
const abaKy = load('abaTextOverrides.ky.generated.json');

let worlds = fs.readFileSync(worldsPath, 'utf8');

/* ========== worlds.ts structure (A + D) ========== */

// A: g2m-times-l3 — t1→3×7 (dialog), t2→3×4; D: t3→fill_blank
worlds = replaceOnce(
  worlds,
  `          tasks: [
            { id: 'g2mtimesl3t1', type: 'input', questionKey: 'data.tasks.g2m_3x4', difficulty: 1, answer: '12' },
            { id: 'g2mtimesl3t2', type: 'input', questionKey: 'data.tasks.g2m_3x7', difficulty: 1, answer: '21' },
            { id: 'g2mtimesl3t3', type: 'input', questionKey: 'data.tasks.g2m_3x9', difficulty: 2, answer: '27' },
            { id: 'g2mtimesl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2m_3x8_check', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2m_timesl3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2m_timesl3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_timesl3_q4_c', correct: false }] },
          ] },`,
  `          tasks: [
            { id: 'g2mtimesl3t1', type: 'input', questionKey: 'data.tasks.g2m_3x7', difficulty: 1, answer: '21' },
            { id: 'g2mtimesl3t2', type: 'input', questionKey: 'data.tasks.g2m_3x4', difficulty: 1, answer: '12' },
            { id: 'g2mtimesl3t3', type: 'fill_blank', questionKey: 'data.tasks.g2m_timesl3_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g2m_timesl3_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g2m_timesl3_fb_a', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g2m_timesl3_fb_b', correct: true }, { id: 'fb-c', textKey: 'data.tasks.g2m_timesl3_fb_c', correct: false }] },
            { id: 'g2mtimesl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2m_3x8_check', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2m_timesl3_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g2m_timesl3_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g2m_timesl3_q4_c', correct: false }] },
          ] },`,
  'A/D g2m-times-l3 t1↔3x7 + t3 fill_blank',
);

// A/D: g2r-sent-l2 — t3→fill_blank (keep ✓ obst); t4 stays input short answer
worlds = replaceOnce(
  worlds,
  `          tasks: [
            { id: 'g2rsentl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_opred', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_dopol', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_obst', correct: false }] },
            { id: 'g2rsentl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_opred', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_dopol', correct: true }, { id: 'c', textKey: 'data.tasks.g2r_opt_obst', correct: false }] },
            { id: 'g2rsentl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_opred', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_dopol', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_obst', correct: true }] },
            { id: 'g2rsentl2t4', type: 'input', questionKey: 'data.tasks.g2r_sentl2_q4', difficulty: 2, answer: "Обстоятельство" },
          ] },`,
  `          tasks: [
            { id: 'g2rsentl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_opred', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_dopol', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_obst', correct: false }] },
            { id: 'g2rsentl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_opred', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_dopol', correct: true }, { id: 'c', textKey: 'data.tasks.g2r_opt_obst', correct: false }] },
            { id: 'g2rsentl2t3', type: 'fill_blank', questionKey: 'data.tasks.g2r_sentl2_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g2r_sentl2_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g2r_opt_opred', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g2r_opt_dopol', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g2r_opt_obst', correct: true }] },
            { id: 'g2rsentl2t4', type: 'input', questionKey: 'data.tasks.g2r_sentl2_q4', difficulty: 2, answer: "Обстоятельство" },
          ] },`,
  'A/D g2r-sent-l2 t3 fill_blank',
);

// A/D: g2e-days-l3 — varied days/subjects; t3 fill_blank; t4 full phrase
worlds = replaceOnce(
  worlds,
  `          tasks: [
            { id: 'g2edaysl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_maths', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_music', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_art', correct: false }] },
            { id: 'g2edaysl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_day_monday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_day_sunday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_day_saturday', correct: false }] },
            { id: 'g2edaysl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_on', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_in', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_at', correct: false }] },
            { id: 'g2edaysl3t4', type: 'input', questionKey: 'data.tasks.g2e_days3_q4', difficulty: 2, answer: "Monday" },
          ] },`,
  `          tasks: [
            { id: 'g2edaysl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_maths', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_music', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_art', correct: false }] },
            { id: 'g2edaysl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_day_monday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_day_friday', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_day_sunday', correct: false }] },
            { id: 'g2edaysl3t3', type: 'fill_blank', questionKey: 'data.tasks.g2e_days3_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g2e_days3_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g2e_opt_on', correct: true }, { id: 'fb-b', textKey: 'data.tasks.g2e_opt_in', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g2e_opt_at', correct: false }] },
            { id: 'g2edaysl3t4', type: 'input', questionKey: 'data.tasks.g2e_days3_q4', difficulty: 2, answer: "On Friday we have art" },
          ] },`,
  'A/D g2e-days-l3 varied + fill_blank + full phrase',
);

// A: canyon-words-2 answer gender
worlds = replaceOnce(
  worlds,
  `{ id: 'canyon-w2-t2', type: 'input', questionKey: 'data.tasks.canyon_q_color_grass', difficulty: 2, answer: 'Зелёный' },`,
  `{ id: 'canyon-w2-t2', type: 'input', questionKey: 'data.tasks.canyon_q_color_grass', difficulty: 2, answer: 'Зелёная' },`,
  'A canyon-words-2 Зелёная',
);

// A/D: g4r-conj-l1 — restore t4 MC ✓b; D: t3→fill_blank
worlds = replaceOnce(
  worlds,
  `          { id: 'g4r-conj-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_conj_q1_c', correct: false }] },
          { id: 'g4r-conj-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_conj_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj_q2_c', correct: false }] },
          { id: 'g4r-conj-l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj_q3_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_conj_q3_c', correct: false }] },
          { id: 'g4r-conj-l1-t4', type: 'input', questionKey: 'data.tasks.g4r_conj_q4', difficulty: 1, answer: "Неверное" },
        ] },`,
  `          { id: 'g4r-conj-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_conj_q1_c', correct: false }] },
          { id: 'g4r-conj-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_conj_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_conj_q2_c', correct: false }] },
          { id: 'g4r-conj-l1-t3', type: 'fill_blank', questionKey: 'data.tasks.g4r_conj_l1_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g4r_conj_l1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g4r_conj_q3_a', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g4r_conj_q3_b', correct: true }, { id: 'fb-c', textKey: 'data.tasks.g4r_conj_q3_c', correct: false }] },
          { id: 'g4r-conj-l1-t4', type: 'multiple_choice', questionKey: 'data.tasks.g4r_conj_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_conj_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_conj_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_conj_q4_c', correct: false }] },
        ] },`,
  'A/D g4r-conj-l1 restore MC t4 + t3 fill_blank',
);

// A/D: g4r-cases-l1 — restore t4 MC ✓b; D: t3→fill_blank
worlds = replaceOnce(
  worlds,
  `          { id: 'g4r-cases-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_cases_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases_q1_c', correct: false }] },
          { id: 'g4r-cases-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_cases_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases_q2_c', correct: false }] },
          { id: 'g4r-cases-l1-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases_q3_c', correct: true }] },
          { id: 'g4r-cases-l1-t4', type: 'input', questionKey: 'data.tasks.g4r_cases_q4', difficulty: 1, answer: "Винительный" },
        ] },`,
  `          { id: 'g4r-cases-l1-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_cases_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases_q1_c', correct: false }] },
          { id: 'g4r-cases-l1-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_cases_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_cases_q2_c', correct: false }] },
          { id: 'g4r-cases-l1-t3', type: 'fill_blank', questionKey: 'data.tasks.g4r_cases_l1_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g4r_cases_l1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g4r_cases_q3_a', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g4r_cases_q3_b', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g4r_cases_q3_c', correct: true }] },
          { id: 'g4r-cases-l1-t4', type: 'multiple_choice', questionKey: 'data.tasks.g4r_cases_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_cases_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_cases_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4r_cases_q4_c', correct: false }] },
        ] },`,
  'A/D g4r-cases-l1 restore MC t4 + t3 fill_blank',
);

// C/D: g2s-plt-l2 — t3 fill_blank (keep ✓ yes)
worlds = replaceOnce(
  worlds,
  `            { id: 'g2spltl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_pltl2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_pltl2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_pltl2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_pltl2_q1_c', correct: false }] },
            { id: 'g2spltl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_photosyn_needs', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_sun_water_co2', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_only_water', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_only_sun', correct: false }] },
            { id: 'g2spltl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2s_plants_make_oxygen', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2spltl2t4', type: 'input', questionKey: 'data.tasks.g2s_seed_grows_into', difficulty: 2, answer: "В листьях" },
          ] },`,
  `            { id: 'g2spltl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2s_pltl2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_pltl2_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_pltl2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_pltl2_q1_c', correct: false }] },
            { id: 'g2spltl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2s_photosyn_needs', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_sun_water_co2', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_only_water', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_only_sun', correct: false }] },
            { id: 'g2spltl2t3', type: 'fill_blank', questionKey: 'data.tasks.g2s_pltl2_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g2s_pltl2_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'fb-b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2spltl2t4', type: 'input', questionKey: 'data.tasks.g2s_seed_grows_into', difficulty: 2, answer: "В листьях" },
          ] },`,
  'C/D g2s-plt-l2 t3 fill_blank',
);

// C/D: g3m-1000-l2 — t4→fill_blank (keep ✓403)
worlds = replaceOnce(
  worlds,
  `            { id: 'g3m1000l2t1', type: 'input', questionKey: 'data.tasks.g3m_hundreds_in_347', difficulty: 1, answer: '3' },
            { id: 'g3m1000l2t2', type: 'input', questionKey: 'data.tasks.g3m_tens_in_456', difficulty: 1, answer: '5' },
            { id: 'g3m1000l2t3', type: 'input', questionKey: 'data.tasks.g3m_num_2h_3t_5u', difficulty: 2, answer: '235' },
            { id: 'g3m1000l2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3m_biggest_398_403_389', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_398', correct: false }, { id: 'b', textKey: 'data.tasks.opt_403', correct: true }, { id: 'c', textKey: 'data.tasks.opt_389', correct: false }] },
          ] },`,
  `            { id: 'g3m1000l2t1', type: 'input', questionKey: 'data.tasks.g3m_hundreds_in_347', difficulty: 1, answer: '3' },
            { id: 'g3m1000l2t2', type: 'input', questionKey: 'data.tasks.g3m_tens_in_456', difficulty: 1, answer: '5' },
            { id: 'g3m1000l2t3', type: 'input', questionKey: 'data.tasks.g3m_num_2h_3t_5u', difficulty: 2, answer: '235' },
            { id: 'g3m1000l2t4', type: 'fill_blank', questionKey: 'data.tasks.g3m_1000l2_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g3m_1000l2_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.opt_398', correct: false }, { id: 'fb-b', textKey: 'data.tasks.opt_403', correct: true }, { id: 'fb-c', textKey: 'data.tasks.opt_389', correct: false }] },
          ] },`,
  'C/D g3m-1000-l2 t4 fill_blank',
);

// C/D: g3r-adj-l2 — t2→fill_blank (keep ✓ быстрее)
worlds = replaceOnce(
  worlds,
  `            { id: 'g3radjl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adjl2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_adjl2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_adjl2_q1_c', correct: false }] },
            { id: 'g3radjl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adjl2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl2_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl2_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_adjl2_q2_c', correct: false }] },
            { id: 'g3radjl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adjl2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_adjl2_q3_c', correct: false }] },
            { id: 'g3radjl2t4', type: 'input', questionKey: 'data.tasks.g3r_adjl2_q4', difficulty: 2, answer: "Медленнее" },
          ] },`,
  `            { id: 'g3radjl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adjl2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_adjl2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_adjl2_q1_c', correct: false }] },
            { id: 'g3radjl2t2', type: 'fill_blank', questionKey: 'data.tasks.g3r_adjl2_fb_sent', difficulty: 1, sentenceKey: 'data.tasks.g3r_adjl2_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g3r_adjl2_q2_a', correct: true }, { id: 'fb-b', textKey: 'data.tasks.g3r_adjl2_q2_b', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g3r_adjl2_q2_c', correct: false }] },
            { id: 'g3radjl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3r_adjl2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_adjl2_q3_c', correct: false }] },
            { id: 'g3radjl2t4', type: 'input', questionKey: 'data.tasks.g3r_adjl2_q4', difficulty: 2, answer: "Медленнее" },
          ] },`,
  'C/D g3r-adj-l2 t2 fill_blank',
);

// C/D: g3e-food-l1 — t3→fill_blank
worlds = replaceOnce(
  worlds,
  `            { id: 'g3efoodl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_food1_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food1_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food1_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food1_q1_c', correct: false }] },
            { id: 'g3efoodl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_food1_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food1_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_food1_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_food1_q2_c', correct: false }] },
            { id: 'g3efoodl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_foodl1_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_foodl1_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_foodl1_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_foodl1_q3_c', correct: false }] },
            { id: 'g3efoodl1t4', type: 'input', questionKey: 'data.tasks.g3e_food1_q4', difficulty: 2, answer: "Воду" },
          ] },`,
  `            { id: 'g3efoodl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_food1_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food1_q1_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_food1_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_food1_q1_c', correct: false }] },
            { id: 'g3efoodl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_food1_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_food1_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g3e_food1_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g3e_food1_q2_c', correct: false }] },
            { id: 'g3efoodl1t3', type: 'fill_blank', questionKey: 'data.tasks.g3e_foodl1_fb_sent', difficulty: 1, sentenceKey: 'data.tasks.g3e_foodl1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g3e_foodl1_q3_a', correct: true }, { id: 'fb-b', textKey: 'data.tasks.g3e_foodl1_q3_b', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g3e_foodl1_q3_c', correct: false }] },
            { id: 'g3efoodl1t4', type: 'input', questionKey: 'data.tasks.g3e_food1_q4', difficulty: 2, answer: "Воду" },
          ] },`,
  'C/D g3e-food-l1 t3 fill_blank',
);

// C/D: g3e-daily-l1 — t3→fill_blank
worlds = replaceOnce(
  worlds,
  `            { id: 'g3edailyl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_wake_up_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_wake_up_f', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_go_sleep', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_have_lunch', correct: false }] },
            { id: 'g3edailyl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_brush_teeth_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_brush_teeth', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_eat_breakfast', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_take_shower', correct: false }] },
            { id: 'g3edailyl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g3e_i_wake_up_at_7', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_at_correct', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_in_correct', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_on_correct', correct: false }] },
            { id: 'g3edailyl1t4', type: 'input', questionKey: 'data.tasks.g3e_eat_breakfast_means', difficulty: 1, answer: "Завтракать" },
          ] },`,
  `            { id: 'g3edailyl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g3e_wake_up_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_wake_up_f', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_go_sleep', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_have_lunch', correct: false }] },
            { id: 'g3edailyl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g3e_brush_teeth_en', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3e_opt_brush_teeth', correct: true }, { id: 'b', textKey: 'data.tasks.g3e_opt_eat_breakfast', correct: false }, { id: 'c', textKey: 'data.tasks.g3e_opt_take_shower', correct: false }] },
            { id: 'g3edailyl1t3', type: 'fill_blank', questionKey: 'data.tasks.g3e_dailyl1_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g3e_dailyl1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g3e_opt_at_correct', correct: true }, { id: 'fb-b', textKey: 'data.tasks.g3e_opt_in_correct', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g3e_opt_on_correct', correct: false }] },
            { id: 'g3edailyl1t4', type: 'input', questionKey: 'data.tasks.g3e_eat_breakfast_means', difficulty: 1, answer: "Завтракать" },
          ] },`,
  'C/D g3e-daily-l1 t3 fill_blank',
);

// D-only: g4s-emo-l2 — diversify t3→fill_blank; KEEP t4 MC ✓злость
worlds = replaceOnce(
  worlds,
  `          { id: 'g4s-emo-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q1_c', correct: false }] },
          { id: 'g4s-emo-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q2_c', correct: false }] },
          { id: 'g4s-emo-l2-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q3_c', correct: false }] },
          { id: 'g4s-emo-l2-t4', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q4_c', correct: false }] },`,
  `          { id: 'g4s-emo-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q1_c', correct: false }] },
          { id: 'g4s-emo-l2-t2', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo2_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q2_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q2_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q2_c', correct: false }] },
          { id: 'g4s-emo-l2-t3', type: 'fill_blank', questionKey: 'data.tasks.g4s_emo2_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g4s_emo2_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g4s_emo2_fb_a', correct: true }, { id: 'fb-b', textKey: 'data.tasks.g4s_emo2_fb_b', correct: false }, { id: 'fb-c', textKey: 'data.tasks.g4s_emo2_fb_c', correct: false }] },
          { id: 'g4s-emo-l2-t4', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q4_c', correct: false }] },`,
  'D g4s-emo-l2 t3 fill_blank (t4 MC kept)',
);

// D-only: meadow-c5-l3 — t3→fill_blank WITHOUT changing ✓ (equal)
worlds = replaceOnce(
  worlds,
  `    {
      id: 'mc5l3-t3',
      type: 'multiple_choice',
      questionKey: 'data.tasks.mc5l3_q_kittens_puppies',
      difficulty: 2,
      options: [
        { id: 'a', textKey: 'data.tasks.mc5l3_opt_more_kittens', correct: false },
        { id: 'b', textKey: 'data.tasks.mc5l3_opt_more_puppies', correct: false },
        { id: 'c', textKey: 'data.tasks.mc5l3_opt_equal_kittens_puppies', correct: true },
      ],
    },
    { id: 'mc5l3-t4', type: 'input', questionKey: 'data.tasks.mc5l3_q_which_bigger_1_or_4', difficulty: 2, answer: '4' },`,
  `    {
      id: 'mc5l3-t3',
      type: 'fill_blank',
      questionKey: 'data.tasks.mc5l3_fb_sent',
      difficulty: 2,
      sentenceKey: 'data.tasks.mc5l3_fb_sent',
      options: [
        { id: 'fb-a', textKey: 'data.tasks.mc5l3_opt_more_kittens', correct: false },
        { id: 'fb-b', textKey: 'data.tasks.mc5l3_opt_more_puppies', correct: false },
        { id: 'fb-c', textKey: 'data.tasks.mc5l3_opt_equal_kittens_puppies', correct: true },
      ],
    },
    { id: 'mc5l3-t4', type: 'input', questionKey: 'data.tasks.mc5l3_q_which_bigger_1_or_4', difficulty: 2, answer: '4' },`,
  'D meadow-c5-l3 t3 fill_blank (✓ equal kept)',
);

// D-only: lab-physics-1 optional 4th task
worlds = replaceOnce(
  worlds,
  `              { id: 'lab-ph-1-t3', type: 'input', questionKey: 'data.tasks.lab_ph_q3', difficulty: 2, answer: "Равновесие" },
              // Montessori`,
  `              { id: 'lab-ph-1-t3', type: 'input', questionKey: 'data.tasks.lab_ph_q3', difficulty: 2, answer: "Равновесие" },
              { id: 'lab-ph-1-t4', type: 'input', questionKey: 'data.tasks.lab_ph_q4', difficulty: 2, answer: "Вправо" },
              // Montessori`,
  'D lab-physics-1 add t4',
);

fs.writeFileSync(worldsPath, worlds, 'utf8');
console.log('OK worlds.ts written');

/* ========== Locale patches ========== */
const taskPatches = {
  ru: {
    g2r_opt_opred: 'Определение (какой?)',
    g2r_opt_dopol: 'Дополнение (кого? что?)',
    g2r_opt_obst: 'Обстоятельство (как? где?)',
    g2r_sentl2_q4:
      'В предложении «Пушистый кот быстро ест вкусную рыбу» слово БЫСТРО — какой второстепенный член? (одно слово)',
    g2r_sentl2_fb_sent: 'В «Кот БЫСТРО бежит» слово БЫСТРО — это _ .',
    g2e_days3_q1: 'On Tuesday we have ___ . Какой предмет?',
    g2e_days3_q2: '“On ___ we have PE.” Какой день недели?',
    g2e_days3_q4: 'Напиши целиком: On Friday we have art.',
    g2e_days3_fb_sent: 'We go to school ___ Monday.',
    g2m_timesl3_fb_sent: '3 × 9 = _',
    g2m_timesl3_fb_a: '24',
    g2m_timesl3_fb_b: '27',
    g2m_timesl3_fb_c: '36',
    g4r_conj_l1_fb_sent: 'В «Мальчик идёт по улице» глагол «идёт» — это _ лицо.',
    g4r_cases_l1_fb_sent: 'После «Я вижу» нужно: _',
    g2s_pltl2_fb_sent: 'Растения выделяют кислород — это правда? _',
    g3m_1000l2_fb_sent: 'Самое большое число из 398, 403, 389 — это _',
    g3r_adjl2_fb_sent: 'Сравнительная степень от БЫСТРЫЙ: _',
    g3e_foodl1_fb_sent: 'Tea, coffee, milk — все эти слова это _',
    g3e_dailyl1_fb_sent: 'I wake up _ 7.',
    g4s_emo2_fb_sent: 'Страх — избежать угрозу; злость — желание _',
    g4s_emo2_fb_a: 'изменить несправедливость',
    g4s_emo2_fb_b: 'убежать и спрятаться',
    g4s_emo2_fb_c: 'всегда радоваться',
    mc5l3_fb_sent: '3 котёнка и 3 щенка — их _',
    lab_ph_q4: 'Весы наклонились вправо. Куда «перевесила» чаша? Напиши: Влево / Вправо / Ровно.',
  },
  en: {
    g2r_opt_opred: 'Attribute / modifier (what kind?)',
    g2r_opt_dopol: 'Object (whom? what?)',
    g2r_opt_obst: 'Adverbial (how? where?)',
    g2r_sentl2_q4:
      'In “A fluffy cat quickly eats tasty fish”, what secondary part is QUICKLY? (one word: Attribute / Object / Adverbial)',
    g2r_sentl2_fb_sent: 'In “The cat runs QUICKLY”, QUICKLY is _ .',
    g2e_days3_q1: 'On Tuesday we have ___ . Which subject?',
    g2e_days3_q2: '“On ___ we have PE.” Which day?',
    g2e_days3_q4: 'Write the full phrase: On Friday we have art.',
    g2e_days3_fb_sent: 'We go to school ___ Monday.',
    g2m_timesl3_fb_sent: '3 × 9 = _',
    g2m_timesl3_fb_a: '24',
    g2m_timesl3_fb_b: '27',
    g2m_timesl3_fb_c: '36',
    g4r_conj_l1_fb_sent: 'In “Мальчик идёт по улице”, the verb «идёт» is _ person.',
    g4r_cases_l1_fb_sent: 'After “Я вижу” you need: _',
    g2s_seed_grows_into: 'Where in the plant does photosynthesis happen?',
    g2s_pltl2_fb_sent: 'Do plants release oxygen? _',
    g3m_tens_in_456: 'How many tens are in 456?',
    g3m_1000l2_fb_sent: 'The largest of 398, 403, 389 is _',
    g3r_adjl2_q1_a: 'больший (wrong form)',
    g3r_adjl2_q1_b: 'больше (bigger)',
    g3r_adjl2_q1_c: 'самый большой (biggest)',
    g3r_adjl2_fb_sent: 'Comparative of БЫСТРЫЙ: _',
    g3e_food1_q1_a: 'Juice / fruit drink (сок)',
    g3e_food1_q1_b: 'Porridge (каша)',
    g3e_food1_q1_c: 'Milk (молоко)',
    g3e_food1_q2_a: 'Milk (молоко)',
    g3e_food1_q2_b: 'Porridge (каша)',
    g3e_food1_q2_c: 'Juice (сок)',
    g3e_foodl1_fb_sent: 'Tea, coffee, milk — these words are all _',
    g3e_wake_up_en: 'The alarm rings at 7 a.m. “Wake up” means:',
    g3e_opt_wake_up_f: 'to get up / wake from sleep',
    g3e_opt_go_sleep: 'to go to sleep',
    g3e_opt_have_lunch: 'to have lunch',
    g3e_brush_teeth_en: 'After breakfast Tom cleans his teeth. “Brush teeth” means:',
    g3e_opt_brush_teeth: 'to clean your teeth',
    g3e_opt_eat_breakfast: 'to eat breakfast',
    g3e_opt_take_shower: 'to take a shower',
    g3e_dailyl1_fb_sent: 'I wake up _ 7.',
    g4s_emo2_fb_sent: 'Fear — avoid danger; anger — wanting to _',
    g4s_emo2_fb_a: 'change something unfair',
    g4s_emo2_fb_b: 'run and hide',
    g4s_emo2_fb_c: 'always be happy',
    mc5l3_fb_sent: '3 kittens and 3 puppies — they are _',
    lab_ph_q4: 'The scale tipped right. Which pan is heavier? Write: Left / Right / Level. (RU: Влево / Вправо / Ровно)',
  },
  ky: {
    g2r_opt_opred: 'Аныктама (кандай?)',
    g2r_opt_dopol: 'Толуктооч (кимди? эмнени?)',
    g2r_opt_obst: 'Жагдай (кантип? кайда?)',
    g2r_sentl2_q4:
      '«Пушистый кот быстро ест вкусную рыбу» сүйлөмүндө БЫСТРО — кайсы мүчө? (бир сөз)',
    g2r_sentl2_fb_sent: '«Кот БЫСТРО бежит» сүйлөмүндө БЫСТРО — бул _ .',
    g2e_days3_q1: 'On Tuesday we have ___ . Кайсы сабак?',
    g2e_days3_q2: '“On ___ we have PE.” Кайсы күн?',
    g2e_days3_q4: 'Толук жаз: On Friday we have art.',
    g2e_days3_fb_sent: 'We go to school ___ Monday.',
    g2m_timesl3_fb_sent: '3 × 9 = _',
    g2m_timesl3_fb_a: '24',
    g2m_timesl3_fb_b: '27',
    g2m_timesl3_fb_c: '36',
    g4r_conj_l1_fb_sent: '«Мальчик идёт по улице» сүйлөмүндө «идёт» — бул _ жак.',
    g4r_cases_l1_fb_sent: '«Я вижу» дегенден кийин керек: _',
    // B: KY case labels (KY name first, like EN)
    g4r_cases_q1_a: 'Атооч (именительный)',
    g4r_cases_q1_b: 'Табыш (винительный)',
    g4r_cases_q1_c: 'Барыш (дательный)',
    g4r_cases_q2_a: 'Жок, ээ — «книга», ал атооч жөндөмөдө',
    g4r_cases_q3_a: 'атооч: «книга»',
    g4r_cases_q3_b: 'илик: «книги»',
    g4r_cases_q3_c: 'табыш: «книгу»',
    g4r_cases_q4: 'Атооч жөндөмө табыштан эмнеси менен айырмаланат? Туура түшүндүрмөнү танда.',
    g4r_cases_q4_b:
      'Табыш — аракеттин объектиси (кого? что?), атооч — сүйлөмдүн «ээси» (кто? что?)',
    g4r_cases_q4_c: 'Атооч ар дайым предлог менен турат',
    g4r_cases2_q1: 'Илик жөндөмөдөгү сөз кайсы суроого жооп берет?',
    g4r_cases2_q2_a: 'Барыш: «собаке»',
    g4r_cases2_q2_b: 'Атооч: «собака»',
    g4r_cases2_q2_c: 'Илик: «собаки»',
    g4r_cases2_q3_a: 'друг (атооч)',
    g4r_cases2_q3_b: 'друга (илик)',
    g4r_cases2_q3_c: 'другу (барыш)',
    g4r_cases3_q1_a: 'Жатыш/предложный: «о лесе»',
    g4r_cases3_q1_b: 'Табыш: «о лес»',
    g4r_cases3_q1_c: 'Барыш: «о лесу»',
    g4r_cases3_q2_a: 'художник (атооч)',
    g4r_cases3_q2_b: 'художником (творительный)',
    g4r_cases3_q2_c: 'художнику (барыш)',
    g4r_cases3_q3_a: 'Ооба, Тали туура — барыш',
    g4r_cases3_q3_b: 'Жок, бул предложный — бир гана ал ар дайым предлог менен',
    g4r_cases3_q3_c: 'Жок, бул творительный',
    g4r_cases3_q4_a: 'Барыш (4-чү)',
    g4r_cases3_q4_b: 'Предложный (6-чы)',
    g4r_cases3_q4_c: 'Творительный (5-чи)',
    aba_jungleSub_q2: '8ден 3тү алсак =?',
    g2s_seed_grows_into: 'Өсүмдүктө фотосинтез кайда жүрөт?',
    g2s_pltl2_fb_sent: 'Өсүмдүктөр кычкылтек бөлүп чыгарабы? _',
    g3m_1000l2_fb_sent: '398, 403, 389 ичинен эң чоңу — бул _',
    g3r_adjl2_fb_sent: 'БЫСТРЫЙ сөзүнөн салыштырма даража: _',
    g3e_foodl1_fb_sent: 'Tea, coffee, milk — бул сөздөрдүн баары _',
    g3e_dailyl1_fb_sent: 'I wake up _ 7.',
    g4s_emo2_fb_sent: 'Коркуу — коркунучтан качуу; ачуу — _ каалоо',
    g4s_emo2_fb_a: 'адилетсиздикти өзгөртүү',
    g4s_emo2_fb_b: 'чуркап жашынуу',
    g4s_emo2_fb_c: 'ар дайым кубануу',
    mc5l3_fb_sent: '3 мышык баласы жана 3 ит бала — алар _',
    lab_ph_q4: 'Тараза оңго кыйшайды. Кайсы табак оорураак? Жаз: Влево / Вправо / Ровно.',
  },
};

const dialogPatches = {
  en: {
    g2m_timesl3_0: 'Tali, you have three pockets with 7 coins in each. How many coins in total?',
    g3e_foodl1_1:
      'Juice means сок! Porridge means каша. Tali, you drink juice every morning — now you know the English words!',
  },
  ky: {
    g2m_timesl3_0: 'Тали, сенин үч чөнтөгүң бар, ар биринде 7 тыйын. Жалпы канча тыйын?',
  },
};

for (const [lang, patches] of Object.entries(taskPatches)) {
  const doc = lang === 'ru' ? ru : lang === 'en' ? en : ky;
  for (const [k, v] of Object.entries(patches)) {
    doc.data.tasks[k] = v;
  }
  console.log('OK patched tasks', lang, Object.keys(patches).length);
}

for (const [lang, patches] of Object.entries(dialogPatches)) {
  const doc = lang === 'en' ? en : ky;
  for (const [k, v] of Object.entries(patches)) {
    doc.data.dialog[k] = v;
  }
  console.log('OK patched dialog', lang, Object.keys(patches).length);
}

// Sync ABA overrides for touched keys
const abaKeys = new Set([
  ...Object.keys(taskPatches.ru),
  ...Object.keys(taskPatches.en),
  ...Object.keys(taskPatches.ky),
]);
for (const k of abaKeys) {
  const full = `data.tasks.${k}`;
  if (ru.data.tasks[k] != null) abaRu[full] = ru.data.tasks[k];
  if (en.data.tasks[k] != null) abaEn[full] = en.data.tasks[k];
  if (ky.data.tasks[k] != null) abaKy[full] = ky.data.tasks[k];
}
for (const [lang, patches] of Object.entries(dialogPatches)) {
  for (const k of Object.keys(patches)) {
    const full = `data.dialog.${k}`;
    if (lang === 'en') abaEn[full] = en.data.dialog[k];
    if (lang === 'ky') abaKy[full] = ky.data.dialog[k];
  }
}
console.log('OK ABA overrides synced', abaKeys.size, 'task keys');

save('ru.json', ru);
save('en.json', en);
save('ky.json', ky);
save('abaTextOverrides.generated.json', abaRu);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);

if (process.exitCode) {
  console.error('\nWave 3 apply FINISHED WITH ERRORS');
  process.exit(1);
}
console.log('\nWave 3 content apply done.');
