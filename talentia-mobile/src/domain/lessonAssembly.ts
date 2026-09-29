/**
 * Сборка урока и его итог. Спецификация — REBUILD.md («Устройство урока», «Освоение
 * считается по навыку»), FORMATS.md (правила на корпус), SCREENS.md (1.2, 2.7).
 *
 * Сборка: задания урока плюс не больше двух повторений навыков, которым подошёл срок
 * (`mastery.skillsToReview`), расставленных так, чтобы не нарушить «не больше двух
 * одного формата подряд». Итог: звёзды по заданиям самого урока, коробки навыков —
 * одним шагом за урок, запись в атлас. Решения методиста — REBUILD.md, «Сборка урока».
 */
import {
  applyLessonOutcomes,
  emptySkill,
  skillsToReview,
  starsForLesson,
  type Outcome,
  type SkillState,
} from './mastery';
import { SESSION_TASKS_MAX } from './lessonLimits';
import {
  countsTowardMastery,
  MAX_FORMAT_RUN,
  maxFormatRun,
  outcomeOf,
  reshuffle,
  type Attempt,
  type QueuedTask,
  type Rng,
} from './lessonFlow';
import { FORMAT_MIN_BAND, type AgeBand, type Lesson, type Task } from '../types/task';

// ---------------------------------------------------------------------------
// Пул повторения
// ---------------------------------------------------------------------------

/** Задания пройденных уроков по навыку. Знакомства с форматом в пул не входят. */
export type ReviewPool = Readonly<Record<string, readonly Task[]>>;

/**
 * Собрать пул из **пройденных** уроков. Задание из урока, который ребёнок ещё не
 * открывал, повторением не бывает: оно испортит тот урок, показав его заранее.
 */
export function buildReviewPool(completed: readonly Lesson[]): ReviewPool {
  const pool: Record<string, Task[]> = {};
  for (const lesson of completed) {
    for (const task of lesson.tasks) {
      if (!countsTowardMastery(task)) continue;
      (pool[task.skill] ??= []).push(task);
    }
  }
  return pool;
}

/** Максимум повторений в уроке: три из пяти — уже не новый урок (REBUILD.md). */
export const MAX_REVIEWS = 2;

const BANDS: readonly AgeBand[] = ['5-6', '7', '8', '9-10'];

/**
 * Годится ли задание для полосы урока: формат доступен с этого возраста, а до 7 лет —
 * только картинками. Пул собран из уроков ребёнка, но навык мог прийти из урока
 * другой полосы — например, после смены возраста в профиле.
 */
export function fitsBand(task: Task, band: AgeBand): boolean {
  if (BANDS.indexOf(FORMAT_MIN_BAND[task.format]) > BANDS.indexOf(band)) return false;
  if (band === '5-6' && 'presentation' in task && task.presentation === 'text') return false;
  return true;
}

// ---------------------------------------------------------------------------
// Сборка
// ---------------------------------------------------------------------------

export type AssembleInput = {
  lesson: Lesson;
  /** Состояние навыков ребёнка. */
  skills: readonly SkillState[];
  /** Номер этого урока в истории ребёнка — тот же счётчик, что `lastSeenLesson`. */
  lessonNumber: number;
  pool: ReviewPool;
  /**
   * Навыки региона этого урока. При равной коробке повторяется свой: «первый звук в
   * слове» посреди урока про камни рвёт сюжет, который завязка только что начала.
   */
  regionSkills?: ReadonlySet<string>;
  rng: Rng;
};

/**
 * Очередь урока.
 *
 * - Повторения помещаются в потолок сессии (`SESSION_TASKS_MAX`): урок и повторение
 *   вместе — одна сессия, её длину держит внимание. Автор пишет меньше потолка
 *   (`TASKS_PER_LESSON`), остаток — место под повторение: на полосе 5–6 это одно.
 * - Навыки, которые есть в самом уроке, не повторяются: урок их и так тренирует.
 *   Место уходит следующему по сроку.
 * - Повторение не бывает первым (там знакомство с форматом или начало темы, которую
 *   завязка только что объявила) и последним (урок кончается своей темой, её и
 *   вписывают в атлас). Внутри — как можно равномернее.
 * - Серию одного формата повторение не удлиняет дальше двух. Если задание навыка не
 *   встаёт никуда, пробуется другое задание того же навыка, потом следующий навык.
 * - Позиции в задании повторения перемешиваются: в пуле навыка всего несколько
 *   заданий, и ребёнок иначе вспоминает, где стояла кнопка, а не навык.
 */
export function assembleLesson({ lesson, skills, lessonNumber, pool, regionSkills, rng }: AssembleInput): QueuedTask[] {
  let queue: QueuedTask[] = lesson.tasks.map((task) => ({ task }));
  const room = Math.max(0, SESSION_TASKS_MAX[lesson.band] - lesson.tasks.length);
  const limit = Math.min(MAX_REVIEWS, room);
  if (limit === 0) return queue;

  const own = new Set(lesson.tasks.map((t) => t.skill));
  const ownIds = new Set(lesson.tasks.map((t) => t.id));
  const home = (s: SkillState) => (regionSkills?.has(s.skill) ? 0 : 1);
  const due = skillsToReview([...skills], lessonNumber, Infinity)
    .filter((s) => !own.has(s.skill))
    .sort((a, b) => a.box - b.box || home(a) - home(b));

  let placed = 0;
  for (const s of due) {
    if (placed === limit) break;
    const candidates = shuffle(
      (pool[s.skill] ?? []).filter((t) => countsTowardMastery(t) && !ownIds.has(t.id) && fitsBand(t, lesson.band)),
      rng,
    );
    for (const task of candidates) {
      const next = placeReview(queue, { task: reshuffle(task, rng), review: true }, placed, limit);
      if (next) {
        queue = next;
        placed += 1;
        break;
      }
    }
  }
  return queue;
}

/**
 * Вставить повторение номер `index` из `total`. Места — между первым заданием урока,
 * которое идёт в зачёт, и последним; начиная с ближайшего к равномерной раскладке.
 * `null` — ни одно место не сохраняет правило серии.
 */
function placeReview(queue: QueuedTask[], review: QueuedTask, index: number, total: number): QueuedTask[] | null {
  const firstCounted = queue.findIndex((q) => countsTowardMastery(q.task));
  if (firstCounted < 0) return null;
  const lo = firstCounted + 1;
  const hi = queue.length - 1;
  if (lo > hi) return null;

  const ideal = lo + Math.round(((hi - lo) * (index + 1)) / (total + 1));
  const positions = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).sort(
    (a, b) => Math.abs(a - ideal) - Math.abs(b - ideal) || a - b,
  );
  const allowed = Math.max(MAX_FORMAT_RUN, maxFormatRun(queue));
  for (const at of positions) {
    const next = [...queue.slice(0, at), review, ...queue.slice(at)];
    if (maxFormatRun(next) <= allowed) return next;
  }
  return null;
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Итог урока
// ---------------------------------------------------------------------------

/** Сыгранное задание: чем кончилось. */
export type Played = { queued: QueuedTask; attempt: Attempt };

/** Запись в атласе — одна на урок. */
export type AtlasEntry = {
  lessonId: string;
  atlasEntryKey: string;
  stars: 1 | 2 | 3;
  /** Номер урока в истории ребёнка, когда запись появилась впервые. */
  firstLesson: number;
};

export type LessonResult = {
  stars: 1 | 2 | 3;
  /** Все навыки ребёнка: изменённые — новым состоянием, прочие — как были. */
  skills: SkillState[];
  entry: AtlasEntry;
};

/**
 * Итог урока.
 *
 * - Звёзды — только по заданиям самого урока: они пишутся в атлас этого урока и
 *   обещают, насколько уверенно установлено **здесь**. Повторение сюда не входит — в
 *   него по построению попадает самый слабый навык, и звёзды нового урока занижались
 *   бы за то, чего в уроке нет. Знакомство с форматом не в зачёт, проба переноса
 *   повторяет уже засчитанное.
 * - Коробки — по навыку, одним шагом за урок (`applyLessonOutcomes`); проба переноса
 *   добавляет попытку, но коробку не двигает.
 */
export function finishLesson(
  lesson: Lesson,
  played: readonly Played[],
  skills: readonly SkillState[],
  lessonNumber: number,
): LessonResult {
  const bySkill = new Map<string, Outcome[]>();
  const forStars: Outcome[] = [];
  for (const { queued, attempt } of played) {
    const outcome = outcomeOf(queued.task, attempt, queued.transferProbe === true);
    if (outcome === null) continue;
    if (!bySkill.has(queued.task.skill)) bySkill.set(queued.task.skill, []);
    bySkill.get(queued.task.skill)!.push(outcome);
    if (!queued.transferProbe && !queued.review) forStars.push(outcome);
  }

  const known = new Map(skills.map((s) => [s.skill, s]));
  for (const [skill, outcomes] of bySkill) {
    known.set(skill, applyLessonOutcomes(known.get(skill) ?? emptySkill(skill), outcomes, lessonNumber));
  }

  const stars = starsForLesson(forStars);
  return {
    stars,
    skills: [...known.values()],
    entry: { lessonId: lesson.id, atlasEntryKey: lesson.atlasEntryKey, stars, firstLesson: lessonNumber },
  };
}

/**
 * Вписать запись в атлас. Повторное прохождение звёзды не отнимает: атлас — то, что
 * установлено, и худший второй заход установленного не отменяет. Лучший результат
 * остаётся, первое появление — тоже.
 */
export function recordInAtlas(atlas: readonly AtlasEntry[], entry: AtlasEntry): AtlasEntry[] {
  const i = atlas.findIndex((e) => e.lessonId === entry.lessonId);
  if (i < 0) return [...atlas, entry];
  const prev = atlas[i];
  const best = { ...prev, stars: Math.max(prev.stars, entry.stars) as AtlasEntry['stars'] };
  return [...atlas.slice(0, i), best, ...atlas.slice(i + 1)];
}
