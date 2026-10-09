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
  BUILD_MAX,
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
import { bandIndex, registryProblems, SKILL_BY_ID, SKILLS } from '../../domain/skills';
import { countSilhouette } from '../../domain/countLayout';
import { FORMAT_MIN_BAND, REVEAL_STIMULUS } from '../../types/task';
import type { AgeBand, Lesson, Media, ModelExample, Region, Task, TaskFormat, Topic } from '../../types/task';

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
const REGION_IDS: Record<Region['id'], true> = { numbers: true, words: true, nature: true, workshop: true, kyrgyz: true };

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

/* ------------------------------------------------------------------------ */
/* Приватность текста: задание о персонаже, а не о ребёнке                   */
/* ------------------------------------------------------------------------ */

/**
 * `\b` в JavaScript не видит кириллицу, поэтому границы слова — через `\p{L}`. Основа
 * без хвостовой границы ловит формы слова: «семь(я|и|ей)».
 */
const words = (alts: string, tail = false) => new RegExp(`(?<!\\p{L})(?:${alts})${tail ? '(?!\\p{L})' : ''}`, 'iu');

type PersonalLang = {
  /** Игровая речь Tali, вырезается до проверки: «Твой ход», «Your turn», «У тебя получилось». */
  safe: RegExp;
  yours: RegExp;
  topic: RegExp;
  direct: RegExp;
  /** Тема с притяжательным суффиксом 2-го лица — уже вопрос о ребёнке (кыргызский). */
  own?: RegExp;
  myTitle: RegExp;
};

/**
 * Обращение к ребёнку «твой / у тебя» вместе с личной темой превращает выбранный вариант в
 * факт о нём: «у тебя есть брат?» — ответ ложится в журнал и уходит в синхронизацию (AUDIT.md,
 * С1, С2; `child-privacy-compliance` 2026-10-02, словари дополнены по его проверке гарда).
 * «Сколько ты видишь камней?» — не о ребёнке и не ловится: нужна пара «принадлежность + тема»,
 * прямой вопрос о нём или (в кыргызском) тема с притяжательным суффиксом 2-го лица. Все три
 * языка проверяются на любом тексте: английское слово Мастерской лежит в ru.json. Ложные
 * срабатывания на игровой речи Tali вырезаются заранее (`safe`) — иначе они приучили бы
 * авторов обходить гард.
 */
export const PERSONAL_TEXT: Record<'ru' | 'en' | 'ky', PersonalLang> = {
  ru: {
    safe: words('у\\s+тебя\\s+получил\\p{L}*|тво(?:й|я|ё)\\s+(?:ход|очередь|ответ|выбор)'),
    yours: words(
      'тво(?:й|я|ё|е|и|его|ему|ей|их|им|ими|ём|ем|ю)|ваш\\p{L}*|у\\s+(?:тебя|вас)|тебе|тобой|ты\\s+(?:живёшь|живешь|ходишь|учишься)',
      true,
    ),
    topic: words(
      [
        'сем(?:ья|ьи|ье|ью|ьёй|ьей)|мам|пап(?:а|ы|е|у|ой|ин)(?!\\p{L})|брат(?!ь)|сестр|бабушк|бабул|дедушк|дед(?!\\p{L})',
        'мать|матер|от(?:ец|ц)|тёт|тет[яиеу]|дяд|родител',
        'адрес|улиц|сел[оаеу](?!\\p{L})|деревн|город|район|област|квартир|комнат|дом(?:а|е|ом|у)?(?!\\p{L})',
        'школ|класс(?:е|у|ом|а|ы)(?!\\p{L})|одноклассн|учител|садик|детск\\p{L}*\\s+сад|воспитател|друг(?!\\s+(?:за|друг))|друз|подруг',
        'вер[аыуе](?!\\p{L})|бог(?:а|у|ом|е)?(?!\\p{L})|религи|мечет|церк|храм|молит|намаз|национальн',
        'болезн|бол(?:ит|ят|ел|еешь|еет)(?!\\p{L})|врач|лекарств|аллерги|вес(?:а|е)?(?!\\p{L})|рост(?!\\p{L})|глаз|волос|кож[аиуе](?!\\p{L})|зуб|тел[оау](?!\\p{L})',
        'деньг|денег|зарплат|им(?:я|ени)(?!\\p{L})|фамили|телефон|питом|собак|кошк|кот(?:а|у|ом|е|ы|ик|ёнок|енок)?(?!\\p{L})|день\\s+рождения',
      ].join('|'),
    ),
    direct: words(
      [
        'как\\s+тебя\\s+зовут|тебя\\s+как\\s+зовут|как\\s+зовут\\s+тебя|сколько\\s+тебе\\s+лет|тебе\\s+сколько\\s+лет|сколько\\s+лет\\s+тебе',
        'где\\s+ты\\s+жив[ёе]шь|в\\s+каком\\s+городе\\s+ты|с\\s+кем\\s+ты\\s+жив[ёе]шь|кто\\s+живёт\\s+с\\s+тобой|с\\s+тобой\\s+живёт',
        'ты\\s+болеешь|какой\\s+ты\\s+веры|кто\\s+ты\\s+по\\s+национальности|в\\s+какой\\s+школе\\s+ты',
        '(?:расскажи|нарисуй|покажи|назови)\\s+(?:о\\s+|про\\s+)?(?:сво\\p{L}*|себ\\p{L}*)',
        'ты\\s+(?:мальчик|девочка|кыргыз|русск|казах|узбек)',
        'а\\s+у\\s+тебя\\s*\\?|а\\s+ты\\s*\\?|а\\s+тво\\p{L}+\\s*\\?',
        // Решение №46: и задача «у тебя пять яблок» — о жителе, а не о ребёнке.
        'у\\s+тебя\\s+(?:(?:было|есть|будет|осталось)\\s+)?(?:\\d+|од(?:ин|на|но)|дв[аей]|три|четыре|пять|шесть|семь|восемь|девять|десять|\\p{L}*дцать|сорок|сто|несколько|много)(?!\\p{L})',
      ].join('|'),
    ),
    myTitle: words('мо(?:й|я|ё|е|и)|наш\\p{L}*|мне|меня|я', true),
  },
  en: {
    safe: words('your\\s+(?:turn|answer|finger\\p{L}*|card\\p{L}*)'),
    yours: words(
      'your|yours|yourself|you\\s+live|you\\s+have|have\\s+you\\s+got|do\\s+you\\s+have|are\\s+you|you\\s+(?:go|attend)',
      true,
    ),
    topic: words(
      [
        'famil|mom|mum|mother|dad|father|brother|sister|gran\\p{L}*|aunt|uncle|cousin|parents?(?!\\p{L})',
        'address|street|village|town|city|room|house|home',
        'school|kindergarten|nursery|teacher|class(?:mate|room)?(?!\\p{L})|friend',
        'religio|god(?!\\p{L})|mosque|church|pray|nationality',
        'sick|ill(?!\\p{L})|doctor|medicine|weight|eyes?(?!\\p{L})|hair|skin|teeth|tooth|body',
        'money|pets?(?!\\p{L})|dog|cat(?!\\p{L})|name(?!\\p{L})|surname|age(?!\\p{L})|birthday|phone',
      ].join('|'),
    ),
    direct: words(
      [
        "what'?s\\s+your\\s+name|what\\s+is\\s+your\\s+name|how\\s+old\\s+are\\s+you|where\\s+do\\s+you\\s+live",
        'who\\s+do\\s+you\\s+live\\s+with|lives?\\s+with\\s+you|tell\\s+me\\s+about\\s+yourself|are\\s+you\\s+a\\s+(?:boy|girl)',
        '(?:and|what\\s+about)\\s+you(?:rs)?\\s*\\?',
        'you\\s+(?:have|had|got)\\s+(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|some|many)(?!\\p{L})',
      ].join('|'),
    ),
    myTitle: words('my|our|me', true),
  },
  ky: {
    safe: words('сенин\\s+кезегиң'),
    yours: words('сенин|сиздин|сенде|сизде|сага|сизге|сен|сиз|сени|сизди', true),
    topic: words(
      [
        'үй-бүлө|апа|ата(?!\\p{L})|эне|ага(?!\\p{L})|байке|эже|ини(?!\\p{L})|сиңди|карындаш|таеже|тайке|бир\\s+тууган|чоң\\s+(?:ата|эне)',
        'дарек|көчө|айыл|шаар|район|облус|бөлмө|үй(?!\\p{L})',
        'мектеп|класс|мугалим|бала\\s+бакча|дос',
        'дин(?!\\p{L})|кудай|мечит|намаз|орозо|улут',
        'оору|дары|дарыгер|көз|чач|тери|тиш|дене|салмак',
        'акча|ит(?!\\p{L})|мышык|үй\\s+жаныбар|телефон|туулган\\s+күн',
      ].join('|'),
    ),
    direct: words(
      'атың\\s+ким|атыңыз\\s+ким|канча\\s+жаштасың|канча\\s+жаштасыз|кайда\\s+жашайсың|кайда\\s+жашайсыз|үй-бүлөң|а\\s+сен(?:чи|де)\\s*\\??|сенде\\s+(?:\\d+|бир|эки|үч|төрт|беш|алты|жети|сегиз|тогуз|он)(?!\\p{L})',
    ),
    own: words(
      '(?:апа|ата|эне|ага|байке|эже|ини|сиңди|карындаш|үй-бүлө|үй|мектеб|мектеп|мугалим|дарег|дарек|айыл|шаар|көчө|ит|мышыг|мышык|бөлмө|акча|ысым|ат)\\p{L}{0,3}(?:ң|ңыз|ңуз|ңүз|ңиз)',
      true,
    ),
    myTitle: words('менин|биздин|үй-бүлөм|үйүм|мектебим|апам|атам', true),
  },
};

/** Что в тексте выдаёт вопрос о ребёнке; `null` — ничего. */
export function personalProbe(text: string): string | null {
  for (const p of Object.values(PERSONAL_TEXT)) {
    const t = text.replace(new RegExp(p.safe.source, 'giu'), ' ');
    const direct = p.direct.exec(t) ?? p.own?.exec(t);
    if (direct) return `вопрос о ребёнке «${direct[0]}»`;
    const yours = p.yours.exec(t);
    const topic = p.topic.exec(t);
    if (yours && topic) return `«${yours[0]}» + личная тема «${topic[0]}»`;
  }
  return null;
}

/** Заголовок от первого лица где угодно в строке: «Моя семья», «Я и моя семья», «All about me». */
export const firstPersonTitle = (text: string): boolean => Object.values(PERSONAL_TEXT).some((p) => p.myTitle.test(text));

/**
 * Ссылки, почта, ники, платформы, призыв сфотографировать или отправить фото, номер рядом со
 * словом «позвони»: в детском контенте их нет вовсе (С2, С18). Номера экстренных служб
 * 101/102/103/112 — трёхзначные и не ловятся; «5+3=8» и ряд «100–90–80» — тоже.
 */
export const CONTACT_TEXT = [
  /https?:\/\/|www\.|tel:/i,
  /(?<![\p{L}\d])[\p{L}\d-]+\.(?:com|ru|kg|kz|uz|org|net|io|me|app|su|рф|ly|be|co|tv|info|online|site)(?![\p{L}\d])/iu,
  /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.\p{L}{2,}/u,
  /(?<![\p{L}\d])@[\p{L}\d_]{2,}/u,
  words('youtube|tiktok|whatsapp|telegram|roblox|instagram|ютуб|тикток|ватсап|телеграм|инстаграм'),
  words('сфотограф|отправ\\p{L}*\\s+фото|take\\s+a\\s+photo|сүрөткө\\s+тарт'),
  words('(?:звон|позвон|телефон|номер|call|phone|чал)\\p{L}*\\D{0,12}\\d{3}[‐–-]\\d{2}'),
];

/**
 * Телефон: девять и больше цифр подряд или через пробелы, скобки и дефисы, и только первая
 * группа может быть из одной цифры («8 999 123 45 67»). Счёт «1 2 3 4 5 6 7 8 9» и «1 000 000»
 * — не телефон.
 */
function phoneIn(text: string): string | null {
  for (const m of text.matchAll(/\+?\d[\d\s()‐–-]*\d/g)) {
    const groups = m[0]
      .replace(/^\+/, '')
      .split(/[\s()‐–-]+/)
      .filter(Boolean);
    if (groups.join('').length >= 9 && groups.slice(1).every((g) => g.length >= 2)) return m[0];
  }
  return null;
}

/** Первый контакт в тексте; `null` — нет. */
export function contactIn(text: string): string | null {
  for (const re of CONTACT_TEXT) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return phoneIn(text);
}

/**
 * Подстановка имени ребёнка (i18next `{{name}}` и варианты). Имя — только в репликах Tali:
 * завязке и шагах примера (решение №42); в задании оно сделало бы ответ личным.
 */
export const NAME_PLACEHOLDER =
  /\{\{-?\s*(?:name|childName|child_name|kidName|userName|nickname|имя|\w+\.name)\s*(?:,[^}]*)?\}\}|\{\s*(?:name|имя)\s*\}/i;

/**
 * Имя — только обращением в начале или в конце реплики («{{name}}, смотри!», «Молодец,
 * {{name}}!»). Озвучка готовится заранее и без имени: файл записывается по тексту с вырезанным
 * обращением, и имя ребёнка не уходит в синтез речи. Имя посреди фразы вырезать нельзя.
 */
export function nameOutsideVocative(text: string): boolean {
  const re = NAME_PLACEHOLDER.source;
  const rest = text
    .replace(new RegExp(`^\\s*(?:${re})\\s*[,!]\\s*`, 'i'), '')
    .replace(new RegExp(`,\\s*(?:${re})\\s*[!.?…]*\\s*$`, 'i'), '');
  return NAME_PLACEHOLDER.test(rest);
}

/** Аффикс к подстановке — сразу, через кавычку или дефис: `{{t}}ны`, `{{t}}»ны`, `{{t}}-ны`. */
export const AFFIX_AFTER_SLOT = /\}\}[»"'’\-]?\p{L}/u;

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
    title: 'build: ответ собирается из ≤ 3 фишек, лоток 2–6, фишка ≤ 6 знаков; без фишек — число с разрядностью и не больше границы нумерации полосы',
    check: (corpus, { ru }) =>
      formatTasksOf(corpus).flatMap(({ task, at, lesson }) => {
        if (task.format !== 'build') return [];
        const bad: string[] = [];
        if (!isNonEmptyString(task.answer)) return [`${at}: пустой answer`];
        if (task.fragments === undefined) {
          const digits = BUILD_DIGITS[lesson.band];
          if (!/^\d+$/.test(task.answer)) bad.push(`${at}: без фишек ответ вводится цифрами, а answer «${task.answer}»`);
          else if (task.answer.length > digits) bad.push(`${at}: ответ ${task.answer.length}-значный, для ${lesson.band} не больше ${digits}`);
          else if (Number(task.answer) > BUILD_MAX[lesson.band]) {
            bad.push(`${at}: ответ ${task.answer} больше ${BUILD_MAX[lesson.band]} — за нумерацией полосы ${lesson.band}`);
          }
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
    title: 'shape только вместе с count и наоборот, count — целое ≥ 1, layout — только у фигур',
    check: (corpus) =>
      formatTasksOf(corpus).flatMap(({ task, at }) =>
        mediaOf(task, true).flatMap(({ m, at: el }) => {
          const bad: string[] = [];
          if ((m.shape === undefined) !== (m.count === undefined)) {
            bad.push(`${at}: ${el} — shape и count задаются только вместе`);
          }
          if (m.layout !== undefined && m.shape === undefined) bad.push(`${at}: ${el} — layout без shape: раскладывать нечего`);
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
    // Опечатка в skill выглядит как новый навык; её ловит `skillRegistry`, а здесь
    // «или опечатка» в сообщениях — подсказка, куда смотреть.
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
          if (step.reveal === REVEAL_STIMULUS) {
            if (!m.example.stimulus) bad.push(`${at}: шаг ${i + 1} подсвечивает стимул, а у примера его нет`);
          } else if (step.reveal !== undefined && !ids.has(step.reveal)) {
            bad.push(`${at}: шаг ${i + 1} — в примере нет элемента ${step.reveal}`);
          }
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

  newCompositeFormat: {
    // Составной формат (match, order, group) при первой встрече ребёнок не знает, как
    // выполнять: Tali сам делает первую половину действия (рантайм, `child-ux-specialist`,
    // решение №35). Две такие демонстрации в одном уроке 5-6 с примером, вдобавок к
    // примеру, — перегрузка. Формат примера знакомит сам («теперь ты»).
    title: 'на 5-6 в уроке с примером — не больше одного составного формата (match, order, group), впервые появляющегося в полосе, кроме формата примера',
    check: (corpus) => {
      const composite = new Set<TaskFormat>(['match', 'order', 'group']);
      const seen = new Map<AgeBand, Set<TaskFormat>>();
      return lessonsOf(corpus).flatMap(({ lesson, where }) => {
        const band = seen.get(lesson.band) ?? new Set<TaskFormat>();
        seen.set(lesson.band, band);
        const fresh = [...new Set(lesson.tasks.map((t) => t.format))].filter(
          (f) => composite.has(f) && !band.has(f) && f !== lesson.model?.example.format,
        );
        if (lesson.model) band.add(lesson.model.example.format);
        lesson.tasks.forEach((t) => band.add(t.format));
        return lesson.band === '5-6' && lesson.model && fresh.length > 1
          ? [`${where}: новых составных форматов ${fresh.length} (${fresh.join(', ')}), в уроке с примером не больше одного`]
          : [];
      });
    },
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

  aboutCharacter: {
    // AUDIT.md С1, решение №39: задание спрашивает о жителе, о Tali или о картинке, а не о
    // ребёнке. Заголовок «Моя семья» ребёнок видит, и он сам задаёт ожидание рассказать о
    // себе — темы называются «Семья Tali», «Улица и дом». Проверяются все локали, где ключ есть.
    title: 'задание о персонаже, а не о ребёнке: нет «твой / у тебя / your / сенин» вместе с личной темой, кыргызской темы с суффиксом 2-го лица и прямых вопросов о ребёнке; в заголовках темы и урока нет первого лица («мой», «наш», «я», my, our, менин)',
    check: (corpus, locales) => {
      const titles = new Set([...corpus.map((e) => e.topic.titleKey), ...lessonsOf(corpus).map((l) => l.lesson.titleKey)]);
      return keyUsages(corpus).flatMap(({ key, context }) =>
        (Object.entries(locales) as [string, unknown][]).flatMap(([lang, locale]) => {
          const text = lookup(locale, key);
          if (typeof text !== 'string') return [];
          const bad: string[] = [];
          const probe = personalProbe(text);
          if (probe) bad.push(`${context}: ${lang} ${key} — ${probe}: спроси о жителе или Tali`);
          if (titles.has(key) && firstPersonTitle(text)) {
            bad.push(`${context}: ${lang} ${key} — заголовок «${text}» от первого лица, назови тему о персонаже`);
          }
          return bad;
        }),
      );
    },
  },

  contacts: {
    // AUDIT.md С2, С18: в детском тексте нет ссылок, почты, ников и телефонов — ни настоящих,
    // ни выдуманных: выдуманный адрес тоже ведёт куда-то в сети.
    title: 'в текстах нет ссылок, почты, @ников, платформ, телефонов, tel: и призыва сфотографировать',
    check: (corpus, locales) =>
      keyUsages(corpus).flatMap(({ key, context }) =>
        (Object.entries(locales) as [string, unknown][]).flatMap(([lang, locale]) => {
          const text = lookup(locale, key);
          if (typeof text !== 'string') return [];
          const hit = contactIn(text);
          return hit ? [`${context}: ${lang} ${key} — контакт «${hit}»`] : [];
        }),
      ),
  },

  nameOnlyInTali: {
    // Решение №42: имя ребёнка — только в репликах Tali, завязке и шагах примера.
    title: 'подстановка имени {{name}} — только в завязке и шагах примера и только обращением в начале или конце реплики; не в задании, примере, заголовке и атласе',
    check: (corpus, locales) =>
      lessonsOf(corpus).flatMap(({ topic, lesson, where }) => {
        const tali = [lesson.hook.lineKey, ...(lesson.model?.steps.map((s) => s.lineKey) ?? [])];
        const other = [
          ...keysIn(lesson.tasks),
          ...keysIn(lesson.model?.example ?? {}),
          lesson.titleKey,
          lesson.atlasEntryKey,
          topic.titleKey,
        ];
        const texts = (key: string) =>
          (Object.entries(locales) as [string, unknown][]).flatMap(([lang, locale]) => {
            const text = lookup(locale, key);
            return typeof text === 'string' ? [[lang, text] as const] : [];
          });
        return [
          ...other.flatMap((key) =>
            texts(key)
              .filter(([, text]) => NAME_PLACEHOLDER.test(text))
              .map(([lang]) => `${where}: ${lang} ${key} — имя ребёнка вне реплик Tali`),
          ),
          ...tali.flatMap((key) =>
            texts(key)
              .filter(([, text]) => nameOutsideVocative(text))
              .map(([lang]) => `${where}: ${lang} ${key} — имя посреди фразы: только обращением в начале или конце, иначе озвучку без имени не собрать`),
          ),
        ];
      }),
  },

  skillRegistry: {
    // AUDIT.md С10. Опечатка в skill без реестра выглядела новым навыком. Навык не
    // встречается раньше полосы, где вводится, а его пререквизит той же полосы — введён в
    // корпусе раньше: иначе пример опирается на то, чего ребёнок ещё не видел.
    title: 'skill задания и примера записан в реестре domain/skills.ts, не раньше своей полосы; пререквизит той же полосы встречается в корпусе раньше',
    check: (corpus) => {
      const bad = registryProblems(SKILLS).map((p) => `реестр навыков: ${p}`);
      const seen = new Map<AgeBand, Set<string>>();
      for (const { lesson, where } of lessonsOf(corpus)) {
        const band = seen.get(lesson.band) ?? new Set<string>();
        seen.set(lesson.band, band);
        const used = [...(lesson.model ? [lesson.model.skill] : []), ...lesson.tasks.map((t) => t.skill)];
        for (const skill of new Set(used)) {
          const entry = SKILL_BY_ID.get(skill);
          if (!entry) {
            bad.push(`${where}: навыка ${skill} нет в реестре domain/skills.ts — запиши или исправь опечатку`);
            continue;
          }
          if (bandIndex(lesson.band) < bandIndex(entry.band)) {
            bad.push(`${where}: навык ${skill} вводится на ${entry.band}, а урок — ${lesson.band}`);
          }
          if (!band.has(skill)) {
            for (const p of entry.prerequisites) {
              const pre = SKILL_BY_ID.get(p);
              if (pre && pre.band === lesson.band && !band.has(p)) {
                bad.push(`${where}: навык ${skill} раньше своего пререквизита ${p}`);
              }
            }
          }
        }
        used.forEach((s) => band.add(s));
      }
      return bad;
    },
  },

  grade: {
    // Решение №40: полоса 9-10 — два класса, и ребёнок может начать с 4-го. Без пометки не
    // найти первую тему 4 класса; тема 3 класса после темы 4-го — сломанный порядок.
    title: 'у тем полосы 9-10 класс 3 или 4, темы 4 класса после тем 3-го; у тем других полос класса нет',
    check: (corpus) => {
      const bad: string[] = [];
      let fourth = false;
      for (const { file, topic } of corpus) {
        const band = topic.lessons[0]?.band;
        if (band !== '9-10') {
          if (topic.grade !== undefined) bad.push(`${file} ${topic.id}: класс у темы полосы ${band} — пишется только на 9-10`);
          continue;
        }
        if (topic.grade !== 3 && topic.grade !== 4) bad.push(`${file} ${topic.id}: у темы 9-10 нет класса (3 или 4)`);
        if (topic.grade === 4) fourth = true;
        else if (topic.grade === 3 && fourth) bad.push(`${file} ${topic.id}: тема 3 класса после темы 4-го`);
      }
      return bad;
    },
  },

  scatter56: {
    // `child-ux-specialist` 2026-10-02: больше пяти фигур вразброс пятилетка не пересчитает —
    // не видно, с какой начать и какие уже сосчитаны. Больше пяти — только рядом (`row`;
    // на экране ряд переносится на две строки «пять и остаток»).
    title: 'на 5-6 вразброс (scatter) — не больше пяти фигур',
    check: (corpus) =>
      formatTasksOf(corpus).flatMap(({ task, lesson, at }) =>
        lesson.band !== '5-6'
          ? []
          : mediaOf(task, true)
              .filter(({ m }) => m.layout === 'scatter' && (m.count ?? 0) > 5)
              .map(({ m, at: el }) => `${at}: ${el} — ${m.count} фигур вразброс, на 5-6 не больше пяти`),
      ),
  },

  choosePerLesson: {
    // Аудит 2026-10-06, А13: в пилоте choose было 7 из 12, а корпусной `chooseShare`
    // включается только с 50 заданий — первые уроки по образцу прошли бы, а потом упал бы
    // весь корпус. На урок — не больше половины заданий; пример не оценивается и не в счёт.
    title: 'choose в уроке — не больше половины заданий (пример не в счёт)',
    check: (corpus) =>
      lessonsOf(corpus).flatMap(({ lesson, where }) => {
        const choose = lesson.tasks.filter((t) => t.format === 'choose').length;
        const max = Math.floor(lesson.tasks.length / 2);
        return choose > max ? [`${where}: choose ${choose} из ${lesson.tasks.length}, не больше ${max}`] : [];
      }),
  },

  skillCountCap: {
    // А13: правило «в вариантах только 1–3» держалось на комментарии. Число фигур в
    // заданиях и примере навыка — не больше его `maxCount` в реестре.
    title: 'count в заданиях и примере навыка ≤ maxCount навыка в реестре; у навыка с count maxCount задан',
    check: (corpus) =>
      formatTasksOf(corpus).flatMap(({ task, at }) => {
        const counts = mediaOf(task, true).filter(({ m }) => m.count !== undefined);
        if (!counts.length) return [];
        const entry = SKILL_BY_ID.get(task.skill);
        if (!entry) return [];
        if (entry.maxCount === undefined) return [`${at}: у навыка ${task.skill} нет maxCount в реестре, а в задании есть count`];
        return counts
          .filter(({ m }) => (m.count ?? 0) > entry.maxCount!)
          .map(({ m, at: el }) => `${at}: ${el} — ${m.count} фигур, у навыка ${task.skill} не больше ${entry.maxCount}`);
      }),
  },

  answerRank: {
    // А11: в 5 из 7 choose пилота верный был самой большой кучкой — «жми самую большую»
    // давало почти 100%. Позиция не проверяется: варианты перемешиваются при показе
    // (REBUILD.md, «Ход урока — к экранам»). Только задания на счёт, где число есть у всех.
    title: 'choose на счёт: в уроке верный не всегда наибольший (наименьший); по теме наибольший — не больше половины',
    check: (corpus) => {
      const bad: string[] = [];
      const rank = (t: Task): 'max' | 'min' | 'mid' | null => {
        if (t.format !== 'choose' || !t.options.every((o) => o.count !== undefined)) return null;
        const right = t.options.find((o) => o.correct)?.count;
        const all = t.options.map((o) => o.count!);
        if (right === undefined) return null;
        return right === Math.max(...all) ? 'max' : right === Math.min(...all) ? 'min' : 'mid';
      };
      for (const { topic, file } of corpus) {
        const ranks: ('max' | 'min' | 'mid')[] = [];
        for (const lesson of topic.lessons) {
          const r = lesson.tasks.map(rank).filter((x): x is 'max' | 'min' | 'mid' => x !== null);
          ranks.push(...r);
          for (const one of ['max', 'min'] as const) {
            if (r.length >= 2 && r.every((x) => x === one)) {
              bad.push(`${file} ${topic.id}/${lesson.id}: во всех choose на счёт верный — ${one === 'max' ? 'наибольший' : 'наименьший'}`);
            }
          }
        }
        const max = ranks.filter((x) => x === 'max').length;
        if (ranks.length >= 2 && max > ranks.length / 2) {
          bad.push(`${file} ${topic.id}: верный — наибольший в ${max} из ${ranks.length} choose на счёт`);
        }
      }
      return bad;
    },
  },

  countConsistency: {
    // А13: та же причина ошибок, что и у силуэта, — ловится дёшево. Варианты choose с
    // разными числами; стимул с числом — столько же, сколько у верного; пары match — поровну;
    // в order позиция растёт вместе с числом.
    title: 'числа в задании согласованы: варианты разные, стимул = верный, пары поровну, order по возрастанию',
    check: (corpus) =>
      formatTasksOf(corpus).flatMap(({ task, at }) => {
        const bad: string[] = [];
        if (task.format === 'choose' && task.options.every((o) => o.count !== undefined)) {
          if (duplicates(task.options.map((o) => String(o.count))).length) bad.push(`${at}: у вариантов повторяется число`);
          const right = task.options.find((o) => o.correct);
          if (task.stimulus?.count !== undefined && right && right.count !== task.stimulus.count) {
            bad.push(`${at}: у стимула ${task.stimulus.count}, у верного ${right.count}`);
          }
        }
        if (task.format === 'match') {
          for (const p of task.pairs) {
            if (p.left.count !== undefined && p.right.count !== undefined && p.left.count !== p.right.count) {
              bad.push(`${at}: пара ${p.id} — ${p.left.count} и ${p.right.count}`);
            }
          }
        }
        if (task.format === 'order' && task.items.every((i) => i.count !== undefined)) {
          const sorted = [...task.items].sort((a, b) => a.position - b.position);
          if (sorted.some((x, i) => i > 0 && x.count! <= sorted[i - 1].count!)) bad.push(`${at}: позиции order не растут вместе с числом`);
        }
        return bad;
      }),
  },

  silhouette: {
    // А12: стимул «пять и остаток» и точки в рамке десятка при одном числе — один силуэт, и
    // навык счёта засчитывался за сравнение узоров. У стимула и верного варианта choose, у
    // сторон пары match силуэты разные (`domain/countLayout.ts` — то же, что рисует экран).
    title: 'стимул и верный вариант choose, стороны пары match — разного силуэта (count ≥ 2)',
    check: (corpus) =>
      formatTasksOf(corpus).flatMap(({ task, at }) => {
        const same = (a: Media, b: Media) =>
          a.shape !== undefined &&
          b.shape !== undefined &&
          a.count !== undefined &&
          b.count !== undefined &&
          a.count >= 2 &&
          countSilhouette(a.layout, a.count) === countSilhouette(b.layout, b.count);
        if (task.format === 'choose' && task.stimulus) {
          const right = task.options.find((o) => o.correct);
          return right && same(task.stimulus, right) ? [`${at}: стимул и верный вариант одного силуэта — найдётся без счёта`] : [];
        }
        if (task.format === 'match') {
          return task.pairs.filter((p) => same(p.left, p.right)).map((p) => `${at}: пара ${p.id} одного силуэта — соединится без счёта`);
        }
        return [];
      }),
  },

  promptInserts: {
    // А23 (`localization-qa`): «Найди букву {{t}}» — вставка на другом языке стоит
    // плейсхолдером, потому что в ky она на другом месте. Плейсхолдер вопроса — значит, у
    // задания есть вставка с языком; набор плейсхолдеров одинаков во всех локалях; после `}}`
    // не идёт буква — аффикс к вставке нельзя.
    title: 'плейсхолдеры вопроса — в inserts с lang, одинаковы во всех локалях, без аффикса; текст вставки не переводится; на 5-6 у вставки audioKey',
    check: (corpus, locales) =>
      formatTasksOf(corpus).flatMap(({ task, lesson, at }) => {
        const bad: string[] = [];
        const holders = (text: unknown) =>
          typeof text === 'string' ? [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort() : [];
        const byLang = (['ru', 'en', 'ky'] as const)
          .filter((l) => locales[l] !== undefined && lookup(locales[l], task.promptKey) !== undefined)
          .map((l) => ({ l, text: lookup(locales[l], task.promptKey), ph: holders(lookup(locales[l], task.promptKey)) }));
        const ru = byLang.find((x) => x.l === 'ru');
        for (const p of ru?.ph ?? []) {
          if (!task.inserts?.[p]?.lang) bad.push(`${at}: в вопросе {{${p}}}, а в inserts нет вставки с языком`);
        }
        for (const x of byLang) {
          if (ru && x.ph.join() !== ru.ph.join()) bad.push(`${at}: в ${x.l} плейсхолдеры ${x.ph.join(',')} вместо ${ru.ph.join(',')}`);
          if (typeof x.text === 'string' && AFFIX_AFTER_SLOT.test(x.text)) bad.push(`${at}: в ${x.l} к вставке приклеен аффикс`);
        }
        for (const [slot, ins] of Object.entries(task.inserts ?? {})) {
          // «Ж» — материал, а не перевод: текст вставки одинаков во всех локалях
          const texts = (['ru', 'en', 'ky'] as const)
            .filter((l) => locales[l] !== undefined && lookup(locales[l], ins.textKey) !== undefined)
            .map((l) => lookup(locales[l], ins.textKey));
          if (new Set(texts).size > 1) bad.push(`${at}: текст вставки ${slot} разный в локалях — материал не переводится`);
          if (lesson.band === '5-6' && !ins.audioKey) bad.push(`${at}: на 5-6 у вставки ${slot} нет audioKey — вопрос звучит голосом`);
        }
        return bad;
      }),
  },

  dice56: {
    // Временное, пока design-lead не определит, как выглядят точки 6–10 (рамка десятка —
    // шаг 6): на 5-6 точки «как на кубике» — до пяти.
    title: 'на 5-6 точки как на кубике (dice) — не больше пяти',
    check: (corpus) =>
      formatTasksOf(corpus).flatMap(({ task, lesson, at }) =>
        lesson.band !== '5-6'
          ? []
          : mediaOf(task, true)
              .filter(({ m }) => m.layout === 'dice' && (m.count ?? 0) > 5)
              .map(({ m, at: el }) => `${at}: ${el} — ${m.count} точек кубиком, на 5-6 не больше пяти`),
      ),
  },

  hook56: {
    // Решение №41 (`child-ux-specialist`): на 5-6 до первого действия не больше ≈10 с
    // слушания. Для урока с примером то же проверяет `model`; здесь — остальные уроки.
    title: `на 5-6 завязка урока без примера ≤ ${TEXT_LIMITS.hintChars} знаков по-русски (в других локалях ≤ ${BUBBLE_CHARS})`,
    check: (corpus, locales) =>
      lessonsOf(corpus).flatMap(({ lesson, where }) =>
        lesson.band === '5-6' && !lesson.model
          ? tooLong(locales, lesson.hook.lineKey, TEXT_LIMITS.hintChars, BUBBLE_CHARS, `${where}: завязка`)
          : [],
      ),
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
