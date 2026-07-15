/**
 * Синхронизирует тексты вопросов из curricula/grade-1-curriculum-ru.md … grade-4-curriculum-ru.md
 * в src/i18n/locales/ru.json по порядку заданий в worlds.ts (1–4 классы).
 * Для input-заданий сравнивает «_(ответ: N)_» из MD с answer в worlds.ts и печатает расхождения.
 * После вопросов подмешивает варианты MC из `curricula/g34-mc-options-ru.json`, если файл есть
 * (сгенерировать: `node scripts/build-g34-mc-options-ru.mjs`).
 *
 *   npx tsx scripts/sync-curriculum-md-to-ru.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { worlds } from '../src/data/worlds';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type MdItem = { body: string; inputAnswer?: string; mdType: string };

function parseCurriculumMd(content: string): Map<string, MdItem[]> {
  const map = new Map<string, MdItem[]>();
  const lines = content.split(/\r?\n/);
  let current: MdItem[] | null = null;
  /** Игнорируем строки «1. **…** — …» из интро; задания только после заголовка **Задания:** */
  let inTaskSection = false;

  for (const line of lines) {
    const tick = /^`([a-zA-Z0-9-]+)`\s*$/.exec(line);
    if (tick) {
      current = [];
      inTaskSection = false;
      map.set(tick[1], current);
      continue;
    }
    if (current && line.trim() === '**Задания:**') {
      inTaskSection = true;
      continue;
    }
    const taskRe =
      /^(\d+)\. \*\*([\w_]+)\*\*(?:\s*·\s*_([a-zA-Z0-9_]+)_)?\s*—\s*(.+)$/.exec(line);
    if (taskRe && current && inTaskSection) {
      let body = taskRe[4].trim();
      let inputAnswer: string | undefined;
      // MD: «…? _(ответ: 14)_» (курсив в Markdown; буква «о» в «ответ» — кириллица)
      const ansRe = /\s*_\([^:]+:\s*([^)]+)\)_\s*$/.exec(body);
      if (ansRe) {
        inputAnswer = ansRe[1].trim();
        body = body.slice(0, ansRe.index).trim();
      }
      current.push({ body, inputAnswer, mdType: taskRe[2] });
    }
  }
  return map;
}

function setRuKey(ru: Record<string, unknown>, dotted: string, value: string) {
  const parts = dotted.split('.');
  let cur: unknown = ru;
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

function main() {
  const root = path.join(__dirname, '..');
  const ruPath = path.join(root, 'src', 'i18n', 'locales', 'ru.json');
  const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8')) as Record<string, unknown>;

  const mdPaths = [1, 2, 3, 4].map((g) => path.join(root, 'curricula', `grade-${g}-curriculum-ru.md`));
  const missing = mdPaths.filter((p) => !fs.existsSync(p));
  if (missing.length) {
    console.error('Отсутствуют файлы программы:', missing.join(', '));
    console.error('Сгенерируйте: npm run export:curriculum-grades');
    process.exit(1);
  }
  const mdAll = mdPaths.map((p) => fs.readFileSync(p, 'utf8')).join('\n\n');
  const map = parseCurriculumMd(mdAll);

  let updated = 0;
  const answerMismatches: { lessonId: string; taskId: string; questionKey: string; oldAns: string; newAns: string }[] =
    [];
  const typeMismatches: { lessonId: string; taskId: string; mdType: string; worldType: string }[] = [];

  for (const world of worlds) {
    if (!/^g[1-4]/.test(world.id)) continue;
    for (const topic of world.topics) {
      for (const lesson of topic.lessons) {
        const items = map.get(lesson.id);
        if (!items) {
          console.warn(`[skip] no MD block for lesson ${lesson.id}`);
          continue;
        }
        if (items.length !== lesson.tasks.length) {
          console.warn(
            `[warn] ${lesson.id}: MD tasks=${items.length}, worlds=${lesson.tasks.length}`,
          );
        }
        const n = Math.min(items.length, lesson.tasks.length);
        for (let i = 0; i < n; i++) {
          const task = lesson.tasks[i] as {
            id: string;
            type: string;
            questionKey: string;
            answer?: string;
          };
          const item = items[i];
          if (item.mdType !== task.type) {
            typeMismatches.push({
              lessonId: lesson.id,
              taskId: task.id,
              mdType: item.mdType,
              worldType: task.type,
            });
          }
          setRuKey(ru, task.questionKey, item.body);
          updated += 1;
          if (task.type === 'input' && item.inputAnswer !== undefined && 'answer' in task && task.answer != null) {
            const old = String(task.answer);
            if (old !== item.inputAnswer) {
              answerMismatches.push({
                lessonId: lesson.id,
                taskId: task.id,
                questionKey: task.questionKey,
                oldAns: old,
                newAns: item.inputAnswer,
              });
            }
          }
        }
      }
    }
  }

  const mcPatchPath = path.join(root, 'curricula', 'g34-mc-options-ru.json');
  if (fs.existsSync(mcPatchPath)) {
    const patch = JSON.parse(fs.readFileSync(mcPatchPath, 'utf8')) as Record<string, string>;
    let patched = 0;
    for (const [k, v] of Object.entries(patch)) {
      if (typeof v !== 'string') continue;
      setRuKey(ru, k, v);
      patched += 1;
    }
    console.log(`Merged ${patched} MC option strings from curricula/g34-mc-options-ru.json`);
  }

  fs.writeFileSync(ruPath, `${JSON.stringify(ru, null, 2)}\n`, 'utf8');
  console.log(`Updated ${updated} question strings in ru.json`);

  if (typeMismatches.length) {
    console.log('\nTask type mismatches MD vs worlds.ts (fix worlds.ts structure):');
    for (const t of typeMismatches) {
      console.log(`  ${t.lessonId} ${t.taskId}: MD=${t.mdType} worlds=${t.worldType}`);
    }
  }

  if (answerMismatches.length) {
    console.log('\nInput answer mismatches (update worlds.ts manually or patch below):');
    for (const m of answerMismatches) {
      console.log(`  ${m.taskId} (${m.questionKey}): ${m.oldAns} -> ${m.newAns}`);
    }
  }
}

main();
