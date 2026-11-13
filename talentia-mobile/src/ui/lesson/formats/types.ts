/**
 * Контракт формата (скилл `format-screen`, шаги 2–3): каркас знает формат только через эту таблицу.
 */
import type { TFunction } from 'i18next';

import type { LessonAnswer, LessonStep } from '../../../domain/lessonSession';
import type { Task } from '../../../types/task';

export type TaskStep = Extract<LessonStep, { kind: 'task' }>;

/**
 * Фаза экрана внутри задания: `answer` — ребёнок собирает; `locked` — t = 0…1040 после «Проверить»
 * с крестами; `shownWait` — ответ показан, ждём активный ответ; `done` — ждём «Дальше».
 */
export type FormatPhase = 'answer' | 'locked' | 'shownWait' | 'done';

export type FormatTap = { kind: 'element'; id: string; side?: 'left' | 'right' } | { kind: 'slot'; index: number } | { kind: 'tray'; id: string };

export type FormatProps<D> = {
  step: TaskStep;
  draft: D;
  phase: FormatPhase;
  /** Что помечено крестом на время блокировки. */
  wrong: readonly string[];
  /**
   * Что «звучит сейчас» (`listeningCue`): ключи элементов — id варианта, `left:id` / `right:id`, `place:i`.
   * Один ключ при перечислении; несколько сразу — исправленные после показа (№140).
   */
  listening: readonly string[];
  /** Размер зоны задания `X`. */
  width: number;
  height: number;
  onTap: (tap: FormatTap) => void;
  /** Любое касание зоны (сброс таймера напоминания). */
  onTouch: () => void;
  t: TFunction;
  /** Ключ сброса меток «сосчитано» (растёт при ошибке). */
  marksKey: number;
  /** Разобранный пример, шаг `mistake`: элемент, над которым Tali сомневается (знак вопроса, не крест). */
  question?: string | null;
};

export type FormatSpec<D> = {
  Component: (props: FormatProps<D>) => React.JSX.Element;
  emptyDraft: (task: Task, step: TaskStep) => D;
  /** `null` — касание ничего не изменило. */
  tap: (draft: D, tap: FormatTap, step: TaskStep) => { draft: D; effect: string } | null;
  answerOf: (draft: D, task: Task) => LessonAnswer | null;
  afterNarrowing: (draft: D, task: Task, step: TaskStep) => D;
  shown: (task: Task) => D;
  wrongOf: (draft: D, task: Task) => string[];
  /** Элементы, тап по которым после показа — активный ответ. */
  correctedOf: (task: Task, step: TaskStep) => string[];
  /** Ключи `listening` исправленных элементов — подсветка на время реплики «Покажи, что исправили» (№140). */
  correctedCues: (task: Task, step: TaskStep) => string[];
  /** Элементы, которые перечисляются с подсветкой при открытии (карточки-числа, первое место). */
  listeningSequence: (task: Task, step: TaskStep) => string[];
  /** Ключ реплики «Сначала …» для недоступной «Проверить». */
  chooseFirstKey: string;
};
