/**
 * Числовая долина, полоса 5–6. Пилотный контент: тема «Сколько их?», три урока по
 * `CURRICULUM.md` — узнать до трёх, сосчитать до пяти, сосчитать до десяти.
 *
 * Сетка тем — `CURRICULUM.md`, схема форматов — `FORMATS.md`. Спецификация уроков —
 * `curriculum-content-reviewer`, 2026-10-02 (решения владельца №26–36 в AUDIT.md).
 *
 * Считаемые предметы рисуются вектором по полю `shape`, а не картинками: камень кружком
 * выходит дешевле отдельного ассета и гарантированно совпадает по стилю, а количество и
 * раскладка (`layout`) задаются точно. Варианты-числа (`numeral`) рисуются крупной цифрой без фигур. Заданий `point` пока нет: панорама региона для счёта
 * не годится — чистых групп предметов на ней нет, — а сцен для счёта ещё не нарисовали
 * (решение №36). Вернуть, когда сцены будут.
 */
import type { Lesson, Media, Topic } from '../types/task';

const COMMON = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].map(
  (n) => `content.common.${n}`,
);

type Count = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Вариант-точки «как на кубике»: озвучен числом, поэтому верный нельзя найти по слуху. */
const dots = (id: string, count: Count, correct: boolean) => ({
  id,
  labelKey: COMMON[count],
  shape: 'dot' as const,
  count,
  layout: 'dice' as const,
  correct,
});

/**
 * Карточка-число: крупная цифра-подпись, озвучена числом (решение №81). Цифр ещё не проходили — опора на звук.
 * Только для навыков счёта: в навыке с `symbol` («Цифры») карточка немая — `voice: 'select'` (№88).
 */
const numeral = (id: string, n: Count, correct: boolean) => ({ id, labelKey: COMMON[n], numeral: n, correct });

/** Сторона пары «точки» в `match`. */
const dotSide = (count: Count): Media => ({ labelKey: COMMON[count], shape: 'dot', count, layout: 'dice' });

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
      // Три листа, а не два: первое задание — два камня, и пример с тем же ответом превратил
      // бы его в списывание (раунд 2, Р14).
      stimulus: { labelKey: 'content.numbers.l1.model.stimulus', shape: 'leaf', count: 3 },
      options: [dots('a', 1, false), dots('b', 2, false), dots('c', 3, true)],
    },
    steps: [
      { lineKey: 'content.numbers.l1.model.s1', reveal: 'stimulus' },
      { lineKey: 'content.numbers.l1.model.s2', reveal: 'c' },
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
      stimulus: { labelKey: 'content.numbers.l1.t1.stimulus', shape: 'stone', count: 2, layout: 'row' },
      options: [dots('a', 1, false), dots('b', 2, true), dots('c', 3, false)],
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
      // количеству, а не по тому, что нарисовано. Правая сторона — вразброс: ряд против ряда
      // соединялся бы по длине ряда (А12).
      pairs: [
        {
          id: 'p1',
          left: { labelKey: 'content.numbers.l1.t4.left-berry', shape: 'berry', count: 1 },
          right: { labelKey: 'content.numbers.l1.t4.right-leaf', shape: 'leaf', count: 1, layout: 'scatter' },
        },
        {
          id: 'p2',
          left: { labelKey: 'content.numbers.l1.t4.left-stones', shape: 'stone', count: 2 },
          right: { labelKey: 'content.numbers.l1.t4.right-berries', shape: 'berry', count: 2, layout: 'scatter' },
        },
        {
          id: 'p3',
          left: { labelKey: 'content.numbers.l1.t4.left-leaves', shape: 'leaf', count: 3 },
          right: { labelKey: 'content.numbers.l1.t4.right-stones', shape: 'stone', count: 3, layout: 'scatter' },
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
      // Кучки не все в ряд: иначе порядок находится по длине ряда, а не счётом; в плитке не
      // больше трёх в ряд (раунд 2, Р15, гарды `silhouette` и `tile`).
      items: [
        { id: 'i1', labelKey: 'content.numbers.l2.t2.stones', shape: 'stone', count: 5, layout: 'scatter', position: 2 },
        { id: 'i2', labelKey: 'content.numbers.l2.t2.berries', shape: 'berry', count: 3, layout: 'row', position: 0 },
        { id: 'i3', labelKey: 'content.numbers.l2.t2.leaves', shape: 'leaf', count: 4, layout: 'scatter', position: 1 },
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
      // Четыре и пять — вразброс: в плитке не больше трёх в ряд (Р15). Не «кубик»: кубик против
      // точек-кубика соединялся бы по узору (А12).
      pairs: [
        { id: 'p1', left: { labelKey: 'content.numbers.l2.t4.berries', shape: 'berry', count: 5, layout: 'scatter' }, right: dotSide(5) },
        { id: 'p2', left: { labelKey: 'content.numbers.l2.t4.stones', shape: 'stone', count: 3, layout: 'row' }, right: dotSide(3) },
        { id: 'p3', left: { labelKey: 'content.numbers.l2.t4.leaves', shape: 'leaf', count: 4, layout: 'scatter' }, right: dotSide(4) },
      ],
    },
  ],
};

/**
 * Урок 3. Счёт до десяти: тот же пересчёт по одному, но предметов больше, чем видно разом, и
 * ошибка уже в том, чтобы пропустить предмет или сосчитать его дважды. Новое в уроке — способ:
 * трогать каждый предмет по разу, последнее число и есть ответ. Его показывает пример, к нему
 * ведут подсказки.
 *
 * Роль Tali по номеру урока — он сбился со счёта, и средство от сбоя — счёт по одному
 * (TALI.md, «Роли Tali»). Пример — шесть листьев: самый короткий счёт за пятёрку.
 *
 * Нагрузка — по ревью 2026-10-02 (`curriculum-content-reviewer`, `aba-pedagogy-specialist`,
 * `child-ux-specialist`) и раунду 2 (Р15): кучка больше пяти — только в стимуле, в плитке
 * варианта она не пересчитывается (гард `tile`). Поэтому `order` (t2) — спираль на способ урока
 * до пяти: кучки 3, 4, 5 вразброс, трогать по разу (решение №93; с `build` вернуть на счёт до
 * десяти). 7–10 — в `choose`, а не в парах `match` (пары по 7–10 — пятьдесят актов счёта,
 * пятилетке в одиночку не пройти). При числе больше пяти задание идёт «кучка → число» (решение №81): одна
 * кучка в ряд (`stimulus`, `row`) и три карточки-числа (`numeral`), каждая озвучена числом.
 * Точек в вариантах нет: ряд и точки дали бы один силуэт «пять и остаток» (А12). Цифра здесь
 * только подпись, опора — звучащее число: цифры — следующая тема. Варианты соседние, верный по
 * величине: пример — средний (6 из 5/6/7), t1 — меньший (7 из 7/8/9), t3 — больший (10 из
 * 8/9/10). Так правило «бери самое большое» не проходит, разброс держит `answerRank`. Урок
 * заканчивается спиралью на счёт до пяти парами `match` — лёгким
 * успехом перед атласом; `choose` в уроке два (`choosePerLesson`). Больше пяти фигур — только
 * рядом (`row`): разброс до десяти пятилетка не пересчитает (гард `scatter56`).
 */
const lessonCountToTen: Lesson = {
  id: 'nv-count-l3',
  titleKey: 'content.numbers.l3.title',
  band: '5-6',
  hook: { taliPose: 'puzzled', lineKey: 'content.numbers.l3.hook' },
  atlasEntryKey: 'content.numbers.l3.atlas',
  model: {
    skill: 'count-to-10',
    example: {
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.l3.model.prompt',
      stimulus: { labelKey: 'content.numbers.l3.model.stimulus', shape: 'leaf', count: 6, layout: 'row' },
      options: [numeral('a', 5, false), numeral('b', 6, true), numeral('c', 7, false)],
    },
    steps: [
      { lineKey: 'content.numbers.l3.model.s1', reveal: 'stimulus' },
      { lineKey: 'content.numbers.l3.model.s2', reveal: 'b' },
    ],
  },
  tasks: [
    {
      id: 'nv-count-l3-t1',
      skill: 'count-to-10',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.l3.t1.prompt',
      hintKey: 'content.numbers.l3.t1.hint',
      explainKey: ['content.numbers.l3.t1.explain'],
      stimulus: { labelKey: 'content.numbers.l3.t1.stimulus', shape: 'stone', count: 7, layout: 'row' },
      options: [numeral('a', 7, true), numeral('b', 8, false), numeral('c', 9, false)],
    },
    {
      // Спираль на способ урока до пяти: кучки 6–7 в плитку не помещаются (Р15, решение №93).
      // С форматом `build` («положи шесть камней») — вернуть на `count-to-10`.
      id: 'nv-count-l3-t2',
      skill: 'count-to-5',
      format: 'order',
      presentation: 'picture',
      promptKey: 'content.numbers.l3.t2.prompt',
      hintKey: 'content.numbers.l3.t2.hint',
      explainKey: ['content.numbers.l3.t2.explain'],
      items: [
        { id: 'i1', labelKey: 'content.numbers.l3.t2.berries', shape: 'berry', count: 4, layout: 'scatter', position: 1 },
        { id: 'i2', labelKey: 'content.numbers.l3.t2.stones', shape: 'stone', count: 3, layout: 'scatter', position: 0 },
        { id: 'i3', labelKey: 'content.numbers.l3.t2.leaves', shape: 'leaf', count: 5, layout: 'scatter', position: 2 },
      ],
    },
    {
      id: 'nv-count-l3-t3',
      skill: 'count-to-10',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.l3.t3.prompt',
      hintKey: 'content.numbers.l3.t3.hint',
      explainKey: ['content.numbers.l3.t3.explain'],
      stimulus: { labelKey: 'content.numbers.l3.t3.stimulus', shape: 'leaf', count: 10, layout: 'row' },
      options: [numeral('a', 8, false), numeral('b', 9, false), numeral('c', 10, true)],
    },
    {
      id: 'nv-count-l3-t4',
      skill: 'count-to-5',
      format: 'match',
      presentation: 'picture',
      promptKey: 'content.numbers.l3.t4.prompt',
      hintKey: 'content.numbers.l3.t4.hint',
      explainKey: ['content.numbers.l3.t4.explain'],
      // Не те же 3/4/5, что в t2 (`order`): иначе два задания урока считают одно и то же.
      pairs: [
        { id: 'p1', left: { labelKey: 'content.numbers.l3.t4.stones', shape: 'stone', count: 5, layout: 'scatter' }, right: dotSide(5) },
        { id: 'p2', left: { labelKey: 'content.numbers.l3.t4.leaves', shape: 'leaf', count: 2, layout: 'row' }, right: dotSide(2) },
        { id: 'p3', left: { labelKey: 'content.numbers.l3.t4.berries', shape: 'berry', count: 4, layout: 'scatter' }, right: dotSide(4) },
      ],
    },
  ],
};

export const countingTopic: Topic = {
  id: 'nv-count',
  titleKey: 'content.numbers.count.title',
  lessons: [lessonOneTwoThree, lessonCountToFive, lessonCountToTen],
};
