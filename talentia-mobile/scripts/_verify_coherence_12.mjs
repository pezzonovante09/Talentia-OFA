import fs from 'fs';
const worlds = fs.readFileSync(new URL('../src/data/worlds.ts', import.meta.url), 'utf8');
const ids = ['g1eabcl3t4', 'g2madd2l2t2', 'g2madd2l2t4', 'g2edaysl3t4', 'g2rsentl2t4', 'g2rshl3t4', 'g1enuml3t4'];
for (const id of ids) {
  const idx = worlds.indexOf(`id: '${id}'`);
  if (idx < 0) { console.log(id, 'MISSING'); continue; }
  const snippet = worlds.slice(idx, idx + 280).split('\n')[0];
  console.log(snippet);
}
const ru = JSON.parse(fs.readFileSync(new URL('../src/i18n/locales/ru.json', import.meta.url), 'utf8'));
const en = JSON.parse(fs.readFileSync(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'));
const ky = JSON.parse(fs.readFileSync(new URL('../src/i18n/locales/ky.json', import.meta.url), 'utf8'));
console.log('\nbridged RU/EN/KY:');
for (const k of ['nrw_icoll1_t1_q', 'nrw_ianiml3_t4_q', 'nrw_gcoll2_t1_q']) {
  console.log(k);
  console.log(' ', ru.data.tasks[k]);
  console.log(' ', en.data.tasks[k]);
  console.log(' ', ky.data.tasks[k]);
}
console.log('garden intro1', ru.data.intro.garden_coll2_1_t, '|', ru.data.intro.garden_coll2_1_b.slice(0, 80));
console.log('titles', ru.data.lessons.gardenColL2, en.data.lessons.gardenColL2, ky.data.lessons.gardenColL2);
