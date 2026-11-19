/**
 * Геометрия ленты карты региона — чистая логика (docs/design/slice-screens-2026-10-24.md §2;
 * SCREENS.md 8.3; токены `mapLayout`, `mapNodeState`, `mapLane`).
 *
 * Лента — ряд плит слева направо: «повторение», затем уроки региона по порядку. На полосе 5–6 в любом
 * режиме плитами рисуются только «повторение», пройденные, доступный и `visibleAhead` следующих; дальше
 * тропа продолжается пунктиром и заканчивается знаком «?» без плиты (UX п. 7: десять одинаковых замков —
 * десять одинаковых откликающихся целей). В focus — текущий узел и его соседи.
 */
import type { NodeState } from './mapProgress';

export type LaneItem =
  | { kind: 'review'; index: 0 }
  | { kind: 'lesson'; index: number; lesson: number; state: NodeState }
  /** Хвост тропы: пунктир до знака «?» — не плита и не цель. */
  | { kind: 'tail'; index: number };

export type VisibleOptions = {
  /** Сколько замков впереди рисовать плитами. */
  visibleAhead: number;
  focus: boolean;
  /** На какой урок указывает Tali (индекс в `states`), или null. */
  pointer: number | null;
};

/** Какие узлы рисуются плитами и есть ли хвост-пунктир. Индексы `index` — позиции на ленте. */
export function visibleLaneItems(states: readonly NodeState[], { visibleAhead, focus, pointer }: VisibleOptions): LaneItem[] {
  const items: LaneItem[] = [{ kind: 'review', index: 0 }];
  let aheadLeft = visibleAhead;
  let lastShown = -1;
  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    let show: boolean;
    if (focus) {
      show = pointer !== null ? Math.abs(i - pointer) <= 1 : i === 0;
    } else if (state === 'ahead') {
      show = aheadLeft > 0;
      if (show) aheadLeft -= 1;
    } else {
      show = true;
    }
    if (!show) {
      if (!focus) break;
      continue;
    }
    items.push({ kind: 'lesson', index: i + 1, lesson: i, state });
    lastShown = i;
  }
  if (lastShown < states.length - 1) items.push({ kind: 'tail', index: lastShown + 2 });
  return items;
}

export type LaneGeometry = {
  node: number;
  /** Расстояние между центрами соседних узлов, ≥ `mapLayout.nodeGapMin`. */
  step: number;
  /** Поле слева и справа от крайних узлов. */
  inset: number;
  /** Амплитуда волны тропы по вертикали. */
  wave: number;
  /** Длина хвоста-пунктира от последней плиты до знака «?». */
  tail: number;
};

export type LanePoint = { x: number; y: number };

/** Центр узла с позицией `index` на ленте; `baseY` — ось тропы. Волна — чтобы тропа не была линейкой. */
export function nodeCenter(index: number, baseY: number, g: LaneGeometry): LanePoint {
  return { x: g.inset + g.node / 2 + index * g.step, y: baseY + (index % 2 === 0 ? -g.wave : g.wave) };
}

/** Ширина содержимого ленты по последнему элементу (плите или знаку «?»). */
export function laneWidth(items: readonly LaneItem[], g: LaneGeometry): number {
  const last = items[items.length - 1];
  if (!last) return g.inset * 2 + g.node;
  if (last.kind === 'tail') return nodeCenter(last.index - 1, 0, g).x + g.node / 2 + g.tail + g.inset;
  return nodeCenter(last.index, 0, g).x + g.node / 2 + g.inset;
}

/** Смещение ленты, при котором точка `targetX` стоит в центре окна; края ленты за окно не уходят. */
export function centerOffset(contentWidth: number, viewportWidth: number, targetX: number): number {
  const min = Math.min(0, viewportWidth - contentWidth);
  const raw = viewportWidth / 2 - targetX;
  return Math.max(min, Math.min(0, raw));
}

export const clampOffset = (offset: number, contentWidth: number, viewportWidth: number): number =>
  Math.max(Math.min(0, viewportWidth - contentWidth), Math.min(0, offset));

/**
 * Где стоит Tali: слева-снизу от узла, зазор между габаритом Tali и плитой ≥ `gap` (UX п. 5) — и по
 * горизонтали до узла-указателя, и по вертикали до предыдущей плиты (её низ при волне `wave` выше на
 * `2 · wave`). Возвращает левый верхний угол квадрата `tali`.
 */
export function taliAnchor(node: LanePoint, { nodeSize, tali, gap }: { nodeSize: number; tali: number; gap: number }): LanePoint {
  return { x: node.x - nodeSize / 2 - gap - tali, y: node.y + nodeSize / 2 + gap / 4 };
}
