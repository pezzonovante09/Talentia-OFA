import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const out = JSON.parse(fs.readFileSync(path.join(__dirname, '_reaudit2_g0_live.json'), 'utf8'));
const meta = JSON.parse(fs.readFileSync(path.join(__dirname, '_reaudit2_ids_g0.json'), 'utf8'));
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const abaEn = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/abaTextOverrides.en.generated.json'), 'utf8'));
const abaKy = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/abaTextOverrides.ky.generated.json'), 'utf8'));
const abaRu = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/abaTextOverrides.generated.json'), 'utf8'));

function t(obj, key) {
  if (!key) return '';
  let c = obj;
  for (const p of key.split('.')) {
    c = c?.[p];
    if (c === undefined) return null;
  }
  return c;
}
function short(k) {
  return (k || '').replace(/^data\.tasks\./, '');
}
function isNumeric(s) {
  return /^[\d\s+\-×÷=<>,.]+$/.test(String(s || '').trim());
}

const report = [];

for (const item of meta) {
  const id = item.id;
  const startIdx = worlds.search(new RegExp(`id: '${id}',`));
  if (startIdx < 0) {
    report.push({ id, flags: [{ issue: 'not_found' }] });
    continue;
  }
  const after = worlds.slice(startIdx + 10);
  const nextLesson = after.search(/\n\s*id: '[a-z0-9-]+',\s*\n\s*topicId:/);
  const endIdx = nextLesson >= 0 ? startIdx + 10 + nextLesson : worlds.length;
  const block = worlds.slice(startIdx, endIdx);
  const lessonFlags = [];

  for (const dm of block.matchAll(/\{ speaker: '(\w+)', textKey: '([^']+)' \}/g)) {
    const key = dm[2];
    const r = t(ru, key);
    const e = t(en, key);
    const k = t(ky, key);
    if (!e || /TODO|FIXME|\[EN\]|lorem|stub/i.test(String(e))) {
      lessonFlags.push({ ref: 'dialog', issue: 'en_stub_or_missing', text: String(e).slice(0, 80) });
    }
    if (!k || /TODO|FIXME|\[KY\]|lorem|stub/i.test(String(k))) {
      lessonFlags.push({ ref: 'dialog', issue: 'ky_stub_or_missing', text: String(k).slice(0, 80) });
    }
    if (k && r && k === r && String(r).length > 20) {
      lessonFlags.push({ ref: 'dialog', issue: 'ky_eq_ru_dialog', text: String(r).slice(0, 80) });
    }
    if (e && r && e === r && /[А-Яа-яЁё]{5,}/.test(String(e))) {
      lessonFlags.push({ ref: 'dialog', issue: 'en_eq_ru_dialog', text: String(e).slice(0, 80) });
    }
  }

  const lesson = out.find((x) => x.id === id);
  for (const task of lesson?.tasks || []) {
    const qk = task.qKey;
    if (!qk) continue;
    const r = t(ru, qk);
    const e = t(en, qk);
    const k = t(ky, qk);
    const sh = short(qk);

    if (!e) lessonFlags.push({ ref: task.id, issue: 'en_missing_q' });
    if (!k) lessonFlags.push({ ref: task.id, issue: 'ky_missing_q' });

    // Real KY==RU on questions: long instructional prose (not numeric, not pure letter/syllable target)
    if (k && r && k === r && !isNumeric(r) && String(r).length > 12) {
      const pureTarget =
        /^[А-Яа-яЁёA-Za-z]{1,6}$/.test(String(r).trim()) ||
        /^(МА|МО|МУ|СА|СО|СУ|НА|НО|РА)([-\s]|$)/.test(String(r).trim());
      if (!pureTarget) {
        lessonFlags.push({
          ref: task.id,
          issue: 'ky_eq_ru_question',
          text: String(r).slice(0, 100),
        });
      }
    }

    // EN still full Russian for non-reading_ru worlds (island/meadow/garden should have EN)
    if (e && item.subject !== 'reading_ru' && /[А-Яа-яЁё]{8,}/.test(String(e)) && e === r) {
      lessonFlags.push({ ref: task.id, issue: 'en_eq_ru_question', text: String(e).slice(0, 100) });
    }

    // Wrong EN letter/story heuristics for island abc
    if (item.id.startsWith('island-abc') && e) {
      const lessonLetters = {
        'island-abc-l1': ['A', 'B'],
        'island-abc-l2': ['C', 'D'],
        'island-abc-l3': ['E', 'F'],
      }[item.id];
      // flag if EN question talks about wrong primary letter as the taught focus without correction frame
    }

    // Tautology: question restates option identity
    if (e && /which (?:word|color|animal) is (?:the )?(?:same|identical)/i.test(e)) {
      lessonFlags.push({ ref: task.id, issue: 'tautology', text: String(e).slice(0, 100) });
    }

    if (task.aba) {
      const aEn = abaEn[sh] || abaEn[qk] || e;
      const aKy = abaKy[sh] || abaKy[qk] || k;
      const aRu = abaRu[sh] || abaRu[qk] || r;
      if (aKy && aRu && aKy === aRu && !isNumeric(aRu) && String(aRu).length > 8) {
        // ABA shells should be localized; letter answers OK in options
        lessonFlags.push({
          ref: task.id,
          issue: 'aba_ky_eq_ru',
          text: String(aKy).slice(0, 80),
        });
      }
      if (aEn && aRu && aEn === aRu && /[А-Яа-яЁё]{4,}/.test(String(aEn))) {
        lessonFlags.push({
          ref: task.id,
          issue: 'aba_en_eq_ru',
          text: String(aEn).slice(0, 80),
        });
      }
    }
  }

  if (lessonFlags.length) report.push({ id, world: item.world, subject: item.subject, flags: lessonFlags });
}

fs.writeFileSync(path.join(__dirname, '_audit_g0_enky_real.json'), JSON.stringify(report, null, 2));
console.log('lessons_with_realish_flags', report.length);
for (const r of report) {
  const kinds = [...new Set(r.flags.map((f) => f.issue))];
  console.log(`${r.id}\t${r.flags.length}\t${kinds.join(',')}`);
}
console.log('--- samples ---');
for (const r of report.slice(0, 8)) {
  console.log(JSON.stringify(r, null, 0).slice(0, 400));
}
