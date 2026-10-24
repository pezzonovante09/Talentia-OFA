/**
 * Первый запуск на чистой установке (docs/design/slice-screens-2026-10-24.md §1): одна карточка
 * «+ Добавить», одна `primary`, тап ребёнка открывает сеанс без записи и ведёт на карту; путь
 * взрослого ведёт в родительский раздел (гейт — слой его `_layout`); focus убирает Tali.
 * С аккаунтом: карточки детей, кнопки без записи нет, тап по карточке читает прогресс через порт.
 */
import FirstRunScreen from '../index';
import { newProfile } from '../../src/services/local/profiles';
import { EMPTY_PROGRESS, noRecordPort } from '../../src/services/progressPort';
import { voice } from '../../src/services/voice';
import { useAccount } from '../../src/state/account';
import { useChildSession } from '../../src/state/childSession';
import { setProgressPort } from '../../src/state/port';
import { fireEvent, renderWithProviders, screen } from '../../src/test/render';

jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
  return { useRouter: () => router, Redirect: () => null, __router: router };
});
const { replace: mockReplace, push: mockPush } = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock; push: jest.Mock } }).__router;

const KID = '00000000-0000-4000-8000-000000000031';
const profile = (childId: string, name = '') => newProfile({ childId, name, band: '5-6', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z' });
const withAccount = (profiles = [profile(KID, 'Айдар')], consent: 'granted' | 'outdated' = 'granted') =>
  useAccount.setState({ status: 'ready', accountId: 'acc', profiles, consent });

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  voice.stop();
  useChildSession.getState().reset();
  useAccount.setState({ status: 'none', accountId: null, db: null, profiles: [], consent: 'not_asked' });
  setProgressPort(noRecordPort);
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

  it('«+ Добавить» без аккаунта: голос «позови взрослого» и родительский раздел (первая настройка за его слоем)', async () => {
    await renderWithProviders(<FirstRunScreen />);
    await fireEvent.press(screen.getByTestId('profile-add'));
    expect(voice.last?.key).toBe('firstRun.callAdult');
    expect(mockPush).toHaveBeenCalledWith('/parent');
    expect(useChildSession.getState().mode).toBe('none');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('«Для взрослых» тоже ведёт в родительский раздел', async () => {
    await renderWithProviders(<FirstRunScreen />);
    await fireEvent.press(screen.getByTestId('for-adults'));
    expect(mockPush).toHaveBeenCalledWith('/parent');
  });

  describe('с аккаунтом на устройстве', () => {
    it('карточки детей и «+ Добавить»; кнопки без записи нет; безымянный — «Профиль N»', async () => {
      withAccount([profile(KID, 'Айдар'), profile('00000000-0000-4000-8000-000000000032')]);
      await renderWithProviders(<FirstRunScreen />);
      expect(screen.getByText('Айдар')).toBeTruthy();
      expect(screen.getByText('Профиль 2')).toBeTruthy();
      expect(screen.getByTestId('profile-add')).toBeTruthy();
      expect(screen.queryByTestId('try-without-saving')).toBeNull();
      expect(screen.queryByText('Прогресс не сохранится после закрытия')).toBeNull();
      await fireEvent.press(screen.getByTestId('profile-add'));
      expect(mockPush).toHaveBeenCalledWith('/parent/profile/new');
    });

    it('тап по карточке: прогресс из порта → сеанс с записью → карта', async () => {
      withAccount();
      const load = jest.fn(async () => ({ ...EMPTY_PROGRESS, lessonCounter: 2 }));
      setProgressPort({ load, commit: noRecordPort.commit });
      await renderWithProviders(<FirstRunScreen />);
      await fireEvent.press(screen.getByTestId('profile-1'));
      await screen.findByTestId('first-run');
      expect(load).toHaveBeenCalledWith(KID);
      const s = useChildSession.getState();
      expect(s.mode).toBe('account');
      expect(s.childId).toBe(KID);
      expect(s.progress.lessonCounter).toBe(2);
      expect(mockReplace).toHaveBeenCalledWith('/map');
    });

    it('устаревший текст согласия: вместо карты — повторное согласие, сеанс не открыт', async () => {
      withAccount(undefined, 'outdated');
      await renderWithProviders(<FirstRunScreen />);
      await fireEvent.press(screen.getByTestId('profile-1'));
      expect(mockPush).toHaveBeenCalledWith('/parent/reconsent');
      expect(useChildSession.getState().mode).toBe('none');
      expect(mockReplace).not.toHaveBeenCalled();
    });
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
