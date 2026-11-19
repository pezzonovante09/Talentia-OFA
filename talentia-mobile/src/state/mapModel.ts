/**
 * Модель карты региона из сеанса ребёнка: узлы по `mapNodes`, узел «повторение» по сроку навыков,
 * указатель Tali, уроки без перевода (№78, SCREENS.md 1.6а). Чистая функция плюс хук-обёртка.
 */
import { regionLessons, regionMapLessons } from '../content';
import { lessonAvailable } from '../domain/lessonKeys';
import { gameDay, mapNodes, pointer, reviewNode, type NodeState, type ReviewNode } from '../domain/mapProgress';
import { skillsForReviewSession } from '../domain/mastery';
import { keyExists } from '../i18n';
import type { Lesson, Region } from '../types/task';
import { completedLessons, startedLessons, useChildSession, type ChildSessionState } from './childSession';

export type MapModel = {
  region: Region['id'];
  lessons: Lesson[];
  states: NodeState[];
  review: ReviewNode;
  /** Индекс урока, на который указывает Tali; `'review'` — на узел повторения; null — никуда. */
  pointer: number | 'review' | null;
  /** Уроки без полного перевода на язык интерфейса — пунктирный узел, в указатель не попадают. */
  unavailable: ReadonlySet<string>;
  /** Голос тихого узла «повторение»: ни одного урока не пройдено — «сначала пройди урок», иначе — «всё повторено». */
  reviewVoice: 'map.reviewLater' | 'map.reviewNothing';
};

export function buildMapModel(
  s: Pick<ChildSessionState, 'progress' | 'activeLesson' | 'portion' | 'settings'>,
  now: Date,
  region: Region['id'] = 'numbers',
  exists: (key: string) => boolean = keyExists,
): MapModel {
  const lessons = regionLessons(region);
  const [states] = mapNodes(
    [{ lessons: regionMapLessons(region), completed: completedLessons(s), started: startedLessons(s) }],
    { band: s.settings.band },
    s.portion.left,
  );
  // узел активен, когда есть хоть один навык в срок, не встречавшийся сегодня (вопрос 56)
  const due = skillsForReviewSession(s.progress.skills, s.progress.lessonCounter, gameDay(now)).length;
  const review = reviewNode(due);
  const unavailable = new Set(lessons.filter((l) => !lessonAvailable(l, exists)).map((l) => l.id));
  const p = pointer([states.map((st, i) => (unavailable.has(lessons[i].id) ? 'ahead' : st))], review);
  return {
    region,
    lessons,
    states,
    review,
    pointer: p === null ? null : p === 'review' ? 'review' : p.lesson,
    unavailable,
    reviewVoice: completedLessons(s).size === 0 ? 'map.reviewLater' : 'map.reviewNothing',
  };
}

export function useMapModel(now: Date, region: Region['id'] = 'numbers'): MapModel {
  const progress = useChildSession((s) => s.progress);
  const activeLesson = useChildSession((s) => s.activeLesson);
  const portion = useChildSession((s) => s.portion);
  const settings = useChildSession((s) => s.settings);
  return buildMapModel({ progress, activeLesson, portion, settings }, now, region);
}
