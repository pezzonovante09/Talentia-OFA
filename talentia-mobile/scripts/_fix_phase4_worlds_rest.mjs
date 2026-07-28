import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const wp = path.join(root, 'src/data/worlds.ts');
let s = fs.readFileSync(wp, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

function replaceOnce(oldLines, newLines, label) {
  const oldS = oldLines.join(nl);
  const newS = newLines.join(nl);
  const count = s.split(oldS).length - 1;
  if (count !== 1) {
    console.log('FAIL ' + label + ' count=' + count);
    return false;
  }
  s = s.replace(oldS, newS);
  console.log('OK ' + label);
  return true;
}

replaceOnce([
  "            { id: 'g3m1000l3t1', type: 'input', questionKey: 'data.tasks.g3m_200plus350', difficulty: 1, answer: '550' },",
  "            { id: 'g3m1000l3t2', type: 'input', questionKey: 'data.tasks.g3m_600minus240', difficulty: 1, answer: '360' },",
  "            { id: 'g3m1000l3t3', type: 'input', questionKey: 'data.tasks.g3m_450plus275', difficulty: 2, answer: '725' },",
  "            { id: 'g3m1000l3t4', type: 'input', questionKey: 'data.tasks.g3m_800minus356', difficulty: 3, answer: '444' },",
], [
  "            { id: 'g3m1000l3t1', type: 'multiple_choice', questionKey: 'data.tasks.g3m_cmp_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3m_cmp_opt_356', correct: true }, { id: 'b', textKey: 'data.tasks.g3m_cmp_opt_298', correct: false }] },",
  "            { id: 'g3m1000l3t2', type: 'multiple_choice', questionKey: 'data.tasks.g3m_cmp_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g3m_cmp_opt_gt', correct: true }, { id: 'b', textKey: 'data.tasks.g3m_cmp_opt_lt', correct: false }, { id: 'c', textKey: 'data.tasks.g3m_cmp_opt_eq', correct: false }] },",
  "            { id: 'g3m1000l3t3', type: 'multiple_choice', questionKey: 'data.tasks.g3m_cmp_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_yes', correct: false }, { id: 'b', textKey: 'data.tasks.opt_no', correct: true }] },",
  "            { id: 'g3m1000l3t4', type: 'multiple_choice', questionKey: 'data.tasks.g3m_cmp_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g3m_cmp_opt_703', correct: true }, { id: 'b', textKey: 'data.tasks.g3m_cmp_opt_730', correct: false }] },",
], 'g3m-1000-l3');

replaceOnce([
  "            { id: 'g2edaysl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_thursday_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_thursday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_friday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_saturday', correct: false }] },",
  "            { id: 'g2edaysl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_friday_ru', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_thursday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_friday', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_sunday', correct: false }] },",
  "            { id: 'g2edaysl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_weekend_days', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_sat_sun', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_mon_fri', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_thu_fri', correct: false }] },",
  "            { id: 'g2edaysl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_days_in_week', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.opt_five', correct: false }, { id: 'b', textKey: 'data.tasks.opt_six', correct: false }, { id: 'c', textKey: 'data.tasks.opt_seven', correct: true }] },",
], [
  "            { id: 'g2edaysl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_yd_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_yd_opt_sunday', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_yd_opt_tuesday', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_yd_opt_monday', correct: false }] },",
  "            { id: 'g2edaysl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_yd_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_yd_opt_sunday', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_yd_opt_tuesday', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_yd_opt_monday', correct: false }] },",
  "            { id: 'g2edaysl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_yd_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_yd_opt_vchera', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_yd_opt_segodnya', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_yd_opt_zavtra', correct: false }] },",
  "            { id: 'g2edaysl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_yd_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_yd_opt_vchera', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_yd_opt_segodnya', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_yd_opt_zavtra', correct: true }] },",
], 'g2e-days-l2');

replaceOnce([
  "            { id: 'g2eschl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_wake_up_means', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_wake_up', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_go_to_bed', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_eat_lunch', correct: false }] },",
  "            { id: 'g2eschl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_go_to_school', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_wake_up', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_opt_go_school', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_opt_go_to_bed', correct: false }] },",
  "            { id: 'g2eschl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_go_home_after', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_go_home', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_go_school', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_wake_up', correct: false }] },",
  "            { id: 'g2eschl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_do_homework_means', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_opt_do_hw', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_opt_play_games', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_opt_go_to_bed', correct: false }] },",
], [
  "            { id: 'g2eschl3t1', type: 'multiple_choice', questionKey: 'data.tasks.g2e_sch3_q1', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_sch3_opt_idont', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_sch3_opt_help', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_sch3_opt_hello', correct: false }] },",
  "            { id: 'g2eschl3t2', type: 'multiple_choice', questionKey: 'data.tasks.g2e_sch3_q2', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g2e_sch3_opt_idont', correct: false }, { id: 'b', textKey: 'data.tasks.g2e_sch3_opt_help', correct: true }, { id: 'c', textKey: 'data.tasks.g2e_sch3_opt_bye', correct: false }] },",
  "            { id: 'g2eschl3t3', type: 'multiple_choice', questionKey: 'data.tasks.g2e_sch3_q3', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_sch3_opt_may', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_sch3_opt_thanks', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_sch3_opt_hello', correct: false }] },",
  "            { id: 'g2eschl3t4', type: 'multiple_choice', questionKey: 'data.tasks.g2e_sch3_q4', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g2e_sch3_opt_idont', correct: true }, { id: 'b', textKey: 'data.tasks.g2e_sch3_opt_bye', correct: false }, { id: 'c', textKey: 'data.tasks.g2e_sch3_opt_thanks', correct: false }] },",
], 'g2e-sch-l3');

replaceOnce([
  "            { id: 'g1eabcl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_G_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_bear', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_goat', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_apple', correct: false }] },",
  "            { id: 'g1eabcl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_happy_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_G', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_H', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_I', correct: false }] },",
  "            { id: 'g1eabcl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_ice_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_H', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_I', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_J', correct: false }] },",
  "            { id: 'g1eabcl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_J_for', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_jelly', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_kite', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_lamp', correct: false }] },",
], [
  "            { id: 'g1eabcl1t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_G_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_G', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_H', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_I', correct: false }] },",
  "            { id: 'g1eabcl1t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_happy_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_G', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_H', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_I', correct: false }] },",
  "            { id: 'g1eabcl1t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_ice_starts', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_H', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_I', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_J', correct: false }] },",
  "            { id: 'g1eabcl1t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_J_for', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_G', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_J', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_H', correct: false }] },",
], 'g1e-abc-l1');

replaceOnce([
  "            { id: 'g1eabcl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_K_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_kite', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_lamp', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_moon', correct: false }] },",
  "            { id: 'g1eabcl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_starts_with_L', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_kite', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_lamp', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_nose', correct: false }] },",
  "            { id: 'g1eabcl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_M_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_kite', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_moon', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_nose', correct: false }] },",
  "            { id: 'g1eabcl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_N_for', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_moon', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_nose', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_orange', correct: false }] },",
], [
  "            { id: 'g1eabcl2t1', type: 'multiple_choice', questionKey: 'data.tasks.g1e_K_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_K', correct: true }, { id: 'b', textKey: 'data.tasks.g1e_opt_L', correct: false }, { id: 'c', textKey: 'data.tasks.g1e_opt_M', correct: false }] },",
  "            { id: 'g1eabcl2t2', type: 'multiple_choice', questionKey: 'data.tasks.g1e_starts_with_L', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_K', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_L', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_N', correct: false }] },",
  "            { id: 'g1eabcl2t3', type: 'multiple_choice', questionKey: 'data.tasks.g1e_M_for', difficulty: 1, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_K', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_M', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_N', correct: false }] },",
  "            { id: 'g1eabcl2t4', type: 'multiple_choice', questionKey: 'data.tasks.g1e_N_for', difficulty: 2, options: [{ id: 'a', textKey: 'data.tasks.g1e_opt_M', correct: false }, { id: 'b', textKey: 'data.tasks.g1e_opt_N', correct: true }, { id: 'c', textKey: 'data.tasks.g1e_opt_L', correct: false }] },",
], 'g1e-abc-l2');

fs.writeFileSync(wp, s);
console.log('saved');
