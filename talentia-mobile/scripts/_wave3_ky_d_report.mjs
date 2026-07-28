import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const after5 = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_merged.snapshot_after_wave2.json'), 'utf8'),
);
const inv = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_inventory.json'), 'utf8'),
);

function get(doc, dotted) {
  const parts = dotted.replace(/^data\./, '').split('.');
  let cur = doc.data;
  for (const p of parts) cur = cur?.[p];
  return cur;
}

function resolveTask(doc, key) {
  if (!key) return '';
  if (key.startsWith('data.')) return get(doc, key);
  return doc.data.tasks?.[key] ?? '';
}

// Collect all ky_eq_ru keys from after_wave2
const lessons = after5.lessons || after5;
const rows = [];
for (const L of lessons) {
  for (const f of L.enkyFlags || []) {
    const s = typeof f === 'string' ? f : JSON.stringify(f);
    const m = /^ky_eq_ru:(.+)$/.exec(s);
    if (!m) continue;
    const key = m[1];
    const r = resolveTask(ru, key);
    const e = resolveTask(en, key);
    const k = resolveTask(ky, key);
    rows.push({
      lesson: L.id,
      key,
      ru: r,
      en: e,
      ky: k,
      kyEqRu: r === k,
      enDiffers: e !== r && e !== '',
      verdict:
        r === k && e !== r && String(e).length > 0
          ? 'REAL_KY_STUB'
          : r === k && (e === r || !e)
            ? 'SHARED_TOKEN_OR_ALL_SAME'
            : r !== k
              ? 'FALSE_POSITIVE'
              : 'CHECK',
    });
  }
}

const byLesson = {};
for (const row of rows) {
  if (!byLesson[row.lesson]) byLesson[row.lesson] = [];
  byLesson[row.lesson].push(row);
}

const out = {
  totalFlagHits: rows.length,
  lessons: Object.keys(byLesson).sort(),
  byLesson: Object.fromEntries(
    Object.entries(byLesson).map(([id, list]) => [
      id,
      {
        count: list.length,
        real: list.filter((x) => x.verdict === 'REAL_KY_STUB').length,
        falsePos: list.filter((x) => x.verdict === 'FALSE_POSITIVE').length,
        shared: list.filter((x) => x.verdict === 'SHARED_TOKEN_OR_ALL_SAME').length,
        samples: list.slice(0, 6),
      },
    ]),
  ),
};

fs.writeFileSync(
  path.join(root, 'scripts/_wave3_ky_eq_ru_report.json'),
  JSON.stringify(out, null, 2) + '\n',
);

// D inventory
const mcInput = (inv.lessons || []).filter((l) => {
  const u = [...(l.uniqueTypes || [])].sort();
  return u.length === 2 && u.includes('input') && u.includes('multiple_choice');
});
const richer = (inv.lessons || []).filter((l) => {
  const u = new Set(l.uniqueTypes || []);
  return u.size >= 3 || [...u].some((t) => !['input', 'multiple_choice'].includes(t));
});

const report = {
  ky: out,
  diversity: {
    total: (inv.lessons || []).length,
    pureMc: inv.pureMcCount,
    pureMcIds: inv.pureMcIds,
    mcInputOnly: mcInput.length,
    richerThanMcInput: richer.length,
    mcInputIds: mcInput.map((l) => l.id),
  },
};
fs.writeFileSync(path.join(root, 'scripts/_wave3_plan_partial.json'), JSON.stringify(report, null, 2) + '\n');
console.log('ky lessons', out.lessons.length, 'hits', out.totalFlagHits);
console.log('mc+input', mcInput.length, 'pureMc', inv.pureMcCount, 'richer', richer.length);
for (const [id, info] of Object.entries(out.byLesson)) {
  console.log(
    id,
    `real=${info.real} false=${info.falsePos} shared=${info.shared}`,
    info.samples[0] ? `e.g. KY=${JSON.stringify(info.samples[0].ky)?.slice(0, 40)} EN=${JSON.stringify(info.samples[0].en)?.slice(0, 40)}` : '',
  );
}
