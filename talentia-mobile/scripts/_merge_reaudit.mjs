/**
 * Merge grade audit JSONs → merged + delta + canvas data.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function asArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.lessons)) return data.lessons;
  throw new Error('Expected array or {lessons}');
}

function sumScores(l) {
  return (l.coherence || 0) + (l.usefulness || 0) + (l.engagement || 0) + (l.diversity || 0);
}

function avg(arr, key) {
  if (!arr.length) return 0;
  return Number((arr.reduce((s, x) => s + (Number(x[key]) || 0), 0) / arr.length).toFixed(2));
}

const files = [
  '_audit_g0.json',
  '_audit_g1.json',
  '_audit_g2.json',
  '_audit_g3.json',
  '_audit_g4_legacy_final.json',
];

for (const f of files) {
  if (!fs.existsSync(path.join(__dirname, f))) {
    console.error('Missing', f);
    process.exit(1);
  }
}

const inv = load('_curriculum_audit_inventory.json');
// Prefer immediate previous reaudit snapshot if present; else original baseline.
const beforeName = fs.existsSync(path.join(__dirname, '_curriculum_audit_merged.before_reaudit9.json'))
  ? '_curriculum_audit_merged.before_reaudit9.json'
  : fs.existsSync(path.join(__dirname, '_curriculum_audit_merged.before_reaudit8.json'))
    ? '_curriculum_audit_merged.before_reaudit8.json'
    : fs.existsSync(path.join(__dirname, '_curriculum_audit_merged.before_reaudit7.json'))
      ? '_curriculum_audit_merged.before_reaudit7.json'
      : fs.existsSync(path.join(__dirname, '_curriculum_audit_merged.before_reaudit6.json'))
        ? '_curriculum_audit_merged.before_reaudit6.json'
        : fs.existsSync(path.join(__dirname, '_curriculum_audit_merged.before_reaudit5.json'))
          ? '_curriculum_audit_merged.before_reaudit5.json'
          : fs.existsSync(path.join(__dirname, '_curriculum_audit_merged.before_reaudit4.json'))
            ? '_curriculum_audit_merged.before_reaudit4.json'
            : fs.existsSync(path.join(__dirname, '_curriculum_audit_merged.before_reaudit3.json'))
              ? '_curriculum_audit_merged.before_reaudit3.json'
              : fs.existsSync(path.join(__dirname, '_curriculum_audit_merged.before_reaudit2.json'))
                ? '_curriculum_audit_merged.before_reaudit2.json'
                : '_curriculum_audit_merged.before.json';
const before = load(beforeName);
const originalBefore = fs.existsSync(path.join(__dirname, '_curriculum_audit_merged.before.json'))
  ? load('_curriculum_audit_merged.before.json')
  : before;
console.log('delta vs', beforeName);

const all = [];
for (const f of files) {
  const arr = asArray(load(f));
  console.log(f, arr.length);
  all.push(...arr);
}

if (all.length !== 195) {
  console.warn('Expected 195 lessons, got', all.length);
}

const pureMcIds = new Set(inv.pureMcIds || []);
const lessons = all.map((l) => {
  const sum = sumScores(l);
  const problems = l.problems || [];
  const critical =
    (l.coherence || 0) <= 2 ||
    (l.usefulness || 0) <= 2 ||
    problems.some((p) => /wrong|invert|hijack|неверн|чужое|подмен|Кто\? Что/i.test(p.issue || ''));
  return {
    ...l,
    sum,
    pureMc: pureMcIds.has(l.id),
    c: l.coherence,
    u: l.usefulness,
    e: l.engagement,
    d: l.diversity,
  };
});

const averages = {
  coherence: avg(lessons, 'coherence'),
  usefulness: avg(lessons, 'usefulness'),
  engagement: avg(lessons, 'engagement'),
  diversity: avg(lessons, 'diversity'),
};

const criticalCount = lessons.filter(
  (l) => l.coherence <= 2 || l.usefulness <= 2 || (l.problems || []).some((p) => /wrong|invert|hijack|неверн|подмен/i.test(p.issue || '')),
).length;

const enkyIssueCount = lessons.filter((l) => (l.enkyFlags || []).length > 0).length;
const coherenceBelow4 = lessons.filter((l) => l.coherence < 4).length;

const weakest15 = [...lessons]
  .sort((a, b) => a.sum - b.sum || a.coherence - b.coherence)
  .slice(0, 15)
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
  }));

// Delta vs before
const beforeMap = {};
if (Array.isArray(before.lessons)) {
  for (const l of before.lessons) beforeMap[l.id] = l;
} else if (before.lessonsById) {
  Object.assign(beforeMap, before.lessonsById);
}

// Try load full before lessons from canvas data if merged.before lacks full list
if (Object.keys(beforeMap).length < 100 && fs.existsSync(path.join(__dirname, '_curriculum_audit_canvas_data.json'))) {
  try {
    const oldCanvas = load('_curriculum_audit_canvas_data.json');
    for (const l of oldCanvas.lessons || []) beforeMap[l.id] = l;
  } catch {
    /* ignore */
  }
}

const improved = [];
const worsened = [];
const stillWeak = [];
for (const l of lessons) {
  const b = beforeMap[l.id];
  if (!b) continue;
  const bSum = (b.coherence || b.c || 0) + (b.usefulness || b.u || 0) + (b.engagement || b.e || 0) + (b.diversity || b.d || 0);
  const delta = l.sum - bSum;
  if (delta >= 2) improved.push({ id: l.id, title: l.title, beforeSum: bSum, afterSum: l.sum, delta });
  if (delta <= -2) worsened.push({ id: l.id, title: l.title, beforeSum: bSum, afterSum: l.sum, delta });
  if (l.coherence < 4) stillWeak.push({ id: l.id, title: l.title, coherence: l.coherence, sum: l.sum });
}

improved.sort((a, b) => b.delta - a.delta);

const systemic = [];
// Real hijack residue: opt_two used as non-number, or "Кто? Что?" as wrong counting answer — not legitimate grammar subjects.
const sharedKeysHit = lessons.filter((l) =>
  (l.problems || []).some((p) =>
    /opt_two\s*=|hijack|отравле|poison|вместо\s*\d|вместо числа|верный ответ.*(Кто\? Что\?)|(Кто\? Что\?).*(вместо|убивает|счёт|котят|сколько)/i.test(
      `${p.ref || ''} ${p.issue || ''}`,
    ),
  ),
);
systemic.push({
  id: 'shared_option_keys',
  title: sharedKeysHit.length
    ? 'Общие ключи опций — остаточные хиты'
    : 'Общие ключи опций',
  detail: sharedKeysHit.length
    ? `Подозрительные hits: ${sharedKeysHit.map((l) => l.id).slice(0, 8).join(', ')}`
    : 'Массовый блокер opt_two/opt_yes/opt_no закрыт (Фазы 1–2). Упоминания «Кто? Что?» в грамматике подлежащего — легитимны.',
  status: sharedKeysHit.length ? 'open' : 'resolved',
  evidence: sharedKeysHit.map((l) => l.id).slice(0, 8),
});
systemic.push({
  id: 'pure_mc',
  title: 'Pure-MC уроки',
  detail:
    inv.pureMcCount === 0
      ? 'pureMcCount=0 после Phase 5 (было 118).'
      : `pureMcCount=${inv.pureMcCount}`,
  status: inv.pureMcCount === 0 ? 'resolved' : 'open',
  evidence: [],
});
systemic.push({
  id: 'coherence_gap',
  title: 'Уроки со связностью < 4',
  detail: `${coherenceBelow4} из ${lessons.length}`,
  status: coherenceBelow4 === 0 ? 'resolved' : 'open',
  evidence: stillWeak.map((l) => l.id).slice(0, 12),
});
systemic.push({
  id: 'diversity_low',
  title: 'Низкое разнообразие механик',
  detail: `Avg diversity ${averages.diversity} (было ${before.averages?.diversity}). Большинство уроков = MC + 1 input; fill_blank/sorting/routine_chain редки.`,
  status: averages.diversity < 3.5 ? 'open' : 'resolved',
  evidence: [],
});

// templates frequency
const templateCount = {};
const templateLessons = {};
for (const l of lessons) {
  for (const t of l.templates || []) {
    templateCount[t] = (templateCount[t] || 0) + 1;
    if (!templateLessons[t]) templateLessons[t] = [];
    if (templateLessons[t].length < 6) templateLessons[t].push(l.id);
  }
}
const templates = Object.entries(templateCount)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .map(([name, count]) => ({ name, count, lessons: templateLessons[name] || [] }));

const merged = {
  generatedAt: new Date().toISOString(),
  lessonCount: lessons.length,
  missing: [],
  averages,
  pureMcCount: inv.pureMcCount ?? 0,
  enkyIssueCount,
  abaDiffCount: inv.abaDiffLessonCount ?? 0,
  criticalCount,
  coherenceBelow4,
  weakest15,
  systemic,
  templates,
  lessons,
};

const delta = {
  generatedAt: new Date().toISOString(),
  comparedTo: beforeName,
  before: {
    averages: before.averages,
    pureMcCount: before.pureMcCount,
    enkyIssueCount: before.enkyIssueCount,
    criticalCount: before.criticalCount,
  },
  after: {
    averages,
    pureMcCount: merged.pureMcCount,
    enkyIssueCount,
    criticalCount,
    coherenceBelow4,
  },
  vsOriginal: {
    averages: originalBefore.averages,
    pureMcCount: originalBefore.pureMcCount,
    criticalCount: originalBefore.criticalCount,
  },
  improvedCount: improved.length,
  worsenedCount: worsened.length,
  improvedTop30: improved.slice(0, 30),
  worsened,
  stillCoherenceBelow4: stillWeak.sort((a, b) => a.coherence - b.coherence || a.sum - b.sum),
};

fs.writeFileSync(path.join(__dirname, '_curriculum_audit_merged.json'), JSON.stringify(merged, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, '_curriculum_audit_delta.json'), JSON.stringify(delta, null, 2) + '\n');

const canvasData = {
  meta: {
    generatedAt: merged.generatedAt,
    lessonCount: lessons.length,
    averages,
    pureMcCount: merged.pureMcCount,
    enkyIssueCount,
    abaDiffCount: merged.abaDiffCount,
    criticalCount,
    coherenceBelow4,
    scope: 'Re-audit #6 after meadow-sh-l2 spot fix (pre-wave3 baseline). Standard RU full; ABA where overrides differ; EN/KY flags',
    before: delta.before,
    vsOriginal: delta.vsOriginal,
  },
  top5: weakest15.slice(0, 5).map((w) => {
    const full = lessons.find((l) => l.id === w.id);
    return {
      ...w,
      problems: (full?.problems || []).slice(0, 3),
      fixes: (full?.fixes || []).slice(0, 3),
    };
  }),
  templates,
  systemic,
  delta: {
    improvedCount: improved.length,
    worsenedCount: worsened.length,
    improvedTop10: improved.slice(0, 10),
  },
  lessons: lessons.map((l) => ({
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
    problems: l.problems || [],
    fixes: l.fixes || [],
    enky: l.enkyFlags || [],
    aba: false,
    pureMc: !!l.pureMc,
  })),
};

fs.writeFileSync(path.join(__dirname, '_curriculum_audit_canvas_data.json'), JSON.stringify(canvasData) + '\n');

console.log(JSON.stringify({ averages, lessonCount: lessons.length, criticalCount, coherenceBelow4, pureMc: merged.pureMcCount, improved: improved.length }, null, 2));
