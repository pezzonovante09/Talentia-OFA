import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));

console.log('g2m_25_after gone', ru.data.tasks.g2m_25_after === undefined);
console.log('compose', ru.data.tasks.g2m_compose_3t_6u?.slice(0, 40));
console.log('worlds 36', /g2m100l2t1[\s\S]{0,120}answer: '36'/.test(worlds));
console.log('g4r a true', /g4r-text-l3-t3[\s\S]{0,200}q3_a', correct: true/.test(worlds));
console.log('g4e c true', /g4e-quest-l2-t1[\s\S]{0,200}q1_c', correct: true/.test(worlds));
console.log('g4s b true', /g4s-emo-l2-t4[\s\S]{0,250}q4_b', correct: true/.test(worlds));
console.log('lab', worlds.includes('lab_ph_q2') && worlds.includes('Равновесие'));
console.log('forest', ru.data.tasks.nrw_fvl2_t4_c, '|', en.data.tasks.nrw_fvl2_t4_q);
console.log('g3w', en.data.tasks.g3w_clouds_form_from);
console.log('g3r', en.data.tasks.g3r_past_question);
