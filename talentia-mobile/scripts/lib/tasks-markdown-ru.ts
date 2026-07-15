import * as fs from 'fs';
import type { Lesson, LessonTask, Topic, World } from '../../src/data/worlds';

export function loadRuJson(absolutePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(absolutePath, 'utf-8')) as Record<string, unknown>;
}

export function createTr(ru: Record<string, unknown>) {
  return function tr(key: string): string {
    const parts = key.split('.');
    let cur: unknown = ru;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return key;
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === 'string' ? cur : key;
  };
}

export type TaskMarkdown = ReturnType<typeof createTaskMarkdownHelpers>;

export function createTaskMarkdownHelpers(ru: Record<string, unknown>) {
  const tr = createTr(ru);

  function lessonTitle(lesson: Lesson): string {
    return tr(lesson.titleKey);
  }

  function topicTitle(topic: Topic): string {
    return tr(topic.titleKey);
  }

  function worldTitle(w: World): string {
    return tr(w.titleKey);
  }

  function taskQuestion(task: LessonTask): string {
    return tr(task.questionKey);
  }

  function optLabel(textKey: string | undefined): string {
    if (!textKey) return '—';
    return tr(textKey);
  }

  function formatTask(task: LessonTask, index: number): string {
    const aba = task.audience === 'special_aba' ? ' **[ABA]**' : '';
    const base = `${index + 1}. \`${task.id}\` · ${task.type} · сложность ${task.difficulty}${aba}`;

    switch (task.type) {
      case 'multiple_choice': {
        const q = taskQuestion(task);
        const opts = task.options
          .map((o) => {
            const mark = o.correct ? '✓' : '○';
            return `   - ${mark} ${optLabel(o.textKey)}`;
          })
          .join('\n');
        return `${base}\n   - **Вопрос:** ${q}\n${opts}`;
      }
      case 'input': {
        const q = taskQuestion(task);
        const ph = task.placeholderKey ? ` · подсказка: ${optLabel(task.placeholderKey)}` : '';
        return `${base}\n   - **Вопрос:** ${q}${ph}\n   - **Ответ:** \`${task.answer}\`${task.skippable ? ' (можно пропустить)' : ''}`;
      }
      case 'fill_blank': {
        const sent = tr(task.sentenceKey);
        const opts = task.options
          .map((o) => `   - ${o.correct ? '✓' : '○'} ${optLabel(o.textKey)}`)
          .join('\n');
        return `${base}\n   - **Предложение:** ${sent}\n${opts}`;
      }
      case 'image_point': {
        const q = taskQuestion(task);
        const hs = task.hotspots
          .map((h) => `   - ${h.correct ? '✓' : '○'} ${h.labelKey ? optLabel(h.labelKey) : h.id} (${h.x}, ${h.y})`)
          .join('\n');
        return `${base}\n   - **Вопрос:** ${q}\n   - imageKey: \`${task.imageKey}\`\n${hs}`;
      }
      case 'vocal_imitation': {
        return `${base}\n   - **Звук/фраза:** ${tr(task.soundTextKey)}`;
      }
      case 'word_repetition': {
        return `${base}\n   - **Слово:** ${tr(task.wordKey)}`;
      }
      case 'volume_control': {
        return `${base}\n   - **Направление:** ${task.direction} · ${tr(task.promptTextKey)}`;
      }
      case 'image_word_match': {
        const q = task.questionKey ? taskQuestion(task) : '';
        const pr = task.promptTextKey ? optLabel(task.promptTextKey) : '';
        const opts = task.options
          .map((o) => {
            const parts = [o.textKey ? optLabel(o.textKey) : null, o.imageKey ? `img:\`${o.imageKey}\`` : null]
              .filter(Boolean)
              .join(' · ');
            return `   - ${o.correct ? '✓' : '○'} ${parts}`;
          })
          .join('\n');
        return `${base}\n   - **Вопрос:** ${q || pr}\n${opts}`;
      }
      case 'world_knowledge': {
        const q = taskQuestion(task);
        const opts = task.options
          .map((o) => {
            const parts = [o.textKey ? optLabel(o.textKey) : null, o.imageKey ? `img:\`${o.imageKey}\`` : null]
              .filter(Boolean)
              .join(' · ');
            return `   - ${o.correct ? '✓' : '○'} ${parts}`;
          })
          .join('\n');
        return `${base}\n   - **Вопрос:** ${q}\n${opts}`;
      }
      case 'sorting': {
        const q = taskQuestion(task);
        const gs = task.groups.map((g) => `     - ${g.id}: ${optLabel(g.labelKey)}`).join('\n');
        const is = task.items
          .map((it) => `     - \`${it.id}\` → группа \`${it.groupId}\` (${it.imageKey})`)
          .join('\n');
        return `${base}\n   - **Вопрос:** ${q}\n   - **Группы:**\n${gs}\n   - **Элементы:**\n${is}`;
      }
      case 'routine_chain': {
        const q = taskQuestion(task);
        const steps = task.steps
          .map((s) => `     - ${s.order}. ${optLabel(s.labelKey)} (\`${s.imageKey}\`)`)
          .join('\n');
        return `${base}\n   - **Вопрос:** ${q}\n   - **Шаги:**\n${steps}`;
      }
      case 'action_instruction': {
        const q = taskQuestion(task);
        return `${base}\n   - **Вопрос:** ${q}\n   - actionKey: \`${task.actionKey}\` · illustrationKey: \`${task.illustrationKey}\``;
      }
      default: {
        return `${base}\n   - _(неизвестный тип)_`;
      }
    }
  }

  return { tr, formatTask, lessonTitle, topicTitle, worldTitle };
}

export function subjectRuLabel(subject: Topic['subject']): string {
  switch (subject) {
    case 'math':
      return 'Математика';
    case 'reading_ru':
      return 'Русский язык';
    case 'reading':
      return 'Английский язык';
    case 'logic':
      return 'Окружающий мир / логика (`logic`)';
    case 'social':
      return 'Социальные навыки (`social`)';
    default:
      return subject;
  }
}

/** g1, g2, … без g10, g12 и т.п. */
export function worldMatchesGrade(worldId: string, grade: number): boolean {
  return new RegExp(`^g${grade}(?!\\d)`).test(worldId);
}

export function renderWorldsMarkdown(
  md: TaskMarkdown,
  gradeWorlds: World[],
  options: { title: string; introLines: string[]; footer: string },
): string {
  const lines: string[] = [`# ${options.title}`, '', ...options.introLines, '', '✓ — верный вариант, ○ — неверный.', '', '---', ''];

  for (const world of gradeWorlds) {
    lines.push(`## Мир: ${md.worldTitle(world)} (\`${world.id}\`)`, '');
    if (world.ageBand) {
      lines.push(`*Возрастная метка в данных:* \`${world.ageBand}\``, '');
    }

    for (const topic of world.topics) {
      lines.push(
        `### ${subjectRuLabel(topic.subject)} — тема: ${md.topicTitle(topic)} (\`${topic.id}\`)`,
        '',
      );

      for (const lesson of topic.lessons) {
        lines.push(`#### Урок: ${md.lessonTitle(lesson)} (\`${lesson.id}\`)`, '');
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
    lines.push('---', '');
  }

  lines.push(options.footer.trimEnd());
  return lines.join('\n');
}
