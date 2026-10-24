/**
 * Где лежат фигуры кучки (SCREENS.md 3.8) — ровно так, как раскладку понимает гард
 * `countSilhouette` (`domain/countLayout.ts`): ряд до пяти, «пять и остаток» двумя строками, узоры
 * кубика, фиксированные шаблоны россыпи, не совпадающие с кубиком того же числа. Координаты — центры
 * фигур в клетках сетки `step`; переводит в pt тот, кто рисует (стимул 40/48, плитка 24/28).
 */
import type { CountLayout } from './countLayout';

export type Cell = { col: number; row: number };

/** Узоры кубика 1–5 в сетке 3×3. */
const DICE: Record<number, Cell[]> = {
  1: [{ col: 1, row: 1 }],
  2: [
    { col: 0, row: 0 },
    { col: 2, row: 2 },
  ],
  3: [
    { col: 0, row: 0 },
    { col: 1, row: 1 },
    { col: 2, row: 2 },
  ],
  4: [
    { col: 0, row: 0 },
    { col: 2, row: 0 },
    { col: 0, row: 2 },
    { col: 2, row: 2 },
  ],
  5: [
    { col: 0, row: 0 },
    { col: 2, row: 0 },
    { col: 1, row: 1 },
    { col: 0, row: 2 },
    { col: 2, row: 2 },
  ],
};

/**
 * Россыпь 2–5 (SCREENS.md 3.8): 2 — со сдвигом по вертикали, не угол-угол; 3 — тупой треугольник, не
 * линия; 4 — не квадрат; 5 — не «конверт». Ни один шаблон не совпадает с кубиком того же числа.
 */
const SCATTER: Record<number, Cell[]> = {
  1: [{ col: 1, row: 1 }],
  2: [
    { col: 0, row: 0 },
    { col: 2, row: 1 },
  ],
  3: [
    { col: 0, row: 0 },
    { col: 2, row: 0 },
    { col: 1, row: 2 },
  ],
  4: [
    { col: 0, row: 0 },
    { col: 2, row: 0 },
    { col: 1, row: 1 },
    { col: 0, row: 2 },
  ],
  5: [
    { col: 0, row: 0 },
    { col: 2, row: 0 },
    { col: 1, row: 1 },
    { col: 0, row: 2 },
    { col: 2, row: 1 },
  ],
};

/** Клетки фигур; ряд больше пяти — «пять и остаток». */
export function countCells(layout: CountLayout | undefined, count: number): Cell[] {
  const l = layout ?? 'row';
  if (l === 'scatter' && SCATTER[count]) return SCATTER[count];
  if (count <= 5 && l === 'dice' && DICE[count]) return DICE[count];
  const cells: Cell[] = [];
  for (let i = 0; i < count; i++) cells.push({ col: i % 5, row: Math.floor(i / 5) });
  return cells;
}

export type Placed = { points: { x: number; y: number }[]; width: number; height: number };

/**
 * Центры фигур в pt внутри прямоугольника `width × height` (левый верхний угол — ноль): фигура
 * `figure`, шаг центров `step`. Вызывающий центрирует прямоугольник в своём поле.
 */
export function placeFigures(layout: CountLayout | undefined, count: number, { figure, step }: { figure: number; step: number }): Placed {
  const cells = countCells(layout, count);
  const cols = Math.max(...cells.map((c) => c.col)) + 1;
  const rows = Math.max(...cells.map((c) => c.row)) + 1;
  return {
    points: cells.map((c) => ({ x: figure / 2 + c.col * step, y: figure / 2 + c.row * step })),
    width: figure + (cols - 1) * step,
    height: figure + (rows - 1) * step,
  };
}
