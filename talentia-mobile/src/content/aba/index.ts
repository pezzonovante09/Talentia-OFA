/**
 * Контент ABA: цели, стимулы, каталог подкрепителей. Здесь же — допуск цели к сессии.
 */
import { ABA_OBJECT_ART } from '../../assets/registry';
import type { AbaTarget } from '../../types/aba';
import { MATCH_LEVEL1 } from './match-level1';
import { ABA_STIMULI } from './stimuli';

/** Все цели контента ABA — для гарда пула (худший случай: классы стимулов всех целей) и загрузчика. */
export const ABA_TARGETS: readonly AbaTarget[] = [...MATCH_LEVEL1];

const byId = new Map(ABA_STIMULI.map((s) => [s.id, s]));

/**
 * Можно ли вести цель: у каждой карточки есть что показать (`aba-pedagogy-specialist` 2026-10-26, п. 1). Предмет без
 * картинки — одна заглушка на все карточки, «найди такую же» нерешаема: серия ошибок и коррекций без шанса на верный
 * ответ, а журнал наполняется пробами, которые ничего не значат. Такая цель к сессии не допускается; формы и цвета
 * рисует код — готовы всегда.
 */
export function abaTargetReady(t: AbaTarget, art: Readonly<Record<string, unknown>> = ABA_OBJECT_ART): boolean {
  return t.exemplars.every((e) =>
    (e.cards ?? (e.image ? [e.image] : [])).every((id) => {
      const s = byId.get(id);
      return s !== undefined && (s.kind !== 'object' || art[id] != null);
    }),
  );
}

/** Цели, допущенные к сессии; их предпосылки, не допущенные сами, закрывают и их (лестница). */
export function readyAbaTargets(targets: readonly AbaTarget[] = ABA_TARGETS, art: Readonly<Record<string, unknown>> = ABA_OBJECT_ART): AbaTarget[] {
  const ready = new Set(targets.filter((t) => abaTargetReady(t, art)).map((t) => t.id));
  const open = (t: AbaTarget, seen = new Set<string>()): boolean =>
    ready.has(t.id) &&
    !seen.has(t.id) &&
    (t.prerequisiteTargetIds ?? []).every((p) => {
      const pre = targets.find((x) => x.id === p);
      return pre !== undefined && open(pre, new Set([...seen, t.id]));
    });
  return targets.filter((t) => open(t));
}
