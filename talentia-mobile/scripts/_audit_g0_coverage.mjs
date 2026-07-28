import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const live = JSON.parse(fs.readFileSync(path.join(__dirname, '_reaudit2_g0_live.json'), 'utf8'));
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const abaEn = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/abaTextOverrides.en.generated.json'), 'utf8'));
const abaKy = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/abaTextOverrides.ky.generated.json'), 'utf8'));

function t(obj, key) {
  if (!key) return '';
  let c = obj;
  for (const p of key.split('.')) {
    c = c?.[p];
    if (c === undefined) return null;
  }
  return c;
}

for (const L of live) {
  let enSame = 0,
    kySame = 0,
    total = 0,
    enRuAba = 0;
  const samples = [];
  for (const task of L.tasks) {
    if (!task.qKey) continue;
    total++;
    const r = t(ru, task.qKey);
    const e = t(en, task.qKey);
    const k = t(ky, task.qKey);
    if (e === r) enSame++;
    if (k === r) {
      kySame++;
      if (samples.length < 2 && String(r).length > 10) samples.push({ id: task.id, text: String(r).slice(0, 70), aba: task.aba });
    }
  }
  // aba overrides for island-abc-l2
  if (L.id === 'island-abc-l2') {
    console.log('ABA a1 en', abaEn['data.tasks.nrw_iabcl2_a1_q'], abaEn['data.tasks.nrw_iabcl2_a1_a'], abaEn['data.tasks.nrw_iabcl2_a1_b']);
    console.log('locale a1', t(en, 'data.tasks.nrw_iabcl2_a1_q'), t(en, 'data.tasks.nrw_iabcl2_a1_a'));
    console.log('ABA t3', abaEn['data.tasks.nrw_iabcl2_t3_q']);
  }
  if (enSame || kySame) {
    console.log(`${L.id}\tn=${total}\ten=ru:${enSame}\tky=ru:${kySame}\t${samples.map((s) => s.id + (s.aba ? '[A]' : '')).join(',')}`);
  }
}

// meadow-sh-l2 detail
const sh2 = live.find((x) => x.id === 'meadow-sh-l2');
console.log('\nmeadow-sh-l2');
for (const tsk of sh2.tasks) {
  console.log(tsk.id, tsk.type, (tsk.q || '').slice(0, 70), '=>', tsk.answer || tsk.options?.filter((o) => o.correct).map((o) => o.text).join(','));
}

const c10 = live.find((x) => x.id === 'meadow-c10-l3');
console.log('\nmeadow-c10-l3');
for (const tsk of c10.tasks) {
  console.log(tsk.id, (tsk.q || '').slice(0, 70), '=>', tsk.answer || tsk.options?.filter((o) => o.correct).map((o) => o.text).join(','));
}
