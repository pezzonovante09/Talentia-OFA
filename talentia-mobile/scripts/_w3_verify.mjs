/** Verify wave3 key lessons after apply. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// Dynamic import of worlds via tsx is heavy — parse worlds.ts lightly + locales
const worldsSrc = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));

function t(lang, section, key) {
  const doc = lang === 'ru' ? ru : lang === 'en' ? en : ky;
  return doc.data?.[section]?.[key] ?? '';
}

const checks = [];
function ok(label, cond, detail = '') {
  checks.push({ label, pass: !!cond, detail });
  console.log(cond ? '✓' : '✗', label, detail);
}

// Structure checks via regex on worlds.ts
ok('times t1 uses g2m_3x7', /g2mtimesl3t1.*g2m_3x7.*answer: '21'/.test(worldsSrc.replace(/\n/g, ' ')));
ok('times t3 fill_blank', /g2mtimesl3t3', type: 'fill_blank'/.test(worldsSrc));
ok('sent t3 fill_blank', /g2rsentl2t3', type: 'fill_blank'/.test(worldsSrc));
ok('days t4 full phrase', worldsSrc.includes("answer: \"On Friday we have art\""));
ok('canyon Зелёная', worldsSrc.includes("answer: 'Зелёная'"));
ok('conj t4 MC', /g4r-conj-l1-t4', type: 'multiple_choice'/.test(worldsSrc));
ok('conj t4 ✓b', /g4r-conj-l1-t4[\s\S]*?g4r_conj_q4_b', correct: true/.test(worldsSrc));
ok('cases t4 MC', /g4r-cases-l1-t4', type: 'multiple_choice'/.test(worldsSrc));
ok('cases t4 ✓b', /g4r-cases-l1-t4[\s\S]*?g4r_cases_q4_b', correct: true/.test(worldsSrc));
ok('emo t4 still MC', /g4s-emo-l2-t4', type: 'multiple_choice'/.test(worldsSrc));
ok('emo t4 ✓b злость', /g4s-emo-l2-t4[\s\S]*?g4s_emo2_q4_b', correct: true/.test(worldsSrc));
ok('emo t3 fill_blank', /g4s-emo-l2-t3', type: 'fill_blank'/.test(worldsSrc));
ok('meadow t3 fill_blank', /mc5l3-t3',\s*type: 'fill_blank'/.test(worldsSrc));
ok('meadow t4 answer 4', /mc5l3-t4'[\s\S]*?answer: '4'/.test(worldsSrc));
ok('lab t4 added', /lab-ph-1-t4'/.test(worldsSrc));

ok('EN times dialog 3×7', /three pockets with 7 coins/.test(t('en', 'dialog', 'g2m_timesl3_0')));
ok('EN seed photosyn', /photosynthesis/.test(t('en', 'tasks', 'g2s_seed_grows_into')));
ok('EN dozen gone', !/dozen/i.test(t('en', 'tasks', 'g3m_tens_in_456')));
ok('EN adj bigger', /bigger/.test(t('en', 'tasks', 'g3r_adjl2_q1_b')));
ok('EN food not tautology Juice=Juice', t('en', 'tasks', 'g3e_food1_q1_a') !== 'Juice');
ok('EN wake not tautology', !/^wake up$/i.test(t('en', 'tasks', 'g3e_opt_wake_up_f')));
ok('KY case атооч first', /^Атооч/.test(t('ky', 'tasks', 'g4r_cases_q1_a')));
ok('KY jungleSub no минус', !/минус/.test(t('ky', 'tasks', 'aba_jungleSub_q2')));
ok('RU opt hints какой', /какой/.test(t('ru', 'tasks', 'g2r_opt_opred')));

const failed = checks.filter((c) => !c.pass);
console.log('\nPassed', checks.length - failed.length, '/', checks.length);
if (failed.length) process.exitCode = 1;
