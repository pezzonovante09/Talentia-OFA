/** Polish conj/meadow fill_blank after wave3 apply. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const worldsPath = path.join(root, 'src/data/worlds.ts');
let worlds = fs.readFileSync(worldsPath, 'utf8');

const old = `{ id: 'g4r-conj-l1-t3', type: 'fill_blank', questionKey: 'data.tasks.g4r_conj_l1_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g4r_conj_l1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g4r_conj_q3_a', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g4r_conj_q3_b', correct: true }, { id: 'fb-c', textKey: 'data.tasks.g4r_conj_q3_c', correct: false }] }`;
const neu = `{ id: 'g4r-conj-l1-t3', type: 'fill_blank', questionKey: 'data.tasks.g4r_conj_l1_fb_sent', difficulty: 2, sentenceKey: 'data.tasks.g4r_conj_l1_fb_sent', options: [{ id: 'fb-a', textKey: 'data.tasks.g4r_conj_l1_fb_a', correct: false }, { id: 'fb-b', textKey: 'data.tasks.g4r_conj_l1_fb_b', correct: true }, { id: 'fb-c', textKey: 'data.tasks.g4r_conj_l1_fb_c', correct: false }] }`;

if (!worlds.includes(old)) {
  console.error('MISSING conj t3 block');
  process.exit(1);
}
worlds = worlds.replace(old, neu);
fs.writeFileSync(worldsPath, worlds, 'utf8');
console.log('OK conj t3 short options');

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

Object.assign(ru.data.tasks, {
  g4r_conj_l1_fb_sent: 'В «Мальчик идёт по улице» глагол «идёт» стоит в _ лице.',
  g4r_conj_l1_fb_a: 'втором',
  g4r_conj_l1_fb_b: 'третьем',
  g4r_conj_l1_fb_c: 'первом',
  mc5l3_fb_sent: 'На полянке 3 котёнка и 3 щенка. Значит _',
});
Object.assign(en.data.tasks, {
  g4r_conj_l1_fb_sent: 'In “Мальчик идёт по улице”, the verb «идёт» is in the _ person.',
  g4r_conj_l1_fb_a: 'second',
  g4r_conj_l1_fb_b: 'third',
  g4r_conj_l1_fb_c: 'first',
  mc5l3_fb_sent: 'There are 3 kittens and 3 puppies. So they are _',
});
Object.assign(ky.data.tasks, {
  g4r_conj_l1_fb_sent: '«Мальчик идёт по улице» сүйлөмүндө «идёт» _ жакта.',
  g4r_conj_l1_fb_a: 'экинчи',
  g4r_conj_l1_fb_b: 'үчүнчү',
  g4r_conj_l1_fb_c: 'биринчи',
  mc5l3_fb_sent: 'Жайлоодо 3 мышык баласы жана 3 ит бала. Демек алар _',
});

for (const k of [
  'g4r_conj_l1_fb_sent',
  'g4r_conj_l1_fb_a',
  'g4r_conj_l1_fb_b',
  'g4r_conj_l1_fb_c',
  'mc5l3_fb_sent',
]) {
  abaRu[`data.tasks.${k}`] = ru.data.tasks[k];
  abaEn[`data.tasks.${k}`] = en.data.tasks[k];
  abaKy[`data.tasks.${k}`] = ky.data.tasks[k];
}

save('ru.json', ru);
save('en.json', en);
save('ky.json', ky);
save('abaTextOverrides.generated.json', abaRu);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);
console.log('OK locales polished');
