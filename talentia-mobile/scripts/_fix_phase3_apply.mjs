import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const loc = (f) => path.join(root, 'src/i18n/locales', f);
const same = (v) => ({ ru: v, en: v, ky: v });

const newKeys = {
  // g2e-phr-l1 rebuilt as coherent polite-phrases lesson (all locales)
  g2e_phrl1_q1: { ru: '«Thank you» по-русски:', en: '"Thank you" in Russian:', ky: '«Thank you» орусча кандай?' },
  g2e_phrl1_q2: { ru: '«Please» по-русски:', en: '"Please" in Russian:', ky: '«Please» орусча кандай?' },
  g2e_phrl1_q3: { ru: 'Поли сделал Тали подарок. Тали говорит «Thank you!» Поли отвечает:', en: 'Poli gave Tali a gift. Tali says "Thank you!" Poli replies:', ky: 'Поли Талиге белек берди. Тали «Thank you!» дейт. Поли жооп берет:' },
  g2e_phrl1_q4: { ru: '«Thank you very much» означает:', en: '"Thank you very much" means:', ky: '«Thank you very much» дегени:' },
  g2e_phrl1_opt_spasibo: same('Спасибо'),
  g2e_phrl1_opt_pozh: same('Пожалуйста'),
  g2e_phrl1_opt_privet: same('Привет'),
  g2e_phrl1_opt_posvid: same('До свидания'),
  g2e_phrl1_opt_bolshoe: same('Большое спасибо'),
  g2e_phrl1_opt_malenkoe: same('Маленькое спасибо'),
  g2e_phrl1_opt_welcome: same("You're welcome!"),
  g2e_phrl1_opt_please: same('Please!'),
  g2e_phrl1_opt_goodbye: same('Goodbye!'),
};

const overrides = {
  ru: { g2e_opt_monday: 'Monday' },
  en: { g2e_opt_monday: 'Monday' },
  ky: { g2e_opt_monday: 'Дүйшөмбү' },
};

const worldsEdits = [
  ["{ id: 'g2ephrl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_i_am_blank_student', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: false }] }",
   "{ id: 'g2ephrl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phrl1_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phrl1_opt_spasibo', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phrl1_opt_pozh', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phrl1_opt_privet', correct: false }] }"],
  ["{ id: 'g2ephrl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_you_are_blank', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: true }] }",
   "{ id: 'g2ephrl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phrl1_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phrl1_opt_spasibo', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_phrl1_opt_pozh', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_phrl1_opt_posvid', correct: false }] }"],
  ["{ id: 'g2ephrl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_i_am_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_ya_yavlyayus', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_on_yavlyaetsya', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_my_yavlyaemsya', correct: false }] }",
   "{ id: 'g2ephrl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phrl1_q3', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_phrl1_opt_welcome', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phrl1_opt_please', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phrl1_opt_goodbye', correct: false }] }"],
  ["{ id: 'g2ephrl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_we_blank_friends', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_am', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_is', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_are', correct: true }] }",
   "{ id: 'g2ephrl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_phrl1_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_phrl1_opt_bolshoe', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_phrl1_opt_malenkoe', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_phrl1_opt_pozh', correct: false }] }"],
];

const files = { ru: 'ru.json', en: 'en.json', ky: 'ky.json' };
for (const [lng, file] of Object.entries(files)) {
  const p = loc(file);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  const tasks = json.data.tasks;
  for (const [key, vals] of Object.entries(newKeys)) tasks[key] = vals[lng];
  for (const [key, val] of Object.entries(overrides[lng] || {})) tasks[key] = val;
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
}

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

const wp = path.join(root, 'src/data/worlds.ts');
let src = fs.readFileSync(wp, 'utf8');
let ok = 0, fail = 0;
for (const [oldS, newS] of worldsEdits) {
  const count = src.split(oldS).length - 1;
  if (count !== 1) { console.log('WORLDS FAIL (' + count + '): ' + oldS.slice(0, 70)); fail++; continue; }
  src = src.replace(oldS, newS);
  ok++;
}
fs.writeFileSync(wp, src);
console.log('worlds.ts: ok=' + ok + ' fail=' + fail);
