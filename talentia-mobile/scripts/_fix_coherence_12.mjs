/**
 * Coherence/format fixes for 12 lessons + strip answer leaks from g2m and g3m in ru.json.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

const worldsPath = path.join(root, 'src/data/worlds.ts');
let worlds = fs.readFileSync(worldsPath, 'utf8');

function replaceOnce(src, oldStr, newStr, label) {
  if (!src.includes(oldStr)) {
    console.error('MISSING block for', label);
    process.exitCode = 1;
    return src;
  }
  return src.replace(oldStr, newStr);
}

/* ========== worlds.ts structural fixes ========== */

// 1. g1e-abc-l3 — letter options O/P/Q/R, answer R
worlds = replaceOnce(
  worlds,
  `            { id: 'g1eabcl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_O_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_orange', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_pen', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_queen', correct: false }] },
            { id: 'g1eabcl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_P_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_orange', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_pen', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_queen', correct: false }] },
            { id: 'g1eabcl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_starts_with_Q', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_rain', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_queen', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_sun', correct: false }] },
            { id: 'g1eabcl3t4', type: 'input', questionKey: 'data.tasks.g1e_R_for', difficulty: 2, answer: "rain" },`,
  `            { id: 'g1eabcl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_O_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_O', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_P', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_Q', correct: false }] },
            { id: 'g1eabcl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_P_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_O', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_P', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_Q', correct: false }] },
            { id: 'g1eabcl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_starts_with_Q', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_O', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_Q', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_R', correct: false }] },
            { id: 'g1eabcl3t4', type: 'input', questionKey: 'data.tasks.g1e_R_for', difficulty: 2, answer: "R" },`,
  'g1e-abc-l3',
);

// 5. g2m-add2-l2 — bridging to ten
worlds = replaceOnce(
  worlds,
  `            { id: 'g2madd2l2t1', type: 'input', questionKey: 'data.tasks.g2m_23plus14', difficulty: 1, answer: '37' },
            { id: 'g2madd2l2t2', type: 'input', questionKey: 'data.tasks.g2m_35plus42', difficulty: 1, answer: '77' },
            { id: 'g2madd2l2t3', type: 'input', questionKey: 'data.tasks.g2m_47plus26', difficulty: 2, answer: '73' },
            { id: 'g2madd2l2t4', type: 'input', questionKey: 'data.tasks.g2m_58plus35', difficulty: 3, answer: '93' },`,
  `            { id: 'g2madd2l2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2m_28plus5', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2m_opt_33', correct: true }, { id: 'b', textKey: 'data.tasks.g2m_opt_213', correct: false }, { id: 'c', textKey: 'data.tasks.g2m_opt_35', correct: false }] },
            { id: 'g2madd2l2t2', type: 'input', questionKey: 'data.tasks.g2m_36plus7', difficulty: 1, answer: '43' },
            { id: 'g2madd2l2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2m_19plus4_step', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2m_opt_19plus1', correct: true }, { id: 'b', textKey: 'data.tasks.g2m_opt_19plus4_all', correct: false }, { id: 'c', textKey: 'data.tasks.g2m_opt_19plus9', correct: false }] },
            { id: 'g2madd2l2t4', type: 'input', questionKey: 'data.tasks.g2m_47plus8', difficulty: 2, answer: '55' },`,
  'g2m-add2-l2',
);

// 4. g2r-sh-l3 — soft/hard for LU; keep LI as yes/no (valid yes/no Q)
worlds = replaceOnce(
  worlds,
  `            { id: 'g2rshl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_li_is_soft', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rshl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_lu_is_hard', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rshl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_le_is_what', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_soft', correct: true }, { id: 'b', textKey: 'data.tasks.opt_hard', correct: false }] },
            { id: 'g2rshl3t4', type: 'input', questionKey: 'data.tasks.g2r_la_is_what', difficulty: 2, answer: "Твёрдый" },`,
  `            { id: 'g2rshl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_li_is_soft', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rshl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_lu_is_hard', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_soft', correct: false }, { id: 'b', textKey: 'data.tasks.opt_hard', correct: true }] },
            { id: 'g2rshl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_le_is_what', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_soft', correct: true }, { id: 'b', textKey: 'data.tasks.opt_hard', correct: false }] },
            { id: 'g2rshl3t4', type: 'input', questionKey: 'data.tasks.g2r_la_is_what', difficulty: 2, answer: "Твёрдый" },`,
  'g2r-sh-l3',
);

// 11. g2r-sp-l1 — БЕЖИТ noun? Нет; t4 → MC; t2 uses clearer yes/no Q via i18n
worlds = replaceOnce(
  worlds,
  `            { id: 'g2rspl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_noun_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kto_chto', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_chto_delaet', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_kakoy', correct: false }] },
            { id: 'g2rspl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_kot_noun', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rspl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_beg_noun', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
            { id: 'g2rspl1t4', type: 'input', questionKey: 'data.tasks.g2r_which_is_noun', difficulty: 2, answer: "Книга" },`,
  `            { id: 'g2rspl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_noun_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kto_chto', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_chto_delaet', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_kakoy', correct: false }] },
            { id: 'g2rspl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_kot_noun', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: true }, { id: 'b', textKey: 'data.tasks.opt_no', correct: false }] },
            { id: 'g2rspl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_beg_noun', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },
            { id: 'g2rspl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2r_which_is_noun', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kniga', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_sidit', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_krasivyi', correct: false }] },`,
  'g2r-sp-l1',
);

// 3. g2r-sent-l2 — secondary members
worlds = replaceOnce(
  worlds,
  `            { id: 'g2rsentl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_subject_is', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_about_who', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_action', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_sign', correct: false }] },
            { id: 'g2rsentl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_predicate_is', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_about_who', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_action', correct: true }, { id: 'c', textKey: 'data.tasks.g2r_opt_sign', correct: false }] },
            { id: 'g2rsentl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_kot_sidit_subject', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_kot', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_sidit', correct: false }] },
            { id: 'g2rsentl2t4', type: 'input', questionKey: 'data.tasks.g2r_kot_sidit_predicate', difficulty: 2, answer: "Сидит" },`,
  `            { id: 'g2rsentl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_opred', correct: true }, { id: 'b', textKey: 'data.tasks.g2r_opt_dopol', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_obst', correct: false }] },
            { id: 'g2rsentl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl2_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_opred', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_dopol', correct: true }, { id: 'c', textKey: 'data.tasks.g2r_opt_obst', correct: false }] },
            { id: 'g2rsentl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2r_sentl2_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2r_opt_opred', correct: false }, { id: 'b', textKey: 'data.tasks.g2r_opt_dopol', correct: false }, { id: 'c', textKey: 'data.tasks.g2r_opt_obst', correct: true }] },
            { id: 'g2rsentl2t4', type: 'input', questionKey: 'data.tasks.g2r_sentl2_q4', difficulty: 2, answer: "Обстоятельство" },`,
  'g2r-sent-l2',
);

// 12. g2s-bdy-l3 — sport MC
worlds = replaceOnce(
  worlds,
  `            { id: 'g2sbdyl3t4', type: 'input', questionKey: 'data.tasks.g2s_sport_good', difficulty: 1, answer: "Да" },`,
  `            { id: 'g2sbdyl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2s_sport_good', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2s_opt_sport_muscles', correct: true }, { id: 'b', textKey: 'data.tasks.g2s_opt_sport_skip', correct: false }, { id: 'c', textKey: 'data.tasks.g2s_opt_sport_cookies', correct: false }] },`,
  'g2s-bdy-l3',
);

// 6. g2e-days-l3 — schedule phrases
worlds = replaceOnce(
  worlds,
  `            { id: 'g2edaysl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_day_saturday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_day_sunday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_day_monday', correct: false }] },
            { id: 'g2edaysl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_day_saturday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_day_sunday', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_day_monday', correct: false }] },
            { id: 'g2edaysl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_day_thursday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_day_saturday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_day_sunday', correct: false }] },
            { id: 'g2edaysl3t4', type: 'input', questionKey: 'data.tasks.g2e_days3_q4', difficulty: 2, answer: "Thursday" },`,
  `            { id: 'g2edaysl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_maths', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_music', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_art', correct: false }] },
            { id: 'g2edaysl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_day_monday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_day_sunday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_day_saturday', correct: false }] },
            { id: 'g2edaysl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_on', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_in', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_at', correct: false }] },
            { id: 'g2edaysl3t4', type: 'input', questionKey: 'data.tasks.g2e_days3_q4', difficulty: 2, answer: "Monday" },`,
  'g2e-days-l3',
);

// 10. g1e-num-l3 — visualCount for stars
worlds = replaceOnce(
  worlds,
  `            { id: 'g1enuml3t4', type: 'input', questionKey: 'data.tasks.g1e_how_many_8stars', difficulty: 1, answer: "eight" },`,
  `            { id: 'g1enuml3t4', type: 'input', questionKey: 'data.tasks.g1e_how_many_8stars', difficulty: 1, visualCount: 8, visualEmoji: '⭐', answer: "eight" },`,
  'g1e-num-l3',
);

fs.writeFileSync(worldsPath, worlds, 'utf8');
console.log('worlds.ts updated');

/* ========== locale text updates ========== */

const ruPath = path.join(root, 'src/i18n/locales/ru.json');
const enPath = path.join(root, 'src/i18n/locales/en.json');
const kyPath = path.join(root, 'src/i18n/locales/ky.json');
const ru = readJson(ruPath);
const en = readJson(enPath);
const ky = readJson(kyPath);

function setTask(loc, key, val) {
  loc.data.tasks[key] = val;
}
function setDialog(loc, key, val) {
  loc.data.dialog[key] = val;
}
function setIntro(loc, key, val) {
  loc.data.intro[key] = val;
}
function setLesson(loc, key, val) {
  loc.data.lessons[key] = val;
}

// --- strip answer leaks in RU g2m_*/g3m_* ---
let stripped = 0;
for (const [k, v] of Object.entries(ru.data.tasks)) {
  if (!/^(g2m_|g3m_)/.test(k)) continue;
  const s = String(v);
  const next = s.replace(/\s*_\([^)]*ответ[^)]*\)_/gi, '').replace(/\s+$/, '');
  if (next !== s) {
    ru.data.tasks[k] = next;
    stripped++;
  }
}
console.log('stripped answer leaks:', stripped);

// 1. g1e-abc-l3 texts — PARROT aligns with dialog
setTask(ru, 'g1e_P_for', 'С какой буквы начинается PARROT?');
setTask(en, 'g1e_P_for', 'What letter does PARROT start with?');
setTask(ky, 'g1e_P_for', 'PARROT кайсы тамгадан башталат?');
setTask(ru, 'g1e_R_for', 'С какой буквы начинается RAIN?');
setTask(en, 'g1e_R_for', 'What letter does RAIN start with?');
setTask(ky, 'g1e_R_for', 'RAIN кайсы тамгадан башталат?');

// 2. island-col-l1 — rewrite RU Q to colour ID
setTask(ru, 'nrw_icoll1_t1_q', 'Тали слышит сирену: едет большая RED truck. Какого она цвета по-английски?');
setTask(en, 'nrw_icoll1_t1_q', 'Tali hears the siren: a big RED truck is coming! What colour is it in English?');
setTask(ky, 'nrw_icoll1_t1_q', 'Tali hears the siren: a big RED truck is coming! What colour is it in English?');

// 3. g2r-sent-l2 secondary member keys
for (const loc of [ru, en, ky]) {
  setTask(loc, 'g2r_opt_opred', loc === ru ? 'Определение' : loc === en ? 'Attribute (modifier)' : 'Аныктама');
  setTask(loc, 'g2r_opt_dopol', loc === ru ? 'Дополнение' : loc === en ? 'Object' : 'Толуктооч');
  setTask(loc, 'g2r_opt_obst', loc === ru ? 'Обстоятельство' : loc === en ? 'Adverbial' : 'Жагдай');
}
setTask(ru, 'g2r_sentl2_q1', 'В предложении «Пушистый кот бежит» слово ПУШИСТЫЙ — это…');
setTask(en, 'g2r_sentl2_q1', 'In “A fluffy cat runs”, the word FLUFFY is…');
setTask(ky, 'g2r_sentl2_q1', '«Пушистый кот бежит» сүйлөмүндө ПУШИСТЫЙ сөзү — бул…');
setTask(ru, 'g2r_sentl2_q2', 'В предложении «Кот ест рыбу» слово РЫБУ — это…');
setTask(en, 'g2r_sentl2_q2', 'In “The cat eats fish”, the word FISH is…');
setTask(ky, 'g2r_sentl2_q2', '«Кот ест рыбу» сүйлөмүндө РЫБУ сөзү — бул…');
setTask(ru, 'g2r_sentl2_q3', 'В предложении «Кот БЫСТРО бежит» слово БЫСТРО — это…');
setTask(en, 'g2r_sentl2_q3', 'In “The cat runs QUICKLY”, the word QUICKLY is…');
setTask(ky, 'g2r_sentl2_q3', '«Кот БЫСТРО бежит» сүйлөмүндө БЫСТРО сөзү — бул…');
setTask(ru, 'g2r_sentl2_q4', 'В предложении «Пушистый кот быстро ест вкусную рыбу» слово БЫСТРО — какой второстепенный член? (напиши: Определение / Дополнение / Обстоятельство)');
setTask(en, 'g2r_sentl2_q4', 'In “A fluffy cat quickly eats tasty fish”, what secondary part is QUICKLY? (Attribute / Object / Adverbial)');
setTask(ky, 'g2r_sentl2_q4', '«Пушистый кот быстро ест вкусную рыбу» сүйлөмүндө БЫСТРО — кайсы мүчө? (Аныктама / Толуктооч / Жагдай)');

// 4. g2r-sh-l3 EN/RU clarity for LU
setTask(ru, 'g2r_lu_is_hard', 'Тали читает: ЛУЖА. Слог ЛУ — какой здесь Л?');
setTask(en, 'g2r_lu_is_hard', 'Tali reads: LUZHA. In the syllable LU, is L soft or hard?');
setTask(ky, 'g2r_lu_is_hard', 'Тали окуйт: ЛУЖА. ЛУ муунунда Л кандай — жумшак же катуу?');
setTask(ru, 'g2r_li_is_soft', 'В слове ЛИМОН: слог ЛИ делает согласный Л мягким?');
setTask(en, 'g2r_li_is_soft', 'In ЛИМОН, does the syllable ЛИ make L soft?');
setTask(ky, 'g2r_li_is_soft', 'ЛИМОН сөзүндө ЛИ мууну Л тыбышын жумшак кылабы?');

// 5. g2m bridging keys + options
setTask(ru, 'g2m_28plus5', '28 + 5 = ? (сначала добери до 30!)');
setTask(en, 'g2m_28plus5', '28 + 5 = ? (bridge up to 30 first!)');
setTask(ky, 'g2m_28plus5', '28 + 5 = ? (алдынча 30го жеткир!)');
setTask(ru, 'g2m_36plus7', '36 + 7 = ? (допрыгни до 40)');
setTask(en, 'g2m_36plus7', '36 + 7 = ? (jump to 40 first)');
setTask(ky, 'g2m_36plus7', '36 + 7 = ? (алдынча 40ка жет)');
setTask(ru, 'g2m_19plus4_step', '19 + 4: какой первый шаг «до круглого»?');
setTask(en, 'g2m_19plus4_step', '19 + 4: what is the first step to the round ten?');
setTask(ky, 'g2m_19plus4_step', '19 + 4: тегерек ондукка карай биринчи кадам кайсы?');
setTask(ru, 'g2m_47plus8', '47 + 8 = ?');
setTask(en, 'g2m_47plus8', '47 + 8 = ?');
setTask(ky, 'g2m_47plus8', '47 + 8 = ?');
setTask(ru, 'g2m_opt_33', '33');
setTask(en, 'g2m_opt_33', '33');
setTask(ky, 'g2m_opt_33', '33');
setTask(ru, 'g2m_opt_213', '213');
setTask(en, 'g2m_opt_213', '213');
setTask(ky, 'g2m_opt_213', '213');
setTask(ru, 'g2m_opt_35', '35');
setTask(en, 'g2m_opt_35', '35');
setTask(ky, 'g2m_opt_35', '35');
setTask(ru, 'g2m_opt_19plus1', '19 + 1 = 20, потом + 3');
setTask(en, 'g2m_opt_19plus1', '19 + 1 = 20, then + 3');
setTask(ky, 'g2m_opt_19plus1', '19 + 1 = 20, андан соң + 3');
setTask(ru, 'g2m_opt_19plus4_all', 'сразу 19 + 4 без шагов');
setTask(en, 'g2m_opt_19plus4_all', 'add 19 + 4 in one jump with no steps');
setTask(ky, 'g2m_opt_19plus4_all', 'кадамсыз эле 19 + 4');
setTask(ru, 'g2m_opt_19plus9', '19 + 9 = 28');
setTask(en, 'g2m_opt_19plus9', '19 + 9 = 28');
setTask(ky, 'g2m_opt_19plus9', '19 + 9 = 28');

// 6. g2e-days-l3 schedule
setTask(ru, 'g2e_days3_q1', 'On Monday we have ___ . Какой предмет?');
setTask(en, 'g2e_days3_q1', 'On Monday we have ___ . Which subject?');
setTask(ky, 'g2e_days3_q1', 'On Monday we have ___ . Кайсы сабак?');
setTask(ru, 'g2e_days3_q2', '“On ___ we have math.” Какой день недели?');
setTask(en, 'g2e_days3_q2', '“On ___ we have math.” Which day?');
setTask(ky, 'g2e_days3_q2', '“On ___ we have math.” Кайсы күн?');
setTask(ru, 'g2e_days3_q3', 'Какой предлог ставим перед днём недели: ___ Monday?');
setTask(en, 'g2e_days3_q3', 'Which preposition goes before a weekday: ___ Monday?');
setTask(ky, 'g2e_days3_q3', 'Жума күнүнүн алдында кайсы предлог: ___ Monday?');
setTask(ru, 'g2e_days3_q4', 'Дополни: On ___ we have math.');
setTask(en, 'g2e_days3_q4', 'Complete: On ___ we have math.');
setTask(ky, 'g2e_days3_q4', 'Толукта: On ___ we have math.');
setTask(ru, 'g2e_opt_on', 'On');
setTask(en, 'g2e_opt_on', 'On');
setTask(ky, 'g2e_opt_on', 'On');
setTask(ru, 'g2e_opt_in', 'In');
setTask(en, 'g2e_opt_in', 'In');
setTask(ky, 'g2e_opt_in', 'In');
setTask(ru, 'g2e_opt_at', 'At');
setTask(en, 'g2e_opt_at', 'At');
setTask(ky, 'g2e_opt_at', 'At');

// 7. g1r-wrd-l3 — punctuation dialog/intro alignment
setDialog(ru, 'g1r_wrdl3_0', 'Читаем предложения! Смотри: с большой буквы и знак в конце.');
setDialog(en, 'g1r_wrdl3_0', 'Reading sentences! Capital letter at the start, mark at the end.');
setDialog(ky, 'g1r_wrdl3_0', 'Сүйлөмдөрдү окуйбуз! Чоң тамга менен башталып, аягында белги!');
setDialog(ru, 'g1r_wrdl3_1', 'Тали говорит: «КОТ БЕЖИТ — тут два предложения!» Правда? Нет — это одно предложение с точкой в конце!');
setDialog(en, 'g1r_wrdl3_1', 'Tali says: “CAT RUNS — that’s two sentences!” Is he right? No — one sentence needs a capital and an end mark!');
setDialog(ky, 'g1r_wrdl3_1', 'Тали айтат: «КОТ БЕЖИТ — бул эки сүйлөм!» Чынбы? Жок — бул бир сүйлөм, аягында белги!');
setIntro(ru, 'g1r_wrdl3_0_t', 'Предложения!');
setIntro(en, 'g1r_wrdl3_0_t', 'Sentences!');
setIntro(ky, 'g1r_wrdl3_0_t', 'Сүйлөмдөр!');
setIntro(ru, 'g1r_wrdl3_0_b', 'Предложение выражает мысль. Начинается с большой буквы!');
setIntro(en, 'g1r_wrdl3_0_b', 'A sentence expresses a thought. It starts with a capital letter!');
setIntro(ky, 'g1r_wrdl3_0_b', 'Сүйлөм ойду билдирет. Чоң тамга менен башталат!');

// 8. island-anim-l3 — stay behind clarity
setTask(ru, 'nrw_ianiml3_t4_q', 'На космическом корабле Тали — только летающие животные. Кто должен остаться на земле (не летит)?');
setTask(en, 'nrw_ianiml3_t4_q', "Tali's spaceship only lets flying animals on board. Who must stay behind?");
setTask(ky, 'nrw_ianiml3_t4_q', "Tali's spaceship only lets flying animals on board. Who must stay behind?");

// 9. garden-col-l2 — intro/title to colors (no sizes); fix Прав Q
setLesson(ru, 'gardenColL2', 'Жёлтый, оранжевый, фиолетовый');
setLesson(en, 'gardenColL2', 'Yellow, Orange, Purple');
setLesson(ky, 'gardenColL2', 'Сары, кызгылт сары, кызгылт');
setIntro(ru, 'garden_coll2_1_t', 'Ещё фиолетовый!');
setIntro(en, 'garden_coll2_1_t', 'And purple!');
setIntro(ky, 'garden_coll2_1_t', 'Дагы кызгылт!');
setIntro(ru, 'garden_coll2_1_b', 'Фиолетовый — как баклажан и некоторые цветы. Жёлтый, оранжевый, фиолетовый — яркие краски сада!');
setIntro(en, 'garden_coll2_1_b', 'Purple — like an eggplant and some flowers. Yellow, orange, purple — bright garden colours!');
setIntro(ky, 'garden_coll2_1_b', 'Кызгылт — баклажан жана гүлдөр сыяктуу. Сары, кызгылт сары, кызгылт — бакчанын жаркыраган түстөрү!');
setTask(ru, 'nrw_gcoll2_t1_q', 'Тали видит в поле огромный цветок, который всегда смотрит на солнце. Подсолнух — какого цвета?');
setTask(en, 'nrw_gcoll2_t1_q', 'Тали видит в поле огромный цветок, который всегда смотрит на солнце. Подсолнух — какого цвета?');
setTask(ky, 'nrw_gcoll2_t1_q', 'Тали видит в поле огромный цветок, который всегда смотрит на солнце. Подсолнух — какого цвета?');

// 10. g1e-num-l3 — count in question + light dialog sync
setTask(ru, 'g1e_how_many_8stars', 'Сколько звёзд? (8 ★) — по-английски');
setTask(en, 'g1e_how_many_8stars', 'How many stars? (8 ★) — in English');
setTask(ky, 'g1e_how_many_8stars', 'Канча жылдыз? (8 ★) — англисче');
setDialog(ru, 'g1e_numl3_0', 'Простые примеры по-английски! Six minus three? Three plus four?');
setDialog(en, 'g1e_numl3_0', 'Simple examples in English! Six minus three? Three plus four?');
setDialog(ky, 'g1e_numl3_0', 'Англисче жөнөкөй мисалдар! Six minus three? Three plus four?');
setDialog(ru, 'g1e_numl3_1', 'Six minus three = three! Three plus four = seven! Отлично!');
setDialog(en, 'g1e_numl3_1', 'Six minus three = three! Three plus four = seven! Excellent!');
setDialog(ky, 'g1e_numl3_1', 'Six minus three = three! Three plus four = seven! Мыкты!');
setIntro(ru, 'g1e_numl3_0_b', 'Six minus three = three! Three plus four = seven! Считай по-английски!');
setIntro(en, 'g1e_numl3_0_b', 'Six minus three = three! Three plus four = seven! Count in English!');
setIntro(ky, 'g1e_numl3_0_b', 'Six minus three = three! Three plus four = seven! Англисче сана!');

// 11. g2r-sp-l1 clarity
setTask(ru, 'g2r_kot_noun', 'Тали говорит: «КОТ — это существительное!» Он прав?');
setTask(en, 'g2r_kot_noun', 'Tali says: “CAT is a noun!” Is he right?');
setTask(ky, 'g2r_kot_noun', 'Тали айтат: «КОТ — зат атооч!» Ал туурабы?');
setTask(ru, 'g2r_beg_noun', 'Тали смотрит на слово БЕЖИТ и думает: «Это существительное!» Он прав?');
setTask(en, 'g2r_beg_noun', 'Tali looks at the word RUNS and thinks: “This is a noun!” Is he right?');
setTask(ky, 'g2r_beg_noun', 'Тали БЕЖИТ сөзүнө карап: «Бул зат атооч!» дейт. Ал туурабы?');
setTask(ru, 'g2r_which_is_noun', 'Какое слово является существительным? Книга / Сидит / Красивый');
setTask(en, 'g2r_which_is_noun', 'Which word is a noun? Book / Sits / Beautiful');
setTask(ky, 'g2r_which_is_noun', 'Кайсы сөз зат атооч? Книга / Сидит / Красивый');

// 12. g2s-bdy-l3 sport
setTask(ru, 'g2s_sport_good', 'Арчи не хочет делать зарядку. Зачем нужна зарядка и спорт?');
setTask(en, 'g2s_sport_good', 'Archie does not want to exercise. Why are exercise and sport important?');
setTask(ky, 'g2s_sport_good', 'Арчи зарядка кылгысы келбейт. Зарядка жана спорт эмне үчүн керек?');
setTask(ru, 'g2s_opt_sport_muscles', 'Укрепляют мышцы и сердце');
setTask(en, 'g2s_opt_sport_muscles', 'They strengthen muscles and the heart');
setTask(ky, 'g2s_opt_sport_muscles', 'Булчуңдарды жана жүрөктү чыңдайт');
setTask(ru, 'g2s_opt_sport_skip', 'Можно совсем не двигаться');
setTask(en, 'g2s_opt_sport_skip', 'You can skip moving entirely');
setTask(ky, 'g2s_opt_sport_skip', 'Такыр кыймылдабаса болот');
setTask(ru, 'g2s_opt_sport_cookies', 'Чтобы есть только печенье');
setTask(en, 'g2s_opt_sport_cookies', 'So you can eat only cookies');
setTask(ky, 'g2s_opt_sport_cookies', 'Пен гана печенье жегиң келет');

writeJson(ruPath, ru);
writeJson(enPath, en);
writeJson(kyPath, ky);
console.log('locales updated');
