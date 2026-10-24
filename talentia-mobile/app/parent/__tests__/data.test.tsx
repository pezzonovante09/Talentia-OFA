/**
 * «Данные» (`app/parent/data.tsx`) и подтверждение разрушительного действия
 * (`app/parent/confirm/[action].tsx`): строки ведут в confirm с нужным action; кнопка действия
 * открывает лист PIN; после верного PIN — нужный сервис и переход. Сервисы удаления мокаются,
 * PIN проверяется настоящим `checkPin` на `fakeDevice()`.
 */
import ConfirmScreen from '../confirm/[action]';
import DataScreen from '../data';
import { createLocalAccount } from '../../../src/services/local/account';
import { newProfile } from '../../../src/services/local/profiles';
import type { SqlDb } from '../../../src/services/local/sql';
import { sha256 } from '../../../src/services/digest';
import { noRecordPort } from '../../../src/services/progressPort';
import { randomBytes } from '../../../src/services/random';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { setDevice } from '../../../src/state/device';
import { useGate } from '../../../src/state/gate';
import { useParentView } from '../../../src/state/parentView';
import { setProgressPort } from '../../../src/state/port';
import { fakeDevice } from '../../../src/test/fakeDevice';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  const params = { action: '' as string | undefined };
  return {
    __router: router,
    __params: params,
    useRouter: () => router,
    useLocalSearchParams: () => params,
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
jest.mock('../../../src/services/local/purge', () => ({
  ...jest.requireActual<object>('../../../src/services/local/purge'),
  clearChildProgress: jest.fn(async () => undefined),
}));
jest.mock('../../../src/services/local/deleteEverywhere', () => ({
  ...jest.requireActual<object>('../../../src/services/local/deleteEverywhere'),
  deleteChildEverywhere: jest.fn(async () => []),
  wipeAccountEverywhere: jest.fn(async () => []),
}));
jest.mock('../../../src/services/local/expoSqlite', () => ({
  openLocalDb: jest.fn(),
  deleteLocalDb: jest.fn(async () => undefined),
}));

const { __router: router, __params: params } = jest.requireMock('expo-router') as { __router: { push: jest.Mock; back: jest.Mock; replace: jest.Mock }; __params: { action: string | undefined } };
const { clearChildProgress } = jest.requireMock('../../../src/services/local/purge') as { clearChildProgress: jest.Mock };
const { deleteChildEverywhere, wipeAccountEverywhere } = jest.requireMock('../../../src/services/local/deleteEverywhere') as { deleteChildEverywhere: jest.Mock; wipeAccountEverywhere: jest.Mock };
const { deleteLocalDb } = jest.requireMock('../../../src/services/local/expoSqlite') as { deleteLocalDb: jest.Mock };

const PIN = '295173';
const KID1 = '00000000-0000-4000-8000-0000000000e1';
const KID2 = '00000000-0000-4000-8000-0000000000e2';
const p1 = newProfile({ childId: KID1, band: '5-6', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z', name: 'Айдар' });
const p2 = newProfile({ childId: KID2, band: '7', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z' });
/** Сервисы замоканы — базе достаточно быть узнаваемым объектом. */
const db = { tag: 'db' } as unknown as SqlDb;

let device = fakeDevice();
let accountId = '';

const renderData = () => renderWithProviders(<ParentThemeProvider><DataScreen /></ParentThemeProvider>);
const renderConfirm = (action: string | undefined) => {
  params.action = action;
  return renderWithProviders(<ParentThemeProvider><ConfirmScreen /></ParentThemeProvider>);
};
async function typePin(pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByTestId(`confirm-pin-keypad-${d}`));
}
async function confirmWithPin() {
  await fireEvent.press(screen.getByTestId('confirm-action'));
  expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
  await typePin(PIN);
}

beforeEach(async () => {
  jest.clearAllMocks();
  device = fakeDevice();
  setDevice(device);
  setProgressPort(noRecordPort);
  useChildSession.getState().reset();
  useParentView.setState({ childId: null });
  useGate.setState({ session: null });
  accountId = await createLocalAccount(device, PIN, { randomBytes, digest: sha256 });
  useAccount.setState({ status: 'ready', accountId, db, profiles: [p1, p2], consent: 'granted' });
});

afterEach(() => setDevice(null));

describe('экран «Данные»', () => {
  it('экспорт — заглушка; три разрушительные строки ведут в confirm со своим action', async () => {
    await renderData();
    expect(screen.getByTestId('export-soon')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('row-clear'));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/parent/confirm/[action]', params: { action: 'clear_progress' } });
    await fireEvent.press(screen.getByTestId('row-delete-child'));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/parent/confirm/[action]', params: { action: 'delete_child' } });
    await fireEvent.press(screen.getByTestId('row-delete-account'));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/parent/confirm/[action]', params: { action: 'delete_account' } });
    await fireEvent.press(screen.getByTestId('data-back'));
    expect(router.back).toHaveBeenCalled();
  });
});

describe('подтверждение', () => {
  it('неизвестный action → редирект на «Данные»', async () => {
    await renderConfirm('format_disk');
    expect(screen.getByTestId('redirect').props.children).toBe('/parent/data');
  });

  it('без action → редирект на «Данные»', async () => {
    await renderConfirm(undefined);
    expect(screen.getByTestId('redirect').props.children).toBe('/parent/data');
  });

  it('заголовок называет ребёнка; «Отмена» и «Назад» — назад; лист PIN до нажатия не показан', async () => {
    await renderConfirm('clear_progress');
    expect(screen.getByRole('header', { name: 'Очистить прогресс: Айдар?' })).toBeTruthy();
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
    await fireEvent.press(screen.getByTestId('confirm-cancel'));
    await fireEvent.press(screen.getByTestId('confirm-back'));
    expect(router.back).toHaveBeenCalledTimes(2);
    expect(clearChildProgress).not.toHaveBeenCalled();
  });

  it('безымянный ребёнок в заголовке — «Профиль 2»', async () => {
    useParentView.setState({ childId: KID2 });
    await renderConfirm('delete_child');
    expect(screen.getByRole('header', { name: 'Удалить профиль: Профиль 2?' })).toBeTruthy();
  });

  it('кнопка действия открывает лист PIN даже при свежем гейте: окно свежести здесь не действует', async () => {
    useGate.getState().open();
    await renderConfirm('clear_progress');
    await fireEvent.press(screen.getByTestId('confirm-action'));
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Введите PIN, чтобы подтвердить' })).toBeTruthy();
    expect(clearChildProgress).not.toHaveBeenCalled();
  });

  it('неверный PIN: действие не выполняется, лист остаётся', async () => {
    await renderConfirm('clear_progress');
    await fireEvent.press(screen.getByTestId('confirm-action'));
    await typePin('000000');
    await waitFor(() => expect(screen.getByTestId('confirm-pin-error').props.children).toBe('Неверный PIN'));
    expect(clearChildProgress).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
  });

  it('clear_progress: clearChildProgress(db, выбранный ребёнок), сеанс этого ребёнка сброшен, назад', async () => {
    useChildSession.getState().startNoRecordSession({ childId: KID1, now: new Date(), interfaceLang: 'ru' });
    await renderConfirm('clear_progress');
    await confirmWithPin();
    await waitFor(() => expect(clearChildProgress).toHaveBeenCalledWith(db, KID1));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(useChildSession.getState().mode).toBe('none');
    expect(deleteChildEverywhere).not.toHaveBeenCalled();
    expect(useAccount.getState().profiles).toHaveLength(2);
  });

  it('clear_progress другого ребёнка не трогает открытый сеанс', async () => {
    useChildSession.getState().startNoRecordSession({ childId: KID2, now: new Date(), interfaceLang: 'ru' });
    await renderConfirm('clear_progress');
    await confirmWithPin();
    await waitFor(() => expect(clearChildProgress).toHaveBeenCalledWith(db, KID1));
    expect(useChildSession.getState().childId).toBe(KID2);
  });

  it('delete_child: deleteChildEverywhere с ребёнком и аккаунтом, список обновлён, выбран оставшийся, replace /parent', async () => {
    const refreshProfiles = jest.fn(async () => {
      useAccount.setState({ profiles: [p2] });
    });
    useAccount.setState({ refreshProfiles });
    await renderConfirm('delete_child');
    await confirmWithPin();
    await waitFor(() => expect(deleteChildEverywhere).toHaveBeenCalledTimes(1));
    expect(deleteChildEverywhere.mock.calls[0][0]).toMatchObject({ db, childId: KID1, accountId, device });
    expect(deleteChildEverywhere.mock.calls[0][0].pseudonym).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/parent'));
    expect(refreshProfiles).toHaveBeenCalled();
    expect(useParentView.getState().childId).toBe(KID2);
    expect(clearChildProgress).not.toHaveBeenCalled();
    expect(wipeAccountEverywhere).not.toHaveBeenCalled();
  });

  it('delete_account: wipeAccountEverywhere с файлом базы, стор очищен, гейт закрыт, replace /parent/done', async () => {
    useGate.getState().open();
    useChildSession.getState().startNoRecordSession({ childId: KID1, now: new Date(), interfaceLang: 'ru' });
    await renderConfirm('delete_account');
    await confirmWithPin();
    await waitFor(() => expect(wipeAccountEverywhere).toHaveBeenCalledTimes(1));
    const input = wipeAccountEverywhere.mock.calls[0][0] as { db: SqlDb; accountId: string; deleteDbFile: () => Promise<void> };
    expect(input).toMatchObject({ db, accountId });
    await input.deleteDbFile();
    expect(deleteLocalDb).toHaveBeenCalledWith(accountId);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/parent/done'));
    expect(useAccount.getState()).toMatchObject({ status: 'none', accountId: null, db: null, profiles: [] });
    expect(useGate.getState().session).toBeNull();
    expect(useChildSession.getState().mode).toBe('none');
  });

  /**
   * Баг: `perform` — `try { … } finally { setBusy(false) }` без `catch`, вызывается как `void perform()`.
   * `wipeAccountEverywhere` по контракту бросает, если отзывы согласий не дошли до сервера (без связи
   * удаление не начинается), — и этот отказ уходит необработанным отклонением: родитель видит, что
   * кнопка снова активна, и ничего больше. Ошибка перехватывается и показывается (`parent.failed`). См. отчёт.
   */
  it('сбой удаления аккаунта (нет связи для отзывов): ошибка показана, стор и гейт не трогаются, перехода нет', async () => {
    wipeAccountEverywhere.mockRejectedValueOnce(new Error('Отзывы согласий не дошли до сервера'));
    useGate.getState().open();
    await renderConfirm('delete_account');
    await confirmWithPin();
    await waitFor(() => expect(wipeAccountEverywhere).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('confirm-action').props.accessibilityState.disabled).toBe(false));
    expect(router.replace).not.toHaveBeenCalled();
    expect(useAccount.getState().status).toBe('ready');
    expect(useAccount.getState().accountId).toBe(accountId);
    expect(screen.getByTestId('confirm-error')).toBeTruthy();
  });

  it('без базы в сторе действие не выполняется', async () => {
    useAccount.setState({ db: null });
    await renderConfirm('clear_progress');
    await confirmWithPin();
    await waitFor(() => expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull());
    expect(clearChildProgress).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });
});
