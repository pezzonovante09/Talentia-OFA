/**
 * Heuristic semantic audit: ABA RU (source of truth) vs EN/KY overrides.
 * Does NOT modify locale files. Flags structural / skill-level mismatches.
 *
 *   node scripts/audit-aba-en-ky-semantics.mjs
 *   npm run audit:aba-en-ky
 *
 * Outputs:
 *   scripts/_aba_en_ky_mismatches.json
 *   scripts/_aba_en_ky_mismatches.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.join(__dirname, "..", "src", "i18n", "locales");

/** @typedef {'missing'|'stub_en'|'stub_ky'|'digit_vs_words'|'number_token_mismatch'|'length_outlier'|'option_set_inconsistent'|'ok_heuristic'} Category */

const STUB_EN = /^(Think it through:|Decisions:|Solve:|Check:)\s*/i;
const STUB_KY = /^(Ойлонуп көр:|Чеч:|Чечим:)\s*/i;

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES, name), "utf8"));
}

/** Normalize and extract integer tokens (ignore tiny 1–2 digit noise unless alone). */
function numberTokens(text) {
  let raw = String(text ?? "").replace(/\u00a0/g, " ");
  // Collapse thousand separators: 3 475 / 3,475 / 12 080 → 3475 / 12080
  for (let i = 0; i < 4; i++) {
    raw = raw.replace(/(\d)[,\s](\d{3})\b/g, "$1$2");
  }
  const found = raw.match(/\d+/g) || [];
  return [
    ...new Set(
      found
        .map((n) => n.replace(/^0+(?=\d)/, ""))
        .filter((n) => n.length >= 2 || Number(n) >= 10),
    ),
  ].sort();
}

function hasLetters(text, script) {
  if (script === "cyr") return /\p{Script=Cyrillic}/u.test(text);
  return /[a-zA-Z]/.test(text);
}

function isDigitOnly(text) {
  return /^\d{1,4}$/.test(String(text ?? "").trim());
}

function optionBase(key) {
  const m = key.match(/^(.*)_([a-d])$/i);
  return m ? { base: m[1], opt: m[2].toLowerCase() } : null;
}

function isQuestionish(key, ru) {
  if (optionBase(key)) return false;
  if (/_q\d+$/i.test(key) || /_question$/i.test(key)) return true;
  return /[?]|\?$|как |сколько |выбери |что |who |how |what /i.test(ru);
}

/**
 * @returns {Category[]}
 */
function classifyKey(key, ru, en, ky) {
  /** @type {Category[]} */
  const cats = [];
  if (en == null || !String(en).trim()) cats.push("missing");
  if (ky == null || !String(ky).trim()) cats.push("missing");

  const enS = String(en ?? "");
  const kyS = String(ky ?? "");
  const ruS = String(ru ?? "");

  if (enS && STUB_EN.test(enS) && hasLetters(ruS, "cyr") && !/×|÷|\d\s*[+\-*/]\s*\d/.test(ruS)) {
    cats.push("stub_en");
  }
  if (kyS && STUB_KY.test(kyS) && hasLetters(ruS, "cyr") && !/×|÷|\d\s*[+\-*/]\s*\d/.test(ruS)) {
    cats.push("stub_ky");
  }

  if (hasLetters(ruS, "cyr") && enS && isDigitOnly(enS)) cats.push("digit_vs_words");
  if (hasLetters(ruS, "cyr") && kyS && isDigitOnly(kyS)) cats.push("digit_vs_words");

  const ruNums = numberTokens(ruS);
  const enNums = numberTokens(enS);
  const kyNums = numberTokens(kyS);
  if (ruNums.length > 0 && enS) {
    const enOverlap = ruNums.filter((n) => enNums.includes(n));
    if (enOverlap.length === 0 && enNums.length > 0) cats.push("number_token_mismatch");
  }
  if (ruNums.length > 0 && kyS) {
    const kyOverlap = ruNums.filter((n) => kyNums.includes(n));
    if (kyOverlap.length === 0 && kyNums.length > 0) cats.push("number_token_mismatch");
  }

  // Length outlier: ABA RU is short, EN/KY is much longer (or reverse) — often provisional standard copy
  if (ruS.length >= 8 && enS.length >= 8) {
    const ratio = enS.length / ruS.length;
    if (ratio >= 2.5 || ratio <= 0.35) cats.push("length_outlier");
  }
  if (ruS.length >= 8 && kyS.length >= 8) {
    const ratio = kyS.length / ruS.length;
    if (ratio >= 2.5 || ratio <= 0.35) cats.push("length_outlier");
  }

  if (cats.length === 0) cats.push("ok_heuristic");
  return [...new Set(cats)];
}

function main() {
  const ru = load("abaTextOverrides.generated.json");
  const en = load("abaTextOverrides.en.generated.json");
  const ky = load("abaTextOverrides.ky.generated.json");

  const keys = Object.keys(ru).sort();
  /** @type {Array<{key:string,ru:string,en:string|null,ky:string|null,categories:Category[]}>} */
  const rows = [];

  for (const key of keys) {
    const categories = classifyKey(key, ru[key], en[key], ky[key]);
    rows.push({
      key,
      ru: ru[key],
      en: en[key] ?? null,
      ky: ky[key] ?? null,
      categories,
    });
  }

  // Propagate: if a question key is flagged, include sibling options in a dedicated bucket
  const flaggedQuestionBases = new Set();
  for (const row of rows) {
    if (row.categories.includes("ok_heuristic")) continue;
    if (isQuestionish(row.key, row.ru)) {
      flaggedQuestionBases.add(row.key);
    }
  }

  for (const row of rows) {
    const ob = optionBase(row.key);
    if (!ob) continue;
    if (flaggedQuestionBases.has(ob.base) && row.categories.includes("ok_heuristic")) {
      row.categories = ["option_set_inconsistent"];
    } else if (flaggedQuestionBases.has(ob.base) && !row.categories.includes("option_set_inconsistent")) {
      // keep existing flags; also mark set
      row.categories = [...new Set([...row.categories, "option_set_inconsistent"])];
    }
  }

  const mismatches = rows.filter((r) => !r.categories.includes("ok_heuristic") || r.categories.length > 1);
  // ok_heuristic alone = fine; if only ok_heuristic, exclude
  const bad = rows.filter((r) => !(r.categories.length === 1 && r.categories[0] === "ok_heuristic"));

  /** @type {Record<string, number>} */
  const byCategory = {};
  for (const r of bad) {
    for (const c of r.categories) {
      if (c === "ok_heuristic") continue;
      byCategory[c] = (byCategory[c] || 0) + 1;
    }
  }

  const summary = {
    ruKeys: keys.length,
    enKeys: Object.keys(en).length,
    kyKeys: Object.keys(ky).length,
    mismatchKeys: bad.length,
    okKeys: keys.length - bad.length,
    byCategory,
    generatedAt: new Date().toISOString(),
  };

  const jsonOut = {
    summary,
    mismatches: bad.map((r) => ({
      key: r.key,
      categories: r.categories.filter((c) => c !== "ok_heuristic"),
      ru: r.ru,
      en: r.en,
      ky: r.ky,
    })),
  };

  const jsonPath = path.join(__dirname, "_aba_en_ky_mismatches.json");
  const mdPath = path.join(__dirname, "_aba_en_ky_mismatches.md");
  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonOut, null, 2)}\n`, "utf8");

  const lines = [
    "# ABA EN/KY semantic mismatches (heuristic)",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "## Summary",
    "",
    `- RU ABA keys: **${summary.ruKeys}**`,
    `- EN override keys: **${summary.enKeys}**`,
    `- KY override keys: **${summary.kyKeys}**`,
    `- Flagged (any mismatch category): **${summary.mismatchKeys}**`,
    `- OK (heuristic): **${summary.okKeys}**`,
    "",
    "### By category",
    "",
    ...Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `- \`${c}\`: ${n}`),
    "",
    "> Heuristic only — not full human semantic review. `length_outlier` often means EN/KY still holds the long standard-locale wording while RU ABA is shortened (same skill possible).",
    "",
    "## Mismatches",
    "",
  ];

  for (const r of jsonOut.mismatches) {
    lines.push(`### \`${r.key}\``);
    lines.push("");
    lines.push(`- **categories:** ${r.categories.join(", ")}`);
    lines.push(`- **RU:** ${JSON.stringify(r.ru)}`);
    lines.push(`- **EN:** ${JSON.stringify(r.en)}`);
    lines.push(`- **KY:** ${JSON.stringify(r.ky)}`);
    lines.push("");
  }

  fs.writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`Wrote ${path.relative(process.cwd(), mdPath)}`);
  // Non-zero exit if any hard skill mismatches (stubs / digits / number tokens)
  const hard =
    (byCategory.stub_en || 0) +
    (byCategory.stub_ky || 0) +
    (byCategory.digit_vs_words || 0) +
    (byCategory.number_token_mismatch || 0) +
    (byCategory.missing || 0);
  if (hard > 0) {
    console.error(`Hard mismatch signals: ${hard}`);
    process.exitCode = 1;
  }
}

main();
