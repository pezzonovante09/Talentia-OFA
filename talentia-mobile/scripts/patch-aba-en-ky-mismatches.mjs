/**
 * One-shot: fix known semantic EN/KY mismatches for ABA overrides + base locales.
 * Run: node scripts/patch-aba-en-ky-mismatches.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "src", "i18n", "locales");

/** @type {Record<string, { en: string; ky: string }>} */
const patches = {
  "data.tasks.g1e_four_plus_one": {
    en: 'How do you say "four" in English?',
    ky: "Англисче «төрт» кандай айтылат?",
  },
  "data.tasks.g4m_cm_q4": {
    en: "Check the answer: 221 × 4 = 864. Is that correct?",
    ky: "Жоопту текшер: 221 × 4 = 864. Туурабы?",
  },
  "data.tasks.g4m_cm_q4_a": {
    en: "No, the correct answer is 884",
    ky: "Жок, туура жооп 884",
  },
  "data.tasks.g4m_cm_q4_b": {
    en: "Yes, it is correct",
    ky: "Ооба, туура",
  },
  "data.tasks.g4m_cm_q4_c": {
    en: "No, the correct answer is 904",
    ky: "Жок, туура жооп 904",
  },
  "data.tasks.g4m_cm3_q4": {
    en: "In 527 × 15, how many rows do you need to add?",
    ky: "527 × 15 мисалында канча сапты кошуу керек?",
  },
  "data.tasks.g4m_cm3_q4_a": { en: "One", ky: "Бир" },
  "data.tasks.g4m_cm3_q4_b": { en: "Two", ky: "Эки" },
  "data.tasks.g4m_cm3_q4_c": { en: "Three", ky: "Үч" },
  "data.tasks.opt_29": { en: "48 tens", ky: "48 ондук" },
  "data.tasks.opt_37": { en: "8 tens", ky: "8 ондук" },
  "data.tasks.opt_42": { en: "4 tens", ky: "4 ондук" },
  "data.tasks.opt_52": { en: "No, 9 × 6 = 52", ky: "Жок, 9 × 6 = 52" },
  "data.tasks.opt_54": { en: "Yes, correct", ky: "Ооба, туура" },
  "data.tasks.opt_56": { en: "No, 9 × 6 = 56", ky: "Жок, 9 × 6 = 56" },
  "data.tasks.opt_78": { en: "Archi (78 > 82)", ky: "Арчи (78 > 82)" },
  "data.tasks.opt_82": { en: "Tali (82 > 78)", ky: "Тали (82 > 78)" },
  "data.tasks.opt_91": { en: "They are equal", ky: "Алар барабар" },
  "data.tasks.opt_two": { en: "Who? What?", ky: "Ким? Эмне?" },
};

function setPath(obj, dotted, val) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
}

function save(name, doc) {
  fs.writeFileSync(path.join(dir, name), `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

const enA = load("abaTextOverrides.en.generated.json");
const kyA = load("abaTextOverrides.ky.generated.json");
const enL = load("en.json");
const kyL = load("ky.json");

for (const [k, v] of Object.entries(patches)) {
  enA[k] = v.en;
  kyA[k] = v.ky;
  setPath(enL, k, v.en);
  setPath(kyL, k, v.ky);
}

save("abaTextOverrides.en.generated.json", enA);
save("abaTextOverrides.ky.generated.json", kyA);
save("en.json", enL);
save("ky.json", kyL);

console.log("Patched", Object.keys(patches).length, "keys in ABA EN/KY + en.json/ky.json");
