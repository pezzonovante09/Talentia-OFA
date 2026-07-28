import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const lines = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8').split('\n');

function t(obj, key) {
  if (!key) return '';
  let cur = obj;
  for (const p of key.split('.')) {
    cur = cur?.[p];
    if (cur === undefined) return '<MISS:' + key + '>';
  }
  return String(cur);
}

const cyr = /[\u0400-\u04FF]/;
const latinWord = /^[A-Za-z][A-Za-z0-9 '?!.,\-]*$/;

const ids = [
  'g2e-days-l1', 'g2e-days-l2', 'g2e-days-l3',
  'g2e-phr-l1', 'g2e-phr-l2', 'g2e-phr-l3',
  'g2e-sch-l1', 'g2e-sch-l2', 'g2e-sch-l3',
];

const report = [];
for (const id of ids) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (new RegExp(`id: '${id}', topicId:`).test(lines[i])) {
      start = i;
      break;
    }
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/id: '[a-z0-9-]+', topicId:/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const flags = [];
  const lessonOut = [];
  for (let i = start; i < end; i++) {
    const ln = lines[i];
    const tm = ln.match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(ln)) continue;
    const tid = tm[1];
    const qm = ln.match(/questionKey: '([^']+)'/);
    lessonOut.push({
      id: tid,
      type: tm[2],
      q: { ru: t(ru, qm?.[1]), en: t(en, qm?.[1]), ky: t(ky, qm?.[1]) },
      opts: [],
      answer: null,
    });
    const cur = lessonOut[lessonOut.length - 1];
    for (const om of ln.matchAll(/\{ id: '(\w+)', textKey: '([^']+)', correct: (true|false)/g)) {
      const R = t(ru, om[2]);
      const E = t(en, om[2]);
      const K = t(ky, om[2]);
      cur.opts.push({ id: om[1], correct: om[3] === 'true', ru: R, en: E, ky: K, key: om[2] });
      if (om[3] === 'true' && latinWord.test(E.trim()) && K !== E && cyr.test(K)) {
        flags.push({ ref: tid + '.' + om[1], kind: 'ky_translates_en_target', EN: E, KY: K, RU: R });
      }
      // wrong options also matter for English MC (child picks English word)
      if (latinWord.test(E.trim()) && K !== E && cyr.test(K) && !/[A-Za-z]{3,}/.test(K)) {
        flags.push({ ref: tid + '.' + om[1], kind: 'ky_option_fully_translated', EN: E, KY: K });
      }
    }
    const cam = ln.match(/correctAnswerKey: '([^']+)'/);
    if (cam) {
      const R = t(ru, cam[1]);
      const E = t(en, cam[1]);
      const K = t(ky, cam[1]);
      cur.answer = { ru: R, en: E, ky: K, key: cam[1] };
      if (latinWord.test(E.trim()) && (K !== E) && cyr.test(K)) {
        flags.push({ ref: tid + '.answer', kind: 'ky_translates_en_answer', EN: E, KY: K, RU: R });
      }
    }
    const opts = ln.match(/options:\s*\[([^\]]+)\]/);
    if (opts) {
      for (const km of opts[1].matchAll(/'([^']+)'/g)) {
        const key = km[1];
        if (!key.startsWith('data.')) continue;
        const E = t(en, key);
        const K = t(ky, key);
        const R = t(ru, key);
        cur.opts.push({ id: 'fb', correct: null, ru: R, en: E, ky: K, key });
        if (latinWord.test(E.trim()) && K !== E && cyr.test(K) && !/[A-Za-z]{3,}/.test(K)) {
          flags.push({ ref: tid + '.fbopt', kind: 'ky_fb_opt_translated', EN: E, KY: K, key });
        }
      }
    }
  }
  // dialog stubs
  const block = lines.slice(start, end).join('\n');
  for (const m of block.matchAll(/textKey: '([^']+)'/g)) {
    const R = t(ru, m[1]);
    const E = t(en, m[1]);
    const K = t(ky, m[1]);
    if (m[1].includes('.dialog.') || m[1].includes('Dialog')) {
      // heuristic: EN much shorter / different story
      if (R.length > 40 && E.length < R.length * 0.45) {
        flags.push({ ref: m[1], kind: 'en_dialog_stub_vs_ru', EN: E.slice(0, 80), RU: R.slice(0, 80) });
      }
    }
  }
  const seen = new Set();
  const uniq = flags.filter((f) => {
    const k = f.ref + f.kind + f.EN + f.KY;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  report.push({ id, flags: uniq, tasks: lessonOut });
}

fs.writeFileSync(path.join(__dirname, '_audit_g2_enky_scan9.json'), JSON.stringify(report, null, 2));
for (const r of report) {
  console.log('\n##', r.id, 'flags', r.flags.length);
  for (const f of r.flags) console.log(' -', f.kind, f.ref, '| EN:', f.EN, '| KY:', f.KY);
  for (const task of r.tasks) {
    console.log(' ', task.id, task.type);
    console.log('   Q EN:', task.q.en.slice(0, 100));
    console.log('   Q KY:', task.q.ky.slice(0, 100));
    for (const o of task.opts) {
      console.log('   ', o.correct === true ? '[✓]' : o.correct === false ? '[ ]' : '[?]', 'EN:', o.en, '| KY:', o.ky);
    }
    if (task.answer) console.log('   ANS EN:', task.answer.en, '| KY:', task.answer.ky, '| RU:', task.answer.ru);
  }
}
