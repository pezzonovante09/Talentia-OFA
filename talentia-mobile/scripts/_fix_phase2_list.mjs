import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const merged = JSON.parse(fs.readFileSync(path.join(__dirname, '_curriculum_audit_merged.json'), 'utf8'));

// Wrong-correct-flag related issues (Phase 2 scope)
const re = /ключ|верный ответ|помечен|инверси|правильн\w* ответ|отмечен|correct|ложн/i;
// Exclude issues already solved by Phase 1 shared-key restore
const phase1 = /«Кто\? Что\?»|Кто\? Что\?|Am they|Is they|Are they students|К прилагательному|К существительному/;

const out = [];
for (const l of merged.lessons) {
  const probs = (l.problems || []).filter(p => re.test(p.issue) && !phase1.test(p.issue));
  if (!probs.length) continue;
  out.push({
    id: l.id, grade: l.grade, title: l.title,
    problems: probs.map(p => ({ ref: p.ref, issue: p.issue })),
    fixes: l.fixes || [],
  });
}
fs.writeFileSync(path.join(__dirname, '_fix_phase2_worklist.json'), JSON.stringify(out, null, 2));
console.log('lessons:', out.length, 'problems:', out.reduce((a, l) => a + l.problems.length, 0));
for (const l of out) {
  console.log('== ' + l.id + ' (' + l.title + ')');
  for (const p of l.problems) console.log('   - ' + p.issue.slice(0, 220));
}
