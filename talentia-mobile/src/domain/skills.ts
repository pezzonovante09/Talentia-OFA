/**
 * Реестр навыков (AUDIT.md, С10). Навык — одно проверяемое умение, поле `skill` у задания;
 * освоение и повторение считаются по нему, а не по уроку (`mastery.ts`).
 *
 * Без реестра опечатка в `skill` выглядит как новый навык: гард требовал на неё
 * разобранный пример, а коробки заводили второй навык вместо первого, и повторение
 * рассыпалось. Решения №26 (новизна в пределах полосы) и №27 (повтор примера при откате
 * в первую коробку) держатся на том, что у навыка одно имя.
 *
 * Реестр растёт вместе с корпусом: `lesson-author` заводит навык здесь, когда пишет урок,
 * где он вводится, — id берёт из заметок `docs/sources/` и CURRICULUM.md. Чистые данные,
 * без I/O.
 */
import type { AgeBand, Region } from '../types/task';

/**
 * Откуда навык: `kr` — предметный стандарт КР (`docs/sources/`), `norm` — возрастная
 * норма (полоса 5-6: стандарта КР для неё нет), `check-kr` — по ФГОС или дидактике,
 * со стандартом КР не сверено.
 */
export type SkillSource = 'kr' | 'norm' | 'check-kr';

export type SkillEntry = {
  /** kebab-case латиницей — то же, что `Task.skill`. */
  id: string;
  /** Регион, где навык вводится. Повторяться он может и в чужом. */
  region: Region['id'];
  /** Полоса, где навык вводится разобранным примером. Раньше неё навык не встречается. */
  band: AgeBand;
  /**
   * Что ребёнок должен уметь до этого навыка — не больше трёх. Навык той же полосы
   * обязан быть введён в корпусе раньше; навык младшей полосы ребёнок, начавший с этой
   * (№26), получает повторением.
   */
  prerequisites: readonly string[];
  source: SkillSource;
};

export const MAX_PREREQUISITES = 3;

export const SKILLS: readonly SkillEntry[] = [
  // Числовая долина, 5-6, тема «Сколько их?» — пилот (`content/numbers-5-6.ts`).
  { id: 'subitize-1-3', region: 'numbers', band: '5-6', prerequisites: [], source: 'norm' },
  { id: 'count-to-5', region: 'numbers', band: '5-6', prerequisites: ['subitize-1-3'], source: 'norm' },
  { id: 'count-to-10', region: 'numbers', band: '5-6', prerequisites: ['count-to-5'], source: 'norm' },
];

export const SKILL_BY_ID: ReadonlyMap<string, SkillEntry> = new Map(SKILLS.map((s) => [s.id, s]));

const BAND_ORDER: readonly AgeBand[] = ['5-6', '7', '8', '9-10'];
export const bandIndex = (band: AgeBand): number => BAND_ORDER.indexOf(band);

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Ошибки самого реестра: повтор id, не kebab-case, неизвестный или старший
 * пререквизит, больше трёх пререквизитов, цикл. Пустой список — реестр цел.
 */
export function registryProblems(list: readonly SkillEntry[]): string[] {
  const bad: string[] = [];
  const byId = new Map<string, SkillEntry>();
  for (const s of list) {
    if (byId.has(s.id)) bad.push(`навык ${s.id} записан дважды`);
    byId.set(s.id, s);
    if (!KEBAB.test(s.id)) bad.push(`навык «${s.id}» не kebab-case латиницей`);
    if (s.prerequisites.length > MAX_PREREQUISITES) {
      bad.push(`${s.id}: пререквизитов ${s.prerequisites.length}, не больше ${MAX_PREREQUISITES}`);
    }
  }
  for (const s of list) {
    for (const p of s.prerequisites) {
      const pre = byId.get(p);
      if (!pre) bad.push(`${s.id}: пререквизит ${p} не записан в реестре`);
      else if (bandIndex(pre.band) > bandIndex(s.band)) {
        bad.push(`${s.id} (${s.band}): пререквизит ${p} вводится позже — на ${pre.band}`);
      }
    }
  }
  // Цикл делает порядок введения невозможным: ни один навык цикла не введётся первым.
  const state = new Map<string, 'open' | 'done'>();
  const visit = (id: string, path: string[]): void => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'open') {
      bad.push(`цикл пререквизитов: ${[...path.slice(path.indexOf(id)), id].join(' → ')}`);
      return;
    }
    state.set(id, 'open');
    for (const p of byId.get(id)?.prerequisites ?? []) if (byId.has(p)) visit(p, [...path, id]);
    state.set(id, 'done');
  };
  for (const s of list) visit(s.id, []);
  return bad;
}
