/**
 * Первый запуск на чистой установке (docs/design/slice-screens-2026-10-24.md §1): одна карточка
 * «+ Добавить», одна `primary`, тап ребёнка открывает сеанс без записи и ведёт на карту; путь
 * взрослого ведёт в заглушку гейта с закрытием одним тапом; focus убирает Tali.
 */
import FirstRunScreen from '../index';
import { voice } from '../../src/services/voice';
import { useChildSession } from '../../src/state/childSession';
import { fireEvent, renderWithProviders, screen } from '../../src/test/render';

jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
  return { useRouter: () => router, Redirect: () => null, __router: router };
});
const mockReplace = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock } }).__router.replace;

beforeEach(() => {
  mockReplace.mockClear();
  voice.stop();
  useChildSession.getState().reset();
});

describe('первый запуск', () => {
  it('состав: Tali, заголовок, одна карточка «добавить», одна главная кнопка, подпись, вход для взрослых', async () => {
    await renderWithProviders(<FirstRunScreen />);
    expect(screen.getByTestId('tali')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Кто сегодня исследует?' })).toBeTruthy();
    expect(screen.getAllByTestId('profile-add')).toHaveLength(1);
    expect(screen.getByTestId('try-without-saving')).toBeTruthy();
    expect(screen.getByText('Прогресс не сохранится после закрытия')).toBeTruthy();
    expect(screen.getByTestId('for-adults')).toBeTruthy();
    // Единственная подушка у кнопки ребёнка: карточка пунктирная, вход для взрослых плоский.
    expect(screen.getAllByTestId(/-cushion$/)).toHaveLength(1);
    expect(voice.last?.key).toBe('firstRun.title');
  });

  it('«Попробовать без сохранения» открывает сеанс 5-6 без записи и ведёт на карту', async () => {
    await renderWithProviders(<FirstRunScreen />);
    await fireEvent.press(screen.getByTestId('try-without-saving'));
    const s = useChildSession.getState();
    expect(s.mode).toBe('no_record');
    expect(s.childId).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.settings.band).toBe('5-6');
    expect(s.settings.interfaceLang).toBe('ru');
    expect(mockReplace).toHaveBeenCalledWith('/map');
  });

  it('«+ Добавить»: голос «позови взрослого» и слой гейта, закрытие одним тапом', async () => {
    await renderWithProviders(<FirstRunScreen />);
    await fireEvent.press(screen.getByTestId('profile-add'));
    expect(voice.last?.key).toBe('firstRun.callAdult');
    expect(screen.getByTestId('adult-gate')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('adult-gate-close'));
    expect(screen.queryByTestId('adult-gate')).toBeNull();
    expect(useChildSession.getState().mode).toBe('none');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('«Для взрослых» тоже ведёт в гейт', async () => {
    await renderWithProviders(<FirstRunScreen />);
    await fireEvent.press(screen.getByTestId('for-adults'));
    expect(screen.getByTestId('adult-gate')).toBeTruthy();
  });

  it('focus: Tali нет, остальное на месте', async () => {
    await renderWithProviders(<FirstRunScreen />, { focusMode: true });
    expect(screen.queryByTestId('tali')).toBeNull();
    expect(screen.getByTestId('try-without-saving')).toBeTruthy();
  });

  it('en: строки переведены', async () => {
    await renderWithProviders(<FirstRunScreen />, { lng: 'en' });
    expect(screen.getByText('Try without saving')).toBeTruthy();
  });
});
