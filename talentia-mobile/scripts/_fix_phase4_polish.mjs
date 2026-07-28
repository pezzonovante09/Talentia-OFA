import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const loc = (f) => path.join(root, 'src/i18n/locales', f);

const patches = {
  ru: {
    dialog: {
      g1w_natl1_1: 'У дуба жёлуди, у берёзы — белая кора, у ели — иголки. Помоги запомнить!',
    },
    intro: {
      g1w_natl1_1_t: 'Хвойные и лиственные',
      g1w_natl1_1_b: 'Ель — хвойная (иголки). Берёза и дуб — лиственные (листья).',
    },
    tasks: {
      g1e_starts_with_L: 'С какой буквы начинается LAMP?',
    },
  },
  en: {
    dialog: {
      g1w_natl1_1: 'Oak has acorns, birch has white bark, fir has needles. Help me remember!',
    },
    intro: {
      g1w_natl1_1_t: 'Coniferous and deciduous',
      g1w_natl1_1_b: 'Fir is coniferous (needles). Birch and oak are deciduous (leaves).',
    },
    tasks: {
      g1e_starts_with_L: 'What letter does LAMP start with?',
    },
  },
  ky: {
    dialog: {
      g1w_natl1_1: 'Эменде жаңгак, кайыңдын кабыгы ак, карагайдын ийнелери бар. Жардам бер!',
    },
    intro: {
      g1w_natl1_1_t: 'Ийне жана жалбырактуу',
      g1w_natl1_1_b: 'Карагай — ийнелүү. Кайың жана эмен — жалбырактуу.',
    },
    tasks: {
      g1e_starts_with_L: 'LAMP кайсы тамгадан башталат?',
    },
  },
};

for (const [lng, file] of [['ru','ru.json'],['en','en.json'],['ky','ky.json']]) {
  const p = loc(file);
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [sec, map] of Object.entries(patches[lng])) {
    for (const [k, v] of Object.entries(map)) j.data[sec][k] = v;
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
}
console.log('phase4 polish done');
