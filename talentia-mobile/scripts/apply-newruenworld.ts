/**
 * Читает scripts/input/newruenworld.md и:
 * 1) генерирует src/data/rw56LessonTasks.ts
 * 2) добавляет ключи data.tasks.nrw_* в ru.json, en.json, ky.json
 * 3) заменяет массивы tasks в src/data/worlds.ts на RW56_LESSON_TASKS['...']
 */
import * as fs from 'fs';
import * as path from 'path';
import type { LessonTask } from '../src/data/worlds';

const ROOT = path.join(__dirname, '..');
const MD = path.join(__dirname, 'input/newruenworld.md');
const OUT_TS = path.join(ROOT, 'src/data/rw56LessonTasks.ts');
const WORLDS = path.join(ROOT, 'src/data/worlds.ts');

type Parsed = {
  id: string;
  typ: 'multiple_choice' | 'input';
  difficulty: number;
  aba: boolean;
  question: string;
  options: { text: string; correct: boolean }[];
  answer?: string;
};

const LESSON_ORDER = [
  'forest-v-l1',
  'forest-v-l2',
  'forest-v-l3',
  'forest-con-l1',
  'forest-con-l2',
  'forest-con-l3',
  'forest-syl-l1',
  'forest-syl-l2',
  'forest-syl-l3',
  'island-abc-l1',
  'island-abc-l2',
  'island-abc-l3',
  'island-col-l1',
  'island-col-l2',
  'island-col-l3',
  'island-anim-l1',
  'island-anim-l2',
  'island-anim-l3',
  'garden-col-l1',
  'garden-col-l2',
  'garden-col-l3',
  'garden-anim-l1',
  'garden-anim-l2',
  'garden-anim-l3',
  'garden-seas-l1',
  'garden-seas-l2',
  'garden-seas-l3',
] as const;

function keyBase(taskId: string): string {
  return `nrw_${taskId.replace(/-/g, '_')}`;
}

function parseMarkdown(md: string): Map<string, Parsed[]> {
  const map = new Map<string, Parsed[]>();
  const blocks = md.split(/^##### Урок:/gm).slice(1);
  for (const block of blocks) {
    const head = block.match(/^[^\n]+\(`([^`]+)`\)/);
    if (!head) continue;
    const lessonId = head[1];
    const lines = block.split('\n');
    let i = 0;
    while (i < lines.length && !/^\d+\. `/.test(lines[i])) i++;
    const chunks: string[] = [];
    let cur: string[] = [];
    for (; i < lines.length; i++) {
      const line = lines[i];
      if (/^#### |^### |^## /.test(line)) break;
      if (/^\d+\. `/.test(line) && cur.length) {
        chunks.push(cur.join('\n'));
        cur = [line];
      } else {
        cur.push(line);
      }
    }
    if (cur.length) chunks.push(cur.join('\n'));
    const tasks: Parsed[] = [];
    for (const ch of chunks) {
      const p = parseTaskChunk(ch);
      if (p) tasks.push(p);
    }
    map.set(lessonId, tasks);
  }
  return map;
}

function parseTaskChunk(chunk: string): Parsed | null {
  const h = chunk.match(/^(\d+)\. `([^`]+)` · (multiple_choice|input) · сложность (\d+)([^\n]*)/m);
  if (!h) return null;
  const aba = h[5].includes('ABA');
  const qm = chunk.match(/\*\*Вопрос:\*\* (.+)/m);
  const question = (qm?.[1] ?? '').trim();
  const opts: { text: string; correct: boolean }[] = [];
  for (const line of chunk.split('\n')) {
    const m = line.match(/^   - (✓|○) (.+)$/);
    if (m) opts.push({ correct: m[1] === '✓', text: m[2].trim() });
  }
  const am = chunk.match(/\*\*Ответ:\*\* `([^`]+)`/);
  return {
    id: h[2],
    typ: h[3] as Parsed['typ'],
    difficulty: Number(h[4]),
    aba,
    question,
    options: opts,
    answer: am?.[1],
  };
}

function toLessonTask(p: Parsed): LessonTask {
  const kb = keyBase(p.id);
  const qk = `data.tasks.${kb}_q`;
  if (p.typ === 'input') {
    return {
      id: p.id,
      type: 'input',
      questionKey: qk,
      difficulty: p.difficulty,
      answer: (p.answer ?? '').trim(),
      skippable: true,
      ...(p.aba ? { audience: 'special_aba' as const } : {}),
    };
  }
  const letters = ['a', 'b', 'c', 'd'] as const;
  const options = p.options.map((o, i) => ({
    id: letters[i],
    textKey: `data.tasks.${kb}_${letters[i]}`,
    correct: o.correct,
  }));
  return {
    id: p.id,
    type: 'multiple_choice',
    questionKey: qk,
    difficulty: p.difficulty,
    options,
    ...(p.aba ? { audience: 'special_aba' as const } : {}),
  };
}

function buildLocalePatches(parsedByLesson: Map<string, Parsed[]>) {
  const ru: Record<string, string> = {};
  const en: Record<string, string> = {};
  const ky: Record<string, string> = {};
  for (const [, tasks] of parsedByLesson) {
    for (const p of tasks) {
      const kb = keyBase(p.id);
      ru[`${kb}_q`] = p.question;
      en[`${kb}_q`] = p.question;
      ky[`${kb}_q`] = p.question;
      if (p.typ === 'multiple_choice') {
        const letters = ['a', 'b', 'c', 'd'] as const;
        p.options.forEach((o, i) => {
          const k = `${kb}_${letters[i]}`;
          ru[k] = o.text;
          en[k] = o.text;
          ky[k] = o.text;
        });
      }
    }
  }
  return { ru, en, ky };
}

function mergeTasksIntoLocale(filePath: string, patch: Record<string, string>) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const j = JSON.parse(raw) as { data: { tasks: Record<string, string> } };
  Object.assign(j.data.tasks, patch);
  fs.writeFileSync(filePath, JSON.stringify(j, null, 2) + '\n', 'utf-8');
}

function findTasksArraySlice(source: string, lessonId: string): { start: number; end: number } | null {
  const marker = `id: '${lessonId}',`;
  let i = source.indexOf(marker);
  if (i === -1) return null;
  const tasksIdx = source.indexOf('tasks: [', i);
  if (tasksIdx === -1) return null;
  const bracketStart = tasksIdx + 'tasks: ['.length - 1;
  if (source[bracketStart] !== '[') return null;
  let depth = 0;
  let j = bracketStart;
  for (; j < source.length; j++) {
    const c = source[j];
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) {
        let end = j + 1;
        if (source[end] === ',') end++;
        return { start: tasksIdx, end };
      }
    }
  }
  return null;
}

function patchWorldsSource(source: string): string {
  let out = source;
  if (!out.includes('RW56_LESSON_TASKS')) {
    out = `import { RW56_LESSON_TASKS } from './rw56LessonTasks';\n\n` + out;
  }
  for (const lid of LESSON_ORDER) {
    const slice = findTasksArraySlice(out, lid);
    if (!slice) {
      console.warn('skip lesson', lid);
      continue;
    }
    out = `${out.slice(0, slice.start)}tasks: RW56_LESSON_TASKS['${lid}'],${out.slice(slice.end)}`;
  }
  return out;
}

function main() {
  const md = fs.readFileSync(MD, 'utf-8');
  const parsed = parseMarkdown(md);
  const record: Record<string, LessonTask[]> = {} as Record<string, LessonTask[]>;
  for (const lid of LESSON_ORDER) {
    const arr = parsed.get(lid);
    if (!arr || !arr.length) throw new Error(`Missing tasks for ${lid}`);
    record[lid] = arr.map(toLessonTask);
  }

  const entries = LESSON_ORDER.map(
    (lid) => `  '${lid}': ${JSON.stringify(record[lid], null, 2)} as unknown as LessonTask[],`,
  ).join('\n\n');

  const fileTs = `import type { LessonTask } from './worlds';

/** Автогенерация из scripts/input/newruenworld.md (скрипт scripts/apply-newruenworld.ts) */
export const RW56_LESSON_TASKS = {
${entries}
} as const satisfies Record<string, LessonTask[]>;
`;

  fs.writeFileSync(OUT_TS, fileTs, 'utf-8');
  console.log('Wrote', OUT_TS);

  const patches = buildLocalePatches(parsed);
  mergeTasksIntoLocale(path.join(ROOT, 'src/i18n/locales/ru.json'), patches.ru);
  mergeTasksIntoLocale(path.join(ROOT, 'src/i18n/locales/en.json'), patches.en);
  mergeTasksIntoLocale(path.join(ROOT, 'src/i18n/locales/ky.json'), patches.ky);
  console.log('Merged locale nrw_* keys');

  const worldsSrc = fs.readFileSync(WORLDS, 'utf-8');
  fs.writeFileSync(WORLDS, patchWorldsSource(worldsSrc), 'utf-8');
  console.log('Patched worlds.ts');
}

main();
