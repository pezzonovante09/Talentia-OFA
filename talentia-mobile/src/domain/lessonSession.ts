/**
 * Ход урока — оркестратор (взгляд ментора 2026-10-23, К1; REBUILD.md, «Ход урока — к экранам»).
 *
 * Чистый редьюсер без I/O: `startLessonSession` собирает очередь, `applyLessonEvent` двигает
 * состояние по событиям экрана, `lessonStepOf` говорит экрану, что показать, `lessonCommitOf`
 * собирает итог для `services/local/commit.ts` (`commitLesson`). Правила хода — в `lessonFlow.ts`
 * (сужение, исход, отклик, проба переноса), сборка и итог — в `lessonAssembly.ts`, коробки — в
 * `mastery.ts`; здесь только их порядок. Экран не склеивает их сам: иначе логика уезжает в
 * компоненты, как в прежнем приложении.
 *
 * Состояние — plain JSON: в режиме без записи живёт в памяти, с `account_local` его можно
 * сохранить снимком и продолжить урок, который свернули (ключ `child_state` — новой миграцией,
 * когда понадобится). Случайность — `seeded` из `abaRandom.ts`: состояние генератора — число в
 * снимке, после восстановления проба переноса и перемешивание те же.
 *
 * Что здесь есть из отложенного списка: варианты перемешаны **уже при первом показе** (не только в
 * пробе и повторении); полная или короткая форма примера по прошлому прохождению (№29); первая
 * встреча ребёнка с составным форматом — демонстрация половины действия (№35, по истории
 * ребёнка, один раз на формат). Чего нет и не будет здесь: таймауты ведомого тапа 5 и 10 с,
 * подсветка предметов в такт счёту, метки касаний (№83) — это экран и его таймеры; полный пример
 * при откате навыка в первую коробку (№27) — ждёт даты показа в `SkillState`, отдельным шагом.
 *
 * Время — только из событий (`at`, ISO): домен часов не читает. Секунды на задание считаются от
 * события, которое открыло задание, до «Дальше»; потолок на задание — при подсчёте отчёта
 * (`parentReport.TASK_SECONDS_CAP`).
 */
import { seeded } from './abaRandom';
import {
  assembleLesson,
  assembleReview,
  finishLesson,
  finishReview,
  recordInAtlas,
  type AtlasEntry,
  type Played,
  type ReviewPool,
} from './lessonAssembly';
import {
  activeResponseAfterShow,
  countsTowardMastery,
  feedbackFor,
  narrowAfterFirstError,
  reshuffle,
  scheduleTransferProbe,
  type Attempt,
  type Feedback,
  type FirstErrorState,
  type Narrowing,
  type QueuedTask,
} from './lessonFlow';
import { starsForLesson, type SkillState } from './mastery';
import { REVIEW_LESSON_ID, type LessonRun } from './parentReport';
import type { AgeBand, BuildTask, Lesson, Task, TaskFormat } from '../types/task';

// ---------------------------------------------------------------------------
// Ответ ребёнка и его оценка
// ---------------------------------------------------------------------------

/**
 * Что ребёнок собрал на экране к моменту «Проверить». Идентификаторы — из задания; у `match`
 * обе стороны адресуются id **пары**, которой они принадлежат; у `build` с фишками — тексты
 * фишек в порядке строки ответа (домен не знает локали, сравнивает с `answer` как текст); с
 * клавиатуры — одна часть с цифрами.
 */
export type LessonAnswer =
  | { format: 'choose'; optionId: string }
  | { format: 'point'; targetId: string }
  | { format: 'match'; pairs: { left: string; right: string }[] }
  | { format: 'order'; slots: string[] }
  | { format: 'group'; placements: Record<string, string> }
  | { format: 'build'; parts: string[] };

/**
 * `mirrored` — ряд `order` верен справа налево (от трёх мест; на двух зеркало от ошибки не отличить).
 * На 5-6 — ошибка механики, а не навыка (№151): оркестратор поправляет мягко, попытка не сгорает.
 */
export type Evaluation = { correct: boolean; firstError: FirstErrorState; mirrored?: boolean };

const norm = (s: string) => s.trim().toLocaleLowerCase('ru');

/** Все элементы — из набора, без повторов. */
function complete(ids: readonly string[], known: readonly string[], what: string): void {
  const set = new Set(known);
  assert(ids.length === known.length && new Set(ids).size === ids.length && ids.every((id) => set.has(id)), what);
}

/**
 * Верно ли, и если нет — что сужать. `removed` — варианты `choose` / `point`, снятые первой
 * ошибкой: альтернатив для второго сужения меньше.
 *
 * Неполный или недопустимый ответ — ответ другого формата, незаполненное место, снятый вариант,
 * пустая строка — **ошибка программы, а не ребёнка** (`LessonSessionError`): его держит экран
 * («Проверить» недоступно, SCREENS.md 1.5), и сжечь им попытку или откатить навык нельзя —
 * ошибка механики в зачёт навыка не идёт (SCREENS.md 3.3).
 */
export function evaluateAnswer(task: Task, answer: LessonAnswer, removed: readonly string[] = []): Evaluation {
  assert(answer.format === task.format, `Ответ ${answer.format} на задание ${task.format}`);
  switch (task.format) {
    case 'choose': {
      const a = answer as Extract<LessonAnswer, { format: 'choose' }>;
      const option = task.options.find((o) => o.id === a.optionId);
      assert(option !== undefined && !removed.includes(a.optionId), `choose: вариант ${a.optionId} недоступен`);
      return { correct: option!.correct, firstError: { format: 'choose', alternatives: task.options.length - removed.length } };
    }
    case 'point': {
      const a = answer as Extract<LessonAnswer, { format: 'point' }>;
      const target = task.targets.find((t) => t.id === a.targetId);
      assert(target !== undefined && !removed.includes(a.targetId), `point: зона ${a.targetId} недоступна`);
      return { correct: target!.correct, firstError: { format: 'point', alternatives: task.targets.length - removed.length } };
    }
    case 'match': {
      const a = answer as Extract<LessonAnswer, { format: 'match' }>;
      const ids = task.pairs.map((p) => p.id);
      complete(a.pairs.map((p) => p.left), ids, 'match: не все пары собраны');
      complete(a.pairs.map((p) => p.right), ids, 'match: не все пары собраны');
      const placed = new Map(a.pairs.map((p) => [p.left, p.right]));
      const wrong = task.pairs.filter((p) => placed.get(p.id) !== p.id).length;
      return { correct: wrong === 0, firstError: { format: 'match', wrong } };
    }
    case 'order': {
      const a = answer as Extract<LessonAnswer, { format: 'order' }>;
      complete(a.slots, task.items.map((i) => i.id), 'order: не все места заполнены');
      const wrong = task.items.filter((i) => a.slots[i.position] !== i.id).length;
      const n = task.items.length;
      const mirrored = wrong > 0 && n >= 3 && task.items.every((i) => a.slots[n - 1 - i.position] === i.id);
      return { correct: wrong === 0, firstError: { format: 'order', wrong }, ...(mirrored ? { mirrored } : {}) };
    }
    case 'group': {
      const a = answer as Extract<LessonAnswer, { format: 'group' }>;
      const groups = new Set(task.groups.map((g) => g.id));
      assert(task.items.every((i) => groups.has(a.placements[i.id])), 'group: не все предметы разложены');
      const wrong = task.items.filter((i) => a.placements[i.id] !== i.groupId).length;
      return { correct: wrong === 0, firstError: { format: 'group', wrong } };
    }
    case 'build':
      return evaluateBuild(task, (answer as Extract<LessonAnswer, { format: 'build' }>).parts);
  }
}

/**
 * `build`: с клавиатуры — одна часть, сравнение цифр; из фишек — верное начало остаётся, всё
 * с первой ошибки неверно (SCREENS.md 3.6).
 */
function evaluateBuild(task: BuildTask, parts: readonly string[]): Evaluation {
  const expected = norm(task.answer);
  assert(parts.length > 0 && parts.every((p) => norm(p).length > 0), 'build: пустой ответ');
  if (!task.fragments) {
    const typed = norm(parts.join(''));
    assert(/^\d+$/.test(typed), 'build: с клавиатуры — только цифры');
    return { correct: typed === expected, firstError: { format: 'keypad', digits: task.answer.length } };
  }
  const assembled = norm(parts.join(''));
  if (assembled === expected) return { correct: true, firstError: { format: 'build', wrong: 0 } };
  let prefix = '';
  let firstWrong = parts.length;
  for (let i = 0; i < parts.length; i += 1) {
    prefix += norm(parts[i]);
    if (!expected.startsWith(prefix)) {
      firstWrong = i;
      break;
    }
  }
  // собрано меньше, чем нужно, без единой неверной фишки — неверна «пустота»: считаем одну
  const wrong = Math.max(1, parts.length - firstWrong);
  return { correct: false, firstError: { format: 'build', wrong } };
}

// ---------------------------------------------------------------------------
// Состояние
// ---------------------------------------------------------------------------

/** Форма разобранного примера: полная, короткая («теперь ты») или примера нет (FORMATS.md, №29). */
export type ModelForm = 'full' | 'short';

/** Текущее задание: на чём остановились. */
export type TaskProgress = {
  /** Событие, открывшее задание, — от него считаются секунды. */
  startedAt: string;
  attempt: Attempt;
  /** `answer` — ждём «Проверить»; `active_response` — ответ показан, ждём тап ребёнка; `next` — ждём «Дальше». */
  stage: 'answer' | 'active_response' | 'next';
  /** Что сделала первая ошибка; `null` до неё. */
  narrowing: Narrowing | null;
  /** Снятые варианты `choose` / `point`. */
  removed: string[];
  /**
   * Порядок нижнего ряда `match` — id пар (SCREENS.md 3.3: верхний ряд — левые стороны в порядке
   * `pairs`, нижний — правые). В данных задания его нет; перемешан здесь, из семени, не совпадает
   * с верхним. У других форматов — `null`.
   */
  rightOrder: string[] | null;
  /**
   * «Остались» и «закреплён» (SCREENS.md 2.5) — посчитаны **один раз** по первому неверному ответу и
   * дальше не меняются: после показа экран подсвечивает и принимает все исправленные элементы, а
   * булавка стоит там, где встала после первой ошибки (разбор 2026-10-31, вопрос 73). До ошибки пусто.
   */
  kept: string[];
  pinned: string | null;
  /** Первая встреча ребёнка с составным форматом: Tali делает первую половину действия (№35). Только до первого «Проверить». */
  demo: boolean;
  /**
   * Зеркальный ряд `order` на 5-6 (№151): `true` — последний «Проверить» был поправлен мягко, экран
   * говорит «начинаем отсюда» и собирает заново; до следующего «Проверить». Поправка — одна на
   * задание (`mirrorUsed`): второй зеркальный ряд — обычная ошибка, иначе круг без конца.
   * Необязательны: снимки до №151 их не знают.
   */
  mirrored?: boolean;
  mirrorUsed?: boolean;
};

export type LessonSessionState = {
  v: 1;
  childId: string;
  lessonId: string;
  band: AgeBand;
  lessonNumber: number;
  /** Локальный день устройства `YYYY-MM-DD` — срок повторения и по дням. */
  day: string;
  startedAt: string;
  /** Состояние генератора: после восстановления те же перемешивания. */
  rngSeed: number;
  phase: 'hook' | 'model' | 'task' | 'done';
  model: { form: ModelForm; step: number; steps: number } | null;
  queue: QueuedTask[];
  /** Сегментов прогресса: задано в начале и не меняется, проба переноса сегмента не добавляет (SCREENS.md 2.7). */
  segments: number;
  index: number;
  task: TaskProgress | null;
  played: Played[];
  taskSeconds: number[];
  /** Форматы, которые ребёнок уже видел (история + этот урок) — для демонстрации №35. */
  formatsSeen: TaskFormat[];
};

export type StartLessonInput = {
  childId: string;
  lesson: Lesson;
  skills: readonly SkillState[];
  /** Текущее значение `lessonCounter` ребёнка — номер этого урока. */
  lessonNumber: number;
  day: string;
  /** Событие начала — ISO. */
  startedAt: string;
  pool: ReviewPool;
  regionSkills?: ReadonlySet<string>;
  /** Семя генератора — случайное число от экрана (или из снимка). */
  seed: number;
  /** Как кончилось прошлое прохождение этого урока: короткая форма примера — только после успешного (№29). */
  priorRun: 'none' | 'completed' | 'abandoned';
  /** Составные форматы, которые ребёнок уже встречал (по истории, не по уроку; №35). */
  formatsSeen?: readonly TaskFormat[];
};

const COMPOSITE: readonly TaskFormat[] = ['match', 'order', 'group'];

export class LessonSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LessonSessionError';
  }
}

/**
 * Начало урока: очередь собрана (`assembleLesson`), варианты заданий урока перемешаны уже сейчас
 * (повторения перемешивает сборка), форма примера выбрана. Фаза — завязка.
 */
export function startLessonSession(input: StartLessonInput): LessonSessionState {
  const { rng, seed } = seeded(input.seed);
  const assembled = assembleLesson({
    lesson: input.lesson,
    skills: input.skills,
    lessonNumber: input.lessonNumber,
    day: input.day,
    pool: input.pool,
    regionSkills: input.regionSkills,
    rng,
  });
  const queue = assembled.map((q) => (q.review ? q : { ...q, task: reshuffle(q.task, rng) }));
  const model = input.lesson.model
    ? {
        form: (input.priorRun === 'completed' ? 'short' : 'full') as ModelForm,
        step: input.priorRun === 'completed' ? input.lesson.model.steps.length : 0,
        steps: input.lesson.model.steps.length,
      }
    : null;
  const formatsSeen = new Set(input.formatsSeen ?? []);
  if (input.lesson.model) formatsSeen.add(input.lesson.model.example.format);
  return {
    v: 1,
    childId: input.childId,
    lessonId: input.lesson.id,
    band: input.lesson.band,
    lessonNumber: input.lessonNumber,
    day: input.day,
    startedAt: input.startedAt,
    rngSeed: seed(),
    phase: 'hook',
    model,
    queue,
    segments: queue.length,
    index: 0,
    task: null,
    played: [],
    taskSeconds: [],
    formatsSeen: [...formatsSeen],
  };
}

/** Сессия повторения с узла карты, не урок (`REVIEW_LESSON_ID`). */
export const isReviewSession = (s: Pick<LessonSessionState, 'lessonId'>): boolean => s.lessonId === REVIEW_LESSON_ID;

export type StartReviewInput = {
  childId: string;
  band: AgeBand;
  skills: readonly SkillState[];
  lessonNumber: number;
  day: string;
  startedAt: string;
  /** Пул — все пройденные уроки всех регионов (`buildReviewPool`). */
  pool: ReviewPool;
  seed: number;
  formatsSeen?: readonly TaskFormat[];
};

/**
 * Начало сессии повторения (вопрос 56): очередь — только повторения (`assembleReview`), завязки и
 * примера нет, первое задание открыто сразу. Редьюсер и `lessonStepOf` те же, что у урока. Пустая
 * очередь даёт `phase: 'done'` — стор такую сессию не открывает.
 */
export function startReviewSession(input: StartReviewInput): LessonSessionState {
  const { rng, seed } = seeded(input.seed);
  const queue = assembleReview({ band: input.band, skills: input.skills, lessonNumber: input.lessonNumber, day: input.day, pool: input.pool, rng });
  const base: LessonSessionState = {
    v: 1,
    childId: input.childId,
    lessonId: REVIEW_LESSON_ID,
    band: input.band,
    lessonNumber: input.lessonNumber,
    day: input.day,
    startedAt: input.startedAt,
    rngSeed: seed(),
    phase: 'task',
    model: null,
    queue,
    segments: queue.length,
    index: 0,
    task: null,
    played: [],
    taskSeconds: [],
    formatsSeen: [...(input.formatsSeen ?? [])],
  };
  return openTask(base, input.startedAt);
}

// ---------------------------------------------------------------------------
// События
// ---------------------------------------------------------------------------

export type LessonEvent =
  /** Завязка прозвучала (или её пропустили тапом). */
  | { type: 'hook_done'; at: string }
  /** Шаг примера показан; после последнего — «теперь ты». */
  | { type: 'model_step'; at: string }
  /** Ведомый тап сделан (или Tali нажал сам по таймауту экрана). */
  | { type: 'model_done'; at: string }
  /** «Проверить». */
  | { type: 'answer'; answer: LessonAnswer; at: string }
  /** После показа ребёнок тапнул показанный или исправленный элемент. */
  | { type: 'active_response'; at: string }
  /** «Дальше». */
  | { type: 'next'; at: string };

function openTask(state: LessonSessionState, at: string): LessonSessionState {
  if (state.index >= state.queue.length) return { ...state, phase: 'done', task: null };
  const { task } = state.queue[state.index];
  const demo = COMPOSITE.includes(task.format) && !state.formatsSeen.includes(task.format);
  let rightOrder: string[] | null = null;
  let rngSeed = state.rngSeed;
  if (task.format === 'match') {
    const { rng, seed } = seeded(state.rngSeed);
    rightOrder = shuffleDistinct(task.pairs.map((p) => p.id), rng);
    rngSeed = seed();
  }
  return {
    ...state,
    rngSeed,
    phase: 'task',
    task: { startedAt: at, attempt: 'first', stage: 'answer', narrowing: null, removed: [], rightOrder, kept: [], pinned: null, demo },
  };
}

/** Перемешать так, чтобы раскладка не совпала с исходной (n ≥ 2): иначе ответ читается как «та же колонка». */
function shuffleDistinct<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift() as T);
  return out;
}

function seconds(from: string, to: string): number {
  const ms = Date.parse(to) - Date.parse(from);
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : 0;
}

function assert(ok: boolean, what: string): void {
  if (!ok) throw new LessonSessionError(what);
}

/** Шаг состояния по событию. Событие не по фазе — ошибка программы, а не ребёнка. */
export function applyLessonEvent(state: LessonSessionState, event: LessonEvent): LessonSessionState {
  switch (event.type) {
    case 'hook_done': {
      assert(state.phase === 'hook', `hook_done в фазе ${state.phase}`);
      return state.model ? { ...state, phase: 'model' } : openTask(state, event.at);
    }
    case 'model_step': {
      assert(state.phase === 'model' && state.model !== null, `model_step в фазе ${state.phase}`);
      const m = state.model!;
      return { ...state, model: { ...m, step: Math.min(m.steps, m.step + 1) } };
    }
    case 'model_done': {
      assert(state.phase === 'model' && state.model !== null, `model_done в фазе ${state.phase}`);
      return openTask({ ...state, model: { ...state.model!, step: state.model!.steps } }, event.at);
    }
    case 'answer':
      return onAnswer(state, event.answer);
    case 'active_response': {
      assert(state.phase === 'task' && state.task?.stage === 'active_response', 'active_response не после показа');
      return { ...state, task: { ...state.task!, stage: 'next' } };
    }
    case 'next':
      return onNext(state, event.at);
  }
}

function onAnswer(state: LessonSessionState, answer: LessonAnswer): LessonSessionState {
  assert(state.phase === 'task' && state.task?.stage === 'answer', '«Проверить» не в ожидании ответа');
  const progress = state.task!;
  const queued = state.queue[state.index];
  const { correct, firstError, mirrored } = evaluateAnswer(queued.task, answer, progress.removed);
  const formatsSeen = state.formatsSeen.includes(queued.task.format)
    ? state.formatsSeen
    : [...state.formatsSeen, queued.task.format];

  const checked: TaskProgress = { ...progress, demo: false, mirrored: false };
  if (correct) return { ...state, formatsSeen, task: { ...checked, stage: 'next' } };

  // зеркальный ряд на 5-6 — механика, не навык (№151): ответ не засчитан, попытка та же
  if (mirrored && state.band === '5-6' && !progress.mirrorUsed) {
    return { ...state, formatsSeen, task: { ...progress, demo: false, mirrored: true, mirrorUsed: true } };
  }

  // проба переноса — без сужения: первая ошибка сразу ведёт к показу (SCREENS.md 2.7)
  if (progress.attempt === 'first' && !queued.transferProbe) {
    const narrowing = narrowAfterFirstError(firstError);
    if (narrowing.kind === 'narrow') {
      const removed =
        answer.format === 'choose' ? [...progress.removed, answer.optionId]
        : answer.format === 'point' ? [...progress.removed, answer.targetId]
        : progress.removed;
      return { ...state, formatsSeen, task: { ...checked, attempt: 'second', narrowing, removed, ...keptAndPinned(queued.task, answer, narrowing.pin) } };
    }
    return { ...state, formatsSeen, task: { ...checked, attempt: 'shown', narrowing, stage: 'active_response' } };
  }
  return { ...state, formatsSeen, task: { ...checked, attempt: 'shown', stage: 'active_response' } };
}

function onNext(state: LessonSessionState, at: string): LessonSessionState {
  assert(state.phase === 'task' && state.task?.stage === 'next', '«Дальше» не после итога задания');
  const progress = state.task!;
  const queued = state.queue[state.index];
  const played = [...state.played, { queued, attempt: progress.attempt }];
  const taskSeconds = [...state.taskSeconds, seconds(progress.startedAt, at)];

  let queue = state.queue;
  let rngSeed = state.rngSeed;
  // в сессии повторения пробы переноса нет: её длину держит потолок внимания, а показанный навык и так
  // уходит в первую коробку и вернётся следующим повторением
  if (progress.attempt === 'shown' && !isReviewSession(state)) {
    const { rng, seed } = seeded(state.rngSeed);
    queue = scheduleTransferProbe(state.queue, state.index, rng);
    rngSeed = seed();
  }
  return openTask({ ...state, played, taskSeconds, queue, rngSeed, index: state.index + 1, task: null }, at);
}

// ---------------------------------------------------------------------------
// Что показать
// ---------------------------------------------------------------------------

export type LessonStep =
  | { kind: 'hook' }
  /** `nowYou` — последний шаг, ведомый тап; `step` — индекс реплики Tali до него. */
  | { kind: 'model'; form: ModelForm; step: number; nowYou: boolean }
  | {
      kind: 'task';
      task: Task;
      transferProbe: boolean;
      review: boolean;
      /** Сегмент прогресса (от нуля) и сколько их всего. */
      progress: { segment: number; total: number };
      attempt: Attempt;
      stage: TaskProgress['stage'];
      narrowing: Narrowing | null;
      removed: readonly string[];
      /** Нижний ряд `match` — id пар; у других форматов `null`. */
      rightOrder: readonly string[] | null;
      /**
       * После первой ошибки в составном формате (SCREENS.md 2.5): что стоит верно и остаётся
       * (`kept` — id пар / предметов, у `build` — тексты верного начала), и что закреплено
       * правильно (`pinned`), если сужение закрепляет. До ошибки — пусто и `null`.
       */
      kept: readonly string[];
      pinned: string | null;
      demo: boolean;
      /** Показанный ответ после разблокировки помечен треугольником — на 5-6 (№32); с 7 лет подсветка снимается. */
      answerCue: boolean;
      /** Что тапнуть после показа — пока ждём `active_response`. */
      activeResponse: 'tap_shown' | 'tap_corrected' | null;
      /** Отклик — когда задание решено и ждём «Дальше». */
      feedback: Feedback | null;
      /** Последний «Проверить» — зеркальный ряд `order` на 5-6, поправлен мягко (№151). */
      mirrored: boolean;
      /** Идёт ли задание в зачёт — для отклика, не для экрана прогресса. */
      counts: boolean;
    }
  | { kind: 'done' };

/**
 * Что остаётся после первой ошибки и что закреплено (SCREENS.md 2.5). «Первый» — в порядке
 * чтения, то есть в порядке элементов задания; у `build` с фишками — следующая по тексту ответа
 * фишка, у клавиатуры — верная первая цифра.
 */
function keptAndPinned(task: Task, a: LessonAnswer, pin: boolean): { kept: string[]; pinned: string | null } {
  const none = { kept: [] as string[], pinned: null };
  if (a.format !== task.format) return none;
  switch (task.format) {
    case 'choose':
    case 'point':
      return none;
    case 'match': {
      const placed = new Map((a as Extract<LessonAnswer, { format: 'match' }>).pairs.map((x) => [x.left, x.right]));
      const kept = task.pairs.filter((x) => placed.get(x.id) === x.id).map((x) => x.id);
      const firstWrong = task.pairs.find((x) => placed.get(x.id) !== x.id);
      return { kept, pinned: pin && firstWrong ? firstWrong.id : null };
    }
    case 'order': {
      const slots = (a as Extract<LessonAnswer, { format: 'order' }>).slots;
      const sorted = [...task.items].sort((x, y) => x.position - y.position);
      const kept = sorted.filter((i) => slots[i.position] === i.id).map((i) => i.id);
      const firstWrong = sorted.find((i) => slots[i.position] !== i.id);
      return { kept, pinned: pin && firstWrong ? firstWrong.id : null };
    }
    case 'group': {
      const placements = (a as Extract<LessonAnswer, { format: 'group' }>).placements;
      const kept = task.items.filter((i) => placements[i.id] === i.groupId).map((i) => i.id);
      const firstWrong = task.items.find((i) => placements[i.id] !== i.groupId);
      return { kept, pinned: pin && firstWrong ? firstWrong.id : null };
    }
    case 'build': {
      const parts = (a as Extract<LessonAnswer, { format: 'build' }>).parts;
      const expected = norm(task.answer);
      if (!task.fragments) return { kept: [], pinned: pin ? task.answer[0] : null };
      const kept: string[] = [];
      let prefix = '';
      for (const part of parts) {
        if (!expected.startsWith(prefix + norm(part))) break;
        prefix += norm(part);
        kept.push(part);
      }
      const rest = expected.slice(prefix.length);
      const next = pin ? task.fragments.find((f) => norm(f.labelKey).length > 0 && rest.startsWith(norm(f.labelKey))) : undefined;
      return { kept, pinned: next ? next.id : null };
    }
  }
}

export function lessonStepOf(state: LessonSessionState): LessonStep {
  switch (state.phase) {
    case 'hook':
      return { kind: 'hook' };
    case 'model': {
      const m = state.model!;
      return { kind: 'model', form: m.form, step: m.step, nowYou: m.step >= m.steps };
    }
    case 'done':
      return { kind: 'done' };
    case 'task': {
      const queued = state.queue[state.index];
      const p = state.task!;
      const probe = queued.transferProbe === true;
      const playedSegments = state.played.filter((x) => !x.queued.transferProbe).length;
      return {
        kind: 'task',
        task: queued.task,
        transferProbe: probe,
        review: queued.review === true,
        progress: { segment: Math.min(state.segments - 1, playedSegments), total: state.segments },
        attempt: p.attempt,
        stage: p.stage,
        narrowing: p.narrowing,
        removed: p.removed,
        rightOrder: p.rightOrder,
        kept: p.kept,
        pinned: p.pinned,
        demo: p.demo,
        answerCue: state.band === '5-6',
        activeResponse: p.stage === 'active_response' ? activeResponseAfterShow(queued.task.format) : null,
        feedback: p.stage === 'next' ? feedbackFor(p.attempt, probe) : null,
        mirrored: p.mirrored === true,
        counts: countsTowardMastery(queued.task),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Итог
// ---------------------------------------------------------------------------

export type LessonCommitInput = {
  lesson: Lesson;
  /** Навыки и атлас ребёнка — как прочитаны при старте урока. */
  skills: readonly SkillState[];
  atlas: readonly AtlasEntry[];
  /** Случайный UUIDv4 прохождения (`ids.uuidV4`). */
  runId: string;
};

export type LessonCommitResult = {
  run: LessonRun;
  skills: SkillState[];
  atlas: AtlasEntry[];
  nextLessonNumber: number;
  stars: 1 | 2 | 3;
};

/**
 * Итог завершённого урока — то, что экран передаёт в `commitLesson` (`LessonCommit` плюс звёзды
 * для финала). Незавершённый урок итога не имеет: в режиме без записи он теряется, с
 * `account_local` — продолжается из снимка.
 */
export function lessonCommitOf(state: LessonSessionState, input: LessonCommitInput): LessonCommitResult {
  assert(state.phase === 'done', 'итог незавершённого урока');
  assert(input.lesson.id === state.lessonId, 'итог с чужим уроком');
  const result = finishLesson(input.lesson, state.played, input.skills, state.lessonNumber, state.day);
  const run: LessonRun = {
    id: input.runId,
    childId: state.childId,
    lessonId: state.lessonId,
    startedAt: state.startedAt,
    taskSeconds: state.taskSeconds,
    reviewTasks: state.played.filter((p) => p.queued.review).length,
  };
  return {
    run,
    skills: result.skills,
    atlas: recordInAtlas(input.atlas, result.entry),
    nextLessonNumber: state.lessonNumber + 1,
    stars: result.stars,
  };
}

export type ReviewCommitInput = { skills: readonly SkillState[]; atlas: readonly AtlasEntry[]; runId: string };

/**
 * Итог сессии повторения: коробки навыков — да, атлас — прежний, звёзды экран не показывает (тип
 * требует). Счётчик уроков растёт: запись `commitLesson` иначе отвергается (`LessonStaleError`), и
 * `lastSeenLesson` у навыков должен отличать это прохождение от следующего урока.
 */
export function reviewCommitOf(state: LessonSessionState, input: ReviewCommitInput): LessonCommitResult {
  assert(state.phase === 'done', 'итог незавершённого повторения');
  assert(isReviewSession(state), 'итог повторения с уроком');
  const result = finishReview(state.played, input.skills, state.lessonNumber, state.day);
  const run: LessonRun = {
    id: input.runId,
    childId: state.childId,
    lessonId: REVIEW_LESSON_ID,
    startedAt: state.startedAt,
    taskSeconds: state.taskSeconds,
    reviewTasks: state.played.length,
  };
  return { run, skills: result.skills, atlas: [...input.atlas], nextLessonNumber: state.lessonNumber + 1, stars: starsForLesson([]) };
}
