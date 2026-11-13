/**
 * Реестр контента: регионы → темы → уроки в порядке карты. Единственное место, где экраны берут
 * уроки; гард корпуса (`__tests__/corpusRules.ts`) собирает модули сам и на реестр не смотрит.
 *
 * Срез прототипа: только Мир чисел, две темы полосы 5–6 (решение №138: остальные регионы и
 * полосы — этапы 12 и 17). Порядок уроков в регионе — порядок тем и уроков здесь.
 */
import type { MapLesson } from '../domain/mapProgress';
import { REVIEW_LESSON_ID } from '../domain/parentReport';
import type { Lesson, Region } from '../types/task';
import { countingTopic, numeralsTopic } from './numbers-5-6';

export const REGIONS: readonly Region[] = [
  { id: 'numbers', titleKey: 'content.regions.numbers.title', topics: [countingTopic, numeralsTopic] },
];

export const regionById = (id: Region['id']): Region | undefined => REGIONS.find((r) => r.id === id);

/** Уроки региона по порядку карты. */
export function regionLessons(regionId: Region['id']): Lesson[] {
  return regionById(regionId)?.topics.flatMap((t) => t.lessons) ?? [];
}

/** То же в виде, который нужен `mapNodes`. */
export const regionMapLessons = (regionId: Region['id']): MapLesson[] =>
  regionLessons(regionId).map((l) => ({ id: l.id, band: l.band }));

const BY_ID = new Map<string, { lesson: Lesson; region: Region['id'] }>();
for (const r of REGIONS) {
  for (const t of r.topics) {
    for (const l of t.lessons) {
      if (BY_ID.has(l.id)) throw new Error(`Урок ${l.id} встречается в реестре дважды`);
      if (l.id === REVIEW_LESSON_ID) throw new Error(`Id «${REVIEW_LESSON_ID}» занят сессией повторения`);
      BY_ID.set(l.id, { lesson: l, region: r.id });
    }
  }
}

export const lessonById = (id: string): Lesson | undefined => BY_ID.get(id)?.lesson;

/** Все уроки всех регионов — источник пула сессии повторения. */
export const allLessons = (): Lesson[] => [...BY_ID.values()].map((x) => x.lesson);
export const regionOfLesson = (id: string): Region['id'] | undefined => BY_ID.get(id)?.region;

/** Уроки того же региона до данного — источник пула повторения (`buildReviewPool`). */
export function lessonsBefore(lessonId: string): Lesson[] {
  const region = regionOfLesson(lessonId);
  if (!region) return [];
  const all = regionLessons(region);
  const i = all.findIndex((l) => l.id === lessonId);
  return i < 0 ? [] : all.slice(0, i);
}
