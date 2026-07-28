/**
 * Scan Phase 3–4 + pilot-D lessons for RU↔EN/KY / key-name hijack pattern.
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
const review = fs.readFileSync(path.join(__dirname, '_rewritten_lessons_for_review.md'), 'utf8');

function t(doc, key) {
  if (!key) return '';
  const parts = key.replace(/^data\./, '').split('.');
  let cur = doc.data || doc;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) return '';
  }
  return typeof cur === 'string' ? cur : '';
}

function nums(s) {
  return [...String(s).matchAll(/\d+/g)].map((m) => m[0]);
}

const phase34 = [
  ...[...review.matchAll(/^\| (g[\w-]+) /gm)].map((m) => m[1]),
  'g2r-sh-l1', 'g2r-sh-l2', 'g2r-sh-l3',
  'g2r-sp-l1', 'g2r-sp-l2', 'g2r-sp-l3',
  'g2s-ani-l1', 'g2s-ani-l2', 'g2s-ani-l3',
];
const pilotD = [
  'g2r-sh-l1', 'g2r-sh-l2', 'g3r-gen-l1', 'g1e-abc-l1',
  'g2e-days-l1', 'g2e-phr-l1', 'g4e-pres-l1',
  'g2s-ani-l1', 'g2s-plt-l1', 'jungle-sub-2', 'canyon-words-2', 'lab-animals-2',
];
// Also known suspects from reaudit3
const extra = ['g3e-tobe-l3', 'g3w-nat-l3', 'g3r-adj-l2', 'g3e-tobe-l1'];
const ids = [...new Set([...phase34, ...pilotD, ...extra])];

const hits = [];

for (const id of ids) {
  const re = new RegExp(`id:\\s*'${id}'[\\s\\S]*?tasks:\\s*\\[([\\s\\S]*?)\\]\\s*,?\\s*\\}`);
  const m = worlds.match(re);
  if (!m) {
    // try multiline lesson with reward/dialog
    const re2 = new RegExp(`\\{\\s*id:\\s*'${id}'[\\s\\S]*?tasks:\\s*\\[([\\s\\S]*?)\\]\\s*\\}`);
    const m2 = worlds.match(re2);
    if (!m2) {
      hits.push({ id, error: 'lesson block not found in worlds.ts' });
      continue;
    }
    scanBlock(id, m2[1]);
    continue;
  }
  scanBlock(id, m[1]);
}

function scanBlock(id, body) {
  for (const tm of body.matchAll(
    /\{\s*id:\s*'([^']+)',\s*type:\s*'([^']+)'[\s\S]*?questionKey:\s*'([^']+)'([\s\S]*?)\}(?=\s*,?\s*(?:\{|\]))/g,
  )) {
    const taskId = tm[1];
    const qKey = tm[3];
    const rest = tm[4];
    const qRu = t(ru, qKey.replace(/^data\./, ''));
    const qEn = t(en, qKey.replace(/^data\./, ''));
    const qKy = t(ky, qKey.replace(/^data\./, ''));
    if (!qRu) continue;

    const issues = [];
    // Number token mismatch between RU and EN
    const nRu = nums(qRu).join(',');
    const nEn = nums(qEn).join(',');
    if (qEn && nRu && nEn && nRu !== nEn) {
      issues.push(`number_token_mismatch RU[${nRu}] vs EN[${nEn}]`);
    }
    // Key name suggests topic X, RU text is about Y (heuristic keywords)
    const key = qKey.toLowerCase();
    const ruL = qRu.toLowerCase();
    const checks = [
      [/recycle|red_book|protect_nature/, /красн|заповед|охраня|животн|выруб/, /recycle|red book|endangered|nature/i],
      [/we_blank|are_they|am_i|tobe|blank_ready/, /are we|am i|\?$/, /we ___|they ___|ready/i],
      [/size_adj|taller|bigger/, /быстр|сравнен|степен/, /size|tall|big/i],
      [/ecology_studies|save_water/, /экосистем|выруб|пчёл/, /ecology|tap|water/i],
    ];
    // Simpler: if EN is much shorter stub while RU is long story AND they share few words
    if (qEn && qEn.length > 5 && qRu.length > 20) {
      const enWords = new Set(qEn.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
      const ruLatin = (qRu.match(/[A-Za-z']+/g) || []).map((w) => w.toLowerCase());
      // For English-lesson keys, compare meaning via shared Latin tokens
      if (/g3e_|g2e_|g1e_|g4e_/.test(key) && enWords.size) {
        // if RU contains inverted question markers but EN is affirmative blank
        if (/\?/.test(qRu) && /_{2,}|___|\bblank\b/i.test(qEn) && !/\?/.test(qEn)) {
          issues.push('RU_question_vs_EN_affirmative_blank');
        }
      }
    }
    // Key basename vs RU: e.g. size_adj_examples but RU about быстрее
    const base = qKey.split('.').pop() || '';
    if (/size_adj/i.test(base) && /быстр|медлен|степен/i.test(qRu) && !/больше|меньше|высок|низк|размер/i.test(qRu)) {
      issues.push('key_name_size_but_RU_degree_of_comparison');
    }
    if (/protect_nature|recycle|red_book/i.test(base) && /заповедник|красн(ая|ой) книг|охраняем/i.test(qRu)) {
      // check if EN still about recycle
      if (/recycle|endangered|red book/i.test(qEn) && /заповедник|можно ли рвать|почему нельзя/i.test(qRu)) {
        issues.push('RU_rewritten_nature_rules_EN_still_recycle_redbook');
      }
    }
    if (/we_blank_ready|are_they_students|are_they_question/i.test(base)) {
      if (/are we|am i|is he|\?/i.test(qRu) && /we ___ are|they ___|ready/i.test(qEn)) {
        issues.push('RU_question_form_EN_old_affirmative_key');
      }
    }

    // Option textKeys: collect and see if EN options contradict RU question topic
    const optKeys = [...rest.matchAll(/textKey:\s*'([^']+)'/g)].map((x) => x[1]);
    const optRu = optKeys.map((k) => t(ru, k.replace(/^data\./, '')));
    const optEn = optKeys.map((k) => t(en, k.replace(/^data\./, '')));

    if (issues.length) {
      hits.push({
        id,
        taskId,
        qKey,
        qRu: qRu.slice(0, 100),
        qEn: qEn.slice(0, 100),
        issues,
        optRu: optRu.slice(0, 3),
        optEn: optEn.slice(0, 3),
        inPilotD: pilotD.includes(id),
        inPhase34: phase34.includes(id),
      });
    }
  }
}

// Also dump g3e-tobe-l3 and g3w-nat-l3 fully for manual evidence
function dumpLesson(id) {
  const re = new RegExp(`id:\\s*'${id}'[\\s\\S]*?tasks:\\s*\\[([\\s\\S]*?)\\]\\s*\\}`);
  const m = worlds.match(re) || worlds.match(new RegExp(`\\{\\s*id:\\s*'${id}'[\\s\\S]*?tasks:\\s*\\[([\\s\\S]*?)\\]`));
  if (!m) return { id, error: 'not found' };
  const tasks = [];
  for (const tm of m[1].matchAll(/questionKey:\s*'([^']+)'/g)) {
    const k = tm[1];
    tasks.push({
      key: k,
      ru: t(ru, k.replace(/^data\./, '')).slice(0, 120),
      en: t(en, k.replace(/^data\./, '')).slice(0, 120),
      ky: t(ky, k.replace(/^data\./, '')).slice(0, 80),
    });
  }
  return { id, tasks };
}

const out = {
  scannedIds: ids.length,
  hitCount: hits.length,
  hits,
  evidence: {
    'g3e-tobe-l3': dumpLesson('g3e-tobe-l3'),
    'g3w-nat-l3': dumpLesson('g3w-nat-l3'),
    'g3r-adj-l2': dumpLesson('g3r-adj-l2'),
  },
};
fs.writeFileSync(path.join(__dirname, '_hijack_scan_phase34_pilot.json'), JSON.stringify(out, null, 2) + '\n');
console.log('scanned', ids.length, 'hits', hits.length);
for (const h of hits) {
  console.log(h.id, h.taskId, h.issues.join('; '), '| RU:', h.qRu.slice(0, 60), '| EN:', h.qEn.slice(0, 60));
}
