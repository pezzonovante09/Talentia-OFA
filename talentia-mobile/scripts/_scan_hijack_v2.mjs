/**
 * Broader RU vs EN semantic hijack scan for Phase3-4 + pilot D + reaudit3 suspects.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));

function t(doc, dotted) {
  const parts = dotted.replace(/^data\./, '').split('.');
  let cur = doc.data;
  for (const p of parts) cur = cur?.[p];
  return typeof cur === 'string' ? cur : '';
}

const phase34 = [
  'g2e-phr-l1','g2e-days-l1','g3r-gen-l1','g3r-gen-l2','g3r-gen-l3',
  'g3r-adj-l1','g3r-adj-l2','g3r-adj-l3','g3r-verb-l1','g3r-verb-l2','g3r-verb-l3',
  'g3e-tobe-l1','g3e-tobe-l2','g3e-tobe-l3',
  'g2r-sh-l1','g2r-sh-l2','g2r-sh-l3','g2r-sp-l1','g2r-sp-l2','g2r-sp-l3',
  'g2r-sent-l1','g2r-sent-l3','g2s-plt-l2','g2s-ani-l1','g2s-ani-l2','g2s-ani-l3',
  'g2s-bdy-l1','g2s-bdy-l3',
  'g1w-sch-l3','g1w-nat-l1','g1w-nat-l2','g1w-nat-l3','g1w-bdy-l1','g1w-bdy-l2','g1w-bdy-l3',
  'g3m-1000-l3','g2e-days-l2','g2e-sch-l3','g1e-grt-l2','g1e-grt-l3','g1m-add-l1','g1e-abc-l1','g1e-abc-l2',
];
const pilotD = [
  'g2r-sh-l1','g2r-sh-l2','g3r-gen-l1','g1e-abc-l1','g2e-days-l1','g2e-phr-l1','g4e-pres-l1',
  'g2s-ani-l1','g2s-plt-l1','jungle-sub-2','canyon-words-2','lab-animals-2',
];
const ids = [...new Set([...phase34, ...pilotD, 'g3w-nat-l3'])];

const topicPairs = [
  {
    name: 'question_vs_affirmative_be',
    ru: [/are we|am i|is (he|she|it)|___ we|инверс|\?$/i, /готовы|ready/i],
    en: [/we ___ |they ___ |i ___ |blank/i],
    notEnQuestion: true,
  },
  {
    name: 'nature_rules_vs_recycle_redbook',
    ru: [/красн(ая|ой) книг|заповедник|рвать цветы|зачем создали/i],
    en: [/recycle|red book|endangered|how to protect nature/i],
  },
  {
    name: 'degree_vs_size_key',
    key: /size_adj|taller|bigger|smaller/i,
    ru: [/быстр|медлен|сравнительн|степен/i],
  },
];

const hits = [];

for (const id of ids) {
  // find tasks array more loosely
  const idx = worlds.indexOf(`id: '${id}'`);
  if (idx < 0) {
    hits.push({ id, status: 'not_in_worlds_ts_inline' });
    continue;
  }
  const slice = worlds.slice(idx, idx + 2500);
  const tasksM = slice.match(/tasks:\s*\[([\s\S]*?)\]\s*,?\s*(?:dialog|intro|reward|\}|id:)/);
  // fallback: until next lesson id
  let body = tasksM?.[1];
  if (!body) {
    const tIdx = slice.indexOf('tasks:');
    if (tIdx < 0) continue;
    body = slice.slice(tIdx, tIdx + 1800);
  }

  for (const tm of body.matchAll(/id:\s*'([^']+)'[\s\S]*?questionKey:\s*'([^']+)'/g)) {
    const taskId = tm[1];
    if (taskId === id) continue;
    const qKey = tm[2];
    const qRu = t(ru, qKey);
    const qEn = t(en, qKey);
    const qKy = t(ky, qKey);
    if (!qRu) continue;
    const found = [];

    if (/we_blank_ready|are_they|am_used|tobe/i.test(qKey) || /g3e-tobe-l3/.test(id)) {
      const ruIsQ = /\?/.test(qRu) || /→\s*«?___?\s*we/i.test(qRu) || /инверс/i.test(qRu);
      const enIsAff = /___\s*ready|we ___ |they ___ |what word/i.test(qEn) && !/^are |^am |^is /i.test(qEn.trim());
      if (ruIsQ && enIsAff) found.push('RU_question_inversion_EN_affirmative_blank');
    }
    if (/protect_nature|recycle|red_book|natl3|g3w_nat/i.test(qKey) || id === 'g3w-nat-l3') {
      if (/красн|заповед|рвать|зачем создали/i.test(qRu) && /recycle|red book|endangered|protect nature/i.test(qEn)) {
        found.push('RU_nature_rules_EN_recycle_or_redbook_stem');
      }
      // key name vs RU
      if (/recycle/i.test(qKey) && !/вторсырь|перераб|recycle/i.test(qRu)) {
        found.push('key_named_recycle_but_RU_not_about_recycling');
      }
      if (/red_book/i.test(qKey) && /заповедник|рвать цветы/i.test(qRu) && !/красн/i.test(qRu)) {
        found.push('key_named_red_book_but_RU_about_reserve_flowers');
      }
      if (/protect_nature_how/i.test(qKey) && /зачем создали красн/i.test(qRu)) {
        found.push('key_how_to_protect_but_RU_why_red_book');
      }
    }
    if (/size_adj/i.test(qKey) && /быстр|степен|сравнительн/i.test(qRu)) {
      found.push('key_size_adj_RU_comparative_degree');
    }
    // EN still equals old short stub while RU long different topic — length + no shared content words
    if (qEn && qKy && qEn.length < 40 && qRu.length > 50) {
      // weak signal only with keyword clash
    }

    if (found.length) {
      hits.push({
        id,
        taskId,
        qKey,
        issues: found,
        ru: qRu.slice(0, 140),
        en: qEn.slice(0, 140),
        ky: qKy.slice(0, 100),
        phase34: phase34.includes(id),
        pilotD: pilotD.includes(id),
      });
    }
  }
}

// Manual full dump for g3e-tobe-l3 / g3w-nat-l3 all question keys from worlds line
function fullDump(id) {
  const idx = worlds.indexOf(`id: '${id}'`);
  const slice = worlds.slice(idx, idx + 3000);
  const keys = [...slice.matchAll(/questionKey:\s*'([^']+)'/g)].map((m) => m[1]);
  const textKeys = [...slice.matchAll(/textKey:\s*'([^']+)'/g)].map((m) => m[1]);
  return {
    id,
    questions: keys.map((k) => ({ k, ru: t(ru, k), en: t(en, k), ky: t(ky, k) })),
    sampleOpts: textKeys.slice(0, 12).map((k) => ({ k, ru: t(ru, k), en: t(en, k) })),
  };
}

const out = {
  scanned: ids.length,
  hits,
  full: {
    'g3e-tobe-l3': fullDump('g3e-tobe-l3'),
    'g3w-nat-l3': fullDump('g3w-nat-l3'),
  },
};
fs.writeFileSync(path.join(__dirname, '_hijack_scan_v2.json'), JSON.stringify(out, null, 2) + '\n');
console.log('hits', hits.length);
for (const h of hits) {
  console.log(`\n${h.id} ${h.taskId} [${h.phase34 ? 'P34' : ''}${h.pilotD ? ' PD' : ''}]`);
  console.log(' ', h.issues.join(', '));
  console.log('  RU:', h.ru);
  console.log('  EN:', h.en);
}
