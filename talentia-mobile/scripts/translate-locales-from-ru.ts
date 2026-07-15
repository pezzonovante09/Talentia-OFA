/**
 * Перевод строк из ru.json в en.json / ky.json (область по умолчанию: data.*).
 *
 * Переменные окружения (файл talentia-mobile/.env — не коммитить):
 *   GOOGLE_TRANSLATE_API_KEY — ключ Google Cloud Translation API (ru→en и ru→ky)
 *   DEEPL_AUTH_KEY — опционально; если задан, английский переводится через DeepL
 *
 * Запуск из каталога talentia-mobile:
 *   npx tsx scripts/translate-locales-from-ru.ts
 *   npx tsx scripts/translate-locales-from-ru.ts --dry-run
 *   npx tsx scripts/translate-locales-from-ru.ts --prefix data --targets en,ky --force
 *   npx tsx scripts/translate-locales-from-ru.ts --checkpoint scripts/translate-locales.checkpoint.json
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ROOT = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');
const GLOSSARY_PATH = path.join(__dirname, 'translate-glossary.json');

type LocaleDoc = Record<string, unknown>;

function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else if (typeof v === 'string') {
      out[key] = v;
    }
  }
  return out;
}

function setByPath(doc: LocaleDoc, dotted: string, value: string): void {
  const parts = dotted.split('.');
  let cur: Record<string, unknown> = doc;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const next = cur[p];
    if (next === undefined || typeof next !== 'object' || Array.isArray(next)) {
      cur[p] = {};
    }
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function saveJson(file: string, doc: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
}

function loadGlossary(): Array<{ needle: string; placeholder: string }> {
  if (!fs.existsSync(GLOSSARY_PATH)) return [];
  const raw = loadJson<Record<string, string>>(GLOSSARY_PATH);
  return Object.entries(raw)
    .map(([needle, placeholder]) => ({ needle, placeholder }))
    .sort((a, b) => b.needle.length - a.needle.length);
}

function applyGlossary(s: string, glossary: Array<{ needle: string; placeholder: string }>, reverse: boolean): string {
  let out = s;
  if (reverse) {
    for (const { needle, placeholder } of glossary) {
      out = out.split(placeholder).join(needle);
    }
  } else {
    for (const { needle, placeholder } of glossary) {
      out = out.split(needle).join(placeholder);
    }
  }
  return out;
}

const NUMERIC_ONLY = /^[\d\s.,:+\-−×÷=/()%]+$/;

function shouldTranslateLeaf(key: string, value: string): boolean {
  const v = value.trim();
  if (v.length === 0) return false;
  if (NUMERIC_ONLY.test(v)) return false;
  return true;
}

async function translateGoogle(texts: string[], target: string, source = 'ru'): Promise<string[]> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) throw new Error('GOOGLE_TRANSLATE_API_KEY is not set');
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: texts,
      source,
      target,
      format: 'text',
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Google Translate HTTP ${res.status}: ${t.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    data?: { translations?: Array<{ translatedText?: string }> };
  };
  const tr = data.data?.translations;
  if (!tr || tr.length !== texts.length) {
    throw new Error('Google Translate: unexpected response shape');
  }
  return tr.map((x) => x.translatedText ?? '');
}

async function translateDeepL(texts: string[], targetLang: 'EN'): Promise<string[]> {
  const auth = process.env.DEEPL_AUTH_KEY;
  if (!auth) throw new Error('DEEPL_AUTH_KEY is not set');
  const params = new URLSearchParams();
  params.set('auth_key', auth);
  params.set('source_lang', 'RU');
  params.set('target_lang', targetLang);
  for (const t of texts) params.append('text', t);
  const res = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`DeepL HTTP ${res.status}: ${t.slice(0, 500)}`);
  }
  const data = (await res.json()) as { translations?: Array<{ text?: string }> };
  const tr = data.translations;
  if (!tr || tr.length !== texts.length) throw new Error('DeepL: unexpected response');
  return tr.map((x) => x.text ?? '');
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateBatch(
  texts: string[],
  targetLocale: 'en' | 'ky',
  glossary: Array<{ needle: string; placeholder: string }>,
): Promise<string[]> {
  const masked = texts.map((t) => applyGlossary(t, glossary, false));
  let out: string[];
  if (targetLocale === 'en' && process.env.DEEPL_AUTH_KEY) {
    out = await translateDeepL(masked, 'EN');
  } else {
    const googleTarget = targetLocale === 'en' ? 'en' : 'ky';
    out = await translateGoogle(masked, googleTarget);
  }
  return out.map((t) => applyGlossary(t, glossary, true));
}

interface Checkpoint {
  doneKeys: string[];
}

function parseArgs(argv: string[]) {
  let prefix = 'data';
  let targets = ['en', 'ky'] as ('en' | 'ky')[];
  let dryRun = false;
  let force = false;
  let checkpointPath = path.join(__dirname, 'translate-locales.checkpoint.json');
  let batchSize = 48;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prefix' && argv[i + 1]) {
      prefix = argv[++i];
    } else if (a === '--targets' && argv[i + 1]) {
      targets = argv[++i].split(',').map((t) => t.trim()) as ('en' | 'ky')[];
    } else if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '--force') {
      force = true;
    } else if (a === '--checkpoint' && argv[i + 1]) {
      checkpointPath = path.resolve(argv[++i]);
    } else if (a === '--batch-size' && argv[i + 1]) {
      batchSize = Math.max(1, parseInt(argv[++i], 10) || 48);
    }
  }
  return { prefix, targets, dryRun, force, checkpointPath, batchSize };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { prefix, targets, dryRun, force, checkpointPath, batchSize } = parseArgs(argv);

  const needsGoogle =
    targets.includes('ky') ||
    (targets.includes('en') && !process.env.DEEPL_AUTH_KEY?.trim());
  if (!dryRun && needsGoogle && !process.env.GOOGLE_TRANSLATE_API_KEY?.trim()) {
    console.error(
      'Missing GOOGLE_TRANSLATE_API_KEY (required for Kyrgyz; also for English unless DEEPL_AUTH_KEY is set).',
    );
    process.exit(1);
  }

  const glossary = loadGlossary();
  const ruPath = path.join(LOCALES_DIR, 'ru.json');
  const ruDoc = loadJson<LocaleDoc>(ruPath);
  const ruFlat = flatten(
    prefix === 'data' && ruDoc.data ? { data: ruDoc.data as LocaleDoc } : ruDoc,
  );

  let checkpoint: Checkpoint = { doneKeys: [] };
  if (fs.existsSync(checkpointPath)) {
    try {
      checkpoint = loadJson<Checkpoint>(checkpointPath);
    } catch {
      checkpoint = { doneKeys: [] };
    }
  }
  const doneSet = new Set(checkpoint.doneKeys);

  const keysToProcess: string[] = [];
  for (const [k, v] of Object.entries(ruFlat)) {
    if (!k.startsWith(prefix)) continue;
    if (!shouldTranslateLeaf(k, v)) continue;
    keysToProcess.push(k);
  }
  keysToProcess.sort();

  for (const locale of targets) {
    if (locale !== 'en' && locale !== 'ky') continue;
    const outPath = path.join(LOCALES_DIR, `${locale}.json`);
    const outDoc = loadJson<LocaleDoc>(outPath);
    const outFlat = flatten(
      prefix === 'data' && outDoc.data ? { data: outDoc.data as LocaleDoc } : outDoc,
    );

    const missing: string[] = [];
    for (const k of keysToProcess) {
      const ruVal = ruFlat[k];
      const cur = outFlat[k];
      const need =
        force ||
        typeof cur !== 'string' ||
        cur.trim().length === 0 ||
        (locale === 'en' && cur.startsWith('About this topic'));
      if (!need) continue;
      if (!doneSet.has(`${locale}:${k}`)) missing.push(k);
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
        setByPath(outDoc, chunk[j], translated[j]);
        checkpoint.doneKeys.push(`${locale}:${chunk[j]}`);
      }
      saveJson(outPath, outDoc);
      saveJson(checkpointPath, checkpoint);
      console.log(`  wrote ${chunk.length} strings (${i + chunk.length}/${missing.length})`);
      await sleep(120);
    }
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
