import fs from 'fs';
const w = fs.readFileSync('src/data/worlds.ts', 'utf8');
const ids = [
  'mshl3-t4',
  'g2rspl2t4',
  'g2rspl3t4',
  'g2rsentl1t4',
  'g2rsentl2t4',
  'g2spltl2t4',
  'g2sanil1t4',
  'g2sanil2t4',
  'g2sanil3t4',
  'g2sbdyl1t4',
  'g2sbdyl2t4',
  'g2sbdyl3t4',
  'g2ephrl1t4',
  'g2ephrl3t4',
  'g3mdivl2t3',
  'g3mdivl2t4',
  'g3wgeol1t4',
  'g3wnatl1t4',
  'g3wnatl2t4',
  'g3wecol2t4',
  'g3efoodl1t4',
  'g3etobel1t4',
  'g3edailyl1t4',
];
let ok = 0;
for (const id of ids) {
  const i = w.indexOf(`id: '${id}'`);
  const snip = w.slice(i, i + 100);
  const m = snip.match(/type: '(\w+)'/);
  const t = m ? m[1] : '?';
  if (t === 'multiple_choice') ok++;
  else console.log('BAD', id, t);
}
console.log(`${ok}/${ids.length} MC`);

const en = JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf8'));
const ky = JSON.parse(fs.readFileSync('src/i18n/locales/ky.json', 'utf8'));
const checks = [
  ['g2m_add2l3_0_t', en.data.intro.g2m_add2l3_0_t.includes('subtraction')],
  ['anil2 no fly-claim', en.data.intro.g2s_anil2_0_b.includes('Not all birds fly')],
  ['bdyl1 muscles', en.data.intro.g2s_bdyl1_1_t.includes('Muscles')],
  ['wake ky direction', ky.data.tasks.g3e_wake_up_en.includes('Wake up')],
  ['gseasl2 spring', en.data.tasks.nrw_gseasl2_t1_b === 'Spring'],
  ['gcoll3 green', en.data.tasks.nrw_gcoll3_t2_b === 'Green'],
  ['ganiml1 cow', en.data.tasks.nrw_ganiml1_t1_b === 'Cow'],
];
for (const [n, p] of checks) console.log(p ? 'OK' : 'FAIL', n);
