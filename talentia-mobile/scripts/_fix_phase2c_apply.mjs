// Phase 2 batch C: g3r gen/verb/adj — restore pools, mint dedicated keys, fix flags.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const loc = (f) => path.join(root, 'src/i18n/locales', f);

const same = (v) => ({ ru: v, en: v, ky: v });

const newKeys = {
  g3r_genl1_q3_a: same('Кошка'),
  g3r_genl1_q3_b: same('Друг'),
  g3r_genl1_q3_c: same('Книга'),
  g3r_genl2_q3_a: same('Молоко'),
  g3r_genl2_q3_b: same('Кошка'),
  g3r_genl2_q3_c: same('Стол'),
  g3r_genl3_q1_a: same('Высокий дом'),
  g3r_genl3_q1_b: same('Высокая дом'),
  g3r_genl3_q1_c: same('Высокое дом'),
  g3r_genl3_q2_a: same('Синяя птица'),
  g3r_genl3_q2_b: same('Синий птица'),
  g3r_genl3_q2_c: same('Синее птица'),
  g3r_genl3_q3_a: { ru: 'Потому что МОЛОКО — среднего рода', en: 'Потому что МОЛОКО — среднего рода', ky: 'Себеби МОЛОКО — орто роддо' },
  g3r_genl3_q3_b: { ru: 'Потому что МОЛОКО — мужского рода', en: 'Потому что МОЛОКО — мужского рода', ky: 'Себеби МОЛОКО — эркек роддо' },
  g3r_genl3_q3_c: { ru: 'Просто так красивее', en: 'Просто так красивее', ky: 'Жөн гана кооз угулат' },
  g3r_genl3_q4_a: same('Интересный'),
  g3r_genl3_q4_b: same('Интересная'),
  g3r_genl3_q4_c: same('Интересное'),
  g3r_verbl2_q1_a: same('Гулял'),
  g3r_verbl2_q1_b: same('Гуляю'),
  g3r_verbl2_q1_c: same('Погуляю'),
  g3r_verbl2_q3_a: same('Побежит'),
  g3r_verbl2_q3_b: same('Бежит'),
  g3r_verbl2_q3_c: same('Побежал'),
  g3r_verbl3_q1_a: same('Полечу'),
  g3r_verbl3_q1_b: same('Полетишь'),
  g3r_verbl3_q1_c: same('Полетит'),
  g3r_verbl3_q2_a: { ru: '1-е лицо (я)', en: '1-е лицо (я)', ky: '1-жак (я)' },
  g3r_verbl3_q2_b: { ru: '2-е лицо (ты)', en: '2-е лицо (ты)', ky: '2-жак (ты)' },
  g3r_verbl3_q2_c: { ru: '3-е лицо (он)', en: '3-е лицо (он)', ky: '3-жак (он)' },
  g3r_adjl1_q3_a: { ru: 'Высокое дерево (ср.р. — «-ое»)', en: 'Высокое дерево (ср.р. — «-ое»)', ky: 'Высокое дерево (орто род — «-ое»)' },
  g3r_adjl1_q3_b: same('Высокий дерево'),
  g3r_adjl1_q4_a: same('Красивый закат'),
  g3r_adjl1_q4_b: same('Красивое закат'),
  g3r_adjl1_q4_c: same('Красивая закат'),
  g3r_adjl2_q2_a: same('Быстрее'),
  g3r_adjl2_q2_b: same('Самый быстрый'),
  g3r_adjl2_q2_c: same('Быстрейший'),
  g3r_adjl2_q4_a: same('Медленнее'),
  g3r_adjl2_q4_b: same('Самая медленная'),
  g3r_adjl2_q4_c: same('Медленный'),
  g3r_adjl3_q1_a: same('Грустный'),
  g3r_adjl3_q1_b: same('Радостный'),
  g3r_adjl3_q1_c: same('Смешной'),
  g3r_adjl3_q2_a: same('Холодный'),
  g3r_adjl3_q2_b: same('Горячий'),
  g3r_adjl3_q2_c: same('Мягкий'),
  g3r_adjl3_q3_a: same('Высокий – длинный'),
  g3r_adjl3_q3_b: same('Широкий – узкий'),
  g3r_adjl3_q3_c: same('Старый – взрослый'),
};

const restores = {
  g3r_opt_on: same('Он'),
  g3r_opt_ona: same('Она'),
  g3r_opt_ono: same('Оно'),
  g3r_opt_muzhskoy: same('Мужской'),
  g3r_opt_zhenskiy: same('Женский'),
  g3r_opt_sredniy: same('Средний'),
  g3r_opt_chto_delal: same('Что делал?'),
  g3r_opt_chto_delaet: same('Что делает?'),
  g3r_opt_chto_budet: same('Что будет делать?'),
  g3r_opt_chital: same('Читал'),
  g3r_opt_chitaet: same('Читает'),
  g3r_opt_budet_chitat: same('Будет читать'),
  g3r_opt_krasny: same('Красный'),
  g3r_opt_krasnaya: same('Красная'),
  g3r_opt_krasnoe: same('Красное'),
  g3r_opt_sinil_belyj: same('Синий, белый'),
  g3r_opt_idet_sidit: same('Идёт, сидит'),
  g3r_opt_stol_kniga: same('Стол, книга'),
  g3r_opt_zeleny: same('Зелёный'),
  g3r_opt_dom: same('Дом'),
  g3r_opt_bolshoy_maliy: same('Большой, маленький'),
  g3r_opt_idet_bezhit: same('Идёт, бежит'),
  g3r_opt_dom_shkola: same('Дом, школа'),
};

const o = (k, c) => `{ id: '${'abc'[o.i++]}', textKey: 'data.tasks.${k}', correct: ${c} }`;
function opts(...pairs) {
  o.i = 0;
  return '[' + pairs.map(([k, c]) => o(k, c)).join(', ') + ']';
}

const worldsEdits = [
  // gen-l1 t1: какой род? → мужской✓
  ["questionKey: 'data.tasks.g3r_masc_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_on', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_ona', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_ono', correct: false }]",
   "questionKey: 'data.tasks.g3r_masc_question', difficulty: 1, options: " + opts(['g3r_opt_muzhskoy', true], ['g3r_opt_zhenskiy', false], ['g3r_opt_sredniy', false])],
  // gen-l1 t2: СТОЛ — местоимение → он✓
  ["questionKey: 'data.tasks.g3r_dom_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }]",
   "questionKey: 'data.tasks.g3r_dom_gender', difficulty: 1, options: " + opts(['g3r_opt_on', true], ['g3r_opt_ona', false], ['g3r_opt_ono', false])],
  // gen-l1 t3: слово мужского рода → Друг✓ (b)
  ["questionKey: 'data.tasks.g3r_stol_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }]",
   "questionKey: 'data.tasks.g3r_stol_gender', difficulty: 1, options: " + opts(['g3r_genl1_q3_a', false], ['g3r_genl1_q3_b', true], ['g3r_genl1_q3_c', false])],
  // gen-l1 t4: боевой клич мужского рода → Он✓
  ["questionKey: 'data.tasks.g3r_drug_gender', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }]",
   "questionKey: 'data.tasks.g3r_drug_gender', difficulty: 2, options: " + opts(['g3r_opt_on', true], ['g3r_opt_ona', false], ['g3r_opt_ono', false])],
  // gen-l2 t1: ОКНО — какой род → Средний✓
  ["questionKey: 'data.tasks.g3r_fem_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_on', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_ona', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_ono', correct: false }]",
   "questionKey: 'data.tasks.g3r_fem_question', difficulty: 1, options: " + opts(['g3r_opt_muzhskoy', false], ['g3r_opt_zhenskiy', false], ['g3r_opt_sredniy', true])],
  // gen-l2 t2: СОЛНЦЕ «___ моё» → Оно✓
  ["questionKey: 'data.tasks.g3r_koshka_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }]",
   "questionKey: 'data.tasks.g3r_koshka_gender', difficulty: 1, options: " + opts(['g3r_opt_on', false], ['g3r_opt_ona', false], ['g3r_opt_ono', true])],
  // gen-l2 t3: слово среднего рода → Молоко✓
  ["questionKey: 'data.tasks.g3r_kniga_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }]",
   "questionKey: 'data.tasks.g3r_kniga_gender', difficulty: 1, options: " + opts(['g3r_genl2_q3_a', true], ['g3r_genl2_q3_b', false], ['g3r_genl2_q3_c', false])],
  // gen-l2 t4: ПОЛЕ, НЕБО, ДЕРЕВО → Оно✓
  ["questionKey: 'data.tasks.g3r_devochka_gender', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: false }]",
   "questionKey: 'data.tasks.g3r_devochka_gender', difficulty: 2, options: " + opts(['g3r_opt_on', false], ['g3r_opt_ona', false], ['g3r_opt_ono', true])],
  // gen-l3 t1: ДОМ → Высокий дом✓
  ["questionKey: 'data.tasks.g3r_neut_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_on', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_ona', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_ono', correct: true }]",
   "questionKey: 'data.tasks.g3r_neut_question', difficulty: 1, options: " + opts(['g3r_genl3_q1_a', true], ['g3r_genl3_q1_b', false], ['g3r_genl3_q1_c', false])],
  // gen-l3 t2: ПТИЦА ж.р. → Синяя птица✓
  ["questionKey: 'data.tasks.g3r_okno_gender', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: true }]",
   "questionKey: 'data.tasks.g3r_okno_gender', difficulty: 1, options: " + opts(['g3r_genl3_q2_a', true], ['g3r_genl3_q2_b', false], ['g3r_genl3_q2_c', false])],
  // gen-l3 t3: ТЁПЛОЕ молоко почему → среднего рода✓
  ["questionKey: 'data.tasks.g3r_solnce_gender', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: true }]",
   "questionKey: 'data.tasks.g3r_solnce_gender', difficulty: 2, options: " + opts(['g3r_genl3_q3_a', true], ['g3r_genl3_q3_b', false], ['g3r_genl3_q3_c', false])],
  // gen-l3 t4: КНИГА → Интересная✓
  ["questionKey: 'data.tasks.g3r_moloko_gender', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_muzhskoy', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_zhenskiy', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_sredniy', correct: true }]",
   "questionKey: 'data.tasks.g3r_moloko_gender', difficulty: 2, options: " + opts(['g3r_genl3_q4_a', false], ['g3r_genl3_q4_b', true], ['g3r_genl3_q4_c', false])],
  // verb-l2 t1: Я ___ в лесу (вчера) → Гулял✓
  ["questionKey: 'data.tasks.g3r_past_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_chto_delal', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_chto_delaet', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_chto_budet', correct: false }]",
   "questionKey: 'data.tasks.g3r_past_question', difficulty: 1, options: " + opts(['g3r_verbl2_q1_a', true], ['g3r_verbl2_q1_b', false], ['g3r_verbl2_q1_c', false])],
  // verb-l2 t3: глагол в прошедшем → Побежал✓
  ["questionKey: 'data.tasks.g3r_which_past', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_chitaet', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_chital', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_budet_chitat', correct: false }]",
   "questionKey: 'data.tasks.g3r_which_past', difficulty: 2, options: " + opts(['g3r_verbl2_q3_a', false], ['g3r_verbl2_q3_b', false], ['g3r_verbl2_q3_c', true])],
  // verb-l3 t1: Я ___ в космос (1-е лицо, будущее) → Полечу✓
  ["questionKey: 'data.tasks.g3r_future_question', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_chto_delal', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_chto_delaet', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_chto_budet', correct: true }]",
   "questionKey: 'data.tasks.g3r_future_question', difficulty: 1, options: " + opts(['g3r_verbl3_q1_a', true], ['g3r_verbl3_q1_b', false], ['g3r_verbl3_q1_c', false])],
  // verb-l3 t2: «читаю» — какое лицо → 1-е✓ (was ✓ on 3-е)
  ["questionKey: 'data.tasks.g3r_which_future', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_chital', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_chitaet', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_budet_chitat', correct: true }]",
   "questionKey: 'data.tasks.g3r_which_future', difficulty: 1, options: " + opts(['g3r_verbl3_q2_a', true], ['g3r_verbl3_q2_b', false], ['g3r_verbl3_q2_c', false])],
  // adj-l1 t2: форма КРАСНЫЙ для «шар» → Красный✓ (restored pool fits)
  ["questionKey: 'data.tasks.g3r_adj_color_examples', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_sinil_belyj', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_idet_sidit', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_stol_kniga', correct: false }]",
   "questionKey: 'data.tasks.g3r_adj_color_examples', difficulty: 1, options: " + opts(['g3r_opt_krasny', true], ['g3r_opt_krasnaya', false], ['g3r_opt_krasnoe', false])],
  // adj-l1 t3: высокое дерево✓
  ["questionKey: 'data.tasks.g3r_zeleny_dom_adj', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_zeleny', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_dom', correct: false }]",
   "questionKey: 'data.tasks.g3r_zeleny_dom_adj', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_adjl1_q3_a', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_adjl1_q3_b', correct: false }]"],
  // adj-l1 t4: КРАСИВЫЙ закат✓
  ["questionKey: 'data.tasks.g3r_adj_for_masc', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_krasny', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_krasnaya', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_krasnoe', correct: false }]",
   "questionKey: 'data.tasks.g3r_adj_for_masc', difficulty: 2, options: " + opts(['g3r_adjl1_q4_a', true], ['g3r_adjl1_q4_b', false], ['g3r_adjl1_q4_c', false])],
  // adj-l2 t2: сравнительная от БЫСТРЫЙ → Быстрее✓ (пул восстановлен на «большой, маленький» и т.п., перевести на смысловые)
  ["options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_bolshoy_maliy', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_idet_bezhit', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_dom_shkola', correct: false }]",
   "options: " + opts(['g3r_adjl2_q2_a', true], ['g3r_adjl2_q2_b', false], ['g3r_adjl2_q2_c', false])],
  // adj-l2 t4: улитка ___ черепахи → Медленнее✓
  ["questionKey: 'data.tasks.g3r_adj_for_fem', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_krasny', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_krasnaya', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_krasnoe', correct: false }]",
   "questionKey: 'data.tasks.g3r_adj_for_fem', difficulty: 2, options: " + opts(['g3r_adjl2_q4_a', true], ['g3r_adjl2_q4_b', false], ['g3r_adjl2_q4_c', false])],
  // adj-l3 t1: антоним ВЕСЁЛЫЙ → Грустный✓
  ["questionKey: 'data.tasks.g3r_krasny_for_stol', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_krasny', correct: true }, { id: 'b', textKey: 'data.tasks.g3r_opt_krasnaya', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_krasnoe', correct: false }]",
   "questionKey: 'data.tasks.g3r_krasny_for_stol', difficulty: 1, options: " + opts(['g3r_adjl3_q1_a', true], ['g3r_adjl3_q1_b', false], ['g3r_adjl3_q1_c', false])],
  // adj-l3 t2: антоним ТЁПЛЫЙ → Холодный✓
  ["questionKey: 'data.tasks.g3r_krasnoe_for_okno', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_krasny', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_krasnaya', correct: false }, { id: 'c', textKey: 'data.tasks.g3r_opt_krasnoe', correct: true }]",
   "questionKey: 'data.tasks.g3r_krasnoe_for_okno', difficulty: 1, options: " + opts(['g3r_adjl3_q2_a', true], ['g3r_adjl3_q2_b', false], ['g3r_adjl3_q2_c', false])],
  // adj-l3 t3: настоящая пара антонимов → Широкий–узкий✓
  ["questionKey: 'data.tasks.g3r_krasnaya_for_kniga', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3r_opt_krasny', correct: false }, { id: 'b', textKey: 'data.tasks.g3r_opt_krasnaya', correct: true }, { id: 'c', textKey: 'data.tasks.g3r_opt_krasnoe', correct: false }]",
   "questionKey: 'data.tasks.g3r_krasnaya_for_kniga', difficulty: 2, options: " + opts(['g3r_adjl3_q3_a', false], ['g3r_adjl3_q3_b', true], ['g3r_adjl3_q3_c', false])],
];

const files = { ru: 'ru.json', en: 'en.json', ky: 'ky.json' };
for (const [lng, file] of Object.entries(files)) {
  const p = loc(file);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  const tasks = json.data.tasks;
  for (const [key, vals] of Object.entries(newKeys)) tasks[key] = vals[lng];
  for (const [key, vals] of Object.entries(restores)) {
    if (!(key in tasks)) console.log('WARN restore key missing in ' + lng + ': ' + key);
    tasks[key] = vals[lng];
  }
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
}

const abaFiles = { ru: 'abaTextOverrides.generated.json', en: 'abaTextOverrides.en.generated.json', ky: 'abaTextOverrides.ky.generated.json' };
for (const [lng, file] of Object.entries(abaFiles)) {
  const p = loc(file);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  let n = 0;
  for (const [key, vals] of Object.entries(restores)) {
    const flat = 'data.tasks.' + key;
    if (flat in json) { json[flat] = vals[lng]; n++; }
  }
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
  console.log('ABA ' + lng + ': restored ' + n);
}

const wp = path.join(root, 'src/data/worlds.ts');
let src = fs.readFileSync(wp, 'utf8');
let ok = 0, fail = 0;
for (const [oldS, newS] of worldsEdits) {
  const count = src.split(oldS).length - 1;
  if (count !== 1) { console.log('EDIT FAIL (found ' + count + '): ' + oldS.slice(0, 110).replace(/\n/g, '\\n')); fail++; continue; }
  src = src.replace(oldS, newS);
  ok++;
}
fs.writeFileSync(wp, src);
console.log('worlds.ts edits: ok=' + ok + ' fail=' + fail);
