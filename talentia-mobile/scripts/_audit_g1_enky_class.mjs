import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const live = JSON.parse(fs.readFileSync(path.join(__dirname, '_audit_g1_live.json'), 'utf8'));
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));

function g(obj, key) {
  let c = obj;
  for (const p of key.split('.')) {
    c = c?.[p];
    if (c === undefined) return undefined;
  }
  return c;
}

const numericOnly = /^[\d\s+\-–—=<>≤≥×÷.,!?:;()«»"'%\/\\?]+$/;
const punctOnly = /^[.?!…,;:]+$/;
// letters / short wordforms used as RU literacy targets
const shortRuWordform = /^[А-Яа-яЁёA-Za-zЯЮЕЁяюеё]{1,12}([-\s][А-Яа-яЁёA-Za-z]{1,12})?$/;

function classify(flag, lessonId, subject) {
  const m = String(flag).match(/:\s*(data\.\S+)/);
  const key = m?.[1];
  if (!key) return { keep: true, reason: 'no-key' };
  const rv = String(g(ru, key) ?? '');
  const ev = g(en, key);
  const kv = g(ky, key);
  const kind = String(flag).startsWith('en=')
    ? 'en'
    : String(flag).startsWith('ky=')
      ? 'ky'
      : String(flag).includes('missing')
        ? 'missing'
        : 'other';

  if (kind === 'missing') return { keep: true, reason: 'missing', rv, ev, kv };

  if (numericOnly.test(rv.trim()) || punctOnly.test(rv.trim()))
    return { keep: false, reason: 'numeric/punct', rv };

  // English-lesson answer targets intentionally shared across locales
  if (subject === 'reading' && /^[A-Za-z]/.test(rv.trim()) && !/[А-Яа-яЁё]/.test(rv))
    return { keep: false, reason: 'intentional_EN_target', rv };

  // Russian literacy answer targets intentionally shared
  if (
    (subject === 'reading_ru' || /g1r-/.test(lessonId)) &&
    /[А-Яа-яЁё]/.test(rv) &&
    shortRuWordform.test(rv.trim())
  )
    return { keep: false, reason: 'intentional_RU_wordform', rv };

  // ABA copies
  if (/aba_|special_aba|_a\d|_aba/i.test(key))
    return { keep: false, reason: 'aba_ky_copies_ru', rv };

  // cognates / brand-ish short shared tokens
  if (/^(да|нет|ok|ок|chips|чипсы)$/i.test(rv.trim()))
    return { keep: false, reason: 'cognate', rv };

  // math equation questions
  if (/[=+\-−]/.test(rv) && /^[\d\s+\-−=<>?а-яА-ЯёЁa-zA-Z.,!]+$/.test(rv) && rv.length < 20)
    return { keep: false, reason: 'numericish_eq', rv };

  return { keep: true, reason: 'real?', rv, ev, kv };
}

const report = {};
for (const L of live) {
  const kept = [];
  const dropped = [];
  for (const f of L.enkyFlags || []) {
    const c = classify(f, L.id, L.subject);
    if (c.keep) kept.push({ f, ...c });
    else dropped.push({ f, reason: c.reason, rv: c.rv });
  }
  if (kept.length || dropped.length)
    report[L.id] = {
      kept: kept.slice(0, 30),
      droppedSample: dropped.slice(0, 8),
      keptN: kept.length,
      droppedN: dropped.length,
    };
}

fs.writeFileSync(path.join(__dirname, '_audit_g1_enky_class.json'), JSON.stringify(report, null, 2));
const withKept = Object.entries(report).filter(([, v]) => v.keptN);
console.log(
  'lessons with kept flags',
  withKept.length,
  withKept.map(([id, v]) => id + ':' + v.keptN),
);
for (const [id, v] of withKept) {
  console.log('\n', id);
  for (const k of v.kept.slice(0, 10))
    console.log(' ', k.f, '|', JSON.stringify(k.rv), 'en=', JSON.stringify(k.ev), 'ky=', JSON.stringify(k.kv));
}
