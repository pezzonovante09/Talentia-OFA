import { centerOffset, clampOffset, laneWidth, nodeCenter, taliAnchor, visibleLaneItems, type LaneGeometry } from '../mapLane';
import type { NodeState } from '../mapProgress';

const G: LaneGeometry = { node: 72, step: 100, inset: 24, wave: 16, tail: 96 };
const six = (open: number): NodeState[] => Array.from({ length: 6 }, (_, i) => (i < open ? 'done' : i === open ? 'open' : 'ahead'));

describe('visibleLaneItems', () => {
  it('чистая установка: повторение, доступный, два замка, хвост', () => {
    const items = visibleLaneItems(six(0), { visibleAhead: 2, focus: false, pointer: 0 });
    expect(items.map((i) => (i.kind === 'lesson' ? `${i.lesson}:${i.state}` : i.kind))).toEqual([
      'review',
      '0:open',
      '1:ahead',
      '2:ahead',
      'tail',
    ]);
    expect(items[items.length - 1]).toEqual({ kind: 'tail', index: 4 });
  });

  it('после трёх уроков: пройденные остаются плитами, впереди снова два замка', () => {
    const items = visibleLaneItems(six(3), { visibleAhead: 2, focus: false, pointer: 3 });
    expect(items.filter((i) => i.kind === 'lesson')).toHaveLength(6);
    expect(items.some((i) => i.kind === 'tail')).toBe(false);
  });

  it('все пройдены — хвоста нет', () => {
    const states = Array<NodeState>(6).fill('done');
    const items = visibleLaneItems(states, { visibleAhead: 2, focus: false, pointer: null });
    expect(items).toHaveLength(7);
  });

  it('focus: текущий узел и соседи, остальное — хвост', () => {
    const items = visibleLaneItems(six(2), { visibleAhead: 2, focus: true, pointer: 2 });
    expect(items.filter((i) => i.kind === 'lesson').map((i) => (i.kind === 'lesson' ? i.lesson : -1))).toEqual([1, 2, 3]);
    expect(items[items.length - 1].kind).toBe('tail');
  });

  it('позиции на ленте сквозные: индекс плиты = номер урока + 1', () => {
    const items = visibleLaneItems(six(1), { visibleAhead: 2, focus: false, pointer: 1 });
    for (const i of items) if (i.kind === 'lesson') expect(i.index).toBe(i.lesson + 1);
  });
});

describe('геометрия', () => {
  it('центры узлов идут шагом ≥ 88 и чередуют волну', () => {
    const a = nodeCenter(0, 200, G);
    const b = nodeCenter(1, 200, G);
    expect(b.x - a.x).toBe(G.step);
    expect(b.x - a.x).toBeGreaterThanOrEqual(88);
    expect(a.y).toBe(184);
    expect(b.y).toBe(216);
  });

  it('ширина ленты: с хвостом — до знака «?», без — до последней плиты', () => {
    const withTail = visibleLaneItems(six(0), { visibleAhead: 2, focus: false, pointer: 0 });
    const noTail = visibleLaneItems(Array<NodeState>(6).fill('done'), { visibleAhead: 2, focus: false, pointer: null });
    expect(laneWidth(withTail, G)).toBe(nodeCenter(3, 0, G).x + 36 + G.tail + G.inset);
    expect(laneWidth(noTail, G)).toBe(nodeCenter(6, 0, G).x + 36 + G.inset);
  });

  it('автоцентровка: цель в центре окна, края ленты не отрываются от краёв окна', () => {
    expect(centerOffset(1000, 375, 500)).toBe(375 / 2 - 500);
    expect(centerOffset(1000, 375, 50)).toBe(0);
    expect(centerOffset(1000, 375, 990)).toBe(375 - 1000);
    expect(centerOffset(300, 375, 150)).toBe(0);
  });

  it('clampOffset держит ленту в окне при панорамировании', () => {
    expect(clampOffset(50, 1000, 375)).toBe(0);
    expect(clampOffset(-900, 1000, 375)).toBe(-625);
    expect(clampOffset(-300, 1000, 375)).toBe(-300);
  });

  it('Tali слева-снизу от узла: зазор 16 до узла по горизонтали и ≥ 16 до предыдущей плиты по вертикали', () => {
    const prev = nodeCenter(0, 200, G);
    const node = nodeCenter(1, 200, G);
    const t = taliAnchor(node, { nodeSize: 72, tali: 96, gap: 16 });
    expect(node.x - 36 - (t.x + 96)).toBe(16);
    expect(t.y - (prev.y + 36)).toBeGreaterThanOrEqual(16);
    expect(t.y).toBeGreaterThan(node.y);
  });
});
