/**
 * Расписание ребёнку (решение методиста 34): счёт оставшихся рабочих блоков по очереди сессии.
 * Формы очередей — как их строит план (`startAbaSession`): блоки базовой линии, обучение через перерыв,
 * пробы поддержания и обобщения в конце, иногда за своим перерывом.
 */
import type { AbaSessionState } from '../abaSession';
import { blockSchedule, childSchedule } from '../abaBlockSchedule';

type Queue = AbaSessionState['queue'];
type Item = Queue[number];

const tr = (targetId: string, kind: 'teaching' | 'baseline' | 'maintenance' | 'high_p' = 'teaching'): Item =>
  ({ kind: 'trial', trial: { kind, targetId, exemplarId: 'e' } }) as Item;
const trials = (targetId: string, n: number, kind?: Parameters<typeof tr>[1]) => Array.from({ length: n }, () => tr(targetId, kind));
const end = (targetId: string): Item => ({ kind: 'block_end', targetId, participation: true });
const brk = (over: Partial<Extract<Item, { kind: 'break' }>> = {}): Item => ({ kind: 'break', ...over });

it('полный план: две базовые линии, два обучения через перерыв, пробы в конце — 4 блока', () => {
  const q: Queue = [
    { kind: 'reinforcer' },
    ...trials('hp', 2, 'high_p'),
    ...trials('b1', 3, 'baseline'),
    end('b1'),
    ...trials('b2', 3, 'baseline'),
    end('b2'),
    ...trials('t1', 5),
    end('t1'),
    brk(),
    ...trials('t2', 5),
    end('t2'),
    ...trials('m1', 1, 'maintenance'),
  ];
  expect(blockSchedule(q)).toEqual({ blocksLeft: 4, isLast: false });
});

it('A: после перерыва — блок и хвост проб без перерыва между ними: один, последний', () => {
  const q: Queue = [brk(), ...trials('t2', 5), end('t2'), ...trials('m1', 2, 'maintenance')];
  expect(blockSchedule(q)).toEqual({ blocksLeft: 1, isLast: true });
});

it('B: одно обучение — перерыв перед пробами в конце: пробы — свой блок, последний', () => {
  const q: Queue = [brk(), ...trials('m1', 2, 'maintenance')];
  expect(blockSchedule(q)).toEqual({ blocksLeft: 1, isLast: true });
});

it('C: перерыв по карточке посреди блока, потом перерыв и пробы — два, не последний', () => {
  const q: Queue = [brk({ initiatedBy: 'child_card' }), ...trials('t1', 3), end('t1'), brk(), ...trials('m1', 2, 'maintenance')];
  expect(blockSchedule(q)).toEqual({ blocksLeft: 2, isLast: false });
});

it('D: доигранный блок (его block_end без проб) не считается', () => {
  const q: Queue = [brk(), end('t1'), brk(), ...trials('t2', 5), end('t2')];
  expect(blockSchedule(q)).toEqual({ blocksLeft: 1, isLast: true });
});

it('E: работы не осталось — 0, расписания нет', () => {
  expect(blockSchedule([])).toEqual({ blocksLeft: 0, isLast: false });
  expect(blockSchedule([brk(), end('t1'), { kind: 'access', durationMs: 1000 }])).toEqual({ blocksLeft: 0, isLast: false });
});

it('перерыв в голове очереди (идёт сейчас) или уже снят — счёт тот же', () => {
  const rest: Queue = [...trials('t2', 5), end('t2'), brk(), ...trials('t3', 5), end('t3')];
  expect(blockSchedule([brk(), ...rest])).toEqual(blockSchedule(rest));
  expect(blockSchedule(rest).blocksLeft).toBe(2);
});

it('набор: две половины вокруг перерыва — два блока', () => {
  const q: Queue = [...trials('a', 3), ...trials('b', 3), { kind: 'block_end', targetId: 'set', participation: true, members: ['a', 'b'] }, brk(), ...trials('a', 3), { kind: 'block_end', targetId: 'set', participation: true, members: ['a', 'b'] }];
  expect(blockSchedule(q).blocksLeft).toBe(2);
});

it('доступ и выбор награды в очереди — не работа и не разрезают отрезок', () => {
  const q: Queue = [{ kind: 'access', durationMs: 1000 }, ...trials('t1', 2), { kind: 'reinforcer' }, ...trials('t1', 2), end('t1')];
  expect(blockSchedule(q)).toEqual({ blocksLeft: 1, isLast: true });
});

describe('награда «потом» — только выбранная и не устаревшая', () => {
  const rest: Queue = [...trials('t2', 5), end('t2')];
  it('выбрана — её id', () => {
    expect(childSchedule({ queue: rest, reinforcerId: 'bubbles' })).toEqual({ blocksLeft: 1, isLast: true, reinforcerId: 'bubbles' });
  });
  it('рутина обменяла жетоны (reinforcerStale) — прежней картинки нет', () => {
    expect(childSchedule({ queue: rest, reinforcerId: 'bubbles', reinforcerStale: true }).reinforcerId).toBeNull();
  });
  it('выбор из трёх стоит в очереди — прежней картинки нет', () => {
    expect(childSchedule({ queue: [{ kind: 'reinforcer' }, ...rest], reinforcerId: 'bubbles' }).reinforcerId).toBeNull();
  });
});
