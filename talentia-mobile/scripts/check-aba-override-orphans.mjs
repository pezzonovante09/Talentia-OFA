/**
 * Guards against "orphaned option override" bugs in the ABA text overrides:
 * a multiple_choice option (…_a/_b/_c/_d) gets an EN or KY override while its
 * parent question key does not, so the ABA-mode screen would show the
 * STANDARD (non-ABA) question text next to ABA-overridden option text -
 * option values that may no longer make sense for that question (e.g. the
 * question still asks "Does the word MYACH have a soft sign? Yes/No", but
 * one of the options was overridden to a plain number from a differently
 * worded ABA question).
 *
 * Does NOT modify locale files. Exits non-zero if any orphan is found, so it
 * can gate CI or be run manually after scripts/regen-aba-en-ky-from-ru.mjs.
 *
 *   node scripts/check-aba-override-orphans.mjs
 *   npm run check:aba-override-orphans
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.join(__dirname, "..", "src", "i18n", "locales");

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES, name), "utf8"));
}

function flatten(obj, prefix, out) {
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    const key = prefix ? `${prefix}.${k}` : k;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      flatten(val, key, out);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function diffKeys(abaMap, stdMap) {
  return new Set(
    Object.keys(abaMap).filter(
      (k) => typeof abaMap[k] === "string" && stdMap[k] !== undefined && abaMap[k] !== stdMap[k],
    ),
  );
}

function findOrphans(langLabel, abaMap, stdMap) {
  const overridden = diffKeys(abaMap, stdMap);
  const orphans = [];
  for (const key of overridden) {
    const m = key.match(/^(.*)_([a-d])$/);
    if (!m) continue;
    const base = m[1];
    if (stdMap[base] === undefined) continue; // base isn't a real question key (e.g. dead/unused sibling)
    if (!overridden.has(base)) {
      orphans.push({ lang: langLabel, optionKey: key, questionKey: base });
    }
  }
  return orphans;
}

function main() {
  const en = flatten(load("en.json"), "", {});
  const ky = flatten(load("ky.json"), "", {});
  const enAba = load("abaTextOverrides.en.generated.json");
  const kyAba = load("abaTextOverrides.ky.generated.json");

  const orphans = [...findOrphans("EN", enAba, en), ...findOrphans("KY", kyAba, ky)];

  if (orphans.length === 0) {
    console.log("OK: no orphaned ABA option overrides (every overridden option's question is also overridden).");
    return;
  }

  console.error(`Found ${orphans.length} orphaned ABA option override(s):`);
  for (const o of orphans) {
    console.error(`  [${o.lang}] ${o.optionKey} is overridden but ${o.questionKey} is not`);
  }
  console.error(
    "\nFix: add an override for the question key too (mirroring the RU ABA override in " +
      "abaTextOverrides.generated.json), so the ABA-mode question matches its own options.",
  );
  process.exitCode = 1;
}

main();
