#!/usr/bin/env node
/**
 * Checks that:
 * 1) All literal `data.*` i18n keys referenced from `src/data` exist in ru/en/ky.
 * 2) All literal `t('…')` / `t("…")` keys referenced from `app/` and
 *    `src/components` exist (as non-empty strings) in all three locales.
 *
 * Does not check translation quality, plural-form completeness beyond key
 * presence, or dynamically constructed keys.
 *
 * Run from talentia-mobile:
 *   node scripts/check-i18n.js
 *   node scripts/check-i18n.js --json
 *
 * Exit code: 1 if any locale is missing a referenced key.
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

const asJson = process.argv.includes('--json');
const hasAnyMissing =
  localeNames.some((n) => missingData[n].length > 0) ||
  localeNames.some((n) => missingUi[n].length > 0);

if (asJson) {
  const report = {
    totalDataKeys: dataKeys.size,
    totalUiKeys: uiKeys.size,
  };
  for (const name of localeNames) {
    report[`missing_data_${name}`] = missingData[name];
    report[`missing_ui_${name}`] = missingUi[name];
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
  } else {
    console.log('\nAll i18n keys OK');
  }
}

if (hasAnyMissing) {
  process.exit(1);
}
