/**
 * Драйвер ручных часов экранов ABA (`manualClock` из `src/ui/aba/clock.tsx`) для тестов: шаги часов внутри `act`.
 *
 * Jest не прерывает функцию теста по таймауту: её цикл продолжил бы двигать часы и экран уже следующего теста (каскад
 * падений при таймауте одного — REBUILD.md). Поэтому у драйвера есть выключатель: `afterEach` зовёт `kill()`, а шаги
 * идут только часами своего теста (`my`) и только пока он жив. Новые часы (`start`) — новый тест: циклы прежних часов
 * останавливаются, даже если тест сменил часы посреди себя.
 */
import { manualClock, type ManualClock } from '../ui/aba/clock';
import { act } from './render';

export type ManualClockDriver = {
  /** Часы текущего теста; до первого `start()` — ошибка. */
  readonly clock: ManualClock;
  /** Новые часы теста (`beforeEach` или посреди теста — другая дата); драйвер оживает. */
  start(startMs?: number): ManualClock;
  /** Выключатель для `afterEach`: циклы `tick` / `stepTo` / `tickUntilWith` этого теста больше не шагают. */
  kill(): void;
  /** Тест жив и `my` — его текущие часы. */
  alive(my: ManualClock): boolean;
  /** Сдвинуть часы на `ms` внутри `act`. */
  tick(ms: number): Promise<void>;
  /**
   * Дойти до момента `to` шагами не длиннее `step`: ручные часы будят один срок экрана за шаг (следующий ставится после
   * рендера), поэтому шаг короче расстояния между сроками — и каждый кадр приходит ровно в свой срок.
   */
  stepTo(to: number, step?: number): Promise<void>;
  /** Шагать по `step`, пока условие не выполнится (не дольше `max` шагов); цикл останавливается вместе с тестом. */
  tickUntilWith(pred: () => boolean, step: number, max: number): Promise<void>;
};

export function manualClockDriver(): ManualClockDriver {
  let current: ManualClock | null = null;
  let dead = true;
  const alive = (my: ManualClock) => !dead && current === my;
  const tick = async (ms: number) => {
    const my = current;
    if (my === null || !alive(my)) return;
    await act(async () => my.advance(ms));
  };
  return {
    get clock() {
      if (current === null) throw new Error('manualClockDriver: часы не запущены — start() в beforeEach');
      return current;
    },
    start(startMs?: number) {
      current = manualClock(startMs);
      dead = false;
      return current;
    },
    kill() {
      dead = true;
    },
    alive,
    tick,
    async stepTo(to: number, step = 20) {
      const my = current;
      if (my === null) return;
      while (alive(my) && my.now() < to) await tick(Math.min(step, to - my.now()));
    },
    async tickUntilWith(pred: () => boolean, step: number, max: number) {
      const my = current;
      for (let i = 0; my !== null && i < max && alive(my) && !pred(); i += 1) await tick(step);
      expect(pred()).toBe(true);
    },
  };
}
