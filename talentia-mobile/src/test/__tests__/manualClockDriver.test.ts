/**
 * Драйвер ручных часов тестов ABA (`src/test/manualClockDriver.ts`): выключатель `kill()` из `afterEach` останавливает
 * циклы теста, переживший таймаут, — иначе он двигал бы часы и экран следующего теста (каскад падений, REBUILD.md).
 */
import { manualClockDriver } from '../manualClockDriver';

describe('manualClockDriver', () => {
  it('tick двигает часы и будит сроки по порядку', async () => {
    const d = manualClockDriver();
    const clock = d.start(1_000);
    const seen: number[] = [];
    clock.at(1_300, () => seen.push(1_300));
    clock.at(1_100, () => seen.push(1_100));
    await d.tick(500);
    expect([clock.now(), seen]).toEqual([1_500, [1_100, 1_300]]);
  });

  it('после kill() шаги не двигают часы: цикл мёртвого теста стоит', async () => {
    const d = manualClockDriver();
    const clock = d.start(0);
    d.kill();
    await d.tick(1_000);
    await d.stepTo(5_000);
    expect(clock.now()).toBe(0);
  });

  it('kill() посреди stepTo останавливает цикл на ближайшем шаге', async () => {
    const d = manualClockDriver();
    const clock = d.start(0);
    clock.at(200, () => d.kill());
    await d.stepTo(10_000, 100);
    expect(clock.now()).toBe(200);
  });

  it('новые часы посреди теста (start) останавливают циклы прежних', async () => {
    const d = manualClockDriver();
    const old = d.start(0);
    old.at(300, () => {
      d.start(50_000);
    });
    await d.stepTo(10_000, 100);
    expect(old.now()).toBe(300);
    expect(d.clock.now()).toBe(50_000);
    await d.tick(10);
    expect([old.now(), d.clock.now()]).toEqual([300, 50_010]);
  });

  it('tickUntilWith шагает, пока условие не выполнится, и не дольше max шагов', async () => {
    const d = manualClockDriver();
    const clock = d.start(0);
    await d.tickUntilWith(() => clock.now() >= 750, 250, 10);
    expect(clock.now()).toBe(750);
    await expect(d.tickUntilWith(() => false, 250, 3)).rejects.toThrow();
    expect(clock.now()).toBe(1_500);
  });

  it('до start() часов нет: обращение к clock — понятная ошибка, шаги — без действия', async () => {
    const d = manualClockDriver();
    await expect(d.tick(100)).resolves.toBeUndefined();
    expect(() => d.clock).toThrow(/start\(\)/);
  });
});
