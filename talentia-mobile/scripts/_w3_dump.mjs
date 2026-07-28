import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');

function t(doc, key) {
  if (!key) return '';
  const parts = String(key).replace(/^data\./, '').split('.');
  let cur = doc.data;
  for (const p of parts) cur = cur?.[p];
  return cur ?? '';
}

function dumpLesson(id) {
  const re = new RegExp(`id: '${id}'[\\s\\S]{0,2500}`);
  const m = worlds.match(re);
  console.log('\n========', id, '========');
  if (!m) {
    console.log('NOT FOUND');
    return;
  }
  const chunk = m[0];
  for (const dk of chunk.matchAll(/textKey: '(data\.dialog\.[^']+)'/g)) {
    console.log('D', t(ru, dk[1]), '| EN:', t(en, dk[1]));
  }
  for (const line of chunk.split('\n')) {
    if (!/id: '/.test(line) || /topicId|titleKey|speaker/.test(line)) continue;
    if (!/type:/.test(line)) continue;
    const tid = /id: '([^']+)'/.exec(line)?.[1];
    const type = /type: '([^']+)'/.exec(line)?.[1];
    const qk = /questionKey: '([^']+)'/.exec(line)?.[1];
    const ans = /answer: '([^']*)'|answer: "([^"]*)"/.exec(line);
    console.log(`\n${tid} [${type}]`);
    console.log(' Q RU:', t(ru, qk));
    console.log(' Q EN:', t(en, qk));
    console.log(' Q KY:', t(ky, qk));
    if (ans) console.log(' answer:', ans[1] ?? ans[2]);
    for (const o of line.matchAll(/textKey: '([^']+)', correct: (true|false)/g)) {
      console.log(` ${o[2] === 'true' ? '✓' : '·'} RU:${t(ru, o[1])} | EN:${t(en, o[1])} | KY:${t(ky, o[1])}`);
    }
  }
}

for (const id of [
  'g2m-times-l3',
  'g2r-sent-l2',
  'g2e-days-l3',
  'canyon-words-2',
  'g4r-conj-l1',
  'g4r-cases-l1',
  'g2s-plt-l2',
  'g3m-1000-l2',
  'g3r-adj-l2',
  'g3e-food-l1',
  'g3e-daily-l1',
  'g4s-emo-l2',
  'meadow-c5-l3',
  'lab-physics-1',
  'jungle-sub-1',
]) {
  dumpLesson(id);
}

// keys for cases labels
const caseKeys = Object.keys(ru.data.tasks).filter(
  (k) => /g4r_cases/.test(k) && /(именительн|родител|винительн|дательн|творительн|предложн|Nominative|nominative|Dative|Genitive)/i.test(String(ru.data.tasks[k]) + String(en.data.tasks[k])),
);
console.log('\ncase-like keys sample', caseKeys.slice(0, 30));
