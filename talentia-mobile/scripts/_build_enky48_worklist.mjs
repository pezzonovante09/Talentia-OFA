/**
 * Build detailed worklist for 48 meaning-break EN/KY lessons.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_merged.json'), 'utf8'));
const meaning = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_enky116_meaning.json'), 'utf8'));
const ids = [...meaning.hardIds, ...meaning.softInputIds, ...meaning.softOtherIds];
const byId = Object.fromEntries((data.lessons || []).map((l) => [l.id, l]));

const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const ky = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ky.json'), 'utf8'));
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');

const cyr = /[а-яА-ЯёЁ]/;
const out = [];

for (const id of ids) {
  const l = byId[id] || {};
  // find input answers still RU in worlds
  const re = new RegExp(`id: '${id}'[\\s\\S]{0,2500}?tasks: \\[([\\s\\S]*?)\\n\\s*\\],`, 'm');
  // simpler: grep answer lines near lesson - collect from worlds by scanning task ids from audit
  const inputs = [];
  const answerRe = /\{ id: '([^']+)', type: 'input'[^}]*answer: "([^"]*)"[^}]*\}/g;
  // search a window around lesson id
  const idx = worlds.indexOf(`id: '${id}'`);
  let slice = '';
  if (idx >= 0) {
    slice = worlds.slice(idx, idx + 3500);
    let m;
    while ((m = answerRe.exec(slice))) {
      if (cyr.test(m[2]) || /^[A-Za-z ]+$/.test(m[2])) inputs.push({ taskId: m[1], answer: m[2] });
    }
  }

  out.push({
    id,
    bucket: meaning.hardIds.includes(id) ? 'hard' : meaning.softInputIds.includes(id) ? 'soft_input' : 'soft_other',
    c: l.coherence,
    u: l.usefulness,
    flags: l.enkyFlags || [],
    problems: (l.problems || []).slice(0, 6),
    fixes: (l.fixes || []).slice(0, 6),
    inputsInWorlds: inputs,
  });
}

fs.writeFileSync(path.join(root, 'scripts/_enky48_worklist.json'), JSON.stringify(out, null, 2));
console.log('wrote', out.length);
for (const x of out) {
  console.log(`\n=== ${x.id} [${x.bucket}] C${x.c}/U${x.u} ===`);
  for (const f of x.flags) console.log('  FLAG', f);
  for (const p of x.problems) console.log('  PROB', p.ref, '-', String(p.issue).slice(0, 140));
  for (const i of x.inputsInWorlds) console.log('  INPUT', i.taskId, '=', i.answer);
}
