/**
 * Настройки ребёнка (`app/parent/profile/[childId].tsx`): обычные настройки сохраняются сразу; смена
 * полосы — чувствительное действие: без свежего подтверждения открывается лист PIN, со свежим
 * (`can('change_band')`) — сразу `updateProfile`.
 */
import ChildSettingsScreen from '../profile/[childId]';
import { createLocalAccount } from '../../../src/services/local/account';
import { newProfile } from '../../../src/services/local/profiles';
import { sha256 } from '../../../src/services/digest';
import { randomBytes } from '../../../src/services/random';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { EMPTY_PROGRESS } from '../../../src/services/progressPort';
import { setDevice } from '../../../src/state/device';
import { useGate } from '../../../src/state/gate';
import { fakeDevice } from '../../../src/test/fakeDevice';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  const params = { childId: '' };
  return {
    __router: router,
    __params: params,
    useRouter: () => router,
    useLocalSearchParams: () => params,
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
const { __router: router, __params: params } = jest.requireMock('expo-router') as { __router: { back: jest.Mock; dismissAll: jest.Mock }; __params: { childId: string } };

const PIN = '295173';
const KID = '00000000-0000-4000-8000-0000000000d1';
const profile = newProfile({ childId: KID, band: '5-6', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z', name: 'Айдар' });
const updateProfile = jest.fn(async () => undefined);
let device = fakeDevice();

const render = () => renderWithProviders(<ParentThemeProvider><ChildSettingsScreen /></ParentThemeProvider>);
async function typePin(pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByTestId(`confirm-pin-keypad-${d}`));
}

beforeEach(async () => {
  jest.clearAllMocks();
  device = fakeDevice();
  setDevice(device);
  params.childId = KID;
  useGate.setState({ session: null });
  const accountId = await createLocalAccount(device, PIN, { randomBytes, digest: sha256 });
  useAccount.setState({ status: 'ready', accountId, db: null, profiles: [profile], consent: 'granted', updateProfile });
});

afterEach(() => setDevice(null));

describe('настройки ребёнка', () => {
  it('неизвестный childId → редирект на главную раздела', async () => {
    params.childId = 'nope';
    await render();
    expect(screen.getByTestId('redirect').props.children).toBe('/parent');
  });

  it('расширенная форма: длительность, вибрация, спокойный, фокус, звук; текущие значения профиля', async () => {
    await render();
    expect(screen.getByRole('header', { name: 'Настройки' })).toBeTruthy();
    expect(screen.getByTestId('profile-name').props.value).toBe('Айдар');
    expect(screen.getByTestId('profile-band-5-6').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('profile-minutes-10').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('profile-haptics-switch').props.value).toBe(false);
    expect(screen.getByTestId('profile-calm-switch').props.value).toBe(false);
    expect(screen.getByTestId('profile-focus-switch').props.value).toBe(false);
    expect(screen.getByTestId('profile-sound-switch').props.value).toBe(true);
  });

  it('язык профиля уходит и в идущую сессию этого ребёнка — карта под разделом переходит на него (№190)', async () => {
    useChildSession.getState().startAccountSession({ profile, snapshot: { ...EMPTY_PROGRESS }, now: new Date('2026-11-12T10:00:00.000Z') });
    try {
      await render();
      await fireEvent.press(screen.getByTestId('profile-lang-en'));
      expect(updateProfile).toHaveBeenCalledWith({ ...profile, interfaceLang: 'en' });
      expect(useChildSession.getState().settings.interfaceLang).toBe('en');
    } finally {
      useChildSession.getState().reset();
    }
  });

  it('язык профиля другого ребёнка идущую сессию не трогает', async () => {
    const other = newProfile({ childId: '00000000-0000-4000-8000-0000000000d2', band: '7', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z' });
    useChildSession.getState().startAccountSession({ profile: other, snapshot: { ...EMPTY_PROGRESS }, now: new Date('2026-11-12T10:00:00.000Z') });
    try {
      await render();
      await fireEvent.press(screen.getByTestId('profile-lang-en'));
      expect(useChildSession.getState().settings.interfaceLang).toBe('ru');
    } finally {
      useChildSession.getState().reset();
    }
  });

  it('обычная настройка сохраняется сразу без PIN: спокойный режим и длительность', async () => {
    await render();
    await fireEvent(screen.getByTestId('profile-calm-switch'), 'valueChange', true);
    expect(updateProfile).toHaveBeenCalledWith({ ...profile, calmMode: true });
    await fireEvent.press(screen.getByTestId('profile-minutes-20'));
    expect(updateProfile).toHaveBeenLastCalledWith({ ...profile, sessionMinutes: 20 });
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
  });

  it('смена полосы без свежего подтверждения: лист PIN, профиль не изменён', async () => {
    await render();
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
    await fireEvent.press(screen.getByTestId('profile-band-7'));
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Подтвердите, чтобы изменить' })).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('отмена на листе: полоса прежняя, лист закрыт', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('profile-band-7'));
    await fireEvent.press(screen.getByTestId('confirm-pin-cancel'));
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
    expect(updateProfile).not.toHaveBeenCalled();
    expect(screen.getByTestId('profile-band-5-6').props.accessibilityState).toEqual({ selected: true });
  });

  it('верный PIN на листе: полоса сохранена, лист закрыт, свежесть обновлена', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('profile-band-7'));
    await typePin(PIN);
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ ...profile, band: '7' }));
    await waitFor(() => expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull());
    expect(useGate.getState().can('change_band')).toBe(false); // confirm на закрытой сессии её не открывает
  });

  it('неверный PIN на листе: сообщение, лист остаётся, полоса не изменена', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('profile-band-7'));
    await typePin('000000');
    await waitFor(() => expect(screen.getByTestId('confirm-pin-error').props.children).toBe('Неверный PIN'));
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('со свежим подтверждением (can change_band) полоса меняется сразу, без листа', async () => {
    useGate.getState().open();
    await render();
    await fireEvent.press(screen.getByTestId('profile-band-9-10'));
    expect(updateProfile).toHaveBeenCalledWith({ ...profile, band: '9-10' });
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
  });

  it('открытый, но несвежий раздел: полоса через лист', async () => {
    const T0 = Date.now() - 6 * 60_000;
    useGate.setState({ session: { openedAt: T0, lastActivityAt: Date.now() - 1000, confirmedAt: T0 } });
    expect(useGate.getState().unlocked()).toBe(true);
    await render();
    await fireEvent.press(screen.getByTestId('profile-band-7'));
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('тап по текущей полосе ничего не делает', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('profile-band-5-6'));
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('«Назад» и «Готово» в шапке', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('settings-back'));
    expect(router.back).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('settings-done'));
    expect(router.dismissAll).toHaveBeenCalled();
  });
});
