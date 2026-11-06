/**
 * Пул подкрепителей под сессию из каталога (№149, `aba-pedagogy-specialist` 2026-10-25): позиции, которые
 * ребёнок действительно может получить сейчас. `MIN_REINFORCER_POOL` проверяется по пулу **после всех
 * фильтров** — тестом каталога по всем сочетаниям, чтобы `reinforcerChoices` не бросал посреди детской
 * сессии; порог не снижается.
 */
import type { AbaConfig, ReinforcerItem } from '../types/aba';

export type PoolFilter = {
  config: AbaConfig;
  /** Звук в занятии включён (`soundEffects` профиля ребёнка). */
  soundOn: boolean;
  /** Доступ за обмен на этой ступени доски (`EXCHANGE_ACCESS_MS`). */
  accessMs: number;
  /** Классы стимулов целей программы ребёнка. */
  stimulusClasses: readonly string[];
};

export function reinforcerPoolFor(catalog: readonly ReinforcerItem[], f: PoolFilter): string[] {
  const classes = new Set(f.stimulusClasses);
  return catalog
    .filter((r) => (r.configs ? r.configs.includes(f.config) : true))
    .filter((r) => f.soundOn || !r.sound)
    .filter((r) => (r.minAccessMs ?? 0) <= f.accessMs)
    .filter((r) => !r.classes.some((c) => classes.has(c)))
    .map((r) => r.id);
}

/** Пары, которые не ставятся в одну тройку выбора (`reinforcerChoices`, параметр `apart`). */
export function apartPairs(catalog: readonly ReinforcerItem[]): [string, string][] {
  return catalog.flatMap((r) => (r.apartFrom ?? []).map((other) => [r.id, other] as [string, string]));
}
