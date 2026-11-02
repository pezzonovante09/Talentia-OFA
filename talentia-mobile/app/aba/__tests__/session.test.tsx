/**
 * Рабочая сессия ABA (фаза 6) на ручных часах и `memoryDb`: обучение карточке «перерыв» до первой пробы, выбор
 * подкрепителя тапом, проба `match` — запись до последствия, плашка только с жетоном; карточка в пробе — перерыв;
 * выход удержанием — итог сессии; «Сам» — без обучения карточке и без панели. Фаза 7 (№169): приглашения после
 * перерыва и конец по бездействию, обучающий перерыв без конца, экран обмена, доступ и хвост конца с циклом сопряжения.
 */
import { StyleSheet } from 'react-native';

import AbaSessionScreen from '../session';
import { ABA_TARGETS } from '../../../src/content/aba';
import { abaEndDone, ABA_CONTROL_STROKE } from '../../../src/design/abaTokens';
import { motion } from '../../../src/design/tokens';
import { initialTargetState } from '../../../src/domain/abaPrompting';
import ru from '../../../src/i18n/locales/ru.json';
import { initialTokenTraining, PAIRING } from '../../../src/domain/abaTokenTraining';
import { grantAbaProcessing } from '../../../src/services/local/abaConsent';
import { loadChildState, saveChildState } from '../../../src/services/local/childState';
import { asAbaWriter, memoryDb } from '../../../src/services/local/__tests__/nodeSql';
import type { SqlDb } from '../../../src/services/local/sql';
import { voice } from '../../../src/services/voice';
import { useAbaRun } from '../../../src/state/abaRun';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { act, fireEvent, renderWithProviders, screen, waitFor, within } from '../../../src/test/render';
import { REFUSAL_QUIET_MS, RETURN_INVITE_AFTER_MS } from '../../../src/types/aba';
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
/**
 * Дойти до момента `to` шагами не длиннее `step`: ручные часы будят один срок экрана за шаг (следующий ставится после
 * рендера), поэтому шаг короче расстояния между сроками — и каждый кадр приходит ровно в свой срок.
 */
async function stepTo(to: number, step = 20) {
  while (clock.now() < to) await tick(Math.min(step, to - clock.now()));
}
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
  // доска из одной ячейки (обучение доске) полна — обмен сразу: со следующим SD — экран обмена без кнопки, жетон
  // лежит 600 мс (одна ячейка, №171) и улетает в карточку; ячейка пустеет в момент вылета (Ц3.4), затем «получено»,
  // раскрытие и доступ к подкрепителю
  await tick(1000);
  await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
  expect(screen.queryAllByTestId('aba-exchange-token-filled', HIDDEN)).toHaveLength(1);
  await tick(599);
  expect(screen.queryAllByTestId('aba-exchange-token-filled', HIDDEN)).toHaveLength(1);
  await tick(1);
  expect(screen.queryAllByTestId('aba-exchange-token-filled', HIDDEN)).toHaveLength(0);
  expect(screen.queryAllByTestId('aba-exchange-token-empty', HIDDEN)).toHaveLength(1);
  await stepTo(clock.now() + 360 + 300 + 360 - 1);
  expect(screen.queryByTestId('aba-access-scene')).toBeNull();
  await stepTo(clock.now() + 1);
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
  // конец по отказу без полной доски — хвост с циклом сопряжения (Ц3.2): сначала ожидание, «Закончили» — после цикла
  await waitFor(() => expect(screen.getByTestId('aba-end-wait')).toBeTruthy());
  expect(screen.queryByTestId('aba-sample')).toBeNull();
  expect(screen.queryByTestId('aba-adult-panel')).toBeNull();
  const [row] = await db.all<{ body: string }>('SELECT body FROM aba_sessions WHERE child_id = ?', [KID]);
  expect(JSON.parse(row.body)).toMatchObject({ endReason: 'assent_withdrawn' });
  await stepTo(clock.now() + 60_000, 250);
  expect(screen.getByTestId('aba-end-neutral')).toBeTruthy();
  // следующего SD так и не было: проба одна
  expect(await count('aba_trials')).toBe(1);
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

describe('фаза 7 (№169): перерыв, обмен, конец', () => {
  const border = () => StyleSheet.flatten(screen.getByTestId('aba-break-return').props.style).borderWidth as number;
  /** Планки 120 в центре контурные: у прямоугольников есть штрих (у сплошных — только заливка). */
  const iconOutline = () => {
    type El = { type: string; props: Record<string, unknown>; children: (El | string)[] };
    const collect = (n: El | string): El[] => (typeof n === 'string' ? [] : [...(n.type === 'RNSVGRect' ? [n] : []), ...n.children.flatMap(collect)]);
    const rects = collect(screen.getByTestId('aba-break-icon') as unknown as El) as { props: { strokeWidth?: unknown } }[];
    expect(rects).toHaveLength(2);
    return rects.every((r) => typeof r.props.strokeWidth === 'number' && r.props.strokeWidth > 0);
  };
  /** Ручные часы будят один срок за шаг: шагать, пока условие не выполнится (не дольше `max` шагов). */
  async function tickUntil(pred: () => boolean, step = 1000, max = 300) {
    for (let i = 0; i < max && !pred(); i += 1) await tick(step);
    expect(pred()).toBe(true);
  }
  type SessionBody = { endReason: string; exchangesMade: number; events: { kind: string; by?: string; action?: string; initiatedBy?: string }[] };
  const sessionBody = async (): Promise<SessionBody> => {
    const [row] = await db.all<{ body: string }>('SELECT body FROM aba_sessions WHERE child_id = ?', [KID]);
    return JSON.parse(row.body) as SessionBody;
  };
  type Host = { type: string; children: (Host | string)[] };
  const hasType = (n: Host | string, type: string): boolean => typeof n !== 'string' && (n.type === type || n.children.some((c) => hasType(c, type)));
  /** Ячейки доски на «Закончили»: у полной ячейки есть звезда (`Path`), у пустой — только круг. */
  const endCells = () => (screen.getByTestId('aba-end-board').children as unknown as Host[]).map((cell) => hasType(cell, 'RNSVGPath'));
  /** «Готово» (Ц3.8): касание раньше 1000 мс от показа кадра не засчитывается; затем — на карту. */
  async function doneLeadsToMap() {
    expect(screen.getByTestId('aba-end-done').props.accessibilityState?.disabled).toBeFalsy();
    await tick(abaEndDone.lockMs);
    await fireEvent.press(screen.getByTestId('aba-end-done'));
    expect(router.replace).toHaveBeenCalledWith('/map');
  }

  /** Сессия со взрослым до перерыва по карточке в первой пробе. */
  async function breakInTrial() {
    await mount();
    await skipCardTraining();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    await tick(500);
    await fireEvent.press(screen.getByTestId('aba-break-card'));
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
  }
  /** Кольцо кончилось — первое приглашение (контур 6), через `RETURN_INVITE_AFTER_MS` — второе, со звуком. */
  async function toSecondInvite() {
    await tickUntil(() => border() === 6);
    voice.stop();
    await tick(RETURN_INVITE_AFTER_MS - 1);
    expect(voice.last).toBeNull();
    await tick(1);
    expect(voice.last?.key).toBe('abaSession.sound.invite');
  }
  /** Первая проба записана (базовая линия), затем «Отказ» вне пробы — конец по отказу. */
  async function refuseAfterFirstTrial() {
    await mount();
    await skipCardTraining();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await fireEvent.press(screen.getByTestId(correctOption()));
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
  }

  it('кольцо перерыва кончилось — первое приглашение: контур 6 и тихий сигнал', async () => {
    await breakInTrial();
    expect(border()).toBe(ABA_CONTROL_STROKE);
    voice.stop();
    await tickUntil(() => border() === 6);
    expect(voice.last?.key).toBe('abaSession.sound.invite');
  });

  it('второе приглашение отличимо без звука (Ц3.1): планки 120 становятся контурными, контур 6 у «Вернуться» не снимается ни на миг', async () => {
    await breakInTrial();
    await tickUntil(() => border() === 6);
    expect(iconOutline()).toBe(false);
    await tick(RETURN_INVITE_AFTER_MS - 1);
    expect(iconOutline()).toBe(false);
    expect(border()).toBe(6);
    await tick(1);
    expect(iconOutline()).toBe(true);
    expect(border()).toBe(6);
    // мигания нет: и через 220 мс (прежний `REINVITE_BLINK_MS`), и позже — то же устойчивое состояние
    for (const ms of [1, motion.base, 1000]) {
      await tick(ms);
      expect([border(), iconOutline()]).toEqual([6, true]);
    }
  });

  it('значок 120 в центре — роль image, касание не возвращает и не пишет (Ц3.1)', async () => {
    await breakInTrial();
    const icon = screen.getByTestId('aba-break-icon');
    expect(icon.props.accessibilityRole).toBe('image');
    const trials = await count('aba_trials');
    await fireEvent.press(icon);
    await tick(10);
    expect(screen.getByTestId('aba-break')).toBeTruthy();
    expect(await count('aba_trials')).toBe(trials);
  });

  it('без возврата после двух приглашений — нейтральный конец по бездействию; в итоге перерыв и отказ device_inactivity', async () => {
    await breakInTrial();
    await toSecondInvite();
    await tick(motion.base);
    // конец — через RETURN_INVITE_AFTER_MS от второго приглашения, не раньше
    await tick(RETURN_INVITE_AFTER_MS - motion.base - 1);
    expect(screen.getByTestId('aba-break')).toBeTruthy();
    expect(await count('aba_sessions')).toBe(0);
    await tick(1);
    await waitFor(() => expect(screen.getByTestId('aba-end-neutral')).toBeTruthy());
    const body = await sessionBody();
    expect(body.endReason).toBe('assent_withdrawn');
    expect(body.events).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'assent', by: 'device_inactivity', action: 'end' })]));
    expect(body.events).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'break', initiatedBy: 'child_card' })]));
    // ни обмена, ни сопряжения в пустой комнате
    expect(body.events.some((e) => e.kind === 'pairing' || e.kind === 'exchange')).toBe(false);
    expect(await loadChildState(db, KID, 'abaSessionInProgress')).toBeFalsy();
    // хвоста нет — сразу «Закончили», «Готово» рабочая (после блокировки кадра)
    expect(screen.queryByTestId('aba-end-wait')).toBeNull();
    await doneLeadsToMap();
  });

  it('конец по бездействию при полной доске — обмена нет, доска на «Закончили» полная (ждёт следующей сессии)', async () => {
    const at = new Date(clock.now()).toISOString();
    await asAbaWriter(db, KID, async (tx) => {
      await saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 3 }, at);
      await saveChildState(tx, KID, 'abaBoard', { earned: 3, nonContingent: 0 }, at);
    });
    await breakInTrial();
    await toSecondInvite();
    await tickUntil(() => screen.queryByTestId('aba-end-neutral') !== null || screen.queryByTestId('aba-exchange') !== null);
    expect(screen.queryByTestId('aba-exchange')).toBeNull();
    expect(endCells()).toEqual([true, true, true]);
    expect((await sessionBody()).exchangesMade).toBe(0);
    expect((await loadChildState(db, KID, 'abaBoard'))?.earned).toBe(3);
  });

  it('«Вернуться» на втором приглашении — сессия продолжается, конца нет и позже', async () => {
    await breakInTrial();
    await toSecondInvite();
    await fireEvent.press(screen.getByTestId('aba-break-return'));
    await tickUntil(() => screen.queryByTestId('aba-sample') !== null);
    await tick(RETURN_INVITE_AFTER_MS);
    expect(screen.queryByTestId('aba-end-neutral')).toBeNull();
    expect(await count('aba_sessions')).toBe(0);
  });

  it('обучающий перерыв по карточке после второго приглашения не кончает сессию — ждёт взрослого', async () => {
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    await tick(1000);
    await fireEvent.press(screen.getByTestId('aba-break-card'));
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    await toSecondInvite();
    await tick(motion.base);
    await tick(10 * RETURN_INVITE_AFTER_MS);
    expect(screen.getByTestId('aba-break')).toBeTruthy();
    expect(screen.queryByTestId('aba-end-neutral')).toBeNull();
    expect(await count('aba_sessions')).toBe(0);
    await fireEvent.press(screen.getByTestId('aba-break-return'));
    await waitFor(() => expect(screen.getByTestId('aba-panel-caption').props.children).toBe('Покажите на неё жестом'));
  });

  it('конец с полной доской: экран обмена без кнопки → доступ по ступени → «Закончили» с доской', async () => {
    // финальная доска 3 (обмена сразу нет), полная до сессии; конец — «Отказ» вне пробы: обмен в конце (№169)
    const at = new Date(clock.now()).toISOString();
    await asAbaWriter(db, KID, async (tx) => {
      await saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 3 }, at);
      await saveChildState(tx, KID, 'abaBoard', { earned: 3, nonContingent: 0 }, at);
    });
    await refuseAfterFirstTrial();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    // итог записан до доступа: свёрнутое во время доступа приложение итог не теряет
    const body = await sessionBody();
    expect(body.exchangesMade).toBe(1);
    expect(body.events.some((e) => e.kind === 'exchange')).toBe(true);
    expect(body.events.some((e) => e.kind === 'pairing')).toBe(false);
    // кнопки «Получить!» нет: требования к ребёнку в конце нет — на экране обмена только выход удержанием
    expect(within(screen.getByTestId('aba-exchange')).queryAllByRole('button').map((b) => b.props.testID)).toEqual(['aba-exit']);
    expect(screen.queryAllByTestId('aba-exchange-token-filled', HIDDEN)).toHaveLength(3);
    const t0 = clock.now();
    // три ячейки: полная доска стоит 1000 мс, полёт со сдвигом 60, «получено» 300, раскрытие 360 — доступ в 2140
    await stepTo(t0 + 999);
    expect(screen.queryAllByTestId('aba-exchange-token-filled', HIDDEN)).toHaveLength(3);
    await stepTo(t0 + 2140 - 1);
    expect(screen.queryByTestId('aba-access-play')).toBeNull();
    await stepTo(t0 + 2140);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    const accessFrom = clock.now();
    // доступ на доске 3 — 40 с: «закругляемся» за 5 с до конца, сцена ещё играет
    voice.stop();
    await tickUntil(() => voice.last?.key === 'abaSession.sound.wrapUp');
    expect(clock.now() - accessFrom).toBe(35_000);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    await tickUntil(() => screen.queryByTestId('aba-end-neutral') !== null);
    expect(endCells()).toEqual([false, false, false]);
    await doneLeadsToMap();
  });

  /** «Отказ» в первой пробе при полной доске 3 — тихая пауза с подсвеченной карточкой; карточки не касаются. */
  async function refusalPauseWithFullBoard() {
    const at = new Date(clock.now()).toISOString();
    await asAbaWriter(db, KID, async (tx) => {
      await saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 3 }, at);
      await saveChildState(tx, KID, 'abaBoard', { earned: 3, nonContingent: 0 }, at);
    });
    await mount();
    await skipCardTraining();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    await tick(500);
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(screen.getByTestId('aba-refusal-pause')).toBeTruthy());
  }

  /**
   * Найдено `qa-engineer` при проверке №169: тихая пауза после «Отказ» при полной доске кончалась обменом и доступом.
   * ABA.md, блок 4, п. 1: тихая пауза — «без жетонов, подкрепителей и внимания» (`breakExchanges`, №170).
   */
  it('тихая пауза после «Отказ» при полной доске — без экрана обмена и без доступа', async () => {
    await refusalPauseWithFullBoard();
    await tickUntil(() => screen.queryByTestId('aba-refusal-pause') === null, 500);
    await tick(1000);
    expect(screen.queryByTestId('aba-exchange')).toBeNull();
  });

  /**
   * Найдено `qa-engineer` (было до фазы 7): экран кончал тихую паузу в срок подсветки карточки (`offerCardMs`, 10 с),
   * а не через `maxMs` (`REFUSAL_QUIET_MS`, 30 с от снятия требования; ABA.md, блок 4, п. 1).
   */
  it('тихая пауза после «Отказ» без касания карточки длится REFUSAL_QUIET_MS', async () => {
    await refusalPauseWithFullBoard();
    const from = clock.now();
    await tickUntil(() => screen.queryByTestId('aba-refusal-pause') === null, 500);
    expect(clock.now() - from).toBeGreaterThanOrEqual(REFUSAL_QUIET_MS);
  });

  it('карточка на 15-й секунде тихой паузы — полный перерыв, а не конец сессии (№170)', async () => {
    await refusalPauseWithFullBoard();
    // подсветка и подсказка взрослому «жестом» — только первые `offerCardMs`
    await tick(15_000);
    expect(screen.queryByTestId('aba-panel-caption')).toBeNull();
    await fireEvent.press(screen.getByTestId('aba-break-card'));
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    expect(screen.queryByTestId('aba-end-neutral')).toBeNull();
    expect(await count('aba_sessions')).toBe(0);
  });

  it('конец по отказу без полной доски — цикл сопряжения (Ц3.2): ожидание без карточки и без «Готово», жетон, доступ, один раз «Закончили»', async () => {
    await refuseAfterFirstTrial();
    await waitFor(() => expect(screen.getByTestId('aba-end-wait')).toBeTruthy());
    expect((await sessionBody()).events.some((e) => e.kind === 'pairing')).toBe(true);
    // ожидание — раскладка сопряжения с пустым слотом карточки: Tali и пустая ячейка; ни карточки, ни «Готово», ни «Закончили»
    expect(screen.getByTestId('aba-end-wait-tali')).toBeTruthy();
    expect(screen.getAllByTestId('aba-exchange-token-empty', HIDDEN)).toHaveLength(1);
    expect(screen.queryByTestId('aba-exchange-card')).toBeNull();
    expect(screen.queryByTestId('aba-end-done')).toBeNull();
    expect(screen.queryByTestId('aba-end-neutral')).toBeNull();
    const from = clock.now();
    await stepTo(from + PAIRING.tokenAfterMs - 1, 500);
    expect(screen.getByTestId('aba-end-wait')).toBeTruthy();
    await stepTo(from + PAIRING.tokenAfterMs, 500);
    // карточка появляется вместе с жетоном
    expect(screen.getByTestId('aba-end-pairing')).toBeTruthy();
    expect(screen.getByTestId('aba-exchange-card')).toBeTruthy();
    // «Закончили» показан один раз — после цикла: до конца доступа его нет ни на одном шаге
    let endSeenEarly = false;
    let sawAccess = false;
    for (let i = 0; i < 400 && !screen.queryByTestId('aba-end-neutral'); i += 1) {
      if (screen.queryByTestId('aba-access-play')) sawAccess = true;
      await tick(100);
      if (!sawAccess && screen.queryByTestId('aba-end-neutral')) endSeenEarly = true;
    }
    expect(sawAccess).toBe(true);
    expect(endSeenEarly).toBe(false);
    expect(screen.getAllByTestId('aba-end-neutral')).toHaveLength(1);
    expect(screen.queryByTestId('aba-end-wait')).toBeNull();
    await doneLeadsToMap();
  });

  /* ───────── вид фазы 7 по циклу 3 (№171) ───────── */

  const cardStroke = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).borderWidth as number;
  const filled = () => screen.queryAllByTestId('aba-exchange-token-filled', HIDDEN).length;
  const empty = () => screen.queryAllByTestId('aba-exchange-token-empty', HIDDEN).length;
  /** Полная доска 3 до сессии, «Отказ» вне пробы — обмен в конце; `t0` — показ кадра обмена. */
  async function endExchangeOfThree(): Promise<number> {
    const at = new Date(clock.now()).toISOString();
    await asAbaWriter(db, KID, async (tx) => {
      await saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 3 }, at);
      await saveChildState(tx, KID, 'abaBoard', { earned: 3, nonContingent: 0 }, at);
    });
    await refuseAfterFirstTrial();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    return clock.now();
  }
  /** Обучение доске (одна ячейка), верно на L0 — обмен сразу; `t0` — показ кадра обмена. */
  async function trainingExchange(): Promise<number> {
    const two = ABA_TARGETS.find((x) => x.id === 'match-same-2')!;
    const states = { [two.id]: { ...initialTargetState(two), phase: 'acquisition' as const, startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const } };
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaTargets', states, new Date(clock.now()).toISOString()));
    await mount();
    await skipCardTraining();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await fireEvent.press(screen.getByTestId(correctOption()));
    await waitFor(() => expect(screen.getByTestId('aba-reinforcement')).toBeTruthy());
    await tick(0);
    await tick(340);
    await tick(360);
    await tick(3300);
    await tick(1000);
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    return clock.now();
  }
  async function holdExit() {
    await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
    await tick(1500);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/map'));
  }
  type AccessEvent = { kind: 'access'; startedAt: string; endedAt: string };
  const accessEvents = async () => (await sessionBody()).events.filter((e) => e.kind === 'access') as unknown as AccessEvent[];

  it('обмен в конце, доска 3 (Ц3.4): полная доска до 1000, ячейки пустеют 1000/1060/1120, «получено» в 1480, ряд скрыт с 1780, доступ с 2140', async () => {
    const t0 = await endExchangeOfThree();
    expect([filled(), cardStroke('aba-exchange-card')]).toEqual([3, ABA_CONTROL_STROKE]);
    await stepTo(t0 + 999);
    expect([filled(), empty()]).toEqual([3, 0]);
    await stepTo(t0 + 1000);
    expect([filled(), empty()]).toEqual([2, 1]);
    await stepTo(t0 + 1060);
    expect([filled(), empty()]).toEqual([1, 2]);
    await stepTo(t0 + 1120);
    expect([filled(), empty()]).toEqual([0, 3]);
    await stepTo(t0 + 1479);
    expect(cardStroke('aba-exchange-card')).toBe(ABA_CONTROL_STROKE);
    await stepTo(t0 + 1480);
    expect([cardStroke('aba-exchange-card'), empty()]).toEqual([6, 3]);
    await stepTo(t0 + 1779);
    expect(empty()).toBe(3);
    await stepTo(t0 + 1780);
    expect([filled(), empty()]).toEqual([0, 0]);
    expect(cardStroke('aba-exchange-card')).toBe(ABA_CONTROL_STROKE);
    await stepTo(t0 + 2139);
    expect(screen.getByTestId('aba-exchange')).toBeTruthy();
    expect(screen.queryByTestId('aba-access-play')).toBeNull();
    await stepTo(t0 + 2140);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    expect(screen.getByTestId('aba-access-ring', HIDDEN)).toBeTruthy();
  });

  it('обмен в конце, calm: в 1000 одна смена кадра — все ячейки пусты и контур 6; доступ в 1500', async () => {
    const before = useChildSession.getState().settings;
    useChildSession.setState({ settings: { ...before, calmMode: true } });
    try {
      const t0 = await endExchangeOfThree();
      await stepTo(t0 + 999);
      expect([filled(), cardStroke('aba-exchange-card')]).toEqual([3, ABA_CONTROL_STROKE]);
      await stepTo(t0 + 1000);
      expect([filled(), empty(), cardStroke('aba-exchange-card')]).toEqual([0, 3, 6]);
      await stepTo(t0 + 1499);
      expect(screen.queryByTestId('aba-access-play')).toBeNull();
      await stepTo(t0 + 1500);
      expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    } finally {
      useChildSession.setState({ settings: before });
    }
  });

  it('жетон цикла сопряжения в конце: въезд 220, звук жетона при посадке, удержание 600, вылет в 820, доступ в 1840', async () => {
    await refuseAfterFirstTrial();
    await waitFor(() => expect(screen.getByTestId('aba-end-wait')).toBeTruthy());
    await stepTo(clock.now() + PAIRING.tokenAfterMs, 500);
    expect(screen.getByTestId('aba-end-pairing')).toBeTruthy();
    const t1 = clock.now();
    voice.stop();
    expect(screen.getByTestId('aba-exchange-token-landing', HIDDEN)).toBeTruthy();
    expect(filled()).toBe(0);
    await stepTo(t1 + 219);
    expect(voice.last).toBeNull();
    await stepTo(t1 + 220);
    expect(filled()).toBe(1);
    expect(voice.last?.key).toBe('abaSession.sound.token');
    await stepTo(t1 + 220 + 599);
    expect(filled()).toBe(1);
    await stepTo(t1 + 220 + 600);
    expect([filled(), empty()]).toEqual([0, 1]);
    await stepTo(t1 + 1839);
    expect(screen.queryByTestId('aba-access-play')).toBeNull();
    await stepTo(t1 + 1840);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    // в цикле похвалы голосом нет (Ц3.3)
    expect(voice.last?.key).toBe('abaSession.sound.token');
  });

  it('доступ в сессии (Ц3.5): кольцо с силуэтом до T, в T исчезает; карточка на кадре конца; следующий шаг через 360 + 1000', async () => {
    const t0 = await trainingExchange();
    // одна ячейка: 600 + 360 + 300 + 360
    const A = t0 + 1620;
    await stepTo(A);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    await stepTo(A + 19_999, 250);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    expect(screen.getByTestId('aba-access-ring', HIDDEN)).toBeTruthy();
    expect(screen.getByTestId('aba-access-ring-silhouette', HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId('aba-access-card')).toBeNull();
    await stepTo(A + 20_000);
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    expect(screen.queryByTestId('aba-access-ring-silhouette', HIDDEN)).toBeNull();
    expect(screen.getByTestId('aba-access-fold')).toBeTruthy();
    expect(screen.getByTestId('aba-access-card')).toBeTruthy();
    await stepTo(A + 20_360);
    expect(screen.getByTestId('aba-access-hold')).toBeTruthy();
    expect(screen.getByTestId('aba-access-card')).toBeTruthy();
    await stepTo(A + 21_359);
    expect(screen.getByTestId('aba-access-hold')).toBeTruthy();
    await stepTo(A + 21_360);
    await waitFor(() => expect(screen.queryByTestId(/^aba-access-/, HIDDEN)).toBeNull());
    expect(screen.queryByTestId('aba-exchange')).toBeNull();
  });

  it('событие access в итоге сессии — время сцены, ровно durationMs (№171): без обмена и кадра конца', async () => {
    const t0 = await trainingExchange();
    const A = t0 + 1620;
    await stepTo(A + 21_360, 250);
    await waitFor(() => expect(screen.queryByTestId(/^aba-access-/, HIDDEN)).toBeNull());
    await waitFor(() => expect(screen.getByTestId('aba-exit')).toBeTruthy());
    await holdExit();
    const events = await accessEvents();
    expect(events).toHaveLength(1);
    expect(events[0].startedAt).toBe(new Date(A).toISOString());
    expect(Date.parse(events[0].endedAt) - Date.parse(events[0].startedAt)).toBe(20_000);
  });

  it('выход удержанием на экране обмена — в итоге нет события access (сцена не началась), обмен есть', async () => {
    await trainingExchange();
    await holdExit();
    const body = await sessionBody();
    expect(body.endReason).toBe('adult_stopped');
    expect(body.events.some((e) => e.kind === 'exchange')).toBe(true);
    expect(body.events.some((e) => e.kind === 'access')).toBe(false);
  });

  it('выход удержанием во время сцены — access от начала сцены до выхода', async () => {
    const t0 = await trainingExchange();
    const A = t0 + 1620;
    await stepTo(A + 5000, 250);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    await holdExit();
    const [e] = await accessEvents();
    expect(e.startedAt).toBe(new Date(A).toISOString());
    expect(e.endedAt).toBe(new Date(A + 6500).toISOString());
  });

  it('выход удержанием, начатый в сцене и законченный на кадре конца, — доступ пишется до T, а не до выхода (№171)', async () => {
    const t0 = await trainingExchange();
    const A = t0 + 1620;
    await stepTo(A + 19_500, 250);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
    await stepTo(A + 20_400);
    expect(screen.getByTestId('aba-access-hold')).toBeTruthy();
    await stepTo(A + 21_000);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/map'));
    expect(await accessEvents()).toEqual([{ kind: 'access', startedAt: new Date(A).toISOString(), endedAt: new Date(A + 20_000).toISOString() }]);
  });

  it('подпись взрослому — только у обучающего перерыва и только со второго приглашения (Ц3.9)', async () => {
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    await tick(1000);
    await fireEvent.press(screen.getByTestId('aba-break-card'));
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    expect(screen.queryByTestId('aba-adult-caption')).toBeNull();
    await tickUntil(() => border() === 6);
    // первое приглашение — подписи ещё нет
    expect(screen.queryByTestId('aba-adult-caption')).toBeNull();
    await tick(RETURN_INVITE_AFTER_MS - 1);
    expect(screen.queryByTestId('aba-adult-caption')).toBeNull();
    await tick(1);
    expect(screen.getByTestId('aba-adult-caption').props.children).toBe(ru.abaBreak.trainingWaitHint);
    // статично до «Вернуться»
    await tick(5 * RETURN_INVITE_AFTER_MS);
    expect(screen.getByTestId('aba-adult-caption').props.children).toBe(ru.abaBreak.trainingWaitHint);
  });

  it('обычный перерыв по карточке — подписи взрослому нет ни на первом, ни на втором приглашении', async () => {
    await breakInTrial();
    expect(screen.queryByTestId('aba-adult-caption')).toBeNull();
    await toSecondInvite();
    expect(iconOutline()).toBe(true);
    expect(screen.queryByTestId('aba-adult-caption')).toBeNull();
  });

  it('тихая пауза после «Отказ» (Ц3.7): контур 6 у карточки всю паузу (15-я и 29-я секунды), подпись в панели — только первые 10 с', async () => {
    await refusalPauseWithFullBoard();
    const from = clock.now();
    expect(cardStroke('aba-break-card')).toBe(6);
    expect(screen.getByTestId('aba-panel-caption').props.children).toBe('Покажите на карточку жестом, не уговаривайте');
    await stepTo(from + 9999, 500);
    expect(screen.getByTestId('aba-panel-caption')).toBeTruthy();
    await stepTo(from + 10_000, 500);
    expect(screen.queryByTestId('aba-panel-caption')).toBeNull();
    expect(cardStroke('aba-break-card')).toBe(6);
    await stepTo(from + 15_000, 500);
    expect([cardStroke('aba-break-card'), screen.queryByTestId('aba-panel-caption')]).toEqual([6, null]);
    await stepTo(from + 29_000, 500);
    expect([cardStroke('aba-break-card'), screen.queryByTestId('aba-panel-caption')]).toEqual([6, null]);
    expect(screen.getByTestId('aba-refusal-pause')).toBeTruthy();
  });
});

describe('«Готово» на экране конца (Ц3.8)', () => {
  const touch = { nativeEvent: { pageX: 0, pageY: 0, identifier: 0 } };
  /** «Сам» без освоенного формата — проб нет, сразу нейтральный «Закончили» (кадр показан сейчас). */
  async function endScreen() {
    useAbaRun.getState().set({ config: 'alone', observers: [], primaryObserverId: null });
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-end-neutral')).toBeTruthy());
  }

  it('«Готово» — детская кнопка с видом обычной кнопки, без disabled', async () => {
    await endScreen();
    const done = screen.getByTestId('aba-end-done');
    expect(done.props.accessibilityRole).toBe('button');
    expect(done.props.accessibilityState?.disabled).toBeFalsy();
  });

  it('тап в первые 1000 мс не уводит на карту', async () => {
    await endScreen();
    await fireEvent.press(screen.getByTestId('aba-end-done'), touch);
    await tick(abaEndDone.lockMs - 1);
    await fireEvent(screen.getByTestId('aba-end-done'), 'pressIn', touch);
    await fireEvent.press(screen.getByTestId('aba-end-done'), touch);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('касание, начатое до 1000 мс и отпущенное после, не засчитывается', async () => {
    await endScreen();
    await tick(500);
    await fireEvent(screen.getByTestId('aba-end-done'), 'pressIn', touch);
    await tick(600);
    await fireEvent.press(screen.getByTestId('aba-end-done'), touch);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('тап с 1000 мс — на карту', async () => {
    await endScreen();
    await tick(abaEndDone.lockMs);
    await fireEvent(screen.getByTestId('aba-end-done'), 'pressIn', touch);
    await fireEvent.press(screen.getByTestId('aba-end-done'), touch);
    expect(router.replace).toHaveBeenCalledWith('/map');
  });
});
