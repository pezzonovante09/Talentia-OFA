/**
 * Scope A EN/KY pass: real criticals + real EN/KY flags.
 * Whitelist: numeric ky=ru, aba_ky_copies_ru, cognates.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales', name), 'utf8'));
}
function save(name, doc) {
  fs.writeFileSync(path.join(root, 'src/i18n/locales', name), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}

const ru = load('ru.json');
const en = load('en.json');
const ky = load('ky.json');
const abaRu = load('abaTextOverrides.generated.json');
const abaEn = load('abaTextOverrides.en.generated.json');
const abaKy = load('abaTextOverrides.ky.generated.json');

const touched = { tasks: new Set(), dialog: new Set(), intro: new Set() };

function setTask(lang, key, value) {
  const doc = lang === 'ru' ? ru : lang === 'en' ? en : ky;
  if (doc.data.tasks[key] === value) return;
  doc.data.tasks[key] = value;
  touched.tasks.add(key);
}
function setDialog(lang, key, value) {
  const doc = lang === 'ru' ? ru : lang === 'en' ? en : ky;
  if (doc.data.dialog[key] === value) return;
  doc.data.dialog[key] = value;
  touched.dialog.add(key);
}
function setIntro(lang, key, value) {
  const doc = lang === 'ru' ? ru : lang === 'en' ? en : ky;
  if (doc.data.intro[key] === value) return;
  doc.data.intro[key] = value;
  touched.intro.add(key);
}

/* ========== Phase 1: English-target KY options ========== */
const englishTargetOpts = {
  g2e_opt_monday: 'Monday',
  g2e_opt_tuesday: 'Tuesday',
  g2e_opt_wednesday: 'Wednesday',
  g2e_opt_thursday: 'Thursday',
  g2e_opt_friday: 'Friday',
  g2e_opt_saturday: 'Saturday',
  g2e_opt_sunday: 'Sunday',
  g2e_opt_music: 'Music',
  g2e_opt_art: 'Art',
  g2e_opt_science: 'Science',
  g2e_opt_history: 'History',
  g2e_opt_english: 'English',
};
for (const [k, v] of Object.entries(englishTargetOpts)) setTask('ky', k, v);

// KY questions: keep local gloss, fix ru-leak
setTask('ky', 'g2e_monday_ru', 'Дүйшөмбү англисче:');
setTask('ky', 'g2e_tuesday_ru', 'Шейшемби англисче:');
setTask('ky', 'g2e_daysl1_fb_sent', 'Шаршемби англисче — _');
setTask('ky', 'g2e_after_monday', 'Тали чаташты! Дүйшөмбүдөн кийин кайсы күн келет? (англисче жаз)');
setTask('ky', 'g2e_math_in_en', 'Математика англисче:');
setTask('ky', 'g2e_art_in_en', 'Сүрөт тартуу англисче:');
setTask('ky', 'g2e_pe_in_en', 'Дене тарбия англисче:');
setTask('ky', 'g2e_english_subject', 'Англис тили англисче:');

/* ========== Phase 1: g2r-sh-l1 EN letter mismatch + KY ru-leak + EN dialog ========== */
setTask(
  'en',
  'g2r_nos_consonant',
  'Tali reads the word НОС and asks: “Is Н hard or soft here?” Help him!',
);
setTask(
  'en',
  'g2r_zha_hard',
  'Masha says: “The letter Ж is always hard in every word — no exceptions!” Tali doesn’t believe it. Do you?',
);
setTask('ky', 'g2r_zha_hard', 'Маша: «Ж тамгасы ар дайым катуу — өзгөчө жок!» Тали ишенбейт. Сенче?');
setTask(
  'ky',
  'g2r_nos_consonant',
  'Тали НОС сөзүн окуп: «Н бул жерде катуубу же жумшакпы?» деп сурайт. Жардам бер!',
);
setDialog(
  'en',
  'g2r_shl1_0',
  'Hi! I’m Masha! Tali, I want to teach you hard and soft consonants — but I get mixed up on some words. Can you help?',
);
setDialog(
  'en',
  'g2r_shl1_1',
  'Sure! I honestly thought “hard” meant the letter was made of stone. Apparently not? Tell me!',
);
setIntro(
  'en',
  'g2r_shl1_0_b',
  'A consonant is hard if А, О, У, Ы or Э comes after it. ЛА, ЛО, ЛУ — hard! Remember: it’s about the sound, not stone.',
);
setIntro(
  'en',
  'g2r_shl1_1_b',
  'ЛА — hard Л, ЛИ — soft Л. The letter after the consonant changes everything!',
);

/* ========== Phase 2 stubs / mismatches / tautology (known from audit) ========== */

// g2r-sh-l2
setTask(
  'en',
  'g2r_kon_konj',
  'Tali wrote «КОН». Masha says it should be «КОНЬ». How do you spell the word for horse?',
);
setTask('en', 'g2r_soft_sign_role', 'What does the soft sign do in a word?');
setTask(
  'en',
  'g2r_soft_sign_between',
  'The soft sign can stand between two consonants (e.g. ПИСЬМО). Is that true?',
);
setDialog('en', 'g2r_shl2_0', 'Masha, I wrote «КОН» in a note. Masha laughs and says it’s wrong. What’s wrong?');
setDialog(
  'en',
  'g2r_shl2_1',
  'Tali, you need the soft sign! Without it, «конь» turns into something else. Shall we explain?',
);
setTask('ky', 'g2r_kon_konj', 'Тали «КОН» деп жазды. Маша «КОНЬ» болушу керек дейт. Ат сөзүн кантип жазабыз?');
setTask('ky', 'g2r_soft_sign_role', 'Жумшак белги сөздө эмне кылат?');
setTask(
  'ky',
  'g2r_soft_sign_between',
  'Жумшак белги эки үнсүздүн ортосунда тура алат (мис.: ПИСЬМО). Бул чынбы?',
);

// g2r-sh-l3 — soft L before soft vowels
const ruShl3Keys = Object.keys(ru.data.tasks).filter((k) => k.startsWith('g2r_shl3') || k.includes('limon') || k.includes('lamp'));
// dump key names for soft L
for (const k of ['g2r_limon_soft', 'g2r_lampa_hard', 'g2r_which_soft_l', 'g2r_shl3_q1', 'g2r_shl3_q2', 'g2r_shl3_q3', 'g2r_shl3_q4']) {
  if (ru.data.tasks[k]) console.log('shl3 key', k, 'RU', ru.data.tasks[k]?.slice?.(0, 60));
}

console.log('Phase1+partial applied; continuing with dump-driven keys…');

/* Save mid-progress helpers after more patches below */

// Food / daily tautology
setTask('en', 'g3e_food2_q2_a', 'Onion / onions (лук)');
setTask('en', 'g3e_food2_q2_b', 'Soup (суп)');
setTask('en', 'g3e_food2_q2_c', 'Apples (яблоки)');
setTask('en', 'g3e_daily3_q1_a', 'Always (всегда)');
setTask('en', 'g3e_daily3_q1_b', 'Sometimes (иногда)');
setTask('en', 'g3e_daily3_q1_c', 'Never (никогда)');

// Sync ABA for all touched after full patch set
function syncAba() {
  for (const k of touched.tasks) {
    const full = `data.tasks.${k}`;
    if (ru.data.tasks[k] != null) abaRu[full] = ru.data.tasks[k];
    if (en.data.tasks[k] != null) abaEn[full] = en.data.tasks[k];
    if (ky.data.tasks[k] != null) abaKy[full] = ky.data.tasks[k];
  }
  for (const k of touched.dialog) {
    const full = `data.dialog.${k}`;
    if (ru.data.dialog[k] != null) abaRu[full] = ru.data.dialog[k];
    if (en.data.dialog[k] != null) abaEn[full] = en.data.dialog[k];
    if (ky.data.dialog[k] != null) abaKy[full] = ky.data.dialog[k];
  }
  for (const k of touched.intro) {
    const full = `data.intro.${k}`;
    if (ru.data.intro[k] != null) abaRu[full] = ru.data.intro[k];
    if (en.data.intro[k] != null) abaEn[full] = en.data.intro[k];
    if (ky.data.intro[k] != null) abaKy[full] = ky.data.intro[k];
  }
}

// Export for second half of script via continuing in same file after reading dumps
fs.writeFileSync(
  path.join(root, 'scripts/_enky_pass_partial_state.json'),
  JSON.stringify(
    {
      tasks: [...touched.tasks],
      dialog: [...touched.dialog],
      intro: [...touched.intro],
    },
    null,
    2,
  ),
);

syncAba();
save('en.json', en);
save('ky.json', ky);
save('abaTextOverrides.generated.json', abaRu);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);
console.log('OK phase1 + tautology + sh-l2 base; touched tasks', touched.tasks.size);
