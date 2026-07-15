/**
 * Экспорт всех заданий миров 1–4 класса (g1…, g2…, g3…, g4…) в TSV вместе с темами и уроками.
 *
 * Запуск из папки talentia-mobile:
 *   npx tsx scripts/export-tasks-1-4-tsv.ts
 *
 * Результат: tasks-1-4-export.tsv (колонки: класс, мир, тема, урок, задание, тип, ключ вопроса, текст вопроса RU, …)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import type { World } from '../src/data/worlds';
import { worlds } from '../src/data/worlds';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getByKey(doc: Record<string, unknown>, dotted: string): string | undefined {
  const parts = dotted.split('.');
  let cur: unknown = doc;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function escapeTsvCell(s: string): string {
  if (/[\t\n\r"]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function gradeFromWorldId(worldId: string): string {
  const m = worldId.match(/^g([1-4])/);
  return m ? m[1] : '';
}

function isGradeWorld(w: World): boolean {
  return /^g[1-4]/.test(w.id);
}

function main() {
  const root = path.join(__dirname, '..');
  const ruPath = path.join(root, 'src', 'i18n', 'locales', 'ru.json');
  const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8')) as Record<string, unknown>;

  const rows: string[][] = [];
  const header = [
    'grade',
    'worldId',
    'worldTitleRu',
    'topicId',
    'topicTitleRu',
    'subject',
    'lessonId',
    'lessonTitleRu',
    'taskId',
    'taskType',
    'questionKey',
    'questionRu',
    'audience',
    'ageBand',
    'answer',
  ];
  rows.push(header);

  for (const world of worlds) {
    if (!isGradeWorld(world)) continue;
    const grade = gradeFromWorldId(world.id);
    const worldTitle = getByKey(ru, world.titleKey) ?? world.titleKey;

    for (const topic of world.topics) {
      const topicTitle = getByKey(ru, topic.titleKey) ?? topic.titleKey;

      for (const lesson of topic.lessons) {
        const lessonTitle = getByKey(ru, lesson.titleKey) ?? lesson.titleKey;

        for (const task of lesson.tasks) {
          const qk = task.questionKey;
          const questionRu = getByKey(ru, qk) ?? '';
          let answer = '';
          if (task.type === 'input' && 'answer' in task) {
            answer = String((task as { answer: string }).answer);
          }

          rows.push([
            grade,
            world.id,
            worldTitle,
            topic.id,
            topicTitle,
            topic.subject,
            lesson.id,
            lessonTitle,
            task.id,
            task.type,
            qk,
            questionRu,
            task.audience ?? '',
            world.ageBand ?? '',
            answer,
          ]);
        }
      }
    }
  }

  const outPath = path.join(root, 'tasks-1-4-export.tsv');
  const body = rows.map((r) => r.map(escapeTsvCell).join('\t')).join('\n');
  fs.writeFileSync(outPath, body, 'utf8');
  console.log(`Wrote ${rows.length - 1} tasks to ${outPath}`);
}

main();
