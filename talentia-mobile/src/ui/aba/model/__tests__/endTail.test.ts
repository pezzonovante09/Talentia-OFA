/**
 * Хвост конца сессии (раздел 9, №169): обмен в конце → доступ по ступени доски → «Закончили»; цикл сопряжения →
 * ожидание с неактивной «Готово» → жетон → доступ 20 с → «Закончили»; иначе — сразу «Закончили».
 */
import { EXCHANGE_ACCESS_MS, PAIRING } from '../../../../domain/abaTokenTraining';
import type { AbaSessionEvent } from '../../../../types/aba';
import { endTail } from '../endTail';

const AT = '2026-11-02T08:00:00.000Z';
const pairing: AbaSessionEvent = { kind: 'pairing', at: AT };
const assent: AbaSessionEvent = { kind: 'assent', at: AT, by: 'adult_observed', action: 'end' };

describe('обмен в конце', () => {
  it('экран обмена, доступ по ступени, «Закончили»', () => {
    expect(endTail({ exchanged: 3, boardSize: 3, events: [] })).toEqual([
      { kind: 'exchange', tokens: 3, boardSize: 3 },
      { kind: 'access', durationMs: EXCHANGE_ACCESS_MS[3] },
      { kind: 'end' },
    ]);
  });

  it.each([
    [1, 20_000],
    [2, 20_000],
    [3, 40_000],
    [5, 60_000],
  ])('доска %i — доступ %i мс', (boardSize, ms) => {
    expect(endTail({ exchanged: boardSize, boardSize, events: [] })[1]).toEqual({ kind: 'access', durationMs: ms });
  });

  it('размер доски вне ступеней — доступ как на доске 3, без undefined', () => {
    expect(endTail({ exchanged: 4, boardSize: 4, events: [] })[1]).toEqual({ kind: 'access', durationMs: EXCHANGE_ACCESS_MS[3] });
  });

  it('жетоны сверх доски уходят в обмен: tokens — сколько обменяно, ячеек — по размеру доски', () => {
    expect(endTail({ exchanged: 5, boardSize: 3, events: [] })[0]).toEqual({ kind: 'exchange', tokens: 5, boardSize: 3 });
  });

  it('обмен и событие сопряжения вместе (домен так не пишет, №169) — только обмен, без второго доступа', () => {
    const tail = endTail({ exchanged: 3, boardSize: 3, events: [pairing] });
    expect(tail.map((s) => s.kind)).toEqual(['exchange', 'access', 'end']);
  });
});

describe('цикл сопряжения', () => {
  it('без обмена и с событием pairing: ожидание, жетон, доступ 20 с, «Закончили»', () => {
    expect(endTail({ exchanged: 0, boardSize: 3, events: [assent, pairing] })).toEqual([
      { kind: 'wait', ms: PAIRING.tokenAfterMs },
      { kind: 'pairing_token' },
      { kind: 'access', durationMs: PAIRING.accessMs },
      { kind: 'end' },
    ]);
  });

  it('ожидание — 10 с, доступ — 20 с', () => {
    const tail = endTail({ exchanged: 0, boardSize: 3, events: [pairing] });
    expect([tail[0], tail[2]]).toEqual([
      { kind: 'wait', ms: 10_000 },
      { kind: 'access', durationMs: 20_000 },
    ]);
  });

  it('длительность доступа сопряжения не зависит от размера доски', () => {
    const access = (boardSize: number) => endTail({ exchanged: 0, boardSize, events: [pairing] })[2];
    expect(access(1)).toEqual(access(5));
  });
});

describe('ни обмена, ни сопряжения', () => {
  it('сразу «Закончили»', () => {
    expect(endTail({ exchanged: 0, boardSize: 3, events: [assent] })).toEqual([{ kind: 'end' }]);
  });

  it('пустой журнал — сразу «Закончили»', () => {
    expect(endTail({ exchanged: 0, boardSize: 0, events: [] })).toEqual([{ kind: 'end' }]);
  });
});
