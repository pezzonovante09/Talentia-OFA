/**
 * Phase 6: fix KY leaks in EN, translate g4 stub intros, fill missing keys, sync KY for changed keys.
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

const en = load('en.json');
const ky = load('ky.json');
const ru = load('ru.json');
const fru = flat(ru);

// 1) Manual EN KY-leak / bad EN fixes
const manualEn = {
  'data.dialog.g3e_foodl1_1':
    'Juice — juice! Porridge — porridge. Tali, you drink juice every morning — now you know how to say it in English!',
  'data.intro.g3e_dailyl2_0_b':
    "What time is it? It is … o'clock. Half past, quarter past, quarter to.",
  'data.intro.g3e_dailyl2_1_b':
    'in the morning, in the afternoon, in the evening.',
  'data.intro.g2e_daysl2_0_b': 'Yesterday — the day before today. Tomorrow — the day after today!',
  'data.intro.g2e_phrl1_0_b':
    'Please — a polite request. Thank you — gratitude. You\'re welcome — a reply to thank you.',
};

for (const [k, v] of Object.entries(manualEn)) {
  set(en, k, v);
  console.log('manual EN', k);
}

// 2) Translate all stub g4 intro titles (+ How the tasks work) from RU → EN/KY
const fen = flat(en);
const stubTitleKeys = Object.keys(fen).filter(
  (k) =>
    /^data\.intro\.g4/.test(k) &&
    /_[01]_t$/.test(k) &&
    (fen[k] === 'About this topic' || fen[k] === 'How the tasks work'),
);
console.log('stub titles to translate:', stubTitleKeys.length);

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

let nTitle = 0;
for (const k of stubTitleKeys) {
  const src = fru[k];
  if (!src) continue;
  const enT = await tr(src, 'en');
  set(en, k, enT);
  const kyT = await tr(src, 'ky');
  set(ky, k, kyT);
  nTitle++;
  if (nTitle % 10 === 0) console.log('titles', nTitle, '/', stubTitleKeys.length);
}
console.log('translated titles', nTitle);

// 3) Missing key meadow_c10l2_1_b
const missKey = 'data.tasks.meadow_c10l2_1_b';
if (fru[missKey]) {
  set(en, missKey, await tr(fru[missKey], 'en'));
  set(ky, missKey, await tr(fru[missKey], 'ky'));
  console.log('filled', missKey);
}

// 4) Re-translate EN keys that still contain Kyrgyz letters (post-manual)
const kyrgyz = /[үңөҮҢӨһҺәі]/;
const fen2 = flat(en);
const stillLeak = Object.keys(fen2).filter((k) => kyrgyz.test(fen2[k]));
for (const k of stillLeak) {
  if (!fru[k]) continue;
  set(en, k, await tr(fru[k], 'en'));
  console.log('re-translated leak', k);
}

// 5) For keys changed in RU that KY still equals old wrong / missing — sync KY for g1w + phase keys if KY === EN placeholder
// Ensure KY has translations for newly added task keys where KY still equals RU Cyrillic copy of English-lesson options is OK.
// Translate RU→KY for keys where KY value equals RU and key is from recent phases (g1w already OK).
const fky = flat(ky);
const cyr = /[а-яА-ЯёЁ]/;
const phaseNeedKy = Object.keys(fru).filter((k) => {
  if (fky[k] !== fru[k]) return false;
  if (!cyr.test(fru[k])) return false;
  return /g2e_phrl1_opt_|meadow_c10l2_1_b|g3r_opt_to_|g1e_opt_[KLMN]|g3m_1000l3|g2e_daysl2_|g2e_schl3_/.test(k);
});
console.log('phase KY same-as-RU', phaseNeedKy.length);
for (const k of phaseNeedKy) {
  // Keep Russian option words as-is when they are the answer tokens (Спасибо etc.)
  if (/g2e_phrl1_opt_(spasibo|pozh|privet|posvid|bolshoe|malenkoe)/.test(k)) {
    set(ky, k, fru[k]); // intentional RU tokens
    continue;
  }
  set(ky, k, await tr(fru[k], 'ky'));
  console.log('ky', k);
}

save('en.json', en);
save('ky.json', ky);
console.log('Phase 6 locale writes done');
