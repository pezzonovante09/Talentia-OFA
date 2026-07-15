/**
 * Импорт программы 0–1 класс из curricula/grade-*-curriculum-ru-v2.md
 * в ru.json (диалог, интро, вопросы, варианты, нарративный фидбек)
 * и генерация src/data/taskFeedbackKeys.generated.ts
 *
 *   cd talentia-mobile && npx tsx scripts/import-curriculum-v2-ru.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import type { Lesson, LessonTask, MultipleChoiceTask } from '../src/data/worlds';
import { worlds } from '../src/data/worlds';
import { RW56_LESSON_TASKS } from '../src/data/rw56LessonTasks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SKIP_LESSONS = new Set([
  'g1w-sch-l3',
  'g1w-nat-l1',
  'g1w-nat-l2',
  'g1w-nat-l3',
  'g1w-bdy-l1',
  'g1w-bdy-l2',
  'g1w-bdy-l3',
  'g1e-num-l3',
]);

type ParsedOption = { id: string; text: string; correct: boolean };
type ParsedTask = {
  index: number;
  mdType: string;
  audience?: string;
  question: string;
  options: ParsedOption[];
  correctFb?: string;
  incorrectFb?: string;
};

type ParsedLesson = {
  lessonId: string;
  dialog: { speaker: string; text: string }[];
  intro: { emoji: string; title: string; body: string }[];
  tasks: ParsedTask[];
};

function taskIdToFeedbackSlug(taskId: string): string {
  return taskId.replace(/-/g, '_');
}

function getLessonWithTasks(lessonId: string): { lesson: Lesson; tasks: LessonTask[] } | null {
  for (const w of worlds) {
    for (const t of w.topics) {
      for (const l of t.lessons) {
        if (l.id !== lessonId) continue;
        const rw = (RW56_LESSON_TASKS as Record<string, LessonTask[]>)[lessonId];
        const tasks = rw ?? l.tasks;
        return { lesson: l, tasks };
      }
    }
  }
  return null;
}

function setDeep(root: Record<string, unknown>, dotted: string, value: string): void {
  const parts = dotted.split('.');
  let cur: unknown = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur === null || typeof cur !== 'object') throw new Error(`bad path ${dotted}`);
    const o = cur as Record<string, unknown>;
    if (!(p in o)) o[p] = {};
    cur = o[p];
  }
  const last = parts[parts.length - 1];
  (cur as Record<string, unknown>)[last] = value;
}

function ensureDeepObject(root: Record<string, unknown>, dotted: string): Record<string, unknown> {
  const parts = dotted.split('.');
  let cur: unknown = root;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') throw new Error(`bad path ${dotted}`);
    const o = cur as Record<string, unknown>;
    if (!(p in o)) o[p] = {};
    cur = o[p];
  }
  return cur as Record<string, unknown>;
}

/** Split MD into raw lesson chunks (header line + body until next ##### Урок or EOF) */
function splitLessonChunks(md: string): { lessonId: string; body: string }[] {
  const lines = md.split(/\r?\n/);
  const chunks: { lessonId: string; body: string }[] = [];
  /** Title may use · or similar; capture lesson id in backticks */
  const headRe = /^##### Урок:[^\n`]+`([a-zA-Z0-9-]+)`\s*$/;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].replace(/\r$/, '');
    const m = headRe.exec(line);
    if (!m) {
      i += 1;
      continue;
    }
    const lessonId = m[1];
    const start = i + 1;
    i += 1;
    while (i < lines.length) {
      const li = lines[i].replace(/\r$/, '');
      if (headRe.test(li)) break;
      i += 1;
    }
    const body = lines
      .slice(start, i)
      .map((l) => l.replace(/\r$/, ''))
      .join('\n');
    chunks.push({ lessonId, body });
  }
  return chunks;
}

function parseDialogSection(text: string): { speaker: string; text: string }[] {
  const idx = text.indexOf('**Диалог:**');
  if (idx === -1) return [];
  const rest = text.slice(idx + '**Диалог:**'.length);
  const lines = rest.split(/\r?\n/);
  const out: { speaker: string; text: string }[] = [];
  /** Speaker line: `- **Имя:** текст` (двоеточие внутри жирного) */
  const lineRe = /^- \*\*(.+?)\*\*\s*(.+)$/;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('**Интро') || t.startsWith('**Задания:**')) break;
    const m = lineRe.exec(line.trim());
    if (m) out.push({ speaker: m[1].trim(), text: m[2].trim() });
  }
  return out;
}

function parseIntroSection(text: string): { emoji: string; title: string; body: string }[] {
  const marker = '**Интро (объяснения перед заданиями):**';
  const idx = text.indexOf(marker);
  if (idx === -1) return [];
  const rest = text.slice(idx + marker.length);
  const endIdx = rest.indexOf('**Задания:**');
  const block = endIdx === -1 ? rest : rest.slice(0, endIdx);
  const lines = block.split(/\r?\n/);
  const out: { emoji: string; title: string; body: string }[] = [];
  const itemRe = /^\d+\.\s*(.*?)\s*\*\*(.+)\*\*\s*—\s*(.+)$/;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const m = itemRe.exec(t);
    if (!m) continue;
    const prefix = m[1].trim();
    const title = m[2].trim();
    const body = m[3].trim();
    const emoji =
      prefix && !prefix.includes('**') && prefix.length <= 8 ? prefix : '';
    out.push({ emoji, title, body });
  }
  return out;
}

function parseTasksSection(text: string): ParsedTask[] {
  const idx = text.indexOf('**Задания:**');
  if (idx === -1) return [];
  const rest = text.slice(idx + '**Задания:**'.length);
  const lines = rest.split(/\r?\n/);
  const tasks: ParsedTask[] = [];
  const taskHead =
    /^(\d+)\.\s+\*\*([\w_]+)\*\*(?:\s*·\s*_([a-zA-Z0-9_]+)_)?\s*—\s*(.+)$/;
  /** Option line may continue after ✓ (e.g. `6 ✓ *(оба пути…)*`) */
  const optRe = /^\s+-\s+`([a-z])`:\s*(.+)$/;
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const tm = taskHead.exec(raw.trim());
    if (!tm) {
      i += 1;
      continue;
    }
    const index = Number(tm[1]);
    const mdType = tm[2];
    const audience = tm[3];
    const question = tm[4].trim();
    i += 1;
    const options: ParsedOption[] = [];
    let correctFb: string | undefined;
    let incorrectFb: string | undefined;
    // skip blank
    while (i < lines.length && !lines[i].trim()) i += 1;
    if (i < lines.length && lines[i].includes('Варианты ответа:')) i += 1;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (taskHead.test(trimmed)) break;
      if (trimmed.startsWith('>')) {
        const green = /^>\s*💚\s*(.+)$/.exec(trimmed);
        const red = /^>\s*❤️\s*(.+)$/.exec(trimmed) || /^>\s*❤\s*(.+)$/.exec(trimmed);
        if (green) correctFb = green[1].trim();
        if (red) incorrectFb = red[1].trim();
        i += 1;
        continue;
      }
      const om = optRe.exec(line);
      if (om) {
        const rawOpt = om[2].trim();
        const correct = rawOpt.includes('✓');
        const text = rawOpt
          .replace(/✓/g, '')
          .replace(/\*\([^)]*\)\*/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        options.push({
          id: om[1],
          text,
          correct,
        });
        i += 1;
        continue;
      }
      if (!trimmed) {
        i += 1;
        continue;
      }
      // unknown line inside task (e.g. continuation) — stop task if next is new task
      if (/^\d+\.\s+\*\*/.test(trimmed)) break;
      i += 1;
    }
    tasks.push({
      index,
      mdType,
      audience,
      question,
      options,
      correctFb,
      incorrectFb,
    });
  }
  return tasks;
}

function parseLessonBody(lessonId: string, body: string): ParsedLesson {
  return {
    lessonId,
    dialog: parseDialogSection(body),
    intro: parseIntroSection(body),
    tasks: parseTasksSection(body),
  };
}

function validateAndApply(
  ru: Record<string, unknown>,
  lessonId: string,
  parsed: ParsedLesson,
  feedbackRegistry: Record<string, { correctFeedbackKey: string; incorrectFeedbackKey?: string }>,
): void {
  if (SKIP_LESSONS.has(lessonId)) return;

  const found = getLessonWithTasks(lessonId);
  if (!found) {
    console.warn(`[skip] unknown lesson id in v2: ${lessonId}`);
    return;
  }
  const { lesson, tasks } = found;

  if (lesson.dialog && lesson.dialog.length !== parsed.dialog.length) {
    throw new Error(`${lessonId}: dialog lines MD=${parsed.dialog.length} vs worlds=${lesson.dialog.length}`);
  }
  if (lesson.dialog) {
    for (let d = 0; d < lesson.dialog.length; d++) {
      const line = lesson.dialog[d];
      setDeep(ru, line.textKey, parsed.dialog[d].text);
    }
  }

  if (lesson.intro && parsed.intro.length > 0) {
    if (lesson.intro.length !== parsed.intro.length) {
      throw new Error(`${lessonId}: intro slides MD=${parsed.intro.length} vs worlds=${lesson.intro.length}`);
    }
    for (let s = 0; s < lesson.intro.length; s++) {
      const sl = lesson.intro[s];
      const p = parsed.intro[s];
      setDeep(ru, sl.titleKey, p.title);
      setDeep(ru, sl.bodyKey, p.body);
    }
  } else if (lesson.intro && lesson.intro.length > 0 && parsed.intro.length === 0) {
    console.warn(`[intro] ${lessonId}: v2 has no intro block — keeping existing ru.json intro strings`);
  }

  if (tasks.length !== parsed.tasks.length) {
    throw new Error(`${lessonId}: task count MD=${parsed.tasks.length} vs code=${tasks.length}`);
  }

  for (let ti = 0; ti < tasks.length; ti++) {
    const wt = tasks[ti];
    const pt = parsed.tasks[ti];
    if (pt.mdType !== wt.type) {
      throw new Error(`${lessonId} task ${ti}: type MD=${pt.mdType} vs code=${wt.type}`);
    }
    if (pt.audience !== (wt as { audience?: string }).audience) {
      if (pt.audience || (wt as { audience?: string }).audience) {
        throw new Error(
          `${lessonId} task ${ti}: audience MD=${pt.audience ?? 'none'} vs code=${(wt as { audience?: string }).audience ?? 'none'}`,
        );
      }
    }

    if (wt.type === 'multiple_choice') {
      const mct = wt as MultipleChoiceTask;
      if (mct.options.length !== pt.options.length) {
        throw new Error(
          `${lessonId} task ${ti}: option count MD=${pt.options.length} vs code=${mct.options.length}`,
        );
      }
      const mdCorrect = pt.options.filter((o) => o.correct);
      if (mdCorrect.length !== 1) {
        throw new Error(`${lessonId} task ${ti}: expected exactly one ✓ in MD, got ${mdCorrect.length}`);
      }
      for (let oi = 0; oi < mct.options.length; oi++) {
        if (mct.options[oi].id !== pt.options[oi].id) {
          throw new Error(
            `${lessonId} task ${ti}: option id MD=${pt.options[oi].id} vs code=${mct.options[oi].id}`,
          );
        }
        if (mct.options[oi].correct !== pt.options[oi].correct) {
          console.warn(
            `${lessonId} task ${ti}: correct MD vs worlds for option ${mct.options[oi].id} (MD=${pt.options[oi].correct}, code=${mct.options[oi].correct}) — align worlds.ts with v2`,
          );
        }
        setDeep(ru, mct.options[oi].textKey, pt.options[oi].text);
      }
    }

    setDeep(ru, wt.questionKey, pt.question);

    const slug = taskIdToFeedbackSlug(wt.id);
    const cKey = `data.taskFeedback.byTaskId.${slug}.correct`;
    const iKey = `data.taskFeedback.byTaskId.${slug}.incorrect`;
    if (pt.correctFb) {
      setDeep(ru, cKey, stripMdQuotes(pt.correctFb));
      feedbackRegistry[wt.id] = {
        correctFeedbackKey: cKey,
        ...(pt.incorrectFb ? { incorrectFeedbackKey: iKey } : {}),
      };
      if (pt.incorrectFb) {
        setDeep(ru, iKey, stripMdQuotes(pt.incorrectFb));
      }
    }
  }
}

function stripMdQuotes(s: string): string {
  return s
    .replace(/^\*+/, '')
    .replace(/\*+$/, '')
    .replace(/^«|»$/g, '')
    .replace(/^"|"$/g, '')
    .trim();
}

function writeGeneratedFeedbackTs(
  registry: Record<string, { correctFeedbackKey: string; incorrectFeedbackKey?: string }>,
  outPath: string,
): void {
  const lines: string[] = [];
  lines.push('/** Auto-generated by scripts/import-curriculum-v2-ru.ts — do not edit by hand */');
  lines.push('');
  lines.push('export type TaskFeedbackKeyEntry = {');
  lines.push('  correctFeedbackKey: string;');
  lines.push('  incorrectFeedbackKey?: string;');
  lines.push('};');
  lines.push('');
  lines.push('export const TASK_FEEDBACK_KEYS_BY_TASK_ID: Record<string, TaskFeedbackKeyEntry> = {');
  const ids = Object.keys(registry).sort();
  for (const id of ids) {
    const e = registry[id];
    const inc = e.incorrectFeedbackKey ? `, incorrectFeedbackKey: '${e.incorrectFeedbackKey}'` : '';
    lines.push(`  '${id.replace(/'/g, "\\'")}': { correctFeedbackKey: '${e.correctFeedbackKey}'${inc} },`);
  }
  lines.push('};');
  lines.push('');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
}

function mergeTaskFeedbackFromRu(dest: Record<string, unknown>, srcRu: Record<string, unknown>): void {
  const srcData = srcRu.data as Record<string, unknown> | undefined;
  const tf = srcData?.taskFeedback;
  if (!tf || typeof tf !== 'object') return;
  if (!dest.data || typeof dest.data !== 'object') dest.data = {};
  const dd = dest.data as Record<string, unknown>;
  dd.taskFeedback = JSON.parse(JSON.stringify(tf)) as Record<string, unknown>;
}

function main(): void {
  const ruPath = path.join(ROOT, 'src', 'i18n', 'locales', 'ru.json');
  const enPath = path.join(ROOT, 'src', 'i18n', 'locales', 'en.json');
  const kyPath = path.join(ROOT, 'src', 'i18n', 'locales', 'ky.json');
  const g0 = fs.readFileSync(path.join(ROOT, 'curricula', 'grade-0-curriculum-ru-v2.md'), 'utf8');
  const g1 = fs.readFileSync(path.join(ROOT, 'curricula', 'grade-1-curriculum-ru-v2.md'), 'utf8');

  const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8')) as Record<string, unknown>;
  ensureDeepObject(ru, 'data.taskFeedback');
  const feedbackRegistry: Record<string, { correctFeedbackKey: string; incorrectFeedbackKey?: string }> = {};

  for (const md of [g0, g1]) {
    for (const { lessonId, body } of splitLessonChunks(md)) {
      const parsed = parseLessonBody(lessonId, body);
      if (parsed.tasks.length === 0) {
        console.warn(`[warn] ${lessonId}: no tasks parsed`);
        continue;
      }
      validateAndApply(ru, lessonId, parsed, feedbackRegistry);
      console.log(`OK ${lessonId} (${parsed.tasks.length} tasks)`);
    }
  }

  fs.writeFileSync(ruPath, `${JSON.stringify(ru, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${ruPath}`);

  for (const locPath of [enPath, kyPath]) {
    const loc = JSON.parse(fs.readFileSync(locPath, 'utf8')) as Record<string, unknown>;
    mergeTaskFeedbackFromRu(loc, ru);
    fs.writeFileSync(locPath, `${JSON.stringify(loc, null, 2)}\n`, 'utf8');
    console.log(`Merged taskFeedback into ${locPath}`);
  }

  const genPath = path.join(ROOT, 'src', 'data', 'taskFeedbackKeys.generated.ts');
  writeGeneratedFeedbackTs(feedbackRegistry, genPath);
  console.log(`Wrote ${genPath} (${Object.keys(feedbackRegistry).length} tasks)`);
}

main();
