/**
 * Собирает темы и все задания (5–6) для русского, английского и вкладки «Окружающий мир»
 * и пишет `scripts/generated/topics-and-tasks-5-6-ru-en-world.md`
 */
import * as fs from 'fs';
import * as path from 'path';
import { worlds, type Topic, type World } from '../src/data/worlds';
import { createTaskMarkdownHelpers, loadRuJson } from './lib/tasks-markdown-ru';

const ROOT = path.join(__dirname, '..');
const RU_PATH = path.join(ROOT, 'src/i18n/locales/ru.json');
const OUT_DIR = path.join(ROOT, 'scripts', 'generated');
fs.mkdirSync(OUT_DIR, { recursive: true });
const OUT = path.join(OUT_DIR, 'topics-and-tasks-5-6-ru-en-world.md');

const ru = loadRuJson(RU_PATH);
const md = createTaskMarkdownHelpers(ru);

function collectSection(title: string, predicate: (w: World, t: Topic) => boolean): string {
  const lines: string[] = [`## ${title}`, ''];
  const bandWorlds = worlds.filter((w) => w.ageBand === '5-6');

  for (const world of bandWorlds) {
    const topics = world.topics.filter((t) => predicate(world, t));
    if (!topics.length) continue;

    lines.push(`### Мир: ${md.worldTitle(world)} (\`${world.id}\`)`, '');

    for (const topic of topics) {
      lines.push(`#### Тема: ${md.topicTitle(topic)} (\`${topic.id}\`)`, '');
      for (const lesson of topic.lessons) {
        lines.push(`##### Урок: ${md.lessonTitle(lesson)} (\`${lesson.id}\`)`, '');
        if (!lesson.tasks.length) {
          lines.push('_Нет заданий._', '');
          continue;
        }
        lesson.tasks.forEach((task, i) => {
          lines.push(md.formatTask(task, i));
          lines.push('');
        });
      }
    }
  }
  return lines.join('\n');
}

const header = `# Темы и задания (5–6 лет): русский язык, английский язык, окружающий мир

Автоматически сгенерировано из \`src/data/worlds.ts\` и формулировок \`src/i18n/locales/ru.json\`.

**Окружающий мир** на карте приложения соответствует предмету \`logic\` (мир **Сад**): цвета, животные, времена года.

В списке отмечены все задания урока, включая блок **[ABA]** (\`audience: special_aba\`). В стандартном режиме часть из них не показывается.

✓ — верный вариант, ○ — неверный.

---

`;

const russian = collectSection('Русский язык', (_w, t) => t.subject === 'reading_ru');
const english = collectSection('Английский язык', (_w, t) => t.subject === 'reading');
const worldAround = collectSection(
  'Окружающий мир (вкладка на карте, subject `logic`)',
  (_w, t) => t.subject === 'logic',
);

const footer = `

---

## Как обновить этот файл

\`\`\`bash
cd talentia-mobile && npm run export:topics-tasks-5-6-md
\`\`\`
`;

fs.writeFileSync(OUT, header + russian + '\n---\n\n' + english + '\n---\n\n' + worldAround + footer, 'utf-8');
console.log('Wrote', OUT);
