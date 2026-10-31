/**
 * Ход задания в обычном уроке: ошибка, сужение, исход, отклик, проба переноса.
 * Спецификация — FORMATS.md («Ошибка»), SCREENS.md (2.4–2.6), решения методистов
 * по итогам проверки SCREENS.md.
 *
 * Здесь правила, а не экран: что сделать после первой ошибки, как засчитать
 * попытку, как на неё откликнуться и когда вернуть задание ещё раз.
 */
import type { Outcome } from './mastery';
import type { Task, TaskFormat } from '../types/task';

/** Случайный источник в [0, 1). */
export type Rng = () => number;

/**
 * Идёт ли задание в зачёт. Знакомство с форматом — нет: в нём допустимы две
 * альтернативы, а из двух угадывают в половине случаев. Такое задание не
 * двигает коробки навыка и не влияет на звёзды.
 */
export function countsTowardMastery(task: Task): boolean {
  return task.intro !== true;
}

// ---------------------------------------------------------------------------
// Первая ошибка: сузить или сразу показать
// ---------------------------------------------------------------------------

/** Состояние задания в момент первой ошибки. */
export type FirstErrorState =
  /** `choose`, `point`: сколько было альтернатив. */
  | { format: 'choose' | 'point'; alternatives: number }
  /**
   * `match`, `order`, `build` из фишек: сколько элементов стоит неверно. Верно
   * поставленные остаются на месте — стирать правильное значит наказывать за
   * правильное действие.
   */
  | { format: 'match' | 'order' | 'build'; wrong: number }
  /** `group`: сколько предметов разложено неверно. */
  | { format: 'group'; wrong: number }
  /** `build` с клавиатуры: сколько цифр в ответе. */
  | { format: 'keypad'; digits: number };

export type Narrowing =
  /** Вторая попытка: неверное возвращается, при `pin` одна часть закрепляется правильно. */
  | { kind: 'narrow'; pin: boolean }
  /** Сужать некуда: после сужения остался бы единственный ответ — показ. */
  | { kind: 'show' };

/**
 * Что сделать после первой ошибки.
 *
 * Правило методистов: сужение оставляет **не меньше двух возможных ответов**,
 * иначе вторая попытка ничего не измеряет — это уже не попытка, а показ. Поэтому
 * «сужать некуда» считается **после** сохранения верного и закрепления, а не по
 * исходному числу элементов.
 *
 * - `choose`, `point`: снимается выбранный неверный; из двух остаётся один — показ.
 * - `match`, `order`, `build`: закреплять первый неверный — только если после этого
 *   свободными останутся хотя бы двое; при двух неверных они просто возвращаются в
 *   лоток — два элемента на два места, выбор есть.
 * - `group`: у предмета всегда ≥ 2 корзины, выбор есть и у одного; закреплять —
 *   только если неверных ≥ 2.
 * - Клавиатура: из одной цифры угадывают в 10% случаев — вторая попытка значима;
 *   закрепляется верная первая цифра, если цифр больше одной.
 */
export function narrowAfterFirstError(s: FirstErrorState): Narrowing {
  switch (s.format) {
    case 'choose':
    case 'point':
      return s.alternatives - 1 >= 2 ? { kind: 'narrow', pin: false } : { kind: 'show' };
    case 'match':
    case 'order':
    case 'build':
      if (s.wrong < 2) return { kind: 'show' };
      return { kind: 'narrow', pin: s.wrong - 1 >= 2 };
    case 'group':
      if (s.wrong < 1) return { kind: 'show' };
      return { kind: 'narrow', pin: s.wrong >= 2 };
    case 'keypad':
      return { kind: 'narrow', pin: s.digits > 1 };
  }
}

// ---------------------------------------------------------------------------
// Исход и отклик
// ---------------------------------------------------------------------------

export type Attempt =
  /** С первой попытки. */
  | 'first'
  /** Со второй — после сужения, пока у ребёнка оставался выбор. */
  | 'second'
  /** Ответ показали — после второй ошибки или сразу, когда сужать некуда. */
  | 'shown';

/**
 * Исход для интервального повторения. `null` — задание в зачёт не идёт.
 * Проба переноса засчитывается отдельно: верный ответ в ней получен в той же
 * сессии после показа и коробку не двигает.
 */
export function outcomeOf(task: Task, attempt: Attempt, isTransferProbe = false): Outcome | null {
  if (!countsTowardMastery(task)) return null;
  if (isTransferProbe) return attempt === 'first' ? 'transfer_correct' : 'helped';
  if (attempt === 'first') return 'correct';
  if (attempt === 'second') return 'hinted';
  return 'helped';
}

/**
 * Отклик после задания — дифференцированный. Если после показа ребёнок получает
 * то же, что после верного ответа (радость Tali, звук, продвижение), закрепляется
 * путь «тап наугад → показ → тап → дальше»: он быстрее, чем подумать.
 *
 * - `celebrate` — сам с первой попытки: полный отклик;
 * - `warm` — со второй или в пробе переноса: тёплая похвала без праздника;
 * - `neutral` — ответ показали: «вот так», без праздника и без упрёка.
 */
export type Feedback = 'celebrate' | 'warm' | 'neutral';

export function feedbackFor(attempt: Attempt, isTransferProbe = false): Feedback {
  if (attempt === 'shown') return 'neutral';
  if (attempt === 'second' || isTransferProbe) return 'warm';
  return 'celebrate';
}

/**
 * Активный ответ после показа — обязательная часть коррекции: ребёнок не только
 * смотрит, но и делает. Tali повторяет вопрос, чтобы ответ был связан с вопросом,
 * а не только с указателем.
 *
 * - `choose`, `point`: тап по показанному ответу;
 * - составные: тап хотя бы по одному исправленному элементу (он озвучивается), и
 *   только потом «Дальше».
 */
export function activeResponseAfterShow(format: TaskFormat): 'tap_shown' | 'tap_corrected' {
  return format === 'choose' || format === 'point' ? 'tap_shown' : 'tap_corrected';
}

// ---------------------------------------------------------------------------
// Проба переноса
// ---------------------------------------------------------------------------

/**
 * Задание в очереди урока. `review` — повторение навыка из пройденного урока,
 * подмешанное сборкой (`lessonAssembly.assembleLesson`).
 */
export type QueuedTask = { task: Task; transferProbe?: true; review?: true };

/** Самая длинная серия заданий одного формата подряд. */
export function maxFormatRun(queue: readonly QueuedTask[]): number {
  let best = 0;
  let run = 0;
  queue.forEach((q, i) => {
    run = i > 0 && queue[i - 1].task.format === q.task.format ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** «Не больше двух одного формата подряд» (FORMATS.md, правила на корпус). */
export const MAX_FORMAT_RUN = 2;

/**
 * Через сколько других заданий возвращается показанное. «Через 1–2 других»:
 * так, чтобы ответ не лежал в рабочей памяти, но урок ещё не кончился.
 */
export const PROBE_AFTER = 2;

/**
 * Вставить пробу переноса после показанного ответа.
 *
 * Без неё последний ответ ребёнка на этот стимул в сессии получен с подсказкой,
 * и угадывание выгодно. Проба — то же задание через одно-два других, с
 * перемешанными позициями; не больше одной на урок; без сужения — первая ошибка
 * сразу ведёт к показу. Запрет FORMATS.md касается повтора того же экрана
 * **сразу**, отложенная проба с перемешанными позициями разрешена.
 *
 * Проба того же формата, что показанное задание, и через два других может встать
 * третьей подряд. Тогда она идёт через одно — «через одно-два» это допускает; если
 * серию не разбить и так, остаётся через два: проба важнее правила вёрстки урока.
 *
 * Возвращает новую очередь; если проба уже была или задание не в зачёт — прежнюю.
 */
export function scheduleTransferProbe(
  queue: readonly QueuedTask[],
  shownIndex: number,
  rng: Rng,
): QueuedTask[] {
  const shown = queue[shownIndex];
  if (!shown || shown.transferProbe || !countsTowardMastery(shown.task)) return [...queue];
  if (queue.some((q) => q.transferProbe)) return [...queue];
  const others = queue.length - shownIndex - 1;
  // Показ на последнем задании — пробы нет: сразу за показанным она ничего не измеряет
  // (FORMATS.md «на том же экране сразу — никогда»); навык и так уходит в первую коробку
  // и вернётся повторением.
  if (others === 0) return [...queue];
  const probe: QueuedTask = { task: reshuffle(shown.task, rng), transferProbe: true };
  const insertAt = (after: number) => {
    const at = shownIndex + 1 + after;
    return [...queue.slice(0, at), probe, ...queue.slice(at)];
  };
  // Проба повторения не встаёт последней: урок кончается своей темой, её и вписывают
  // в атлас. Тогда — перед последним заданием урока (при одном оставшемся — после него,
  // последней: иного места нет).
  if (shown.review && others > 0 && others <= PROBE_AFTER) return insertAt(others - 1);
  const preferred = insertAt(Math.min(PROBE_AFTER, others));
  const allowed = Math.max(MAX_FORMAT_RUN, maxFormatRun(queue));
  if (maxFormatRun(preferred) <= allowed || others < PROBE_AFTER) return preferred;
  const closer = insertAt(PROBE_AFTER - 1);
  return maxFormatRun(closer) <= allowed ? closer : preferred;
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // та же раскладка — это тот же экран; сдвигаем, если генератор её повторил
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift() as T);
  return out;
}

/**
 * То же задание с другими позициями. Сцена `point` и клавиатура неподвижны —
 * их не перемешать; для них проба — это просто повтор позже, без подсказки.
 */
export function reshuffle(task: Task, rng: Rng): Task {
  switch (task.format) {
    case 'choose':
      return { ...task, options: shuffled(task.options, rng) };
    case 'match':
      return { ...task, pairs: shuffled(task.pairs, rng) };
    case 'order':
      return { ...task, items: shuffled(task.items, rng) };
    case 'group':
      return { ...task, items: shuffled(task.items, rng) };
    case 'build':
      return task.fragments ? { ...task, fragments: shuffled(task.fragments, rng) } : task;
    case 'point':
      return task;
  }
}
