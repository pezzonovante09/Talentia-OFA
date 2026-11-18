/**
 * Модель L3 шага «коснись картинки» (финальная рецензия методиста 2026-11-18): вместо неподвижной точки — «нажатие»
 * в центр образца дважды (~1,2 с); в calm / reduce motion — две вспышки кадром по часам сессии, без движения.
 */
import { StyleSheet } from 'react-native';

import { abaSampleTouch } from '../../../../design/abaTokens';
import { act, renderWithProviders, screen } from '../../../../test/render';
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
