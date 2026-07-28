import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));

function t(doc, k) {
  const parts = k.replace(/^data\./, '').split('.');
  let cur = doc.data;
  for (const x of parts) cur = cur?.[x];
  return typeof cur === 'string' ? cur : '';
}

function dump(id) {
  const idx = worlds.indexOf(`id: '${id}'`);
  if (idx < 0) {
    console.log('MISSING', id);
    return;
  }
  const slice = worlds.slice(idx, idx + 4000);
  const qks = [...slice.matchAll(/questionKey:\s*'([^']+)'/g)].map((m) => m[1]);
  const oks = [...new Set([...slice.matchAll(/textKey:\s*'([^']+)'/g)].map((m) => m[1]))];
  console.log('\n====', id, '====');
  for (const k of qks) {
    console.log('Q', k);
    console.log('  RU', t(ru, k));
    console.log('  EN', t(en, k));
    console.log('  KY', t(ky, k));
  }
  for (const k of oks) {
    const r = t(ru, k);
    const e = t(en, k);
    const issues = [];
    if (/recycle/i.test(k) && !/вторсырь|перераб|recycle/i.test(r)) issues.push('recycle_key');
    if (/burn_trash|cut_trees/i.test(k) && /библиотек|погод/i.test(r)) issues.push('wrong_distractor_topic');
    if (/endangered|extinct|recipe/i.test(k) && /кислород|красот|проблем/i.test(r)) issues.push('species_key_for_trees');
    if (/are_they|is_they|am_they/i.test(k) && /she|tired/i.test(r + e)) issues.push('they_key_for_she');
    if (/we_blank_ready|are_they_question|am_used/i.test(k) && /\?|инверс|___ we/i.test(r) && /___ ready|What word/i.test(e)) {
      issues.push('qkey_old_affirmative');
    }
    if (/size_adj/i.test(k) && /быстр|степен/i.test(r)) issues.push('size_key_degree_ru');
    if (/protect_nature_how/i.test(k) && /красн/i.test(r)) issues.push('protect_how_vs_redbook');
    if (issues.length) console.log('OPT/KEY', k, issues.join(','), '|RU', r, '|EN', e);
  }
}

const ids = [
  'g3e-tobe-l3',
  'g3w-nat-l3',
  'g3r-adj-l2',
  'g3e-tobe-l1',
  'g3e-tobe-l2',
  'g3r-adj-l1',
  'g3r-adj-l3',
  'g3r-gen-l1',
  'g3r-gen-l2',
  'g3r-gen-l3',
  'g3r-verb-l1',
  'g3r-verb-l2',
  'g3r-verb-l3',
  'g2e-days-l2',
  'g2e-sch-l3',
  'g1e-grt-l2',
  'g1w-nat-l3',
  'g2r-sent-l1',
  'g2s-plt-l1',
  'g2r-sh-l1',
  'g2r-sh-l2',
  'g2e-phr-l1',
  'g2e-days-l1',
  'g4e-pres-l1',
  'g2s-ani-l1',
  'jungle-sub-2',
  'canyon-words-2',
  'lab-animals-2',
];
for (const id of ids) dump(id);

// Also extract task types for pureMC 7
console.log('\n==== PUREMC TASK TYPES ====');
const pure = ['g1e-num-l2', 'g2r-sp-l1', 'g2s-ani-l3', 'g2s-bdy-l3', 'g2e-phr-l3', 'g3w-eco-l1', 'g4m-cm-l2'];
for (const id of pure) {
  const idx = worlds.indexOf(`id: '${id}'`);
  const slice = worlds.slice(idx, idx + 2500);
  const tasks = [...slice.matchAll(/\{\s*id:\s*'([^']+)',\s*type:\s*'([^']+)'/g)]
    .filter((m) => m[1] !== id)
    .slice(0, 8)
    .map((m) => `${m[1]}:${m[2]}`);
  console.log(id, tasks.join(' | '));
}

// Compare r2 lesson templates for these 7
const b3 = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_merged.before_reaudit3.json'), 'utf8'));
console.log('\n==== r2 (before_reaudit3) notes on pure7 ====');
for (const id of pure) {
  const L = b3.lessons.find((x) => x.id === id);
  console.log(id, 'c=' + L?.coherence, 'pureMc=' + L?.pureMc, 'problems=', JSON.stringify(L?.problems?.slice(0, 2)));
}
