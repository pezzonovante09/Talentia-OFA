import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const out = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_audit_g4_legacy_final.json'), 'utf8'));
const g4p = JSON.parse(fs.readFileSync(path.join(root, 'scripts/_audit_g4_parsed.json'), 'utf8'));
const byId = Object.fromEntries(g4p.map((x) => [x.id, x]));

for (const row of out) {
  if (row.grade !== 4) continue;
  const L = byId[row.id];
  const tali = (L._tasks || []).filter((t) => /Тали/.test(t.prompt || '')).length;
  row.templates = (row.templates || []).filter(
    (t) => !['tali_error_frame', 'mc_only_4', 'npc_tali_dialog_pair', 'story_wrapper'].includes(t)
  );
  row.templates.unshift('mc_only_4');
  row.templates.push('npc_tali_dialog_pair');
  if (tali >= 2) row.templates.push('tali_error_frame');
  if (/клад|сейф|пицц|яблок|пекарн/i.test(L._dialog || '')) row.templates.push('story_wrapper');
  row.templates = [...new Set(row.templates)];

  row.problems = row.problems.map((p) => {
    if (String(p.issue).includes('Сигнал аудита') || String(p.issue).includes('Hi! Lesson')) {
      return {
        ref: p.ref,
        issue:
          'EN-диалог в _dialog_stubs.json (исторический Hi! Lesson stub); актуальный en.json — калька RU с теми же role-swap ошибками',
      };
    }
    return p;
  });
}

fs.writeFileSync(path.join(root, 'scripts/_audit_g4_legacy_final.json'), JSON.stringify(out, null, 2));

for (const r of out) {
  const wrong = (r.problems || []).filter((p) => /Неверный/.test(p.issue)).length;
  console.log(
    `${r.id}\tc${r.coherence}u${r.usefulness}e${r.engagement}d${r.diversity}\t${r.verdict}\twrong=${wrong}`
  );
}
