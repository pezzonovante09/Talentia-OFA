/**
 * Что ребёнок видит на карте и на каком языке звучит урок — по языку интерфейса и настройкам
 * ребёнка. Решения владельца 2026-10-02 (AUDIT.md):
 *
 * - №38, №50 — регион «Кыргызский язык» есть, только если его включили **этому ребёнку**:
 *   вопрос при создании профиля ребёнка и переключатель в настройках; выключение прячет регион,
 *   прогресс не удаляется;
 * - №47 — Побережье слов (русский) есть у всех; при ky- и en-интерфейсе Tali и инструкции — на
 *   языке интерфейса, материал — русский (`lang: 'ru'`), то есть «русский как второй»;
 * - №48 — кыргызский регион при ru- и en-интерфейсе — та же программа, инструкции на языке
 *   интерфейса, материал — кыргызский;
 * - №49 — при en-интерфейсе подготовительный английский (Мастерская, полосы 5-6, 7, 8) скрыт:
 *   язык инструкций совпадает с изучаемым.
 *
 * Чистая логика без I/O: флаг кыргызского хранится в состоянии ребёнка на устройстве; уйдёт ли
 * он в облако — решает проверка `child-privacy-compliance` (язык может быть признаком
 * этничности).
 */
import type { AgeBand, Region, Topic } from '../types/task';

export type InterfaceLang = 'ru' | 'en' | 'ky';

export type ChildLanguageSettings = {
  interfaceLang: InterfaceLang;
  /** Включён ли этому ребёнку регион «Кыргызский язык» (№38, №50). По умолчанию — нет. */
  kyrgyzRegion: boolean;
};

const BASE_REGIONS: readonly Region['id'][] = ['numbers', 'words', 'nature', 'workshop'];

/** Регионы на карте ребёнка, в порядке карты. */
export function visibleRegions(s: ChildLanguageSettings): Region['id'][] {
  return s.kyrgyzRegion ? [...BASE_REGIONS, 'kyrgyz'] : [...BASE_REGIONS];
}

/** Полосы подготовительного английского: на них нет чтения, и инструкция — единственная опора. */
const WORKSHOP_PREP: ReadonlySet<AgeBand> = new Set(['5-6', '7', '8']);

/**
 * Видна ли тема. Полоса темы — полоса её уроков. Тема с `instructionLanguages` видна только при
 * своём языке интерфейса; у тем Побережья и кыргызского региона этого поля нет (№47, №48).
 */
export function topicVisible(region: Region['id'], topic: Topic, s: ChildLanguageSettings): boolean {
  if (!visibleRegions(s).includes(region)) return false;
  const band = topic.lessons[0]?.band;
  if (region === 'workshop' && s.interfaceLang === 'en' && band && WORKSHOP_PREP.has(band)) return false;
  return !topic.instructionLanguages || topic.instructionLanguages.includes(s.interfaceLang);
}

/**
 * Язык урока: на каком звучат Tali и инструкции (всегда язык интерфейса — №47, №48) и на каком
 * — материал, который и есть содержание (`lang` элементов). `null` — материал не языковой.
 */
export function lessonLanguages(region: Region['id'], s: ChildLanguageSettings): { voice: InterfaceLang; material: InterfaceLang | null } {
  const material: Partial<Record<Region['id'], InterfaceLang>> = { words: 'ru', kyrgyz: 'ky', workshop: 'en' };
  return { voice: s.interfaceLang, material: material[region] ?? null };
}
