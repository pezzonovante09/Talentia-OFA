/**
 * Коммит 8db6ddc на листе `confirm/clock_jump`: строка о целях ABA — только когда они уйдут; нечего
 * удалять — кнопка не разрушительная и подписана «Дата верная, продолжить»; «Дата исправлена —
 * проверить снова» без PIN заново считает срок по часам: в норме — удержание снято и назад, всё ещё
 * скачок — сообщение и пересчитанное удержание. База — in-memory SQLite, срок — настоящий `runRetention`.
 */
import ConfirmScreen from '../confirm/[action]';
import { buildParentTheme } from '../../../src/design/parentTokens';
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
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    useLocalSearchParams: () => ({ action: 'clock_jump' }),
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
jest.mock('../../../src/services/local/expoSqlite', () => ({ openLocalDb: jest.fn(), deleteLocalDb: jest.fn(async () => undefined) }));
jest.mock('../../../src/services/local/buildInfo', () => ({ buildTime: () => null }));

const { __router: router } = jest.requireMock('expo-router') as { __router: { back: jest.Mock; replace: jest.Mock } };

const PIN = '295173';
const DAY = 86_400_000;
const KID = '00000000-0000-4000-8000-0000000000f7';
const p1 = newProfile({ childId: KID, band: '5-6', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z', name: 'Айдар' });
const colors = buildParentTheme('light').colors;

let db: SqlDb;

const hold = (over: Partial<Extract<RetentionOutcome, { kind: 'held' }>> = {}): Extract<RetentionOutcome, { kind: 'held' }> => ({
  kind: 'held',
  reason: 'clock_jump',
  deviceNow: new Date().toISOString(),
  lastSeen: new Date(Date.now() - 400 * DAY).toISOString(),
  wouldRemove: 1,
  abaGoalsChildren: 0,
  ...over,
});
const renderConfirm = () => renderWithProviders(<ParentThemeProvider><ConfirmScreen /></ParentThemeProvider>);
const setLastSeen = (iso: string) => db.run('INSERT INTO retention_clock (id, last_seen) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET last_seen = excluded.last_seen', [iso]);
const runIds = async () => (await db.all<{ id: string }>('SELECT id FROM lesson_runs ORDER BY seq')).map((r) => r.id);
/** Фон кнопки действия — по нему виден вариант (`destructive` — цвет ошибки). */
const actionBg = () => screen.getByTestId('confirm-action').props.style.backgroundColor as string;

beforeEach(async () => {
  jest.clearAllMocks();
  const device = fakeDevice();
  setDevice(device);
  useParentView.setState({ childId: null });
  useGate.setState({ session: null });
  db = await memoryDb();
  await writeLessonRun(db, { id: 'old', childId: KID, lessonId: 'l', startedAt: new Date(Date.now() - 500 * DAY).toISOString(), taskSeconds: [10], reviewTasks: 0 });
  await writeLessonRun(db, { id: 'fresh', childId: KID, lessonId: 'l', startedAt: new Date(Date.now() - DAY).toISOString(), taskSeconds: [10], reviewTasks: 0 });
  const accountId = await createLocalAccount(device, PIN, { randomBytes, digest: sha256 });
  useAccount.setState({ status: 'ready', accountId, db, profiles: [p1], consent: 'granted', retentionHold: null });
});

afterEach(() => setDevice(null));

describe('строка о целях ABA', () => {
  it('abaGoalsChildren > 0 — строка видна с числом детей', async () => {
    useAccount.setState({ retentionHold: hold({ abaGoalsChildren: 2 }) });
    await renderConfirm();
    expect(screen.getByText('Удалятся и цели ABA у детей, с которыми не занимались год: 2.')).toBeTruthy();
  });

  it('abaGoalsChildren = 0 — строки нет', async () => {
    useAccount.setState({ retentionHold: hold({ abaGoalsChildren: 0, wouldRemove: 5 }) });
    await renderConfirm();
    expect(screen.queryByText(/цели ABA/)).toBeNull();
  });
});

describe('кнопка подтверждения', () => {
  it('нечего удалять (0 записей, 0 детей с ABA) — «Дата верная, продолжить»', async () => {
    useAccount.setState({ retentionHold: hold({ wouldRemove: 0, abaGoalsChildren: 0 }) });
    await renderConfirm();
    expect(screen.getByTestId('confirm-action').props.accessibilityLabel).toBe('Дата верная, продолжить');
  });

  it('нечего удалять — кнопка не разрушительная (основной цвет, не цвет ошибки)', async () => {
    useAccount.setState({ retentionHold: hold({ wouldRemove: 0, abaGoalsChildren: 0 }) });
    await renderConfirm();
    expect([actionBg() === colors.error, actionBg() === colors.primary]).toEqual([false, true]);
  });

  it('записей 0, но уйдут цели ABA — кнопка разрушительная «Дата верная, удалить старое»', async () => {
    useAccount.setState({ retentionHold: hold({ wouldRemove: 0, abaGoalsChildren: 1 }) });
    await renderConfirm();
    expect([screen.getByTestId('confirm-action').props.accessibilityLabel, actionBg()]).toEqual(['Дата верная, удалить старое', colors.error]);
  });

  it('есть записи к удалению — кнопка разрушительная «Дата верная, удалить старое»', async () => {
    useAccount.setState({ retentionHold: hold({ wouldRemove: 3 }) });
    await renderConfirm();
    expect([screen.getByTestId('confirm-action').props.accessibilityLabel, actionBg()]).toEqual(['Дата верная, удалить старое', colors.error]);
  });
});

describe('«Дата исправлена — проверить снова»', () => {
  it('часы уже в норме — удержание снято, экран уходит назад', async () => {
    // взрослый исправил дату: прошлый запуск — вчера, скачка больше нет
    await setLastSeen(new Date(Date.now() - DAY).toISOString());
    useAccount.setState({ retentionHold: hold() });
    await renderConfirm();
    await fireEvent.press(screen.getByTestId('clock-recheck'));
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(useAccount.getState().retentionHold).toBeNull();
  });

  it('часы в норме — срок применён обычным ходом: старше года удалено, свежее на месте', async () => {
    await setLastSeen(new Date(Date.now() - DAY).toISOString());
    useAccount.setState({ retentionHold: hold() });
    await renderConfirm();
    await fireEvent.press(screen.getByTestId('clock-recheck'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(await runIds()).toEqual(['fresh']);
  });

  it('всё ещё скачок — текст «Дата всё ещё сильно впереди…», назад не уходит', async () => {
    await setLastSeen(new Date(Date.now() - 400 * DAY).toISOString());
    useAccount.setState({ retentionHold: hold() });
    await renderConfirm();
    await fireEvent.press(screen.getByTestId('clock-recheck'));
    await waitFor(() => expect(screen.getByTestId('confirm-error').props.children).toBe('Дата всё ещё сильно впереди. Проверьте её в настройках телефона.'));
    expect(router.back).not.toHaveBeenCalled();
  });

  it('всё ещё скачок — удержание пересчитано по текущим часам и базе, ничего не удалено', async () => {
    await setLastSeen(new Date(Date.now() - 400 * DAY).toISOString());
    // устаревшее удержание: другое число и дата листа трёхдневной давности
    useAccount.setState({ retentionHold: hold({ wouldRemove: 99, deviceNow: new Date(Date.now() - 3 * DAY).toISOString() }) });
    await renderConfirm();
    await fireEvent.press(screen.getByTestId('clock-recheck'));
    await waitFor(() => expect(useAccount.getState().retentionHold?.wouldRemove).toBe(1));
    const again = useAccount.getState().retentionHold!;
    expect(Math.abs(Date.parse(again.deviceNow) - Date.now())).toBeLessThan(60_000);
    expect(await runIds()).toEqual(['old', 'fresh']);
  });
});
