/**
 * Classify reaudit #9 enkyFlags: meaning-breaking vs mild/white/other.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_merged.json'), 'utf8'));
const L = data.lessons || [];
const flagged = L.filter((l) => (l.enkyFlags || []).length > 0);

const CRITICAL_RE =
  /critical|hijack|mismatch|invert|неверн|подмен|wrong_skill|wrong.?answer|answer.?ru.?only|translates_english|ru_leak|EN=RU|KY=RU|KY_RU_LEAK|EN_RU_LEAK|en_q_mismatch|options_mismatch|stale_|off_topic|wrong_operation|format_mismatch|stem.*answer|инверс|input_answer_ru_only|input_answer_locale_hardcoded|input_answer_hardcoded|ky_translates|en_letter_mismatch|en_q_wrong|en_q_ambiguous|dialog_enky_wrong|CRITICAL/i;
const WHITE_RE =
  /intentional|cognate|title_ky_eq_ru|title_enky_eq_ru|ky_intro.*eq_ru|aba_ky_copies|numeric|ok for|уместно|ок для|Wave1 OK|сохраняет русск|translit|лемм|gloss|eq_ru_intentional|russian_grammar|same meaning|короче RU|смысл тот же|whitelist|numbers?/i;
const MILD_RE =
  /stub|generic|bare_formula|simplified|weak_distractor|forward_ref|vague|trivia|theme_shift|recap|motivation|без сюжета|беднее|dialog_en_stub|dialog_en_generic|en_bare|dialog_en_theme|en_q_simplified|needs_gloss|opts_yesterday|fragile_input/i;

function classifyFlag(f) {
  const s = String(f);
  if (/CRITICAL|hijack|invert|подмен|неверн/i.test(s)) return 'critical';
  if (WHITE_RE.test(s) && !CRITICAL_RE.test(s)) return 'white';
  if (CRITICAL_RE.test(s)) return 'critical';
  if (MILD_RE.test(s)) return 'mild';
  return 'other';
}

const byClass = { critical: 0, mild: 0, white: 0, other: 0 };
const lessonClass = { critical: [], mild: [], white_only: [], other_only: [], mixed: [] };
const flagCounts = {};

for (const l of flagged) {
  const classes = new Set();
  for (const f of l.enkyFlags) {
    const c = classifyFlag(f);
    byClass[c]++;
    classes.add(c);
    flagCounts[f] = (flagCounts[f] || 0) + 1;
  }
  const hasC = classes.has('critical');
  const hasO = classes.has('other');
  const hasM = classes.has('mild');
  const onlyWhite = [...classes].every((c) => c === 'white');
  if (hasC) lessonClass.critical.push({ id: l.id, flags: l.enkyFlags, c: l.coherence, u: l.usefulness });
  else if (onlyWhite) lessonClass.white_only.push(l.id);
  else if (hasM && !hasO) lessonClass.mild.push(l.id);
  else if (hasO && !hasM) lessonClass.other_only.push(l.id);
  else lessonClass.mixed.push(l.id);
}

// Also count lessons with EN/KY CRITICAL in problems[]
const critInProblems = L.filter((l) =>
  (l.problems || []).some((p) => {
    const t = JSON.stringify(p);
    return /EN\/KY|enky|EN |KY /i.test(t) && /CRITICAL|hijack|invert|неверн|подмен|mismatch/i.test(t);
  }),
);

console.log('flagged lessons:', flagged.length);
console.log('flag instances by class:', byClass);
console.log('');
console.log('LESSONS with meaning-breaking enkyFlags:', lessonClass.critical.length);
console.log('  mild only:', lessonClass.mild.length);
console.log('  white only:', lessonClass.white_only.length);
console.log('  other only:', lessonClass.other_only.length);
console.log('  mixed mild+other:', lessonClass.mixed.length);
console.log('problems[] EN/KY critical/hijack/mismatch:', critInProblems.length);

const both = new Set([
  ...lessonClass.critical.map((x) => x.id),
  ...critInProblems.map((l) => l.id),
]);
console.log('union (flags critical OR problems critical EN/KY):', both.size);

console.log('\n--- meaning-breaking lessons ---');
for (const x of lessonClass.critical) {
  console.log(`${x.id} C${x.c}/U${x.u}`);
  for (const f of x.flags) console.log('   ', classifyFlag(f), f);
}

console.log('\n--- top flags ---');
for (const [f, n] of Object.entries(flagCounts).sort((a, b) => b[1] - a[1]).slice(0, 35)) {
  console.log(n, classifyFlag(f), JSON.stringify(f).slice(0, 140));
}

console.log('\n--- other_only (need manual eye) ---');
for (const id of lessonClass.other_only) {
  const l = flagged.find((x) => x.id === id);
  console.log(id, '::', (l.enkyFlags || []).join(' | ').slice(0, 180));
}

fs.writeFileSync(
  path.join(root, 'scripts/_enky116_classify.json'),
  JSON.stringify(
    {
      flagged: flagged.length,
      byClass,
      meaningBreakingLessons: lessonClass.critical.length,
      mildOnly: lessonClass.mild.length,
      whiteOnly: lessonClass.white_only.length,
      otherOnly: lessonClass.other_only.length,
      mixed: lessonClass.mixed.length,
      problemsEnkyCritical: critInProblems.length,
      union: both.size,
      meaningBreakingIds: lessonClass.critical.map((x) => x.id),
      otherOnlyIds: lessonClass.other_only,
    },
    null,
    2,
  ),
);
