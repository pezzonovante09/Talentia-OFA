import fs from 'fs';

const worlds = fs.readFileSync(new URL('../src/data/worlds.ts', import.meta.url), 'utf8');
const ru = JSON.parse(fs.readFileSync(new URL('../src/i18n/locales/ru.json', import.meta.url), 'utf8'));
const en = JSON.parse(fs.readFileSync(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'));
const ky = JSON.parse(fs.readFileSync(new URL('../src/i18n/locales/ky.json', import.meta.url), 'utf8'));

const lessonIds = [
  'g3w-eco-l1', 'g3w-eco-l2', 'g3w-geo-l1', 'g3w-geo-l2',
  'g3r-gen-l2', 'g3r-gen-l3', 'g3r-verb-l1', 'g3r-verb-l3', 'g3r-adj-l3', 'g3m-div-l2',
];

const get = (obj, k) => obj?.data?.tasks?.[k];

let missing = 0;
for (const id of lessonIds) {
  console.log(`\n======== ${id}`);
  const start = worlds.indexOf(`id: '${id}'`);
  if (start < 0) {
    console.log('NOT FOUND');
    continue;
  }
  const tasksAt = worlds.indexOf('tasks: [', start);
  const end = worlds.indexOf('\n          ] }', tasksAt);
  const block = worlds.slice(tasksAt, end);
  const lines = block.split('\n').filter((l) => l.includes("id: '") && l.includes('questionKey:'));
  for (const line of lines) {
    const tid = line.match(/id: '([^']+)'/)?.[1];
    const type = line.match(/type: '([^']+)'/)?.[1];
    const qk = line.match(/questionKey: 'data\.tasks\.([^']+)'/)?.[1];
    const ans = line.match(/answer: ([^,\n]+)/)?.[1];
    console.log(`  ${tid} <${type}>`);
    console.log(`    Q RU: ${get(ru, qk)}`);
    console.log(`    Q EN: ${get(en, qk)}`);
    for (const [lang, obj] of [['RU', ru], ['EN', en], ['KY', ky]]) {
      if (!get(obj, qk)) {
        console.log(`    !! MISSING ${lang} Q ${qk}`);
        missing++;
      }
    }
    if (ans) console.log(`    answer: ${ans.trim()}`);
    const opts = [...line.matchAll(/textKey: 'data\.tasks\.([^']+)', correct: (true|false)/g)];
    for (const [, ok, c] of opts) {
      const mark = c === 'true' ? '[✓]' : '[ ]';
      console.log(`    ${mark} RU=${get(ru, ok)} | EN=${get(en, ok)}`);
      for (const [lang, obj] of [['RU', ru], ['EN', en], ['KY', ky]]) {
        if (!get(obj, ok)) {
          console.log(`      !! MISSING ${lang} opt ${ok}`);
          missing++;
        }
      }
    }
  }
}
console.log(`\nMissing keys: ${missing}`);
if (missing) process.exit(1);

// Spot-check critical semantics
const checks = [
  ['g3w_ecol1_q1_b', 'Animals will disappear'],
  ['g3w_ecol1_q3_b', 'pollinate'],
  ['g3w_ecol2_q2_b', 'plant'],
  ['g3w_compass_q2', 'rising sun'],
  ['g3w_map_q1', 'map different from a globe'],
  ['g3r_genl2_q1', 'ОКНО'],
  ['g3r_person_q2', 'читаю'],
  ['g3r_antonym_q1', 'antonym'],
  ['g3r_verbl1_present_input', 'writing a diary'],
];
for (const [k, must] of checks) {
  const v = get(en, k) || '';
  if (!v.toLowerCase().includes(must.toLowerCase())) {
    console.error(`EN check fail ${k}: expected to include "${must}", got "${v}"`);
    process.exit(1);
  }
}
console.log('Semantic EN spot-checks OK');
