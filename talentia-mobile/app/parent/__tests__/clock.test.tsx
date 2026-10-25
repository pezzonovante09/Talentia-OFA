/**
 * №147 на экранах: карточка «Дата на телефоне изменилась» на главной родителя видна только при
 * удержании срока хранения; `confirm/clock_jump` без удержания уводит на главную; подтверждение за
 * PIN удаляет старое настоящим `confirmClockJump` по дате с листа и снимает удержание. База —
 * in-memory SQLite, PIN — настоящий `checkPin` на `fakeDevice()`.
 */
import ConfirmScreen from '../confirm/[action]';
import ParentHome from '../index';
import { createLocalAccount } from '../../../src/services/local/account';
import { memoryDb, writeLessonRun } from '../../../src/services/local/__tests__/nodeSql';
import { newProfile } from '../../../src/services/local/profiles';
import type { RetentionOutcome } from '../../../src/services/local/purge';
import type { SqlDb } from '../../../src/services/local/sql';
import { sha256 } from '../../../src/services/digest';
import { randomBytes } from '../../../src/services/random';
import { useAccount } from '../../../src/state/account';
import { setDevice } from '../../../src/state/device';
import { useGate } from '../../../src/state/gate';
import { useParentView } from '../../../src/state/parentView';
import { fakeDevice } from '../../../src/test/fakeDevice';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

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
jest.mock('../../../src/services/local/expoSqlite', () => ({
  openLocalDb: jest.fn(),
  deleteLocalDb: jest.fn(async () => undefined),
}));
jest.mock('../../../src/services/local/buildInfo', () => ({ buildTime: () => null }));

const { __router: router, __params: params } = jest.requireMock('expo-router') as {
  __router: { push: jest.Mock; back: jest.Mock; replace: jest.Mock };
  __params: { action: string | undefined };
};

const PIN = '295173';
const DAY = 86_400_000;
const KID = '00000000-0000-4000-8000-0000000000f1';
const p1 = newProfile({ childId: KID, band: '5-6', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z', name: 'Айдар' });

let db: SqlDb;
let device = fakeDevice();

/** Удержание, как его вернул бы `runRetention`: часы «сейчас», прошлый запуск — 400 дней назад. */
const holdAt = (deviceNow: Date): Extract<RetentionOutcome, { kind: 'held' }> => ({
  kind: 'held',
  reason: 'clock_jump',
  deviceNow: deviceNow.toISOString(),
  lastSeen: new Date(deviceNow.getTime() - 400 * DAY).toISOString(),
  wouldRemove: 1,
});

const renderHome = () => renderWithProviders(<ParentThemeProvider><ParentHome /></ParentThemeProvider>);
const renderConfirm = () => {
  params.action = 'clock_jump';
  return renderWithProviders(<ParentThemeProvider><ConfirmScreen /></ParentThemeProvider>);
};
async function confirmWithPin(pin = PIN) {
  await fireEvent.press(screen.getByTestId('confirm-action'));
  for (const d of pin) await fireEvent.press(screen.getByTestId(`confirm-pin-keypad-${d}`));
}
const runIds = async () => (await db.all<{ id: string }>('SELECT id FROM lesson_runs ORDER BY seq')).map((r) => r.id);
const lastSeen = async () => (await db.all<{ last_seen: string }>('SELECT last_seen FROM retention_clock'))[0]?.last_seen ?? null;

beforeEach(async () => {
  jest.clearAllMocks();
  device = fakeDevice();
  setDevice(device);
  useParentView.setState({ childId: null });
  useGate.setState({ session: null });
  db = await memoryDb();
  // прохождение 500 дней назад — его удалит подтверждение; свежее — нет
  await writeLessonRun(db, { id: 'old', childId: KID, lessonId: 'l', startedAt: new Date(Date.now() - 500 * DAY).toISOString(), taskSeconds: [10], reviewTasks: 0 });
  await writeLessonRun(db, { id: 'fresh', childId: KID, lessonId: 'l', startedAt: new Date(Date.now() - DAY).toISOString(), taskSeconds: [10], reviewTasks: 0 });
  await db.run('INSERT INTO retention_clock (id, last_seen) VALUES (1, ?)', [new Date(Date.now() - 400 * DAY).toISOString()]);
  const accountId = await createLocalAccount(device, PIN, { randomBytes, digest: sha256 });
  useAccount.setState({ status: 'ready', accountId, db, profiles: [p1], consent: 'granted', retentionHold: null });
});

afterEach(() => setDevice(null));

describe('карточка на главной родителя', () => {
  it('без удержания карточки нет', async () => {
    await renderHome();
    expect(screen.queryByTestId('card-clock')).toBeNull();
  });

  it('при удержании карточка видна с заголовком и текстом', async () => {
    useAccount.setState({ retentionHold: holdAt(new Date()) });
    await renderHome();
    expect(screen.getByTestId('card-clock')).toBeTruthy();
    expect(screen.getByText('Дата на телефоне изменилась')).toBeTruthy();
    expect(screen.getByText('Записи старше года не удаляются, пока вы не проверите дату.')).toBeTruthy();
  });

  it('«Проверить дату» ведёт в confirm с action clock_jump', async () => {
    useAccount.setState({ retentionHold: holdAt(new Date()) });
    await renderHome();
    await fireEvent.press(screen.getByTestId('row-clock'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/parent/confirm/[action]', params: { action: 'clock_jump' } });
  });

  it('удержание снято — карточка пропадает', async () => {
    useAccount.setState({ retentionHold: holdAt(new Date()) });
    await renderHome();
    await waitFor(() => expect(screen.getByTestId('card-clock')).toBeTruthy());
    await act(async () => useAccount.getState().clearRetentionHold());
    await waitFor(() => expect(screen.queryByTestId('card-clock')).toBeNull());
  });
});

describe('confirm/clock_jump', () => {
  it('без удержания — редирект на главную родителя', async () => {
    await renderConfirm();
    expect(screen.getByTestId('redirect').props.children).toBe('/parent');
  });

  it('с удержанием: лист называет число записей к удалению', async () => {
    useAccount.setState({ retentionHold: { ...holdAt(new Date()), wouldRemove: 7 } });
    await renderConfirm();
    expect(screen.getByTestId('parent-confirm-clock_jump')).toBeTruthy();
    expect(screen.getByText(/удалим записи старше года — их 7/)).toBeTruthy();
  });

  it('верный PIN: старое удалено, свежее на месте', async () => {
    useAccount.setState({ retentionHold: holdAt(new Date()) });
    await renderConfirm();
    await confirmWithPin();
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await runIds()).toEqual(['fresh']);
  });

  it('верный PIN: удержание снято, last_seen = дата с листа', async () => {
    const hold = holdAt(new Date());
    useAccount.setState({ retentionHold: hold });
    await renderConfirm();
    await confirmWithPin();
    await waitFor(() => expect(useAccount.getState().retentionHold).toBeNull());
    expect(await lastSeen()).toBe(hold.deviceNow);
  });

  it('неверный PIN: ничего не удалено, удержание остаётся', async () => {
    useAccount.setState({ retentionHold: holdAt(new Date()) });
    await renderConfirm();
    await confirmWithPin('000000');
    await waitFor(() => expect(screen.getByTestId('confirm-pin-error').props.children).toBe('Неверный PIN'));
    expect(await runIds()).toEqual(['old', 'fresh']);
    expect(useAccount.getState().retentionHold).not.toBeNull();
  });

  it('часы ушли больше чем на сутки после показа листа: ничего не удалено, удержание пересчитано, текст «Дата снова изменилась»', async () => {
    const stale = holdAt(new Date(Date.now() - 3 * DAY));
    useAccount.setState({ retentionHold: stale });
    await renderConfirm();
    await confirmWithPin();
    await waitFor(() => expect(screen.getByTestId('confirm-error').props.children).toBe('Дата снова изменилась. Проверьте её и подтвердите ещё раз.'));
    expect(await runIds()).toEqual(['old', 'fresh']);
    const again = useAccount.getState().retentionHold;
    expect(again).not.toBeNull();
    expect(Math.abs(Date.parse(again!.deviceNow) - Date.now())).toBeLessThan(60_000);
    expect(router.back).not.toHaveBeenCalled();
  });
});
