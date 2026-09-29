/**
 * Правила гарда корпуса заданий новой схемы (`src/types/task.ts`).
 *
 * Вынесены из теста чистыми функциями, чтобы их можно было проверить на
 * заведомо плохих фикстурах (`corpusRules.test.ts`). Гард, который ни разу не
 * покраснел, ничего не доказывает: прежний `src/data/__tests__/corpus.test.ts`
 * годами был зелёным, потому что проверял пустой массив.
 *
 * Каждое правило возвращает список нарушений строками вида
 * `<файл> <тема>/<урок>/<задание>: что не так`. На реальном корпусе каждый
 * список обязан быть пустым.
 *
 * Лежит в `__tests__`, а не рядом с контентом, намеренно: всё, что лежит в
 * `src/content` вне `__tests__`, гард считает контентом и требует от него
 * экспорт темы. Так правило обнаружения остаётся без списка исключений.
 */
import {
  BUILD_DIGITS,
  BUILD_FRAGMENTS,
  chooseOptions,
  groupLimits,
  INTRO_MIN,
  matchOrderCount,
  POINT_TARGET_GAP,
  pointTargets,
  TASKS_PER_LESSON,
  TEXT_LIMITS,
  type Range,
} from '../../domain/lessonLimits';
import { FORMAT_MIN_BAND } from '../../types/task';
import type { AgeBand, Lesson, Media, Region, Task, Topic } from '../../types/task';

export type CorpusEntry = { file: string; topic: Topic };
export type Corpus = CorpusEntry[];
/** Локали по языкам. `ru` обязательна — это источник; en/ky пока пусты. */
export type Locales = { ru: unknown; en?: unknown; ky?: unknown };
export type Rule = { title: string; check: (corpus: Corpus, locales: Locales) => string[] };

const BANDS: AgeBand[] = ['5-6', '7', '8', '9-10'];

/**
 * Идентификаторы регионов. `Record` по `Region['id']` заставляет TypeScript
 * потребовать ровно тот же набор, что в схеме: добавят регион в `task.ts` —
 * здесь не скомпилируется, пока его не допишут.
 */
const REGION_IDS: Record<Region['id'], true> = { numbers: true, words: true, nature: true, workshop: true };

type LocatedLesson = { file: string; topic: Topic; lesson: Lesson; where: string };
type LocatedTask = LocatedLesson & { task: Task; at: string };

function lessonsOf(corpus: Corpus): LocatedLesson[] {
  return corpus.flatMap(({ file, topic }) =>
    topic.lessons.map((lesson) => ({ file, topic, lesson, where: `${file} ${topic.id}/${lesson.id}` })),
  );
}

function tasksOf(corpus: Corpus): LocatedTask[] {
  return lessonsOf(corpus).flatMap((l) => l.lesson.tasks.map((task) => ({ ...l, task, at: `${l.where}/${task.id}` })));
}

/** Значение по точечному ключу `content.numbers.l1.title`. */
export function lookup(locale: unknown, key: string): unknown {
  let node: unknown = locale;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/**
 * Все ключи локали внутри значения: любое строковое поле, чьё имя кончается на
 * `Key`, на любой глубине. Обход общий, а не по списку полей, чтобы новое поле
 * схемы (скажем, `explainKey`) попало под проверку без правки гарда.
 */
export function keysIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysIn);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    k.endsWith('Key') && typeof v === 'string' ? [v] : keysIn(v),
  );
}

/**
 * Где какой ключ использован. Контекст — урок или сама тема (её заголовок):
 * ключи темы и ключи урока — разные смысловые места.
 */
function keyUsages(corpus: Corpus): { key: string; context: string }[] {
  const out: { key: string; context: string }[] = [];
  for (const { file, topic } of corpus) {
    const context = `${file} ${topic.id}`;
    for (const key of keysIn({ ...topic, lessons: [] })) out.push({ key, context });
  }
  for (const { lesson, where } of lessonsOf(corpus)) {
    for (const key of keysIn(lesson)) out.push({ key, context: where });
  }
  return out;
}

/** Всё, что ребёнок видит как элемент задания, с адресом внутри задания. */
function mediaOf(task: Task, withStimulus: boolean): { m: Media; at: string }[] {
  const out: { m: Media; at: string }[] = [];
  if (withStimulus && task.stimulus) out.push({ m: task.stimulus, at: 'stimulus' });
  switch (task.format) {
    case 'choose':
      task.options.forEach((o) => out.push({ m: o, at: `options[${o.id}]` }));
      break;
    case 'match':
      task.pairs.forEach((p) => {
        out.push({ m: p.left, at: `pairs[${p.id}].left` });
        out.push({ m: p.right, at: `pairs[${p.id}].right` });
      });
      break;
    case 'order':
    case 'group':
      task.items.forEach((i) => out.push({ m: i, at: `items[${i.id}]` }));
      break;
    default:
      break;
  }
  return out;
}

function duplicates(list: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const x of list) (seen.has(x) ? dupes : seen).add(x);
  return [...dupes];
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * Нормы числа заданий в уроке по полосе — `domain/lessonLimits.ts`. Для 7 и 8
 * нижняя граница не зафиксирована (`CURRICULUM.md` считает 4–6, скилл автора велит
 * спрашивать), поэтому там проверяется только потолок — 10.
 */
export const TASK_COUNT = TASKS_PER_LESSON;

/**
 * Число элементов в допустимых пределах. Задание-знакомство (`intro`) допускает
 * две альтернативы: оно в зачёт не идёт.
 */
function outOfRange(n: number, [min, max]: Range, intro: boolean | undefined, what: string): string | null {
  const lo = intro ? Math.min(INTRO_MIN, min) : min;
  if (n >= lo && n <= max) return null;
  return `${what} ${n}, нужно ${lo === max ? lo : `${lo}–${max}`}${intro ? ' (знакомство)' : ''}`;
}

/** Порог, с которого проверяется доля `choose`, — как в прежнем гарде. */
export const CHOOSE_SHARE_MIN_TASKS = 50;
export const CHOOSE_SHARE_MAX = 0.5;

/** Регэксп утечки ответа — тот же, что в прежнем гарде. */
export const ANSWER_LEAK = /\(\s*(ответ|answer|жооп)\s*[:：]/i;

/**
 * Собирается ли `answer` из не больше `maxParts` фишек (каждая — не больше раза).
 * Регистр не важен: фишка «Ли» и ответ «лиса».
 */
function composable(answer: string, parts: string[], maxParts: number): boolean {
  const target = answer.toLocaleLowerCase('ru');
  const lower = parts.map((p) => p.toLocaleLowerCase('ru'));
  const go = (rest: string, used: Set<number>, depth: number): boolean => {
    if (rest === '') return depth > 0;
    if (depth === maxParts) return false;
    return lower.some((p, i) => p !== '' && !used.has(i) && rest.startsWith(p) && go(rest.slice(p.length), new Set(used).add(i), depth + 1));
  };
  return go(target, new Set(), 0);
}

export const RULES = {
  corpusIds: {
    // Задание адресуется по id в прогрессе, интервальном повторении и
    // аналитике. Два задания с одним id делят историю: ошибка в одном
    // засчитывается другому. То же для уроков (звёзды, resume) и тем.
    title: 'id тем, уроков и заданий уникальны во всём корпусе и непусты',
    check: (corpus) => {
      const bad: string[] = [];
      const lists: [string, string[]][] = [
        ['темы', corpus.map((e) => e.topic.id)],
        ['урока', lessonsOf(corpus).map((l) => l.lesson.id)],
        ['задания', tasksOf(corpus).map((t) => t.task.id)],
      ];
      for (const [what, ids] of lists) {
        for (const id of duplicates(ids)) bad.push(`повторяется id ${what}: ${id}`);
        if (ids.some((id) => !isNonEmptyString(id))) bad.push(`пустой id ${what}`);
      }
      return bad;
    },
  },

  innerIds: {
    // По id варианта движок сужает задание после ошибки (убирает неверный) и
    // сверяет ответ. Два варианта с одним id — убрать можно не тот, а верным
    // засчитается и соседний.
    title: 'id вариантов, целей, пар, элементов, групп и фрагментов уникальны внутри задания',
    check: (corpus) =>
      tasksOf(corpus).flatMap(({ task, at }) => {
        const t = task as unknown as Record<string, unknown>;
        return ['options', 'targets', 'pairs', 'items', 'groups', 'fragments'].flatMap((field) => {
          const list = t[field];
          if (!Array.isArray(list)) return [];
          const ids = list.map((x) => String((x as { id?: unknown }).id));
          return duplicates(ids).map((id) => `${at}: в ${field} повторяется id ${id}`);
        });
      }),
  },

  choose: {
    // Нижняя граница — три: из двух угадывают в половине случаев, и после первой
    // ошибки сужать нечего — остаётся ответ. Два — только в знакомстве с форматом.
    // Верхняя — четыре с 7 лет, три на 5–6: больше пятилетка не удерживает.
    title: 'choose: 3 варианта на 5–6, 3–4 с 7 лет (знакомство — от 2), ровно один верный',
    check: (corpus) =>
      tasksOf(corpus).flatMap(({ task, at, lesson }) => {
        if (task.format !== 'choose') return [];
        const bad: string[] = [];
        const range = outOfRange(task.options.length, chooseOptions(lesson.band), task.intro, 'вариантов');
        if (range) bad.push(`${at}: ${range}`);
        const correct = task.options.filter((o) => o.correct === true).length;
        if (correct !== 1) bad.push(`${at}: верных вариантов ${correct}, нужен ровно один`);
        return bad;
      }),
  },

  point: {
    // Зоны в долях кадра, потому что сцена растягивается по экрану; координата
    // вне [0,1] — зона за кадром, куда ребёнок не может попасть. r < 0.1 —
    // палец пятилетки промахивается мимо зоны, и ошибка оказывается моторной.
    // Названия зон — не украшение: тап по зоне её озвучивает, и скринридер читает
    // каждую зону отдельным элементом (SCREENS.md, 3.2 и 6). Две зоны с одним
    // названием звучат одинаково — ребёнок не знает, в какую попал.
    // Сцена 4:3: радиус в долях ширины, y — в долях высоты, поэтому по вертикали
    // зона занимает r / 0.75. Зоны не ближе r₁ + r₂ + 0.05 — иначе тап между ними
    // неоднозначен; целиком в кадре — иначе в часть зоны не попасть.
    title: 'point: 3–4 цели (знакомство — от 2), одна верная, r ≥ 0.1, зона целиком в кадре, зоны не ближе r₁ + r₂ + 0.05, у каждой своё название',
    check: (corpus) =>
      tasksOf(corpus).flatMap(({ task, at }) => {
        if (task.format !== 'point') return [];
        const bad: string[] = [];
        const range = outOfRange(task.targets.length, pointTargets(), task.intro, 'целей');
        if (range) bad.push(`${at}: ${range}`);
        const ASPECT = 0.75;
        for (const z of task.targets) {
          const ry = z.r / ASPECT;
          if (z.x - z.r < 0 || z.x + z.r > 1 || z.y - ry < 0 || z.y + ry > 1) {
            bad.push(`${at}: цель ${z.id} выходит за кадр`);
          }
        }
        task.targets.forEach((a, i) =>
          task.targets.slice(i + 1).forEach((b) => {
            const d = Math.hypot(a.x - b.x, (a.y - b.y) * ASPECT);
            if (d < a.r + b.r + POINT_TARGET_GAP) {
              bad.push(`${at}: цели ${a.id} и ${b.id} ближе ${(a.r + b.r + POINT_TARGET_GAP).toFixed(2)}`);
            }
          }),
        );
        const correct = task.targets.filter((z) => z.correct === true).length;
        if (correct !== 1) bad.push(`${at}: верных целей ${correct}, нужна ровно одна`);
        const labels = task.targets.map((z) => z.labelKey);
        for (const z of task.targets) {
          if (!isNonEmptyString(z.labelKey)) bad.push(`${at}: цель ${z.id} без названия — нечего озвучить`);
        }
        if (new Set(labels).size !== labels.length) bad.push(`${at}: у целей повторяются названия`);
        for (const z of task.targets) {
          // `!(a >= b)` вместо `a < b`, чтобы NaN тоже был нарушением.
          if (!(z.r >= 0.1)) bad.push(`${at}: цель ${z.id} r=${z.r} < 0.1`);
          if (!(z.x >= 0 && z.x <= 1)) bad.push(`${at}: цель ${z.id} x=${z.x} вне [0, 1]`);
          if (!(z.y >= 0 && z.y <= 1)) bad.push(`${at}: цель ${z.id} y=${z.y} вне [0, 1]`);
        }
        return bad;
      }),
  },

  match: {
    // Одна пара — тап по единственной паре; из двух пар ошибка в одной означает
    // ошибку во второй — тот же выбор из двух. Текстовые на четыре не помещаются.
    title: 'match: 3 пары на 5–6 и в тексте, 3–4 картинками с 7 лет (знакомство — от 2)',
    check: (corpus) =>
      tasksOf(corpus).flatMap(({ task, at, lesson }) => {
        if (task.format !== 'match') return [];
        const range = outOfRange(task.pairs.length, matchOrderCount(lesson.band, task.presentation), task.intro, 'пар');
        return range ? [`${at}: ${range}`] : [];
      }),
  },

  order: {
    // `position` — верный порядок. Повтор или пропуск позиции делает задание
    // нерешаемым (две карточки претендуют на одно место) либо принимающим
    // неверный порядок.
    title: 'order: 3 элемента на 5–6 и в тексте, 3–4 картинками с 7 лет (знакомство — от 2), position — перестановка 0..n-1',
    check: (corpus) =>
      tasksOf(corpus).flatMap(({ task, at, lesson }) => {
        if (task.format !== 'order') return [];
        const bad: string[] = [];
        const n = task.items.length;
        const range = outOfRange(n, matchOrderCount(lesson.band, task.presentation), task.intro, 'элементов');
        if (range) bad.push(`${at}: ${range}`);
        const positions = task.items.map((i) => i.position).sort((a, b) => a - b);
        const expected = Array.from({ length: n }, (_, i) => i);
        if (positions.join(',') !== expected.join(',')) {
          bad.push(`${at}: position [${positions.join(', ')}] — не перестановка 0..${n - 1}`);
        }
        return bad;
      }),
  },

  group: {
    // Элемент с несуществующим groupId положить некуда — задание не решается.
    // Пустая группа — ловушка: ребёнок ищет, что в неё положить.
    // На 5–6 — две группы и 3–4 предмета; с 7 лет — до трёх групп и шести
    // предметов, три группы только картинками: подписи в три корзины не помещаются.
    title: 'group: на 5–6 две группы и 3–4 предмета, с 7 лет 2–3 группы (три — только картинками) и 3–6 предметов; groupId существует, в каждой группе есть элемент',
    check: (corpus) =>
      tasksOf(corpus).flatMap(({ task, at, lesson }) => {
        if (task.format !== 'group') return [];
        const bad: string[] = [];
        const limits = groupLimits(lesson.band, task.presentation);
        const g = outOfRange(task.groups.length, limits.groups, task.intro, 'групп');
        if (g) bad.push(`${at}: ${g}`);
        const it = outOfRange(task.items.length, limits.items, task.intro, 'предметов');
        if (it) bad.push(`${at}: ${it}`);
        const groupIds = new Set(task.groups.map((g) => g.id));
        for (const item of task.items) {
          if (!groupIds.has(item.groupId)) bad.push(`${at}: элемент ${item.id} ссылается на несуществующую группу ${item.groupId}`);
        }
        for (const g of task.groups) {
          if (!task.items.some((i) => i.groupId === g.id)) bad.push(`${at}: в группе ${g.id} нет ни одного элемента`);
        }
        return bad;
      }),
  },

  build: {
    // Из фрагментов — три фишки в ряд на SE: ответ ≤ 3 фишек, лоток ≤ 6, фишка
    // ≤ 6 знаков, и ответ действительно собирается из фишек. Без фрагментов —
    // своя цифровая клавиатура: ответ из цифр, разрядность по программе полосы.
    title: 'build: ответ собирается из ≤ 3 фишек, лоток 2–6, фишка ≤ 6 знаков; без фишек — число с разрядностью по полосе',
    check: (corpus, { ru }) =>
      tasksOf(corpus).flatMap(({ task, at, lesson }) => {
        if (task.format !== 'build') return [];
        const bad: string[] = [];
        if (!isNonEmptyString(task.answer)) return [`${at}: пустой answer`];
        if (task.fragments === undefined) {
          const digits = BUILD_DIGITS[lesson.band];
          if (!/^\d+$/.test(task.answer)) bad.push(`${at}: без фишек ответ вводится цифрами, а answer «${task.answer}»`);
          else if (task.answer.length > digits) bad.push(`${at}: ответ ${task.answer.length}-значный, для ${lesson.band} не больше ${digits}`);
          return bad;
        }
        const n = task.fragments.length;
        if (n < 2 || n > BUILD_FRAGMENTS.maxInTray) bad.push(`${at}: фишек в лотке ${n}, нужно 2–${BUILD_FRAGMENTS.maxInTray}`);
        const texts = task.fragments.map((f) => lookup(ru, f.labelKey));
        texts.forEach((t, i) => {
          if (typeof t === 'string' && [...t].length > BUILD_FRAGMENTS.maxChars) {
            bad.push(`${at}: фишка ${task.fragments![i].id} «${t}» длиннее ${BUILD_FRAGMENTS.maxChars} знаков`);
          }
        });
        if (texts.every((t) => typeof t === 'string') && !composable(task.answer, texts as string[], BUILD_FRAGMENTS.maxInAnswer)) {
          bad.push(`${at}: ответ «${task.answer}» не собирается из ≤ ${BUILD_FRAGMENTS.maxInAnswer} фишек`);
        }
        return bad;
      }),
  },

  intro: {
    // Знакомство с форматом не идёт в зачёт. Два таких в уроке или знакомство не
    // первым — лазейка: задание с двумя вариантами выдаётся за знакомство.
    title: 'знакомство (intro) — не больше одного на урок и только первым заданием',
    check: (corpus) =>
      lessonsOf(corpus).flatMap(({ lesson, where }) => {
        const bad: string[] = [];
        const intros = lesson.tasks.filter((t) => t.intro);
        if (intros.length > 1) bad.push(`${where}: знакомств ${intros.length}, нужно не больше одного`);
        lesson.tasks.forEach((t, i) => {
          if (t.intro && i > 0) bad.push(`${where}/${t.id}: знакомство не первым заданием`);
        });
        return bad;
      }),
  },

  textLength: {
    // Кыргызская строка до ×2.3 от русской: вопрос ≤ 40 знаков помещается в три
    // строки по 18 pt, подсказка ≤ 36 — в пузырь Tali (SCREENS.md, 1.3 и 1.4).
    title: `вопрос ≤ ${TEXT_LIMITS.promptChars} знаков, подсказка ≤ ${TEXT_LIMITS.hintChars} по-русски`,
    check: (corpus, { ru }) =>
      tasksOf(corpus).flatMap(({ task, at }) => {
        const bad: string[] = [];
        const check = (key: string, max: number, what: string) => {
          const t = lookup(ru, key);
          if (typeof t === 'string' && [...t].length > max) bad.push(`${at}: ${what} ${[...t].length} знаков, нужно ≤ ${max}`);
        };
        check(task.promptKey, TEXT_LIMITS.promptChars, 'вопрос');
        check(task.hintKey, TEXT_LIMITS.hintChars, 'подсказка');
        return bad;
      }),
  },

  skillAndHint: {
    // По skill работает интервальное повторение. `Count_to_5`, `count to 5` и
    // `count-to-5` стали бы тремя навыками, и повторение рассыпалось бы. Без
    // hintKey первой ступени после ошибки нет — ребёнок сразу получает ответ,
    // как «Неверно, попробуй ещё раз» прежней версии, только хуже.
    title: 'skill — непустой kebab-case латиницей, hintKey задан',
    check: (corpus) =>
      tasksOf(corpus).flatMap(({ task, at }) => {
        const bad: string[] = [];
        if (typeof task.skill !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(task.skill)) {
          bad.push(`${at}: skill «${String(task.skill)}» не kebab-case латиницей`);
        }
        if (!isNonEmptyString(task.hintKey)) bad.push(`${at}: нет hintKey`);
        return bad;
      }),
  },

  formatBand: {
    // `build` — припоминание, требует письма или уверенного набора; до 7 лет
    // его нет. Заодно ловит неизвестный формат: у него нет рендерера, и
    // остальные правила его бы молча пропустили.
    title: 'формат разрешён для полосы урока по FORMAT_MIN_BAND',
    check: (corpus) =>
      tasksOf(corpus).flatMap(({ task, lesson, at }) => {
        const band = BANDS.indexOf(lesson.band);
        if (band < 0) return [`${at}: неизвестная полоса урока ${String(lesson.band)}`];
        const min = (FORMAT_MIN_BAND as Record<string, AgeBand | undefined>)[task.format];
        if (!min) return [`${at}: неизвестный формат ${String(task.format)}`];
        return band < BANDS.indexOf(min) ? [`${at}: формат ${task.format} доступен с полосы ${min}, урок ${lesson.band}`] : [];
      }),
  },

  picture56: {
    // Аудит: в прежнем корпусе для 5–6 лет 132 задания и ни одной картинки.
    // Нечитающему ребёнку текстовый вариант не «сложнее» — его для него нет.
    // Поэтому на 5-6 только picture, и у каждого элемента, в который он
    // тыкает, есть картинка и labelKey (он же адрес озвучки).
    title: 'полоса 5-6: presentation только picture, у каждого варианта/элемента/стороны пары есть labelKey и картинка',
    check: (corpus) =>
      tasksOf(corpus).flatMap(({ task, lesson, at }) => {
        if (lesson.band !== '5-6') return [];
        const bad: string[] = [];
        if ('presentation' in task && task.presentation !== 'picture') {
          bad.push(`${at}: presentation ${String(task.presentation)} на полосе 5-6`);
        }
        for (const { m, at: el } of mediaOf(task, false)) {
          if (!isNonEmptyString(m.labelKey)) bad.push(`${at}: ${el} без labelKey — нечего озвучить`);
          if (m.shape === undefined && m.image === undefined) bad.push(`${at}: ${el} без картинки (shape или image)`);
        }
        return bad;
      }),
  },

  shapeCount: {
    // `shape` рисуется `count` раз. Фигура без числа — рендерер не знает,
    // сколько рисовать; число без фигуры — нечего рисовать; ноль фигур —
    // пустая карточка в задании на счёт. Группы не проверяются: у них `shape`
    // — значок корзины, и `count` схема группе не даёт.
    title: 'shape только вместе с count и наоборот, count — целое ≥ 1',
    check: (corpus) =>
      tasksOf(corpus).flatMap(({ task, at }) =>
        mediaOf(task, true).flatMap(({ m, at: el }) => {
          const bad: string[] = [];
          if ((m.shape === undefined) !== (m.count === undefined)) {
            bad.push(`${at}: ${el} — shape и count задаются только вместе`);
          }
          if (m.count !== undefined && !(Number.isInteger(m.count) && m.count >= 1)) {
            bad.push(`${at}: ${el} count=${m.count}, нужно целое ≥ 1`);
          }
          return bad;
        }),
      ),
  },

  keysExist: {
    // Отсутствующий ключ i18next показывает как сам ключ — ребёнок видит
    // `content.numbers.l1.t1.prompt`, а озвучки по этому адресу нет. Пустая
    // строка — немая кнопка. Проверяется только ru: en и ky намеренно не
    // заполняются, локализация отложена до финала контента.
    title: 'каждый ключ существует в ru.json и это непустая строка',
    check: (corpus, { ru }) =>
      keyUsages(corpus).flatMap(({ key, context }) =>
        isNonEmptyString(lookup(ru, key)) ? [] : [`${context}: ключ ${key} отсутствует в ru.json или пуст`],
      ),
  },

  keysNamespace: {
    // Весь новый контент — под `content.*`. Прежние ключи (`data.tasks.*`,
    // общие `opt_*`) перезаписаны под нужды отдельных уроков; сослаться на
    // них — значит втащить сломанный корпус обратно.
    title: 'все ключи контента лежат под content.*',
    check: (corpus) =>
      keyUsages(corpus).flatMap(({ key, context }) =>
        key.startsWith('content.') ? [] : [`${context}: ключ ${key} вне content.*`],
      ),
  },

  answerLeak: {
    // В прежнем корпусе 56 заданий содержали «_(ответ: N)_» прямо в тексте,
    // который читается вслух. Проверяются все локали, где ключ есть.
    title: 'в текстах нет утечки ответа',
    check: (corpus, locales) =>
      keyUsages(corpus).flatMap(({ key, context }) =>
        (Object.entries(locales) as [string, unknown][]).flatMap(([lang, locale]) => {
          const text = lookup(locale, key);
          return typeof text === 'string' && ANSWER_LEAK.test(text) ? [`${context}: ${lang} ${key} — «${text}»`] : [];
        }),
      ),
  },

  formatSequence: {
    // Аудит: обычный ребёнок видел два формата из двенадцати, и урок был
    // лентой одинаковых выборов. Правило структуры из REBUILD.md.
    title: 'в уроке не больше двух заданий одного формата подряд и минимум два разных формата',
    check: (corpus) =>
      lessonsOf(corpus).flatMap(({ lesson, where }) => {
        const bad: string[] = [];
        const formats = lesson.tasks.map((t) => t.format);
        let run = 0;
        formats.forEach((f, i) => {
          run = i > 0 && formats[i - 1] === f ? run + 1 : 1;
          if (run === 3) bad.push(`${where}: три задания ${f} подряд, начиная с ${lesson.tasks[i - 2].id}`);
        });
        if (new Set(formats).size < 2) bad.push(`${where}: форматов ${new Set(formats).size}, нужно ≥ 2`);
        return bad;
      }),
  },

  taskCount: {
    // Длина урока — это длина внимания: 5–6 лет держат 6–8 минут, это 4–5
    // заданий. См. TASK_COUNT про полосы 7 и 8.
    title: 'число заданий в уроке по норме полосы (5-6: 4–5, 9-10: 8–10; 7 и 8: не больше 10)',
    check: (corpus) =>
      lessonsOf(corpus).flatMap(({ lesson, where }) => {
        const norm = TASK_COUNT[lesson.band];
        if (!norm) return [];
        const n = lesson.tasks.length;
        return n < norm[0] || n > norm[1] ? [`${where}: заданий ${n}, для ${lesson.band} нужно ${norm[0]}–${norm[1]}`] : [];
      }),
  },

  keyReuse: {
    // Прежний корпус сломался на общих ключах: 24 ключа вариантов переписаны
    // под отдельные уроки (`opt_yes` = «К прилагательному», `opt_12` =
    // «Saturday»), и правка в одном уроке молча меняла другой. Общий смысл
    // живёт только в `content.common.*`; всё остальное принадлежит одному
    // уроку (или одной теме — её заголовок).
    title: 'ключи вне content.common.* не используются в двух разных уроках',
    check: (corpus) => {
      const contexts = new Map<string, Set<string>>();
      for (const { key, context } of keyUsages(corpus)) {
        if (key.startsWith('content.common.')) continue;
        const set = contexts.get(key) ?? new Set<string>();
        set.add(context);
        contexts.set(key, set);
      }
      return [...contexts]
        .filter(([, set]) => set.size > 1)
        .map(([key, set]) => `ключ ${key} используется в ${[...set].join(' и ')}`);
    },
  },

  chooseShare: {
    // Аудит: 579 заданий из 611 были выбором варианта или вводом. Порог 50%
    // из FORMATS.md; включается с полусотни заданий, как в прежнем гарде, —
    // на пилоте из пяти заданий доля ничего не говорит.
    title: `доля choose по корпусу ≤ ${CHOOSE_SHARE_MAX * 100}% (с ${CHOOSE_SHARE_MIN_TASKS} заданий)`,
    check: (corpus) => {
      const tasks = tasksOf(corpus);
      if (tasks.length < CHOOSE_SHARE_MIN_TASKS) return [];
      const choose = tasks.filter((t) => t.task.format === 'choose').length;
      const share = choose / tasks.length;
      return share > CHOOSE_SHARE_MAX ? [`choose ${choose} из ${tasks.length} (${Math.round(share * 100)}%)`] : [];
    },
  },

  fileBand: {
    // Аудит: 7 уроков g1world из 9 грузили задачи полосы 5–6 под названиями
    // 1 класса. Файл называется `<регион>-<полоса>.ts`, и каждый урок в нём
    // обязан быть этой полосы.
    title: 'файл называется <регион>-<полоса>.ts, и все его уроки этой полосы',
    check: (corpus) => {
      const bad: string[] = [];
      for (const { file, topic } of corpus) {
        const base = file.split('/').pop() ?? file;
        const m = /^([a-z]+)-(5-6|7|8|9-10)\.tsx?$/.exec(base);
        if (!m || !(m[1] in REGION_IDS)) {
          bad.push(`${file}: имя не по схеме <регион>-<полоса>.ts (регионы: ${Object.keys(REGION_IDS).join(', ')})`);
          continue;
        }
        for (const lesson of topic.lessons) {
          if (lesson.band !== m[2]) bad.push(`${file} ${topic.id}/${lesson.id}: полоса ${lesson.band}, а файл — ${m[2]}`);
        }
      }
      return bad;
    },
  },
} satisfies Record<string, Rule>;

export type RuleId = keyof typeof RULES;

/* ------------------------------------------------------------------------ */
/* Обнаружение тем в модулях                                                 */
/* ------------------------------------------------------------------------ */

export type ContentModule = { file: string; exports: Record<string, unknown> };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function isTopic(v: unknown): v is Topic {
  return isObj(v) && typeof v.id === 'string' && typeof v.titleKey === 'string' && Array.isArray(v.lessons);
}

function isLessonLike(v: unknown): v is Lesson {
  return isObj(v) && typeof v.id === 'string' && Array.isArray(v.tasks);
}

/**
 * Собирает темы из экспортов модулей. Тема принимается как отдельный экспорт,
 * в массиве или внутри региона (`topics`). Один и тот же объект, реэкспортированный
 * из двух модулей, учитывается один раз — иначе реэкспорт дал бы ложный дубль id.
 *
 * Проблемы обнаружения:
 * - модуль не экспортирует ни одной темы — всё, что в нём написано, гард не видит;
 * - экспортирован урок, не входящий ни в одну тему, — его задания не проверяются.
 */
export function collectCorpus(modules: ContentModule[]): { corpus: Corpus; problems: string[] } {
  const corpus: Corpus = [];
  const problems: string[] = [];
  const seen = new Set<unknown>();
  const lessons: { file: string; name: string; lesson: Lesson }[] = [];

  for (const { file, exports } of modules) {
    let found = 0;
    for (const [name, value] of Object.entries(exports)) {
      const candidates = (Array.isArray(value) ? value : [value]).flatMap((v: unknown) =>
        isObj(v) && Array.isArray(v.topics) ? (v.topics as unknown[]) : [v],
      );
      for (const v of candidates) {
        if (isTopic(v)) {
          found++;
          if (!seen.has(v)) {
            seen.add(v);
            corpus.push({ file, topic: v });
          }
        } else if (isLessonLike(v)) {
          lessons.push({ file, name, lesson: v });
        }
      }
    }
    if (found === 0) problems.push(`${file}: не экспортирует ни одной темы (Topic) — его содержимое гард не видит`);
  }

  const reachable = new Set<Lesson>(corpus.flatMap((e) => e.topic.lessons));
  for (const { file, name, lesson } of lessons) {
    if (!reachable.has(lesson)) problems.push(`${file}: урок ${lesson.id} (экспорт ${name}) не входит ни в одну тему`);
  }
  return { corpus, problems };
}
