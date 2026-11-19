/**
 * Гейт родительского раздела в памяти (`state/gate.ts` поверх `domain/parentGate.ts`): открытие
 * после PIN, продление касанием, закрытие уходом в фон и бездействием, окно свежести для
 * чувствительных действий, повторное подтверждение. Время передаётся явно — таймеры не нужны.
 */
import { FRESH_CONFIRM_MS, IDLE_CLOSE_MS } from '../../domain/parentGate';
import { useGate } from '../gate';

const T0 = Date.parse('2026-10-25T10:00:00.000Z');
const gate = () => useGate.getState();

beforeEach(() => useGate.setState({ session: null }));

describe('открытие и закрытие', () => {
  it('до ввода PIN раздел закрыт', () => {
    expect(gate().session).toBeNull();
    expect(gate().unlocked(T0)).toBe(false);
  });

  it('open: раздел открыт и остаётся открытым до порога бездействия', () => {
    gate().open(T0);
    expect(gate().unlocked(T0)).toBe(true);
    expect(gate().unlocked(T0 + IDLE_CLOSE_MS - 1)).toBe(true);
  });

  it('ровно IDLE_CLOSE_MS без касаний — раздел закрыт', () => {
    gate().open(T0);
    expect(gate().unlocked(T0 + IDLE_CLOSE_MS)).toBe(false);
  });

  it('touch продлевает сессию от момента касания', () => {
    gate().open(T0);
    gate().touch(T0 + IDLE_CLOSE_MS - 1000);
    expect(gate().unlocked(T0 + IDLE_CLOSE_MS + 30_000)).toBe(true);
    expect(gate().unlocked(T0 + IDLE_CLOSE_MS - 1000 + IDLE_CLOSE_MS)).toBe(false);
  });

  it('touch после порога бездействия не воскрешает закрытую сессию', () => {
    gate().open(T0);
    gate().touch(T0 + IDLE_CLOSE_MS + 1);
    expect(gate().session).toBeNull();
    expect(gate().unlocked(T0 + IDLE_CLOSE_MS + 2)).toBe(false);
  });

  it('touch без сессии — остаётся null', () => {
    gate().touch(T0);
    expect(gate().session).toBeNull();
  });

  it('lock (уход в фон) закрывает сразу, без окна', () => {
    gate().open(T0);
    gate().lock();
    expect(gate().session).toBeNull();
    expect(gate().unlocked(T0 + 1)).toBe(false);
  });

  it('повторный open после lock — новая сессия с новым временем подтверждения', () => {
    gate().open(T0);
    gate().lock();
    gate().open(T0 + 10 * 60_000);
    expect(gate().session).toEqual({ openedAt: T0 + 10 * 60_000, lastActivityAt: T0 + 10 * 60_000, confirmedAt: T0 + 10 * 60_000 });
  });
});

describe('окно свежести для чувствительных действий', () => {
  it('сразу после open — gate_fresh действия разрешены без нового PIN', () => {
    gate().open(T0);
    expect(gate().can('change_band', T0 + 1000)).toBe(true);
    expect(gate().can('clear_progress', T0 + 1000)).toBe(true);
    expect(gate().can('delete_child', T0 + 1000)).toBe(true);
  });

  it('закрытый раздел — ничего нельзя', () => {
    expect(gate().can('change_band', T0)).toBe(false);
    expect(gate().can('clear_progress', T0)).toBe(false);
  });

  it('касания держат раздел открытым, но не обновляют свежесть: через FRESH_CONFIRM_MS — нельзя', () => {
    gate().open(T0);
    // касания каждую минуту — раздел живёт, confirmedAt не меняется
    for (let m = 1; m <= 6; m += 1) gate().touch(T0 + m * 60_000);
    const at = T0 + FRESH_CONFIRM_MS + 1;
    expect(gate().unlocked(at)).toBe(true);
    expect(gate().can('change_band', at)).toBe(false);
  });

  it('граница окна: ровно FRESH_CONFIRM_MS после подтверждения — ещё можно', () => {
    gate().open(T0);
    for (let m = 1; m <= 5; m += 1) gate().touch(T0 + m * 60_000);
    expect(gate().can('change_band', T0 + FRESH_CONFIRM_MS)).toBe(true);
  });

  it('confirm обновляет свежесть и продлевает сессию', () => {
    gate().open(T0);
    for (let m = 1; m <= 4; m += 1) gate().touch(T0 + m * 60_000);
    gate().confirm(T0 + 5 * 60_000);
    const confirmedAt = T0 + 5 * 60_000;
    expect(gate().session).toEqual({ openedAt: T0, lastActivityAt: confirmedAt, confirmedAt });
    // раздел держится касаниями, свежесть отсчитывается от confirm
    for (let m = 1; m <= 5; m += 1) gate().touch(confirmedAt + m * 60_000);
    expect(gate().can('clear_progress', confirmedAt + FRESH_CONFIRM_MS)).toBe(true);
    expect(gate().can('clear_progress', confirmedAt + FRESH_CONFIRM_MS + 1)).toBe(false);
  });

  it('confirm на закрытом разделе не открывает его', () => {
    gate().confirm(T0);
    expect(gate().session).toBeNull();
    gate().open(T0);
    gate().confirm(T0 + IDLE_CLOSE_MS + 1);
    expect(gate().session).toBeNull();
  });

  it('delete_account (gate_now) — нельзя даже в свежей сессии: PIN вводится на месте', () => {
    gate().open(T0);
    gate().confirm(T0);
    expect(gate().can('delete_account', T0)).toBe(false);
  });
});

describe('значения по умолчанию', () => {
  it('без аргумента now методы берут текущее время и ведут себя согласованно', () => {
    gate().open();
    expect(gate().unlocked()).toBe(true);
    expect(gate().can('change_band')).toBe(true);
    gate().lock();
    expect(gate().unlocked()).toBe(false);
  });
});
