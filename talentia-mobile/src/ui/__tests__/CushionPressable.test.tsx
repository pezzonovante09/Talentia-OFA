import { fireEvent, renderWithProviders, screen } from '../../test/render';
import { elevation, elevationCalm, lessonTiming } from '../../design/tokens';
import { CushionPressable } from '../CushionPressable';

const press = async (testID: string) => {
  await fireEvent(screen.getByTestId(testID), 'pressIn');
  await fireEvent(screen.getByTestId(testID), 'pressOut');
  await fireEvent.press(screen.getByTestId(testID));
};

describe('CushionPressable', () => {
  it('роль с подушкой: подушка есть, высота фигуры + смещение подушки', async () => {
    await renderWithProviders(<CushionPressable role="control" width={88} height={88} radius="pill" fill="primary" accessibilityLabel="x" testID="b" />);
    expect(screen.getByTestId('b-cushion')).toBeTruthy();
    expect(screen.getByTestId('b')).toHaveStyle({ height: 88 + elevation.raised.offsetY });
  });

  it('в calm подушка тоньше (2), контур 2', async () => {
    await renderWithProviders(<CushionPressable role="control" width={88} height={88} radius="pill" fill="primary" accessibilityLabel="x" testID="b" />, { calmMode: true });
    expect(screen.getByTestId('b')).toHaveStyle({ height: 88 + elevationCalm.raised.offsetY });
    expect(screen.getByTestId('b-face')).toHaveStyle({ borderWidth: 2 });
  });

  it('пунктир «здесь пусто» — без подушки даже у роли с подушкой', async () => {
    await renderWithProviders(<CushionPressable role="control" dashed width={160} height={160} radius={28} fill="surfaceSunken" accessibilityLabel="x" testID="b" />);
    expect(screen.queryByTestId('b-cushion')).toBeNull();
    expect(screen.getByTestId('b-face')).toHaveStyle({ borderStyle: 'dashed' });
  });

  it('«выбрано» — контур 6 цветом primary', async () => {
    await renderWithProviders(<CushionPressable role="answerOption" selected width={104} height={112} radius={28} fill="surface" accessibilityLabel="x" testID="b" />);
    expect(screen.getByTestId('b-face')).toHaveStyle({ borderWidth: 6 });
    expect(screen.getByTestId('b')).toBeSelected();
  });

  it('guardMs: повторный тап в окне защиты не срабатывает', async () => {
    const onPress = jest.fn();
    const now = jest.spyOn(Date, 'now');
    await renderWithProviders(<CushionPressable role="control" width={88} height={88} radius="pill" fill="primary" guardMs={lessonTiming.nextGuard} onPress={onPress} accessibilityLabel="x" testID="b" />);
    now.mockReturnValue(1000);
    await press('b');
    now.mockReturnValue(1000 + lessonTiming.nextGuard - 1);
    await press('b');
    expect(onPress).toHaveBeenCalledTimes(1);
    now.mockReturnValue(1000 + lessonTiming.nextGuard + 1);
    await press('b');
    expect(onPress).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it('disabled не вызывает onPress', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<CushionPressable role="control" disabled width={88} height={88} radius="pill" fill="primary" onPress={onPress} accessibilityLabel="x" testID="b" />);
    await press('b');
    expect(onPress).not.toHaveBeenCalled();
  });
});
