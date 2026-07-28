/**
 * Reaudit tails: locale keys for A/C/D + batch-translate 36 EN g4 intro _0_b stubs from RU.
 * Also restore hijacked g2r_opt_statement/question_s/exclaim_s in RU; sync EN/KY for subject Qs; ABA intros.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.join(__dirname, '..', 'src/i18n/locales');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES, name), 'utf8'));
}
function save(name, doc) {
  fs.writeFileSync(path.join(LOCALES, name), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function get(doc, dotted) {
  const parts = dotted.split('.');
  let cur = doc;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
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
function flat(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out);
    else if (typeof v === 'string') out[key] = v;
  }
  return out;
}

async function translateGtx(text, tl) {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=${tl}&dt=t&q=` +
    encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gtx HTTP ${res.status}`);
  const data = await res.json();
  const out = (data[0] || []).map((x) => x[0]).join('');
  if (!out.trim()) throw new Error('gtx empty');
  return out.trim();
}

const cache = new Map();
async function tr(text, tl) {
  const key = `${tl}::${text}`;
  if (cache.has(key)) return cache.get(key);
  let out;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      out = await translateGtx(text, tl);
      break;
    } catch (e) {
      await sleep(400 * (attempt + 1));
      if (attempt === 3) throw e;
    }
  }
  cache.set(key, out);
  await sleep(80);
  return out;
}

const ru = load('ru.json');
const en = load('en.json');
const ky = load('ky.json');

// --- A: restore sentence-type option labels; keep subject Q stems; new predicate input ---
const ruManual = {
  'data.tasks.g2r_opt_statement': 'повествовательное',
  'data.tasks.g2r_opt_question_s': 'вопросительное',
  'data.tasks.g2r_opt_exclaim_s': 'восклицательное',
  'data.tasks.g2r_sentl1_predicate_q': 'В предложении «Кот сидит» сказуемое — это:',
  // C + D new strings
  'data.tasks.jungle_sub2_fb_sent': '8 − 3 = _',
  'data.tasks.canyon_w2_fb_sent': 'Я вижу _. Это пёс.',
  'data.tasks.lab_an2_sort_q': 'Разложи: кто живёт в воде, а кто на суше?',
  'data.tasks.lab_an2_sort_water': 'В воде',
  'data.tasks.lab_an2_sort_land': 'На суше',
  'data.tasks.g2r_shl1_fb_sent': 'Всегда твёрдый согласный: _',
  'data.tasks.g2r_shl2_fb_sent': 'Правильно: _ (с мягким знаком)',
  'data.tasks.g3r_genl1_fb_sent': 'Стол — это _ род.',
  'data.tasks.g1e_abcl1_fb_sent': 'Ice starts with _',
  'data.tasks.g2e_daysl1_fb_sent': 'Среда по-английски — _',
  'data.tasks.g2e_phrl1_fb_sent': "You're welcome means _",
  'data.tasks.g4e_pres_l1_fb_sent': 'She _ to school every day.',
  'data.tasks.g2s_anil1_sort_q': 'Разложи: млекопитающие и остальные',
  'data.tasks.g2s_anil1_sort_mammal': 'Млекопитающие',
  'data.tasks.g2s_anil1_sort_other': 'Остальные',
  'data.tasks.g2s_pltl1_rc_q': 'Расставь этапы роста растения по порядку',
  'data.tasks.g2s_pltl1_rc_seed': 'Семя',
  'data.tasks.g2s_pltl1_rc_sprout': 'Росток',
  'data.tasks.g2s_pltl1_rc_plant': 'Растение',
  'data.tasks.g2s_pltl1_rc_flower': 'Цветок',
};

for (const [k, v] of Object.entries(ruManual)) {
  set(ru, k, v);
}

// Align EN/KY subject stems that still describe sentence types
const subjectStemKeys = [
  'data.tasks.g2r_statement_type',
  'data.tasks.g2r_exclaim_type',
  'data.tasks.g2r_opt_kto_chto',
  'data.tasks.g2r_opt_chto_delaet',
  'data.tasks.g2r_opt_kakoy',
];

const fru = flat(ru);
for (const [k, v] of Object.entries(ruManual)) {
  set(en, k, await tr(v, 'en'));
  set(ky, k, await tr(v, 'ky'));
  console.log('new key', k);
}

for (const k of subjectStemKeys) {
  const src = fru[k];
  if (!src) continue;
  set(en, k, await tr(src, 'en'));
  set(ky, k, await tr(src, 'ky'));
  console.log('stem', k);
}

// Keep English tokens for EN-lesson fill blanks where RU was English already
set(en, 'data.tasks.g1e_abcl1_fb_sent', 'Ice starts with _');
set(en, 'data.tasks.g2e_phrl1_fb_sent', "You're welcome means _");
set(en, 'data.tasks.g4e_pres_l1_fb_sent', 'She _ to school every day.');
set(en, 'data.tasks.jungle_sub2_fb_sent', '8 − 3 = _');
// Option keys for phr/pres already exist in EN locales

// --- B: 36 EN stub intro bodies ---
const fen = flat(en);
const stubKeys = Object.keys(fen).filter(
  (k) =>
    /^data\.intro\.g4/.test(k) &&
    /_0_b$/.test(k) &&
    /We'll recap what matters for «/i.test(fen[k]),
);
console.log('EN stubs to translate:', stubKeys.length);
let n = 0;
for (const k of stubKeys) {
  const src = fru[k] || get(ru, k);
  if (!src || typeof src !== 'string') {
    console.warn('missing RU for', k);
    continue;
  }
  set(en, k, await tr(src, 'en'));
  n++;
  if (n % 6 === 0) console.log('stubs', n, '/', stubKeys.length);
}
console.log('translated stubs', n);

save('ru.json', ru);
save('en.json', en);
save('ky.json', ky);

// ABA: sync changed intro bodies + grammar keys
const aba = load('abaTextOverrides.generated.json');
const abaEn = load('abaTextOverrides.en.generated.json');
const abaKy = load('abaTextOverrides.ky.generated.json');
const fru2 = flat(ru);
const fen2 = flat(en);
const fky2 = flat(ky);

const abaKeys = [
  ...Object.keys(ruManual),
  ...subjectStemKeys,
  ...stubKeys,
  'data.tasks.g2r_opt_statement',
  'data.tasks.g2r_opt_question_s',
  'data.tasks.g2r_opt_exclaim_s',
];
let abaN = 0;
for (const k of new Set(abaKeys)) {
  if (fru2[k]) {
    aba[k] = fru2[k];
    abaN++;
  }
  if (fen2[k]) abaEn[k] = fen2[k];
  if (fky2[k]) abaKy[k] = fky2[k];
}
save('abaTextOverrides.generated.json', aba);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);
console.log('ABA keys touched', abaN);
console.log('done');
