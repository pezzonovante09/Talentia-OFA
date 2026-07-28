/**
 * Wave 2 content fixes (A–D as approved).
 * Does NOT patch audit scores — reaudit #5 comes after.
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

const ru = load('ru.json');
const en = load('en.json');
const ky = load('ky.json');
const abaRu = load('abaTextOverrides.generated.json');
const abaEn = load('abaTextOverrides.en.generated.json');
const abaKy = load('abaTextOverrides.ky.generated.json');

/* ========== A: delete orphan g2m_25_after ========== */
for (const [label, doc] of [
  ['ru', ru],
  ['en', en],
  ['ky', ky],
]) {
  if (doc.data?.tasks?.g2m_25_after != null) {
    delete doc.data.tasks.g2m_25_after;
    console.log('OK delete locale', label, 'g2m_25_after');
  } else {
    console.log('skip locale', label, 'g2m_25_after missing');
  }
}
for (const [label, doc] of [
  ['abaRu', abaRu],
  ['abaEn', abaEn],
  ['abaKy', abaKy],
]) {
  if (doc['data.tasks.g2m_25_after'] != null) {
    delete doc['data.tasks.g2m_25_after'];
    console.log('OK delete', label, 'g2m_25_after');
  }
}

/* ========== B: worlds.ts wrong ✓ / MC restore ========== */
let worlds = fs.readFileSync(worldsPath, 'utf8');

worlds = replaceOnce(
  worlds,
  `{ id: 'g4r-text-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4r_text3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_text3_q3_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4r_text3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text3_q3_c', correct: true }] },`,
  `{ id: 'g4r-text-l3-t3', type: 'multiple_choice', questionKey: 'data.tasks.g4r_text3_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4r_text3_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g4r_text3_q3_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4r_text3_q3_c', correct: false }] },`,
  'B g4r-text-l3 t3 ✓описание',
);

worlds = replaceOnce(
  worlds,
  `{ id: 'g4e-quest-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4e_quest2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest2_q1_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4e_quest2_q1_c', correct: false }] },`,
  `{ id: 'g4e-quest-l2-t1', type: 'multiple_choice', questionKey: 'data.tasks.g4e_quest2_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4e_quest2_q1_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4e_quest2_q1_b', correct: false }, { id: 'c', textKey: 'data.tasks.g4e_quest2_q1_c', correct: true }] },`,
  'B g4e-quest-l2 t1 ✓Where',
);

worlds = replaceOnce(
  worlds,
  `{ id: 'g4s-emo-l2-t4', type: 'input', questionKey: 'data.tasks.g4s_emo2_q4', difficulty: 1, answer: "Да, он был рад" },`,
  `{ id: 'g4s-emo-l2-t4', type: 'multiple_choice', questionKey: 'data.tasks.g4s_emo2_q4', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g4s_emo2_q4_a', correct: false }, { id: 'b', textKey: 'data.tasks.g4s_emo2_q4_b', correct: true }, { id: 'c', textKey: 'data.tasks.g4s_emo2_q4_c', correct: false }] },`,
  'B g4s-emo-l2 t4→MC ✓злость',
);

/* D: lab-physics-1 — balance-only rewrite */
worlds = replaceOnce(
  worlds,
  `            tasks: [
              {
                id: 'lab-ph-1-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.q_balance_scale',
                difficulty: 3,
                options: [
                  { id: 'opt-add-weight', textKey: 'data.tasks.opt_add_weight', correct: true },
                  { id: 'opt-remove-weight', textKey: 'data.tasks.opt_remove_weight', correct: false },
                ],
              },
              {
                id: 'lab-ph-1-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.lab_q_triangle_sides',
                difficulty: 2,
                options: [
                  { id: 'opt-2', textKey: 'data.tasks.opt_two', correct: false },
                  { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: true },
                  { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false },
                ],
              },
              { id: 'lab-ph-1-t3', type: 'input', questionKey: 'data.tasks.q_logic_pattern_shapes', difficulty: 3, answer: "Круг" },
              // Montessori
              // ABA
              { id: 'lab-ph-1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_labPhysics_q1', difficulty: 2, options: [{ id: 'opt-2', textKey: 'data.tasks.opt_two', correct: false }, { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: true }, { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false }] },
              { id: 'lab-ph-1-a2', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_labPhysics_q2', difficulty: 2, options: [{ id: 'opt-circle', textKey: 'data.tasks.opt_circle', correct: true }, { id: 'opt-square', textKey: 'data.tasks.opt_square', correct: false }, { id: 'opt-triangle', textKey: 'data.tasks.opt_triangle', correct: false }] },
              // TEACCH
            ],`,
  `            tasks: [
              {
                id: 'lab-ph-1-t1',
                type: 'multiple_choice',
                questionKey: 'data.tasks.q_balance_scale',
                difficulty: 2,
                options: [
                  { id: 'opt-add-weight', textKey: 'data.tasks.opt_add_weight', correct: true },
                  { id: 'opt-remove-weight', textKey: 'data.tasks.opt_remove_weight', correct: false },
                ],
              },
              {
                id: 'lab-ph-1-t2',
                type: 'multiple_choice',
                questionKey: 'data.tasks.lab_ph_q2',
                difficulty: 2,
                options: [
                  { id: 'a', textKey: 'data.tasks.lab_ph_q2_a', correct: false },
                  { id: 'b', textKey: 'data.tasks.lab_ph_q2_b', correct: true },
                  { id: 'c', textKey: 'data.tasks.lab_ph_q2_c', correct: false },
                ],
              },
              { id: 'lab-ph-1-t3', type: 'input', questionKey: 'data.tasks.lab_ph_q3', difficulty: 2, answer: "Равновесие" },
              // Montessori
              // ABA
              { id: 'lab-ph-1-a1', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_labPhysics_q1', difficulty: 2, options: [{ id: 'opt-2', textKey: 'data.tasks.opt_two', correct: true }, { id: 'opt-3', textKey: 'data.tasks.opt_three', correct: false }, { id: 'opt-4', textKey: 'data.tasks.opt_four', correct: false }] },
              { id: 'lab-ph-1-a2', type: 'multiple_choice', audience: 'special_aba', questionKey: 'data.tasks.aba_labPhysics_q2', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.aba_labPhysics_q2_a', correct: true }, { id: 'b', textKey: 'data.tasks.aba_labPhysics_q2_b', correct: false }, { id: 'c', textKey: 'data.tasks.aba_labPhysics_q2_c', correct: false }] },
              // TEACCH
            ],`,
  'D lab-physics-1 balance rewrite',
);

fs.writeFileSync(worldsPath, worlds, 'utf8');

/* B: forest-v-l2 — keep ✓ on c, replace bad word Апельсин → Кит; fix Q + EN/KY */
let rw56 = fs.readFileSync(rw56Path, 'utf8');
// structure already has correct:true on c — texts fixed in locales below
console.log('OK forest-v-l2 structure kept (✓ c); locale texts updated');

/* ========== Locale patches (B+C+D) ========== */
const taskPatches = {
  ru: {
    // forest t4
    nrw_fvl2_t4_q: 'Тали ищет слово без букв О и У. Какое слово подходит?',
    nrw_fvl2_t4_a: 'Осёл',
    nrw_fvl2_t4_b: 'Утка',
    nrw_fvl2_t4_c: 'Кит',
    // lab physics
    lab_ph_q2: 'На правой чаше 3 кубика, на левой — 1. Куда наклонятся весы?',
    lab_ph_q2_a: 'Влево',
    lab_ph_q2_b: 'Вправо',
    lab_ph_q2_c: 'Останутся ровно',
    lab_ph_q3: 'Обе чаши на одном уровне. Как называется это состояние? Напиши одно слово.',
    aba_labPhysics_q1: 'Сколько чаш у весов?',
    aba_labPhysics_q2: 'Левая чаша тяжелее. Куда положить кубик, чтобы выровнять?',
    aba_labPhysics_q2_a: 'На правую чашу',
    aba_labPhysics_q2_b: 'На левую чашу',
    aba_labPhysics_q2_c: 'Убрать обе чаши',
  },
  en: {
    // B g4e
    g4e_quest2_q1:
      'Tali wants to know where his hat is. He wrote “What is my hat?” Spark says: “Not what — try…” Which word fits?',
    g4e_quest2_q1_a: 'What',
    g4e_quest2_q1_b: 'When',
    g4e_quest2_q1_c: 'Where',
    // B g4r EN quote cleanup
    g4r_text3_q3:
      'Tali describes his favorite stone: “It is smooth, grey, warm to the touch, and smells like rain.” What type of text is this?',
    // B forest
    nrw_fvl2_t4_q: 'Tali is looking for a word with no O and no U. Which word fits?',
    nrw_fvl2_t4_a: 'Donkey (Osël)',
    nrw_fvl2_t4_b: 'Duck (Utka)',
    nrw_fvl2_t4_c: 'Whale (Kit)',
    // C g3r-gen-l1
    g3r_masc_question: 'Tali says about the word HOME (ДОМ): “It is HE!” What gender is that?',
    g3r_dom_gender: 'The word TABLE (СТОЛ) — which pronoun does it go with?',
    g3r_drug_gender: 'Tali says: “I am a masculine-gender knight!” Which pronoun is the masculine battle cry?',
    g3r_genl1_fb_sent: 'A table is _ gender.',
    g3r_opt_muzhskoy: 'Masculine',
    g3r_opt_zhenskiy: 'Feminine',
    g3r_opt_sredniy: 'Neuter',
    g3r_opt_on: 'He (он)',
    g3r_opt_ona: 'She (она)',
    g3r_opt_ono: 'It (оно)',
    // C g3r-verb-l2
    g3r_past_question: 'Grandpa talks about yesterday: “I ___ in the forest.” Which verb fits?',
    g3r_which_past: 'Pick the past-tense verb: WILL RUN, RUNS, RAN.',
    g3r_verbl2_q2: 'ЧИТАЛ (read, past) — which tense is it?',
    g3r_verbl2_q1_a: 'Walked (Гулял)',
    g3r_verbl2_q1_b: 'Walk (Гуляю)',
    g3r_verbl2_q1_c: 'Will walk (Погуляю)',
    g3r_verbl2_q3_a: 'Will run (Побежит)',
    g3r_verbl2_q3_b: 'Runs (Бежит)',
    g3r_verbl2_q3_c: 'Ran (Побежал)',
    // C g3r-adj-l1
    g3r_krasny_adj:
      'An artist draws a house. “What kind of house?” — is that a question to the adjective or to the noun?',
    g3r_adj_color_examples: '“___ ball” — adjective RED (КРАСНЫЙ). Which form is needed?',
    g3r_zeleny_dom_adj: '“Tall tree” or “tall tree (wrong ending)”? TREE (ДЕРЕВО) is neuter.',
    g3r_adj_for_masc: '“BEAUTIFUL sunset” or “beautiful sunset (wrong)”? SUNSET (ЗАКАТ) is masculine.',
    g3r_opt_to_adj: 'To the adjective',
    g3r_opt_to_noun: 'To the noun',
    g3r_opt_krasny: 'Red (masc. красный)',
    g3r_opt_krasnaya: 'Red (fem. красная)',
    g3r_opt_krasnoe: 'Red (neut. красное)',
    g3r_adjl1_q3_a: 'Tall tree (neuter -ое)',
    g3r_adjl1_q3_b: 'Tall tree (wrong masc. ending)',
    // C g3w-nat-l1 — sync EN Q+opts to current RU meanings
    g3w_water_cycle_steps:
      'Tali looks at a puddle — it disappeared. That is the first step of the water cycle. What is it called?',
    g3w_clouds_form_from: 'Water vapor rose and cooled. What did it turn into?',
    g3w_rain_comes_from: 'The clouds got heavy. What happens next?',
    g3w_opt_evaporation: 'Evaporation',
    g3w_opt_explosion: 'Freezing',
    g3w_opt_erosion: 'Photosynthesis',
    g3w_opt_water_vapor: 'Into clouds (water droplets)',
    g3w_opt_dust: 'Into dust',
    g3w_opt_smoke: 'Into smoke',
    g3w_opt_clouds: 'Precipitation (rain or snow)',
    g3w_opt_rivers: 'Clouds disappear',
    g3w_opt_sea: 'Clouds turn into land',
    // D lab
    lab_ph_q2: 'The right pan has 3 blocks, the left has 1. Which way will the scale tip?',
    lab_ph_q2_a: 'To the left',
    lab_ph_q2_b: 'To the right',
    lab_ph_q2_c: 'Stay level',
    lab_ph_q3: 'Both pans are at the same height. What is that called? Write one word.',
    aba_labPhysics_q1: 'How many pans does a balance scale have?',
    aba_labPhysics_q2: 'The left pan is heavier. Where should we put a block to balance it?',
    aba_labPhysics_q2_a: 'On the right pan',
    aba_labPhysics_q2_b: 'On the left pan',
    aba_labPhysics_q2_c: 'Remove both pans',
  },
  ky: {
    g4e_quest2_q1:
      'Тали шляпасы кайда экенин билгиси келет. Ал «What is my hat?» деп жазды. Spark: «What эмес…» Кайсы сөз керек?',
    g4e_quest2_q1_a: 'What (эмне)',
    g4e_quest2_q1_b: 'When (качан)',
    g4e_quest2_q1_c: 'Where (кайда)',
    g4r_text3_q3:
      'Тали сүйүктүү ташын сүрөттөйт: «Ал жылмакай, боз, жылуу жана жамгыр жыттанат.» Бул кандай типтеги текст?',
    nrw_fvl2_t4_q: 'Тали О жана У тамгалары жок сөздү издейт. Кайсы сөз туура?',
    nrw_fvl2_t4_a: 'Эшек (Осёл)',
    nrw_fvl2_t4_b: 'Өрдөк (Утка)',
    nrw_fvl2_t4_c: 'Кит',
    g3r_masc_question: 'Тали ҮЙ (ДОМ) сөзү жөнүндө: «Бул АЛ (он)!» Бул кайсы жыныс?',
    g3r_dom_gender: 'СТОЛ сөзү — кайсы ат атооч менен достошот?',
    g3r_drug_gender: 'Тали: «Мен эркек жыныстагы рыцарьмын!» Эркек жыныстын урааны кайсы ат атооч?',
    g3r_genl1_fb_sent: 'Стол — бул _ жыныс.',
    g3r_opt_muzhskoy: 'Эркек',
    g3r_opt_zhenskiy: 'Аял',
    g3r_opt_sredniy: 'Орто',
    g3r_opt_on: 'Ал (он)',
    g3r_opt_ona: 'Ал (она)',
    g3r_opt_ono: 'Ал (оно)',
    g3r_past_question: 'Чоңата кечээ жөнүндө айтат: «Мен токойдо ___». Кайсы этиш?',
    g3r_which_past: 'Өткөн чактагы этишти танда: ПОБЕЖИТ, БЕЖИТ, ПОБЕЖАЛ.',
    g3r_verbl2_q2: 'ЧИТАЛ — бул кайсы чак?',
    g3r_verbl2_q1_a: 'Гулял',
    g3r_verbl2_q1_b: 'Гуляю',
    g3r_verbl2_q1_c: 'Погуляю',
    g3r_verbl2_q3_a: 'Побежит',
    g3r_verbl2_q3_b: 'Бежит',
    g3r_verbl2_q3_c: 'Побежал',
    g3r_krasny_adj: 'Сүрөтчү үй тартат. «Үй кандай?» — бул сын атоочкобы же зат атоочкобу?',
    g3r_adj_color_examples: '«___ шар» — сын атооч КРАСНЫЙ. Кайсы форма керек?',
    g3r_zeleny_dom_adj: '«Бийик дарак» же «бийик дарак (туура эмес)»? ДЕРЕВО — орто жыныс.',
    g3r_adj_for_masc: '«СУЛУУ күн батышы»бы же туура эмес формабы? ЗАКАТ — эркек жыныс.',
    g3r_opt_to_adj: 'Сын атоочко',
    g3r_opt_to_noun: 'Зат атоочко',
    g3r_opt_krasny: 'Кызыл (красный)',
    g3r_opt_krasnaya: 'Кызыл (красная)',
    g3r_opt_krasnoe: 'Кызыл (красное)',
    g3r_adjl1_q3_a: 'Бийик дарак (орто -ое)',
    g3r_adjl1_q3_b: 'Бийик дарак (туура эмес)',
    g3w_water_cycle_steps:
      'Тали көлчүктү карайт — ал жоголду. Бул суу айлануусунун биринчи кадамы. Ал кандай аталат?',
    g3w_clouds_form_from: 'Суу буусу көтөрүлүп муздады. Ал эмнеге айланды?',
    g3w_rain_comes_from: 'Булуттар оорлоду. Андан кийин эмне болот?',
    g3w_opt_evaporation: 'Буулануу',
    g3w_opt_explosion: 'Тоңуу',
    g3w_opt_erosion: 'Фотосинтез',
    g3w_opt_water_vapor: 'Булуттарга (суу тамчылары)',
    g3w_opt_dust: 'Чаңга',
    g3w_opt_smoke: 'Түтүнгө',
    g3w_opt_clouds: 'Жаан-чачын (жамгыр же кар)',
    g3w_opt_rivers: 'Булуттар жоголот',
    g3w_opt_sea: 'Булуттар жерге айланат',
    lab_ph_q2: 'Оң таразада 3 кубик, солдо 1. Тараза кайда кыйшаят?',
    lab_ph_q2_a: 'Солго',
    lab_ph_q2_b: 'Оңго',
    lab_ph_q2_c: 'Тең калат',
    lab_ph_q3: 'Эки табак бир деңгээлде. Бул абал кандай аталат? Бир сөз жаз.',
    aba_labPhysics_q1: 'Таразанын канча табагы бар?',
    aba_labPhysics_q2: 'Сол табак оорураак. Теңдөө үчүн кубикти кайда коёбуз?',
    aba_labPhysics_q2_a: 'Оң табакка',
    aba_labPhysics_q2_b: 'Сол табакка',
    aba_labPhysics_q2_c: 'Эки табакты алып салуу',
  },
};

// Also sync EN for g4s options already OK; KY g4s_emo2_q4 body RU leak in quote — light polish
taskPatches.ky.g4s_emo2_q4 =
  'Тали окуду: «Петя кыйкырып, дептерди ыргытты». Friendly сурайт: «Петя эмне сезди?» Тали: «Ал кубанды!» Бул туурабы?';

for (const [lang, patches] of Object.entries(taskPatches)) {
  const doc = lang === 'ru' ? ru : lang === 'en' ? en : ky;
  for (const [k, v] of Object.entries(patches)) {
    doc.data.tasks[k] = v;
  }
  console.log('OK patched tasks', lang, Object.keys(patches).length);
}

// ABA overrides for new lab keys + forest t4 (mirror main locales)
const abaTaskKeys = [
  'lab_ph_q2',
  'lab_ph_q2_a',
  'lab_ph_q2_b',
  'lab_ph_q2_c',
  'lab_ph_q3',
  'aba_labPhysics_q1',
  'aba_labPhysics_q2',
  'aba_labPhysics_q2_a',
  'aba_labPhysics_q2_b',
  'aba_labPhysics_q2_c',
  'nrw_fvl2_t4_q',
  'nrw_fvl2_t4_a',
  'nrw_fvl2_t4_b',
  'nrw_fvl2_t4_c',
  'g2m_compose_3t_6u',
];
for (const k of abaTaskKeys) {
  const full = `data.tasks.${k}`;
  if (ru.data.tasks[k] != null) abaRu[full] = ru.data.tasks[k];
  if (en.data.tasks[k] != null) abaEn[full] = en.data.tasks[k];
  if (ky.data.tasks[k] != null) abaKy[full] = ky.data.tasks[k];
}
console.log('OK ABA overrides synced for wave2 keys');

save('ru.json', ru);
save('en.json', en);
save('ky.json', ky);
save('abaTextOverrides.generated.json', abaRu);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);

console.log('\nWave 2 content apply done.');
