import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const loc = (f) => path.join(root, 'src/i18n/locales', f);
const same = (v) => ({ ru: v, en: v, ky: v });

const newKeys = {
  // g3w-nat-l2 minerals (replaces hijacked climate-zone keys)
  g3w_min_q1: { ru: 'Уголь, нефть и газ образовались из остатков древних живых существ. Как называются такие полезные ископаемые?', en: 'Coal, oil and gas formed from the remains of ancient living things. What are such minerals called?', ky: 'Көмүр, мунай жана газ байыркы тирүү жандыктардын калдыктарынан пайда болгон. Мындай кен байлыктар кандай аталат?' },
  g3w_min_q2: { ru: 'Для чего добывают и используют нефть?', en: 'What is oil extracted and used for?', ky: 'Мунай эмне үчүн казылып, колдонулат?' },
  g3w_min_q3: { ru: 'Железная руда — полезное ископаемое. Что из неё производят?', en: 'Iron ore is a mineral. What is made from it?', ky: 'Темир кени — кен байлык. Андан эмне жасалат?' },
  g3w_min_q4: { ru: 'Гранит — очень твёрдая горная порода. К каким ископаемым он относится?', en: 'Granite is a very hard rock. What kind of mineral is it?', ky: 'Гранит — абдан катуу тоо тек. Ал кайсы кен байлыкка кирет?' },
  g3w_min_opt_burn: { ru: 'Горючие', en: 'Combustible (fuel)', ky: 'Күйүүчү' },
  g3w_min_opt_metalz: { ru: 'Металлические', en: 'Metallic', ky: 'Металлдык' },
  g3w_min_opt_build: { ru: 'Строительные', en: 'Building materials', ky: 'Курулуш' },
  g3w_min_opt_foodz: { ru: 'Пищевые', en: 'Food', ky: 'Азык-түлүк' },
  g3w_min_opt_fuel_use: { ru: 'Топливо и энергия (бензин, керосин)', en: 'Fuel and energy (petrol, kerosene)', ky: 'Күйүүчү май жана энергия (бензин, керосин)' },
  g3w_min_opt_metal_make: { ru: 'Производство металла', en: 'Metal production', ky: 'Металл өндүрүү' },
  g3w_min_opt_food_make: { ru: 'Приготовление еды', en: 'Cooking food', ky: 'Тамак жасоо' },
  g3w_min_opt_metal_ore: { ru: 'Металл (железо, сталь)', en: 'Metal (iron, steel)', ky: 'Металл (темир, болот)' },
};

// Value-only edits to existing keys
const overrides = {
  ru: {
    meadow_c10l2_1_b: '10 = 5 + 5 = все пальцы на обеих руках! Девять — самое большое однозначное число, а десять — уже двузначное!',
    // g2r-sp-l3 t3 question → single-word adjective task
    g2r_which_is_adj: 'Какое из слов — прилагательное?',
    g2r_opt_koshka: 'Кошка',
    g2r_opt_sidit: 'Сидит',
    g2r_opt_belyi: 'Белый',
    // g2e-sch-l2 align with intro «Math»
    g2e_opt_maths: 'Math',
    // forest-v-l1 t2 reword for coherence (matches KY)
    nrw_fvl1_t2_q: 'Тали пишет маме: «МАМА». Есть ли в этом слове буква А?',
    nrw_fvl1_t2_a: 'Да, и не одна!',
    nrw_fvl1_t2_b: 'Нет',
  },
  en: {
    g2r_opt_koshka: 'cat',
    g2r_opt_sidit: 'sits',
    g2r_opt_belyi: 'white',
    g2e_opt_maths: 'Math',
    nrw_fvl1_t2_a: 'Yes, more than one!',
    nrw_fvl1_t2_b: 'No',
  },
  ky: {
    g2r_opt_koshka: 'Мышык',
    g2r_opt_sidit: 'Отурат',
    g2r_opt_belyi: 'Ак',
    g2e_opt_maths: 'Math',
    nrw_fvl1_t2_a: 'Ооба, бирден көп!',
    nrw_fvl1_t2_b: 'Жок',
  },
};

const worldsEdits = [
  // g1e-num-l1 t3: "как по-английски четыре" → four (a), not five
  ["questionKey: 'data.tasks.g1e_four_plus_one', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_four', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_five', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_six', correct: false }]",
   "questionKey: 'data.tasks.g1e_four_plus_one', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_four', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_five', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_six', correct: false }]"],
  // g3w-nat-l2 t1
  ["{ id: 'g3wnatl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_hottest_zone', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_equatorial', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_temperate', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_polar', correct: false }] }",
   "{ id: 'g3wnatl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g3w_min_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_min_opt_burn', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_min_opt_metalz', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_min_opt_build', correct: false }] }"],
  // g3w-nat-l2 t2 (fix wrong answer: нефть = fuel, not food)
  ["{ id: 'g3wnatl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_coldest_zone', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_equatorial', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_temperate', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_polar', correct: true }] }",
   "{ id: 'g3wnatl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g3w_min_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3w_min_opt_fuel_use', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_min_opt_metal_make', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_min_opt_food_make', correct: false }] }"],
  // g3w-nat-l2 t3
  ["{ id: 'g3wnatl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_russia_zone', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_temperate', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_opt_equatorial', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_opt_polar', correct: false }] }",
   "{ id: 'g3wnatl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g3w_min_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_min_opt_metal_ore', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_min_opt_burn', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_min_opt_foodz', correct: false }] }"],
  // g3w-nat-l2 t4
  ["{ id: 'g3wnatl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_desert_zone', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_opt_equatorial', correct: false }, { id: 'b', textKey: 'data.tasks.g3w_opt_desert_z', correct: true }, { id: 'c', textKey: 'data.tasks.g3w_opt_polar', correct: false }] }",
   "{ id: 'g3wnatl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g3w_min_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3w_min_opt_build', correct: true }, { id: 'b', textKey: 'data.tasks.g3w_min_opt_burn', correct: false }, { id: 'c', textKey: 'data.tasks.g3w_min_opt_foodz', correct: false }] }"],
];

// rw56 correct-flag flips: [textKey, newCorrect]
const rw56Flags = [
  ['nrw_iabcl2_t2_a', false], ['nrw_iabcl2_t2_b', true], // DINOSAUR starts with D → "No"
  ['nrw_gcoll1_t3_a', false], ['nrw_gcoll1_t3_b', true], // frog is green → "No"
];

// ---- apply locales ----
const files = { ru: 'ru.json', en: 'en.json', ky: 'ky.json' };
for (const [lng, file] of Object.entries(files)) {
  const p = loc(file);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  const tasks = json.data.tasks;
  for (const [key, vals] of Object.entries(newKeys)) tasks[key] = vals[lng];
  for (const [key, val] of Object.entries(overrides[lng] || {})) {
    if (!(key in tasks)) console.log('WARN override key missing ' + lng + ': ' + key);
    tasks[key] = val;
  }
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
}

// ABA overrides for the value-changed keys
const abaFiles = { ru: 'abaTextOverrides.generated.json', en: 'abaTextOverrides.en.generated.json', ky: 'abaTextOverrides.ky.generated.json' };
for (const [lng, file] of Object.entries(abaFiles)) {
  const p = loc(file);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const [key, val] of Object.entries(overrides[lng] || {})) {
    const flat = 'data.tasks.' + key;
    if (flat in json) { json[flat] = val; n++; }
  }
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
  console.log('ABA ' + lng + ': updated ' + n);
}

// ---- worlds.ts ----
const wp = path.join(root, 'src/data/worlds.ts');
let src = fs.readFileSync(wp, 'utf8');
let ok = 0, fail = 0;
for (const [oldS, newS] of worldsEdits) {
  const count = src.split(oldS).length - 1;
  if (count !== 1) { console.log('WORLDS FAIL (' + count + '): ' + oldS.slice(0, 80)); fail++; continue; }
  src = src.replace(oldS, newS);
  ok++;
}
fs.writeFileSync(wp, src);
console.log('worlds.ts: ok=' + ok + ' fail=' + fail);

// ---- rw56 correct-flag flips ----
const rp = path.join(root, 'src/data/rw56LessonTasks.ts');
let rsrc = fs.readFileSync(rp, 'utf8');
let rok = 0, rfail = 0;
for (const [key, newVal] of rw56Flags) {
  const re = new RegExp('("textKey":\\s*"data\\.tasks\\.' + key + '",\\s*"correct":\\s*)(true|false)');
  const m = rsrc.match(re);
  if (!m) { console.log('RW56 FAIL not found: ' + key); rfail++; continue; }
  rsrc = rsrc.replace(re, '$1' + newVal);
  rok++;
}
fs.writeFileSync(rp, rsrc);
console.log('rw56: ok=' + rok + ' fail=' + rfail);
