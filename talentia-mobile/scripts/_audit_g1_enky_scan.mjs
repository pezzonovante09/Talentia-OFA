import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ids = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_reaudit2_ids_g1.json'), 'utf8'));
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const g1w = fs.readFileSync(path.join(root, 'src/data/g1worldRewrittenTasks.ts'), 'utf8');
const lines = worlds.split('\n');

function get(obj, key) {
  let c = obj;
  for (const p of key.split('.')) {
    c = c?.[p];
    if (c === undefined) return undefined;
  }
  return c;
}

function lessonBlock(id) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`id: '${id}', topicId:`).test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < end; i++) {
    if (/id: '[a-z0-9-]+', topicId:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

function collectKeys(id, block) {
  const keys = new Set();
  for (const m of block.matchAll(/'((?:data|lessons)\.[^']+)'/g)) keys.add(m[1]);
  // rewritten task banks
  const tasksRef = block.match(/tasks:\s*([A-Za-z0-9_]+)/)?.[1];
  if (tasksRef && tasksRef !== '[' && g1w.includes(`export const ${tasksRef}`)) {
    const re = new RegExp(`export const ${tasksRef}[\\s\\S]*?export const|export const ${tasksRef}[\\s\\S]*$`);
    const chunk = g1w.match(re)?.[0] || '';
    for (const m of chunk.matchAll(/'((?:data|lessons)\.[^']+)'/g)) keys.add(m[1]);
  }
  return [...keys];
}

const numericOnly = /^[\d\s+\-–—=<>≤≥×÷.,!?:;()«»"'%\/\\]+$/;
const cognateish = /^(Hello|Hi|Yes|No|OK|Ok|A|B|C|I|am|my|name|is|please|thank|you|thanks|good|morning|bye|cat|dog|pen|book|red|blue|one|two|three|four|five|six|seven|eight|nine|ten|[A-Za-z]|[А-Яа-яЁё])$/i;

const report = [];
for (const meta of ids) {
  const id = meta.id;
  const block = lessonBlock(id);
  const keys = collectKeys(id, block);
  const flags = [];
  for (const k of keys) {
    const rv = get(ru, k);
    if (rv === undefined || typeof rv !== 'string') continue;
    const rs = rv;
    const ev = get(en, k);
    const kv = get(ky, k);
    const es = ev === undefined ? null : String(ev);
    const ks = kv === undefined ? null : String(kv);
    const isNum = numericOnly.test(rs.trim());
    const isAba = /special_aba|_aba_|abaText/i.test(k) || /special_aba/.test(block);
    if (ev === undefined) flags.push({ kind: 'EN_MISSING', key: k, ru: rs.slice(0, 80) });
    if (kv === undefined) flags.push({ kind: 'KY_MISSING', key: k, ru: rs.slice(0, 80) });
    if (es !== null && es === rs && !isNum && rs.trim().length > 0) {
      flags.push({ kind: 'EN_EQ_RU', key: k, ru: rs.slice(0, 80), whitelistHint: cognateish.test(rs.trim()) ? 'cognate?' : null });
    }
    if (ks !== null && ks === rs && !isNum && rs.trim().length > 0) {
      flags.push({
        kind: 'KY_EQ_RU',
        key: k,
        ru: rs.slice(0, 80),
        whitelistHint: cognateish.test(rs.trim())
          ? 'cognate?'
          : isAba
            ? 'aba_ky_copies_ru?'
            : null,
      });
    }
  }
  // task types from dump-ish
  const types = [...block.matchAll(/type: '(\w+)'/g)].map((m) => m[1]);
  report.push({
    id,
    title: meta.title,
    subject: meta.subject,
    world: meta.world,
    keyCount: keys.length,
    types: [...new Set(types)],
    flagCount: flags.length,
    flags,
  });
}

fs.writeFileSync(path.join(root, 'scripts/_audit_g1_enky_scan.json'), JSON.stringify(report, null, 2));
const withFlags = report.filter((r) => r.flagCount);
console.log('lessons', report.length);
console.log('with raw flags', withFlags.length);
console.log(
  'top',
  withFlags
    .sort((a, b) => b.flagCount - a.flagCount)
    .slice(0, 10)
    .map((r) => `${r.id}:${r.flagCount}`),
);
const kinds = {};
for (const r of report) for (const f of r.flags) kinds[f.kind] = (kinds[f.kind] || 0) + 1;
console.log('kinds', kinds);
