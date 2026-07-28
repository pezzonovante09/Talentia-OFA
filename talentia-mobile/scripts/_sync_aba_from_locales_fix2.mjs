/**
 * Sync ABA overrides from current ru/en/ky.json for keys touched in reaudit2 fixes
 * (and any ABA key that diverges from locale for g3/g4/g2m/g1e/island/garden prefixes).
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
function flat(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out);
    else if (typeof v === 'string') out[key] = v;
  }
  return out;
}

const PREFIX =
  /data\.(tasks|dialog|intro|lessons)\.(g4m_|g4e_|g4s_|g3w_|g3r_|g3m_|g2m_|g2r_|g2e_|g2s_|g1e_|g1r_|g1m_|island_|garden_|canyon_|jungle_|space_|lab_)/;

const ru = flat(load('ru.json'));
const en = flat(load('en.json'));
const ky = flat(load('ky.json'));
const aba = load('abaTextOverrides.generated.json');
const abaEn = load('abaTextOverrides.en.generated.json');
const abaKy = load('abaTextOverrides.ky.generated.json');

let n = 0;
for (const key of Object.keys(ru)) {
  if (!PREFIX.test(key)) continue;
  // Always keep ABA in sync with standard for these fix batches
  if (aba[key] !== ru[key] || abaEn[key] !== en[key] || abaKy[key] !== ky[key]) {
    aba[key] = ru[key];
    if (en[key] != null) abaEn[key] = en[key];
    if (ky[key] != null) abaKy[key] = ky[key];
    n++;
  }
}

save('abaTextOverrides.generated.json', aba);
save('abaTextOverrides.en.generated.json', abaEn);
save('abaTextOverrides.ky.generated.json', abaKy);
console.log('synced ABA keys', n);
