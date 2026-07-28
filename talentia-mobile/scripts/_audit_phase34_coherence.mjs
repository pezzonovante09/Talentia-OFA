/**
 * Phase 3–4 coherence re-audit: extract lesson content + heuristic flags.
 * Output: scripts/_audit_phase34_extract.json (for human scoring)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const PHASE3 = [
  'g2e-phr-l1', 'g2e-days-l1',
  'g3r-gen-l1', 'g3r-gen-l2', 'g3r-gen-l3',
  'g3r-adj-l1', 'g3r-adj-l2', 'g3r-adj-l3',
  'g3r-verb-l1', 'g3r-verb-l2', 'g3r-verb-l3',
  'g3e-tobe-l1', 'g3e-tobe-l2', 'g3e-tobe-l3',
  'g2r-sh-l1', 'g2r-sh-l2', 'g2r-sh-l3',
  'g2r-sp-l1', 'g2r-sp-l2', 'g2r-sp-l3',
  'g2r-sent-l1', 'g2r-sent-l3',
  'g2s-plt-l2',
  'g2s-ani-l1', 'g2s-ani-l2', 'g2s-ani-l3',
  'g2s-bdy-l1', 'g2s-bdy-l3',
];

const PHASE4 = [
  'g1w-sch-l3', 'g1w-nat-l1', 'g1w-nat-l2', 'g1w-nat-l3',
  'g1w-bdy-l1', 'g1w-bdy-l2', 'g1w-bdy-l3',
  'g3m-1000-l3', 'g2e-days-l2', 'g2e-sch-l3',
  'g1e-grt-l2', 'g1e-grt-l3', 'g1m-add-l1', 'g1e-abc-l1', 'g1e-abc-l2',
];

const G4_SAMPLE = [
  'g4m-md-l1', 'g4m-cm-l2', 'g4r-conj-l1', 'g4e-pres-l1', 'g4e-past-l2',
];

const ALL = [...PHASE3, ...PHASE4, ...G4_SAMPLE];

const worldsSrc = fs.readFileSync(path.join(root, 'src/data/worlds.ts'), 'utf8');
const g1TasksSrc = fs.readFileSync(path.join(root, 'src/data/g1worldRewrittenTasks.ts'), 'utf8');
const rw56Src = fs.readFileSync(path.join(root, 'src/data/rw56LessonTasks.ts'), 'utf8');
const ru = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales/ru.json'), 'utf8'));

function t(key) {
  if (!key) return '';
  const parts = key.split('.');
  let cur = ru;
  for (const p of parts) {
    cur = cur?.[p];
    if (cur === undefined) return `<MISSING:${key}>`;
  }
  return typeof cur === 'string' ? cur : JSON.stringify(cur);
}

/** Parse exported const FOO_TASKS: LessonTask[] = [...]; blocks */
function parseTaskExports(src) {
  const map = {};
  const re = /export const (\w+):\s*LessonTask\[\]\s*=\s*\[/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    let depth = 1;
    let i = re.lastIndex;
    while (i < src.length && depth > 0) {
      if (src[i] === '[') depth++;
      else if (src[i] === ']') depth--;
      i++;
    }
    map[name] = src.slice(re.lastIndex, i - 1);
  }
  return map;
}

const taskExports = {
  ...parseTaskExports(g1TasksSrc),
  ...parseTaskExports(worldsSrc),
};

/** Parse RW56_LESSON_TASKS['key'] entries */
function parseRw56(src) {
  const map = {};
  const re = /'([^']+)':\s*\[/g;
  const start = src.indexOf('export const RW56_LESSON_TASKS');
  const chunk = start >= 0 ? src.slice(start) : src;
  // simpler: match lesson keys in rw56
  for (const m of chunk.matchAll(/'([a-z0-9-]+)':\s*\[([\s\S]*?)\n\s*\],?\n/g)) {
    map[m[1]] = m[2];
  }
  return map;
}

const rw56Tasks = parseRw56(rw56Src);

function parseInlineTasks(block) {
  const tasksMatch = block.match(/tasks:\s*\[([\s\S]*?)\]\s*,?\s*\}/);
  if (tasksMatch) return tasksMatch[1];
  const refMatch = block.match(/tasks:\s*(\w+)(?:\s+as\s+LessonTask\[\])?,/);
  if (refMatch) {
    const name = refMatch[1];
    if (taskExports[name]) return taskExports[name];
  }
  const rwMatch = block.match(/tasks:\s*RW56_LESSON_TASKS\['([^']+)'\]/);
  if (rwMatch && rw56Tasks[rwMatch[1]]) return rw56Tasks[rwMatch[1]];
  return '';
}

function parseTaskObjects(taskBlock) {
  const tasks = [];
  // multi-line task objects
  const re = /\{\s*id:\s*'([^']+)',\s*type:\s*'([^']+)'([\s\S]*?)\}(?=\s*,?\s*(?:\{|\]|$))/g;
  let m;
  while ((m = re.exec(taskBlock))) {
    const [, id, type, rest] = m;
    const qm = rest.match(/questionKey:\s*'([^']+)'/);
    const aud = /audience:\s*'special_aba'/.test(rest);
    const answer = rest.match(/answer:\s*"([^"]+)"/)?.[1]
      ?? rest.match(/answer:\s*'([^']+)'/)?.[1];
    const options = [];
    for (const om of rest.matchAll(/\{\s*id:\s*'(\w+)',\s*textKey:\s*'([^']+)',\s*correct:\s*(true|false)/g)) {
      options.push({ id: om[1], textKey: om[2], text: t(om[2]), correct: om[3] === 'true' });
    }
    tasks.push({
      id,
      type,
      audience: aud ? 'special_aba' : undefined,
      question: qm ? t(qm[1]) : '',
      questionKey: qm?.[1],
      options,
      answer,
    });
  }
  return tasks;
}

function extractLesson(id) {
  const re = new RegExp(`\\{\\s*id:\\s*'${id}',\\s*topicId:[\\s\\S]*?\\}\\s*,?\\s*(?=\\{\\s*id:|\\]\\s*\\})`);
  const m = worldsSrc.match(re);
  if (!m) return null;
  const block = m[0];

  const titleKey = block.match(/titleKey:\s*'([^']+)'/)?.[1];
  const dialog = [...block.matchAll(/\{\s*speaker:\s*'(\w+)',\s*textKey:\s*'([^']+)'\s*\}/g)].map((x) => ({
    speaker: x[1],
    textKey: x[2],
    text: t(x[2]),
  }));
  const intro = [...block.matchAll(/\{\s*titleKey:\s*'([^']+)',\s*bodyKey:\s*'([^']+)'/g)].map((x) => ({
    titleKey: x[1],
    bodyKey: x[2],
    title: t(x[1]),
    body: t(x[2]),
  }));

  const taskBlock = parseInlineTasks(block);
  const tasks = parseTaskObjects(taskBlock);

  return {
    id,
    titleKey,
    title: titleKey ? t(titleKey) : id,
    dialog,
    intro,
    tasks,
  };
}

function heuristicFlags(lesson) {
  const flags = [];
  const allText = [
    ...lesson.dialog.map((d) => d.text),
    ...lesson.intro.map((i) => `${i.title} ${i.body}`),
    ...lesson.tasks.flatMap((tk) => [tk.question, ...tk.options.map((o) => o.text), tk.answer].filter(Boolean)),
  ].join(' ');

  for (const tk of lesson.tasks) {
    if (tk.question.includes('<MISSING:')) flags.push(`${tk.id}: missing question key`);
    for (const o of tk.options) {
      if (o.text.includes('<MISSING:')) flags.push(`${tk.id} opt ${o.id}: missing option key`);
    }
    const correct = tk.options.filter((o) => o.correct);
    if (tk.type === 'multiple_choice' && correct.length !== 1) {
      flags.push(`${tk.id}: ${correct.length} correct options (expected 1)`);
    }
  }

  // Detect hijacked generic keys in options (am/is/are in non-grammar lessons)
  if (!lesson.id.includes('tobe') && !lesson.id.includes('grt')) {
    for (const tk of lesson.tasks) {
      for (const o of tk.options) {
        if (/^(am|is|are)$/i.test(o.text.trim()) && lesson.id.startsWith('g2e-phr')) {
          flags.push(`${tk.id}: option pool shows am/is/are instead of phrase translations`);
        }
      }
    }
  }

  // Speaker role: Tali framed as confused student in tasks but mentor in dialog
  for (const d of lesson.dialog) {
    if (d.speaker === 'tali' && /помоги мне|я путаюсь|не уверен/i.test(d.text)) {
      // expected for student Tali
    }
    if (d.speaker === 'npc' && /Тали, ты снова прав|Помоги ему|он явно запутался/i.test(d.text)) {
      flags.push(`dialog: NPC mentors/confused-about-Tali framing (check speaker_role_swap)`);
    }
  }

  return [...new Set(flags)];
}

const extracted = ALL.map((id) => {
  const lesson = extractLesson(id);
  if (!lesson) return { id, error: 'not found' };
  return { ...lesson, flags: heuristicFlags(lesson), allTextPreview: [
    ...lesson.dialog.map((d) => `[${d.speaker}] ${d.text}`),
    ...lesson.intro.map((i) => `[intro] ${i.title} — ${i.body}`),
    ...lesson.tasks.map((tk) => `[task ${tk.id}] ${tk.question} → ${tk.options.filter(o=>o.correct).map(o=>o.text).join('|') || tk.answer}`),
  ] };
});

fs.writeFileSync(
  path.join(__dirname, '_audit_phase34_extract.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), lessons: extracted }, null, 2),
);
console.log(`Extracted ${extracted.length} lessons → _audit_phase34_extract.json`);
for (const l of extracted) {
  if (l.flags?.length) console.log(`${l.id}: ${l.flags.join('; ')}`);
}
