import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const wl = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_enky_pass_worklist.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));

function get(dotted) {
  const parts = dotted.replace(/^data\./, '').split('.');
  let curEn = en.data;
  let curKy = ky.data;
  for (const p of parts) {
    curEn = curEn?.[p];
    curKy = curKy?.[p];
  }
  return { e: curEn || '', k: curKy || '' };
}

const remain = [];
let total = 0;
for (const L of wl) {
  for (const iss of L.issues || []) {
    total++;
    const { e, k } = get(iss.key);
    const enStale = Boolean(iss.proposedEn && e === iss.en && e !== iss.proposedEn);
    const kyStale = Boolean(iss.proposedKy && k === iss.ky && k !== iss.proposedKy);
    const kyLeak = Boolean(iss.ru && k && k.replace(/\s/g, '') === iss.ru.replace(/\s/g, '') && /[А-Яа-я]/.test(iss.ru));
    // only count kyLeak for question-like types
    const countLeak = kyLeak && /ky_ru_leak|ky_q/.test(iss.type || '');
    if (enStale || kyStale || countLeak) {
      remain.push({
        lesson: L.lessonId,
        type: iss.type,
        key: iss.key,
        enStale,
        kyStale,
        countLeak,
        curE: e.slice(0, 80),
        curK: k.slice(0, 80),
        proposedEn: iss.proposedEn?.slice?.(0, 60),
        proposedKy: iss.proposedKy?.slice?.(0, 60),
      });
    }
  }
}
console.log('total issues', total, 'still open', remain.length);
for (const r of remain) console.log(JSON.stringify(r, null, 0));
