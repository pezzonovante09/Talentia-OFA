/**
 * Spot fix g4e-quest-l2: sync EN/KY stems+options under RU (Why/bike, Where/bag, Who/friend).
 * Input answer stays "Why".
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

const en = load('en.json');
const ky = load('ky.json');
const abaEn = load('abaTextOverrides.en.generated.json');
const abaKy = load('abaTextOverrides.ky.generated.json');

const enTasks = {
  g4e_quest2_q2: '“___ is your best friend?” — you want the person’s name. Which word?',
  g4e_quest2_q2_a: 'Who',
  g4e_quest2_q2_b: 'Where',
  g4e_quest2_q2_c: 'What',
  g4e_quest2_q3: 'You’re looking for Tali’s bag. “___ is my bag?” (Who / Where / Why)',
  g4e_quest2_q3_a: 'What',
  g4e_quest2_q3_b: 'Who',
  g4e_quest2_q3_c: 'Where',
  g4e_quest2_q4: '“___ do you come to school by bike?” — you want the reason. Write the question word.',
  // orphan MC option keys kept consistent if referenced elsewhere
  g4e_quest2_q4_a: 'Who',
  g4e_quest2_q4_b: 'Why',
  g4e_quest2_q4_c: 'What',
};

const kyTasks = {
  g4e_quest2_q2: '«___ is your best friend?» — адамдын атын билгиң келет. Кайсы сөз?',
  g4e_quest2_q2_a: 'Who',
  g4e_quest2_q2_b: 'Where',
  g4e_quest2_q2_c: 'What',
  g4e_quest2_q3: 'Талинин рюкзагын издеп жатасың. «___ is my bag?» (Who / Where / Why)',
  g4e_quest2_q3_a: 'What',
  g4e_quest2_q3_b: 'Who',
  g4e_quest2_q3_c: 'Where',
  g4e_quest2_q4: '«___ do you come to school by bike?» — себебин билгиң келет. Суроо сөзүн жаз.',
  g4e_quest2_q4_a: 'Who',
  g4e_quest2_q4_b: 'Why',
  g4e_quest2_q4_c: 'What',
};

Object.assign(en.data.tasks, enTasks);
Object.assign(ky.data.tasks, kyTasks);

for (const [k, v] of Object.entries(enTasks)) {
  abaEn[`data.tasks.${k}`] = v;
}
for (const [k, v] of Object.entries(kyTasks)) {
  abaKy[`data.tasks.${k}`] = v;
}

save('en.json', en);
save('ky.json', ky);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);

console.log('OK g4e-quest-l2 EN/KY synced under RU; answer remains Why');
