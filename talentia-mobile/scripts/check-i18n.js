#!/usr/bin/env node
/**
 * Checks that:
 * 1) All literal `data.*` i18n keys referenced from `src/data` exist in ru/en/ky.
 * 2) All literal `t('…')` / `t("…")` keys referenced from `app/` and
 *    `src/components` exist (as non-empty strings) in all three locales.
 * 3) No EN/KY value is byte-identical (after trimming leading/trailing
 *    whitespace) to its RU counterpart while containing Cyrillic text — a
 *    strong signal of leaked, untranslated Russian content (see the
 *    2026-08-12 audit) — unless the key is in
 *    scripts/i18n-ru-identity-allowlist.json (Russian-language lessons,
 *    proper nouns, and genuine Kyrgyz loanwords are expected to match RU).
 *    Trimming before comparing matters: a stray leading/trailing space on an
 *    otherwise-untranslated value previously defeated this check entirely
 *    (see the 2026-08-29 audit — 51 raw-Russian ky.json values were hidden
 *    this way).
 * 4) No locale value has leading/trailing whitespace at all — this is what
 *    let issue (3) hide 51 real leaks, so it's checked independently too.
 *
 * Does not check translation quality beyond this identity heuristic, plural-form
 * completeness beyond key presence, or dynamically constructed keys.
 *
 * Run from talentia-mobile:
 *   node scripts/check-i18n.js
 *   node scripts/check-i18n.js --json
 *
 * Exit code: 1 if any locale is missing a referenced key, or has an
 * unallowlisted RU-identity match.
 */

/* global __dirname */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** Recursively collect .ts/.tsx files under dir, skipping tests. */
function collectTsFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const CONTENT_FILES = collectTsFiles(path.join(ROOT, 'src', 'data'));
const UI_FILES = [
  ...collectTsFiles(path.join(ROOT, 'app')),
  ...collectTsFiles(path.join(ROOT, 'src', 'components')),
];

/** Literal data.* keys in content files. */
const DATA_KEY_RE = /['"`](data\.[A-Za-z0-9_.]+)['"`]/g;

/**
 * Literal t('key') / t("key") calls. Skips template literals and keys that
 * clearly look like plurals we only check as the base form via presence of
 * any of the i18next suffixes when looking up (see resolveLocaleValue).
 */
const T_KEY_RE = /\bt\(\s*['"]([A-Za-z0-9_.]+)['"]/g;

function extractKeysFromFile(filePath, re) {
  const text = fs.readFileSync(filePath, 'utf8');
  const keys = new Set();
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

function loadLocale(name) {
  const file = path.join(LOCALES_DIR, `${name}.json`);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return flatten(raw);
}

/**
 * A key counts as present if the exact leaf exists, OR (for pluralized keys)
 * any of the common i18next v4 suffixes exists (_one/_few/_many/_other/_zero).
 */
function localeHasKey(flat, key) {
  const v = flat[key];
  if (typeof v === 'string' && v.length > 0) return true;
  const suffixes = ['_one', '_few', '_many', '_other', '_zero'];
  return suffixes.some((s) => {
    const sv = flat[key + s];
    return typeof sv === 'string' && sv.length > 0;
  });
}

const dataKeys = new Set();
for (const f of CONTENT_FILES) {
  for (const k of extractKeysFromFile(f, DATA_KEY_RE)) dataKeys.add(k);
}

const uiKeys = new Set();
for (const f of UI_FILES) {
  for (const k of extractKeysFromFile(f, T_KEY_RE)) {
    // data.* already covered by the content scan; skip to avoid double-report noise.
    if (k.startsWith('data.')) continue;
    uiKeys.add(k);
  }
}

const localeNames = ['ru', 'en', 'ky'];
const locales = {};
for (const name of localeNames) {
  locales[name] = loadLocale(name);
}

const missingData = {};
const missingUi = {};
for (const name of localeNames) {
  missingData[name] = [];
  missingUi[name] = [];
}

for (const key of [...dataKeys].sort()) {
  for (const name of localeNames) {
    if (!localeHasKey(locales[name], key)) missingData[name].push(key);
  }
}

for (const key of [...uiKeys].sort()) {
  for (const name of localeNames) {
    if (!localeHasKey(locales[name], key)) missingUi[name].push(key);
  }
}

// ── RU-identity check: EN/KY values that are byte-identical to RU while ──
// containing Cyrillic text are almost always leaked, untranslated Russian
// content rather than a real translation. Allowlisted for cases where that's
// wrong (Russian-language lessons, phonics content, loanwords, proper nouns).
const CYRILLIC_RE = /[Ѐ-ӿ]/;
const ALLOWLIST_PATH = path.join(__dirname, 'i18n-ru-identity-allowlist.json');
const allowlistRaw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
const allowPatterns = allowlistRaw.patterns.map((p) => ({
  re: new RegExp(p.re),
  locales: p.locales,
}));
const allowKeys = { en: new Set(allowlistRaw.keys.en || []), ky: new Set(allowlistRaw.keys.ky || []) };

function isRuIdentityAllowed(key, locale) {
  if (allowKeys[locale] && allowKeys[locale].has(key)) return true;
  return allowPatterns.some((p) => p.locales.includes(locale) && p.re.test(key));
}

function loadRawLocale(name) {
  const file = path.join(LOCALES_DIR, `${name}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function findRuIdentityLeaks(ruNode, targetNode, locale, keyPath, out) {
  if (typeof ruNode === 'string') {
    if (typeof targetNode !== 'string') return;
    if (
      ruNode.trim() === targetNode.trim() &&
      CYRILLIC_RE.test(ruNode) &&
      ruNode.trim().length > 3 &&
      !isRuIdentityAllowed(keyPath, locale)
    ) {
      out.push(keyPath);
    }
    return;
  }
  if (ruNode && typeof ruNode === 'object') {
    for (const k of Object.keys(ruNode)) {
      if (targetNode && typeof targetNode === 'object' && k in targetNode) {
        findRuIdentityLeaks(ruNode[k], targetNode[k], locale, keyPath ? `${keyPath}.${k}` : k, out);
      }
    }
  }
}

const rawRu = loadRawLocale('ru');
const ruIdentityLeaks = { en: [], ky: [] };
for (const locale of ['en', 'ky']) {
  findRuIdentityLeaks(rawRu, loadRawLocale(locale), locale, '', ruIdentityLeaks[locale]);
}
const hasAnyRuIdentityLeak = ruIdentityLeaks.en.length > 0 || ruIdentityLeaks.ky.length > 0;

// ── EN-identity check: KY values byte-identical to EN while containing no ──
// Cyrillic at all are a different failure mode — untranslated English text
// (rather than Russian) left in the Kyrgyz locale. Allowlisted for English
// lessons, where the content is legitimately the English being taught.
const LATIN_WORD_RE = /\b[a-zA-Z]{3,}\b/;
const enIdentityPatterns = (allowlistRaw.en_identity_patterns || []).map((p) => new RegExp(p.re));

function isEnIdentityAllowed(key) {
  return enIdentityPatterns.some((re) => re.test(key));
}

function findEnIdentityLeaks(enNode, kyNode, keyPath, out) {
  if (typeof enNode === 'string') {
    if (typeof kyNode !== 'string') return;
    if (
      enNode.trim() === kyNode.trim() &&
      LATIN_WORD_RE.test(enNode) &&
      !CYRILLIC_RE.test(enNode) &&
      enNode.trim().split(/\s+/).length >= 3 &&
      !isEnIdentityAllowed(keyPath)
    ) {
      out.push(keyPath);
    }
    return;
  }
  if (enNode && typeof enNode === 'object') {
    for (const k of Object.keys(enNode)) {
      if (kyNode && typeof kyNode === 'object' && k in kyNode) {
        findEnIdentityLeaks(enNode[k], kyNode[k], keyPath ? `${keyPath}.${k}` : k, out);
      }
    }
  }
}

const enIdentityLeaksKy = [];
findEnIdentityLeaks(loadRawLocale('en'), loadRawLocale('ky'), '', enIdentityLeaksKy);
const hasAnyEnIdentityLeak = enIdentityLeaksKy.length > 0;

// ── Whitespace-boundary check: a leading/trailing space on a locale value ──
// is always a bug (renders as a stray gap, and previously masked real
// untranslated-content leaks from the checks above — see the 2026-08-29 audit).
function findWhitespaceBoundaryIssues(node, keyPath, out) {
  if (typeof node === 'string') {
    if (node.length > 0 && node.trim() !== node) out.push(keyPath);
    return;
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      findWhitespaceBoundaryIssues(node[k], keyPath ? `${keyPath}.${k}` : k, out);
    }
  }
}

const whitespaceIssues = {};
for (const name of localeNames) {
  whitespaceIssues[name] = [];
  findWhitespaceBoundaryIssues(loadRawLocale(name), '', whitespaceIssues[name]);
}
const hasAnyWhitespaceIssue = localeNames.some((n) => whitespaceIssues[n].length > 0);

const asJson = process.argv.includes('--json');
const hasAnyMissing =
  localeNames.some((n) => missingData[n].length > 0) ||
  localeNames.some((n) => missingUi[n].length > 0);
const hasAnyIssue = hasAnyMissing || hasAnyRuIdentityLeak || hasAnyEnIdentityLeak || hasAnyWhitespaceIssue;

if (asJson) {
  const report = {
    totalDataKeys: dataKeys.size,
    totalUiKeys: uiKeys.size,
  };
  for (const name of localeNames) {
    report[`missing_data_${name}`] = missingData[name];
    report[`missing_ui_${name}`] = missingUi[name];
  }
  report.ru_identity_leaks_en = ruIdentityLeaks.en;
  report.ru_identity_leaks_ky = ruIdentityLeaks.ky;
  report.en_identity_leaks_ky = enIdentityLeaksKy;
  for (const name of localeNames) {
    report[`whitespace_boundary_${name}`] = whitespaceIssues[name];
  }
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Checked ${CONTENT_FILES.length} content file(s) and ${UI_FILES.length} UI file(s).`);
  console.log(`Total unique data.* keys: ${dataKeys.size}`);
  console.log(`Total unique UI t() keys: ${uiKeys.size}`);
  for (const name of localeNames) {
    const d = missingData[name].length;
    const u = missingUi[name].length;
    console.log(`  ${name}: data ${d === 0 ? 'OK' : `${d} missing`}, ui ${u === 0 ? 'OK' : `${u} missing`}`);
  }
  console.log(
    `  ru-identity: en ${ruIdentityLeaks.en.length === 0 ? 'OK' : `${ruIdentityLeaks.en.length} leaked`}, ` +
      `ky ${ruIdentityLeaks.ky.length === 0 ? 'OK' : `${ruIdentityLeaks.ky.length} leaked`}`,
  );
  console.log(`  en-identity: ky ${enIdentityLeaksKy.length === 0 ? 'OK' : `${enIdentityLeaksKy.length} leaked`}`);
  console.log(
    `  whitespace: ${localeNames.map((n) => `${n} ${whitespaceIssues[n].length === 0 ? 'OK' : `${whitespaceIssues[n].length} bad`}`).join(', ')}`,
  );

  if (hasAnyMissing) {
    for (const name of localeNames) {
      if (missingData[name].length) {
        console.log(`\n--- missing data.* in ${name} (first 100) ---`);
        missingData[name].slice(0, 100).forEach((k) => console.log(`  ${k}`));
      }
      if (missingUi[name].length) {
        console.log(`\n--- missing UI t() keys in ${name} ---`);
        missingUi[name].forEach((k) => console.log(`  ${k}`));
      }
    }
  }
  if (hasAnyRuIdentityLeak) {
    for (const locale of ['en', 'ky']) {
      if (ruIdentityLeaks[locale].length) {
        console.log(`\n--- ${locale} values byte-identical to RU (untranslated leak, first 100) ---`);
        ruIdentityLeaks[locale].slice(0, 100).forEach((k) => console.log(`  ${k}`));
        console.log(
          `If any of these are legitimate (loanword, proper noun, or Russian-language lesson ` +
            `content), add them to scripts/i18n-ru-identity-allowlist.json — do not ignore this check.`,
        );
      }
    }
  }
  if (hasAnyEnIdentityLeak) {
    console.log(`\n--- ky values byte-identical to EN (untranslated English leak, first 100) ---`);
    enIdentityLeaksKy.slice(0, 100).forEach((k) => console.log(`  ${k}`));
    console.log(
      `If any of these are legitimate (English-lesson content being taught), add them to ` +
        `en_identity_patterns in scripts/i18n-ru-identity-allowlist.json — do not ignore this check.`,
    );
  }
  if (hasAnyWhitespaceIssue) {
    for (const name of localeNames) {
      if (whitespaceIssues[name].length) {
        console.log(`\n--- ${name} values with leading/trailing whitespace (first 100) ---`);
        whitespaceIssues[name].slice(0, 100).forEach((k) => console.log(`  ${k}`));
      }
    }
  }
  if (!hasAnyIssue) {
    console.log('\nAll i18n keys OK');
  }
}

if (hasAnyIssue) {
  process.exit(1);
}
