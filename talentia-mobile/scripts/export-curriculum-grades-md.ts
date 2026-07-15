/**
 * Экспорт программы в пять Markdown-файлов (0–4 класс):
 * `curricula/grade-0-curriculum-ru.md` … `grade-4-curriculum-ru.md` —
 * миры → темы → уроки → диалоги, интро, задания с вариантами (RU).
 *
 * Запуск из папки talentia-mobile:
 *   npx tsx scripts/export-curriculum-grades-md.ts
 *   npm run export:curriculum-grades
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import type { Lesson, LessonTask, World } from '../src/data/worlds';
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

function gradeFromWorldId(worldId: string): 1 | 2 | 3 | 4 | null {
  const m = worldId.match(/^g([1-4])/);
  if (!m) return null;
  return Number(m[1]) as 1 | 2 | 3 | 4;
}

function subjectRu(subject: string): string {
  const map: Record<string, string> = {
    math: 'Математика',
    reading: 'Английский язык',
    reading_ru: 'Русский язык',
    logic: 'Логика',
    social: 'Окружающий мир',
  };
  return map[subject] ?? subject;
}

function escapeMdLine(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function taskAnswerSnippet(task: LessonTask): string {
  if (task.type === 'input' && 'answer' in task) {
    return ` _(ответ: ${String((task as { answer: string }).answer)})_`;
  }
  return '';
}

function speakerLabel(world: World, speaker: 'tali' | 'npc'): string {
  if (speaker === 'tali') return 'Тали';
  return world.npcName?.trim() || 'Персонаж';
}

function appendTaskOptions(lines: string[], task: LessonTask, ru: Record<string, unknown>): void {
  if (task.type === 'multiple_choice') {
    lines.push('');
    lines.push('   Варианты ответа:');
    for (const opt of task.options) {
      const t = getByKey(ru, opt.textKey) ?? opt.textKey;
      const mark = opt.correct ? ' ✓' : '';
      lines.push(`   - \`${opt.id}\`: ${escapeMdLine(t)}${mark}`);
    }
    return;
  }
  if (task.type === 'fill_blank') {
    const sent = getByKey(ru, task.sentenceKey) ?? task.sentenceKey;
    lines.push('');
    lines.push(`   Предложение: ${escapeMdLine(sent)}`);
    lines.push('   Варианты вставки:');
    for (const opt of task.options) {
      const t = getByKey(ru, opt.textKey) ?? opt.textKey;
      const mark = opt.correct ? ' ✓' : '';
      lines.push(`   - \`${opt.id}\`: ${escapeMdLine(t)}${mark}`);
    }
    return;
  }
  if (task.type === 'world_knowledge') {
    lines.push('');
    lines.push('   Варианты:');
    for (const opt of task.options) {
      const t = opt.textKey ? getByKey(ru, opt.textKey) ?? opt.textKey : opt.imageKey ?? opt.id;
      const mark = opt.correct ? ' ✓' : '';
      lines.push(`   - \`${opt.id}\`: ${escapeMdLine(String(t))}${mark}`);
    }
    return;
  }
  if (task.type === 'image_point') {
    lines.push('');
    lines.push(`   Изображение: \`${task.imageKey}\` · точки:`);
    for (const h of task.hotspots) {
      const lab = h.labelKey ? getByKey(ru, h.labelKey) ?? h.labelKey : h.id;
      const mark = h.correct ? ' ✓' : '';
      lines.push(`   - \`${h.id}\`: ${escapeMdLine(String(lab))}${mark}`);
    }
    return;
  }
  if (task.type === 'sorting') {
    lines.push('');
    lines.push('   Группы:');
    for (const g of task.groups) {
      const lab = getByKey(ru, g.labelKey) ?? g.labelKey;
      lines.push(`   - \`${g.id}\`: ${escapeMdLine(lab)}`);
    }
    lines.push('   Элементы:');
    for (const it of task.items) {
      lines.push(`   - \`${it.id}\` → группа \`${it.groupId}\` · картинка \`${it.imageKey}\``);
    }
    return;
  }
  if (task.type === 'routine_chain') {
    lines.push('');
    lines.push('   Шаги рутины:');
    for (const st of [...task.steps].sort((a, b) => a.order - b.order)) {
      const lab = getByKey(ru, st.labelKey) ?? st.labelKey;
      lines.push(`   - ${st.order}. ${escapeMdLine(lab)} (\`${st.imageKey}\`)`);
    }
    return;
  }
  if (task.type === 'vocal_imitation') {
    const s = getByKey(ru, task.soundTextKey) ?? task.soundTextKey;
    lines.push('');
    lines.push(`   Повтори звук/фразу: ${escapeMdLine(s)}`);
    return;
  }
  if (task.type === 'word_repetition') {
    const w = getByKey(ru, task.wordKey) ?? task.wordKey;
    lines.push('');
    lines.push(`   Слово: ${escapeMdLine(w)}`);
    return;
  }
  if (task.type === 'volume_control') {
    const p = getByKey(ru, task.promptTextKey) ?? task.promptTextKey;
    lines.push('');
    lines.push(
      `   Регулятор громкости (${task.direction === 'louder' ? 'громче' : 'тише'}): ${escapeMdLine(p)}`,
    );
    return;
  }
  if (task.type === 'image_word_match') {
    lines.push('');
    lines.push(`   Направление: \`${task.direction}\``);
    if (task.promptTextKey) {
      lines.push(`   Подсказка: ${escapeMdLine(getByKey(ru, task.promptTextKey) ?? task.promptTextKey)}`);
    }
    lines.push('   Пары:');
    for (const opt of task.options) {
      const parts: string[] = [];
      if (opt.textKey) parts.push(getByKey(ru, opt.textKey) ?? opt.textKey);
      if (opt.imageKey) parts.push(`[${opt.imageKey}]`);
      const mark = opt.correct ? ' ✓' : '';
      lines.push(`   - \`${opt.id}\`: ${escapeMdLine(parts.join(' / ') || opt.id)}${mark}`);
    }
    return;
  }
  if (task.type === 'action_instruction') {
    const ak = getByKey(ru, task.actionKey) ?? task.actionKey;
    lines.push('');
    lines.push(`   Действие: ${escapeMdLine(ak)} · иллюстрация \`${task.illustrationKey}\``);
  }
}

function appendLessonBlocks(
  lines: string[],
  world: World,
  lesson: Lesson,
  ru: Record<string, unknown>,
): void {
  if (lesson.descriptionKey) {
    const d = getByKey(ru, lesson.descriptionKey) ?? lesson.descriptionKey;
    lines.push('');
    lines.push(`**Описание урока:** ${escapeMdLine(d)}`);
  }

  const hasDialog = lesson.dialog && lesson.dialog.length > 0;
  const hasIntro = lesson.intro && lesson.intro.length > 0;

  if (hasDialog) {
    lines.push('');
    lines.push('**Диалог:**');
    for (const ln of lesson.dialog!) {
      const text = getByKey(ru, ln.textKey) ?? ln.textKey;
      lines.push(`- **${speakerLabel(world, ln.speaker)}:** ${escapeMdLine(text)}`);
    }
  } else {
    lines.push('');
    lines.push('**Диалог:** *(в данных не задан)*');
  }

  if (hasIntro) {
    lines.push('');
    lines.push('**Интро (объяснения перед заданиями):**');
    let i = 0;
    for (const sl of lesson.intro!) {
      i += 1;
      const title = getByKey(ru, sl.titleKey) ?? sl.titleKey;
      const body = getByKey(ru, sl.bodyKey) ?? sl.bodyKey;
      const em = sl.emoji ? `${sl.emoji} ` : '';
      lines.push(`${i}. ${em}**${escapeMdLine(title)}** — ${escapeMdLine(body)}`);
    }
  }
}

function appendTasksBlock(lines: string[], lesson: Lesson, ru: Record<string, unknown>): void {
  lines.push('');
  lines.push('**Задания:**');
  let n = 0;
  for (const task of lesson.tasks) {
    n += 1;
    const q = getByKey(ru, task.questionKey) ?? task.questionKey;
    const abaTag = task.audience === 'special_aba' ? ' · **[ABA]** · _special_aba_' : '';
    lines.push(
      `${n}. **${task.type}**${abaTag} — ${escapeMdLine(q)}${taskAnswerSnippet(task)}`,
    );
    appendTaskOptions(lines, task, ru);
  }
  lines.push('');
}

function renderWorld(world: World, ru: Record<string, unknown>, lines: string[]): void {
  const wTitle = getByKey(ru, world.titleKey) ?? world.titleKey;
  const wDesc = getByKey(ru, world.descriptionKey) ?? '';
  lines.push(`### ${escapeMdLine(wTitle)}`);
  lines.push('');
  lines.push(`**Мир:** \`${world.id}\` · возраст: \`${world.ageBand ?? '—'}\``);
  if (wDesc) {
    lines.push('');
    lines.push(`*${escapeMdLine(wDesc)}*`);
  }
  lines.push('');

  for (const topic of world.topics) {
    const tTitle = getByKey(ru, topic.titleKey) ?? topic.titleKey;
    lines.push(`#### Тема: ${escapeMdLine(tTitle)}`);
    lines.push('');
    lines.push(`- id темы: \`${topic.id}\` · ${subjectRu(topic.subject)}`);
    if (topic.descriptionKey) {
      const td = getByKey(ru, topic.descriptionKey) ?? topic.descriptionKey;
      lines.push(`- **О теме:** ${escapeMdLine(td)}`);
    }
    lines.push('');

    for (const lesson of topic.lessons) {
      const lTitle = getByKey(ru, lesson.titleKey) ?? lesson.titleKey;
      lines.push(`##### Урок: ${escapeMdLine(lTitle)}`);
      lines.push('');
      lines.push(`\`${lesson.id}\``);
      appendLessonBlocks(lines, world, lesson, ru);
      appendTasksBlock(lines, lesson, ru);
    }
  }
  lines.push('---');
  lines.push('');
}

function writeCurriculumFile(
  outPath: string,
  titleLine: string,
  introLines: string[],
  sectionHeading: string,
  sectionWorlds: World[],
  ru: Record<string, unknown>,
): void {
  const lines: string[] = [];
  lines.push(titleLine);
  lines.push('');
  for (const ln of introLines) {
    lines.push(ln);
  }
  lines.push('');
  lines.push(sectionHeading);
  lines.push('');
  for (const world of sectionWorlds) {
    renderWorld(world, ru, lines);
  }
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Wrote ${outPath}`);
}

function main() {
  const root = path.join(__dirname, '..');
  const ruPath = path.join(root, 'src', 'i18n', 'locales', 'ru.json');
  const ru = JSON.parse(fs.readFileSync(ruPath, 'utf8')) as Record<string, unknown>;
  const outDir = path.join(root, 'curricula');
  fs.mkdirSync(outDir, { recursive: true });

  const preschool = worlds.filter((w) => w.ageBand === '5-6');
  const byGrade: Record<1 | 2 | 3 | 4, World[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const w of worlds) {
    const g = gradeFromWorldId(w.id);
    if (g) byGrade[g].push(w);
  }

  const commonIntro = [
    'Источник данных: `src/data/worlds.ts`, русские тексты — `src/i18n/locales/ru.json`. Сгенерировано скриптом `scripts/export-curriculum-grades-md.ts`.',
    '',
    'Для каждого урока: описание (если есть), **диалог**, **интро** (объяснения перед заданиями), **задания** с вариантами; у вариантов с пометкой ✓ в данных отмечен верный ответ. Задания с меткой **[ABA]** в коде имеют `audience: special_aba` (отдельный режим в приложении).',
    '',
    '### Правка текстов под ABA-режим',
    '',
    '- Переписывайте **диалог, интро и все задания** урока — не только строки с **[ABA]**.',
    '- Формулировки: короткие инструкции, один фокус на задание, явные глаголы («покажи», «выбери», «повтори», «найди»), меньше отвлекающих деталей в вопросе.',
    '- **Не удаляйте** id урока в обратных кавычках (например `` `meadow-c5-l1` ``) — по нему можно импортировать правки обратно в `ru.json`.',
    '- Сохраняйте структуру блоков (**Диалог:**, **Интро:**, **Задания:**) и нумерацию заданий; пометку **[ABA]** и `_special_aba_` не снимайте с ABA-заданий.',
  ];

  writeCurriculumFile(
    path.join(outDir, 'grade-0-curriculum-ru.md'),
    '# Talentia — 0 класс / дошкольники 5–6 лет (RU)',
    [
      ...commonIntro,
      '',
      'В этом файле — все миры с `ageBand: 5-6` (подготовка к школе в приложении).',
    ],
    '## Миры и уроки (5–6 лет)',
    preschool,
    ru,
  );

  for (let g = 1; g <= 4; g++) {
    const gw = byGrade[g as 1 | 2 | 3 | 4];
    writeCurriculumFile(
      path.join(outDir, `grade-${g}-curriculum-ru.md`),
      `# Talentia — ${g} класс (RU)`,
      [
        ...commonIntro,
        '',
        `В этом файле — миры с идентификатором \`g${g}…\` (математика, языки, логика, окружающий мир — по данным в коде).`,
      ],
      `## ${g} класс — темы и задания`,
      gw,
      ru,
    );
  }

  const graded = byGrade[1].length + byGrade[2].length + byGrade[3].length + byGrade[4].length;
  console.log(`  0 класс (5–6): ${preschool.length} миров · 1–4 класс: ${graded} миров`);
}

main();
