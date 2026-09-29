/**
 * Числовая долина, полоса 5–6. Пилотный контент.
 *
 * Сетка тем — `CURRICULUM.md`, схема форматов — `FORMATS.md`.
 *
 * Считаемые предметы рисуются вектором по полю `shape`, а не картинками:
 * камень кружком выходит дешевле отдельного ассета и гарантированно совпадает
 * по стилю. Сценой для `point` служит панорама региона — в ней уже есть и
 * деревья, и холмы, и камни, так что отдельная иллюстрация не нужна.
 */
import type { Lesson, Topic } from '../types/task';

/**
 * Урок 1. Начинается с узнавания количества, а не со счёта: до трёх ребёнок
 * видит количество целиком раньше, чем научается пересчитывать по одному.
 * Если начать со счёта, он будет механически произносить «раз-два-три», не
 * связывая это с количеством, и дальнейший материал ляжет на пустоту.
 */
const lessonOneTwoThree: Lesson = {
  id: 'nv-count-l1',
  titleKey: 'content.numbers.l1.title',
  band: '5-6',
  hook: { taliPose: 'write', lineKey: 'content.numbers.l1.hook' },
  atlasEntryKey: 'content.numbers.l1.atlas',
  tasks: [
    {
      id: 'nv-count-l1-t1',
      skill: 'subitize-1-3',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.l1.t1.prompt',
      hintKey: 'content.numbers.l1.t1.hint',
      stimulus: { labelKey: 'content.numbers.l1.t1.stimulus', shape: 'stone', count: 2 },
      options: [
        { id: 'a', labelKey: 'content.common.one', shape: 'dot', count: 1, correct: false },
        { id: 'b', labelKey: 'content.common.two', shape: 'dot', count: 2, correct: true },
        { id: 'c', labelKey: 'content.common.three', shape: 'dot', count: 3, correct: false },
      ],
    },
    {
      id: 'nv-count-l1-t2',
      skill: 'count-objects-in-scene',
      format: 'point',
      promptKey: 'content.numbers.l1.t2.prompt',
      hintKey: 'content.numbers.l1.t2.hint',
      scene: 'region-numbers',
      targets: [
        { id: 'trio', x: 0.61, y: 0.31, r: 0.12, correct: true, labelKey: 'content.scene.region-numbers.trio' },
        { id: 'single', x: 0.14, y: 0.26, r: 0.13, correct: false, labelKey: 'content.scene.region-numbers.single' },
        { id: 'many', x: 0.89, y: 0.28, r: 0.1, correct: false, labelKey: 'content.scene.region-numbers.many' },
      ],
    },
    {
      id: 'nv-count-l1-t3',
      skill: 'subitize-1-3',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.l1.t3.prompt',
      hintKey: 'content.numbers.l1.t3.hint',
      stimulus: { labelKey: 'content.numbers.l1.t3.stimulus', shape: 'berry', count: 3 },
      options: [
        { id: 'a', labelKey: 'content.common.two', shape: 'dot', count: 2, correct: false },
        { id: 'b', labelKey: 'content.common.three', shape: 'dot', count: 3, correct: true },
        { id: 'c', labelKey: 'content.common.four', shape: 'dot', count: 4, correct: false },
      ],
    },
    {
      id: 'nv-count-l1-t4',
      skill: 'count-objects-in-scene',
      format: 'point',
      promptKey: 'content.numbers.l1.t4.prompt',
      hintKey: 'content.numbers.l1.t4.hint',
      scene: 'region-numbers',
      targets: [
        { id: 'single', x: 0.14, y: 0.26, r: 0.13, correct: true, labelKey: 'content.scene.region-numbers.single' },
        { id: 'trio', x: 0.61, y: 0.31, r: 0.12, correct: false, labelKey: 'content.scene.region-numbers.trio' },
        { id: 'many', x: 0.89, y: 0.28, r: 0.1, correct: false, labelKey: 'content.scene.region-numbers.many' },
      ],
    },
  ],
};

export const countingTopic: Topic = {
  id: 'nv-count',
  titleKey: 'content.numbers.count.title',
  lessons: [lessonOneTwoThree],
};
