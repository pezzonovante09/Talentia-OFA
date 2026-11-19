/**
 * Случайность ABA, которую можно сохранить: состояние генератора — одно число, поэтому
 * сессия и прогон рутины после восстановления тянут то же самое (порядок проб, дистрактор
 * подсказки L2). Общая для `abaSession.ts`, `abaRoutineRun.ts` и `abaPrompting.ts`.
 */
import type { Rng } from './abaTokens';

/** mulberry32: генератор, чьё состояние — одно число. */
export function seeded(seed: number): { rng: Rng; seed: () => number } {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { rng, seed: () => a };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}
