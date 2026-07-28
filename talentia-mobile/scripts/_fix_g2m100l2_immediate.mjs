import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');

const text = {
  ru: ru.data.tasks.g2m_25_after,
  en: 'Tali sorted his pebbles: 3 tens in one pile, 6 ones in another. What number did he get?',
  ky: 'Тали таштарды бөлдү: бир үймөктө 3 ондук, экинчисинде 6 бирдик. Кандай сан чыкты?',
};
ru.data.tasks.g2m_compose_3t_6u = text.ru;
en.data.tasks.g2m_compose_3t_6u = text.en;
ky.data.tasks.g2m_compose_3t_6u = text.ky;

fs.writeFileSync(path.join(root, 'src/i18n/locales/ru.json'), JSON.stringify(ru, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'src/i18n/locales/en.json'), JSON.stringify(en, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'src/i18n/locales/ky.json'), JSON.stringify(ky, null, 2) + '\n');

console.log('OK compose key');
console.log(
  'worlds',
  worlds.includes("g2m_compose_3t_6u") && worlds.includes("answer: '36'"),
);

function t(doc, k) {
  const parts = k.replace(/^data\./, '').split('.');
  let cur = doc.data;
  for (const x of parts) cur = cur?.[x];
  return cur || '';
}

function showTask(label, snippet) {
  console.log('\n---', label, '---');
  const q = /questionKey: '([^']+)'/.exec(snippet)?.[1];
  const ans = /answer: '([^']*)'|answer: "([^"]*)"/.exec(snippet);
  console.log('Q RU:', t(ru, q));
  console.log('Q EN:', t(en, q));
  if (ans) console.log('answer:', ans[1] ?? ans[2]);
  for (const m of snippet.matchAll(/textKey: '([^']+)', correct: (true|false)/g)) {
    console.log(`${m[2] === 'true' ? '✓' : '·'} ${t(ru, m[1])} | EN: ${t(en, m[1])}`);
  }
}

const checks = [
  ['g4r-text-l3-t3', /\{ id: 'g4r-text-l3-t3'[\s\S]*?\},/],
  ['g4e-quest-l2-t1', /\{ id: 'g4e-quest-l2-t1'[\s\S]*?\},/],
  ['g4s-emo-l2-t4', /\{ id: 'g4s-emo-l2-t4'[\s\S]*?\},/],
  ['lab-ph-1-t1', /\{[\s\S]*?id: 'lab-ph-1-t1'[\s\S]*?\},/],
  ['lab-ph-1-t2', /\{[\s\S]*?id: 'lab-ph-1-t2'[\s\S]*?\},/],
];
for (const [lab, re] of checks) {
  const m = worlds.match(re);
  if (!m) {
    console.log('MISSING', lab);
    continue;
  }
  showTask(lab, m[0]);
}

// g3r key ownership vs EN
const g3 = [
  ['g3r-gen-l1', ['g3r_dom_gender', 'g3r_drug_gender', 'g3r_genl1_fb_sent']],
  ['g3r-verb-l2', ['g3r_past_question', 'g3r_which_past', 'g3r_verbl2_q2', 'g3r_verbl2_q4']],
  ['g3r-adj-l1', ['g3r_krasny_adj', 'g3r_adj_color_examples', 'g3r_zeleny_dom_adj', 'g3r_adj_for_masc']],
];
console.log('\n=== g3r EN hijack evidence ===');
for (const [id, keys] of g3) {
  console.log('\n', id);
  for (const k of keys) {
    console.log(`  ${k}`);
    console.log('   RU:', ru.data.tasks[k]);
    console.log('   EN:', en.data.tasks[k]);
    console.log('   KY:', ky.data.tasks[k]);
  }
}
