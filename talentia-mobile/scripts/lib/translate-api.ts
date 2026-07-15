import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TRANSLATE_GLOSSARY_PATH = path.join(__dirname, '..', 'translate-glossary.json');

export function loadGlossary(): Array<{ needle: string; placeholder: string }> {
  if (!fs.existsSync(TRANSLATE_GLOSSARY_PATH)) return [];
  const raw = JSON.parse(fs.readFileSync(TRANSLATE_GLOSSARY_PATH, 'utf8')) as Record<string, string>;
  return Object.entries(raw)
    .map(([needle, placeholder]) => ({ needle, placeholder }))
    .sort((a, b) => b.needle.length - a.needle.length);
}

export function applyGlossary(
  s: string,
  glossary: Array<{ needle: string; placeholder: string }>,
  reverse: boolean,
): string {
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

export const NUMERIC_ONLY = /^[\d\s.,:+\-−×÷=/()%]+$/;

export function shouldTranslateValue(value: string): boolean {
  const v = value.trim();
  if (v.length === 0) return false;
  if (NUMERIC_ONLY.test(v)) return false;
  return true;
}

export async function translateGoogle(texts: string[], target: string, source = 'ru'): Promise<string[]> {
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

export async function translateDeepL(texts: string[], targetLang: 'EN'): Promise<string[]> {
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

export async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function translateBatch(
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
