/**
 * Merges pre-56 task strings into en.json, ru.json, ky.json (data.tasks).
 * Parses glossaries from Downloads draft comments + manual overrides.
 * Run: node scripts/merge-pre56-i18n.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const DOWNLOADS = path.join(process.env.USERPROFILE || '', 'Downloads');
const DRAFT_56 = path.join(DOWNLOADS, 'new_tasks_5_6.ts');
const DRAFT_ISLAND = path.join(DOWNLOADS, 'new_tasks_island.ts');
const WORLDS = path.join(root, 'src/data/worlds.ts');
const LOCALES = ['en', 'ru', 'ky'];

/** One-quoted: key = "value" */
const LINE_ONE = /^\s*([a-zA-Z0-9_]+)\s*=\s*"((?:\\.|[^"\\])*)"\s*$/;

function unq(s) {
  return s.replace(/\\"/g, '"');
}

/** Parse: anyKey = "a" / "b" (allows Cyrillic in key, e.g. pre_opt_osёл) */
function parseLineTwo(line) {
  const t = line.trim();
  const eq = t.indexOf('=');
  if (eq === -1) return null;
  const key = t.slice(0, eq).trim();
  let rest = t.slice(eq + 1).trim();
  if (!rest.startsWith('"')) return null;
  let i = 1;
  let first = '';
  while (i < rest.length) {
    const c = rest[i];
    if (c === '\\') {
      first += c + (rest[i + 1] || '');
      i += 2;
      continue;
    }
    if (c === '"') break;
    first += c;
    i++;
  }
  if (rest[i] !== '"') return null;
  rest = rest.slice(i + 1).trim();
  if (!rest.startsWith('/')) return null;
  rest = rest.slice(1).trim();
  if (!rest.startsWith('"')) return null;
  i = 1;
  let second = '';
  while (i < rest.length) {
    const c = rest[i];
    if (c === '\\') {
      second += c + (rest[i + 1] || '');
      i += 2;
      continue;
    }
    if (c === '"') break;
    second += c;
    i++;
  }
  return { key, first, second };
}

/** Draft glossary uses mixed case / Cyrillic; worlds.ts uses lowercase ASCII keys */
const GLOSSARY_KEY_TO_CANON = {
  // Glossary line uses CYRILLIC SMALL LETTER IO (U+0451) + LATIN l at end, not Cyrillic "л"
  'pre_opt_os\u0451l': 'pre_opt_osel',
  pre_opt_osel: 'pre_opt_osel',
  pre_opt_syl_MA: 'pre_opt_syl_ma',
  pre_opt_syl_MO: 'pre_opt_syl_mo',
  pre_opt_syl_MU: 'pre_opt_syl_mu',
  pre_opt_syl_SA: 'pre_opt_syl_sa',
  pre_opt_syl_SO: 'pre_opt_syl_so',
  pre_opt_syl_SU: 'pre_opt_syl_su',
  pre_opt_syl_SL: 'pre_opt_syl_sl',
  pre_opt_syl_NA: 'pre_opt_syl_na',
  pre_opt_syl_RA: 'pre_opt_syl_ra',
  pre_opt_syl_KE: 'pre_opt_syl_ke',
  pre_read_MA: 'pre_read_ma',
  pre_read_MO: 'pre_read_mo',
  pre_read_SA: 'pre_read_sa',
  pre_read_NA: 'pre_read_na',
  pre_MU_first_letter: 'pre_mu_first_letter',
  pre_SO_first_letter: 'pre_so_first_letter',
  aba_read_MA: 'aba_read_ma',
  aba_read_SA: 'aba_read_sa',
  aba_read_NA: 'aba_read_na',
};

function applyKeyAliases(en, ru) {
  const en2 = {};
  const ru2 = {};
  for (const k of Object.keys(en)) {
    const ck = GLOSSARY_KEY_TO_CANON[k] || k;
    en2[ck] = en[k];
    ru2[ck] = ru[k];
  }
  return { en: en2, ru: ru2 };
}

/** RU first, EN second (new_tasks_5_6 glossary) */
function parse56Comment(text) {
  const anchor = text.indexOf('(добавить в i18n файлы)');
  if (anchor === -1) throw new Error('5_6: glossary anchor not found');
  const open = text.indexOf('/*', anchor);
  const close = text.indexOf('*/', open);
  if (open === -1 || close === -1) throw new Error('5_6: comment block not found');
  const block = text.slice(open + 2, close);
  const en = {};
  const ru = {};
  for (const line of block.split('\n')) {
    const p = parseLineTwo(line);
    if (!p) continue;
    ru[p.key] = p.first;
    en[p.key] = p.second;
  }
  return applyKeyAliases(en, ru);
}

/** Island: questions & ABA = EN / RU; options = one string or "EN / RU" */
function parseIslandComment(text) {
  const a = text.indexOf('// НОВЫЕ КЛЮЧИ ПЕРЕВОДОВ — island');
  if (a === -1) throw new Error('island: glossary anchor not found');
  const open = text.indexOf('/*', a);
  const close = text.indexOf('*/', open);
  if (open === -1 || close === -1) throw new Error('island: comment block not found');
  const block = text.slice(open + 2, close);
  const en = {};
  const ru = {};
  const qIdx = block.indexOf('QUESTIONS:');
  const optIdx = block.indexOf('OPTIONS (новые textKey):');
  const abaIdx = block.indexOf('ABA questionKey:');
  if (qIdx === -1 || optIdx === -1 || abaIdx === -1) throw new Error('island: section header missing');

  const qBlock = block.slice(qIdx, optIdx);
  for (const line of qBlock.split('\n')) {
    const p = parseLineTwo(line);
    if (!p) continue;
    en[p.key] = p.first;
    ru[p.key] = p.second;
  }

  const optBlock = block.slice(optIdx, abaIdx);
  for (const line of optBlock.split('\n')) {
    const p2 = parseLineTwo(line);
    if (p2) {
      en[p2.key] = p2.first;
      ru[p2.key] = p2.second;
      continue;
    }
    const m1 = line.match(LINE_ONE);
    if (!m1) continue;
    const [, key, val] = m1;
    const u = unq(val);
    const parts = u.split(/\s*\/\s*/);
    if (parts.length >= 2) {
      en[key] = parts[0].trim();
      ru[key] = parts.slice(1).join(' / ').trim();
    } else {
      en[key] = u;
      ru[key] = u;
    }
  }

  const abaBlock = block.slice(abaIdx);
  for (const line of abaBlock.split('\n')) {
    const p = parseLineTwo(line);
    if (!p) continue;
    en[p.key] = p.first;
    ru[p.key] = p.second;
  }

  return { en, ru };
}

function taskKeysFromWorlds() {
  const w = fs.readFileSync(WORLDS, 'utf8');
  const start = w.indexOf("id: 'meadow'");
  const end = w.indexOf("id: 'g1math'");
  const slice = w.slice(start, end);
  const re = /data\.tasks\.([a-zA-Z0-9_]+)/g;
  const keys = new Set();
  let m;
  while ((m = re.exec(slice))) keys.add(m[1]);
  return keys;
}

const MANUAL_EN = {
  pre_opt_en_walk: 'Walk',
  pre_type_syl_mo: 'Write the syllable МО',
  pre_opt_letter_d: 'D',
};
const MANUAL_RU = {
  pre_opt_en_walk: 'Идти',
  pre_type_syl_mo: 'Напиши слог МО',
  pre_opt_letter_d: 'Д',
};
const MANUAL_KY = {
  pre_opt_en_walk: 'Басуу',
  pre_type_syl_mo: 'МО булагын жаз',
  pre_opt_letter_d: 'Д',
};

/** Kyrgyz: use dedicated KY when we add it; else mirror RU for caregiver-facing RU curriculum */
function buildKy(ruMap, missing) {
  const ky = { ...MANUAL_KY };
  for (const k of missing) {
    if (ky[k]) continue;
    const ru = ruMap[k];
    if (!ru) continue;
    ky[k] = ru;
  }
  return ky;
}

function main() {
  const d56 = fs.readFileSync(DRAFT_56, 'utf8');
  const island = fs.readFileSync(DRAFT_ISLAND, 'utf8');
  const g56 = parse56Comment(d56);
  const gi = parseIslandComment(island);
  const enMap = { ...g56.en, ...gi.en, ...MANUAL_EN };
  const ruMap = { ...g56.ru, ...gi.ru, ...MANUAL_RU };

  const needed = taskKeysFromWorlds();
  const enJson = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
  const have = new Set(Object.keys(enJson.data.tasks || {}));
  const missing = [...needed].filter((k) => !have.has(k)).sort();

  const kyMap = buildKy(ruMap, missing);

  const gaps = [];
  for (const k of missing) {
    if (!enMap[k]) gaps.push(`en: ${k}`);
    if (!ruMap[k]) gaps.push(`ru: ${k}`);
    if (!kyMap[k]) gaps.push(`ky: ${k}`);
  }
  if (gaps.length) {
    console.error('Missing glossary entries:\n' + gaps.join('\n'));
    process.exit(1);
  }

  for (const loc of LOCALES) {
    const p = path.join(root, 'src/i18n/locales', `${loc}.json`);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!j.data.tasks) j.data.tasks = {};
    const src = loc === 'en' ? enMap : loc === 'ru' ? ruMap : kyMap;
    for (const k of missing) {
      j.data.tasks[k] = src[k];
    }
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
    console.log(`${loc}.json: added ${missing.length} task keys`);
  }
}

main();
