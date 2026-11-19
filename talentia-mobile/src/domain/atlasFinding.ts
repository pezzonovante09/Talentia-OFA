/**
 * Что показать в рамке находки атласа (этап D, docs/design/atlas-firstrun-2026-10-31.md D1): стимул первого
 * задания навыка урока — у урока с разобранным примером навык `model.skill`, иначе навык `tasks[0]`.
 * `choose` / `point` — `stimulus`; `match` — `pairs[0].left` (сторона-кучка); `order` / `group` — первый предмет.
 * Без `shape` и без `numeral` — рамка показывает иконку региона (fallback). Чистая логика без I/O.
 */
import { atlasPage } from '../design/tokens';
import type { Lesson, Media, Task } from '../types/task';

export function taskMedia(task: Task): Media | undefined {
  switch (task.format) {
    case 'match':
      return task.pairs[0]?.left ?? task.stimulus;
    case 'order':
    case 'group':
      return task.stimulus ?? task.items[0];
    case 'choose':
      // Без стимула (три корзинки, ответ — пустая) находка — то, что ребёнок выбрал: верный вариант.
      return task.stimulus ?? task.options.find((o) => o.correct);
    default:
      return task.stimulus;
  }
}

/** Первое задание навыка урока: тот же навык, что у примера, иначе первое задание. */
export function findingTask(lesson: Lesson): Task | undefined {
  const skill = lesson.model?.skill ?? lesson.tasks[0]?.skill;
  return lesson.tasks.find((t) => t.skill === skill) ?? lesson.tasks[0];
}

export type Finding = { kind: 'pile'; media: Media } | { kind: 'numeral'; text: string } | { kind: 'fallback' };

/**
 * Вид находки: кучка до `numeralFrom − 1` фигур — `Pile` с метками «сосчитано»; от `numeralFrom` (6) — карточка
 * с цифрой `count` (ребёнок видел её подписью кучки в уроке); карточка-цифра — как есть; иначе — иконка региона.
 */
export function findingOf(lesson: Lesson): Finding {
  const task = findingTask(lesson);
  const media = task ? taskMedia(task) : undefined;
  if (!media) return { kind: 'fallback' };
  if (media.numeral !== undefined) return { kind: 'numeral', text: String(media.numeral) };
  if (media.shape && media.count !== undefined) {
    if (media.count >= atlasPage.finding.numeralFrom) return { kind: 'numeral', text: String(media.count) };
    return { kind: 'pile', media };
  }
  return { kind: 'fallback' };
}
