import { act, fireEvent, renderWithProviders, screen } from '../../test/render';
import { lessonFontCaps, textFit, TITLE_MAX_LINES, TITLE_MIN_SIZE, typography } from '../../design/tokens';
import { AppText } from '../AppText';

describe('AppText', () => {
  it('роль задаёт шрифт, кегль и потолок системного масштаба', async () => {
    await renderWithProviders(
      <>
        <AppText role="title" testID="t">
          A
        </AppText>
        <AppText role="label" testID="l">
          B
        </AppText>
        <AppText role="body" testID="b">
          C
        </AppText>
      </>,
    );
    expect(screen.getByTestId('t')).toHaveStyle({ fontSize: typography.title.size, fontFamily: 'Nunito_800ExtraBold' });
    expect(screen.getByTestId('t').props.maxFontSizeMultiplier).toBe(lessonFontCaps.prompt);
    expect(screen.getByTestId('l')).toHaveStyle({ fontFamily: 'Nunito_800ExtraBold' });
    expect(screen.getByTestId('l').props.maxFontSizeMultiplier).toBe(lessonFontCaps.fixed);
    expect(screen.getByTestId('b').props.maxFontSizeMultiplier).toBe(lessonFontCaps.bubble);
  });

  const layout = (height: number) => fireEvent(screen.getByTestId('t'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 343, height } } });

  it('fit="title": при замере видна третья строка — onTextLayout её не отдал бы', async () => {
    await renderWithProviders(
      <AppText role="title" fit="title" testID="t">
        Заголовок
      </AppText>,
    );
    expect(screen.getByTestId('t').props.numberOfLines).toBe(TITLE_MAX_LINES + 1);
    expect(screen.getByTestId('t')).toHaveStyle({ opacity: 0 });
  });

  it('fit="title": три строки → кегль опускается до TITLE_MIN_SIZE, не ниже', async () => {
    await renderWithProviders(
      <AppText role="title" fit="title" testID="t">
        Очень длинный заголовок
      </AppText>,
    );
    await layout(3 * typography.title.lineHeight);
    expect(screen.getByTestId('t')).toHaveStyle({ fontSize: TITLE_MIN_SIZE, lineHeight: typography.subtitle.lineHeight, opacity: 1 });
    expect(screen.getByTestId('t').props.numberOfLines).toBe(TITLE_MAX_LINES);
  });

  it('fit="title": две строки при крупном шрифте переросли слот — тоже ужимаются и входят', async () => {
    await renderWithProviders(
      <AppText role="title" fit="title" testID="t">
        Два ряда
      </AppText>,
    );
    await layout(2 * typography.title.lineHeight * lessonFontCaps.prompt);
    expect(screen.getByTestId('t')).toHaveStyle({ fontSize: TITLE_MIN_SIZE });
    expect(2 * typography.subtitle.lineHeight * lessonFontCaps.prompt).toBeLessThanOrEqual(2 * typography.title.lineHeight);
  });

  it('fit="title": две строки — кегль не меняется, текст показан', async () => {
    await renderWithProviders(
      <AppText role="title" fit="title" testID="t">
        Два ряда
      </AppText>,
    );
    await layout(2 * typography.title.lineHeight);
    expect(screen.getByTestId('t')).toHaveStyle({ fontSize: typography.title.size, opacity: 1 });
  });

  it('fit="title": замер не пришёл — заголовок всё равно показывается', async () => {
    jest.useFakeTimers();
    try {
      await renderWithProviders(
        <AppText role="title" fit="title" testID="t">
          Заголовок
        </AppText>,
      );
      await act(async () => {
        jest.advanceTimersByTime(textFit.revealMax);
      });
      expect(screen.getByTestId('t')).toHaveStyle({ opacity: 1 });
    } finally {
      jest.useRealTimers();
    }
  });

  it('без fit — не прозрачен и лимита строк не получает', async () => {
    await renderWithProviders(
      <AppText role="title" testID="t">
        Заголовок
      </AppText>,
    );
    expect(screen.getByTestId('t').props.numberOfLines).toBeUndefined();
    expect(screen.getByTestId('t')).not.toHaveStyle({ opacity: 0 });
  });
});
