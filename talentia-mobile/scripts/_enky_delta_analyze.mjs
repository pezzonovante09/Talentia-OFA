import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const after4 = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_merged.snapshot_after_wave1.json'), 'utf8'),
);
const after5 = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_merged.snapshot_after_wave2.json'), 'utf8'),
);
const a4 = after4.lessons || after4;
const a5 = after5.lessons || after5;
const by4 = Object.fromEntries(a4.map((l) => [l.id, l]));
const by5 = Object.fromEntries(a5.map((l) => [l.id, l]));

const wave2Touched = new Set([
  'g2m-100-l2',
  'forest-v-l2',
  'g3r-gen-l1',
  'g3r-verb-l2',
  'g3r-adj-l1',
  'g3w-nat-l1',
  'g4r-text-l3',
  'g4e-quest-l2',
  'g4s-emo-l2',
  'lab-physics-1',
]);

function classify(flags) {
  const f = (flags || []).join(' || ');
  const cats = [];
  if (/ky_eq_ru|KY\s*=\s*RU|остаются на русском|RU copies|KY.*RU/i.test(f)) cats.push('ky_eq_ru_or_ru_leak');
  if (/en_bare_formula|bare/i.test(f)) cats.push('en_bare_formula');
  if (/answer_hardcoded|hardcoded/i.test(f)) cats.push('answer_hardcoded_RU');
  if (/circular/i.test(f)) cats.push('en_circular_gloss');
  if (/aligned|well aligned|хорошо|OK for|intentional|topic-aligned/i.test(f) && !/≠|!=|drift|wrong|hijack|mismatch/i.test(f))
    cats.push('positive_or_neutral_note');
  if (/hijack|≠|mismatch|drift|wrong place|instead of/i.test(f)) cats.push('real_mismatch');
  if (!cats.length) cats.push('other');
  return cats;
}

const f4 = new Set(a4.filter((l) => (l.enkyFlags || []).length).map((l) => l.id));
const f5 = new Set(a5.filter((l) => (l.enkyFlags || []).length).map((l) => l.id));
const neu = [...f5].filter((id) => !f4.has(id)).sort();

const buckets = {
  wave2_touched: [],
  ky_eq_ru_cluster: [],
  positive_noise: [],
  real_new_issue: [],
  other: [],
};

for (const id of neu) {
  const flags = by5[id].enkyFlags || [];
  const cats = classify(flags);
  const row = { id, cats, flags: flags.map(String).slice(0, 2), wave2: wave2Touched.has(id) };
  if (wave2Touched.has(id)) buckets.wave2_touched.push(row);
  else if (cats.includes('positive_or_neutral_note') && !cats.includes('real_mismatch'))
    buckets.positive_noise.push(row);
  else if (cats.includes('ky_eq_ru_or_ru_leak') && !cats.includes('real_mismatch'))
    buckets.ky_eq_ru_cluster.push(row);
  else if (cats.includes('real_mismatch') || cats.includes('en_circular_gloss') || cats.includes('en_bare_formula') || cats.includes('answer_hardcoded_RU'))
    buckets.real_new_issue.push(row);
  else buckets.other.push(row);
}

console.log(
  JSON.stringify(
    {
      counts: {
        after4: f4.size,
        after5: f5.size,
        new: neu.length,
        cleared: [...f4].filter((id) => !f5.has(id)).length,
      },
      bucketSizes: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
      buckets,
      // sample: did after4 already have empty enky for these ky_eq lessons?
      sampleBefore: neu.slice(0, 5).map((id) => ({
        id,
        beforeFlags: by4[id]?.enkyFlags || [],
        afterFlags: by5[id]?.enkyFlags || [],
      })),
    },
    null,
    2,
  ),
);

// g4s-emo-l2 tasks
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const m = worlds.match(/id: 'g4s-emo-l2'[\s\S]*?tasks: \[([\s\S]*?)\] \}/);
console.log('\n--- g4s-emo-l2 tasks ---');
console.log(m?.[1]?.trim());
