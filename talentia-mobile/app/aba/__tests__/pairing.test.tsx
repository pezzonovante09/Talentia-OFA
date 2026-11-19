/**
 * Экран сопряжения (раздел 3, цикл 3) на ручных часах и `memoryDb`: четыре цикла тапом до конца с Tali и записью итога;
 * обмен одной ячейки — тот же экран, что в сессии (Ц3.4: въезд 220, удержание 600, полёт, «получено», раскрытие);
 * доступ с кадром конца (Ц3.5); выбор взрослого полосой; выход удержанием пишет остановку взрослого и ведёт на карту;
 * без конфигурации — на 2.6.
 */
import { StyleSheet } from 'react-native';

import AbaPairingScreen from '../pairing';
import { abaEndDone } from '../../../src/design/abaTokens';
import { PAIRING } from '../../../src/domain/abaTokenTraining';
import { grantAbaProcessing } from '../../../src/services/local/abaConsent';
import { loadChildState } from '../../../src/services/local/childState';
import { setAbaPaused } from '../../../src/services/local/commit';
import { memoryDb } from '../../../src/services/local/__tests__/nodeSql';
import type { SqlDb } from '../../../src/services/local/sql';
import { voice } from '../../../src/services/voice';
import { useAbaRun } from '../../../src/state/abaRun';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { appStateFake } from '../../../src/test/appStateFake';
import { manualClockDriver } from '../../../src/test/manualClockDriver';
import { fireEvent, renderWithProviders, screen, waitFor } from '../../../src/test/render';
import { AbaClockProvider, type ManualClock } from '../../../src/ui/aba/clock';

// экран на ручных часах: тест — сотни шагов `act`; под нагрузкой всего набора нужен прежний запас (общий testTimeout — 15 с)
jest.setTimeout(60_000);

jest.mock('expo-router', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').expoRouterMock());
const router = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock; dismissTo: jest.Mock } }).__router;

const KID = '00000000-0000-4000-8000-0000000000a1';
let db: SqlDb;
let clock: ManualClock;

/** Доска и кольцо скрыты от скринридера (`accessibilityElementsHidden`) — ищутся с этим флагом. */
const HIDDEN = { includeHiddenElements: true };
/** Часы с выключателем (`afterEach`): цикл теста, переживший таймаут, не двигает часы следующего (`manualClockDriver`). */
const clockDriver = manualClockDriver();
const { tick, stepTo } = clockDriver;
const filledCells = () => screen.queryAllByTestId('aba-exchange-token-filled', HIDDEN).length;
const cardStroke = () => StyleSheet.flatten(screen.getByTestId('aba-exchange-card').props.style).borderWidth as number;
/** Обмен одной ячейки от начала въезда: 220 + 600 + 360 + 300 + 360. */
const EXCHANGE_MS = 1840;
/** Кадр конца доступа: сворачивание 360 + карточка 1000. */
const END_FRAME_MS = 1360;

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
  const t0 = clock.now();
  expect(screen.getByTestId('aba-pairing-wait')).toBeTruthy();
  expect(screen.getByTestId('aba-pairing-token-empty', HIDDEN)).toBeTruthy();
  // шаги крупные: точные границы кадров проверяют тесты блока «цикл 3»; здесь — только порядок за четыре цикла
  // (мелкий шаг на четырёх циклах — сотни `act`, тест и с крупным идёт 3,8 с в одиночку)
  await stepTo(t0 + PAIRING.tokenAfterMs, 1000);
  expect(screen.getByTestId('aba-pairing-exchange')).toBeTruthy();
  await stepTo(t0 + PAIRING.tokenAfterMs + 220, 220);
  expect(filledCells()).toBe(1);
  await stepTo(t0 + PAIRING.tokenAfterMs + EXCHANGE_MS, 200);
  const A = clock.now();
  expect(screen.getByTestId('aba-access-play')).toBeTruthy();
  expect(screen.getByTestId('aba-access-scene')).toBeTruthy();
  expect(screen.getByTestId('aba-access-ring', HIDDEN)).toBeTruthy();
  await stepTo(A + PAIRING.accessMs + END_FRAME_MS, 1000);
  // хвост: просроченные сроки (их несколько на один крупный шаг) догоняются шагами по 0
  for (let i = 0; i < 4; i += 1) await tick(0);
}

beforeEach(async () => {
  router.replace.mockClear();
  router.dismissTo.mockClear();
  clock = clockDriver.start();
  db = await memoryDb();
  await grantAbaProcessing(db, { childId: KID, accountId: 'acc', lang: 'ru', at: new Date(clock.now()).toISOString(), randomBytes: (n) => new Uint8Array(n).fill(7) });
  useAccount.setState({ db, accountId: 'acc', status: 'ready' });
  useChildSession.setState({ childId: KID, mode: 'account', openedForAba: false });
  useAbaRun.getState().set({ config: 'with_adult', observers: [], primaryObserverId: null });
});

afterEach(() => {
  clockDriver.kill();
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
  // «Готово» (Ц3.8): касание в первые 1000 мс от показа кадра не засчитывается
  await fireEvent.press(screen.getByTestId('aba-end-done'));
  expect(router.dismissTo).not.toHaveBeenCalled();
  await tick(abaEndDone.lockMs);
  await fireEvent.press(screen.getByTestId('aba-end-done'));
  expect(router.dismissTo).toHaveBeenCalledWith('/map');
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
  await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
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
  await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
  expect(await loadChildState(db, KID, 'tokenTraining')).toMatchObject({ pairingSessions: 1, pairingStreak: 0 });
});

it('свернули посреди сопряжения — сессия не засчитана, конец нейтральный, просроченные стадии не проходят', async () => {
  const appState = appStateFake();
  appState.install();
  try {
    await mount();
    await fireEvent.press(screen.getByTestId(`aba-reinforcer-${cards()[0]}`));
    await tick(800);
    await appState.emit('background');
    await waitFor(() => expect(screen.getByTestId('aba-end-neutral')).toBeTruthy());
    await tick(60_000);
    expect(screen.queryByTestId('aba-access-scene')).toBeNull();
    expect((await loadChildState(db, KID, 'tokenTraining')) ?? { pairingSessions: 0 }).toMatchObject({ pairingSessions: 0 });
    // №164: в записи сессии — «свернули», а не остановка взрослым
    const [rec] = await db.all<{ body: string }>('SELECT body FROM aba_pairing_sessions WHERE child_id = ?', [KID]);
    expect(JSON.parse(rec.body)).toMatchObject({ endReason: 'app_backgrounded', config: 'with_adult', cycles: 0 });
  } finally {
    appState.restore();
  }
});

it('без выбранной конфигурации — к взрослому на parent/aba (этап G1)', async () => {
  useAbaRun.getState().reset();
  await renderWithProviders(
    <AbaClockProvider clock={clock}>
      <AbaPairingScreen />
    </AbaClockProvider>,
  );
  expect(screen.getByTestId('redirect').props.children).toBe('/parent/aba');
});

it('ожидание жетона: карточка нажимается, но ничего не делает — жетон не раньше срока, сцена доступа не раньше, ошибок нет', async () => {
  await mount();
  await fireEvent.press(screen.getByTestId(`aba-reinforcer-${cards()[0]}`));
  await tick(800);
  expect(screen.getByTestId('aba-pairing-wait')).toBeTruthy();
  const card = screen.getByTestId('aba-pairing-wait-card');
  expect(card.props.accessibilityRole).toBe('image');
  await fireEvent.press(card);
  await fireEvent.press(card);
  await tick(100);
  expect(screen.getByTestId('aba-pairing-token-empty', HIDDEN)).toBeTruthy();
  expect(screen.queryByTestId('aba-pairing-exchange')).toBeNull();
  expect(filledCells()).toBe(0);
  expect(screen.queryByTestId('aba-access-scene')).toBeNull();
  // срок жетона считается от выбора, а не от касания: приходит ровно тогда же, что и без касаний
  const chosenAt = clock.now() - 100;
  await stepTo(chosenAt + PAIRING.tokenAfterMs - 1, 500);
  expect(screen.queryByTestId('aba-pairing-exchange')).toBeNull();
  await stepTo(chosenAt + PAIRING.tokenAfterMs);
  expect(screen.getByTestId('aba-pairing-exchange')).toBeTruthy();
  await stepTo(chosenAt + PAIRING.tokenAfterMs + 220);
  expect(filledCells()).toBe(1);
  await stepTo(chosenAt + PAIRING.tokenAfterMs + EXCHANGE_MS);
  expect(screen.getByTestId('aba-access-scene')).toBeTruthy();
});

describe('цикл 3 (№171): обмен и кадр конца в сопряжении', () => {
  /** Выбор первой карточки; вернуть момент засчитанного выбора (начало 10 с ожидания). */
  async function choose(): Promise<number> {
    await mount();
    await fireEvent.press(screen.getByTestId(`aba-reinforcer-${cards()[0]}`));
    await tick(800);
    return clock.now();
  }

  it('ожидание: карточка выбранного, Tali, пустая ячейка; карточки обмена нет', async () => {
    await choose();
    expect(screen.getByTestId('aba-pairing-wait-card')).toBeTruthy();
    expect(screen.getByTestId('aba-pairing-tali')).toBeTruthy();
    expect(screen.getByTestId('aba-pairing-token-empty', HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId('aba-exchange-card')).toBeNull();
  });

  it('жетон въезжает 220 мс, при посадке — звук жетона; удержание 600 — вылет в 820 от начала обмена', async () => {
    const t0 = (await choose()) + PAIRING.tokenAfterMs;
    voice.stop();
    await stepTo(t0, 500);
    expect(screen.getByTestId('aba-exchange-token-landing', HIDDEN)).toBeTruthy();
    expect(filledCells()).toBe(0);
    await stepTo(t0 + 219);
    expect(voice.last).toBeNull();
    await stepTo(t0 + 220);
    expect(filledCells()).toBe(1);
    expect(voice.last?.key).toBe('abaSession.sound.token');
    await stepTo(t0 + 819);
    expect(filledCells()).toBe(1);
    await stepTo(t0 + 820);
    expect(filledCells()).toBe(0);
    expect(screen.getAllByTestId('aba-exchange-token-empty', HIDDEN)).toHaveLength(1);
  });

  it('«получено» — контур карточки 6 в 1180; доступ ровно в 1840 от начала обмена', async () => {
    const t0 = (await choose()) + PAIRING.tokenAfterMs;
    await stepTo(t0 + 1179, 500);
    expect(cardStroke()).toBe(3);
    await stepTo(t0 + 1180);
    expect(cardStroke()).toBe(6);
    await stepTo(t0 + EXCHANGE_MS - 1);
    expect(screen.queryByTestId('aba-access-play')).toBeNull();
    await stepTo(t0 + EXCHANGE_MS);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
  });

  it('доступ 20 с: кольцо с силуэтом до T, в T исчезает; карточка на кадре конца; следующий выбор через 360 + 1000', async () => {
    const A = (await choose()) + PAIRING.tokenAfterMs + EXCHANGE_MS;
    await stepTo(A, 500);
    await stepTo(A + PAIRING.accessMs - 1, 250);
    expect(screen.getByTestId('aba-access-ring', HIDDEN)).toBeTruthy();
    expect(screen.getByTestId('aba-access-ring-silhouette', HIDDEN)).toBeTruthy();
    // карточка кадра конца рисуется только с измеренным местом: RNTL `onLayout` не шлёт, у области нет своего testID
    const [area] = screen.getByTestId('aba-access-play').queryAll((n) => typeof n.props.onLayout === 'function');
    await fireEvent(area, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 343, height: 543 } } });
    await stepTo(A + PAIRING.accessMs);
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    expect(screen.queryByTestId('aba-access-ring-silhouette', HIDDEN)).toBeNull();
    // сворачивание: кадр стадии `fold` и рамка с тем же testID; карточка встаёт в конце сворачивания
    expect(screen.getAllByTestId('aba-access-fold')).toHaveLength(2);
    await stepTo(A + PAIRING.accessMs + END_FRAME_MS - 1);
    expect(screen.getByTestId('aba-access-hold')).toBeTruthy();
    expect(screen.getByTestId('aba-access-card')).toBeTruthy();
    expect(screen.queryByTestId('aba-choice')).toBeNull();
    await stepTo(A + PAIRING.accessMs + END_FRAME_MS);
    await waitFor(() => expect(screen.getByTestId('aba-choice')).toBeTruthy());
    expect(screen.getByText('За что играем теперь?')).toBeTruthy();
  });

  it('calm: жетон сразу в ячейке, «получено» в 600, доступ в 1100', async () => {
    const before = useChildSession.getState().settings;
    useChildSession.setState({ settings: { ...before, calmMode: true } });
    try {
      const t0 = (await choose()) + PAIRING.tokenAfterMs;
      await stepTo(t0, 500);
      expect(screen.queryByTestId('aba-exchange-token-landing', HIDDEN)).toBeNull();
      expect(filledCells()).toBe(1);
      await stepTo(t0 + 599);
      expect(filledCells()).toBe(1);
      await stepTo(t0 + 600);
      expect([filledCells(), cardStroke()]).toEqual([0, 6]);
      await stepTo(t0 + 1099);
      expect(screen.queryByTestId('aba-access-play')).toBeNull();
      await stepTo(t0 + 1100);
      expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    } finally {
      useChildSession.setState({ settings: before });
    }
  });

  it('стоп на кадре конца четвёртого цикла — сопряжение засчитано (completed), а не остановка', async () => {
    await mount();
    const options = cards();
    for (let i = 0; i < PAIRING.cycles - 1; i += 1) await oneCycle(options[i % 3]);
    await fireEvent.press(screen.getByTestId(`aba-reinforcer-${options[0]}`));
    await tick(800);
    const A = clock.now() + PAIRING.tokenAfterMs + EXCHANGE_MS;
    await stepTo(A + PAIRING.accessMs + 400, 250);
    expect(screen.getByTestId('aba-access-hold')).toBeTruthy();
    await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
    await tick(1500);
    await waitFor(async () => {
      const [rec] = await db.all<{ body: string }>('SELECT body FROM aba_pairing_sessions WHERE child_id = ?', [KID]);
      expect(JSON.parse(rec.body)).toMatchObject({ endReason: 'completed', cycles: 4 });
    });
  });
});

describe('занятие открыто ради другого ребёнка (`openedForAba`): конец ведёт к выбору профиля', () => {
  beforeEach(() => {
    useChildSession.setState({ openedForAba: true });
  });

  it('выход удержанием: к выбору профиля, а не на карту, детская сессия сброшена', async () => {
    await mount();
    await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
    await tick(1500);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(useChildSession.getState()).toMatchObject({ childId: null, mode: 'none', openedForAba: false });
  });

  it('«Готово» на экране конца: к выбору профиля', async () => {
    expect(await setAbaPaused(db, KID, true, new Date(clock.now()).toISOString())).toBe('saved');
    await renderWithProviders(
      <AbaClockProvider clock={clock}>
        <AbaPairingScreen />
      </AbaClockProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('aba-end-done')).toBeTruthy());
    await tick(abaEndDone.lockMs);
    await fireEvent.press(screen.getByTestId('aba-end-done'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
    expect(router.dismissTo).not.toHaveBeenCalled();
  });
});
