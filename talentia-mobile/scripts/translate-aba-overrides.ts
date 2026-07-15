/**
 * Перевод src/i18n/locales/abaTextOverrides.generated.json (RU) →
 * abaTextOverrides.en.generated.json / abaTextOverrides.ky.generated.json
 *
 * Ключи API — в talentia-mobile/.env (см. scripts/translate-locales-from-ru.ts).
 *
 *   cd talentia-mobile && npm run translate:aba-overrides
 *   npx tsx scripts/translate-aba-overrides.ts --dry-run
 *   npx tsx scripts/translate-aba-overrides.ts --targets en --force
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  loadGlossary,
  shouldTranslateValue,
  sleep,
  translateBatch,
} from './lib/translate-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');
const RU_PATH = path.join(LOCALES_DIR, 'abaTextOverrides.generated.json');

interface Checkpoint {
  doneKeys: string[];
}

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

function parseArgs(argv: string[]) {
  let targets = ['en', 'ky'] as ('en' | 'ky')[];
  let dryRun = false;
  let force = false;
  let onlyChanged = true;
  let checkpointPath = path.join(__dirname, 'translate-aba-overrides.checkpoint.json');
  let batchSize = 48;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--targets' && argv[i + 1]) {
      targets = argv[++i].split(',').map((t) => t.trim()) as ('en' | 'ky')[];
    } else if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '--force') {
      force = true;
      onlyChanged = false;
    } else if (a === '--all') {
      onlyChanged = false;
    } else if (a === '--checkpoint' && argv[i + 1]) {
      checkpointPath = path.resolve(argv[++i]);
    } else if (a === '--batch-size' && argv[i + 1]) {
      batchSize = Math.max(1, parseInt(argv[++i], 10) || 48);
    }
  }
  return { targets, dryRun, force, onlyChanged, checkpointPath, batchSize };
}

async function main(): Promise<void> {
  const { targets, dryRun, force, onlyChanged, checkpointPath, batchSize } = parseArgs(process.argv.slice(2));

  const needsGoogle =
    targets.includes('ky') ||
    (targets.includes('en') && !process.env.DEEPL_AUTH_KEY?.trim());
  if (!dryRun && needsGoogle && !process.env.GOOGLE_TRANSLATE_API_KEY?.trim()) {
    console.error(
      'Missing GOOGLE_TRANSLATE_API_KEY (required for Kyrgyz; also for English unless DEEPL_AUTH_KEY is set).',
    );
    process.exit(1);
  }

  if (!fs.existsSync(RU_PATH)) {
    console.error(`Missing ${RU_PATH}. Run: npm run import:curriculum-aba-ru`);
    process.exit(1);
  }

  const ruFlat = loadJson<Record<string, string>>(RU_PATH);
  const ruDoc = loadJson<Record<string, unknown>>(path.join(LOCALES_DIR, 'ru.json'));
  const glossary = loadGlossary();

  let checkpoint: Checkpoint = { doneKeys: [] };
  if (fs.existsSync(checkpointPath)) {
    try {
      checkpoint = loadJson<Checkpoint>(checkpointPath);
    } catch {
      checkpoint = { doneKeys: [] };
    }
  }
  const doneSet = new Set(checkpoint.doneKeys);

  const keysToProcess = Object.keys(ruFlat)
    .filter((k) => {
      if (!shouldTranslateValue(ruFlat[k] ?? '')) return false;
      if (!onlyChanged) return true;
      const standardRu = getByPath(ruDoc, k);
      return ruFlat[k] !== standardRu;
    })
    .sort();

  if (onlyChanged) {
    console.log(`Mode: only ABA-changed strings (${keysToProcess.length} keys). Use --all for full retranslate.`);
  }

  for (const locale of targets) {
    if (locale !== 'en' && locale !== 'ky') continue;
    const outPath = path.join(LOCALES_DIR, `abaTextOverrides.${locale}.generated.json`);
    const outFlat: Record<string, string> = fs.existsSync(outPath)
      ? loadJson<Record<string, string>>(outPath)
      : {};

    const missing: string[] = [];
    const keysForLocale = new Set(keysToProcess);
    if (onlyChanged) {
      for (const k of Object.keys(ruFlat)) {
        if (!shouldTranslateValue(ruFlat[k] ?? '')) continue;
        if (outFlat[k]?.trim()) continue;
        keysForLocale.add(k);
      }
    }
    for (const k of [...keysForLocale].sort()) {
      const cur = outFlat[k];
      if (!force && !onlyChanged && typeof cur === 'string' && cur.trim()) continue;
      if (doneSet.has(`${locale}:${k}`)) continue;
      missing.push(k);
    }

    console.log(`[${locale}] keys to translate: ${missing.length}${dryRun ? ' (dry-run)' : ''}`);
    if (missing.length === 0) continue;

    if (dryRun) {
      console.log(`  sample: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`);
      continue;
    }

    for (let i = 0; i < missing.length; i += batchSize) {
      const chunk = missing.slice(i, i + batchSize);
      const ruTexts = chunk.map((k) => ruFlat[k]);
      let attempts = 0;
      let translated: string[] = [];
      for (;;) {
        try {
          translated = await translateBatch(ruTexts, locale, glossary);
          break;
        } catch (e) {
          attempts += 1;
          if (attempts >= 5) throw e;
          const wait = 800 * 2 ** attempts;
          console.warn(`retry ${attempts} after error:`, e, `(sleep ${wait}ms)`);
          await sleep(wait);
        }
      }
      for (let j = 0; j < chunk.length; j++) {
        outFlat[chunk[j]] = translated[j];
        checkpoint.doneKeys.push(`${locale}:${chunk[j]}`);
      }
      saveJson(outPath, outFlat);
      saveJson(checkpointPath, checkpoint);
      console.log(`  wrote ${chunk.length} strings (${i + chunk.length}/${missing.length})`);
      await sleep(120);
    }
  }

  // Copy numeric-only / empty keys verbatim from RU so every locale has full key set
  if (!dryRun) {
    for (const locale of targets) {
      if (locale !== 'en' && locale !== 'ky') continue;
      const outPath = path.join(LOCALES_DIR, `abaTextOverrides.${locale}.generated.json`);
      const outFlat: Record<string, string> = fs.existsSync(outPath)
        ? loadJson<Record<string, string>>(outPath)
        : {};
      for (const [k, v] of Object.entries(ruFlat)) {
        if (!shouldTranslateValue(v)) outFlat[k] = v;
      }
      const sorted = Object.keys(outFlat).sort();
      const sortedOut: Record<string, string> = {};
      for (const k of sorted) sortedOut[k] = outFlat[k];
      saveJson(outPath, sortedOut);
      console.log(`[${locale}] total keys: ${sorted.length}`);
    }
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
