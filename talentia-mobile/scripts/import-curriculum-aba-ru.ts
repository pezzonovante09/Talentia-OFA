/**
 * Импорт ABA-редакции программы 0–4 класс из curricula/grade-*-curriculum-ru-aba.md
 * в src/i18n/locales/abaTextOverrides.generated.json (не трогает ru.json / стандартный режим).
 *
 *   cd talentia-mobile && npx tsx scripts/import-curriculum-aba-ru.ts
 *   npx tsx scripts/import-curriculum-aba-ru.ts --dry-run
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import type { Lesson, LessonTask, MultipleChoiceTask } from '../src/data/worlds';
import { worlds } from '../src/data/worlds';
import { RW56_LESSON_TASKS } from '../src/data/rw56LessonTasks';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

type ParsedOption = { id: string; text: string; correct: boolean };
type ParsedTask = {
  index: number;
  mdType: string;
  audience?: string;
  question: string;
  options: ParsedOption[];
};
type ParsedLesson = {
  lessonId: string;
  dialog: { speaker: string; text: string }[];
  intro: { emoji: string; title: string; body: string }[];
  tasks: ParsedTask[];
};

function stripMdBold(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
}

function stripMdQuotes(s: string): string {
  return s
    .replace(/^\*+/, '')
    .replace(/\*+$/, '')
    .replace(/^«|»$/g, '')
    .replace(/^"|"$/g, '')
    .trim();
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

function isLessonHeaderAt(lines: string[], i: number): { lessonId: string; bodyStart: number } | null {
  const line = lines[i]?.replace(/\r$/, '') ?? '';
  const g4 = /^#### Урок:.+\(`([a-zA-Z0-9-]+)`\)\s*$/.exec(line);
  if (g4) return { lessonId: g4[1], bodyStart: i + 1 };

  const same = /^##### Урок:[^\n`]+`([a-zA-Z0-9-]+)`\s*$/.exec(line);
  if (same) return { lessonId: same[1], bodyStart: i + 1 };

  if (/^##### Урок:\s*.+$/.test(line)) {
    let j = i + 1;
    while (j < lines.length && !lines[j]?.replace(/\r$/, '').trim()) j += 1;
    const tick = /^`([a-zA-Z0-9-]+)`\s*$/.exec(lines[j]?.replace(/\r$/, '') ?? '');
    if (tick) return { lessonId: tick[1], bodyStart: j + 1 };
  }
  return null;
}

function splitLessonChunks(md: string): { lessonId: string; body: string }[] {
  const lines = md.split(/\r?\n/);
  const chunks: { lessonId: string; body: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    const h = isLessonHeaderAt(lines, i);
    if (!h) {
      i += 1;
      continue;
    }
    const { lessonId, bodyStart } = h;
    let j = bodyStart;
    while (j < lines.length) {
      if (isLessonHeaderAt(lines, j)) break;
      j += 1;
    }
    const body = lines.slice(bodyStart, j).map((l) => l.replace(/\r$/, '')).join('\n');
    chunks.push({ lessonId, body });
    i = j;
  }
  return chunks;
}

function parseDialogSection(text: string): { speaker: string; text: string }[] {
  const idx = text.indexOf('**Диалог:**');
  if (idx === -1) return [];
  const rest = text.slice(idx + '**Диалог:**'.length);
  const lines = rest.split(/\r?\n/);
  const out: { speaker: string; text: string }[] = [];
  const lineRe = /^- \*\*(.+?)\*\*\s*(.+)$/;
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('**Интро') || t.startsWith('**Задания:**')) break;
    const m = lineRe.exec(line.trim());
    if (m) out.push({ speaker: m[1].trim(), text: stripMdBold(m[2].trim()) });
  }
  return out;
}

function parseIntroSection(text: string): { emoji: string; title: string; body: string }[] {
  const markers = ['**Интро (объяснения перед заданиями):**', '**Интро:**'];
  let idx = -1;
  let markerLen = 0;
  for (const m of markers) {
    const j = text.indexOf(m);
    if (j !== -1) {
      idx = j;
      markerLen = m.length;
      break;
    }
  }
  if (idx === -1) return [];
  const rest = text.slice(idx + markerLen);
  const endIdx = rest.indexOf('**Задания:**');
  const block = endIdx === -1 ? rest : rest.slice(0, endIdx);
  const lines = block.split(/\r?\n/);
  const out: { emoji: string; title: string; body: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i += 1;
      continue;
    }
    const startMatch = /^(\d+)\.\s*(.*)$/.exec(line);
    if (!startMatch) {
      i += 1;
      continue;
    }
    const restLine = startMatch[2];
    const titleMatch = /\*\*([^*]+)\*\*/.exec(restLine);
    if (!titleMatch) {
      i += 1;
      continue;
    }
    const beforeTitle = restLine.slice(0, titleMatch.index ?? 0).trim();
    const emoji = beforeTitle && !beforeTitle.includes('**') && beforeTitle.length <= 8 ? beforeTitle : '';
    const title = stripMdBold(titleMatch[1].trim());
    const afterTitle = restLine.slice((titleMatch.index ?? 0) + titleMatch[0].length).trim();
    let body: string;
    if (afterTitle.startsWith('—')) {
      body = stripMdBold(afterTitle.slice(1).trim());
      i += 1;
    } else {
      const bodyLines: string[] = [];
      if (afterTitle) bodyLines.push(stripMdBold(afterTitle));
      i += 1;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (!next) {
          i += 1;
          continue;
        }
        if (/^\d+\.\s/.test(next)) break;
        if (next.startsWith('**Задания')) break;
        bodyLines.push(stripMdBold(next));
        i += 1;
      }
      body = bodyLines.join('\n\n');
    }
    out.push({ emoji, title, body });
  }
  return out;
}

function normalizeTaskHeadLine(line: string): string {
  return line.trim().replace(/\s*·\s*\*\*\[ABA\]\*\*/g, '');
}

function parseTasksSection(text: string): ParsedTask[] {
  const idx = text.indexOf('**Задания:**');
  if (idx === -1) return [];
  const rest = text.slice(idx + '**Задания:**'.length);
  const lines = rest.split(/\r?\n/);
  const tasks: ParsedTask[] = [];
  const taskHead =
    /^(\d+)\.\s+\*\*([\w_]+)\*\*(?:\s*·\s*_([a-zA-Z0-9_]+)_)?\s*—\s*(.+)$/;
  const optRe = /^\s+-\s+`([a-zA-Z0-9-]+)`:\s*(.+)$/;
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const normalized = normalizeTaskHeadLine(raw);
    const tm = taskHead.exec(normalized);
    if (!tm) {
      i += 1;
      continue;
    }
    const index = Number(tm[1]);
    const mdType = tm[2];
    const audience = /special_aba/.test(raw) ? 'special_aba' : tm[3];
    let question = tm[4].trim();
    const ansRe = /\s*_\([^:]+:\s*([^)]+)\)_\s*$/.exec(question);
    if (ansRe) question = question.slice(0, ansRe.index).trim();
    question = stripMdBold(question);
    i += 1;
    const options: ParsedOption[] = [];
    while (i < lines.length && !lines[i].trim()) i += 1;
    if (i < lines.length && lines[i].includes('Варианты ответа:')) i += 1;
    if (i < lines.length && lines[i].includes('Варианты вставки:')) i += 1;
    if (i < lines.length && lines[i].trim().startsWith('Предложение:')) i += 1;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (taskHead.test(normalizeTaskHeadLine(trimmed))) break;
      const om = optRe.exec(line);
      if (om) {
        const rawOpt = om[2].trim();
        const correct = rawOpt.includes('✓');
        const optText = stripMdBold(
          rawOpt
            .replace(/✓/g, '')
            .replace(/\*\([^)]*\)\*/g, '')
            .trim(),
        );
        options.push({ id: om[1], text: optText, correct });
        i += 1;
        continue;
      }
      if (!trimmed) {
        i += 1;
        continue;
      }
      if (/^\d+\.\s+\*\*/.test(trimmed)) break;
      i += 1;
    }
    tasks.push({ index, mdType, audience, question, options });
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

function applyToOverrides(
  overrides: Record<string, string>,
  lessonId: string,
  parsed: ParsedLesson,
): void {
  const found = getLessonWithTasks(lessonId);
  if (!found) {
    console.warn(`[skip] unknown lesson id: ${lessonId}`);
    return;
  }
  const { lesson, tasks } = found;

  if (lesson.dialog && lesson.dialog.length !== parsed.dialog.length) {
    throw new Error(`${lessonId}: dialog lines MD=${parsed.dialog.length} vs worlds=${lesson.dialog?.length ?? 0}`);
  }
  if (lesson.dialog) {
    for (let d = 0; d < lesson.dialog.length; d++) {
      const text = parsed.dialog[d].text;
      if (!text) throw new Error(`${lessonId}: empty dialog line ${d}`);
      overrides[lesson.dialog[d].textKey] = text;
    }
  }

  if (lesson.intro && parsed.intro.length > 0) {
    if (lesson.intro.length !== parsed.intro.length) {
      throw new Error(`${lessonId}: intro slides MD=${parsed.intro.length} vs worlds=${lesson.intro.length}`);
    }
    for (let s = 0; s < lesson.intro.length; s++) {
      const sl = lesson.intro[s];
      const p = parsed.intro[s];
      if (!p.title.trim()) throw new Error(`${lessonId}: empty intro title ${s}`);
      if (!p.body.trim()) throw new Error(`${lessonId}: empty intro body ${s}`);
      overrides[sl.titleKey] = p.title;
      overrides[sl.bodyKey] = p.body;
    }
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
    const codeAudience = (wt as { audience?: string }).audience;
    if (pt.audience !== codeAudience) {
      if (pt.audience || codeAudience) {
        throw new Error(
          `${lessonId} task ${ti}: audience MD=${pt.audience ?? 'none'} vs code=${codeAudience ?? 'none'}`,
        );
      }
    }
    if (!pt.question.trim()) throw new Error(`${lessonId} task ${ti}: empty question`);
    overrides[wt.questionKey] = pt.question;

    if (wt.type === 'multiple_choice' || wt.type === 'fill_blank') {
      const mct = wt as MultipleChoiceTask;
      if (mct.options.length !== pt.options.length) {
        console.warn(
          `${lessonId} task ${ti}: option count MD=${pt.options.length} vs code=${mct.options.length} — mapping by option id`,
        );
      }
      const mdById = new Map(pt.options.map((o) => [o.id, o]));
      for (let oi = 0; oi < mct.options.length; oi++) {
        const codeOpt = mct.options[oi];
        const mdOpt = mdById.get(codeOpt.id);
        if (!mdOpt) {
          console.warn(`${lessonId} task ${ti}: no MD text for option ${codeOpt.id} — keeping standard text`);
          continue;
        }
        if (!mdOpt.text.trim()) {
          throw new Error(`${lessonId} task ${ti} option ${codeOpt.id}: empty text`);
        }
        overrides[codeOpt.textKey] = mdOpt.text;
      }
    }
  }
}

function isGradeLesson(lessonId: string): boolean {
  if (/^g[1-4]/.test(lessonId)) return true;
  for (const w of worlds) {
    if (w.ageBand === '5-6') {
      for (const t of w.topics) {
        if (t.lessons.some((l) => l.id === lessonId)) return true;
      }
    }
  }
  return false;
}

function main(): void {
  const mdFiles = [
    'grade-0-curriculum-ru-aba.md',
    'grade-1-curriculum-ru-aba.md',
    'grade-2-curriculum-ru-aba.md',
    'grade-3-curriculum-ru-aba.md',
    'grade-4-curriculum-ru-aba.md',
  ];
  const overrides: Record<string, string> = {};
  const allErrors: string[] = [];
  let lessonCount = 0;

  for (const name of mdFiles) {
    const p = path.join(ROOT, 'curricula', name);
    if (!fs.existsSync(p)) {
      console.error(`Missing: ${p}`);
      process.exit(1);
    }
    const md = fs.readFileSync(p, 'utf8');
    const chunks = splitLessonChunks(md);
    console.log(`${name}: ${chunks.length} lessons parsed`);
    for (const { lessonId, body } of chunks) {
      if (!isGradeLesson(lessonId)) continue;
      const parsed = parseLessonBody(lessonId, body);
      if (parsed.tasks.length === 0) {
        console.warn(`[warn] ${lessonId}: no tasks parsed`);
        continue;
      }
      try {
        applyToOverrides(overrides, lessonId, parsed);
        lessonCount += 1;
        console.log(`OK ${lessonId} (${parsed.tasks.length} tasks)`);
      } catch (e) {
        allErrors.push(String((e as Error).message));
        console.error(`FAIL ${lessonId}: ${(e as Error).message}`);
      }
    }
  }

  if (allErrors.length) {
    console.error(`\n--- ${allErrors.length} lesson(s) failed ---`);
    process.exit(1);
  }

  const outPath = path.join(ROOT, 'src', 'i18n', 'locales', 'abaTextOverrides.generated.json');
  const sorted = Object.keys(overrides).sort();
  const sortedOverrides: Record<string, string> = {};
  for (const k of sorted) sortedOverrides[k] = overrides[k];

  console.log(`\nSummary: ${lessonCount} lessons, ${sorted.length} text keys`);

  if (DRY_RUN) {
    console.log('Dry run — file not written.');
    return;
  }

  fs.writeFileSync(outPath, `${JSON.stringify(sortedOverrides, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outPath}`);
}

main();
