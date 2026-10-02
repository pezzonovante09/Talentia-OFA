/**
 * Числовая долина, полоса 5–6. Пилотный контент: тема «Сколько их?», первые два урока из
 * трёх по `CURRICULUM.md`.
 *
 * Сетка тем — `CURRICULUM.md`, схема форматов — `FORMATS.md`. Спецификация уроков —
 * `curriculum-content-reviewer`, 2026-10-02 (решения владельца №26–36 в AUDIT.md).
 *
 * Считаемые предметы рисуются вектором по полю `shape`, а не картинками: камень кружком
 * выходит дешевле отдельного ассета и гарантированно совпадает по стилю, а количество и
 * раскладка (`layout`) задаются точно. Заданий `point` пока нет: панорама региона для счёта
 * не годится — чистых групп предметов на ней нет, — а сцен для счёта ещё не нарисовали
 * (решение №36). Вернуть, когда сцены будут.
 */
import type { Lesson, Media, Topic } from '../types/task';

const COMMON = ['', 'one', 'two', 'three', 'four', 'five'].map((n) => `content.common.${n}`);

/** Вариант-точки «как на кубике»: озвучен числом, поэтому верный нельзя найти по слуху. */
const dots = (id: string, count: 1 | 2 | 3 | 4 | 5, correct: boolean) => ({
  id,
  labelKey: COMMON[count],
  shape: 'dot' as const,
  count,
  layout: 'dice' as const,
  correct,
});

/** Сторона пары «точки» в `match`. */
const dotSide = (count: 1 | 2 | 3 | 4 | 5): Media => ({ labelKey: COMMON[count], shape: 'dot', count, layout: 'dice' });

/**
 * Урок 1. Начинается с узнавания количества, а не со счёта: до трёх ребёнок видит
 * количество целиком раньше, чем научается пересчитывать по одному. Если начать со счёта,
 * он будет механически произносить «раз-два-три», не связывая это с количеством, и
 * дальнейший материал ляжет на пустоту.
 *
 * Прогрессия: камни в ряд → группы с точками → ягоды вразброс → группы разных предметов
 * (количество отделяется от того, что нарисовано). В вариантах только 1–3: четыре ещё не
 * проходили.
 */
const lessonOneTwoThree: Lesson = {
  id: 'nv-count-l1',
  titleKey: 'content.numbers.l1.title',
  band: '5-6',
  hook: { taliPose: 'write', lineKey: 'content.numbers.l1.hook' },
  atlasEntryKey: 'content.numbers.l1.atlas',
  model: {
    skill: 'subitize-1-3',
    example: {
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.l1.model.prompt',
      stimulus: { labelKey: 'content.numbers.l1.model.stimulus', shape: 'leaf', count: 2 },
      options: [dots('a', 1, false), dots('b', 2, true), dots('c', 3, false)],
    },
    steps: [
      { lineKey: 'content.numbers.l1.model.s1', reveal: 'stimulus' },
      { lineKey: 'content.numbers.l1.model.s2', reveal: 'b' },
    ],
  },
  tasks: [
    {
      id: 'nv-count-l1-t1',
      skill: 'subitize-1-3',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.l1.t1.prompt',
      hintKey: 'content.numbers.l1.t1.hint',
      explainKey: ['content.numbers.l1.t1.explain'],
      stimulus: { labelKey: 'content.numbers.l1.t1.stimulus', shape: 'stone', count: 3, layout: 'row' },
      options: [dots('a', 1, false), dots('b', 2, false), dots('c', 3, true)],
    },
    {
      id: 'nv-count-l1-t2',
      skill: 'subitize-1-3',
      format: 'match',
      presentation: 'picture',
      promptKey: 'content.numbers.l1.t2.prompt',
      hintKey: 'content.numbers.l1.t2.hint',
      explainKey: ['content.numbers.l1.t2.explain'],
      pairs: [
        { id: 'p1', left: { labelKey: 'content.numbers.l1.t2.stone', shape: 'stone', count: 1, layout: 'row' }, right: dotSide(1) },
        { id: 'p2', left: { labelKey: 'content.numbers.l1.t2.berries', shape: 'berry', count: 2, layout: 'row' }, right: dotSide(2) },
        { id: 'p3', left: { labelKey: 'content.numbers.l1.t2.leaves', shape: 'leaf', count: 3, layout: 'row' }, right: dotSide(3) },
      ],
    },
    {
      id: 'nv-count-l1-t3',
      skill: 'subitize-1-3',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.l1.t3.prompt',
      hintKey: 'content.numbers.l1.t3.hint',
      explainKey: ['content.numbers.l1.t3.explain'],
      stimulus: { labelKey: 'content.numbers.l1.t3.stimulus', shape: 'berry', count: 3, layout: 'scatter' },
      options: [dots('a', 1, false), dots('b', 2, false), dots('c', 3, true)],
    },
    {
      id: 'nv-count-l1-t4',
      skill: 'subitize-1-3',
      format: 'match',
      presentation: 'picture',
      promptKey: 'content.numbers.l1.t4.prompt',
      hintKey: 'content.numbers.l1.t4.hint',
      explainKey: ['content.numbers.l1.t4.explain'],
      // Одинаковые фигуры никогда не стоят в одной паре: соединять приходится по
      // количеству, а не по тому, что нарисовано.
      pairs: [
        {
          id: 'p1',
          left: { labelKey: 'content.numbers.l1.t4.left-berry', shape: 'berry', count: 1 },
          right: { labelKey: 'content.numbers.l1.t4.right-leaf', shape: 'leaf', count: 1 },
        },
        {
          id: 'p2',
          left: { labelKey: 'content.numbers.l1.t4.left-stones', shape: 'stone', count: 2 },
          right: { labelKey: 'content.numbers.l1.t4.right-berries', shape: 'berry', count: 2 },
        },
        {
          id: 'p3',
          left: { labelKey: 'content.numbers.l1.t4.left-leaves', shape: 'leaf', count: 3 },
          right: { labelKey: 'content.numbers.l1.t4.right-stones', shape: 'stone', count: 3 },
        },
      ],
    },
  ],
};

/**
 * Урок 2. Пересчёт по одному: последнее названное число и есть ответ. Пример нарочно
 * контрастен первому уроку — там Tali смотрит на группу целиком, здесь подсвечивает
 * предметы по одному в такт счёту.
 *
 * Третье задание — спираль: узнавание до трёх из первого урока, передышка перед вызовом.
 * `order` раскладывает по ряду счёта, а не по «меньше-больше»: сравнение количеств ещё
 * не проходили.
 */
const lessonCountToFive: Lesson = {
  id: 'nv-count-l2',
  titleKey: 'content.numbers.l2.title',
  band: '5-6',
  hook: { taliPose: 'found', lineKey: 'content.numbers.l2.hook' },
  atlasEntryKey: 'content.numbers.l2.atlas',
  model: {
    skill: 'count-to-5',
    example: {
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.l2.model.prompt',
      stimulus: { labelKey: 'content.numbers.l2.model.stimulus', shape: 'leaf', count: 4, layout: 'row' },
      options: [dots('a', 3, false), dots('b', 4, true), dots('c', 5, false)],
    },
    steps: [
      { lineKey: 'content.numbers.l2.model.s1', reveal: 'stimulus' },
      { lineKey: 'content.numbers.l2.model.s2', reveal: 'b' },
    ],
  },
  tasks: [
    {
      id: 'nv-count-l2-t1',
      skill: 'count-to-5',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.l2.t1.prompt',
      hintKey: 'content.numbers.l2.t1.hint',
      explainKey: ['content.numbers.l2.t1.explain'],
      stimulus: { labelKey: 'content.numbers.l2.t1.stimulus', shape: 'stone', count: 5, layout: 'row' },
      options: [dots('a', 3, false), dots('b', 4, false), dots('c', 5, true)],
    },
    {
      id: 'nv-count-l2-t2',
      skill: 'count-to-5',
      format: 'order',
      presentation: 'picture',
      promptKey: 'content.numbers.l2.t2.prompt',
      hintKey: 'content.numbers.l2.t2.hint',
      explainKey: ['content.numbers.l2.t2.explain'],
      items: [
        { id: 'i1', labelKey: 'content.numbers.l2.t2.stones', shape: 'stone', count: 5, position: 2 },
        { id: 'i2', labelKey: 'content.numbers.l2.t2.berries', shape: 'berry', count: 3, position: 0 },
        { id: 'i3', labelKey: 'content.numbers.l2.t2.leaves', shape: 'leaf', count: 4, position: 1 },
      ],
    },
    {
      id: 'nv-count-l2-t3',
      skill: 'subitize-1-3',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.l2.t3.prompt',
      hintKey: 'content.numbers.l2.t3.hint',
      explainKey: ['content.numbers.l2.t3.explain'],
      stimulus: { labelKey: 'content.numbers.l2.t3.stimulus', shape: 'berry', count: 2 },
      options: [dots('a', 1, false), dots('b', 2, true), dots('c', 3, false)],
    },
    {
      id: 'nv-count-l2-t4',
      skill: 'count-to-5',
      format: 'match',
      presentation: 'picture',
      promptKey: 'content.numbers.l2.t4.prompt',
      hintKey: 'content.numbers.l2.t4.hint',
      explainKey: ['content.numbers.l2.t4.explain'],
      pairs: [
        { id: 'p1', left: { labelKey: 'content.numbers.l2.t4.berries', shape: 'berry', count: 5 }, right: dotSide(5) },
        { id: 'p2', left: { labelKey: 'content.numbers.l2.t4.stones', shape: 'stone', count: 3 }, right: dotSide(3) },
        { id: 'p3', left: { labelKey: 'content.numbers.l2.t4.leaves', shape: 'leaf', count: 4 }, right: dotSide(4) },
      ],
    },
  ],
};

export const countingTopic: Topic = {
  id: 'nv-count',
  titleKey: 'content.numbers.count.title',
  lessons: [lessonOneTwoThree, lessonCountToFive],
};
