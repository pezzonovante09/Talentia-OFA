import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));

const keys = [
  'g3r_masc_question',
  'g3r_dom_gender',
  'g3r_drug_gender',
  'g3r_genl1_fb_sent',
  'g3r_opt_muzhskoy',
  'g3r_opt_zhenskiy',
  'g3r_opt_sredniy',
  'g3r_opt_on',
  'g3r_opt_ona',
  'g3r_opt_ono',
  'g3r_opt_to_adj',
  'g3r_opt_to_noun',
  'g3r_opt_krasny',
  'g3r_opt_krasnaya',
  'g3r_opt_krasnoe',
  'g3r_adjl1_q3_a',
  'g3r_adjl1_q3_b',
  'g3w_water_cycle_steps',
  'g3w_clouds_form_from',
  'g3w_rain_comes_from',
  'g3w_opt_evaporation',
  'g3w_opt_explosion',
  'g3w_opt_erosion',
  'g3w_opt_water_vapor',
  'g3w_opt_dust',
  'g3w_opt_smoke',
  'g3w_opt_clouds',
  'g3w_opt_rivers',
  'g3w_opt_sea',
  'g4e_quest2_q1',
  'g4e_quest2_q1_a',
  'g4e_quest2_q1_b',
  'g4e_quest2_q1_c',
  'g4s_emo2_q4',
  'g4s_emo2_q4_a',
  'g4s_emo2_q4_b',
  'g4s_emo2_q4_c',
  'g4r_text3_q3',
  'g4r_text3_q3_a',
  'g4r_text3_q3_b',
  'g4r_text3_q3_c',
];

for (const k of keys) {
  console.log(`\n${k}`);
  console.log(' RU:', ru.data.tasks[k]);
  console.log(' EN:', en.data.tasks[k]);
  console.log(' KY:', ky.data.tasks[k]);
}
