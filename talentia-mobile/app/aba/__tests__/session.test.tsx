/**
 * Рабочая сессия ABA (фаза 6) на ручных часах и `memoryDb`: обучение карточке «перерыв» до первой пробы, выбор
 * подкрепителя тапом, проба `match` — запись до последствия, плашка только с жетоном; карточка в пробе — перерыв;
 * выход удержанием — итог сессии; «Сам» — без обучения карточке и без панели.
 */
import AbaSessionScreen from '../session';
import { ABA_TARGETS } from '../../../src/content/aba';
import { initialTargetState } from '../../../src/domain/abaPrompting';
import { initialTokenTraining } from '../../../src/domain/abaTokenTraining';
import { grantAbaProcessing } from '../../../src/services/local/abaConsent';
import { loadChildState, saveChildState } from '../../../src/services/local/childState';
import { asAbaWriter, memoryDb } from '../../../src/services/local/__tests__/nodeSql';
import type { SqlDb } from '../../../src/services/local/sql';
import { voice } from '../../../src/services/voice';
import { useAbaRun } from '../../../src/state/abaRun';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { act, fireEvent, renderWithProviders, screen, waitFor, within } from '../../../src/test/render';
import { AbaClockProvider, manualClock, type ManualClock } from '../../../src/ui/aba/clock';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => undefined }));
// `expo-crypto` в Jest детерминирован (jest.setup.js): без счётчика вторая проба сессии получает тот же id и
// падает на UNIQUE `aba_trials.id` — тесты с двумя пробами подряд были бы невозможны.
jest.mock('../../../src/services/abaIds', () => {
  let n = 0;
  return { newAbaId: () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}` };
});
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
const OBS = '00000000-0000-4000-8000-0000000000b1';
const HIDDEN = { includeHiddenElements: true };
let db: SqlDb;
let clock: ManualClock;
const tick = async (ms: number) => act(async () => clock.advance(ms));
const count = async (table: string) => (await db.all<{ n: number }>(`SELECT count(*) AS n FROM ${table} WHERE child_id = ?`, [KID]))[0].n;

async function mount() {
  await renderWithProviders(
    <AbaClockProvider clock={clock}>
      <AbaSessionScreen />
    </AbaClockProvider>,
  );
}

/** id стимула на плите (заглушка разработчика или фигура). */
const stimOf = (testID: string) => {
  const n = within(screen.getByTestId(testID)).queryAllByTestId(/^aba-(stub|stim)-/)[0];
  return String(n?.props.testID ?? '').replace(/^aba-(stub|stim)-/, '');
};
const correctOption = () => {
  const sample = stimOf('aba-sample');
  for (let i = 0; i < 3; i += 1) if (screen.queryByTestId(`aba-option-${i}`) && stimOf(`aba-option-${i}`) === sample) return `aba-option-${i}`;
  throw new Error('верный вариант не найден');
};

async function chooseFirst() {
  await waitFor(() => expect(screen.getByTestId('aba-choice')).toBeTruthy());
  const card = screen.getAllByTestId(/^aba-reinforcer-(?!stub)/)[0];
  await fireEvent.press(card);
  await tick(800);
}

async function skipCardTraining() {
  for (let i = 0; i < 3; i += 1) {
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-panel-l4_skipped'));
  }
}

beforeEach(async () => {
  router.replace.mockClear();
  clock = manualClock();
  db = await memoryDb();
  await grantAbaProcessing(db, { childId: KID, accountId: 'acc', lang: 'ru', at: new Date(clock.now() - 60_000).toISOString(), randomBytes: (n) => new Uint8Array(n).fill(7) });
  await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 1 }, new Date(clock.now()).toISOString()));
  useAccount.setState({ db, accountId: 'acc', status: 'ready' });
  useChildSession.setState({ childId: KID, mode: 'account' });
  useAbaRun.getState().set({ config: 'with_adult', observers: [{ id: OBS, role: 'parent', trained: false }], primaryObserverId: OBS });
});

it('со взрослым: три возможности карточки до выбора; пропуск — дальше, без перерыва', async () => {
  await mount();
  await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
  expect(screen.getByTestId('aba-panel-caption').props.children).toBe('Коснитесь карточки «перерыв» сами');
  // плит стимула при обучении карточке нет
  expect(screen.queryByTestId('aba-sample')).toBeNull();
  await skipCardTraining();
  await waitFor(() => expect(screen.getByTestId('aba-choice')).toBeTruthy());
});

it('касание карточки при обучении — перерыв, «Вернуться» — следующая возможность', async () => {
  await mount();
  await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
  await tick(1000);
  await fireEvent.press(screen.getByTestId('aba-break-card'));
  await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('aba-break-return'));
  await waitFor(() => expect(screen.getByTestId('aba-panel-caption').props.children).toBe('Покажите на неё жестом'));
});

it('выбор → проба: варианты до касания образца не отвечают; верный ответ записан до последствия', async () => {
  await mount();
  await skipCardTraining();
  await chooseFirst();
  await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
  expect(screen.getByTestId('aba-instruction')).toBeTruthy();
  expect(await count('aba_reinforcer_choices')).toBe(1);
  const right = correctOption();
  await fireEvent.press(screen.getByTestId(right));
  expect(await count('aba_trials')).toBe(0);
  await fireEvent.press(screen.getByTestId('aba-sample'));
  await fireEvent.press(screen.getByTestId(right));
  await waitFor(async () => expect(await count('aba_trials')).toBe(1));
  const [row] = await db.all<{ body: string }>('SELECT body FROM aba_trials WHERE child_id = ?', [KID]);
  expect(JSON.parse(row.body)).toMatchObject({ chosenCardId: stimOf('aba-sample'), scoredBy: 'device_tap' });
});

it('плашка — только с жетоном: базовая линия последствия не даёт, дальше следующий SD', async () => {
  await mount();
  await skipCardTraining();
  await chooseFirst();
  await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('aba-sample'));
  await fireEvent.press(screen.getByTestId(correctOption()));
  await waitFor(async () => expect(await count('aba_trials')).toBe(1));
  // новые цели — базовая линия: нейтрально, без плашки и без жетона
  expect(screen.queryByTestId('aba-reinforcement')).toBeNull();
  await tick(5000);
  await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
  expect(screen.queryAllByTestId('aba-strip-token-filled', HIDDEN)).toHaveLength(0);
});

it('обучение, верно на стартовом уровне — плашка с жетоном: жетон ложится в 340, плашка уходит в 4000, полная доска — доступ', async () => {
  const two = ABA_TARGETS.find((t) => t.id === 'match-same-2')!;
  const states = { [two.id]: { ...initialTargetState(two), phase: 'acquisition' as const, startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const } };
  await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaTargets', states, new Date(clock.now()).toISOString()));
  await mount();
  await skipCardTraining();
  await chooseFirst();
  await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('aba-sample'));
  await fireEvent.press(screen.getByTestId(correctOption()));
  await waitFor(() => expect(screen.getByTestId('aba-reinforcement')).toBeTruthy());
  expect(screen.queryAllByTestId('aba-overlay-token-filled', HIDDEN)).toHaveLength(0);
  // срок «плашка» — в момент записи: ручные часы проходят его отдельным шагом
  await tick(0);
  await tick(340);
  expect(screen.queryAllByTestId('aba-overlay-token-filled', HIDDEN)).toHaveLength(1);
  await tick(360);
  await tick(3300);
  expect(screen.queryByTestId('aba-reinforcement')).toBeNull();
  // обмен сразу обнулил доску, но до экрана обмена ребёнок видит её полной
  expect(screen.queryAllByTestId('aba-strip-token-filled', HIDDEN)).toHaveLength(1);
  // доска из одной ячейки (обучение доске) полна — обмен сразу: со следующим SD — доступ к подкрепителю
  await tick(1000);
  await waitFor(() => expect(screen.getByTestId('aba-access-scene')).toBeTruthy());
});

it('«Отказ» в фазе последствия — отказ вне пробы: сессия кончается спокойно, следующего SD нет', async () => {
  await mount();
  await skipCardTraining();
  await chooseFirst();
  await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('aba-sample'));
  await fireEvent.press(screen.getByTestId(correctOption()));
  await waitFor(async () => expect(await count('aba_trials')).toBe(1));
  await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
  await waitFor(() => expect(screen.getByTestId('aba-end-neutral')).toBeTruthy());
  const [row] = await db.all<{ body: string }>('SELECT body FROM aba_sessions WHERE child_id = ?', [KID]);
  expect(JSON.parse(row.body)).toMatchObject({ endReason: 'assent_withdrawn' });
});

it('обучение карточке: подпись кнопки — «Пропустить», а не «Отказ»', async () => {
  await mount();
  await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
  expect(screen.getByText('Пропустить')).toBeTruthy();
  expect(screen.queryByTestId('aba-panel-refusal')).toBeNull();
});

it('карточка «перерыв» в пробе — проба прервана просьбой, сразу перерыв', async () => {
  await mount();
  await skipCardTraining();
  await chooseFirst();
  await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
  await tick(500);
  await fireEvent.press(screen.getByTestId('aba-break-card'));
  await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
  const [row] = await db.all<{ body: string }>('SELECT body FROM aba_trials WHERE child_id = ?', [KID]);
  expect(JSON.parse(row.body)).toMatchObject({ response: 'interrupted', interruptedBy: 'child_break' });
});

it('выход удержанием — итог сессии записан, на карту', async () => {
  await mount();
  await skipCardTraining();
  await chooseFirst();
  await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
  await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
  await tick(1500);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/map'));
  expect(await count('aba_sessions')).toBe(1);
  expect(await loadChildState(db, KID, 'abaSessionInProgress')).toBeFalsy();
});

it('«Сам»: без обучения карточке и без панели взрослого', async () => {
  // «Сам» открывается форматом, освоенным со взрослым: «одинаковые из 2» освоена по критерию, «из 3» — в обучении
  const two = ABA_TARGETS.find((t) => t.id === 'match-same-2')!;
  const three = ABA_TARGETS.find((t) => t.id === 'match-same-3')!;
  const states = {
    [two.id]: { ...initialTargetState(two), phase: 'mastered' as const, startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const, masteredConfig: 'with_adult' as const, masteredBy: 'criterion' as const, lastMaintenanceSessionIndex: 0 },
    [three.id]: { ...initialTargetState(three), phase: 'acquisition' as const, startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const },
  };
  await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaTargets', states, new Date(clock.now()).toISOString()));
  useAbaRun.getState().set({ config: 'alone', observers: [], primaryObserverId: null });
  await mount();
  await chooseFirst();
  await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
  expect(screen.queryByTestId('aba-adult-panel')).toBeNull();
});

it('без конфигурации — к взрослому на parent/aba (этап G1: детского экрана выбора нет)', async () => {
  useAbaRun.getState().reset();
  await mount();
  expect(screen.getByTestId('redirect').props.children).toBe('/parent/aba');
});

describe('звук последствия (№158)', () => {
  const wrongOption = () => {
    const right = correctOption();
    for (let i = 0; i < 3; i += 1) if (screen.queryByTestId(`aba-option-${i}`) && `aba-option-${i}` !== right) return `aba-option-${i}`;
    throw new Error('неверный вариант не найден');
  };
  const acquisitionAtL0 = async () => {
    const two = ABA_TARGETS.find((t) => t.id === 'match-same-2')!;
    const states = { [two.id]: { ...initialTargetState(two), phase: 'acquisition' as const, startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const } };
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaTargets', states, new Date(clock.now()).toISOString()));
  };

  it('token_praise: жетон звучит при посадке (340), похвала — в 700', async () => {
    await acquisitionAtL0();
    await mount();
    await skipCardTraining();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    voice.stop();
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await fireEvent.press(screen.getByTestId(correctOption()));
    await waitFor(() => expect(screen.getByTestId('aba-reinforcement')).toBeTruthy());
    // плашка показана, жетон ещё в полёте — тишина
    expect(voice.last).toBeNull();
    await tick(0);
    await tick(340);
    expect(screen.queryAllByTestId('aba-overlay-token-filled', HIDDEN)).toHaveLength(1);
    expect(voice.last?.key).toBe('abaSession.sound.token');
    await tick(360);
    expect(voice.last?.key).toBe('abaSession.sound.praise');
  });

  it('praise без жетона (проба коррекции): только похвала в 300, звука жетона и плашки нет', async () => {
    await acquisitionAtL0();
    await mount();
    await skipCardTraining();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    // неверно на L0 — нейтрально, за ним проба коррекции того же SD
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await fireEvent.press(screen.getByTestId(wrongOption()));
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    expect(screen.queryByTestId('aba-reinforcement')).toBeNull();
    // следующий SD — проба коррекции; до неё домен может поставить нейтральную паузу: ждём фазу пробы по панели
    await tick(5000);
    for (let i = 0; i < 12 && !screen.queryByTestId('aba-panel-adult_prompted'); i += 1) await tick(1000);
    await waitFor(() => expect(screen.getByTestId('aba-panel-adult_prompted')).toBeTruthy());
    expect(await count('aba_trials')).toBe(1);
    voice.stop();
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await fireEvent.press(screen.getByTestId(correctOption()));
    await waitFor(async () => expect(await count('aba_trials')).toBe(2));
    const rows = await db.all<{ body: string }>('SELECT body FROM aba_trials WHERE child_id = ? ORDER BY rowid', [KID]);
    // верный под подсказкой выше стартовой — `prompted`: коррекция успешна по построению, жетон за неё не платится
    expect(JSON.parse(rows[1].body)).toMatchObject({ kind: 'correction', response: 'prompted', tokens: 0 });
    expect(screen.queryByTestId('aba-reinforcement')).toBeNull();
    expect(voice.last).toBeNull();
    await tick(0);
    await tick(300);
    expect(voice.last?.key).toBe('abaSession.sound.praise');
    // до следующего SD никакого звука жетона
    await tick(400);
    await tick(3300);
    expect(voice.last?.key).toBe('abaSession.sound.praise');
    expect(screen.queryAllByTestId('aba-overlay-token-filled', HIDDEN)).toHaveLength(0);
  });

  it('neutral (базовая линия): голос не звучит до следующего SD', async () => {
    await mount();
    await skipCardTraining();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    voice.stop();
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await fireEvent.press(screen.getByTestId(correctOption()));
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    await tick(0);
    await tick(300);
    await tick(400);
    await tick(3300);
    expect(voice.last).toBeNull();
    await tick(1000);
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(voice.last).toBeNull();
  });
});
