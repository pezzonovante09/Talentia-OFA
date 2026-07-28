import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const live = JSON.parse(fs.readFileSync(path.join(__dirname, '_audit_g1_live.json'), 'utf8'));

const lines = [];
lines.push('count=' + live.length);
for (const L of live) {
  lines.push('');
  lines.push(
    `== ${L.id} | ${L.title} | types=${(L.types || []).join('+')} | n=${L.taskCount} | enkyRaw=${(L.enkyFlags || []).length}`,
  );
  for (const d of L.dialog || []) lines.push(`  [${d.speaker}] ${(d.text || '').slice(0, 120)}`);
  for (const intro of L.intro || [])
    lines.push(`  [intro] ${intro.title} :: ${(intro.body || '').slice(0, 100)}`);
  (L.tasks || []).forEach((t, i) => {
    const ans =
      (t.options || [])
        .filter((o) => o.correct)
        .map((o) => o.text)
        .join(' / ') ||
      t.answer ||
      '';
    const opts = (t.options || []).map((o) => `${o.correct ? '*' : ''}${o.text}`).join(' ; ');
    lines.push(
      `  t${i + 1} <${t.type}>${t.audience ? '[ABA]' : ''} Q: ${(t.q || '').slice(0, 110)}`,
    );
    if (opts) lines.push(`      opts: ${opts.slice(0, 160)}`);
    if (ans && !opts.includes('*')) lines.push(`      answer: ${ans}`);
  });
  if (L.enkyFlags?.length) {
    lines.push('  ENKY:');
    for (const f of L.enkyFlags) lines.push('    - ' + f);
  }
}
fs.writeFileSync(path.join(__dirname, '_audit_g1_compact.txt'), lines.join('\n'), 'utf8');
console.log('wrote', lines.length, 'lines');
