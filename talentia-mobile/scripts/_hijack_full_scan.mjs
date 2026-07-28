/**
 * Semantic key-hijack scan: Phase 3–4 + pilot D lessons.
 * Detects: (1) questionKey name vs RU meaning, (2) RU vs EN topic clash, (3) option key name vs RU.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));

function t(doc, k) {
  const parts = String(k).replace(/^data\./, '').split('.');
  let cur = doc.data;
  for (const x of parts) cur = cur?.[x];
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
// Known rewrite targets from phase 3–4 that may not be in review md fully
const extra = ['g3w-nat-l3','g3w-eco-l1','g3w-eco-l2'];
const ids = [...new Set([...phase34, ...pilotD, ...extra])];

function sliceLesson(id) {
  const needle = `id: '${id}'`;
  const idx = worlds.indexOf(needle);
  if (idx < 0) return null;
  // find next lesson id at same indent roughly
  const rest = worlds.slice(idx + needle.length);
  const next = rest.search(/\n\s{8}id: '/);
  return worlds.slice(idx, idx + needle.length + (next > 0 ? next : 3500));
}

const KEY_RULES = [
  { re: /we_blank_ready|they_blank_students/, expectRu: /___|blank|готовы|students|ученик/i, clashIfRu: /\?|инверс|вопрос/i, label: 'affirmative_blank_key_but_RU_question_form' },
  { re: /are_they_question/, expectRu: /they|они/i, clashIfRu: /she|она|tired|устала/i, label: 'are_they_key_but_RU_about_she' },
  { re: /are_we_question/, expectRu: /we|мы/i, clashIfRu: /они дома|they home/i, label: 'are_we_key_but_RU_about_they_home' },
  { re: /protect_nature_how/, expectRu: /как|how|защит/i, clashIfRu: /зачем создали|красн/i, label: 'protect_how_key_but_RU_why_red_book' },
  { re: /red_book_is/, expectRu: /красн|red book/i, clashIfRu: /деревья|кислород|дают/i, label: 'red_book_key_but_RU_about_trees' },
  { re: /size_adj_examples/, expectRu: /размер|size|больш|маленьк/i, clashIfRu: /быстр|степен|сравнительн/i, label: 'size_adj_key_but_RU_degree' },
  { re: /adj_for_fem/, expectRu: /женск|fem|форм/i, clashIfRu: /сравнительн|медленн|улитка/i, label: 'fem_adj_key_but_RU_comparative' },
  { re: /nature_belongs_to/, expectRu: /принадлеж|belongs/i, clashIfRu: /экосистем|аквариум/i, label: 'belongs_key_rewritten' },
  { re: /ecology_studies/, expectRu: /эколог|studies/i, clashIfRu: /дерев|выруб/i, label: 'ecology_studies_key_rewritten' },
  { re: /save_water_how/, expectRu: /вод|water/i, clashIfRu: /пчёл|растен/i, label: 'save_water_key_rewritten' },
  { re: /forest_importance/, expectRu: /лес|forest/i, clashIfRu: /хищник|predator/i, label: 'forest_key_rewritten' },
  { re: /air_pollution/, expectRu: /воздух|pollution/i, clashIfRu: /цепочк|трава|заяц/i, label: 'pollution_key_rewritten' },
];

const OPT_RULES = [
  { re: /opt_recycle$/, clashRu: /защитить редких|красн/i, okRu: /вторсырь|перераб|recycle/i, label: 'opt_recycle_holds_redbook_answer' },
  { re: /opt_burn_trash$/, clashRu: /библиотек/i, okRu: /жечь|мусор|burn/i, label: 'opt_burn_trash_holds_library' },
  { re: /opt_cut_trees$/, clashRu: /погод/i, okRu: /рубить|дерев|cut/i, label: 'opt_cut_trees_holds_weather' },
  { re: /opt_endangered$/, clashRu: /кислород/i, okRu: /исчезающ|endangered/i, label: 'opt_endangered_holds_oxygen' },
  { re: /opt_extinct$/, clashRu: /красот/i, okRu: /вымерш|extinct/i, label: 'opt_extinct_holds_beauty' },
  { re: /opt_recipe_book$/, clashRu: /проблем/i, okRu: /рецепт|recipe/i, label: 'opt_recipe_holds_problems' },
  { re: /opt_are_they$/, clashRu: /Is she|she is/i, okEn: /Are they/i, label: 'opt_are_they_holds_Is_she' },
  { re: /opt_is_they$/, clashRu: /Are she/i, okEn: /Is they/i, label: 'opt_is_they_holds_Are_she' },
  { re: /opt_am_they$/, clashRu: /Am she/i, okEn: /Am they/i, label: 'opt_am_they_holds_Am_she' },
  { re: /opt_math_calc$/, clashRu: /экосистем|жив/i, okRu: /математ|calc/i, label: 'opt_math_calc_hijacked' },
  { re: /opt_nature_relations$/, clashRu: /погиб|исчез/i, okRu: /связ|отношен/i, label: 'opt_nature_relations_hijacked' },
];

const hits = [];

for (const id of ids) {
  const slice = sliceLesson(id);
  if (!slice) {
    hits.push({ id, severity: 'info', issue: 'not_found_inline' });
    continue;
  }
  const qks = [...slice.matchAll(/questionKey:\s*'([^']+)'/g)].map((m) => m[1]);
  const oks = [...new Set([...slice.matchAll(/textKey:\s*'([^']+)'/g)].map((m) => m[1]))];

  for (const qk of qks) {
    const short = qk.replace(/^data\.tasks\./, '');
    const qRu = t(ru, qk);
    const qEn = t(en, qk);
    const qKy = t(ky, qk);
    if (!qRu) continue;

    for (const rule of KEY_RULES) {
      if (!rule.re.test(short)) continue;
      if (rule.clashIfRu?.test(qRu)) {
        hits.push({
          id,
          kind: 'questionKey',
          key: short,
          issue: rule.label,
          ru: qRu,
          en: qEn,
          ky: qKy,
          phase34: phase34.includes(id),
          pilotD: pilotD.includes(id),
        });
      }
    }

    // Generic: RU and EN ask different WH-questions / topics
    const ruWhy = /зачем|почему/i.test(qRu);
    const enHow = /^how |how to /i.test(qEn);
    const ruTrees = /дерев/i.test(qRu) && !/красн|заповед/i.test(qEn) && /red book|recycle|endangered/i.test(qEn);
    if (ruWhy && enHow) {
      hits.push({
        id, kind: 'ru_en_wh_clash', key: short,
        issue: 'RU_asks_why_EN_asks_how',
        ru: qRu, en: qEn, ky: qKy,
        phase34: phase34.includes(id), pilotD: pilotD.includes(id),
      });
    }
    if (ruTrees) {
      hits.push({
        id, kind: 'ru_en_topic', key: short,
        issue: 'RU_trees_EN_redbook_or_recycle',
        ru: qRu, en: qEn, ky: qKy,
        phase34: phase34.includes(id), pilotD: pilotD.includes(id),
      });
    }

    // Affirmative blank EN vs question RU
    if (/___ we |инверс|→\s*«?___/i.test(qRu) && /we ___ |they ___ |what word/i.test(qEn) && !/\?/.test(qEn.slice(0, 20))) {
      hits.push({
        id, kind: 'ru_en_form', key: short,
        issue: 'RU_question_inversion_EN_affirmative_blank',
        ru: qRu, en: qEn, ky: qKy,
        phase34: phase34.includes(id), pilotD: pilotD.includes(id),
      });
    }
  }

  for (const ok of oks) {
    const short = ok.replace(/^data\.tasks\./, '');
    const oRu = t(ru, ok);
    const oEn = t(en, ok);
    for (const rule of OPT_RULES) {
      if (!rule.re.test(short)) continue;
      const clash = rule.clashRu?.test(oRu) || rule.clashRu?.test(oEn);
      const okMatch = rule.okRu?.test(oRu) || rule.okEn?.test(oEn);
      if (clash && !okMatch) {
        hits.push({
          id, kind: 'optionKey', key: short,
          issue: rule.label,
          ru: oRu, en: oEn,
          phase34: phase34.includes(id), pilotD: pilotD.includes(id),
        });
      }
    }
  }
}

// Dedupe
const seen = new Set();
const unique = [];
for (const h of hits) {
  const k = `${h.id}|${h.key}|${h.issue}`;
  if (seen.has(k)) continue;
  seen.add(k);
  unique.push(h);
}

const byLesson = {};
for (const h of unique) {
  (byLesson[h.id] ||= []).push(h);
}

const out = {
  scanned: ids.length,
  hitLessons: Object.keys(byLesson).length,
  hits: unique,
  byLesson,
};
fs.writeFileSync(path.join(root, 'scripts/_hijack_full_scan.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');

console.log(`scanned ${ids.length} lessons, ${Object.keys(byLesson).length} with hits, ${unique.length} issues`);
for (const [id, arr] of Object.entries(byLesson)) {
  console.log(`\n## ${id} (${arr.length})`);
  for (const h of arr) {
    console.log(`- [${h.kind}] ${h.key}: ${h.issue}`);
    console.log(`  RU: ${h.ru}`);
    console.log(`  EN: ${h.en}`);
  }
}
