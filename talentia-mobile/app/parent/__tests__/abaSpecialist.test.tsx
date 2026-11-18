/**
 * «Для специалиста» (методист 2026-11-18): вход со строки на `app/parent/aba/index.tsx` за свежим PIN (`aba_specialist`),
 * экран `app/parent/aba/specialist.tsx` — изменения за тем же PIN, каждое с событием журнала; сигналы только для чтения
 * словами. База — in-memory SQLite, сервисы настоящие, PIN — настоящий `checkPin` на `fakeDevice()`.
 */
import AbaParentScreen from '../aba/index';
import AbaSpecialistScreen from '../aba/specialist';
import { ABA_TARGETS } from '../../../src/content/aba';
import { initialTargetState } from '../../../src/domain/abaPrompting';
import { initialTokenTraining } from '../../../src/domain/abaTokenTraining';
import ru from '../../../src/i18n/locales/ru.json';
import { createLocalAccount } from '../../../src/services/local/account';
import { grantAbaProcessing } from '../../../src/services/local/abaConsent';
import { markAbaIntroSeen } from '../../../src/services/local/abaIntro';
import { loadChildState, saveChildState } from '../../../src/services/local/childState';
import { abaSpecialistEventsOf } from '../../../src/services/local/commit';
import { asAbaWriter, memoryDb } from '../../../src/services/local/__tests__/nodeSql';
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
import { setProgressPort } from '../../../src/state/port';
import { fakeDevice } from '../../../src/test/fakeDevice';
import { ParentThemeProvider } from '../../../src/ui/parent/theme';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissAll: jest.fn(), canGoBack: () => true };
  return {
    __router: router,
    useRouter: () => router,
    useLocalSearchParams: () => ({}),
    useFocusEffect: (cb: () => void) => React.useEffect(() => cb(), [cb]),
  };
});
jest.mock('../../../src/services/local/expoSqlite', () => ({ openLocalDb: jest.fn(), deleteLocalDb: jest.fn(async () => undefined) }));
jest.mock('../../../src/services/local/shareSpecialistExport', () => ({ ABA_EXPORT_FILE_ENABLED: true, shareSpecialistExport: jest.fn(async () => 'shared') }));
jest.mock('../../../src/services/local/buildInfo', () => ({ buildTime: () => null }));

const { __router: router } = jest.requireMock('expo-router') as { __router: { push: jest.Mock } };

const PIN = '295173';
const KID = '00000000-0000-4000-8000-0000000000a1';
const profile = newProfile({ childId: KID, band: '7', interfaceLang: 'ru', createdAt: '2026-10-25T00:00:00.000Z', name: 'Айдар' });
const spec = ru.parent.aba.spec;
let seq = 0;
const bytes = (len: number) => Uint8Array.from({ length: len }, (_, i) => (i * 13 + (seq += 7)) & 0xff);
const iso = () => new Date().toISOString();

let db: SqlDb;
let accountId = '';

const wrap = (el: React.ReactElement) => renderWithProviders(<ParentThemeProvider>{el}</ParentThemeProvider>, { lng: 'ru' });
const write = <K extends 'abaTargets' | 'tokenTraining' | 'abaObservers' | 'breakCard'>(key: K, value: Parameters<typeof saveChildState<K>>[3]) =>
  asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, key, value, iso()));
async function typePin(pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByTestId(`confirm-pin-keypad-${d}`));
}

beforeEach(async () => {
  jest.clearAllMocks();
  const device = fakeDevice();
  setDevice(device);
  useParentView.setState({ childId: null });
  useGate.setState({ session: null });
  db = await memoryDb();
  accountId = await createLocalAccount(device, PIN, { randomBytes, digest: sha256 });
  await markAbaIntroSeen(device, accountId);
  useAccount.setState({ status: 'ready', accountId, db, profiles: [profile], consent: 'granted', retentionHold: null });
  useChildSession.getState().reset();
  setProgressPort(sqlitePort(db));
  await grantAbaProcessing(db, { childId: KID, accountId, lang: 'ru', at: new Date(Date.now() - 60_000).toISOString(), randomBytes: bytes });
});

afterEach(() => {
  setDevice(null);
  setProgressPort(noRecordPort);
});

describe('вход в раздел «Для специалиста»', () => {
  it('без свежего PIN — лист PIN, перехода нет; верный PIN — переход на экран', async () => {
    await wrap(<AbaParentScreen />);
    await waitFor(() => expect(screen.getByTestId('aba-specialist-row')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-specialist-row'));
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalledWith('/parent/aba/specialist');
    await typePin(PIN);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/parent/aba/specialist'));
  });

  it('в окне свежести — сразу, без листа', async () => {
    useGate.getState().open();
    await wrap(<AbaParentScreen />);
    await waitFor(() => expect(screen.getByTestId('aba-specialist-row')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-specialist-row'));
    expect(screen.queryByTestId('confirm-pin-sheet')).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/parent/aba/specialist');
  });
});

describe('экран «Для специалиста»', () => {
  it('сигналы только для чтения — словами; действий для них нет', async () => {
    const tg = ABA_TARGETS[0];
    await write('abaTargets', { [tg.id]: { ...initialTargetState(tg), phase: 'acquisition', flags: ['position_bias', 'no_progress', 'prompt_dependent'], currentDelayMs: 2500 } });
    await write('tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 3, flags: [] });
    await wrap(<AbaSpecialistScreen />);
    await waitFor(() => expect(screen.getByTestId('spec-board-stage')).toHaveTextContent('Доска жетонов: ступень 3'));
    expect(screen.getByTestId(`spec-flag-${tg.id}-position_bias`)).toHaveTextContent(spec.flag.position_bias);
    expect(screen.getByTestId(`spec-flag-${tg.id}-no_progress`)).toHaveTextContent(spec.flag.no_progress);
    expect(screen.getByTestId(`spec-flag-${tg.id}-prompt_dependent`)).toHaveTextContent(spec.flag.prompt_dependent);
    expect(screen.getByTestId(`spec-target-${tg.id}`)).toHaveTextContent(/обучение/);
    expect(screen.getByTestId(`spec-target-${tg.id}`)).toHaveTextContent(/ожидание перед подсказкой 2.5 с/);
    expect(screen.getByTestId('spec-actions-caption')).toHaveTextContent(spec.noActions);
    expect(screen.getByTestId('spec-claimed')).toHaveTextContent(spec.claimed);
    expect(screen.getByTestId('spec-no-changes')).toBeTruthy();
  });

  it('«Просмотрено» без свежего PIN — лист, флаг на месте; после PIN — флаг снят, событие в журнале и на экране', async () => {
    await write('tokenTraining', { ...initialTokenTraining(), pairingDone: true, flags: ['token_training_stalled'] });
    await wrap(<AbaSpecialistScreen />);
    await waitFor(() => expect(screen.getByTestId('spec-action-token_training_stalled')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('spec-action-token_training_stalled'));
    expect(screen.getByTestId('confirm-pin-sheet')).toBeTruthy();
    expect((await loadChildState(db, KID, 'tokenTraining'))?.flags).toEqual(['token_training_stalled']);
    await typePin(PIN);
    await waitFor(() => expect(screen.queryByTestId('spec-action-token_training_stalled')).toBeNull());
    expect((await loadChildState(db, KID, 'tokenTraining'))?.flags).toEqual([]);
    expect((await abaSpecialistEventsOf(db, KID)).map((e) => [e.field, e.role, e.claimed])).toEqual([['flag.token_training_stalled', 'specialist', true]]);
    await waitFor(() => expect(screen.getByTestId('spec-change-0')).toHaveTextContent(/сигнал: доска жетонов не растёт: да → нет/));
  });

  it('параметры: одна цель в обучении — в базе и в журнале; «обучен» у наблюдателя', async () => {
    useGate.getState().open();
    await write('abaObservers', [{ id: 'obs-1', role: 'specialist', trained: false }]);
    await wrap(<AbaSpecialistScreen />);
    await waitFor(() => expect(screen.getByTestId('spec-teaching')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('spec-teaching-1'));
    await waitFor(async () => expect(await loadChildState(db, KID, 'abaSessionParams')).toEqual({ maxTeachingTargets: 1 }));
    await fireEvent(screen.getByTestId('spec-observer-specialist-switch'), 'valueChange', true);
    await waitFor(async () => expect((await loadChildState(db, KID, 'abaObservers'))?.[0].trained).toBe(true));
    expect((await abaSpecialistEventsOf(db, KID)).map((e) => e.field)).toEqual(['maxTeachingTargets', 'observerTrained']);
  });

  it('«Назначить проверку вперемешку» и «Беспокойство по согласию просмотрено» — отметки снимают флаги', async () => {
    useGate.getState().open();
    const [a] = ABA_TARGETS;
    const group = ABA_TARGETS.filter((t) => t.mixWith?.length || ABA_TARGETS.some((x) => x.mixWith?.includes(t.id)));
    await write('abaTargets', {
      [a.id]: { ...initialTargetState(a), flags: ['assent_concern'] },
      ...Object.fromEntries(group.map((t) => [t.id, { ...initialTargetState(t), phase: 'mastered' as const, flags: ['mixed_not_established' as const] }])),
    });
    await wrap(<AbaSpecialistScreen />);
    const mixedKey = `spec-action-mixed-${group.map((t) => t.id).join('+')}`;
    await waitFor(() => expect(screen.getByTestId(mixedKey)).toBeTruthy());
    await fireEvent.press(screen.getByTestId(mixedKey));
    await waitFor(() => expect(screen.queryByTestId(mixedKey)).toBeNull());
    await fireEvent.press(screen.getByTestId(`spec-action-assent-${a.id}`));
    await waitFor(() => expect(screen.queryByTestId(`spec-action-assent-${a.id}`)).toBeNull());
    const states = (await loadChildState(db, KID, 'abaTargets')) ?? {};
    expect(Object.values(states).some((s) => s.flags.includes('mixed_not_established') || s.flags.includes('assent_concern'))).toBe(false);
    expect((await abaSpecialistEventsOf(db, KID)).map((e) => e.field)).toEqual(['flag.mixed_not_established', 'flag.assent_concern']);
  });
});
