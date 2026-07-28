import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const w = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');

const keys = [
  ['tasks', 'pre_story_3apples_more_1'],
  ['tasks', 'pre_story_6fish_7fish_which_more'],
  ['tasks', 'pre_which_has_4_corners'],
  ['tasks', 'mshl2_rect_in_room_q'],
  ['intro', 'g2r_spl3_0_t'],
  ['intro', 'g2r_spl3_0_b'],
  ['intro', 'g2r_spl3_1_t'],
  ['intro', 'g2r_spl3_1_b'],
  ['intro', 'g2s_bdyl3_0_t'],
  ['intro', 'g2s_bdyl3_0_b'],
  ['tasks', 'g2s_water_daily'],
  ['tasks', 'g2s_vitamins_in'],
  ['tasks', 'g2s_protein_in'],
  ['dialog', 'g3m_1000l3_0'],
  ['dialog', 'g3m_1000l3_1'],
  ['intro', 'g3m_1000l3_1_t'],
  ['intro', 'g3m_1000l3_1_b'],
  ['dialog', 'g3e_foodl2_0'],
  ['dialog', 'g3e_foodl2_1'],
  ['tasks', 'g3e_food2_q1_a'],
];

let out = '';
for (const [sec, k] of keys) {
  out += `${sec}.${k}\n`;
  out += ` RU ${(ru.data[sec][k] || 'MISSING').slice(0, 140)}\n`;
  out += ` EN ${(en.data[sec][k] || 'MISSING').slice(0, 140)}\n`;
  out += ` KY ${(ky.data[sec][k] || 'MISSING').slice(0, 140)}\n`;
}

for (const id of ['g3e-daily-l3', 'g3w-geo-l3', 'meadow-c10-l3', 'jungle-aba-showcase', 'g1w-nat-l2', 'island-abc-l2']) {
  const idx = w.indexOf(`id: '${id}'`);
  out += `\n==== ${id} @ ${idx}\n`;
  if (idx < 0) continue;
  out += w.slice(idx, idx + 1400) + '\n';
}

// nrw keys for g1w-nat-l2
out += '\n==== nrw_ganiml2 keys\n';
for (const k of Object.keys(ru.data.tasks).filter((x) => x.includes('ganiml2') || x.includes('nrw_ganim'))) {
  out += `${k}\n RU ${ru.data.tasks[k]}\n EN ${en.data.tasks[k]}\n KY ${ky.data.tasks[k]}\n`;
}

// daily/geo task keys
for (const k of Object.keys(ru.data.tasks).filter((x) => /daily3|geo.*l3|bishkek|capital_kg|never_late|g3w_geo/.test(x))) {
  out += `task ${k}\n RU ${String(ru.data.tasks[k]).slice(0, 100)}\n EN ${String(en.data.tasks[k]).slice(0, 100)}\n KY ${String(ky.data.tasks[k]).slice(0, 100)}\n`;
}

fs.writeFileSync(path.join(root, 'scripts/_crit9_keys.txt'), out, 'utf8');
console.log('wrote', out.length);
