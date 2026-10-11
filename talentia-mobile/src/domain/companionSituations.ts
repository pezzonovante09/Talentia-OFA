/**
 * Ситуации, на которые Tali отвечает репликой.
 *
 * Оффлайн реплика берётся из заготовленного банка по ситуации; онлайн её
 * сочиняет ИИ и тут же озвучивает. Банк при этом не запасной путь, а основной:
 * он же отвечает, когда сеть есть, но медленная — ребёнок не станет ждать
 * ответа две секунды, и лучше мгновенная заготовка, чем запоздавшая
 * сочинённая.
 *
 * Ощущение живого собеседника даёт не новизна слов, а **уместность**. Ребёнку,
 * который только что взял три подряд, «Три подряд! Я так не умею» скажет
 * больше, чем сочинённое, но общее «Молодец». Поэтому банк разложен по
 * ситуациям, а не свален списком добрых фраз.
 */

import type { Region } from '../types/task';

export const SITUATIONS = [
  /* вход */
  'lesson-start-first',        // урок открыт впервые
  'lesson-start-repeat',       // урок проходят заново
  'return-after-break',        // перерыв три дня и больше
  'new-topic',                 // открылась новая тема
  'new-region',                // открылся новый регион

  /* по ходу урока */
  'correct-first',             // первый верный ответ в уроке
  'correct-streak-2',
  'correct-streak-3plus',
  'correct-after-hint',        // верно со второй попытки
  'correct-previously-failed', // раньше этот навык не давался — самая ценная реплика
  'error-first',               // первая ошибка, задание сузится
  'error-second',              // ответ показали

  /* поведение, а не ответ */
  'idle',                      // тридцать секунд без касания
  'rapid-guessing',            // три ответа подряд быстрее двух секунд
  'replay-many',               // динамик нажали больше трёх раз

  /* итог */
  'lesson-done-3',
  'lesson-done-2',
  'lesson-done-1',

  /* вопрос, на который оффлайн ответить нечем */
  'cannot-answer-offline',
] as const;

export type Situation = (typeof SITUATIONS)[number];

/**
 * Подстановки в реплику. Без них банк звучит как автоответчик: «Сколько их?»
 * вместо «Сколько там ягод, Айым?».
 *
 * Предмет и регион — не готовой строкой, а id: строка ломала падежи в ru («ягода» вместо
 * «ягод») и аффиксы в ky (аудит 2026-10-06, А15). Форма берётся из словаря по конструкции
 * реплики (`objectFormKey`, `regionPhraseKey`); правила — TALI.md, «Подстановки».
 */
export type Slots = {
  /** Только обращением через запятую, в именительном; аффикс к имени нельзя. */
  name?: string;
  /**
   * Число. С предметом — не голым, а внутри формы предмета `{{object_count}}`
   * (`content.objects.<id>.count_*`). Голый `{{count}}` — только когда число стоит одно, в
   * именительном, и только в plural-ключе; «{{count}} + слово» и `{{count}}` рядом с
   * `{{object_count}}` — нельзя (TALI.md, «Подстановки»).
   */
  count?: number;
  /** id предмета из словаря `content.objects.<id>`. */
  object?: string;
  region?: Region['id'];
};

/**
 * Конструкции, под которые у предмета есть готовые формы — закрытый список: в ky аффиксы не
 * генерируются, у каждого предмета ряд записанных форм (их проверяет носитель).
 * - `count` — число с предметом одной подстановкой: plural-набор `count_one / _few / _many /
 *   _other` (en, ky — `_one / _other`) с `{{count}}` внутри: «{{count}} ягода / ягоды / ягод»,
 *   ky «{{count}} жемиш». Только в именительной позиции («Вот …»); после «найди / возьми»
 *   число не ставится;
 * - `howMany` — после «сколько»: «сколько ягод» (в ky после «канча» — ед. ч.);
 * - `acc` — «найди / возьми …»: «найди ягоду»;
 * - `nom` — именительный: «вот ягода».
 */
export const OBJECT_CONSTRUCTIONS = ['count', 'howMany', 'acc', 'nom'] as const;

/**
 * Имена подстановок в реплике — закрытый список (TALI.md, «Подстановки»; гард
 * `companionLines.test.ts`): `{{obj}}` или `{{item}}` вместо них не пройдут.
 */
export const COMPANION_SLOTS = [
  'name',
  'count',
  ...OBJECT_CONSTRUCTIONS.map((c) => `object_${c}` as const),
  'region_in',
  'region_to',
] as const;
export type ObjectConstruction = (typeof OBJECT_CONSTRUCTIONS)[number];

/** Ключ формы предмета под конструкцию: `content.objects.<id>.<конструкция>`. */
export function objectFormKey(object: string, construction: ObjectConstruction): string {
  return `content.objects.${object}.${construction}`;
}

/** Регион — готовой фразой «где» (`in`, «на Побережье слов») или «куда» (`to`), а не падежом. */
export function regionPhraseKey(region: Region['id'], phrase: 'in' | 'to'): string {
  return `content.regions.${region}.${phrase}`;
}

/** Сколько вариантов держать на ситуацию, чтобы не повторяться заметно. */
export const VARIANTS_PER_SITUATION = 4;

/**
 * Выбор реплики без заметных повторов: вариант не звучит снова, пока не
 * прозвучали все остальные в своей ситуации. Обычная случайность даёт
 * повторы подряд, а ребёнок их замечает мгновенно и перестаёт верить
 * персонажу.
 */
export function pickVariant(used: number[], total: number, random = Math.random): number {
  const unused = Array.from({ length: total }, (_, i) => i).filter((i) => !used.includes(i));
  const pool = unused.length > 0 ? unused : Array.from({ length: total }, (_, i) => i);
  return pool[Math.floor(random() * pool.length)];
}

/** Ключ локали реплики: `companion.<ситуация>.<номер варианта>`. */
export function lineKey(s: Situation, variant: number): string {
  return `companion.${s}.${variant}`;
}

/**
 * Как Tali обращается к ребёнку (решение владельца №71, условия `child-privacy-compliance`
 * 2026-10-07). Родителя спрашивают не «пол», а форму речи с примером: «ты справилась» /
 * «ты справился» / «у тебя получилось». Хранится **только на устройстве**: не уходит ни в
 * облако, ни в ИИ, ни в телеметрию, ни в отчёт и экспорт; удаляется вместе с профилем.
 * Читает её только выбор реплики — подбирать по ней темы, задания или цвета нельзя.
 */
export type AddressForm = 'feminine' | 'masculine' | 'neutral';

/** «Не указывать» — равноправный вариант и значение по умолчанию. */
export const DEFAULT_ADDRESS_FORM: AddressForm = 'neutral';

/** Настройки речи Tali для ребёнка — на устройстве, рядом с языковыми (`ChildLanguageSettings`). */
export type ChildSpeechSettings = {
  addressForm: AddressForm;
};

const FORM_SUFFIX: Record<Exclude<AddressForm, 'neutral'>, string> = { feminine: 'f', masculine: 'm' };

/**
 * Ключ реплики с учётом формы обращения. Основная реплика — безродовая
 * (`companion.<ситуация>.<n>`), она есть всегда; родовая (`…_f`, `…_m`) — необязательная
 * надстройка там, где русская фраза о ребёнке без рода звучит натянуто. Нет родовой — звучит
 * основная. В en и ky рода во 2-м лице нет: там родовых ключей не заводят.
 */
export function lineKeyFor(s: Situation, variant: number, form: AddressForm, exists: (key: string) => boolean): string {
  const base = lineKey(s, variant);
  if (form === 'neutral') return base;
  // суффиксом, как context в i18next: точкой нельзя — в JSON ключ `<n>` уже строка
  const gendered = `${base}_${FORM_SUFFIX[form]}`;
  return exists(gendered) ? gendered : base;
}
