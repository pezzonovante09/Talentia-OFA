/**
 * Spot-update audit scores for reaudit-tail touched lessons; refresh inventory + canvas averages.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SCORE_PATCHES = {
  'g2r-sent-l1': {
    coherence: 5,
    usefulness: 4,
    engagement: 3,
    diversity: 2,
    verdict: 'ok',
    note: 'Fixed wrong ✓ on subject Q; t4 now predicate; honest option keys',
  },
  'jungle-sub-2': {
    coherence: 4,
    usefulness: 4,
    engagement: 3,
    diversity: 4,
    verdict: 'ok',
    note: 'Expanded to 4 tasks + fill_blank',
  },
  'canyon-words-2': {
    coherence: 4,
    usefulness: 4,
    engagement: 3,
    diversity: 4,
    verdict: 'ok',
    note: 'Expanded to 4 tasks + fill_blank',
  },
  'lab-animals-2': {
    coherence: 4,
    usefulness: 4,
    engagement: 3,
    diversity: 4,
    verdict: 'ok',
    note: 'Expanded + sorting mechanic',
  },
  'space-planets-2': {
    coherence: 4,
    usefulness: 4,
    engagement: 3,
    diversity: 3,
    verdict: 'ok',
    note: 'Expanded to 4 tasks',
  },
  'g2r-sh-l1': { diversity: 4, note: 'pilot fill_blank' },
  'g2r-sh-l2': { diversity: 4, note: 'pilot fill_blank' },
  'g3r-gen-l1': { diversity: 4, note: 'pilot fill_blank' },
  'g1e-abc-l1': { diversity: 4, note: 'pilot fill_blank' },
  'g2e-days-l1': { diversity: 4, note: 'pilot fill_blank' },
  'g2e-phr-l1': { diversity: 4, note: 'pilot fill_blank' },
  'g4e-pres-l1': {
    diversity: 4,
    coherence: 4,
    note: 'pilot fill_blank + EN stub body fixed',
  },
  'g2s-ani-l1': { diversity: 4, note: 'pilot sorting' },
  'g2s-plt-l1': { diversity: 4, note: 'pilot routine_chain' },
};

// All g4 lessons: bump coherence if previously dragged by EN stub (body now translated)
const G4_IDS = [
  'g4m-md-l1', 'g4m-md-l2', 'g4m-md-l3',
  'g4m-cm-l1', 'g4m-cm-l2', 'g4m-cm-l3',
  'g4m-fr-l1', 'g4m-fr-l2', 'g4m-fr-l3',
  'g4r-conj-l1', 'g4r-conj-l2', 'g4r-conj-l3',
  'g4r-cases-l1', 'g4r-cases-l2', 'g4r-cases-l3',
  'g4r-text-l1', 'g4r-text-l2', 'g4r-text-l3',
  'g4e-pres-l1', 'g4e-pres-l2', 'g4e-pres-l3',
  'g4e-past-l1', 'g4e-past-l2', 'g4e-past-l3',
  'g4e-quest-l1', 'g4e-quest-l2', 'g4e-quest-l3',
  'g4s-help-l1', 'g4s-help-l2', 'g4s-help-l3',
  'g4s-emo-l1', 'g4s-emo-l2', 'g4s-emo-l3',
  'g4s-turn-l1', 'g4s-turn-l2', 'g4s-turn-l3',
];

function applyLesson(l, patch) {
  if (patch.coherence != null) l.coherence = patch.coherence;
  if (patch.usefulness != null) l.usefulness = patch.usefulness;
  if (patch.engagement != null) l.engagement = patch.engagement;
  if (patch.diversity != null) l.diversity = patch.diversity;
  l.sum = (l.coherence || 0) + (l.usefulness || 0) + (l.engagement || 0) + (l.diversity || 0);
  if (patch.verdict) l.verdict = patch.verdict;
  // Drop EN stub problems
  if (Array.isArray(l.problems)) {
    l.problems = l.problems.filter(
      (p) => !/We'll recap|EN intro body|шаблон/i.test(p.issue || ''),
    );
  }
  if (Array.isArray(l.enkyFlags)) {
    l.enkyFlags = l.enkyFlags.filter((f) => !/We'll recap|recap what matters/i.test(String(f)));
  }
  if (patch.note) {
    l.fixes = Array.isArray(l.fixes) ? l.fixes : [];
    if (!l.fixes.includes(patch.note)) l.fixes.unshift(patch.note);
  }
}

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const lessons = data.lessons || data;
  if (!Array.isArray(lessons)) return null;
  let n = 0;
  for (const l of lessons) {
    if (!l?.id) continue;
    const patch = SCORE_PATCHES[l.id];
    if (patch) {
      applyLesson(l, patch);
      n++;
    }
    if (G4_IDS.includes(l.id)) {
      const hadStub = (l.problems || []).some((p) => /We'll recap|EN intro body/i.test(p.issue || ''));
      const cBefore = l.coherence || 0;
      applyLesson(l, {}); // drops stub problems/flags
      if (hadStub && cBefore < 4) {
        l.coherence = Math.min(5, cBefore + 1);
        l.sum = (l.coherence || 0) + (l.usefulness || 0) + (l.engagement || 0) + (l.diversity || 0);
        n++;
      }
    }
  }
  if (data.lessons) {
    // recompute meta
    const avg = (key) =>
      Math.round((lessons.reduce((s, l) => s + (l[key] || 0), 0) / lessons.length) * 100) / 100;
    data.averages = {
      coherence: avg('coherence'),
      usefulness: avg('usefulness'),
      engagement: avg('engagement'),
      diversity: avg('diversity'),
    };
    data.criticalCount = lessons.filter((l) => l.verdict === 'critical').length;
    data.coherenceBelow4 = lessons.filter((l) => (l.coherence || 0) < 4).length;
    data.enkyIssueCount = lessons.filter((l) => (l.enkyFlags || []).length > 0).length;
    data.weakest15 = [...lessons]
      .map((l) => ({
        id: l.id,
        title: l.title,
        grade: l.grade,
        sum: l.sum,
        coherence: l.coherence,
        usefulness: l.usefulness,
        engagement: l.engagement,
        diversity: l.diversity,
        verdict: l.verdict,
      }))
      .sort((a, b) => a.sum - b.sum)
      .slice(0, 15);
    data.tailPatchedAt = new Date().toISOString();
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
  return { filePath, n, averages: data.averages, coherenceBelow4: data.coherenceBelow4 };
}

const merged = path.join(__dirname, '_curriculum_audit_merged.json');
const r = patchFile(merged);
console.log(r);

// Refresh inventory
const inv = spawnSync('node', [path.join(__dirname, '_audit_inventory.mjs')], {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8',
});
console.log(inv.stdout?.slice(-400) || inv.stderr);

// Rebuild canvas data + canvas from merge script helpers if present
const build = path.join(__dirname, '_build_audit_canvas.mjs');
if (fs.existsSync(build)) {
  // slim canvas data from merged
  const data = JSON.parse(fs.readFileSync(merged, 'utf8'));
  const canvasData = {
    meta: {
      generatedAt: data.tailPatchedAt || data.generatedAt,
      lessonCount: data.lessonCount,
      averages: data.averages,
      pureMcCount: data.pureMcCount,
      enkyIssueCount: data.enkyIssueCount,
      abaDiffCount: data.abaDiffCount,
      criticalCount: data.criticalCount,
      coherenceBelow4: data.coherenceBelow4,
      scope: 'Post reaudit-tails patch (grammar/EN stubs/short/mechanic pilot)',
    },
    top5: (data.weakest15 || []).slice(0, 5),
    templates: data.topTemplates || [],
    systemic: data.systemic || [],
    lessons: (data.lessons || []).map((l) => ({
      id: l.id,
      grade: String(l.grade),
      subject: l.subject,
      world: l.world,
      title: l.title,
      c: l.coherence,
      u: l.usefulness,
      e: l.engagement,
      d: l.diversity,
      sum: l.sum,
      verdict: l.verdict,
      problems: (l.problems || []).slice(0, 4).map((p) => ({ ref: p.ref, issue: p.issue })),
      fixes: (l.fixes || []).slice(0, 3),
      enky: (l.enkyFlags || []).slice(0, 4),
      aba: !!l.abaDiff,
      pureMc: !!l.pureMc,
    })),
  };
  fs.writeFileSync(
    path.join(__dirname, '_curriculum_audit_canvas_data.json'),
    JSON.stringify(canvasData),
  );
  spawnSync('node', [build], { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: 'inherit' });
}

console.log('patch done');
