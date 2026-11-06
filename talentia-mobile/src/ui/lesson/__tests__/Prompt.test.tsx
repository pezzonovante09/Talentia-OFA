import { useWindowDimensions } from 'react-native';

import { act, fireEvent, renderWithProviders, screen } from '../../../test/render';
import { lessonFontCaps, lessonLayout, PROMPT_MAX_LINES, PROMPT_MIN_LINE_HEIGHT, PROMPT_MIN_SIZE, textFit, typography } from '../../../design/tokens';
import { Prompt } from '../LessonChrome';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const setFontScale = (fontScale: number) => {
  jest.mocked(useWindowDimensions).mockReturnValue({ width: 375, height: 667, scale: 2, fontScale });
};

const text = () => screen.getByTestId('lesson-prompt-text');
const layout = (height: number) => fireEvent(text(), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 343, height } } });

const expectBase = (cap: number) => {
  expect(text()).toHaveStyle({ fontSize: typography.subtitle.size, lineHeight: typography.subtitle.lineHeight });
  expect(text().props.maxFontSizeMultiplier).toBe(cap);
};
const expectSmall = () => {
  expect(text()).toHaveStyle({ fontSize: PROMPT_MIN_SIZE, lineHeight: PROMPT_MIN_LINE_HEIGHT, opacity: 1 });
  expect(text().props.maxFontSizeMultiplier).toBe(lessonFontCaps.promptFallback);
  expect(text().props.numberOfLines).toBe(PROMPT_MAX_LINES);
};

describe('Prompt: вид вопроса под слот 72', () => {
  it('каждая ступень в полной высоте входит в слот', () => {
    const { lineHeight } = typography.subtitle;
    expect(2 * lineHeight * lessonFontCaps.prompt).toBeLessThanOrEqual(lessonLayout.prompt + 1e-9);
    expect(2 * lineHeight * lessonFontCaps.promptFallback).toBeLessThanOrEqual(lessonLayout.prompt);
    expect(PROMPT_MAX_LINES * PROMPT_MIN_LINE_HEIGHT * lessonFontCaps.promptFallback).toBeLessThanOrEqual(lessonLayout.prompt);
  });

  it('×1: две строки остаются 22/30', async () => {
    setFontScale(1);
    await renderWithProviders(<Prompt text="Сколько яблок?" />);
    expect(text()).toHaveStyle({ opacity: 0 });
    await layout(60);
    expectBase(lessonFontCaps.prompt);
    expect(text()).toHaveStyle({ opacity: 1 });
  });

  it('×1: третья строка сразу включает 18/24 без масштаба — средней ступени нет, высота бы не изменилась', async () => {
    setFontScale(1);
    await renderWithProviders(<Prompt text="Вопрос в три строки основного вида" />);
    await layout(90);
    expectSmall();
  });

  it('×1.2: две строки ровно в слоте и с округлением остаются крупными', async () => {
    setFontScale(1.2);
    await renderWithProviders(<Prompt text="Сколько яблок?" />);
    await layout(72.33);
    expectBase(lessonFontCaps.prompt);
    expect(text()).toHaveStyle({ opacity: 1 });
  });

  it('×1.2: не вошло — сначала 22/30 без масштаба, не мельче обычного шрифта', async () => {
    setFontScale(1.2);
    await renderWithProviders(<Prompt text="Вопрос подлиннее" />);
    await layout(108);
    expectBase(lessonFontCaps.promptFallback);
    expect(text()).toHaveStyle({ opacity: 0 });
    await layout(60);
    expectBase(lessonFontCaps.promptFallback);
    expect(text()).toHaveStyle({ opacity: 1 });
  });

  it('×1.2: не вошло и без масштаба — 18/24', async () => {
    setFontScale(1.2);
    await renderWithProviders(<Prompt text="Очень длинный вопрос" />);
    await layout(108);
    await layout(90);
    expectSmall();
  });

  it('новый вопрос подбирает вид заново и не наследует 18/24', async () => {
    setFontScale(1);
    await renderWithProviders(<Prompt text="Очень длинный вопрос" />);
    await layout(90);
    expectSmall();

    await screen.rerender(<Prompt text="Короткий" />);
    expectBase(lessonFontCaps.prompt);
    expect(text()).toHaveStyle({ opacity: 0 });
    await layout(30);
    expect(text()).toHaveStyle({ opacity: 1 });
  });

  it('другой системный шрифт подбирает вид заново', async () => {
    setFontScale(1);
    await renderWithProviders(<Prompt text="Вопрос" />);
    await layout(90);
    expectSmall();

    setFontScale(0.9);
    await screen.rerender(<Prompt text="Вопрос" />);
    expectBase(lessonFontCaps.prompt);
  });

  it('замер не пришёл — вопрос всё равно показывается', async () => {
    jest.useFakeTimers();
    try {
      setFontScale(1);
      await renderWithProviders(<Prompt text="Вопрос" />);
      expect(text()).toHaveStyle({ opacity: 0 });
      await act(async () => {
        jest.advanceTimersByTime(textFit.revealMax);
      });
      expect(text()).toHaveStyle({ opacity: 1 });
    } finally {
      jest.useRealTimers();
    }
  });
});
