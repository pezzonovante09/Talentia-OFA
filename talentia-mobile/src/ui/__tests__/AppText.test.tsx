import { fireEvent, renderWithProviders, screen } from '../../test/render';
import { lessonFontCaps, TITLE_MIN_SIZE, typography } from '../../design/tokens';
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
    expect(screen.getByTestId('t')).toHaveStyle({ fontSize: typography.title.size, fontFamily: 'Comfortaa_700Bold' });
    expect(screen.getByTestId('t').props.maxFontSizeMultiplier).toBe(lessonFontCaps.prompt);
    expect(screen.getByTestId('l')).toHaveStyle({ fontFamily: 'Nunito_800ExtraBold' });
    expect(screen.getByTestId('l').props.maxFontSizeMultiplier).toBe(lessonFontCaps.fixed);
    expect(screen.getByTestId('b').props.maxFontSizeMultiplier).toBe(lessonFontCaps.bubble);
  });

  it('fit="title": три строки → кегль опускается до TITLE_MIN_SIZE, не ниже', async () => {
    await renderWithProviders(
      <AppText role="title" fit="title" testID="t">
        Очень длинный заголовок
      </AppText>,
    );
    expect(screen.getByTestId('t').props.numberOfLines).toBe(2);
    await fireEvent(screen.getByTestId('t'), 'textLayout', { nativeEvent: { lines: [{}, {}, {}] } });
    expect(screen.getByTestId('t')).toHaveStyle({ fontSize: TITLE_MIN_SIZE, lineHeight: typography.subtitle.lineHeight });
  });

  it('fit="title": две строки — кегль не меняется', async () => {
    await renderWithProviders(
      <AppText role="title" fit="title" testID="t">
        Два ряда
      </AppText>,
    );
    await fireEvent(screen.getByTestId('t'), 'textLayout', { nativeEvent: { lines: [{}, {}] } });
    expect(screen.getByTestId('t')).toHaveStyle({ fontSize: typography.title.size });
  });
});
