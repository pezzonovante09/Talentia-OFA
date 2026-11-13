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
  /** Название навыка для отчёта родителю — ключ `content.skills.<id>` в ru.json. */
  titleKey: string;
  /**
   * Одна фраза «что делать дома» для блока «даётся тяжело» (PARENT.md п. 4; вопрос 57) — ключ
   * `content.skillTips.<id>`. Пишет методист вместе с корпусом: конкретное бытовое действие, безродово.
   */
  homeTipKey: string;
  /**
   * Сколько предметов самое большее встречается в заданиях навыка на счёт (гард
   * `skillCountCap`): «узнать до трёх» с четырьмя фигурами учит уже другому. Обязателен у
   * навыка, в заданиях которого есть `count`.
   */
  maxCount?: number;
  /**
   * Навык проверяет узнавание символа — цифры, буквы, слога (решение №88): элементы без
   * `shape` и `image` в его заданиях — «немые» (`Media.voice: 'select'`), иначе ответ
   * находится на слух, в том числе в «кучка → цифра». В навыках счёта цифра звучит (№81).
   * Гард `symbolVoice` смотрит, есть ли поле.
   */
  symbol?: 'numeral' | 'letter' | 'syllable';
};

export const MAX_PREREQUISITES = 3;

export const SKILLS: readonly SkillEntry[] = [
  // Мир чисел, 5-6, тема «Сколько их?» — пилот (`content/numbers-5-6.ts`).
  { id: 'subitize-1-3', region: 'numbers', band: '5-6', prerequisites: [], source: 'norm', titleKey: 'content.skills.subitize-1-3', homeTipKey: 'content.skillTips.subitize-1-3', maxCount: 3 },
  { id: 'count-to-5', region: 'numbers', band: '5-6', prerequisites: ['subitize-1-3'], source: 'norm', titleKey: 'content.skills.count-to-5', homeTipKey: 'content.skillTips.count-to-5', maxCount: 5 },
  { id: 'count-to-10', region: 'numbers', band: '5-6', prerequisites: ['count-to-5'], source: 'norm', titleKey: 'content.skills.count-to-10', homeTipKey: 'content.skillTips.count-to-10', maxCount: 10 },
  // Мир чисел, 5-6, тема «Цифры» (№72, №77, №88; порядок — `docs/sources/math-1-4.md`).
  // Цифра — подпись к количеству; карточки навыков-символов немые (`symbol`). Ноль — пустая
  // корзинка (№136), ответ ищут по пустоте, а не по знаку, поэтому `symbol` у него нет.
  { id: 'numeral-1-5', region: 'numbers', band: '5-6', prerequisites: ['count-to-5'], source: 'norm', titleKey: 'content.skills.numeral-1-5', homeTipKey: 'content.skillTips.numeral-1-5', maxCount: 5, symbol: 'numeral' },
  { id: 'zero', region: 'numbers', band: '5-6', prerequisites: ['numeral-1-5'], source: 'norm', titleKey: 'content.skills.zero', homeTipKey: 'content.skillTips.zero', maxCount: 5 },
  { id: 'numeral-6-10', region: 'numbers', band: '5-6', prerequisites: ['count-to-10', 'zero'], source: 'norm', titleKey: 'content.skills.numeral-6-10', homeTipKey: 'content.skillTips.numeral-6-10', maxCount: 10, symbol: 'numeral' },
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
    if (s.titleKey !== `content.skills.${s.id}`) bad.push(`${s.id}: titleKey должен быть content.skills.${s.id}`);
    if (s.homeTipKey !== `content.skillTips.${s.id}`) bad.push(`${s.id}: homeTipKey должен быть content.skillTips.${s.id}`);
    if (s.maxCount !== undefined && !(Number.isInteger(s.maxCount) && s.maxCount >= 1)) bad.push(`${s.id}: maxCount — целое ≥ 1`);
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
