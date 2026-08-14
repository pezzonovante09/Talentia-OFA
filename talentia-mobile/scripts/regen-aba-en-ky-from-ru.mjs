/**
 * Regenerate ABA EN/KY overrides from RU ABA for flagged mismatch keys
 * (and option siblings). Does NOT modify RU.
 *
 * Uses the public Google Translate "gtx" endpoint (no API key).
 *
 *   node scripts/regen-aba-en-ky-from-ru.mjs
 *   node scripts/regen-aba-en-ky-from-ru.mjs --dry-run
 *
 * After running this (or any manual edit to the *.generated.json override
 * files), run `npm run check:aba-override-orphans` - it catches the case
 * where an option (…_a/_b/_c) got overridden but its parent question key
 * didn't, which leaves the ABA-mode question mismatched with its own
 * options.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.join(__dirname, "..", "src", "i18n", "locales");
const REPORT = path.join(__dirname, "_aba_en_ky_mismatches.json");
const DRY = process.argv.includes("--dry-run");

const NUMERIC_ONLY = /^[\d\s.,:+\-−×÷=/()%?]+$/u;

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES, name), "utf8"));
}

function save(name, doc) {
  fs.writeFileSync(path.join(LOCALES, name), `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function optionBase(key) {
  const m = key.match(/^(.*)_([a-d])$/i);
  return m ? m[1] : null;
}

function expandKeys(flagged, ruKeys) {
  const set = new Set(flagged);
  for (const key of flagged) {
    const base = optionBase(key) ?? key;
    set.add(base);
    for (const suf of ["_a", "_b", "_c", "_d"]) {
      const k = `${base}${suf}`;
      if (ruKeys.has(k)) set.add(k);
    }
  }
  return [...set].filter((k) => ruKeys.has(k)).sort();
}

async function translateGtx(text, tl) {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=${tl}&dt=t&q=` +
    encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`gtx HTTP ${res.status}`);
  const data = await res.json();
  const out = (data[0] || []).map((x) => x[0]).join("");
  if (!out.trim()) throw new Error("gtx empty");
  return out.trim();
}

async function translateOne(text, target) {
  if (NUMERIC_ONLY.test(text.trim())) return text.trim();
  let lastErr;
  for (let i = 0; i < 4; i++) {
    try {
      return await translateGtx(text, target);
    } catch (e) {
      lastErr = e;
      await sleep(800 * (i + 1));
    }
  }
  throw lastErr;
}

async function main() {
  if (!fs.existsSync(REPORT)) {
    console.error("Missing audit report. Run: npm run audit:aba-en-ky");
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(REPORT, "utf8"));
  const ru = load("abaTextOverrides.generated.json");
  const en = load("abaTextOverrides.en.generated.json");
  const ky = load("abaTextOverrides.ky.generated.json");
  const ruKeys = new Set(Object.keys(ru));

  const flagged = report.mismatches.map((m) => m.key);
  const keys = expandKeys(flagged, ruKeys);

  console.log(`Flagged keys: ${flagged.length}; expanded with siblings: ${keys.length}`);
  if (DRY) {
    console.log("Dry-run sample:", keys.slice(0, 15).join(", "));
    return;
  }

  let done = 0;
  let failed = 0;
  const failures = [];

  for (const key of keys) {
    const src = ru[key];
    if (typeof src !== "string") continue;
    try {
      if (NUMERIC_ONLY.test(src.trim())) {
        en[key] = src.trim();
        ky[key] = src.trim();
      } else {
        en[key] = await translateOne(src, "en");
        await sleep(120);
        ky[key] = await translateOne(src, "ky");
        await sleep(120);
      }
      done += 1;
      if (done % 40 === 0) {
        console.log(`… ${done}/${keys.length}`);
        save("abaTextOverrides.en.generated.json", en);
        save("abaTextOverrides.ky.generated.json", ky);
      }
    } catch (e) {
      failed += 1;
      failures.push({ key, error: String(e?.message || e) });
      console.warn("FAIL", key, e?.message || e);
      await sleep(1500);
    }
  }

  save("abaTextOverrides.en.generated.json", en);
  save("abaTextOverrides.ky.generated.json", ky);

  const failPath = path.join(__dirname, "_aba_en_ky_regen_failures.json");
  fs.writeFileSync(failPath, `${JSON.stringify({ done, failed, failures }, null, 2)}\n`);
  console.log(`Done translated: ${done}, failed: ${failed}`);
  console.log("Next: run `npm run check:aba-override-orphans` to verify no question/option overrides went out of sync.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
