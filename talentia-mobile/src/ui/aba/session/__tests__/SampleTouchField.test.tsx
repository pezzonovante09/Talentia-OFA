/**
 * Модель L3 шага «коснись картинки» (финальная рецензия методиста 2026-11-18): вместо неподвижной точки — «нажатие»
 * в центр образца дважды (~1,2 с); в calm / reduce motion — две вспышки кадром по часам сессии, без движения.
 */
import { StyleSheet } from 'react-native';

import { abaSampleTouch } from '../../../../design/abaTokens';
import { act, fireEvent, renderWithProviders, screen } from '../../../../test/render';
import { AbaClockProvider, manualClock } from '../../clock';
import { SampleTouchField } from '../SampleTouchField';

const m = abaSampleTouch.model;

async function mount(props: Partial<Parameters<typeof SampleTouchField>[0]> = {}) {
  const clock = manualClock();
  await renderWithProviders(
    <AbaClockProvider clock={clock}>
      <SampleTouchField sampleId="apple" level={3} touched={false} sampleSize={160} frameShownAt={0} onSample={jest.fn()} {...props} />
    </AbaClockProvider>,
  );
  return clock;
}

const style = () => StyleSheet.flatten(screen.getByTestId('aba-touch-model').props.style) as { opacity: number; transform?: unknown[] };

describe('модель L3 шага «коснись картинки»', () => {
  it('ход ~1,2 с: два «нажатия» (появилась → вжалась → погасла)', () => {
    expect(m.presses).toBe(2);
    expect(m.presses * (m.appearMs + m.pressMs + m.fadeMs)).toBe(1200);
    expect(m.toScale).toBeLessThan(1);
    expect(m.fromScale).toBeGreaterThan(m.toScale);
  });

  it('с движением: метка с масштабом, касаний не перехватывает', async () => {
    await mount();
    const model = screen.getByTestId('aba-touch-model');
    expect(model.props.pointerEvents).toBe('none');
    expect(style().transform).toHaveLength(1);
  });

  it('still: две вспышки кадром по часам сессии, без масштаба; потом метки не видно', async () => {
    const clock = await mount({ still: true });
    expect(style().transform).toEqual([]);
    const seen: number[] = [];
    await act(async () => clock.advance(0));
    seen.push(style().opacity);
    for (const ms of [m.stillOnMs, m.stillOffMs, m.stillOnMs, m.stillOffMs]) {
      await act(async () => clock.advance(ms));
      seen.push(style().opacity);
    }
    const on = abaSampleTouch.handDotOpacity;
    expect(seen).toEqual([on, 0, on, 0, 0]);
    expect(clock.pending()).toBe(0);
  });

  it('новое предъявление L3 — ход заново; касание или не L3 — метки нет', async () => {
    const clock = await mount({ still: true, levelStartedAt: 1 });
    await act(async () => clock.advance(m.presses * (m.stillOnMs + m.stillOffMs)));
    expect(style().opacity).toBe(0);
    await screen.rerender(
      <AbaClockProvider clock={clock}>
        <SampleTouchField sampleId="apple" level={3} touched={false} sampleSize={160} frameShownAt={0} onSample={jest.fn()} still levelStartedAt={2} />
      </AbaClockProvider>,
    );
    await act(async () => clock.advance(0));
    expect(style().opacity).toBe(abaSampleTouch.handDotOpacity);
    await screen.rerender(
      <AbaClockProvider clock={clock}>
        <SampleTouchField sampleId="apple" level={3} touched sampleSize={160} frameShownAt={0} onSample={jest.fn()} still levelStartedAt={2} />
      </AbaClockProvider>,
    );
    expect(screen.queryByTestId('aba-touch-model')).toBeNull();
    expect(clock.pending()).toBe(0);
  });

  it('L1 — метки модели нет', async () => {
    await mount({ level: 1 });
    expect(screen.queryByTestId('aba-touch-model')).toBeNull();
  });
});

// методист 2026-11-19: модель в одном кадре с новой картинкой (первое предъявление — сразу L3) идёт через `modelDelayMs`
describe('задержка модели L3 (`modelDelayMs`)', () => {
  const D = abaSampleTouch.modelDelayMs;
  const on = abaSampleTouch.handDotOpacity;

  it('still: до задержки метки не видно, в задержку — первая вспышка, дальше ход как без задержки', async () => {
    const clock = await mount({ still: true, modelDelayMs: D });
    await act(async () => clock.advance(0));
    expect(style().opacity).toBe(0);
    await act(async () => clock.advance(D - 1));
    expect(style().opacity).toBe(0);
    await act(async () => clock.advance(1));
    expect(style().opacity).toBe(on);
    const seen: number[] = [];
    for (const ms of [m.stillOnMs, m.stillOffMs, m.stillOnMs]) {
      await act(async () => clock.advance(ms));
      seen.push(style().opacity);
    }
    expect(seen).toEqual([0, on, 0]);
    expect(clock.pending()).toBe(0);
  });

  it('still, без задержки (эскалация до L3): первая вспышка сразу', async () => {
    const clock = await mount({ still: true });
    await act(async () => clock.advance(0));
    expect(style().opacity).toBe(on);
  });

  it('still: касание до начала модели снимает её — отложенных вспышек не остаётся', async () => {
    const clock = await mount({ still: true, modelDelayMs: D });
    await act(async () => clock.advance(D - 100));
    await screen.rerender(
      <AbaClockProvider clock={clock}>
        <SampleTouchField sampleId="apple" level={3} touched sampleSize={160} frameShownAt={0} onSample={jest.fn()} still modelDelayMs={D} />
      </AbaClockProvider>,
    );
    expect(screen.queryByTestId('aba-touch-model')).toBeNull();
    expect(clock.pending()).toBe(0);
  });
});

// `abaSampleTap` (2026-11-19): касание образца — не выбор; метка L1 над образцом — та же зона касания
describe('касание образца и метки на шаге', () => {
  /** Касание со сдвигом `dx` пальцем `finger`: `ChildPressable` читает `pageX/pageY/identifier`. */
  async function touch(testID: string, { dx = 0, finger = 0 }: { dx?: number; finger?: number } = {}) {
    const el = screen.getByTestId(testID);
    await fireEvent(el, 'pressIn', { nativeEvent: { pageX: 100, pageY: 100, identifier: finger } });
    await fireEvent(el, 'press', { nativeEvent: { pageX: 100 + dx, pageY: 100, identifier: finger } });
    await fireEvent(el, 'pressOut', { nativeEvent: { pageX: 100 + dx, pageY: 100, identifier: finger } });
  }

  it('L0: метки над образцом нет — нажимать нечего', async () => {
    await mount({ level: 0 });
    expect(screen.getByTestId('aba-sample')).toBeTruthy();
    expect(screen.queryByTestId('aba-sample-mark')).toBeNull();
    expect(screen.queryByTestId('aba-hint-chevron')).toBeNull();
  });

  it.each([1, 3] as const)('L%i: метка есть, касание метки — касание образца', async (level) => {
    const onSample = jest.fn();
    await mount({ level, onSample });
    expect(screen.getByTestId('aba-sample-mark')).toBeTruthy();
    await touch('aba-sample-mark');
    expect(onSample).toHaveBeenCalledTimes(1);
  });

  it.each(['aba-sample', 'aba-sample-mark'])('%s: сдвиг 10 pt и больше засчитывается', async (id) => {
    const onSample = jest.fn();
    await mount({ level: 1, onSample });
    await touch(id, { dx: 10 });
    await touch(id, { dx: 50 });
    expect(onSample).toHaveBeenCalledTimes(2);
  });

  it.each(['aba-sample', 'aba-sample-mark'])('%s: второй палец засчитывается', async (id) => {
    const onSample = jest.fn();
    await mount({ level: 1, onSample });
    await touch(id, { finger: 1 });
    expect(onSample).toHaveBeenCalledTimes(1);
  });

  it.each(['aba-sample', 'aba-sample-mark'])('%s: касание, начатое до показа кадра, не засчитывается', async (id) => {
    const onSample = jest.fn();
    // часы теста стоят на своём старте: кадр «показан» секундой позже
    const clock = await mount({ level: 1, onSample, frameShownAt: manualClock().now() + 1000 });
    await touch(id);
    expect(onSample).not.toHaveBeenCalled();
    await act(async () => clock.advance(1000));
    await touch(id);
    expect(onSample).toHaveBeenCalledTimes(1);
  });

  it('время касания образца — по часам сессии в момент отпускания', async () => {
    const onSample = jest.fn();
    const clock = await mount({ level: 0, onSample });
    await act(async () => clock.advance(700));
    await touch('aba-sample', { dx: 30 });
    expect(onSample).toHaveBeenCalledWith(clock.now());
  });
});
