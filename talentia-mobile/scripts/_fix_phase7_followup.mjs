/**
 * Follow-up: translate remaining KY same-as-RU for rewritten g1w keys;
 * scan for inverted Yes/No / gone-vs-went style answer bugs;
 * sync ABA for any newly translated keys.
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
  fs.writeFileSync(path.join(LOCALES, name), `${JSON.stringify(doc, null, 2)}\n`);
}
function flat(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out);
    else if (typeof v === 'string') out[key] = v;
  }
  return out;
}
function set(doc, dotted, value) {
  const parts = dotted.split('.');
  let cur = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
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

const ru = load('ru.json');
const en = load('en.json');
const ky = load('ky.json');
const fru = flat(ru);
const fen = flat(en);
const fky = flat(ky);
const cyr = /[а-яА-ЯёЁ]/;

// Only rewritten-lesson namespaces
const RE =
  /^data\.(tasks|dialog|intro)\.g1w_(schl3_|natl1_|natl2_|natl3_|bdyl1_|bdyl2_|bdyl3_|bdy_opt_)/;

const needKy = Object.keys(fru).filter(
  (k) => RE.test(k) && fky[k] === fru[k] && cyr.test(fru[k]) && fru[k].length > 1,
);
console.log('KY same-as-RU in rewritten g1w namespaces:', needKy.length);

let n = 0;
for (const k of needKy) {
  try {
    const tr = await translateGtx(fru[k], 'ky');
    set(ky, k, tr);
    n++;
    console.log('KY', k, '→', tr);
    await sleep(80);
  } catch (e) {
    console.warn('FAIL', k, e.message);
  }
}
save('ky.json', ky);
console.log('Translated KY keys:', n);

// Sync ABA for rewritten keys from locales
const aba = load('abaTextOverrides.generated.json');
const abaEn = load('abaTextOverrides.en.generated.json');
const abaKy = load('abaTextOverrides.ky.generated.json');
let abaN = 0;
for (const k of Object.keys(fru).filter((k) => RE.test(k))) {
  if (aba[k] !== fru[k]) {
    aba[k] = fru[k];
    abaN++;
  }
  if (fen[k]) abaEn[k] = fen[k];
  const kyVal = flat(ky)[k];
  if (kyVal) abaKy[k] = kyVal;
}
save('abaTextOverrides.generated.json', aba);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);
console.log('ABA keys touched:', abaN);

// --- Scan worlds.ts for suspicious Yes/No inversions ---
const worlds = fs.readFileSync(path.join(__dirname, '..', 'src/data/worlds.ts'), 'utf8');
const suspicious = [];
const ynRe =
  /\{\s*id:\s*'([^']+)',\s*type:\s*'multiple_choice',\s*questionKey:\s*'([^']+)',\s*difficulty:\s*\d+,\s*options:\s*\[\s*\{\s*id:\s*'a',\s*textKey:\s*'data\.tasks\.opt_yes',\s*correct:\s*(true|false)\s*\},\s*\{\s*id:\s*'b',\s*textKey:\s*'data\.tasks\.opt_no',\s*correct:\s*(true|false)\s*\}\s*\]\s*\}/g;
let m;
while ((m = ynRe.exec(worlds))) {
  const [, taskId, qKey, yesCorrect, noCorrect] = m;
  const q = fru[qKey] || '';
  const yes = yesCorrect === 'true';
  // Heuristic: negative capability / "could they without" / "is it wrong" style
  const negQ =
    /без .+ мог|нельзя ли|ошибк|не нужн|нельзя|нельзя|нельзя|мог бы .* без|без мышц|без кост|не разговарива/i.test(
      q,
    );
  const expectNo = /без .+ мог|мог бы .* без|без мышц|без кост/i.test(q);
  if (expectNo && yes) {
    suspicious.push({ taskId, qKey, q, issue: '✓ Да on question that likely expects Нет' });
  }
  if (!yes && !expectNo && /это правильно\?|права ли|нужен ли скелет/i.test(q) === false) {
    // don't flood
  }
}

// gone vs went
if (/g4e_past2_q3_c',\s*correct:\s*true/.test(worlds)) {
  suspicious.push({ taskId: 'g4e-past-l2-t3', issue: 'gone still marked correct' });
}

fs.writeFileSync(
  path.join(__dirname, '_phase7_suspicious_answers.json'),
  JSON.stringify({ suspicious, scannedAt: new Date().toISOString() }, null, 2) + '\n',
);
console.log('Suspicious Yes/No-style findings:', suspicious.length);
suspicious.forEach((s) => console.log(JSON.stringify(s)));
