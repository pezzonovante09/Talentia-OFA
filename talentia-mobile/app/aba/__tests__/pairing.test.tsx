/**
 * Экран сопряжения (раздел 3) на ручных часах и `memoryDb`: четыре цикла тапом до конца с Tali и записью итога;
 * выбор взрослого полосой; выход удержанием пишет остановку взрослого и ведёт на карту; без конфигурации — на 2.6.
 */
import { AppState, type AppStateStatus } from 'react-native';

import AbaPairingScreen from '../pairing';
import { PAIRING } from '../../../src/domain/abaTokenTraining';
import { grantAbaProcessing } from '../../../src/services/local/abaConsent';
import { loadChildState } from '../../../src/services/local/childState';
import { memoryDb } from '../../../src/services/local/__tests__/nodeSql';
import type { SqlDb } from '../../../src/services/local/sql';
import { useAbaRun } from '../../../src/state/abaRun';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { act, fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';
import { AbaClockProvider, manualClock, type ManualClock } from '../../../src/ui/aba/clock';

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    useLocalSearchParams: () => ({}),
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
const router = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock } }).__router;

const KID = '00000000-0000-4000-8000-0000000000a1';
let db: SqlDb;
let clock: ManualClock;

/** Доска и кольцо скрыты от скринридера (`accessibilityElementsHidden`) — ищутся с этим флагом. */
const HIDDEN = { includeHiddenElements: true };
const tick = async (ms: number) => act(async () => clock.advance(ms));

async function mount() {
  await renderWithProviders(
    <AbaClockProvider clock={clock}>
      <AbaPairingScreen />
    </AbaClockProvider>,
  );
  await waitFor(() => expect(screen.getByTestId('aba-choice')).toBeTruthy());
}

/** Варианты на экране выбора — по testID карточек. */
const cards = () => screen.getAllByTestId(/^aba-reinforcer-(?!stub)/).map((n) => String(n.props.testID).replace('aba-reinforcer-', ''));

async function oneCycle(pick: string) {
  await fireEvent.press(screen.getByTestId(`aba-reinforcer-${pick}`));
  await tick(800);
  expect(screen.getByTestId('aba-pairing-wait')).toBeTruthy();
  expect(screen.getByTestId('aba-pairing-token-empty', HIDDEN)).toBeTruthy();
  await tick(PAIRING.tokenAfterMs);
  await tick(220);
  expect(screen.getByTestId('aba-pairing-token-filled', HIDDEN)).toBeTruthy();
  await tick(600);
  await tick(360);
  expect(screen.getByTestId('aba-access-scene')).toBeTruthy();
  expect(screen.getByTestId('aba-access-ring', HIDDEN)).toBeTruthy();
  await tick(PAIRING.accessMs);
}

beforeEach(async () => {
  router.replace.mockClear();
  clock = manualClock();
  db = await memoryDb();
  await grantAbaProcessing(db, { childId: KID, accountId: 'acc', lang: 'ru', at: new Date(clock.now()).toISOString(), randomBytes: (n) => new Uint8Array(n).fill(7) });
  useAccount.setState({ db, accountId: 'acc', status: 'ready' });
  useChildSession.setState({ childId: KID, mode: 'account' });
  useAbaRun.getState().set({ config: 'with_adult', observers: [], primaryObserverId: null });
});

it('четыре цикла тапом: конец с Tali, итог записан, критерий — выбор ребёнка', async () => {
  await mount();
  const options = cards();
  expect(options).toHaveLength(3);
  expect(screen.getByText('За что играем сегодня?')).toBeTruthy();
  for (let i = 0; i < PAIRING.cycles; i += 1) {
    if (i > 0) expect(screen.getByText('За что играем теперь?')).toBeTruthy();
    await oneCycle(options[i % 3]);
  }
  await waitFor(() => expect(screen.getByTestId('aba-end-normal')).toBeTruthy());
  const training = await loadChildState(db, KID, 'tokenTraining');
  expect(training).toMatchObject({ pairingSessions: 1, pairingStreak: 1, pairingDone: false });
  const rows = await db.all<{ chosen_by: string }>('SELECT chosen_by FROM aba_reinforcer_choices WHERE child_id = ?', [KID]);
  expect(rows.map((r) => r.chosen_by)).toEqual(['child', 'child', 'child', 'child']);
  await fireEvent.press(screen.getByTestId('aba-end-done'));
  expect(router.replace).toHaveBeenCalledWith('/map');
});

it('«Со взрослым»: полоса через 30 с, нажатие в первые 500 мс не действует, затем выбор взрослого', async () => {
  await mount();
  expect(screen.queryByTestId('aba-adult-strip')).toBeNull();
  await tick(30_000);
  const strip = screen.getByTestId('aba-adult-strip');
  expect(strip).toBeTruthy();
  const pick = cards()[0];
  await fireEvent.press(screen.getByTestId(`aba-adult-choose-${pick}`));
  await tick(800);
  expect(screen.queryByTestId('aba-pairing-wait')).toBeNull();
  await tick(500);
  await fireEvent.press(screen.getByTestId(`aba-adult-choose-${pick}`));
  expect(screen.queryByTestId('aba-adult-strip')).toBeNull();
  await tick(800);
  expect(screen.getByTestId('aba-pairing-wait')).toBeTruthy();
});

it('«Со взрослым»: выход удержанием — выбор записан в историю, сопряжение не засчитано, переход на карту без экрана конца', async () => {
  await mount();
  await oneCycle(cards()[1]);
  await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
  await tick(1500);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/map'));
  expect(screen.queryByTestId('aba-end-normal')).toBeNull();
  // остановка взрослым сессию не засчитывает и серию не рвёт (`applyPairingSession`), выбор — в истории
  expect((await loadChildState(db, KID, 'tokenTraining')) ?? { pairingSessions: 0 }).toMatchObject({ pairingSessions: 0 });
  const rows = await db.all<{ n: number }>('SELECT count(*) AS n FROM aba_reinforcer_choices WHERE child_id = ?', [KID]);
  expect(rows[0].n).toBe(1);
});

it('«Сам»: выход удержанием — уход ребёнка, сессия засчитана брошенной и серию рвёт', async () => {
  useAbaRun.getState().set({ config: 'alone', observers: [], primaryObserverId: null });
  await mount();
  await oneCycle(cards()[0]);
  await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
  await tick(1500);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/map'));
  expect(await loadChildState(db, KID, 'tokenTraining')).toMatchObject({ pairingSessions: 1, pairingStreak: 0 });
});

it('свернули посреди сопряжения — сессия не засчитана, конец нейтральный, просроченные стадии не проходят', async () => {
  const handlers: ((s: AppStateStatus) => void)[] = [];
  // подмена, а не `spyOn`: `mockRestore` у мока RN снял бы и его реализацию, и следующие экраны получили бы `undefined`
  const original = AppState.addEventListener;
  AppState.addEventListener = ((_t: string, fn: (s: AppStateStatus) => void) => {
    handlers.push(fn);
    return { remove: () => undefined };
  }) as typeof AppState.addEventListener;
  try {
    await mount();
    await fireEvent.press(screen.getByTestId(`aba-reinforcer-${cards()[0]}`));
    await tick(800);
    await act(async () => handlers.forEach((h) => h('background')));
    await waitFor(() => expect(screen.getByTestId('aba-end-neutral')).toBeTruthy());
    await tick(60_000);
    expect(screen.queryByTestId('aba-access-scene')).toBeNull();
    expect((await loadChildState(db, KID, 'tokenTraining')) ?? { pairingSessions: 0 }).toMatchObject({ pairingSessions: 0 });
  } finally {
    AppState.addEventListener = original;
  }
});

it('без выбранной конфигурации — обратно на 2.6 в режиме сопряжения', async () => {
  useAbaRun.getState().reset();
  await renderWithProviders(
    <AbaClockProvider clock={clock}>
      <AbaPairingScreen />
    </AbaClockProvider>,
  );
  expect(screen.getByTestId('redirect').props.children).toBe('/aba?mode=pairing');
});
