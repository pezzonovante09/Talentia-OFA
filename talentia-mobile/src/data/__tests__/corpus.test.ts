/**
 * Тест-гард на корпус заданий.
 *
 * Проверяет не конкретные уроки, а инварианты, которые обязаны держаться на
 * любом задании. Написан, когда корпус был пуст: прежние 611 заданий удалены
 * целиком, и новый пишется по учебникам с нуля. Смысл именно в таком порядке —
 * гард ловит дефект на первом же задании, а не после того как их накопится
 * тысяча и станет дешевле смириться.
 *
 * Каждая проверка ниже закрывает дефект, найденный аудитом в прежнем корпусе,
 * а не выражает вкус.
 */
import ru from '../../i18n/locales/ru.json';
import { worlds } from '../worlds';
import type { LessonTask } from '../worlds';

type Located = { task: LessonTask; where: string };

const allTasks: Located[] = worlds.flatMap((w) =>
  w.topics.flatMap((t) =>
    t.lessons.flatMap((l) => l.tasks.map((task) => ({ task, where: `${w.id}/${t.id}/${l.id}` }))),
  ),
);

/** Есть ли ключ в ru.json. Ключи точечные: `data.tasks.x_q1`. */
function hasKey(key: string): boolean {
  let node: unknown = ru;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string';
}

/** Все ключи локалей, которые встречаются в задании. */
function keysOf(task: LessonTask): string[] {
  const out: string[] = [task.questionKey];
  const t = task as unknown as Record<string, unknown>;
  for (const field of ['options', 'hotspots', 'items', 'groups', 'steps']) {
    const list = t[field];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item && typeof item === 'object') {
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
          if (k.endsWith('Key') && typeof v === 'string') out.push(v);
        }
      }
    }
  }
  return out;
}

describe('корпус заданий: инварианты', () => {
  it('id заданий уникальны во всём корпусе', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const { task, where } of allTasks) {
      const prev = seen.get(task.id);
      if (prev) dupes.push(`${task.id}: ${prev} и ${where}`);
      else seen.set(task.id, where);
    }
    expect(dupes).toEqual([]);
  });

  it('у каждого multiple_choice ровно один верный вариант', () => {
    const bad: string[] = [];
    for (const { task, where } of allTasks) {
      if (task.type !== 'multiple_choice') continue;
      const correct = task.options.filter((o) => o.correct).length;
      if (correct !== 1) bad.push(`${where}/${task.id}: верных ${correct}`);
    }
    expect(bad).toEqual([]);
  });

  it('у multiple_choice не меньше двух вариантов и id внутри задания не повторяются', () => {
    const bad: string[] = [];
    for (const { task, where } of allTasks) {
      if (task.type !== 'multiple_choice') continue;
      if (task.options.length < 2) bad.push(`${where}/${task.id}: вариантов ${task.options.length}`);
      const ids = task.options.map((o) => o.id);
      if (new Set(ids).size !== ids.length) bad.push(`${where}/${task.id}: id вариантов дублируются`);
    }
    expect(bad).toEqual([]);
  });

  it('в текстах нет утечки ответа', () => {
    // В прежнем корпусе в видимый текст попадали пометки вида «(ответ: 5)»,
    // оставленные при генерации.
    const leak = /\(\s*(ответ|answer|жооп)\s*[:：]/i;
    const bad: string[] = [];
    for (const { task, where } of allTasks) {
      for (const key of keysOf(task)) {
        let node: unknown = ru;
        for (const part of key.split('.')) {
          node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined;
        }
        if (typeof node === 'string' && leak.test(node)) bad.push(`${where}/${task.id}: ${key}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('каждый ключ локали существует в ru.json', () => {
    const missing: string[] = [];
    for (const { task, where } of allTasks) {
      for (const key of keysOf(task)) {
        if (!hasKey(key)) missing.push(`${where}/${task.id}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('audience только standard или special_aba', () => {
    const bad = allTasks
      .filter(({ task }) => task.audience !== 'standard' && task.audience !== 'special_aba')
      .map(({ task, where }) => `${where}/${task.id}: ${String(task.audience)}`);
    expect(bad).toEqual([]);
  });

  it('id миров, тем и уроков уникальны', () => {
    const ids = {
      миры: worlds.map((w) => w.id),
      темы: worlds.flatMap((w) => w.topics.map((t) => t.id)),
      уроки: worlds.flatMap((w) => w.topics.flatMap((t) => t.lessons.map((l) => l.id))),
    };
    for (const [what, list] of Object.entries(ids)) {
      expect({ [what]: new Set(list).size }).toEqual({ [what]: list.length });
    }
  });

  it('в каждом уроке есть хотя бы одно задание', () => {
    const empty = worlds.flatMap((w) =>
      w.topics.flatMap((t) => t.lessons.filter((l) => l.tasks.length === 0).map((l) => l.id)),
    );
    expect(empty).toEqual([]);
  });

  it('форматы не заперты в одном уроке', () => {
    // Аудит прежнего корпуса: 579 заданий из 611 были multiple_choice или
    // input, а остальные десять форматов существовали по одному разу и все
    // внутри единственного ABA-урока. Как только корпус наберёт полсотни
    // заданий, разнообразие форматов начинает проверяться.
    if (allTasks.length < 50) return;
    const byType = new Map<string, number>();
    for (const { task } of allTasks) byType.set(task.type, (byType.get(task.type) ?? 0) + 1);
    const share = (byType.get('multiple_choice') ?? 0) / allTasks.length;
    expect({ доляMultipleChoice: share > 0.8 }).toEqual({ доляMultipleChoice: false });
  });
});
