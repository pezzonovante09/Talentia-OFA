/**
 * Обмен без кнопки «Получить!» (Ц3.4, №171; токены `abaExchange`) — одна модель для обмена сразу и на перерыве, в
 * конце и для жетона цикла сопряжения. Время — абсолютное, от показа кадра обмена `startedAt`:
 *
 * - `land` — только у жетона сопряжения (`landFirst`): жетон въезжает в ячейку `landMs` (calm — появляется на месте);
 * - `hold` — полная доска стоит `abaExchangeHoldMs(cells)`: 600 мс при одной ячейке, 1000 — при двух и больше;
 * - `fly` — жетоны уходят в центр карточки со сдвигом `staggerMs` слева направо; ячейка пустеет в момент вылета своего
 *   жетона, поэтому опустевшая доска объяснена полётом;
 * - `received` — последний долетел: контур карточки 3 → 6, `receivedHoldMs`;
 * - `open` — ряд исчез, контур 6 → 3, рамка карточки растёт в рамку сцены `openMs`;
 * - `done` — доступ начинается в `exchangeEndsAt`: с этого момента считается его время.
 *
 * Calm и reduce motion: в конце удержания одна смена кадра — все ячейки пусты и контур 6, `calm.receivedHoldMs`, затем
 * смена кадра на доступ (раскрытия нет).
 */
import { abaExchange, abaExchangeHoldMs, ABA_CONTROL_STROKE } from '../../../design/abaTokens';

export type ExchangeStage = 'land' | 'hold' | 'fly' | 'received' | 'open' | 'done';

export type ExchangeRun = { startedAt: number; cells: number; calm: boolean; landFirst: boolean };

export type ExchangeView = {
  stage: ExchangeStage;
  /** Жетон сопряжения уже в ячейке (у доски — всегда). */
  tokenInCell: boolean;
  /** Сколько ячеек слева уже пусты: их жетоны вылетели. */
  flown: number;
  cardStroke: number;
  rowVisible: boolean;
};

export function startExchange(input: { at: number; cells: number; calm: boolean; landFirst?: boolean }): ExchangeRun {
  return { startedAt: input.at, cells: Math.max(1, input.cells), calm: input.calm, landFirst: input.landFirst === true };
}

function times(r: ExchangeRun) {
  const holdAt = r.startedAt + (r.landFirst && !r.calm ? abaExchange.landMs : 0);
  const flyAt = holdAt + abaExchangeHoldMs(r.cells);
  const receivedAt = r.calm ? flyAt : flyAt + (r.cells - 1) * abaExchange.fly.staggerMs + abaExchange.fly.ms;
  const openAt = receivedAt + (r.calm ? abaExchange.calm.receivedHoldMs : abaExchange.receivedHoldMs);
  const endsAt = openAt + (r.calm ? 0 : abaExchange.openMs);
  return { holdAt, flyAt, receivedAt, openAt, endsAt };
}

/** Момент, когда открывается доступ. */
export const exchangeEndsAt = (r: ExchangeRun) => times(r).endsAt;

/** Момент вылета жетона ячейки `i` (calm — все разом). */
export const exchangeDepartAt = (r: ExchangeRun, i: number) => times(r).flyAt + (r.calm ? 0 : i * abaExchange.fly.staggerMs);

export function exchangeView(r: ExchangeRun, at: number): ExchangeView {
  const t = times(r);
  const stage: ExchangeStage =
    at >= t.endsAt ? 'done' : at >= t.openAt ? 'open' : at >= t.receivedAt ? 'received' : at >= t.flyAt ? 'fly' : at >= t.holdAt ? 'hold' : 'land';
  const flown = at < t.flyAt ? 0 : r.calm ? r.cells : Math.min(r.cells, Math.floor((at - t.flyAt) / abaExchange.fly.staggerMs) + 1);
  return {
    stage,
    tokenInCell: stage !== 'land',
    flown,
    cardStroke: stage === 'received' ? abaExchange.receivedStroke : ABA_CONTROL_STROKE,
    rowVisible: stage !== 'open' && stage !== 'done',
  };
}

/** Следующая смена кадра после `at`; `null` — обмен кончился. */
export function exchangeDueAt(r: ExchangeRun, at: number): number | null {
  const t = times(r);
  const departs = r.calm ? [] : Array.from({ length: r.cells - 1 }, (_, i) => exchangeDepartAt(r, i + 1));
  const marks = [t.holdAt, t.flyAt, ...departs, t.receivedAt, t.openAt, t.endsAt];
  return marks.filter((m) => m > at).sort((a, b) => a - b)[0] ?? null;
}
