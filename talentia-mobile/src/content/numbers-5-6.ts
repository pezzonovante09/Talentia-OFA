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

const COMMON = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'].map(
  (n) => `content.common.${n}`,
);

type Count = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
type Numeral = 0 | Count;

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

/** Сторона пары «точки» в `match`. На 5–6 — не больше трёх: столько узнаётся без пересчёта. */
const dotSide = (count: 1 | 2 | 3): Media => ({ labelKey: COMMON[count], shape: 'dot', count, layout: 'dice' });

/**
 * Сторона пары «карточка-число» в `match`, озвучена числом (№81). На 5–6 в паре считается только
 * верхняя сторона — кучка: точки 4–5 ребёнок тоже пересчитывал бы касаниями, а при выбранной кучке
 * первое касание другой стороны ставит пару (раунд 5, `child-ux-specialist`, SCREENS.md 3.3).
 */
const numeralSide = (n: Count): Media => ({ labelKey: COMMON[n], numeral: n });

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
  // Tali просит помощи (роль урока 2): «Считаю всё для карты. Поможешь?» — пример становится
  // «вот как я считаю», а задания — той самой помощью (раунд 5, В2).
  hook: { taliPose: 'point', lineKey: 'content.numbers.l2.hook' },
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
      // Вразброс: в ряд это повтор l1-t1 (два камня в ряд), а спираль — то же узнавание в новом виде.
      stimulus: { labelKey: 'content.numbers.l2.t3.stimulus', shape: 'berry', count: 2, layout: 'scatter' },
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
      // Четыре и пять — вразброс: в плитке не больше трёх в ряд (Р15). Нижняя сторона —
      // карточки-числа, а не точки: считается только кучка (раунд 5, `numeralSide`).
      pairs: [
        { id: 'p1', left: { labelKey: 'content.numbers.l2.t4.berries', shape: 'berry', count: 5, layout: 'scatter' }, right: numeralSide(5) },
        { id: 'p2', left: { labelKey: 'content.numbers.l2.t4.stones', shape: 'stone', count: 3, layout: 'row' }, right: numeralSide(3) },
        { id: 'p3', left: { labelKey: 'content.numbers.l2.t4.leaves', shape: 'leaf', count: 4, layout: 'scatter' }, right: numeralSide(4) },
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
 * до пяти: кучки 1, 3, 5 (решение №93; `build` на 5–6 недостижим — с 7 лет, так что на счёт до
 * десяти t2 вернётся только другим форматом). 7–10 — в `choose`, а не в парах `match` (пары по 7–10 — пятьдесят актов счёта,
 * пятилетке в одиночку не пройти). При числе больше пяти задание идёт «кучка → число» (решение №81): одна
 * кучка в ряд (`stimulus`, `row`) и три карточки-числа (`numeral`), каждая озвучена числом.
 * Точек в вариантах нет: ряд и точки дали бы один силуэт «пять и остаток» (А12). Цифра здесь
 * только подпись, опора — звучащее число: цифры — следующая тема. Варианты соседние, верный по
 * величине: пример — средний (6 из 5/6/7), t1 — меньший (7 из 7/8/9), t3 — больший (10 из
 * 8/9/10), t4 — средний (9 из 8/9/10). Так правило «бери самое большое» не проходит, разброс
 * держит `answerRank`. Спираль на счёт до пяти — t2 (`order`); урок заканчивается своим навыком
 * на шаг ниже пика (лёгкий успех перед атласом). `choose` в уроке три — исключение №168 для
 * навыка с кучками больше пяти (`choosePerLesson`). Больше пяти фигур — только рядом (`row`):
 * разброс до десяти пятилетка не пересчитает (гард `scatter56`).
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
    // Урок 3 темы — Tali ошибается (TALI.md, №70): сомневается в пяти, пересчитывает, находит шесть.
    steps: [
      { lineKey: 'content.numbers.l3.model.s1', reveal: 'a', mistake: true },
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
      // Кучки 1, 3, 5, а не 3, 4, 5: иначе это почти дословно l2-t2 (раунд 3, В1; раунд 4).
      // `build` на 5–6 недостижим (FORMAT_MIN_BAND — с 7 лет): на `count-to-10` это задание
      // вернётся только с другим форматом, а не с `build`.
      id: 'nv-count-l3-t2',
      skill: 'count-to-5',
      format: 'order',
      presentation: 'picture',
      promptKey: 'content.numbers.l3.t2.prompt',
      hintKey: 'content.numbers.l3.t2.hint',
      explainKey: ['content.numbers.l3.t2.explain'],
      items: [
        { id: 'i1', labelKey: 'content.numbers.l3.t2.berries', shape: 'berry', count: 3, layout: 'row', position: 1 },
        { id: 'i2', labelKey: 'content.numbers.l3.t2.leaf', shape: 'leaf', count: 1, position: 0 },
        { id: 'i3', labelKey: 'content.numbers.l3.t2.stones', shape: 'stone', count: 5, layout: 'scatter', position: 2 },
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
      // Третий `choose` — по исключению №168 (навык урока с maxCount > 5; вопрос 69). Девять, а не
      // восемь: нижний ряд на одну короче полного — дистрактор «десять» ловит узнавание по силуэту t3.
      // Урок кончается своим навыком: строка атласа «досчитали до десяти» — после задания на десятки.
      id: 'nv-count-l3-t4',
      skill: 'count-to-10',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.l3.t4.prompt',
      hintKey: 'content.numbers.l3.t4.hint',
      explainKey: ['content.numbers.l3.t4.explain'],
      stimulus: { labelKey: 'content.numbers.l3.t4.stimulus', shape: 'berry', count: 9, layout: 'row' },
      options: [numeral('a', 8, false), numeral('b', 9, true), numeral('c', 10, false)],
    },
  ],
};

export const countingTopic: Topic = {
  id: 'nv-count',
  titleKey: 'content.numbers.count.title',
  lessons: [lessonOneTwoThree, lessonCountToFive, lessonCountToTen],
};

// ---------------------------------------------------------------------------
// Тема «Цифры» — навыки-символы `numeral-1-5`, `numeral-6-10` и `zero` (решения №72, №77,
// №81, №88, №136). Цифра — подпись к количеству: одна кучка и три карточки-числа. В навыке-символе
// карточка **немая** (`voice: 'select'`): до ответа звучит только нейтральный звук выбора, иначе
// цифра находится на слух (№88, SCREENS.md 3.8.1). Ноль — пустая корзинка, и все кучки такого
// задания лежат в корзинках (`container`, №136); навык `zero` без `symbol`: ответ ищут по пустоте,
// карточки в нём звучат числом.
// ---------------------------------------------------------------------------

/** Немая карточка-число для навыка-символа (№88): имя звучит только после ответа или показа. */
const card = (id: string, n: Numeral, correct: boolean) => ({ id, labelKey: COMMON[n], numeral: n, voice: 'select' as const, correct });

/** Карточка-число, озвученная числом, — для навыка `zero` без `symbol` (ответ ищут по корзинке). */
const spokenCard = (id: string, n: Numeral, correct: boolean) => ({ id, labelKey: COMMON[n], numeral: n, correct });

/** Сторона пары `match` — озвученная карточка-число (навык без `symbol`). */
const spokenSide = (n: Numeral): Media => ({ labelKey: COMMON[n], numeral: n });

/** Кучка в корзинке: ноль — пустая корзинка (№136). `layout` при нуле не нужен. */
const basket = (labelKey: string, shape: NonNullable<Media['shape']>, count: Numeral, layout?: Media['layout']): Media => ({
  labelKey,
  shape,
  count,
  container: 'basket',
  ...(count > 0 && layout ? { layout } : {}),
});

/**
 * Урок 1. Цифры до пяти. Tali знает и показывает (роль урока 1): пример — «кучка → цифра»,
 * задания — то же узнавание. Карточки немые: цифру ищут по количеству, не по звуку.
 * Верный ответ не всегда самый большой и не всегда самый маленький (`answerRank`).
 */
const lessonNumeralsToFive: Lesson = {
  id: 'nv-num-l1',
  titleKey: 'content.numbers.num-l1.title',
  band: '5-6',
  hook: { taliPose: 'write', lineKey: 'content.numbers.num-l1.hook' },
  atlasEntryKey: 'content.numbers.num-l1.atlas',
  model: {
    skill: 'numeral-1-5',
    example: {
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l1.model.prompt',
      // Три листа, а не четыре и не два: первое задание — четыре камня, третье — две ягоды.
      stimulus: { labelKey: 'content.numbers.num-l1.model.stimulus', shape: 'leaf', count: 3, layout: 'row' },
      options: [card('a', 2, false), card('b', 3, true), card('c', 4, false)],
    },
    steps: [
      { lineKey: 'content.numbers.num-l1.model.s1', reveal: 'stimulus' },
      { lineKey: 'content.numbers.num-l1.model.s2', reveal: 'b' },
    ],
  },
  tasks: [
    {
      id: 'nv-num-l1-t1',
      skill: 'numeral-1-5',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l1.t1.prompt',
      hintKey: 'content.numbers.num-l1.t1.hint',
      explainKey: ['content.numbers.num-l1.t1.explain'],
      stimulus: { labelKey: 'content.numbers.num-l1.t1.stimulus', shape: 'stone', count: 4, layout: 'row' },
      options: [card('a', 3, false), card('b', 4, true), card('c', 5, false)],
    },
    {
      id: 'nv-num-l1-t2',
      skill: 'numeral-1-5',
      format: 'match',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l1.t2.prompt',
      hintKey: 'content.numbers.num-l1.t2.hint',
      explainKey: ['content.numbers.num-l1.t2.explain'],
      // Пять — вразброс: в плитке не больше трёх в ряд (`tile`). Нижний ряд — немые карточки.
      pairs: [
        { id: 'p1', left: { labelKey: 'content.numbers.num-l1.t2.stones', shape: 'stone', count: 1, layout: 'row' }, right: { labelKey: COMMON[1], numeral: 1, voice: 'select' } },
        { id: 'p2', left: { labelKey: 'content.numbers.num-l1.t2.berries', shape: 'berry', count: 5, layout: 'scatter' }, right: { labelKey: COMMON[5], numeral: 5, voice: 'select' } },
        { id: 'p3', left: { labelKey: 'content.numbers.num-l1.t2.leaves', shape: 'leaf', count: 3, layout: 'row' }, right: { labelKey: COMMON[3], numeral: 3, voice: 'select' } },
      ],
    },
    {
      id: 'nv-num-l1-t3',
      skill: 'numeral-1-5',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l1.t3.prompt',
      hintKey: 'content.numbers.num-l1.t3.hint',
      explainKey: ['content.numbers.num-l1.t3.explain'],
      stimulus: { labelKey: 'content.numbers.num-l1.t3.stimulus', shape: 'berry', count: 2, layout: 'scatter' },
      options: [card('a', 1, false), card('b', 2, true), card('c', 3, false)],
    },
    {
      id: 'nv-num-l1-t4',
      skill: 'numeral-1-5',
      format: 'order',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l1.t4.prompt',
      hintKey: 'content.numbers.num-l1.t4.hint',
      explainKey: ['content.numbers.num-l1.t4.explain'],
      // Порядок цифр без кучек: карточки немые, вопрос цифр не называет (SCREENS.md 3.8.1).
      // Три-четыре-пять, а не один-два-три: финал урока — на новом материале (ревью, Н12);
      // подсказка «считай дальше двух» — двойки на карточках нет.
      items: [
        { id: 'i1', labelKey: COMMON[4], numeral: 4, voice: 'select', position: 1 },
        { id: 'i2', labelKey: COMMON[5], numeral: 5, voice: 'select', position: 2 },
        { id: 'i3', labelKey: COMMON[3], numeral: 3, voice: 'select', position: 0 },
      ],
    },
  ],
};

/**
 * Урок 2. Ноль. Tali просит помощи (роль урока 2): корзинки для карты, какая пустая. Пример —
 * пустая корзинка и карточка «ноль»; задания — найти пустую корзинку среди полных, соединить
 * корзинки с числами, разложить по порядку. Третье задание — спираль на цифры до пяти (немые
 * карточки, навык-символ). Все кучки заданий с нулём — в корзинках (`basketAll`).
 */
const lessonZero: Lesson = {
  id: 'nv-num-l2',
  titleKey: 'content.numbers.num-l2.title',
  band: '5-6',
  hook: { taliPose: 'point', lineKey: 'content.numbers.num-l2.hook' },
  atlasEntryKey: 'content.numbers.num-l2.atlas',
  model: {
    skill: 'zero',
    example: {
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l2.model.prompt',
      stimulus: basket('content.numbers.num-l2.model.stimulus', 'leaf', 0),
      options: [spokenCard('a', 0, true), spokenCard('b', 1, false), spokenCard('c', 2, false)],
    },
    steps: [
      { lineKey: 'content.numbers.num-l2.model.s1', reveal: 'stimulus' },
      { lineKey: 'content.numbers.num-l2.model.s2', reveal: 'a' },
    ],
  },
  tasks: [
    {
      id: 'nv-num-l2-t1',
      skill: 'zero',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l2.t1.prompt',
      hintKey: 'content.numbers.num-l2.t1.hint',
      explainKey: ['content.numbers.num-l2.t1.explain'],
      // Без стимула: три корзинки, ответ — пустая. Не повторяет пример (там корзинка → цифра).
      options: [
        { id: 'a', ...basket('content.numbers.num-l2.t1.berries', 'berry', 2, 'row'), correct: false },
        { id: 'b', ...basket('content.numbers.num-l2.t1.empty', 'stone', 0), correct: true },
        { id: 'c', ...basket('content.numbers.num-l2.t1.leaves', 'leaf', 3, 'row'), correct: false },
      ],
    },
    {
      id: 'nv-num-l2-t2',
      skill: 'zero',
      format: 'match',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l2.t2.prompt',
      hintKey: 'content.numbers.num-l2.t2.hint',
      explainKey: ['content.numbers.num-l2.t2.explain'],
      // Карточки звучат числом: навык `zero` без `symbol` — считается корзинка, не узнаётся знак.
      pairs: [
        { id: 'p1', left: basket('content.numbers.num-l2.t2.empty', 'stone', 0), right: spokenSide(0) },
        { id: 'p2', left: basket('content.numbers.num-l2.t2.berry', 'berry', 1, 'row'), right: spokenSide(1) },
        { id: 'p3', left: basket('content.numbers.num-l2.t2.leaves', 'leaf', 2, 'row'), right: spokenSide(2) },
      ],
    },
    {
      id: 'nv-num-l2-t3',
      skill: 'numeral-1-5',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l2.t3.prompt',
      hintKey: 'content.numbers.num-l2.t3.hint',
      explainKey: ['content.numbers.num-l2.t3.explain'],
      // Спираль: цифры до пяти в новом виде — пять листьев вразброс, карточки немые.
      stimulus: { labelKey: 'content.numbers.num-l2.t3.stimulus', shape: 'leaf', count: 5, layout: 'scatter' },
      options: [card('a', 3, false), card('b', 4, false), card('c', 5, true)],
    },
    {
      id: 'nv-num-l2-t4',
      skill: 'zero',
      format: 'order',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l2.t4.prompt',
      hintKey: 'content.numbers.num-l2.t4.hint',
      explainKey: ['content.numbers.num-l2.t4.explain'],
      items: [
        { id: 'i1', ...basket('content.numbers.num-l2.t4.berries', 'berry', 2, 'row'), position: 2 },
        { id: 'i2', ...basket('content.numbers.num-l2.t4.empty', 'leaf', 0), position: 0 },
        { id: 'i3', ...basket('content.numbers.num-l2.t4.stone', 'stone', 1, 'row'), position: 1 },
      ],
    },
  ],
};

/**
 * Урок 3. Цифры до десяти. Tali перепутал шесть и девять (роль урока 3, типичная ошибка по
 * стандарту) — ребёнок поправляет. Большие кучки живут только в стимуле (`tile`: в плитке не
 * больше пяти), поэтому форматы — `choose` со стимулом и `order` немых карточек. Третье задание —
 * спираль на ноль: корзинки.
 */
const lessonNumeralsToTen: Lesson = {
  id: 'nv-num-l3',
  titleKey: 'content.numbers.num-l3.title',
  band: '5-6',
  hook: { taliPose: 'puzzled', lineKey: 'content.numbers.num-l3.hook' },
  atlasEntryKey: 'content.numbers.num-l3.atlas',
  model: {
    skill: 'numeral-6-10',
    example: {
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l3.model.prompt',
      stimulus: { labelKey: 'content.numbers.num-l3.model.stimulus', shape: 'stone', count: 7, layout: 'row' },
      options: [card('a', 6, false), card('b', 7, true), card('c', 8, false)],
    },
    // Урок 3 темы — Tali ошибается (TALI.md, №70): путает похожие 7 и 8, пересчитывает, находит семь.
    steps: [
      { lineKey: 'content.numbers.num-l3.model.s1', reveal: 'c', mistake: true },
      { lineKey: 'content.numbers.num-l3.model.s2', reveal: 'b' },
    ],
  },
  tasks: [
    {
      id: 'nv-num-l3-t1',
      skill: 'numeral-6-10',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l3.t1.prompt',
      hintKey: 'content.numbers.num-l3.t1.hint',
      explainKey: ['content.numbers.num-l3.t1.explain'],
      // Шесть и девять рядом в вариантах — та самая путаница из завязки.
      stimulus: { labelKey: 'content.numbers.num-l3.t1.stimulus', shape: 'leaf', count: 9, layout: 'row' },
      options: [card('a', 6, false), card('b', 9, true), card('c', 10, false)],
    },
    {
      id: 'nv-num-l3-t2',
      skill: 'numeral-6-10',
      format: 'order',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l3.t2.prompt',
      hintKey: 'content.numbers.num-l3.t2.hint',
      explainKey: ['content.numbers.num-l3.t2.explain'],
      items: [
        { id: 'i1', labelKey: COMMON[8], numeral: 8, voice: 'select', position: 2 },
        { id: 'i2', labelKey: COMMON[6], numeral: 6, voice: 'select', position: 0 },
        { id: 'i3', labelKey: COMMON[7], numeral: 7, voice: 'select', position: 1 },
      ],
    },
    {
      id: 'nv-num-l3-t3',
      skill: 'zero',
      format: 'match',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l3.t3.prompt',
      hintKey: 'content.numbers.num-l3.t3.hint',
      explainKey: ['content.numbers.num-l3.t3.explain'],
      // Спираль на ноль в новом виде — `match` корзинок с числами (ревью, Н3); кучки 0/2/3, чтобы
      // не повторить l2-t2. Карточки звучат: навык `zero` без `symbol`.
      pairs: [
        { id: 'p1', left: basket('content.numbers.num-l3.t3.empty', 'leaf', 0), right: spokenSide(0) },
        { id: 'p2', left: basket('content.numbers.num-l3.t3.berries', 'berry', 2, 'row'), right: spokenSide(2) },
        { id: 'p3', left: basket('content.numbers.num-l3.t3.stones', 'stone', 3, 'row'), right: spokenSide(3) },
      ],
    },
    {
      id: 'nv-num-l3-t4',
      skill: 'numeral-6-10',
      format: 'choose',
      presentation: 'picture',
      promptKey: 'content.numbers.num-l3.t4.prompt',
      hintKey: 'content.numbers.num-l3.t4.hint',
      explainKey: ['content.numbers.num-l3.t4.explain'],
      // Десять — ответом по кучке, а не только дистрактором: «десять как две цифры» — одна из трёх
      // типичных ошибок темы (`math-1-4.md`; ревью, Н4). Объяснение возвращает ноль из урока 2.
      stimulus: { labelKey: 'content.numbers.num-l3.t4.stimulus', shape: 'stone', count: 10, layout: 'row' },
      options: [card('a', 8, false), card('b', 9, false), card('c', 10, true)],
    },
  ],
};

export const numeralsTopic: Topic = {
  id: 'nv-num',
  titleKey: 'content.numbers.num.title',
  lessons: [lessonNumeralsToFive, lessonZero, lessonNumeralsToTen],
};
