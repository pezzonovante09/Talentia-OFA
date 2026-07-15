/**
 * Заполняет abaTextOverrides.en/ky.generated.json из en.json / ky.json
 * для ключей, где ABA-текст совпадает со стандартным ru.json.
 * Остальные ключи — через npm run translate:aba-overrides (Google / DeepL).
 *
 *   npx tsx scripts/seed-aba-overrides-from-locales.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { NUMERIC_ONLY } from './lib/translate-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function saveJson(file: string, doc: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}

function getByPath(obj: Record<string, unknown>, dotted: string): string | undefined {
  const parts = dotted.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function main(): void {
  const abaRu = loadJson<Record<string, string>>(
    path.join(LOCALES_DIR, 'abaTextOverrides.generated.json'),
  );
  const ruDoc = loadJson<Record<string, unknown>>(path.join(LOCALES_DIR, 'ru.json'));
  const enDoc = loadJson<Record<string, unknown>>(path.join(LOCALES_DIR, 'en.json'));
  const kyDoc = loadJson<Record<string, unknown>>(path.join(LOCALES_DIR, 'ky.json'));

  const enOut: Record<string, string> = {};
  const kyOut: Record<string, string> = {};

  let copiedEn = 0;
  let copiedKy = 0;
  let provisionalEn = 0;
  let provisionalKy = 0;
  let numeric = 0;
  let needsTranslate = 0;

  const provisional = process.argv.includes('--provisional');

  for (const [key, abaVal] of Object.entries(abaRu)) {
    if (NUMERIC_ONLY.test(abaVal.trim())) {
      enOut[key] = abaVal;
      kyOut[key] = abaVal;
      numeric += 1;
      continue;
    }

    const ruVal = getByPath(ruDoc, key);
    const enVal = getByPath(enDoc, key);
    const kyVal = getByPath(kyDoc, key);

    if (ruVal === abaVal) {
      if (enVal?.trim()) {
        enOut[key] = enVal;
        copiedEn += 1;
      }
      if (kyVal?.trim()) {
        kyOut[key] = kyVal;
        copiedKy += 1;
      }
    } else {
      needsTranslate += 1;
      if (provisional) {
        if (enVal?.trim()) {
          enOut[key] = enVal;
          provisionalEn += 1;
        }
        if (kyVal?.trim()) {
          kyOut[key] = kyVal;
          provisionalKy += 1;
        }
      }
    }
  }

  saveJson(path.join(LOCALES_DIR, 'abaTextOverrides.en.generated.json'), enOut);
  saveJson(path.join(LOCALES_DIR, 'abaTextOverrides.ky.generated.json'), kyOut);

  console.log(`ABA keys total: ${Object.keys(abaRu).length}`);
  console.log(`Numeric copied as-is: ${numeric}`);
  console.log(`Seeded EN from en.json: ${copiedEn}`);
  console.log(`Seeded KY from ky.json: ${copiedKy}`);
  if (provisional) {
    console.log(`Provisional EN (ABA≠standard RU): ${provisionalEn}`);
    console.log(`Provisional KY (ABA≠standard RU): ${provisionalKy}`);
  }
  console.log(`ABA text differs from standard RU: ${needsTranslate}`);
  if (!provisional) {
    console.log('Run with --provisional to fill EN/KY from standard locales where available.');
    console.log('Then npm run translate:aba-overrides for ABA-specific machine translation.');
  }
}

main();
