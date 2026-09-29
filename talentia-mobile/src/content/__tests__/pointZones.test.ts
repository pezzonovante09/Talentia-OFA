/**
 * Гард зон `point` в новом контенте. Зона без названия для нечитающего ребёнка и
 * для незрячего не существует: тап по ней ничего не произносит, скринридер её не
 * читает (SCREENS.md, 3.2 и 6). Тип требует поле, этот тест — что оно осмысленное.
 */
import { countingTopic } from '../numbers-5-6';
import type { PointTask, Task } from '../../types/task';

const tasks: Task[] = countingTopic.lessons.flatMap((l) => l.tasks);
const pointTasks = tasks.filter((t): t is PointTask => t.format === 'point');

describe('зоны point', () => {
  it('в пилотном контенте есть задания point — гард что-то проверяет', () => {
    expect(pointTasks.length).toBeGreaterThan(0);
  });

  it('у каждой зоны есть название', () => {
    pointTasks.forEach((t) => t.targets.forEach((z) => expect(z.labelKey.trim()).not.toBe('')));
  });

  it('названия зон внутри задания не повторяются — иначе две зоны звучат одинаково', () => {
    pointTasks.forEach((t) => {
      const keys = t.targets.map((z) => z.labelKey);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  it('зона не меньше 0.1 ширины — палец ребёнка крупный', () => {
    pointTasks.forEach((t) => t.targets.forEach((z) => expect(z.r).toBeGreaterThanOrEqual(0.1)));
  });

  it('в сцене 2–4 зоны и ровно одна верная', () => {
    pointTasks.forEach((t) => {
      expect(t.targets.length).toBeGreaterThanOrEqual(2);
      expect(t.targets.length).toBeLessThanOrEqual(4);
      expect(t.targets.filter((z) => z.correct)).toHaveLength(1);
    });
  });
});
