/**
 * Новый профиль ребёнка (`app/parent/profile/new.tsx`): форма с полосой, языком и регионом; «Создать
 * профиль» зовёт `addProfile`, выбирает ребёнка в разделе и закрывает раздел. Имя необязательно (№101).
 */
import NewProfileScreen from '../profile/new';
import { newProfile, type ChildProfile } from '../../../src/services/local/profiles';
import { useAccount } from '../../../src/state/account';
import { useParentView } from '../../../src/state/parentView';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  return { useRouter: () => router, Redirect: () => null, __router: router };
});
const router = (jest.requireMock('expo-router') as { __router: { back: jest.Mock; dismissAll: jest.Mock } }).__router;

const KID = '00000000-0000-4000-8000-0000000000b1';
const existing = newProfile({ childId: '00000000-0000-4000-8000-0000000000b0', band: '7', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z', name: 'Айдар' });

const addProfile = jest.fn(async (p: Omit<ChildProfile, 'childId' | 'createdAt'>): Promise<ChildProfile> => ({ ...p, childId: KID, createdAt: '2026-10-25T10:00:00.000Z' }));

const render = (lng: 'ru' | 'en' | 'ky' = 'ru') => renderWithProviders(<ParentThemeProvider><NewProfileScreen /></ParentThemeProvider>, { lng });

beforeEach(() => {
  jest.clearAllMocks();
  useParentView.setState({ childId: null });
  useAccount.setState({ status: 'ready', accountId: 'acc', db: null, profiles: [], consent: 'granted', addProfile });
});

describe('новый профиль', () => {
  it('состав: заголовок, поле имени с подсказкой, полоса 5–6 по умолчанию, язык экрана, регион выключен', async () => {
    await render();
    expect(screen.getByTestId('parent-profile-new')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Новый профиль' })).toBeTruthy();
    expect(screen.getByTestId('profile-name').props.value).toBe('');
    expect(screen.getAllByText('Можно оставить пустым. Настоящее имя не нужно').length).toBeGreaterThan(0);
    expect(screen.getByTestId('profile-band-5-6').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('profile-lang-ru').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('profile-kyrgyz-switch').props.value).toBe(false);
  });

  it('первый ребёнок: кнопки «Назад» нет — уходить некуда', async () => {
    await render();
    expect(screen.queryByTestId('profile-back')).toBeNull();
  });

  it('есть другие дети: «Назад» возвращает на предыдущий экран', async () => {
    useAccount.setState({ profiles: [existing] });
    await render();
    await fireEvent.press(screen.getByTestId('profile-back'));
    expect(router.back).toHaveBeenCalled();
    expect(addProfile).not.toHaveBeenCalled();
  });

  it('пустое имя допустимо: addProfile с name "", select нового ребёнка, dismissAll', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('profile-create'));
    await waitFor(() => expect(router.dismissAll).toHaveBeenCalled());
    expect(addProfile).toHaveBeenCalledTimes(1);
    expect(addProfile.mock.calls[0][0]).toMatchObject({ name: '', band: '5-6', interfaceLang: 'ru', kyrgyzRegion: false, hapticsEnabled: false, sessionMinutes: 10 });
    expect(useParentView.getState().childId).toBe(KID);
  });

  it('заполненная форма: имя, полоса 9–10, язык en, регион включён — всё уходит в addProfile', async () => {
    await render();
    await fireEvent.changeText(screen.getByTestId('profile-name'), 'Айгерим');
    await fireEvent.press(screen.getByTestId('profile-band-9-10'));
    await fireEvent.press(screen.getByTestId('profile-lang-en'));
    await fireEvent(screen.getByTestId('profile-kyrgyz-switch'), 'valueChange', true);
    expect(screen.getByTestId('profile-band-9-10').props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(screen.getByTestId('profile-create'));
    await waitFor(() => expect(addProfile).toHaveBeenCalledTimes(1));
    expect(addProfile.mock.calls[0][0]).toMatchObject({ name: 'Айгерим', band: '9-10', interfaceLang: 'en', kyrgyzRegion: true });
  });

  /** Ж17 (`localization-qa` по диффу этапа C): язык без полного словаря профилю не предлагается — «Кыргызча» вернётся с `ky.json`. */
  it('выбор языка — только языки с полным словарём: ky нет, пока ky.json пуст', async () => {
    await render();
    expect(screen.getByTestId('profile-lang-ru')).toBeTruthy();
    expect(screen.getByTestId('profile-lang-en')).toBeTruthy();
    expect(screen.queryByTestId('profile-lang-ky')).toBeNull();
  });

  it('язык профиля по умолчанию — язык экрана', async () => {
    await render('en');
    expect(screen.getByTestId('profile-lang-en').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('header', { name: 'New profile' })).toBeTruthy();
  });

  /**
   * Баг: `onPress` кнопки «Создать профиль» — `try { await addProfile } finally {}` без `catch`.
   * Отказ записи (например, `ProfileConsentRequiredError`, если согласие отозвано/устарело) уходит
   * необработанным отклонением промиса: родитель не видит ни ошибки, ни причины, в dev — LogBox.
   * Ошибка перехватывается и показывается (`parent.failed`), раздел не закрыт. См. отчёт.
   */
  it('ошибка записи: раздел не закрывается, ребёнок не выбран, ошибка не уходит необработанной', async () => {
    useAccount.setState({ addProfile: jest.fn(async () => Promise.reject(new Error('нет согласия'))) });
    await render();
    await fireEvent.press(screen.getByTestId('profile-create'));
    await waitFor(() => expect(screen.getByTestId('profile-create').props.accessibilityState.disabled).toBe(false));
    expect(router.dismissAll).not.toHaveBeenCalled();
    expect(useParentView.getState().childId).toBeNull();
    expect(screen.getByTestId('profile-error')).toBeTruthy();
  });
});
