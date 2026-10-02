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
  BUBBLE_CHARS,
  BUILD_DIGITS,
  BUILD_FRAGMENTS,
  chooseOptions,
  EXPLAIN_CHARS,
  EXPLAIN_LINES,
  groupLimits,
  INTRO_MIN,
  matchOrderCount,
  MODEL_STEPS,
  PASSAGE_FORMATS,
  PASSAGE_LIMITS,
  POINT_TARGET_GAP,
  pointTargets,
  TASKS_PER_LESSON,
  TEXT_LIMITS,
  textDigits,
  type Range,
} from '../../domain/lessonLimits';
import { FORMAT_MIN_BAND } from '../../types/task';
import type { AgeBand, Lesson, Media, ModelExample, Region, Task, Topic } from '../../types/task';

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

/**
 * Задания вместе с задачами разобранных примеров — для правил формата и полосы:
 * пример идёт на экране того же формата, и лимиты вёрстки, картинки на 5-6 и
 * разрешённые форматы для него те же. Правила оценки (подсказка, объяснение, отрывок)
 * берут только `tasksOf`: пример не оценивается.
 */
function formatTasksOf(corpus: Corpus): LocatedTask[] {
  return [
    ...tasksOf(corpus),
    ...lessonsOf(corpus).flatMap((l) => {
      const m = l.lesson.model;
      if (!m) return [];
      const task = { ...m.example, id: `${l.lesson.id}#model`, skill: m.skill, hintKey: '' } as Task;
      return [{ ...l, task, at: `${l.where}/model` }];
    }),
  ];
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
 * Все ключи локали внутри значения: любое поле, чьё имя кончается на `Key`, — строка
 * или список строк (`explainKey`), на любой глубине. Обход общий, а не по списку полей,
 * чтобы новое поле схемы попало под проверку без правки гарда.
 */
export function keysIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysIn);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => {
    if (k.endsWith('Key') && typeof v === 'string') return [v];
    if (k.endsWith('Key') && Array.isArray(v) && v.every((x) => typeof x === 'string')) return v as string[];
    return keysIn(v);
  });
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
 * Нормы числа заданий, которые пишет автор, по полосе — `domain/lessonLimits.ts`.
 * Ниже потолка сессии: остаток — место под повторение.
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

const chars = (s: string) => [...s].length;

/**
 * Строка длиннее лимита: русская — своего (`ruMax`), остальные локали, где ключ есть, —
 * показанного (`shownMax`, `null` — текст не показывается). Пустые en/ky не проверяются:
 * локализация отложена.
 */
function tooLong(locales: Locales, key: string, ruMax: number, shownMax: number | null, what: string): string[] {
  const out: string[] = [];
  for (const [lang, locale] of Object.entries(locales) as [string, unknown][]) {
    const text = lookup(locale, key);
    if (typeof text !== 'string') continue;
    const max = lang === 'ru' ? ruMax : shownMax;
    if (max !== null && chars(text) > max) out.push(`${what}: ${lang} ${chars(text)} знаков, нужно ≤ ${max}`);
  }
  return out;
}

const sentencesIn = (text: string) => text.split(/[.!?…]+/).filter((s) => s.trim() !== '').length;

/**
 * Числа в тексте, классы через пробел склеены: «10 000» — пятизначное. Пробел между
 * отдельными числами («3 120») прочтётся как одно — в тексте задачи такого не пишут.
 */
const numbersIn = (text: string) =>
  (text.match(/\d{1,3}(?:[   ]\d{3})+|\d+/g) ?? []).map((n) => n.replace(/\D/g, ''));

/** id элементов задания или примера — на них ссылается `ModelStep.reveal`. */
function elementIds(task: Task | ModelExample): string[] {
  const t = task as unknown as Record<string, unknown>;
  return ['options', 'targets', 'pairs', 'items', 'groups', 'fragments'].flatMap((field) => {
    const list = t[field];
    return Array.isArray(list) ? list.map((x) => String((x as { id?: unknown }).id)) : [];
  });
}

/** Содержание без ключей локали и id: два задания с разными ключами, но одним стимулом — одно. */
function strip(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(strip);
  if (typeof v !== 'object' || v === null) return v;
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>)
      .filter(([k]) => !k.endsWith('Key') && k !== 'id')
      .map(([k, x]) => [k, strip(x)]),
  );
}

/**
 * Стимул и ответ задания — то, что пример не должен повторять: иначе первое задание
 * превращается в списывание. Порядок показа вариантов не важен — он перемешивается.
 */
function answerSignature(t: Task | ModelExample): string {
  const s = (v: unknown) => JSON.stringify(strip(v));
  const sorted = (list: unknown[]) => list.map(s).sort();
  switch (t.format) {
    case 'choose':
      return s(['choose', t.stimulus, t.options.find((o) => o.correct)]);
    case 'point':
      return s(['point', t.scene, t.targets.find((z) => z.correct)]);
    case 'match':
      return s(['match', t.stimulus, sorted(t.pairs)]);
    case 'order':
      return s(['order', t.stimulus, [...t.items].sort((a, b) => a.position - b.position)]);
    case 'group':
      return s([
        'group',
        t.stimulus,
        sorted(t.items.map(({ groupId, ...item }) => [item, t.groups.find((g) => g.id === groupId)])),
      ]);
    case 'build':
      return s(['build', t.stimulus, t.answer]);
  }
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
      formatTasksOf(corpus).flatMap(({ task, at }) => {
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
      formatTasksOf(corpus).flatMap(({ task, at, lesson }) => {
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
      formatTasksOf(corpus).flatMap(({ task, at }) => {
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
      formatTasksOf(corpus).flatMap(({ task, at, lesson }) => {
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
      formatTasksOf(corpus).flatMap(({ task, at, lesson }) => {
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
      formatTasksOf(corpus).flatMap(({ task, at, lesson }) => {
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
      formatTasksOf(corpus).flatMap(({ task, at, lesson }) => {
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
      formatTasksOf(corpus).flatMap(({ task, lesson, at }) => {
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
      formatTasksOf(corpus).flatMap(({ task, lesson, at }) => {
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
      formatTasksOf(corpus).flatMap(({ task, at }) =>
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
    // Длина урока — это длина внимания: 5–6 лет держат 6–8 минут, это пять заданий
    // вместе с повторением. Автор пишет меньше потолка — см. TASK_COUNT.
    title: 'число заданий в уроке по норме полосы (5-6: 4, 7 и 8: 4–6, 9-10: 8)',
    check: (corpus) =>
      lessonsOf(corpus).flatMap(({ lesson, where }) => {
        const norm = TASK_COUNT[lesson.band];
        if (!norm) return [];
        const n = lesson.tasks.length;
        const need = norm[0] === norm[1] ? `${norm[0]}` : `${norm[0]}–${norm[1]}`;
        return n < norm[0] || n > norm[1] ? [`${where}: заданий ${n}, для ${lesson.band} нужно ${need}`] : [];
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

  newSkillModel: {
    // Новое правило ребёнок должен сначала увидеть решённым, а не как тест (AUDIT.md,
    // блокер 16). Новый навык — впервые в корпусе своей полосы (решение №26): ребёнок
    // может начать с 7, минуя 5-6. Порядок — порядок файлов, тем и уроков в корпусе.
    // Два новых навыка в уроке — два правила в одном уроке и один пример на оба.
    // Реестра навыков нет, и опечатка в skill выглядит как новый навык — отсюда
    // «или опечатка» в сообщениях.
    title: 'в уроке не больше одного нового навыка своей полосы; есть новый — есть model на него, нет — нет model',
    check: (corpus) => {
      const seen = new Map<AgeBand, Set<string>>();
      return lessonsOf(corpus).flatMap(({ lesson, where }) => {
        const band = seen.get(lesson.band) ?? new Set<string>();
        seen.set(lesson.band, band);
        const fresh = [...new Set(lesson.tasks.map((t) => t.skill))].filter((s) => !band.has(s));
        lesson.tasks.forEach((t) => band.add(t.skill));
        const bad: string[] = [];
        if (fresh.length > 1) {
          bad.push(`${where}: новых навыков ${fresh.length} (${fresh.join(', ')}), нужно не больше одного — или опечатка в skill`);
        } else if (fresh.length === 1 && !lesson.model) {
          bad.push(`${where}: новый навык ${fresh[0]} без разобранного примера (model) — или опечатка в skill`);
        } else if (fresh.length === 1 && lesson.model && lesson.model.skill !== fresh[0]) {
          bad.push(`${where}: пример на ${lesson.model.skill}, а новый навык урока — ${fresh[0]}`);
        } else if (fresh.length === 0 && lesson.model) {
          bad.push(`${where}: разобранный пример без нового навыка — ${lesson.model.skill} уже был в полосе ${lesson.band}`);
        }
        return bad;
      });
    },
  },

  model: {
    // FORMATS.md, «Разобранный пример». Шагов по полосе — время: на 5-6 больше 10–12 с
    // подряд без действия пятилетка не слушает. Пример с тем же стимулом и ответом, что
    // задание урока, превращает первое задание в списывание. Знакомство с форматом
    // после примера — 15–20 с без зачёта: «теперь ты» уже знакомит (решение №28).
    title: 'разобранный пример: шагов Tali по полосе, реплика ≤ 36 (в других локалях ≤ пузыря), reveal на элемент примера, без отрывка, формат как у первого задания навыка, не совпадает с заданиями урока; в уроке нет знакомства; на 5-6 завязка ≤ 36 и первое задание — того же навыка и формата, без отрывка',
    check: (corpus, locales) =>
      lessonsOf(corpus).flatMap(({ lesson, where }) => {
        const m = lesson.model;
        if (!m) return [];
        const at = `${where}/model`;
        const bad: string[] = [];
        const steps = outOfRange(m.steps.length, MODEL_STEPS[lesson.band], false, 'шагов Tali');
        if (steps) bad.push(`${at}: ${steps} (без «теперь ты»)`);
        const ids = new Set(elementIds(m.example));
        m.steps.forEach((step, i) => {
          bad.push(...tooLong(locales, step.lineKey, TEXT_LIMITS.hintChars, BUBBLE_CHARS, `${at}: шаг ${i + 1}`));
          if (step.reveal !== undefined && !ids.has(step.reveal)) bad.push(`${at}: шаг ${i + 1} — в примере нет элемента ${step.reveal}`);
        });
        if ('passage' in m.example) bad.push(`${at}: в примере отрывок — план задачи показывается на условии в одну фразу`);
        const first = lesson.tasks.find((t) => t.skill === m.skill);
        if (first && first.format !== m.example.format) {
          bad.push(`${at}: пример в формате ${m.example.format}, а первое задание навыка ${first.id} — ${first.format}`);
        }
        const sig = answerSignature(m.example);
        for (const t of lesson.tasks) {
          if (answerSignature(t) === sig) bad.push(`${at}: тот же стимул и ответ, что у ${t.id}, — первое задание превратится в списывание`);
        }
        for (const t of lesson.tasks) if (t.intro) bad.push(`${where}/${t.id}: знакомство с форматом в уроке с примером`);
        if (lesson.band === '5-6') {
          bad.push(...tooLong(locales, lesson.hook.lineKey, TEXT_LIMITS.hintChars, BUBBLE_CHARS, `${where}: завязка в уроке с примером`));
          const t0 = lesson.tasks[0];
          if (t0 && (t0.skill !== m.skill || t0.format !== m.example.format)) {
            bad.push(`${where}/${t0.id}: первое задание после примера — ${t0.skill}/${t0.format}, нужно ${m.skill}/${m.example.format}`);
          }
          if (t0?.passage) bad.push(`${where}/${t0.id}: первое задание после примера с отрывком — ещё ≈10 с слушания`);
        }
        return bad;
      }),
  },

  explain: {
    // Показ ответа без «почему» учит тапать показанное, а не понимать (AUDIT.md, блокер
    // 17). Пузырь Tali — три строки, ≈90 знаков кыргызского; вторая реплика сменяет первую.
    // Объяснение, совпадающее с подсказкой, ответа не называет.
    title: `объяснение (explainKey) у каждого оценочного задания: 1 реплика на 5-6, 1–2 с 7 лет; по-русски ≤ ${EXPLAIN_CHARS}, в других локалях ≤ ${BUBBLE_CHARS}; не повторяет подсказку`,
    check: (corpus, locales) =>
      tasksOf(corpus).flatMap(({ task, lesson, at }) => {
        const lines = task.explainKey;
        if (lines === undefined) return task.intro ? [] : [`${at}: нет объяснения (explainKey) — показ ответа без «почему»`];
        const bad: string[] = [];
        const n = outOfRange(lines.length, EXPLAIN_LINES[lesson.band], false, 'реплик объяснения');
        if (n) bad.push(`${at}: ${n}`);
        const hint = lookup(locales.ru, task.hintKey);
        lines.forEach((key, i) => {
          if (key === task.hintKey || (typeof hint === 'string' && lookup(locales.ru, key) === hint)) {
            bad.push(`${at}: объяснение ${i + 1} повторяет подсказку`);
          }
          bad.push(...tooLong(locales, key, EXPLAIN_CHARS, BUBBLE_CHARS, `${at}: объяснение ${i + 1}`));
        });
        return bad;
      }),
  },

  passage: {
    // AUDIT.md, блокер 18; лимиты — расчёт по экрану iPhone SE (`PASSAGE_LIMITS`). На 5-6
    // и 7 картинка — единственная опора для того, кто не читает или читает по слогам.
    title: 'отрывок (passage) только в choose, order, build; длина по-русски и показанная в каждой локали, число предложений по полосе; на 5-6 и 7 с картинкой',
    check: (corpus, locales) =>
      tasksOf(corpus).flatMap(({ task, lesson, at }) => {
        const p = task.passage;
        if (!p) return [];
        const lim = PASSAGE_LIMITS[lesson.band];
        const bad: string[] = [];
        if (!PASSAGE_FORMATS.includes(task.format)) bad.push(`${at}: отрывок в ${task.format} — экран занят сценой или раскладкой`);
        if (lim.image && !isNonEmptyString(p.image)) bad.push(`${at}: на ${lesson.band} у отрывка нужна картинка`);
        bad.push(...tooLong(locales, p.textKey, lim.ruChars, lim.shownChars, `${at}: отрывок`));
        const ru = lookup(locales.ru, p.textKey);
        if (lim.sentences !== null && typeof ru === 'string' && sentencesIn(ru) > lim.sentences) {
          bad.push(`${at}: в отрывке ${sentencesIn(ru)} предложений, на ${lesson.band} не больше ${lim.sentences}`);
        }
        return bad;
      }),
  },

  textNumbers: {
    // Число длиннее разрядности полосы — тема не той полосы, а на клавиатуре его не
    // набрать. На 5-6 клавиатуры нет, но числа до 10 в тексте есть.
    title: 'числа в вопросе и отрывке не длиннее разрядности полосы (textDigits)',
    check: (corpus, { ru }) =>
      tasksOf(corpus).flatMap(({ task, lesson, at }) => {
        const max = textDigits(lesson.band);
        const texts: [string | undefined, string][] = [
          [task.promptKey, 'вопросе'],
          [task.passage?.textKey, 'отрывке'],
        ];
        return texts.flatMap(([key, where]) => {
          const text = key === undefined ? undefined : lookup(ru, key);
          if (typeof text !== 'string') return [];
          return numbersIn(text)
            .filter((n) => n.length > max)
            .map((n) => `${at}: число ${n} в ${where} — для ${lesson.band} не больше ${max} цифр`);
        });
      }),
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
