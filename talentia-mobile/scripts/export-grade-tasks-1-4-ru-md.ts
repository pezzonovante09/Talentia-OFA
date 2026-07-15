/**
 * Четыре файла: все темы и задания 1–4 классов (миры g1*, g2*, g3*, g4*).
 * Тексты из src/i18n/locales/ru.json, структура из src/data/worlds.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { worlds } from '../src/data/worlds';
import {
  createTaskMarkdownHelpers,
  loadRuJson,
  renderWorldsMarkdown,
  worldMatchesGrade,
} from './lib/tasks-markdown-ru';

const ROOT = path.join(__dirname, '..');
const RU_PATH = path.join(ROOT, 'src/i18n/locales/ru.json');
const OUT_DIR = path.join(ROOT, 'scripts', 'generated', 'grade-tasks-md');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ru = loadRuJson(RU_PATH);
const md = createTaskMarkdownHelpers(ru);

const FOOTER = `
## Полная программа с диалогами и интро

Сводка по классам (0–4) с диалогами, интро и заданиями: \`curricula/grade-0-curriculum-ru.md\` … \`grade-4-curriculum-ru.md\` — команда \`npm run export:curriculum-grades\`.

## Как обновить эти файлы (детальный список заданий)

\`\`\`bash
cd talentia-mobile && npm run export:grade-tasks-1-4-md
\`\`\`
`;

for (let grade = 1; grade <= 4; grade += 1) {
  const gradeWorlds = worlds.filter((w) => worldMatchesGrade(w.id, grade));
  const body = renderWorldsMarkdown(md, gradeWorlds, {
    title: `${grade} класс — все темы и задания (Talentia)`,
    introLines: [
      `Автоматически сгенерировано из \`src/data/worlds.ts\` и \`src/i18n/locales/ru.json\`.`,
      '',
      `Включены **все** миры приложения с id \`g${grade}…\` (математика, русский и английский языки, темы \`logic\` / окружающий мир${
        grade === 2 ? ', мир `g2sci`' : ''
      }${grade === 4 ? ', мир `g4social`' : ''} и др. — как задано в данных).`,
      '',
      'Задания с пометкой **[ABA]** в стандартном режиме часто скрыты.',
    ],
    footer: FOOTER,
  });

  const outPath = path.join(OUT_DIR, `grade-${grade}-topics-tasks-full-ru.md`);
  fs.writeFileSync(outPath, body, 'utf-8');
  console.log('Wrote', outPath);
}
