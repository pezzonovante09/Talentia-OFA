/**
 * 2.6 «со взрослым / сам» (этап 11): окно мало — экран для взрослого; выбор и «Начать»; «Сам» — сразу в сессию;
 * «Со взрослым» — лист «Кто ведёт», 500 мс от последнего отпускания касания не принимаются, наблюдатель без имени
 * пишется и приходит в стор. Часы — ручные (`manualClock`), поддельных таймеров нет.
 */
import AbaConfigScreen from '../index';
import { isUuidV4 } from '../../../src/domain/ids';
import { grantAbaProcessing } from '../../../src/services/local/abaConsent';
import { appendPairingSession } from '../../../src/services/local/abaLog';
import { loadChildState } from '../../../src/services/local/childState';
import { asAbaWriter, memoryDb } from '../../../src/services/local/__tests__/nodeSql';
import type { SqlDb } from '../../../src/services/local/sql';
import type { AbaPairingSession } from '../../../src/types/aba';
import { useAbaRun } from '../../../src/state/abaRun';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { act, fireEvent, renderWithProviders, screen } from '../../../src/test/render';
import { AbaClockProvider, manualClock, type ManualClock } from '../../../src/ui/aba/clock';

let mockParams: { mode?: string } = {};
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    useLocalSearchParams: () => mockParams,
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
const router = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock } }).__router;

const KID = '00000000-0000-4000-8000-0000000000a1';
let db: SqlDb;
let clock: ManualClock;

async function mount(height = 627) {
  await renderWithProviders(
    <AbaClockProvider clock={clock}>
      <AbaConfigScreen />
    </AbaClockProvider>,
  );
  await fireEvent(screen.getByTestId('aba-config').children[0] as never, 'layout', { nativeEvent: { layout: { height, width: 375, x: 0, y: 0 } } });
}

/** Касание листа: опустить и отпустить (лист считает 500 мс от последнего отпускания). */
const tick = async (ms: number) => act(async () => clock.advance(ms));

beforeEach(async () => {
  router.replace.mockClear();
  clock = manualClock();
  db = await memoryDb();
  await grantAbaProcessing(db, { childId: KID, accountId: 'acc', lang: 'ru', at: new Date(clock.now()).toISOString(), randomBytes: (n) => new Uint8Array(n).fill(7) });
  useAccount.setState({ db, accountId: 'acc', status: 'ready' });
  useChildSession.setState({ childId: KID, mode: 'account' });
  useAbaRun.getState().reset();
  mockParams = {};
});

it('окно меньше любого тира — экран «слишком мал», ребёнок дальше не идёт', async () => {
  await mount(300);
  expect(screen.getByTestId('aba-too-small')).toBeTruthy();
  expect(screen.queryByTestId('aba-config-with_adult')).toBeNull();
});

it('«Сам»: выбор, «Начать» — в сессию, наблюдателей нет', async () => {
  await mount();
  await tick(10);
  await fireEvent.press(screen.getByTestId('aba-config-alone'));
  await fireEvent.press(screen.getByTestId('aba-config-start'));
  expect(useAbaRun.getState()).toMatchObject({ config: 'alone', observers: [], primaryObserverId: null });
  expect(router.replace).toHaveBeenCalledWith('/aba/session');
});

it('«Начать» недоступна до выбора', async () => {
  await mount();
  await fireEvent.press(screen.getByTestId('aba-config-start'));
  expect(router.replace).not.toHaveBeenCalled();
});

it('«Со взрослым»: лист, роль и «обучен», наблюдатель записан с UUIDv4 без имени', async () => {
  await mount();
  await tick(10);
  await fireEvent.press(screen.getByTestId('aba-config-with_adult'));
  await fireEvent.press(screen.getByTestId('aba-config-start'));
  const sheet = screen.getByTestId('aba-who-leads');
  // касание сразу после открытия — не действие
  await fireEvent(sheet, 'touchStart');
  await fireEvent.press(screen.getByTestId('aba-role-parent'));
  await fireEvent(sheet, 'touchEnd');
  await tick(600);
  await fireEvent(sheet, 'touchStart');
  await fireEvent.press(screen.getByTestId('aba-role-specialist'));
  await fireEvent(sheet, 'touchEnd');
  await tick(600);
  await fireEvent(sheet, 'touchStart');
  await fireEvent.press(screen.getByTestId('aba-who-start'));
  await act(async () => undefined);
  const run = useAbaRun.getState();
  expect(run.config).toBe('with_adult');
  expect(run.observers[0]).toMatchObject({ role: 'specialist', trained: false });
  expect(isUuidV4(run.observers[0].id)).toBe(true);
  expect(run.primaryObserverId).toBe(run.observers[0].id);
  expect(await loadChildState(db, KID, 'abaObservers')).toEqual(run.observers);
  expect(router.replace).toHaveBeenCalledWith('/aba/session');
});

describe('подсказка «вместе» перед сопряжением (№166)', () => {
  let n = 0;
  const pairing = (config: AbaPairingSession['config'], endReason: AbaPairingSession['endReason']) =>
    asAbaWriter(db, KID, (tx) =>
      appendPairingSession(
        tx,
        KID,
        {
          id: `00000000-0000-4000-8000-00000000000${(n += 1)}`,
          day: '2026-10-28',
          startedAt: '2026-10-28T10:00:00.000Z',
          endedAt: '2026-10-28T10:01:00.000Z',
          config,
          endReason,
          cycles: 0,
          chosenBy: 'none',
          choicesByChild: 0,
          choicesByAdult: 0,
          options: ['bubbles', 'drum', 'pinwheel'],
          choices: [],
          primaryObserverId: null,
        },
        '2026-10-28T10:01:00.000Z',
      ),
    );

  it('две последние в «Сам» без выбора, с уходом или свёрнутые — подсказка на месте подписи и «Со взрослым» отмечено', async () => {
    mockParams = { mode: 'pairing' };
    await pairing('alone', 'app_backgrounded');
    await pairing('alone', 'abandoned');
    await mount();
    expect(await screen.findByText('Пока это занятие лучше вместе — побудьте рядом')).toBeTruthy();
    expect(screen.queryByTestId('aba-alone-caption')).toBeNull();
    // предвыбор: «Начать» активна сразу и ведёт в лист «Кто ведёт»; «Сам» по-прежнему выбирается
    await fireEvent.press(screen.getByTestId('aba-config-start'));
    expect(screen.getByTestId('aba-who-leads')).toBeTruthy();
  });

  it('последняя — со взрослым, или одна неудача в «Сам», или свёрнутое со взрослым — подписи как обычно', async () => {
    mockParams = { mode: 'pairing' };
    await pairing('alone', 'no_choice');
    await mount();
    expect(await screen.findByTestId('aba-alone-caption')).toBeTruthy();
    screen.unmount();
    await pairing('alone', 'abandoned');
    await pairing('with_adult', 'completed');
    await mount();
    expect(await screen.findByTestId('aba-alone-caption')).toBeTruthy();
    expect(screen.queryByTestId('aba-together-hint')).toBeNull();
    screen.unmount();
    await pairing('alone', 'no_choice');
    await pairing('with_adult', 'app_backgrounded');
    await mount();
    expect(await screen.findByTestId('aba-alone-caption')).toBeTruthy();
  });

  it('перед рабочей сессией подсказки нет', async () => {
    await pairing('alone', 'no_choice');
    await pairing('alone', 'no_choice');
    await mount();
    expect(screen.getByTestId('aba-alone-caption')).toBeTruthy();
  });
});
