import { countSilhouette } from '../countLayout';
import { countCells, placeFigures } from '../countPositions';

const key = (cells: { col: number; row: number }[]) =>
  cells
    .map((c) => `${c.col},${c.row}`)
    .sort()
    .join(' ');

describe('countCells', () => {
  it('ряд до пяти — одна строка; больше — «пять и остаток» по левому краю', () => {
    expect(countCells('row', 3).map((c) => c.row)).toEqual([0, 0, 0]);
    const seven = countCells('row', 7);
    expect(seven.filter((c) => c.row === 0)).toHaveLength(5);
    expect(seven.filter((c) => c.row === 1).map((c) => c.col)).toEqual([0, 1]);
    expect(countSilhouette('row', 7)).toBe('five-and:2');
  });

  it('россыпь не совпадает с кубиком того же числа и не вырождается в линию', () => {
    for (const n of [2, 3, 4, 5]) {
      expect(key(countCells('scatter', n))).not.toBe(key(countCells('dice', n)));
      const cells = countCells('scatter', n);
      if (n >= 3) {
        const cols = new Set(cells.map((c) => c.col)).size;
        const rows = new Set(cells.map((c) => c.row)).size;
        expect(cols > 1 && rows > 1).toBe(true);
      }
    }
  });

  it('россыпь 2 — не угол-угол', () => {
    const [a, b] = countCells('scatter', 2);
    expect(Math.abs(a.col - b.col) === 2 && Math.abs(a.row - b.row) === 2).toBe(false);
  });

  it('кубик 1–5 — классические узоры, 5 — «конверт»', () => {
    expect(key(countCells('dice', 5))).toBe('0,0 0,2 1,1 2,0 2,2');
    expect(key(countCells('dice', 1))).toBe('1,1');
  });
});

describe('placeFigures', () => {
  it('стимул: кучка 10 — 232 × 88 (5 × 40 + 4 × 8; две строки через 48)', () => {
    const p = placeFigures('row', 10, { figure: 40, step: 48 });
    expect(p.width).toBe(232);
    expect(p.height).toBe(88);
    expect(p.points[0]).toEqual({ x: 20, y: 20 });
    expect(p.points[5]).toEqual({ x: 20, y: 68 });
  });

  it('плитка: сетка 3×3 из клеток 28 входит в поле 80', () => {
    const p = placeFigures('dice', 5, { figure: 24, step: 28 });
    expect(p.width).toBe(80);
    expect(p.height).toBe(80);
    expect(placeFigures('row', 3, { figure: 24, step: 28 }).width).toBe(80);
  });
});
