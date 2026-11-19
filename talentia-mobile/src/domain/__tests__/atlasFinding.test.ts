/**
 * Находка для рамки атласа (D1): первое задание навыка урока → `Media`; кучка ≤ 5 — кучка с метками,
 * ≥ 6 или карточка-число — цифра; без фигур и цифры — иконка региона.
 */
import { atlasPage } from '../../design/tokens';
import { findingOf, findingTask, taskMedia } from '../atlasFinding';
import { lessonById, regionLessons } from '../../content';
import type { Lesson, Task } from '../../types/task';

const l1 = lessonById('nv-count-l1')!;
const l3 = lessonById('nv-count-l3')!;

describe('находка атласа', () => {
  it('первое задание навыка урока — навык разобранного примера, не просто tasks[0]', () => {
    const task = findingTask(l1)!;
    expect(task.skill).toBe(l1.model!.skill);
    expect(task.id).toBe(l1.tasks[0].id);
  });

  it('nv-count-l1: два камня в ряд → кучка; nv-count-l3: семь камней → цифра 7', () => {
    expect(findingOf(l1)).toEqual({ kind: 'pile', media: expect.objectContaining({ shape: 'stone', count: 2 }) });
    expect(findingOf(l3)).toEqual({ kind: 'numeral', text: '7' });
    expect(atlasPage.finding.numeralFrom).toBe(6);
  });

  it('match: сторона-кучка первой пары; order/group: стимул или первый предмет', () => {
    const match = l1.tasks.find((t) => t.format === 'match')!;
    expect(taskMedia(match)).toBe(match.format === 'match' ? match.pairs[0].left : undefined);
    const order: Task = { id: 'o', format: 'order', skill: 's', promptKey: 'p', hintKey: 'h', items: [{ id: 'i1', labelKey: 'x', numeral: 3, position: 0 }] } as Task;
    expect(taskMedia(order)).toEqual(expect.objectContaining({ numeral: 3 }));
  });

  it('карточка-число → цифра как есть; без фигур и цифры — fallback', () => {
    const numeral: Lesson = { ...l1, model: undefined, tasks: [{ ...l1.tasks[0], stimulus: { labelKey: 'x', numeral: 4 } } as Task] };
    expect(findingOf(numeral)).toEqual({ kind: 'numeral', text: '4' });
    const plain: Lesson = { ...l1, model: undefined, tasks: [{ ...l1.tasks[0], stimulus: { labelKey: 'x' } } as Task] };
    expect(findingOf(plain)).toEqual({ kind: 'fallback' });
    expect(findingOf({ ...l1, model: undefined, tasks: [] })).toEqual({ kind: 'fallback' });
  });

  it('у каждого урока пилота находка не fallback — страница показывает сделанное', () => {
    for (const lesson of regionLessons('numbers')) expect({ id: lesson.id, kind: findingOf(lesson).kind }).not.toEqual({ id: lesson.id, kind: 'fallback' });
  });
});
