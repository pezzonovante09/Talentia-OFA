/**
 * Правило касания на поле `match` (2026-11-19, `abaSampleTap`): образец и метка над ним — без порога сдвига и любым
 * пальцем; у вариантов ответа — прежнее правило выбора (`abaChildTouch`: сдвиг < 10 pt, первый палец). Касание образца
 * зовёт только `onSample` — выбором оно не становится.
 */
import type { PromptVisualPlan } from '../../../../domain/abaPrompting';
import { abaChildTouch } from '../../../../design/abaTokens';
import { act, fireEvent, renderWithProviders, screen } from '../../../../test/render';
import { AbaClockProvider, manualClock } from '../../clock';
import { MatchField } from '../parts';

const FIELD = ['apple', 'pear', 'sock'];
const plan = (mark: boolean): PromptVisualPlan => ({
  focus: mark ? { on: 'sample', id: 'apple', pulse: false } : null,
  activeChoiceIds: FIELD,
  highlightCorrect: false,
  adultPhysical: false,
  plateMark: null,
});

async function mount({ mark = false, frameShownAt = 0, empty = false }: { mark?: boolean; frameShownAt?: number; empty?: boolean } = {}) {
  const clock = manualClock();
  const onSample = jest.fn();
  const onOption = jest.fn();
  await renderWithProviders(
    <AbaClockProvider clock={clock}>
      <MatchField
        sampleId="apple"
        field={FIELD}
        visual={plan(mark)}
        sampleTouched
        activeIds={FIELD}
        chosenId={null}
        sampleSize={160}
        choiceSize={96}
        frameShownAt={frameShownAt}
        empty={empty}
        onSample={onSample}
        onOption={onOption}
      />
    </AbaClockProvider>,
  );
  return { clock, onSample, onOption };
}

/** Касание со сдвигом `dx` пальцем `finger`: `ChildPressable` читает `pageX/pageY/identifier`. */
async function touch(testID: string, { dx = 0, finger = 0 }: { dx?: number; finger?: number } = {}) {
  const el = screen.getByTestId(testID);
  await fireEvent(el, 'pressIn', { nativeEvent: { pageX: 100, pageY: 100, identifier: finger } });
  await fireEvent(el, 'press', { nativeEvent: { pageX: 100 + dx, pageY: 100, identifier: finger } });
  await fireEvent(el, 'pressOut', { nativeEvent: { pageX: 100 + dx, pageY: 100, identifier: finger } });
}

describe('образец пробы match — касание, не выбор', () => {
  it('сдвиг на пороге выбора (10 pt) и 50 pt — касание образца засчитано', async () => {
    const { onSample } = await mount();
    await touch('aba-sample', { dx: abaChildTouch.maxSlopPt });
    await touch('aba-sample', { dx: 50 });
    expect(onSample).toHaveBeenCalledTimes(2);
  });

  it('второй палец (первый держит телефон) — касание образца засчитано', async () => {
    const { onSample } = await mount();
    await touch('aba-sample', { finger: 1, dx: 12 });
    expect(onSample).toHaveBeenCalledTimes(1);
  });

  it('касание, начатое до показа кадра, — не засчитано', async () => {
    const { clock, onSample } = await mount({ frameShownAt: manualClock().now() + 500 });
    await touch('aba-sample');
    expect(onSample).not.toHaveBeenCalled();
    await act(async () => clock.advance(500));
    await touch('aba-sample');
    expect(onSample).toHaveBeenCalledTimes(1);
  });

  it('касание образца и метки не зовёт выбор варианта', async () => {
    const { onSample, onOption } = await mount({ mark: true });
    await touch('aba-sample', { dx: 50 });
    await touch('aba-sample-mark', { dx: 50 });
    expect(onSample).toHaveBeenCalledTimes(2);
    expect(onOption).not.toHaveBeenCalled();
  });
});

describe('метка над образцом в пробе match', () => {
  it('без метки (L0) элемента нет', async () => {
    await mount({ mark: false });
    expect(screen.queryByTestId('aba-sample-mark')).toBeNull();
  });

  it('с меткой: касание метки — касание образца, одно событие на касание', async () => {
    const { onSample, onOption } = await mount({ mark: true });
    await touch('aba-sample-mark');
    expect(onSample).toHaveBeenCalledTimes(1);
    expect(onOption).not.toHaveBeenCalled();
  });

  it('межпробная пауза (пустые плиты): метки нет', async () => {
    await mount({ mark: true, empty: true });
    expect(screen.queryByTestId('aba-sample-mark')).toBeNull();
  });
});

describe('варианты ответа — прежнее правило выбора', () => {
  it('сдвиг меньше 10 pt — выбор засчитан, с id варианта', async () => {
    const { onOption } = await mount();
    await touch('aba-option-1', { dx: 9 });
    expect(onOption).toHaveBeenCalledTimes(1);
    expect(onOption.mock.calls[0][0]).toBe('pear');
  });

  it.each([10, 12, 50])('сдвиг %i pt — выбор не засчитан', async (dx) => {
    const { onOption, onSample } = await mount();
    await touch('aba-option-0', { dx });
    expect(onOption).not.toHaveBeenCalled();
    expect(onSample).not.toHaveBeenCalled();
  });

  it('второй палец — выбор не засчитан', async () => {
    const { onOption } = await mount();
    await touch('aba-option-0', { finger: 1 });
    expect(onOption).not.toHaveBeenCalled();
  });

  it('касание, начатое до показа кадра, — выбор не засчитан', async () => {
    const { onOption } = await mount({ frameShownAt: manualClock().now() + 500 });
    await touch('aba-option-0');
    expect(onOption).not.toHaveBeenCalled();
  });
});
