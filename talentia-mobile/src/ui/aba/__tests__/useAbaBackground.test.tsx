/**
 * Сворачивание на экранах ABA (`useAbaBackground`): уход и возврат по `AppState`, в том числе уход, случившийся, пока
 * подписка выключена (экран грузился): событие `background` тогда никто не слышал, уход отмечается по
 * `AppState.currentState`, как только экран включил подписку.
 */
import type { ReactNode } from 'react';

import { appStateFake } from '../../../test/appStateFake';
import { act, renderHook } from '../../../test/render';
import { AbaClockProvider, manualClock, type ManualClock } from '../clock';
import { useAbaBackground } from '../useAbaBackground';

const appState = appStateFake({ syncCurrentState: true });
/** Событие AppState: как на устройстве, `currentState` обновляется раньше подписчиков. */
const emit = appState.emit;
let clock: ManualClock;
const onLeave = jest.fn();
const onReturn = jest.fn();

function mount(enabled: boolean) {
  const wrapper = ({ children }: { children: ReactNode }) => <AbaClockProvider clock={clock}>{children}</AbaClockProvider>;
  return renderHook((p: { enabled: boolean }) => useAbaBackground({ enabled: p.enabled, onLeave, onReturn }), { initialProps: { enabled }, wrapper });
}

beforeEach(() => {
  onLeave.mockClear();
  onReturn.mockClear();
  clock = manualClock();
  appState.install();
  appState.setCurrent('active');
});

afterEach(() => {
  appState.restore();
});

it('уход, пока подписка выключена: при включении onLeave один раз с моментом включения', async () => {
  const { rerender } = await mount(false);
  await emit('background');
  expect(onLeave).not.toHaveBeenCalled();
  const at = clock.now();
  await rerender({ enabled: true });
  expect(onLeave.mock.calls).toEqual([[at]]);
});

it('после ухода по включению active вызывает onReturn один раз', async () => {
  const { rerender } = await mount(false);
  await emit('background');
  await rerender({ enabled: true });
  await act(async () => clock.advance(5000));
  await emit('active');
  await emit('active');
  expect(onReturn.mock.calls).toEqual([[clock.now()]]);
  expect(onLeave).toHaveBeenCalledTimes(1);
});

it('уход по включению не отмечается второй раз: ни событием background, ни перерисовкой', async () => {
  const { rerender } = await mount(false);
  await emit('background');
  await rerender({ enabled: true });
  await emit('background');
  await rerender({ enabled: true });
  expect(onLeave).toHaveBeenCalledTimes(1);
});

it('подписка выключилась и снова включилась, пока свёрнуто: уход один', async () => {
  const { rerender } = await mount(true);
  await emit('background');
  await rerender({ enabled: false });
  await rerender({ enabled: true });
  expect(onLeave).toHaveBeenCalledTimes(1);
});

it('включение на активном приложении: ухода нет', async () => {
  const { rerender } = await mount(false);
  await rerender({ enabled: true });
  expect(onLeave).not.toHaveBeenCalled();
});

it('ушли и вернулись, пока подписка выключена: при включении ухода нет, возврата тоже', async () => {
  const { rerender } = await mount(false);
  await emit('background');
  await emit('active');
  await rerender({ enabled: true });
  expect([onLeave.mock.calls.length, onReturn.mock.calls.length]).toEqual([0, 0]);
});

it('смонтирован уже в фоне с включённой подпиской: onLeave один раз, active — onReturn', async () => {
  appState.setCurrent('background');
  await mount(true);
  expect(onLeave).toHaveBeenCalledTimes(1);
  await emit('active');
  expect(onReturn).toHaveBeenCalledTimes(1);
});

it('обычный цикл: background — onLeave, inactive игнорируется, active — onReturn', async () => {
  await mount(true);
  await emit('inactive');
  expect(onLeave).not.toHaveBeenCalled();
  await emit('background');
  await emit('inactive');
  expect(onLeave).toHaveBeenCalledTimes(1);
  expect(onReturn).not.toHaveBeenCalled();
  await emit('active');
  expect(onReturn).toHaveBeenCalledTimes(1);
});

it('active без ухода — не возврат', async () => {
  await mount(true);
  await emit('active');
  expect(onReturn).not.toHaveBeenCalled();
});
