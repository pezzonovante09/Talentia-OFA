import fs from 'fs';
const m = JSON.parse(fs.readFileSync('scripts/_curriculum_audit_merged.json', 'utf8'));
const rows = [];
for (const l of m.lessons) {
  const probs = l.problems || [];
  if (!probs.length && l.coherence >= 4 && l.usefulness > 2 && l.sum > 12) continue;
  rows.push({
    id: l.id,
    sum: l.sum,
    c: l.coherence,
    u: l.usefulness,
    verdict: l.verdict,
    problems: probs.map((p) => p.issue),
    fixes: l.fixes || [],
  });
}
rows.sort((a, b) => a.sum - b.sum || a.c - b.c);
fs.writeFileSync('scripts/_reaudit2_fix_worklist.json', JSON.stringify(rows, null, 2) + '\n');
console.log('worklist', rows.length);
for (const r of rows.slice(0, 40)) {
  console.log(`\n${r.id} sum${r.sum} C${r.c}`);
  for (const p of r.problems.slice(0, 3)) console.log('  -', String(p).slice(0, 140));
}
