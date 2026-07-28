/**
 * Sync abaTextOverrides.generated.json from current ru.json for Phase 1–4 changed keys,
 * then seed EN/KY from locales where ABA==RU, then audit+regen mismatches.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.join(__dirname, '..', 'src/i18n/locales');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES, name), 'utf8'));
}
function save(name, doc) {
  fs.writeFileSync(path.join(LOCALES, name), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}
function get(doc, dotted) {
  const parts = dotted.split('.');
  let cur = doc;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}
function flat(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out);
    else if (typeof v === 'string') out[key] = v;
  }
  return out;
}

const PATTERN =
  /(^data\.tasks\.(opt_two|opt_yes|opt_no|g1e_opt_|g3r_opt_to_)|g1w_|g2e_phrl1_|g2e_daysl2_|g2e_schl3_|g3m_1000|g1e_grtl|g1e_opt_[KLMN]|meadow_c10l2_1_b|g3e_foodl1_1|g3e_dailyl2_|g2e_daysl2_0_b)/;

const ru = load('ru.json');
const fru = flat(ru);
const aba = load('abaTextOverrides.generated.json');
const abaEn = load('abaTextOverrides.en.generated.json');
const abaKy = load('abaTextOverrides.ky.generated.json');
const en = load('en.json');
const ky = load('ky.json');

let updated = 0;
let added = 0;

// Update / add matching keys from RU
for (const [key, val] of Object.entries(fru)) {
  if (!PATTERN.test(key)) continue;
  if (aba[key] !== val) {
    if (aba[key] === undefined) added++;
    else updated++;
    aba[key] = val;
  }
  // keep EN/KY in sync when we have locale strings
  const enVal = get(en, key);
  const kyVal = get(ky, key);
  if (enVal) abaEn[key] = enVal;
  if (kyVal) abaKy[key] = kyVal;
}

// Also force shared option keys even if pattern missed
for (const k of [
  'data.tasks.opt_two',
  'data.tasks.opt_yes',
  'data.tasks.opt_no',
  'data.tasks.g1e_opt_am',
  'data.tasks.g1e_opt_is',
  'data.tasks.g1e_opt_are',
  'data.tasks.g3r_opt_to_adj',
  'data.tasks.g3r_opt_to_noun',
]) {
  if (fru[k]) {
    aba[k] = fru[k];
    if (get(en, k)) abaEn[k] = get(en, k);
    if (get(ky, k)) abaKy[k] = get(ky, k);
  }
}

save('abaTextOverrides.generated.json', aba);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);
console.log({ updated, added, abaKeys: Object.keys(aba).length });

// Run audit
console.log('Running audit:aba-en-ky…');
const audit = spawnSync('npm', ['run', 'audit:aba-en-ky'], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8',
  shell: true,
});
console.log(audit.stdout?.slice(-800) || '');
if (audit.status !== 0) console.log(audit.stderr?.slice(-500));
