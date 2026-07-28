/**
 * Stricter count: which of 116 enky lessons actually break meaning in EN/KY.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_merged.json'), 'utf8'));
const L = data.lessons || [];
const flagged = L.filter((l) => (l.enkyFlags || []).length > 0);

// Hard: wrong question/answer/skill, inverted stem, EN still Russian, KY translates English targets
const HARD =
  /CRITICAL|hijack|invert|подмен|неверн|mismatch|wrong_topic|wrong_operation|wrong_en_letter|en=ru|en_eq_ru|EN=RU|EN_RU|Cyrillic|circular|tautolog|translates_english|ky_translates|letter_mismatch|en_q_wrong|stem inverted|how_much_vs_yes|addition_not_subtraction|topic drift|topic_drift|meaning-check tautology|asks_F|ELEPHANT|wrong_skill|format_mismatch|enky_mismatch|intro_enky_wrong|intro0_enky|intro2_enky|intro_en_says|intro_title_enky_says|dialog_enky_wrong|task direction flipped/i;

// Soft: input answer only accepts Russian → EN/KY player cannot succeed (runtime break)
const SOFT_INPUT =
  /input_answer_ru_only|input_answer_hardcoded|input_answer_locale_hardcoded|RU-locked|RU_locked|answer_ru_only|hardcoded_ru/i;

// Not meaning: stubs, style, ABA presence, intentional RU lemmas, title copies, bare formulas
const NOISE =
  /^(has_aba_tasks|aba_dense)$|stub|generic|bare_formula|bare equation|голые уравнен|без контекста|flattened|Wave1 OK|intentional|cognate|title_ky_eq|title_enky_eq|ky_intro.*eq_ru|gloss|уместно|ок для|смысл тот же|короче RU|bilingual scale|needs_gloss|weak_distractor|forward_ref|trivia|motivation|recap|беднее|dialog_tali_stub|dialog_en_generic|en_intro_generic|ky_intro_generic|opts_enky_eq_ru_intentional|russian_grammar|term loan|Экосистема/i;

function bucketLesson(l) {
  const flags = (l.enkyFlags || []).map(String);
  const probs = (l.problems || []).map((p) => JSON.stringify(p)).join(' ');
  const blob = flags.join('\n') + '\n' + probs;

  const hardFlags = flags.filter((f) => HARD.test(f) && !NOISE.test(f));
  const softFlags = flags.filter((f) => SOFT_INPUT.test(f));
  const hardProb = /EN\/KY|enky/i.test(probs) && /CRITICAL|hijack|invert|mismatch|circular|tautolog/i.test(probs);

  // eq_ru_question on full sentences (not single cognate words) = hard leak
  const eqRu = flags.filter((f) => /^(ky|en|aba_ky|aba_en)_eq_ru/i.test(f) || /ky=ru:|en=ru/i.test(f));
  const kyStillRu = flags.filter((f) => /ky_q_still_russian|KY t\d.*RU-leak|RU-leak|ky_eq_ru_question|en_eq_ru_question/i.test(f));

  if (hardFlags.length || hardProb || eqRu.length >= 2 || kyStillRu.length) {
    return { bucket: 'hard', hardFlags, softFlags, eqRu, kyStillRu };
  }
  if (softFlags.length || /Input answer RU-locked|RU-locked/i.test(blob)) {
    return { bucket: 'soft_input', hardFlags, softFlags };
  }
  // leftover other that might still be soft meaning
  const leftover = flags.filter((f) => !NOISE.test(f) && !SOFT_INPUT.test(f));
  if (leftover.length && /intro_ky_mixed|intro_ky_partial|locale_drift|ambiguous_correct|feather_fur|dialog_en_tali_tautology|part_count/i.test(leftover.join(' '))) {
    return { bucket: 'soft_other', leftover };
  }
  return { bucket: 'noise', flags };
}

const groups = { hard: [], soft_input: [], soft_other: [], noise: [] };
for (const l of flagged) {
  const r = bucketLesson(l);
  groups[r.bucket].push({ id: l.id, ...r, flags: l.enkyFlags });
}

console.log('Of', flagged.length, 'enky-flagged lessons:');
console.log('  HARD meaning break (wrong Q/A, leak, invert, tautology):', groups.hard.length);
console.log('  SOFT runtime (RU-only input answer):', groups.soft_input.length);
console.log('  SOFT other (partial drift):', groups.soft_other.length);
console.log('  NOT meaning (stubs/style/ABA marker/whitelist):', groups.noise.length);
console.log('');
console.log('HARD+SOFT that break EN/KY play:', groups.hard.length + groups.soft_input.length + groups.soft_other.length);
console.log('');
console.log('HARD ids:');
for (const x of groups.hard) console.log(' ', x.id, '|', (x.hardFlags || x.flags || []).slice(0, 2).join('; '));
console.log('\nSOFT_INPUT ids:');
for (const x of groups.soft_input) console.log(' ', x.id);
console.log('\nSOFT_OTHER ids:');
for (const x of groups.soft_other) console.log(' ', x.id, '|', (x.leftover || []).join('; '));
console.log('\nNOISE sample (first 20):');
for (const x of groups.noise.slice(0, 20)) console.log(' ', x.id, '|', (x.flags || []).slice(0, 2).join('; '));

fs.writeFileSync(
  path.join(root, 'scripts/_enky116_meaning.json'),
  JSON.stringify(
    {
      total: flagged.length,
      hard: groups.hard.length,
      soft_input: groups.soft_input.length,
      soft_other: groups.soft_other.length,
      noise: groups.noise.length,
      meaningBreakTotal: groups.hard.length + groups.soft_input.length + groups.soft_other.length,
      hardIds: groups.hard.map((x) => x.id),
      softInputIds: groups.soft_input.map((x) => x.id),
      softOtherIds: groups.soft_other.map((x) => x.id),
    },
    null,
    2,
  ),
);
