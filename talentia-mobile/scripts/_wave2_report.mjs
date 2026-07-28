import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const after = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/_curriculum_audit_merged.json'), 'utf8'),
);
const before = JSON.parse(
  fs.readFileSync(
    path.join(root, 'scripts/_curriculum_audit_merged.snapshot_before_wave1.json'),
    'utf8',
  ),
);
const lessons = Array.isArray(after.lessons) ? after.lessons : after;
const beforeL = Array.isArray(before.lessons) ? before.lessons : before;
const byId = Object.fromEntries(beforeL.map((l) => [l.id, l]));

const crit = lessons.filter((l) => l.coherence <= 2).sort((a, b) => a.c - b.c || a.id.localeCompare(b.id));
const lowC = lessons.filter((l) => l.coherence < 4).sort((a, b) => a.c - b.c || a.id.localeCompare(b.id));

console.log('CRITICAL (C<=2):', crit.length);
for (const l of crit) {
  const main = (l.problems?.[0]?.issue || '').replace(/\s+/g, ' ');
  console.log(`- ${l.id} | C=${l.c} U=${l.u} E=${l.e} D=${l.d} | ${l.verdict} | ${l.title}`);
  console.log(`  Main: ${main}`);
  if (l.enkyFlags?.length) console.log(`  ENKY: ${l.enkyFlags.join('; ')}`);
}

console.log('\nALL C<4:', lowC.length);
for (const l of lowC) {
  const main = (l.problems?.[0]?.issue || '').replace(/\s+/g, ' ');
  const was = byId[l.id];
  const delta = was ? `was C=${was.coherence}` : 'new';
  console.log(
    `${String(l.c).padStart(1)} | ${l.verdict.padEnd(14)} | ${l.id.padEnd(22)} | ${l.title.padEnd(28)} | ${main.slice(0, 140)}`,
  );
}

const ids = ['g3r-gen-l1', 'g3r-verb-l2', 'g3r-adj-l1'];
console.log('\n=== g3r history vs before_wave1 ===');
for (const id of ids) {
  const a = lessons.find((l) => l.id === id);
  const b = byId[id];
  console.log('\n', id);
  console.log('  after: C=', a?.coherence, 'enky=', a?.enkyFlags);
  console.log('  before wave1: C=', b?.coherence, 'enky=', b?.enkyFlags);
  console.log('  after problems:', a?.problems?.map((p) => p.issue).join(' | '));
  console.log('  before problems:', b?.problems?.map((p) => p.issue).join(' | '));
}

// phase2 worklist mentions
const wl = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/_fix_phase2_worklist.json'), 'utf8'),
);
console.log('\n=== phase2 worklist hits ===');
for (const id of ids) {
  const hit = (wl.lessons || wl).filter?.((x) => x.id === id) || wl.filter?.((x) => x.id === id);
  const items = Array.isArray(wl)
    ? wl.filter((x) => x.id === id || x.lessonId === id)
    : wl.lessons
      ? wl.lessons.filter((x) => x.id === id)
      : Object.values(wl).flat?.() || [];
  console.log(id, 'worklist keys', Object.keys(wl).slice(0, 10));
}
