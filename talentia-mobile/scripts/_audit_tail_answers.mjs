/**
 * Tail-audit helpers: grammar ✓ swaps, EN stubs, short lessons, coherence gaps, MC+input-only.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/en.json'), 'utf8'));
const worlds = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const inv = JSON.parse(fs.readFileSync(path.join(__dirname, '_curriculum_audit_inventory.json'), 'utf8'));
const merged = JSON.parse(fs.readFileSync(path.join(__dirname, '_curriculum_audit_merged.json'), 'utf8'));
const before = JSON.parse(fs.readFileSync(path.join(__dirname, '_curriculum_audit_merged.before.json'), 'utf8'));
const phase34 = JSON.parse(fs.readFileSync(path.join(__dirname, '_audit_phase34_coherence.json'), 'utf8'));
const g1w = JSON.parse(fs.readFileSync(path.join(__dirname, '_audit_g1world_coherence.json'), 'utf8'));

function t(doc, key) {
  const parts = key.split('.');
  let cur = doc;
  for (const p of parts) cur = cur?.[p];
  return typeof cur === 'string' ? cur : '';
}

// --- 1) Grammar answer-key scan for g2r-sp / g2r-sent ---
const grammarIds = [
  'g2r-sp-l1', 'g2r-sp-l2', 'g2r-sp-l3',
  'g2r-sent-l1', 'g2r-sent-l2', 'g2r-sent-l3',
];
const grammarReport = [];
for (const id of grammarIds) {
  const m = worlds.match(new RegExp(`\\{\\s*id:\\s*'${id}'[\\s\\S]*?tasks:\\s*\\[([\\s\\S]*?)\\]\\s*,?\\s*\\}`));
  if (!m) {
    grammarReport.push({ id, error: 'not found' });
    continue;
  }
  const body = m[1];
  const tasks = [];
  for (const tm of body.matchAll(
    /\{\s*id:\s*'([^']+)',\s*type:\s*'([^']+)',\s*questionKey:\s*'([^']+)'([\s\S]*?)\}(?=\s*,?\s*(?:\{|\]))/g,
  )) {
    const opts = [];
    for (const om of tm[4].matchAll(/textKey:\s*'([^']+)',\s*correct:\s*(true|false)/g)) {
      opts.push({ textKey: om[1], text: t(ru, om[1]), correct: om[2] === 'true' });
    }
    const ans = tm[4].match(/answer:\s*"([^"]*)"/)?.[1];
    const q = t(ru, tm[3]);
    const correct = opts.filter((o) => o.correct);
    // Heuristic: "на что отвечает" / вопрос к части речи
    let suspect = null;
    if (/отвечает на вопрос|вопрос к|какой вопрос/i.test(q)) {
      const c = correct[0]?.text || '';
      if (/существитель|подлежащ|имя существитель/i.test(q) && /Какой|Что делает/i.test(c)) {
        suspect = `noun/subject Q but ✓=${c}`;
      }
      if (/глагол|сказуем/i.test(q) && /Кто\? Что\?|Какой/i.test(c) && !/Что делает/i.test(c)) {
        suspect = `verb/predicate Q but ✓=${c}`;
      }
      if (/прилагатель/i.test(q) && /Кто\? Что\?|Что делает/i.test(c)) {
        suspect = `adj Q but ✓=${c}`;
      }
      if (/подлежащ/i.test(q) && /Какой/i.test(c)) {
        suspect = `subject Q but ✓=${c}`;
      }
    }
    tasks.push({
      id: tm[1],
      type: tm[2],
      q,
      correct: correct.map((o) => o.text),
      answer: ans,
      suspect,
    });
  }
  grammarReport.push({ id, tasks });
}

// Also scan ALL g2r/g3r MC for "отвечает на вопрос" mismatches in worlds one-liners
const allSuspect = [];
for (const tm of worlds.matchAll(
  /\{\s*id:\s*'([^']+)',\s*type:\s*'multiple_choice',\s*questionKey:\s*'([^']+)',\s*difficulty:\s*\d+,\s*options:\s*\[([\s\S]*?)\]\s*\}/g,
)) {
  const q = t(ru, tm[2]);
  if (!/отвечает на вопрос|вопрос к /i.test(q)) continue;
  const opts = [...tm[3].matchAll(/textKey:\s*'([^']+)',\s*correct:\s*(true|false)/g)].map((om) => ({
    text: t(ru, om[1]),
    correct: om[2] === 'true',
  }));
  const c = opts.find((o) => o.correct)?.text || '';
  let issue = null;
  if (/существитель|подлежащ/i.test(q) && /^(Какой|Что делает)/i.test(c)) issue = 'expected Кто? Что?';
  if (/глагол|сказуем/i.test(q) && /^(Кто\? Что\?|Какой)/i.test(c)) issue = 'expected Что делает?';
  if (/прилагатель/i.test(q) && /^(Кто\? Что\?|Что делает)/i.test(c)) issue = 'expected Какой?';
  if (issue) allSuspect.push({ taskId: tm[1], q, correct: c, issue });
}

// --- 2) EN stubs ---
const enFlat = {};
function flat(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flat(v, key, out);
    else if (typeof v === 'string') out[key] = v;
  }
  return out;
}
flat(en, '', enFlat);
const stubKeys = Object.keys(enFlat).filter((k) => /We'll recap what matters/i.test(enFlat[k]));
const stubG4m = stubKeys.filter((k) => k.includes('.g4m_'));
const stubByPrefix = {};
for (const k of stubKeys) {
  const m = k.match(/data\.intro\.(g4[a-z]+)_/);
  const p = m ? m[1] : 'other';
  stubByPrefix[p] = (stubByPrefix[p] || 0) + 1;
}

// --- 3) Short lessons ---
const lessons = inv.lessons || [];
const short = lessons
  .map((l) => ({
    id: l.id,
    grade: l.grade,
    world: l.world,
    taskCount: (l.taskCount ?? l.tasks?.length ?? l.types?.length ?? null),
    types: l.types || l.typeSet || [],
  }))
  .filter((l) => l.taskCount != null && l.taskCount < 4)
  .sort((a, b) => a.taskCount - b.taskCount || a.id.localeCompare(b.id));

// inventory may use different shape
const invSample = lessons[0] ? Object.keys(lessons[0]) : [];

// --- 4) coherence < 4 vs phase 3-4 ---
const rewrittenIds = new Set([
  ...(phase34.lessons || []).map((l) => l.lessonId),
  ...(g1w.lessons || []).map((l) => l.lessonId),
  // phase 3-4 explicit from plan
  'g2e-phr-l1', 'g2e-days-l1',
  'g3r-gen-l1', 'g3r-gen-l2', 'g3r-gen-l3',
  'g3r-adj-l1', 'g3r-adj-l2', 'g3r-adj-l3',
  'g3r-verb-l1', 'g3r-verb-l2', 'g3r-verb-l3',
  'g3e-tobe-l1', 'g3e-tobe-l2', 'g3e-tobe-l3',
  'g2r-sh-l1', 'g2r-sh-l2', 'g2r-sh-l3',
  'g2r-sp-l1', 'g2r-sp-l2', 'g2r-sp-l3',
  'g2r-sent-l1', 'g2r-sent-l3',
  'g2s-plt-l2', 'g2s-ani-l1', 'g2s-ani-l2', 'g2s-ani-l3', 'g2s-bdy-l1', 'g2s-bdy-l3',
  'g1w-sch-l3', 'g1w-nat-l1', 'g1w-nat-l2', 'g1w-nat-l3',
  'g1w-bdy-l1', 'g1w-bdy-l2', 'g1w-bdy-l3',
  'g3m-1000-l3', 'g2e-days-l2', 'g2e-sch-l3',
  'g1e-grt-l2', 'g1e-grt-l3', 'g1m-add-l1', 'g1e-abc-l1', 'g1e-abc-l2',
]);

const beforeById = Object.fromEntries((before.lessons || []).map((l) => [l.id, l]));
const weak = (merged.lessons || []).filter((l) => l.coherence < 4);
const weakTouched = [];
const weakUntouched = [];
for (const l of weak) {
  const b = beforeById[l.id];
  const row = {
    id: l.id,
    title: l.title,
    grade: l.grade,
    cNow: l.coherence,
    cBefore: b?.coherence,
    sumNow: l.sum,
    sumBefore: b ? b.coherence + b.usefulness + b.engagement + b.diversity : null,
    inPhase34: rewrittenIds.has(l.id),
    verdict: l.verdict,
    topProblem: l.problems?.[0]?.issue || '',
  };
  if (row.inPhase34) weakTouched.push(row);
  else weakUntouched.push(row);
}

// --- 5) MC + input only (exactly those two types among non-ABA tasks) ---
// Use inventory type lists if available
const mcInputOnly = [];
for (const l of lessons) {
  const types = l.types || [];
  const set = new Set(types.filter((t0) => t0 !== 'multiple_choice' || true));
  // prefer unique types
  const uniq = [...new Set(types)];
  const nonMc = uniq.filter((x) => x !== 'multiple_choice');
  const onlyInputExtra = nonMc.length === 1 && nonMc[0] === 'input';
  const hasMc = uniq.includes('multiple_choice');
  if (hasMc && onlyInputExtra) {
    mcInputOnly.push({ id: l.id, grade: l.grade, world: l.world, types: uniq, taskCount: l.taskCount });
  }
}

const out = {
  grammarReport,
  allSuspectAnswerSwaps: allSuspect,
  enStubs: { total: stubKeys.length, byPrefix: stubByPrefix, g4mCount: stubG4m.length, keys: stubKeys },
  invLessonKeys: invSample,
  shortLessonsRaw: short.slice(0, 40),
  shortCount: short.length,
  coherenceBelow4: {
    total: weak.length,
    inPhase34: weakTouched.length,
    notInPhase34: weakUntouched.length,
    untouched: weakUntouched,
    touched: weakTouched,
  },
  mcInputOnly: { count: mcInputOnly.length, lessons: mcInputOnly },
};

fs.writeFileSync(path.join(__dirname, '_audit_tail_answers.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({
  grammarSuspects: allSuspect.length,
  enStubs: stubKeys.length,
  enStubsG4m: stubG4m.length,
  shortCount: short.length,
  invKeys: invSample,
  cBelow4: weak.length,
  untouched: weakUntouched.length,
  mcInputOnly: mcInputOnly.length,
}, null, 2));
console.log('--- grammar tasks ---');
for (const g of grammarReport) {
  console.log(g.id);
  for (const tk of g.tasks || []) {
    console.log(' ', tk.id, '|', tk.q.slice(0, 70), '→', tk.correct.join('/') || tk.answer, tk.suspect ? '!! ' + tk.suspect : '');
  }
}
console.log('--- untouched c<4 ---');
weakUntouched.forEach((l) => console.log(l.id, 'c', l.cNow, 'was', l.cBefore, '|', l.topProblem.slice(0, 80)));
