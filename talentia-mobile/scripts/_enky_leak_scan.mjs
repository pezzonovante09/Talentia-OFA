/**
 * Compare RU/EN/KY for keys used by scope-A lessons; flag KY==RU (Cyrillic Q) and weak EN.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

// Parse worlds.ts lesson blocks lightly via dump of questionKeys from audit inventory
const inv = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_inventory.json'), 'utf8'));
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));

const ids = new Set([
  'g2r-sh-l2',
  'g2r-sh-l3',
  'g2m-100-l1',
  'g2m-100-l3',
  'g2m-add2-l1',
  'g2m-add2-l3',
  'g2m-times-l1',
  'g2m-times-l2',
  'g2m-times-l3',
  'g2e-sch-l1',
  'g2e-phr-l1',
  'g3m-1000-l1',
  'g2r-sp-l2',
  'g2r-sp-l3',
  'g2s-plt-l1',
  'g2s-ani-l1',
  'g2s-ani-l2',
  'g2s-ani-l3',
  'g2s-bdy-l1',
  'g2s-bdy-l2',
  'g3r-adj-l3',
  'g3r-gen-l3',
  'g3r-verb-l3',
  'g3e-daily-l3',
]);

function get(doc, dotted) {
  const parts = dotted.replace(/^data\./, '').split('.');
  let cur = doc.data;
  for (const p of parts) cur = cur?.[p];
  return typeof cur === 'string' ? cur : '';
}

const cyr = /[А-Яа-яЁё]/;
const rows = [];
for (const L of inv.lessons || []) {
  if (!ids.has(L.id)) continue;
  const keys = new Set();
  for (const t of L.tasks || []) {
    if (t.questionKey) keys.add(t.questionKey);
    if (t.sentenceKey) keys.add(t.sentenceKey);
    for (const o of t.options || []) if (o.textKey) keys.add(o.textKey);
  }
  for (const d of L.dialog || []) if (d.textKey) keys.add(d.textKey);
  for (const i of L.intro || []) {
    if (i.titleKey) keys.add(i.titleKey);
    if (i.bodyKey) keys.add(i.bodyKey);
  }
  for (const key of keys) {
    const r = get(ru, key);
    const e = get(en, key);
    const k = get(ky, key);
    const kyRuLeak = k && r && k.replace(/\s/g, '') === r.replace(/\s/g, '') && cyr.test(r);
    const kyHasRu = k && cyr.test(k) && /[а-яё]{4,}/i.test(k) && !/НОС|КОН|Ж|ЛИМОН|ЛАМПА|БЕЖИТ|КРАСИВЫЙ|ВЕСЁЛЫЙ|ТЁПЛЫЙ/.test(k);
    // looser: KY equals RU for long cyrillic strings
    const flags = [];
    if (kyRuLeak) flags.push('ky_eq_ru');
    else if (k && r && cyr.test(k) && k.includes('Буква') || (k && /Какой день|Какое число|Кто из|Для чего|На какой/.test(k)))
      flags.push('ky_ru_phrase');
    if (e && r && e.length < Math.min(40, r.length * 0.45) && !/^[0-9×x\s=?]+$/.test(e)) flags.push('en_short');
    if (flags.length) rows.push({ id: L.id, key, flags, r: r.slice(0, 80), e: e.slice(0, 80), k: k.slice(0, 80) });
  }
}
fs.writeFileSync(path.join(root, 'scripts/_enky_leak_scan.json'), JSON.stringify(rows, null, 2));
console.log('leak rows', rows.length);
for (const r of rows.slice(0, 60)) console.log(r.id, r.flags.join(','), r.key.replace('data.', ''), '|KY:', r.k);
