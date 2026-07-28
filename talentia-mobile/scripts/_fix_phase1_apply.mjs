import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const loc = (f) => path.join(root, 'src/i18n/locales', f);

const files = {
  ru: 'ru.json',
  en: 'en.json',
  ky: 'ky.json',
};
const abaFiles = {
  ru: 'abaTextOverrides.generated.json',
  en: 'abaTextOverrides.en.generated.json',
  ky: 'abaTextOverrides.ky.generated.json',
};

// Target values per locale for the shared keys
const fixes = {
  opt_two: { ru: '2', en: '2', ky: '2' },
  opt_yes: { ru: 'Да', en: 'Yes', ky: 'Ооба' },
  opt_no: { ru: 'Нет', en: 'No', ky: 'Жок' },
  g1e_opt_am: { ru: 'am', en: 'am', ky: 'am' },
  g1e_opt_is: { ru: 'is', en: 'is', ky: 'is' },
  g1e_opt_are: { ru: 'are', en: 'are', ky: 'are' },
};

// New keys for legitimate grammar contexts
const newKeys = {
  g3r_opt_to_adj: { ru: 'К прилагательному', en: 'To the adjective', ky: 'Сын атоочко' },
  g3r_opt_to_noun: { ru: 'К существительному', en: 'To the noun', ky: 'Зат атоочко' },
  g3e_opt_q_are_they: { ru: 'Are they students?', en: 'Are they students?', ky: 'Are they students?' },
  g3e_opt_q_is_they: { ru: 'Is they students?', en: 'Is they students?', ky: 'Is they students?' },
  g3e_opt_q_am_they: { ru: 'Am they students?', en: 'Am they students?', ky: 'Am they students?' },
};

const before = {};
for (const [lng, file] of Object.entries(files)) {
  const p = loc(file);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  const tasks = json.data.tasks;
  before[lng] = {};
  for (const key of Object.keys(fixes)) {
    before[lng][key] = tasks[key];
    tasks[key] = fixes[key][lng];
  }
  for (const [key, vals] of Object.entries(newKeys)) {
    tasks[key] = vals[lng];
  }
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
}

// ABA overrides: flat maps with keys like "data.tasks.opt_two" — update if present
const abaBefore = {};
for (const [lng, file] of Object.entries(abaFiles)) {
  const p = loc(file);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  abaBefore[lng] = {};
  for (const key of Object.keys(fixes)) {
    const flat = `data.tasks.${key}`;
    if (flat in json) {
      abaBefore[lng][flat] = json[flat];
      json[flat] = fixes[key][lng];
    }
  }
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
}

console.log('before(locales):', JSON.stringify(before, null, 2));
console.log('before(aba):', JSON.stringify(abaBefore, null, 2));
console.log('done');
