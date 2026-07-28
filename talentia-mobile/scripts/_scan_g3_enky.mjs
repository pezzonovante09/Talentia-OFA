import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const lines = worlds.split('\n');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
function t(obj, key) {
  if (!key) return null;
  let cur = obj;
  for (const p of key.split('.')) {
    cur = cur?.[p];
    if (cur === undefined) return null;
  }
  return cur;
}
const ids = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_g3.json'), 'utf8')).map((x) => x.id);
const cyr = /[А-Яа-яЁё]/;
const fillBlanks = [];
const inputAnswers = [];

for (const id of ids) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`id: '${id}', topicId:`).test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) continue;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/id: '[a-z0-9-]+', topicId:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  for (let i = start; i < end; i++) {
    const ln = lines[i];
    const tm = ln.match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(ln)) continue;
    if (tm[2] === 'fill_blank') {
      const blanks = [...ln.matchAll(/\{ id: '([^']+)', textKey: '([^']+)', correct: (true|false)/g)].map((b) => ({
        oid: b[1],
        correct: b[3] === 'true',
        ru: t(ru, b[2]),
        en: t(en, b[2]),
        ky: t(ky, b[2]),
      }));
      // fill_blank options may be on following lines — search nearby
      if (!blanks.length) {
        const nearby = lines.slice(i, Math.min(i + 15, end)).join('\n');
        const blanks2 = [...nearby.matchAll(/\{ id: '([^']+)', textKey: '([^']+)', correct: (true|false)/g)].map((b) => ({
          oid: b[1],
          correct: b[3] === 'true',
          ru: t(ru, b[2]),
          en: t(en, b[2]),
          ky: t(ky, b[2]),
        }));
        fillBlanks.push({ id, task: tm[1], blanks: blanks2 });
      } else {
        fillBlanks.push({ id, task: tm[1], blanks });
      }
    }
    if (tm[2] === 'input') {
      const cam = ln.match(/correctAnswerKey: '([^']+)'/);
      if (cam) {
        inputAnswers.push({
          id,
          task: tm[1],
          ans: { ru: t(ru, cam[1]), en: t(en, cam[1]), ky: t(ky, cam[1]) },
        });
      }
    }
  }
}

const data = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_g3_live_trilocale.json'), 'utf8'));
const flags = [];
for (const L of data) {
  for (const intro of L.intros) {
    if (intro.title.ky === intro.title.ru && cyr.test(intro.title.ru)) {
      flags.push({ id: L.id, flag: `KY intro title === RU «${intro.title.ru}»` });
    }
    if (intro.body.ky === intro.body.ru && cyr.test(String(intro.body.ru)) && String(intro.body.ru).length > 25) {
      flags.push({ id: L.id, flag: `KY intro body === RU «${String(intro.body.ru).slice(0, 50)}…»` });
    }
  }
  for (const task of L.tasks) {
    if (!task.q) continue;
    const qky = String(task.q.ky || '');
    const qru = String(task.q.ru || '');
    const qen = String(task.q.en || '');
    if (qky.trim() === qru.trim() && cyr.test(qru) && qru.length > 10) {
      flags.push({ id: L.id, flag: `KY Q === RU «${qru.slice(0, 55)}»` });
    }
    for (const w of ['Запиши', 'Сколько', 'Какое число', 'Верно?', ' — это:']) {
      if (qky.includes(w)) flags.push({ id: L.id, flag: `KY RU-leak «${w}» in Q of ${task.id}` });
    }
    if (/dozen/i.test(qen)) flags.push({ id: L.id, flag: 'CRITICAL EN dozen in stem' });
    // EN option === bare English word from stem (tautology) without gloss
    for (const o of task.opts) {
      if (!o.correct) continue;
      const oe = String(o.en || '').trim();
      if (/^[A-Za-z' ]+$/.test(oe) && oe.split(/\s+/).length <= 3) {
        const qLower = qen.toLowerCase();
        if (qLower.includes(`"${oe.toLowerCase()}"`) || qLower.includes(`«${oe.toLowerCase()}»`) || qLower.includes(`“${oe.toLowerCase()}”`)) {
          // if option is just the same English word without meaning gloss → tautology
          if (!/[а-яё(]/i.test(oe) && !/means|to |\/|—|-/.test(oe)) {
            flags.push({ id: L.id, flag: `EN tautology risk ✓«${oe}» for Q «${qen.slice(0, 50)}»` });
          }
        }
      }
    }
    for (const o of task.opts) {
      const oen = String(o.en || '');
      const oky = String(o.ky || '');
      const oru = String(o.ru || '');
      // EN left as pure RU explanatory text
      if (oen === oru && cyr.test(oru) && oru.length > 12 && /Потому|просто так|Да,|Нет,/.test(oru)) {
        flags.push({ id: L.id, flag: `EN opt === RU meta «${oru.slice(0, 45)}»` });
      }
      if (oky === oru && cyr.test(oru) && oru.length > 12 && /Потому|просто так/.test(oru)) {
        flags.push({ id: L.id, flag: `KY opt === RU meta «${oru.slice(0, 45)}»` });
      }
    }
  }
}

const out = { fillBlanks, inputAnswers, flags };
fs.writeFileSync(path.join(root, 'scripts/_g3_enky_scan.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('fill_blanks', fillBlanks.length);
for (const fb of fillBlanks) {
  const ok = fb.blanks.filter((b) => b.correct).map((b) => `${b.ru}|${b.en}|${b.ky}`).join('; ');
  console.log(fb.id, fb.task, '✓', ok || '(no opts on line)');
  console.log('  all', JSON.stringify(fb.blanks));
}
console.log('--- flags ---');
flags.forEach((f) => console.log(f.id + ': ' + f.flag));
console.log('input sample', inputAnswers.slice(0, 8));
