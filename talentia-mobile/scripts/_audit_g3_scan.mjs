import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_g3_live_trilocale.json'), 'utf8'));

const cyr = /[\u0400-\u04FF]/;
const latin = /[A-Za-z]/;
const whitelistAnswers = new Set([
  'Грустный',
  'Высокий дом',
  'Полечу',
  'Интересная',
  'Медленнее',
  'короткие',
  'гуляют',
]);
const isNumeric = (s) => /^[0-9]+$/.test(String(s).trim());
const isBareEq = (s) => /^[\d\s×xX*÷/=?\+\-]+$/.test(String(s).trim());

function flagsFor(L) {
  const flags = [];
  const check = (ref, r, e, k, kind) => {
    if (!r) return;
    if (e && String(e).startsWith('<MISSING')) flags.push(ref + ': EN missing');
    if (k && String(k).startsWith('<MISSING')) flags.push(ref + ': KY missing');
    const kyEq =
      k && r && String(k).replace(/\s/g, '') === String(r).replace(/\s/g, '') && cyr.test(r);
    if (kyEq) {
      if (isNumeric(r)) return;
      if (kind === 'answer' && (whitelistAnswers.has(r) || whitelistAnswers.has(k))) return;
      if (kind === 'opt' && /^g3r-/.test(L.id)) {
        flags.push(ref + ': KY==RU (RU morphology target; soft)');
      } else {
        flags.push(ref + ': KY==RU');
      }
    }
    if (e && cyr.test(e) && !latin.test(e)) {
      if (!(kind === 'answer' && whitelistAnswers.has(e))) {
        flags.push(ref + ': EN Cyrillic-only');
      }
    }
    if (e && r && e === r && cyr.test(r) && !isNumeric(r) && !isBareEq(r)) {
      if (!(kind === 'answer' && whitelistAnswers.has(e))) flags.push(ref + ': EN==RU');
    }
    const taut = /([A-Za-z\u0400-\u04FF]+)\s*[—\-–]\s*\1\b/i;
    if (e && taut.test(e)) flags.push(ref + ': EN tautology gloss');
    if (k && taut.test(k)) flags.push(ref + ': KY tautology gloss');
    if (
      kind === 'q' &&
      e &&
      r &&
      !isBareEq(e) &&
      e.length < Math.min(35, r.length * 0.4) &&
      cyr.test(r) &&
      latin.test(e)
    ) {
      flags.push(ref + ': EN stem flattened vs RU');
    }
  };
  for (const d of L.dialog || []) check('dialog.' + d.speaker, d.ru, d.en, d.ky, 'dialog');
  (L.intros || []).forEach((intro, i) => {
    check('intro' + i + '.title', intro.title.ru, intro.title.en, intro.title.ky, 'intro');
    check('intro' + i + '.body', intro.body.ru, intro.body.en, intro.body.ky, 'intro');
  });
  (L.tasks || []).forEach((t, i) => {
    if (t.q) check('t' + (i + 1) + '.q', t.q.ru, t.q.en, t.q.ky, 'q');
    for (const o of t.opts || []) check('t' + (i + 1) + '.' + o.id, o.ru, o.en, o.ky, 'opt');
    if (t.answer) check('t' + (i + 1) + '.ans', t.answer.ru, t.answer.en, t.answer.ky, 'answer');
  });
  return flags;
}

const report = data.map((L) => {
  const types = L.tasks.map((t) => t.type);
  return {
    id: L.id,
    types,
    typeDiversity: [...new Set(types)].length,
    flags: flagsFor(L),
    tasks: L.tasks.map((t, i) => ({
      i: i + 1,
      type: t.type,
      ru: (t.q?.ru || '').slice(0, 160),
      en: (t.q?.en || '').slice(0, 160),
      ky: (t.q?.ky || '').slice(0, 160),
      ans: t.answer ? { ru: t.answer.ru, en: t.answer.en, ky: t.answer.ky } : null,
      correct: (t.opts || [])
        .filter((o) => o.correct)
        .map((o) => ({ ru: o.ru, en: o.en, ky: o.ky })),
      opts: (t.opts || []).map((o) => ({
        id: o.id,
        correct: o.correct,
        ru: o.ru,
        en: o.en,
        ky: o.ky,
      })),
    })),
    dialog: (L.dialog || []).map((d) => ({
      sp: d.speaker,
      ru: d.ru,
      en: d.en,
      ky: d.ky,
    })),
    intros: (L.intros || []).map((x) => ({
      t: { ru: x.title.ru, en: x.title.en, ky: x.title.ky },
      b: { ru: x.body.ru, en: x.body.en, ky: x.body.ky },
    })),
  };
});

fs.writeFileSync(path.join(root, 'scripts/_audit_g3_scan.json'), JSON.stringify(report, null, 2));
const withFlags = report.filter((r) => r.flags.length);
console.log('lessons with flags', withFlags.length);
for (const r of withFlags) console.log(r.id, '=>', r.flags.join(' | '));
console.log('--- all-input ---');
for (const r of report) if (r.typeDiversity === 1) console.log(r.id, r.types.join(','));
