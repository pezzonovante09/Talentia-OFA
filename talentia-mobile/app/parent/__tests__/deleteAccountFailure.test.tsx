/**
 * №148, коммит 8db6ddc: «Удалить аккаунт» упал после метки `WIPE_PENDING_KEY` (сбой `wipeDevice` или
 * удаления файла базы) — экран доводит, сколько выйдет (`finishDeviceWipe`), уходит на «Удалено»,
 * стор аккаунта пуст, гейт закрыт, сеанс ребёнка сброшен, порт прогресса — без записи; что осталось,
 * доводит следующий `boot`. Удаление настоящее (`wipeAccountEverywhere` на in-memory SQLite и
 * `fakeDevice()`), сбой внедряется в `wipeDevice` / `deleteLocalDb`.
 */
import ConfirmScreen from '../confirm/[action]';
import { CURRENT_ACCOUNT_KEY, createLocalAccount } from '../../../src/services/local/account';
import { knownAccountKey, secureKeys, WIPE_PENDING_KEY } from '../../../src/services/local/device';
import { memoryDb, writeLessonRun } from '../../../src/services/local/__tests__/nodeSql';
import { newProfile } from '../../../src/services/local/profiles';
import type { SqlDb } from '../../../src/services/local/sql';
import { sha256 } from '../../../src/services/digest';
import { noRecordPort, sqlitePort } from '../../../src/services/progressPort';
import { randomBytes } from '../../../src/services/random';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { setDevice } from '../../../src/state/device';
import { useGate } from '../../../src/state/gate';
import { useParentView } from '../../../src/state/parentView';
import { progressPort, setProgressPort } from '../../../src/state/port';
import { failOnce, fakeDevice, type FakeDevice } from '../../../src/test/fakeDevice';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    useLocalSearchParams: () => ({ action: 'delete_account' }),
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
jest.mock('../../../src/services/local/purge', () => {
  const actual = jest.requireActual<typeof import('../../../src/services/local/purge')>('../../../src/services/local/purge');
  return { ...actual, wipeDevice: jest.fn(actual.wipeDevice) };
});
jest.mock('../../../src/services/local/expoSqlite', () => ({ openLocalDb: jest.fn(), deleteLocalDb: jest.fn() }));
jest.mock('../../../src/services/local/buildInfo', () => ({ buildTime: () => null }));

const { __router: router } = jest.requireMock('expo-router') as { __router: { replace: jest.Mock } };
const { wipeDevice } = jest.requireMock('../../../src/services/local/purge') as { wipeDevice: jest.Mock };
const { deleteLocalDb } = jest.requireMock('../../../src/services/local/expoSqlite') as { deleteLocalDb: jest.Mock };

const PIN = '295173';
const KID = '00000000-0000-4000-8000-0000000000a9';
const p1 = newProfile({ childId: KID, band: '5-6', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z', name: 'Айдар' });

let device: FakeDevice;
let db: SqlDb;
let accountId = '';

const renderConfirm = () => renderWithProviders(<ParentThemeProvider><ConfirmScreen /></ParentThemeProvider>);
async function deleteWithPin() {
  await fireEvent.press(screen.getByTestId('confirm-action'));
  for (const d of PIN) await fireEvent.press(screen.getByTestId(`confirm-pin-keypad-${d}`));
}
/** Ничего нашего на устройстве: ни файлов баз, ни PIN, ни ключей `talentia:`, ни кеша, ни уведомлений. */
const leftovers = () => ({
  files: [...device.files],
  secure: [...device.secure.keys()],
  storage: [...device.storage.keys()].filter((k) => k.startsWith('talentia:')),
  cache: [...device.cache],
  notifications: [...device.notifications],
});
const EMPTY = { files: [], secure: [], storage: [], cache: [], notifications: [] };

/** Вход ребёнка закрыт: аккаунта нет, профилей для выбора нет, сеанс сброшен, прогресс не пишется. */
const childEntry = () => ({
  status: useAccount.getState().status,
  accountId: useAccount.getState().accountId,
  profiles: useAccount.getState().profiles.length,
  session: useChildSession.getState().mode,
  noRecord: progressPort() === noRecordPort,
  gate: useGate.getState().session,
});
const CLOSED = { status: 'none', accountId: null, profiles: 0, session: 'none', noRecord: true, gate: null };

beforeEach(async () => {
  jest.clearAllMocks();
  device = fakeDevice();
  setDevice(device);
  useParentView.setState({ childId: null });
  db = await memoryDb();
  await writeLessonRun(db, { id: 'r', childId: KID, lessonId: 'l', startedAt: new Date().toISOString(), taskSeconds: [10], reviewTasks: 0 });
  accountId = await createLocalAccount(device, PIN, { randomBytes, digest: sha256 });
  for (const s of ['', '-wal']) device.files.add(`talentia-${accountId}.db${s}`);
  device.storage.set(`talentia:child:${KID}:settings`, '{}');
  device.cache.add(`voice/child/${KID}/hello.mp3`);
  device.notifications.add(KID);
  deleteLocalDb.mockImplementation(async (id: string) => void device.files.delete(`talentia-${id}.db`));
  setProgressPort(sqlitePort(db));
  useChildSession.getState().reset();
  useChildSession.getState().startNoRecordSession({ childId: KID, now: new Date(), interfaceLang: 'ru' });
  useGate.getState().open();
  useAccount.setState({ status: 'ready', accountId, db, profiles: [p1], consent: 'granted', retentionHold: null });
});

afterEach(() => setDevice(null));

describe('сбой wipeDevice после метки', () => {
  beforeEach(() => wipeDevice.mockRejectedValueOnce(new Error('внедрённый сбой wipeDevice')));

  it('переход на «Удалено», ошибки на экране нет', async () => {
    await renderConfirm();
    await deleteWithPin();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/parent/done'));
    expect(screen.queryByTestId('confirm-error')).toBeNull();
  });

  it('вход ребёнку закрыт: аккаунта и профилей нет, сеанс сброшен, прогресс без записи, гейт закрыт', async () => {
    await renderConfirm();
    await deleteWithPin();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/parent/done'));
    expect(childEntry()).toEqual(CLOSED);
  });

  it('остаток на устройстве доведён сразу: файлы баз, PIN, ключи, кеш, уведомления сняты', async () => {
    await renderConfirm();
    await deleteWithPin();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/parent/done'));
    expect(leftovers()).toEqual(EMPTY);
  });
});

describe('сбой удаления файла базы, и доводка на экране тоже упала', () => {
  beforeEach(() => {
    deleteLocalDb.mockRejectedValueOnce(new Error('внедрённый сбой deleteDatabaseAsync'));
    // finishDeviceWipe в catch экрана падает на уведомлениях — метка остаётся
    failOnce(device, 'cancelAllNotifications', 1);
  });

  it('переход на «Удалено», вход ребёнку закрыт', async () => {
    await renderConfirm();
    await deleteWithPin();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/parent/done'));
    expect(childEntry()).toEqual(CLOSED);
  });

  it('метка удаления, current и реестр остались — следующему старту есть что найти', async () => {
    await renderConfirm();
    await deleteWithPin();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/parent/done'));
    expect([WIPE_PENDING_KEY, CURRENT_ACCOUNT_KEY, knownAccountKey(accountId)].map((k) => device.storage.get(k) ?? null)).toEqual([accountId, accountId, '1']);
  });

  it('следующий boot доводит удаление: устройство пусто, аккаунта нет', async () => {
    await renderConfirm();
    await deleteWithPin();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/parent/done'));
    const openDb = jest.fn(async () => db);
    await act(() => useAccount.getState().boot({ openDb, now: new Date(), builtAt: null }));
    expect([leftovers(), useAccount.getState().status, openDb.mock.calls.length]).toEqual([EMPTY, 'none', 0]);
  });

  it('PIN удалённого аккаунта после boot не принимается: ключей PIN нет', async () => {
    await renderConfirm();
    await deleteWithPin();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/parent/done'));
    await act(() => useAccount.getState().boot({ openDb: async () => db, now: new Date(), builtAt: null }));
    expect(secureKeys(accountId).filter((k) => device.secure.has(k))).toEqual([]);
  });
});
