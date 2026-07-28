/**
 * Fix remaining EN/KY desync + key contamination found after reaudit2 fixes.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.join(__dirname, '..', 'src/i18n/locales');
const worldsPath = path.join(__dirname, '..', 'src/data/worlds.ts');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES, name), 'utf8'));
}
function save(name, doc) {
  fs.writeFileSync(path.join(LOCALES, name), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}
function set(doc, dotted, value) {
  const parts = dotted.split('.');
  let cur = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function translateGtx(text, tl) {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=${tl}&dt=t&q=` +
    encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gtx ${res.status}`);
  const data = await res.json();
  return (data[0] || []).map((x) => x[0]).join('').trim();
}
const cache = new Map();
async function tr(text, tl) {
  const k = `${tl}::${text}`;
  if (cache.has(k)) return cache.get(k);
  let out;
  for (let i = 0; i < 4; i++) {
    try {
      out = await translateGtx(text, tl);
      break;
    } catch {
      await sleep(300 * (i + 1));
    }
  }
  cache.set(k, out);
  await sleep(60);
  return out;
}

const ru = load('ru.json');
const en = load('en.json');
const ky = load('ky.json');

// Manual high-signal fixes
const manual = {
  'data.tasks.g4m_cm2_q4_a': {
    ru: '< (меньше)',
    en: '< (less)',
    ky: '< (кичине)',
  },
  'data.tasks.g4m_cm2_q4_b': {
    ru: '= (равно)',
    en: '= (equal)',
    ky: '= (барабар)',
  },
  'data.tasks.g4m_cm2_q4_c': {
    ru: '> (больше)',
    en: '> (greater)',
    ky: '> (чоң)',
  },
  'data.tasks.g2m_tens_in_48': {
    ru: 'Детектив Тали расследует число 48. Сколько десятков он нашёл в этом числе?',
    en: 'Detective Tali investigates the number 48. How many tens are in it?',
    ky: 'Детектив Тали 48 санын изилдейт. Анда канча ондук бар?',
  },
  'data.tasks.g2m_word_45plus27': {
    ru: '91 − 38 = ?',
    en: '91 − 38 = ?',
    ky: '91 − 38 = ?',
  },
  'data.tasks.g2m_units_in_37': {
    ru: 'Сколько единиц в числе 37?',
    en: 'How many ones (units) are in 37?',
    ky: '37 санында канча бирдик бар?',
  },
  'data.tasks.g2m_biggest_37_42_29': {
    ru: 'Какое число самое большое: 37, 42 или 29?',
    en: 'Which number is the largest: 37, 42, or 29?',
    ky: 'Кайсы сан эң чоң: 37, 42 же 29?',
  },
  'data.tasks.g2s_insect_is_butterfly': {
    ru: 'Бабочка — это насекомое?',
    en: 'Is a butterfly an insect?',
    ky: 'Көпөлөк — бул курт-кумурскабы?',
  },
};

for (const [k, v] of Object.entries(manual)) {
  set(ru, k, v.ru);
  set(en, k, v.en);
  set(ky, k, v.ky);
  console.log('manual', k);
}

// Fix worlds.ts answer for tens if still 4 (48→4 is correct with fixed Q)
let worlds = fs.readFileSync(worldsPath, 'utf8');
worlds = worlds.replace(
  /\{ id: 'g2m100l2t3', type: 'input', questionKey: 'data\.tasks\.g2m_tens_in_48', difficulty: 2, answer: '[^']*' \}/,
  "{ id: 'g2m100l2t3', type: 'input', questionKey: 'data.tasks.g2m_tens_in_48', difficulty: 2, answer: '4' }",
);
worlds = worlds.replace(
  /\{ id: 'g2madd2l3t4', type: 'input', questionKey: 'data\.tasks\.g2m_word_45plus27', difficulty: 2, answer: '[^']*' \}/,
  "{ id: 'g2madd2l3t4', type: 'input', questionKey: 'data.tasks.g2m_word_45plus27', difficulty: 2, answer: '53' }",
);
fs.writeFileSync(worldsPath, worlds);

// Translate hard-mismatch dialog/intro keys from RU → EN/KY
const hardKeys = [
  'data.dialog.g2m_100l3_0',
  'data.dialog.g2m_timesl3_1',
  'data.dialog.g3m_1000l3_0',
  'data.dialog.g3m_divl2_0',
  'data.dialog.g3m_divl3_0',
  'data.dialog.g3m_tabl3_0',
  'data.intro.g2m_100l3_0_b',
  'data.intro.g2m_add2l3_0_b',
  'data.intro.g2m_add2l3_1_b',
  'data.intro.g2m_timesl3_0_b',
  'data.intro.g2m_timesl3_1_b',
  'data.tasks.g2m_2x6_check',
  'data.tasks.g2m_5x9_check',
];

function get(doc, dotted) {
  const parts = dotted.split('.');
  let cur = doc;
  for (const p of parts) cur = cur?.[p];
  return typeof cur === 'string' ? cur : '';
}

for (const k of hardKeys) {
  const src = get(ru, k);
  if (!src) continue;
  set(en, k, await tr(src, 'en'));
  set(ky, k, await tr(src, 'ky'));
  console.log('tr', k);
}

save('ru.json', ru);
save('en.json', en);
save('ky.json', ky);

// Targeted ABA sync for these keys only
const aba = load('abaTextOverrides.generated.json');
const abaEn = load('abaTextOverrides.en.generated.json');
const abaKy = load('abaTextOverrides.ky.generated.json');
const allKeys = [...Object.keys(manual), ...hardKeys];
for (const k of allKeys) {
  const rv = get(ru, k);
  const ev = get(en, k);
  const kv = get(ky, k);
  if (rv) aba[k] = rv;
  if (ev) abaEn[k] = ev;
  if (kv) abaKy[k] = kv;
}
save('abaTextOverrides.generated.json', aba);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);
console.log('done');
