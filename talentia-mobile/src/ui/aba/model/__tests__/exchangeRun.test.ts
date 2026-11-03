/**
 * Обмен без кнопки «Получить!» (Ц3.4, №171; токены `abaExchange`): land → hold → fly со сдвигом 60 → received
 * 300 (calm 500) → open 360 (calm 0) → done. Время абсолютное, от показа кадра обмена.
 */
import { abaExchange, abaExchangeHoldMs, ABA_CONTROL_STROKE } from '../../../../design/abaTokens';
import { exchangeDepartAt, exchangeDueAt, exchangeEndsAt, exchangeView, startExchange, type ExchangeRun } from '../exchangeRun';

const T0 = 50_000;
const board = (cells = 5, calm = false): ExchangeRun => startExchange({ at: T0, cells, calm });
const v = (r: ExchangeRun, ms: number) => exchangeView(r, T0 + ms);
const BOLD = abaExchange.receivedStroke;

describe('токены обмена', () => {
  it('удержание: 600 при одной ячейке, 1000 при двух и больше', () => {
    expect([abaExchangeHoldMs(1), abaExchangeHoldMs(2), abaExchangeHoldMs(5)]).toEqual([600, 1000, 1000]);
  });

  it('сдвиг 60, полёт 360, «получено» 300 (calm 500), раскрытие 360, въезд 220, контур «получено» 6', () => {
    expect([abaExchange.fly.staggerMs, abaExchange.fly.ms, abaExchange.receivedHoldMs, abaExchange.calm.receivedHoldMs, abaExchange.openMs, abaExchange.landMs, BOLD]).toEqual([
      60, 360, 300, 500, 360, 220, 6,
    ]);
  });
});

describe('пять ячеек — хронометраж', () => {
  it('полная доска стоит до +1000: на 999 ни одна ячейка не пуста, ряд виден, контур 3', () => {
    expect(v(board(), 0)).toEqual({ stage: 'hold', tokenInCell: true, flown: 0, cardStroke: ABA_CONTROL_STROKE, rowVisible: true });
    expect(v(board(), 999)).toMatchObject({ stage: 'hold', flown: 0 });
  });

  it('ячейки пустеют слева направо в 1000 / 1060 / 1120 / 1180 / 1240', () => {
    const r = board();
    expect([0, 1, 2, 3, 4].map((i) => exchangeDepartAt(r, i) - T0)).toEqual([1000, 1060, 1120, 1180, 1240]);
    expect([1000, 1059, 1060, 1119, 1120, 1180, 1239, 1240].map((ms) => v(r, ms).flown)).toEqual([1, 1, 2, 2, 3, 4, 4, 5]);
    expect(v(r, 1000).stage).toBe('fly');
  });

  it('пока жетоны летят, контур карточки 3', () => {
    expect(v(board(), 1599)).toMatchObject({ stage: 'fly', flown: 5, cardStroke: ABA_CONTROL_STROKE, rowVisible: true });
  });

  it('последний долетел в 1600 — контур 6, ряд ещё виден', () => {
    expect(v(board(), 1600)).toMatchObject({ stage: 'received', flown: 5, cardStroke: BOLD, rowVisible: true });
    expect(v(board(), 1899)).toMatchObject({ stage: 'received', cardStroke: BOLD, rowVisible: true });
  });

  it('с 1900 ряд скрыт, контур 6 → 3 (раскрытие)', () => {
    expect(v(board(), 1900)).toMatchObject({ stage: 'open', cardStroke: ABA_CONTROL_STROKE, rowVisible: false });
    expect(v(board(), 2259).stage).toBe('open');
  });

  it('доступ — с 2260', () => {
    expect(exchangeEndsAt(board()) - T0).toBe(2260);
    expect(v(board(), 2260)).toMatchObject({ stage: 'done', rowVisible: false, cardStroke: ABA_CONTROL_STROKE });
  });
});

describe('пять ячеек — calm', () => {
  it('до 1000 доска полная', () => {
    expect(v(board(5, true), 999)).toMatchObject({ stage: 'hold', flown: 0, cardStroke: ABA_CONTROL_STROKE });
  });

  it('в 1000 одна смена кадра: все ячейки пусты и контур 6', () => {
    expect(v(board(5, true), 1000)).toEqual({ stage: 'received', tokenInCell: true, flown: 5, cardStroke: BOLD, rowVisible: true });
    expect(v(board(5, true), 1499)).toMatchObject({ stage: 'received', flown: 5, cardStroke: BOLD });
  });

  it('доступ в 1500, без раскрытия', () => {
    const r = board(5, true);
    expect(exchangeEndsAt(r) - T0).toBe(1500);
    expect(v(r, 1500).stage).toBe('done');
    expect([v(r, 1000), v(r, 1499), v(r, 1500)].map((x) => x.stage)).not.toContain('open');
  });

  it('calm: все жетоны вылетают разом', () => {
    const r = board(5, true);
    expect([0, 4].map((i) => exchangeDepartAt(r, i) - T0)).toEqual([1000, 1000]);
  });
});

describe('одна ячейка', () => {
  it('удержание 600: на 599 жетон в ячейке, в 600 вылетел', () => {
    const r = board(1);
    expect(v(r, 599)).toMatchObject({ stage: 'hold', flown: 0 });
    expect(v(r, 600)).toMatchObject({ stage: 'fly', flown: 1 });
  });

  it('хронометраж: «получено» 960, раскрытие 1260, доступ 1620', () => {
    const r = board(1);
    expect([v(r, 959).stage, v(r, 960).stage, v(r, 1260).stage]).toEqual(['fly', 'received', 'open']);
    expect(exchangeEndsAt(r) - T0).toBe(600 + 360 + 300 + 360);
  });

  it('calm: доступ в 600 + 500', () => {
    expect(exchangeEndsAt(board(1, true)) - T0).toBe(1100);
  });

  it('ноль ячеек считается одной', () => {
    expect(startExchange({ at: T0, cells: 0, calm: false }).cells).toBe(1);
    expect(exchangeEndsAt(startExchange({ at: T0, cells: 0, calm: false }))).toBe(exchangeEndsAt(board(1)));
  });
});

describe('жетон сопряжения (landFirst)', () => {
  const pairing = (calm = false) => startExchange({ at: T0, cells: 1, calm, landFirst: true });

  it('жетон въезжает 220 мс: до этого ячейка пуста, стадия land', () => {
    expect(v(pairing(), 0)).toMatchObject({ stage: 'land', tokenInCell: false, flown: 0 });
    expect(v(pairing(), 219)).toMatchObject({ stage: 'land', tokenInCell: false });
    expect(v(pairing(), 220)).toMatchObject({ stage: 'hold', tokenInCell: true, flown: 0 });
  });

  it('после въезда — удержание 600: вылет в 220 + 600, всё сдвинуто на 220', () => {
    const r = pairing();
    expect(exchangeDepartAt(r, 0) - T0).toBe(820);
    expect(v(r, 819).stage).toBe('hold');
    expect(exchangeEndsAt(r)).toBe(exchangeEndsAt(board(1)) + 220);
  });

  it('calm: въезда нет — жетон на месте сразу, удержание с начала кадра', () => {
    const r = pairing(true);
    expect(v(r, 0)).toMatchObject({ stage: 'hold', tokenInCell: true });
    expect(exchangeEndsAt(r) - T0).toBe(600 + 500);
  });
});

describe('удержание пути «с полной доски» (holdMs, №173)', () => {
  const path = (cells: number, calm = false) => startExchange({ at: T0, cells, calm, holdMs: abaExchange.fromFullBoard.holdMs });

  it('по умолчанию удержание — по числу ячеек (№171), в run оно записано', () => {
    expect([board(1).holdMs, board(2).holdMs, board(5).holdMs]).toEqual([600, 1000, 1000]);
    expect(startExchange({ at: T0, cells: 0, calm: false }).holdMs).toBe(600);
  });

  it('одна ячейка на пути с полной доски — 1000, а не 600: на 999 жетон в ячейке, в 1000 вылетел', () => {
    const r = path(1);
    expect(r.holdMs).toBe(1000);
    expect(v(r, 999)).toMatchObject({ stage: 'hold', flown: 0, tokenInCell: true });
    expect(v(r, 1000)).toMatchObject({ stage: 'fly', flown: 1 });
    expect(exchangeDepartAt(r, 0) - T0).toBe(1000);
  });

  it('одна ячейка: «получено» 1360, раскрытие 1660, доступ 2020; две — второй вылет 1060, доступ 2080', () => {
    expect(exchangeEndsAt(path(1)) - T0).toBe(1000 + 360 + 300 + 360);
    expect(exchangeDueAt(path(1), T0)! - T0).toBe(1000);
    expect([0, 1].map((i) => exchangeDepartAt(path(2), i) - T0)).toEqual([1000, 1060]);
    expect(exchangeEndsAt(path(2)) - T0).toBe(1000 + 60 + 360 + 300 + 360);
  });

  it('calm: полная доска 1000 и в calm, затем одна смена кадра и доступ через 500', () => {
    const r = path(1, true);
    expect(v(r, 999)).toMatchObject({ stage: 'hold', flown: 0 });
    expect(v(r, 1000)).toMatchObject({ stage: 'received', flown: 1, cardStroke: BOLD });
    expect(exchangeEndsAt(r) - T0).toBe(1500);
  });

  it('удержание пути не трогает въезд сопряжения: сдвиг 220 сохраняется', () => {
    const r = startExchange({ at: T0, cells: 1, calm: false, landFirst: true, holdMs: 1000 });
    expect(exchangeDepartAt(r, 0) - T0).toBe(220 + 1000);
  });
});

describe('exchangeDueAt — каждая граница кадра', () => {
  const walk = (r: ExchangeRun, from: number) => {
    const marks: number[] = [];
    for (let at: number | null = from; (at = exchangeDueAt(r, at)) !== null; ) marks.push(at - T0);
    return marks;
  };

  it('пять ячеек: 1000, 1060, 1120, 1180, 1240, 1600, 1900, 2260 — и конец', () => {
    expect(walk(board(), T0)).toEqual([1000, 1060, 1120, 1180, 1240, 1600, 1900, 2260]);
  });

  it('до показа кадра первый срок — сам показ (начало удержания)', () => {
    expect(exchangeDueAt(board(), T0 - 1)).toBe(T0);
  });

  it('срок строго после `at`: на самой границе — следующая', () => {
    expect(exchangeDueAt(board(), T0 + 1060)).toBe(T0 + 1120);
    expect(exchangeDueAt(board(), T0 + 1059)).toBe(T0 + 1060);
  });

  it('calm, пять ячеек: 1000, 1500 — и конец', () => {
    expect(walk(board(5, true), T0)).toEqual([1000, 1500]);
  });

  it('одна ячейка: 600, 960, 1260, 1620', () => {
    expect(walk(board(1), T0)).toEqual([600, 960, 1260, 1620]);
  });

  it('жетон сопряжения: 220, 820, 1180, 1480, 1840', () => {
    expect(walk(startExchange({ at: T0, cells: 1, calm: false, landFirst: true }), T0)).toEqual([220, 820, 1180, 1480, 1840]);
  });

  it('жетон сопряжения, calm: 600, 1100', () => {
    expect(walk(startExchange({ at: T0, cells: 1, calm: true, landFirst: true }), T0)).toEqual([600, 1100]);
  });

  it('после конца — null', () => {
    const r = board();
    expect(exchangeDueAt(r, exchangeEndsAt(r))).toBeNull();
    expect(exchangeDueAt(r, exchangeEndsAt(r) + 10_000)).toBeNull();
  });

  it('каждый срок меняет кадр: вид на сроке отличается от вида за 1 мс до него', () => {
    const r = board();
    for (let at: number | null = T0; (at = exchangeDueAt(r, at)) !== null; ) {
      expect(exchangeView(r, at)).not.toEqual(exchangeView(r, at - 1));
    }
  });
});
