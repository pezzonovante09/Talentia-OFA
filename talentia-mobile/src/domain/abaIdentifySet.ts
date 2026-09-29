/**
 * Наборы `identify` («покажи…»). Спецификация — `ABA.md`, «Набор identify» (решение
 * методиста, принято владельцем 2026-09-29; рекомендации Grow & LeBlanc 2013).
 *
 * Одна цель «покажи кошку» с постоянными дистракторами учит **простую** дискриминацию:
 * пять проб подряд с одной инструкцией ребёнок проходит, не слушая её, — «тыкать в
 * кошачье» или исключать мяч и машину. Навык «покажи…» — **условная** дискриминация:
 * какая карточка верна, зависит от услышанного. Поэтому цели идут набором, карточки
 * целей служат друг другу дистракторами, а инструкции чередуются вперемешку.
 *
 * Набор — состояние **ребёнка**, а не контента: в контенте у цели только ключ пула,
 * набор собирается из первых готовых целей пула и меняет состав по ходу обучения.
 */
import type { AbaTarget, AbaTargetState, AbaTrialKind } from '../types/aba';
import type { Rng } from './abaTokens';

export type IdentifySet = {
  id: string;
  poolKey: string;
  /** Участники в порядке программы. Размер поля равен размеру набора. */
  memberIds: string[];
  createdAtSession: number;
  /** Последняя сессия, где набор обучался: набор и обычные цели чередуются. */
  lastSetSessionIndex: number;
};

export const SET_SIZE = { min: 3, max: 4 } as const;

/** Проб на активную цель набора за сессию: критерий — 4 из 5 на каждую. */
export const SET_TRIALS_PER_TARGET = 5;

/** Проб базовой линии на цель набора: из трёх 3/3 угадываются в ~3.7% случаев. */
export const SET_BASELINE_TRIALS = 5;

/** Освоенная цель остаётся в поле и получает столько высоковероятных проб за сессию. */
export const SET_HIGH_P_PER_MASTERED = 2;

/** Одна инструкция — не больше двух раз подряд. */
export const MAX_SAME_SD = 2;

const ACTIVE = new Set(['baseline', 'acquisition', 'generalization_check']);
const MASTERED = new Set(['mastered', 'maintenance']);

/** Ошибки пула: пул — все `identify`-цели с одним `identifyPoolKey`. */
export function poolErrors(targets: readonly AbaTarget[]): string[] {
  const errors: string[] = [];
  const pools = new Map<string, AbaTarget[]>();
  for (const t of targets) {
    if (t.format !== 'identify' || !t.identifyPoolKey) continue;
    pools.set(t.identifyPoolKey, [...(pools.get(t.identifyPoolKey) ?? []), t]);
  }
  for (const [key, pool] of pools) {
    if (pool.length < SET_SIZE.min) errors.push(`пул ${key}: целей ${pool.length}, нужно не меньше ${SET_SIZE.min}`);
    if (new Set(pool.map((t) => t.band)).size > 1) errors.push(`пул ${key}: цели разных полос`);
    const images = pool.flatMap((t) => t.exemplars.map((e) => e.image));
    if (new Set(images).size < images.length) errors.push(`пул ${key}: изображения повторяются`);
  }
  return errors;
}

/**
 * Составы наборов на эту сессию.
 *
 * - Набора пула нет — собирается из первых по программе готовых целей пула (не освоенных,
 *   с освоенными предпосылками), если их не меньше трёх; в наборе до четырёх.
 * - Набор есть — пополняется одной готовой целью пула за сессию: пока участников меньше
 *   четырёх — добавляется, иначе заменяет освоенного участника. Освоенный участник до
 *   замены остаётся в поле: иначе ребёнок начал бы выбирать методом исключения.
 * - Активных участников не осталось — набор закрывается.
 */
export function updateSets(
  sets: readonly IdentifySet[],
  targets: readonly AbaTarget[],
  states: Readonly<Record<string, AbaTargetState>>,
  sessionIndex: number,
  ready: (t: AbaTarget) => boolean,
): IdentifySet[] {
  const out: IdentifySet[] = [];
  const keys = [...new Set(targets.filter((t) => t.format === 'identify').map((t) => t.identifyPoolKey ?? ''))];
  for (const key of keys) {
    const pool = targets.filter((t) => t.format === 'identify' && t.identifyPoolKey === key);
    const existing = sets.find((x) => x.poolKey === key);
    const candidates = pool.filter((t) => ACTIVE.has(states[t.id]?.phase ?? 'baseline') && ready(t));

    if (!existing) {
      if (candidates.length >= SET_SIZE.min) {
        out.push({
          id: `${key}#${sessionIndex}`,
          poolKey: key,
          memberIds: candidates.slice(0, SET_SIZE.max).map((t) => t.id),
          createdAtSession: sessionIndex,
          lastSetSessionIndex: -1,
        });
      }
      continue;
    }

    let memberIds = [...existing.memberIds];
    const newcomer = candidates.find((t) => !memberIds.includes(t.id));
    if (newcomer) {
      if (memberIds.length < SET_SIZE.max) memberIds.push(newcomer.id);
      else {
        const leaving = memberIds.findIndex((id) => MASTERED.has(states[id]?.phase ?? ''));
        if (leaving >= 0) memberIds = memberIds.map((id, i) => (i === leaving ? newcomer.id : id));
      }
    }
    if (memberIds.some((id) => ACTIVE.has(states[id]?.phase ?? ''))) out.push({ ...existing, memberIds });
  }
  return out;
}

/** Проба в последовательности набора. */
export type SetItem = { targetId: string; kind: AbaTrialKind };

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function longestRun(items: readonly SetItem[]): number {
  let best = 0;
  let run = 0;
  items.forEach((x, i) => {
    run = i > 0 && items[i - 1].targetId === x.targetId ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/**
 * Разложить пробы без серий длиннее двух одной инструкции. Случайные перестановки, а
 * если не выходит — жадно: каждый раз цель с наибольшим остатком, не третья подряд.
 */
function arrange(items: SetItem[], rng: Rng, before: SetItem[] = []): SetItem[] {
  const tail = before.slice(-MAX_SAME_SD);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const out = shuffle(items, rng);
    if (longestRun([...tail, ...out]) <= MAX_SAME_SD) return out;
  }
  const left = new Map<string, SetItem[]>();
  for (const x of items) left.set(x.targetId, [...(left.get(x.targetId) ?? []), x]);
  const out: SetItem[] = [];
  while (out.length < items.length) {
    const seen = [...tail, ...out];
    const last = seen.slice(-MAX_SAME_SD);
    const blocked =
      last.length === MAX_SAME_SD && last.every((x) => x.targetId === last[0].targetId) ? last[0].targetId : null;
    const next = [...left.entries()]
      .filter(([id, xs]) => xs.length > 0 && id !== blocked)
      .sort((a, b) => b[1].length - a[1].length)[0] ?? [...left.entries()].find(([, xs]) => xs.length > 0)!;
    out.push(next[1].shift()!);
  }
  return out;
}

/**
 * Пробы набора на сессию — две половины вокруг перерыва. У каждой цели её пробы делятся
 * поровну (±1), и половины получаются равными: 3 цели по 5 — 8 + 7, 4 цели — 10 + 10.
 * Внутри половины — случайный порядок, одна инструкция не больше двух раз подряд, в
 * том числе на стыке половин.
 */
export function setHalves(
  set: IdentifySet,
  states: Readonly<Record<string, AbaTargetState>>,
  rng: Rng,
): [SetItem[], SetItem[]] {
  const halves: [SetItem[], SetItem[]] = [[], []];
  let flip = 0;
  for (const id of set.memberIds) {
    const phase = states[id]?.phase ?? 'baseline';
    const kind: AbaTrialKind = phase === 'baseline' ? 'baseline' : MASTERED.has(phase) ? 'high_p' : 'teaching';
    const n = kind === 'baseline' ? SET_BASELINE_TRIALS : kind === 'high_p' ? SET_HIGH_P_PER_MASTERED : SET_TRIALS_PER_TARGET;
    const first = Math.floor(n / 2) + (n % 2 === 1 ? (flip++ % 2 === 0 ? 1 : 0) : 0);
    halves[0].push(...Array.from({ length: first }, () => ({ targetId: id, kind })));
    halves[1].push(...Array.from({ length: n - first }, () => ({ targetId: id, kind })));
  }
  const first = arrange(halves[0], rng);
  return [first, arrange(halves[1], rng, first)];
}
