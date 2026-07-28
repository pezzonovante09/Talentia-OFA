import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const lines = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8').split('\n');
const ids = JSON.parse(fs.readFileSync(path.join(__dirname, '_reaudit2_ids_g2.json'), 'utf8')).map((x) => x.id);

function t(obj, key) {
  if (!key) return '';
  let cur = obj;
  for (const p of key.split('.')) {
    cur = cur?.[p];
    if (cur === undefined) return '<MISS>';
  }
  return String(cur);
}

const cyr = /[\u0400-\u04FF]/;
const out = [];

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
  const block = lines.slice(start, end).join('\n');
  const issues = [];
  // dialog stub: EN much shorter
  for (const m of block.matchAll(/\{ speaker: '(\w+)', textKey: '([^']+)' \}/g)) {
    const R = t(ru, m[2]);
    const E = t(en, m[2]);
    const K = t(ky, m[2]);
    if (R.length > 50 && E.length < R.length * 0.5) issues.push(`dialog_stub_en:${m[1]}`);
    if (R.length > 50 && K.length < R.length * 0.5 && K !== E) issues.push(`dialog_stub_ky:${m[1]}`);
    // KY left in Russian (lots of cyrillic russian-looking vs kyrgyz - hard); check KY === RU for dialog
    if (K === R && R.length > 20) issues.push(`dialog_ky_eq_ru:${m[1]}`);
  }
  // intro KY still russian (equals RU)
  for (const m of block.matchAll(/\{ titleKey: '([^']+)', bodyKey: '([^']+)'/g)) {
    if (t(ky, m[1]) === t(ru, m[1]) && t(ru, m[1]).length > 5) issues.push(`intro_title_ky_eq_ru`);
    if (t(ky, m[2]) === t(ru, m[2]) && t(ru, m[2]).length > 20) issues.push(`intro_body_ky_eq_ru`);
    // KY body still mostly Russian (contains typical Russian words and little Kyrgyz)
  }
  // answers
  for (let i = start; i < end; i++) {
    const ln = lines[i];
    const tm = ln.match(/id: '([\w-]+)', type: '(\w+)'/);
    if (!tm || /topicId/.test(ln)) continue;
    const cam = ln.match(/correctAnswerKey: '([^']+)'/);
    if (cam) {
      const R = t(ru, cam[1]);
      const E = t(en, cam[1]);
      const K = t(ky, cam[1]);
      out.push({ id, task: tm[1], type: tm[2], ans: { R, E, K } });
      if (id.startsWith('g2e-') && cyr.test(K) && !cyr.test(E) && /^[A-Za-z]/.test(E)) {
        issues.push(`ky_translates_en_answer:${tm[1]}:${E}->${K}`);
      }
      if (E === R && R.length > 2 && cyr.test(R) && id.startsWith('g2e-') === false) {
        // en answer still russian for non-english - may be intentional for rus lessons
      }
      if (K === R && id.startsWith('g2e-') && cyr.test(R)) {
        // KY answer equals RU for english lesson meaning questions - often OK
      }
    }
    // English target options wrongly translated in KY for g2e
    if (id.startsWith('g2e-')) {
      for (const om of ln.matchAll(/\{ id: '(\w+)', textKey: '([^']+)', correct: (true|false)/g)) {
        const E = t(en, om[2]);
        const K = t(ky, om[2]);
        // English vocab tokens that should stay
        const keep =
          /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Math|Music|Art|PE|Science|History|English|book|pen|desk|chair|board|pencil|Please|Thank you|Sorry|Excuse me|On|In|At)$/i;
        if (keep.test(E.trim()) && K !== E && cyr.test(K)) {
          issues.push(`ky_translates_keep_token:${tm[1]}.${om[1]}:${E}->${K}`);
        }
      }
      const opts = ln.match(/options:\s*\[([^\]]+)\]/);
      if (opts) {
        for (const km of opts[1].matchAll(/'([^']+)'/g)) {
          const key = km[1];
          if (!key.startsWith('data.')) continue;
          const E = t(en, key);
          const K = t(ky, key);
          const keep =
            /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Math|Music|Art|PE|On|In|At|You're welcome!|Please!|Goodbye!)$/i;
          if (keep.test(E.trim()) && K !== E && cyr.test(K)) {
            issues.push(`ky_translates_keep_fb:${tm[1]}:${E}->${K}`);
          }
        }
      }
    }
  }
  if (issues.length) {
    console.log(id, [...new Set(issues)].join(' | '));
  }
}
console.log('\n--- INPUT ANSWERS ---');
for (const a of out) {
  console.log(a.id, a.task, JSON.stringify(a.ans));
}
