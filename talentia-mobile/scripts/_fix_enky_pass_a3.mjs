/**
 * Scope A pass 3: leftover math/speech question stems.
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

function set(sec, lang, key, value) {
  const doc = lang === 'en' ? en : ky;
  if (doc.data[sec][key] === value) return;
  doc.data[sec][key] = value;
  touched[sec].add(key);
}
const setTask = (lang, key, value) => set('tasks', lang, key, value);

const enTasks = {
  g2m_10x7:
    'Archie flew over a field and counted 7 haystacks. In each stack there are exactly 10 mice. How many mice in total?',
  g2m_10x5:
    'Tali wants exactly 50 shells for his collection. He already found 5 boxes of 10. Is that enough? 10 × 5 = ?',
  g2m_how_many_tens_in_100:
    'Archie brags: “A hundred is five tens!” Tali says: “No, ten!” Who is right?',
  g3m_5hundreds: 'In the warehouse there are 5 boxes with 100 items each. How many items in total?',
  g3m_100x7:
    'Tali found a wizard who multiplies everything by 7. He took 100 and started casting: 100 × 7 = ?',
  g3m_how_hundreds_in_1000:
    'Tali saved coins in stacks of 100. When he reached a thousand, how many stacks did he count?',
  g2r_which_is_verb: 'Which word from the list is a verb?',
  g2r_verb_changes_time:
    'Tali asks: “Does a verb change by tense — was, is, will be?” Is that true?',
  g2r_which_is_adj: 'Which of these words is an adjective?',
  g2r_adj_describes: 'An adjective describes a feature of what?',
  g2r_opt_koshka: 'Кошка',
  g2r_opt_sidit: 'Сидит',
  g2r_opt_belyi: 'Белый',
  g2r_opt_krasivyi: 'Красивый',
};

const kyTasks = {
  g2m_10x7:
    'Арчи талаанын үстүнөн учуп, 7 чөп дөбөсүн санады. Ар бир дөбөдө так 10 чычкан бар. Жалпы канча чычкан?',
  g2m_10x5:
    'Тали коллекциясына так 50 кабыкча чогулткусу келет. Ал мурунтан 10дон турган 5 куту тапты. Жетиштүүбү? 10 × 5 = ?',
  g2m_how_many_tens_in_100:
    'Арчи мактанат: «Жүз — бул беш ондук!» Тали: «Жок, он!» дейт. Ким туура?',
  g3m_5hundreds: 'Кампада 5 ящик бар, ар биринде 100 буюм. Жалпы канча буюм?',
  g3m_100x7:
    'Тали баарын 7ге көбөйтүүчү сыйкырчыны тапты. Ал 100дү алып сыйкырлай баштады: 100 × 7 = ?',
  g3m_how_hundreds_in_1000:
    'Тали тыйындарды 100дөн топтоп чогулткан. Миңге жеткенде канча топ санады?',
  g2r_which_is_verb: 'Тизмедеги кайсы сөз — этиш?',
  g2r_verb_changes_time:
    'Тали сурайт: «Этиш мезгил боюнча өзгөрөбү — болгон, бар, болот?» Бул чынбы?',
  g2r_which_is_adj: 'Кайсы сөз — сын атооч?',
  g2r_adj_describes: 'Сын атооч эмненин белгисин сүрөттөйт?',
  // Russian wordform targets stay as Russian tokens
  g2r_opt_koshka: 'Кошка',
  g2r_opt_sidit: 'Сидит',
  g2r_opt_belyi: 'Белый',
  g2r_opt_krasivyi: 'Красивый',
};

for (const [k, v] of Object.entries(enTasks)) {
  if (ru.data.tasks[k] == null) {
    console.warn('missing RU', k);
    continue;
  }
  setTask('en', k, v);
}
for (const [k, v] of Object.entries(kyTasks)) {
  if (ru.data.tasks[k] == null) {
    console.warn('missing RU', k);
    continue;
  }
  setTask('ky', k, v);
}

function syncAba() {
  for (const k of touched.tasks) {
    const full = `data.tasks.${k}`;
    if (ru.data.tasks[k] != null) abaRu[full] = ru.data.tasks[k];
    if (en.data.tasks[k] != null) abaEn[full] = en.data.tasks[k];
    if (ky.data.tasks[k] != null) abaKy[full] = ky.data.tasks[k];
  }
}

syncAba();
save('en.json', en);
save('ky.json', ky);
save('abaTextOverrides.generated.json', abaRu);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);
console.log('OK pass3', touched.tasks.size);
