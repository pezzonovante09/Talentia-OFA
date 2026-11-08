/**
 * Рабочая сессия ABA (фаза 6) на ручных часах и `memoryDb`: обучение карточке «перерыв» до первой пробы, выбор
 * подкрепителя тапом, проба `match` — запись до последствия, плашка только с жетоном; карточка в пробе — перерыв;
 * выход удержанием — итог сессии; «Сам» — без обучения карточке и без панели. Фаза 7 (№169): приглашения после
 * перерыва и конец по бездействию, обучающий перерыв без конца, экран обмена, доступ и хвост конца с циклом сопряжения.
 */
import { AccessibilityInfo, AppState, StyleSheet, type AppStateStatus } from 'react-native';

import AbaSessionScreen from '../session';
import { ABA_TARGETS } from '../../../src/content/aba';
import { abaEndDone, abaExchange, abaLayoutByTier, abaPairingLayout, abaTierFor, ABA_CONTROL_STROKE } from '../../../src/design/abaTokens';
import { motion } from '../../../src/design/tokens';
import { initialTargetState } from '../../../src/domain/abaPrompting';
import ru from '../../../src/i18n/locales/ru.json';
import { EXCHANGE_ACCESS_MS, initialTokenTraining, PAIRING } from '../../../src/domain/abaTokenTraining';
import { abaConsentTextVersion, grantAbaProcessing } from '../../../src/services/local/abaConsent';
import { AbaBoardConflictError, AbaConsentRequiredError, AbaPausedError } from '../../../src/services/local/abaLog';
import * as abaResume from '../../../src/services/local/abaResume';
import * as abaStart from '../../../src/services/local/abaStart';
import { finishInProgressSession, loadAbaStart } from '../../../src/services/local/abaStart';
import * as commit from '../../../src/services/local/commit';
import { saveAbaSessionStep, setAbaPaused } from '../../../src/services/local/commit';
import { revokeAbaProcessing } from '../../../src/services/local/purge';
import { childStateUpdatedAt, loadChildState, saveChildState } from '../../../src/services/local/childState';
import { asAbaWriter, memoryDb } from '../../../src/services/local/__tests__/nodeSql';
import type { SqlDb, SqlValue } from '../../../src/services/local/sql';
import { chooseReinforcer, nextStep, startAbaSession, type AbaSessionState } from '../../../src/domain/abaSession';
import { voice } from '../../../src/services/voice';
import { useAbaRun } from '../../../src/state/abaRun';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { act, fireEvent, renderWithProviders, screen, waitFor, within } from '../../../src/test/render';
import { CHILD_BREAK_MS, CHILD_BREAKS_TO_END, REFUSAL_QUIET_MS, RETURN_INVITE_AFTER_MS } from '../../../src/types/aba';
import { AbaClockProvider, manualClock, type ManualClock } from '../../../src/ui/aba/clock';

jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => undefined }));
// Картинки предметов в реестре есть (2026-11-06), в Jest каждый `.svg` — один и тот же `SvgMock` без id стимула.
// Тесту нужно знать, какой предмет на плите (`stimOf` → верный вариант), поэтому каждая картинка — свой View с
// `testID="aba-art-<id>"`; допуск целей (`readyAbaTargets`) при этом остаётся как в продукте — картинка есть.
jest.mock('../../../src/assets/registry', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const actual = jest.requireActual<typeof import('../../../src/assets/registry')>('../../../src/assets/registry');
  const art = Object.fromEntries(
    Object.entries(actual.ABA_OBJECT_ART).map(([id, Art]) => [id, Art == null ? null : (props: Record<string, unknown>) => React.createElement(View, { ...props, testID: `aba-art-${id}` })]),
  );
  return { ...actual, ABA_OBJECT_ART: art };
});
// `expo-crypto` в Jest детерминирован (jest.setup.js): без счётчика вторая проба сессии получает тот же id и
// падает на UNIQUE `aba_trials.id` — тесты с двумя пробами подряд были бы невозможны.
jest.mock('../../../src/services/abaIds', () => {
  let n = 0;
  return {
    newAbaId: () => `00000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`,
    /** Счётчик общий на модуль: `beforeEach` обнуляет его, чтобы id не зависели от упавших ранее тестов. */
    __reset: () => {
      n = 0;
    },
  };
});
const abaIds = jest.requireMock('../../../src/services/abaIds') as { __reset: () => void };
jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
  return {
    __router: router,
    useRouter: () => router,
    useLocalSearchParams: () => ({}),
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
const router = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock; dismissTo: jest.Mock } }).__router;

const KID = '00000000-0000-4000-8000-0000000000a1';
const OBS = '00000000-0000-4000-8000-0000000000b1';
const HIDDEN = { includeHiddenElements: true };
let db: SqlDb;
let clock: ManualClock;
/**
 * Jest не прерывает функцию теста по таймауту: её цикл продолжил бы двигать часы и экран уже следующего теста (каскад
 * падений при таймауте одного — REBUILD.md). Поэтому `afterEach` помечает тест мёртвым, а драйверы шагают только часами своего теста
 * (`my`) и только пока он жив.
 */
let dead = false;
const alive = (my: ManualClock) => !dead && clock === my;
const tick = async (ms: number) => {
  const my = clock;
  if (!alive(my)) return;
  await act(async () => my.advance(ms));
};
/**
 * Дойти до момента `to` шагами не длиннее `step`: ручные часы будят один срок экрана за шаг (следующий ставится после
 * рендера), поэтому шаг короче расстояния между сроками — и каждый кадр приходит ровно в свой срок.
 */
async function stepTo(to: number, step = 20) {
  const my = clock;
  while (alive(my) && my.now() < to) await tick(Math.min(step, to - my.now()));
}
/** Шагать по `step`, пока условие не выполнится (не дольше `max` шагов); цикл останавливается вместе с тестом. */
async function tickUntilWith(pred: () => boolean, step: number, max: number) {
  const my = clock;
  for (let i = 0; i < max && alive(my) && !pred(); i += 1) await tick(step);
  expect(pred()).toBe(true);
}
const count = async (table: string) => (await db.all<{ n: number }>(`SELECT count(*) AS n FROM ${table} WHERE child_id = ?`, [KID]))[0].n;

/**
 * Экран стартует после первого `onLayout` корня (фаза 8: тир фиксируется один раз на сессию); RNTL его не шлёт —
 * хелпер посылает измерение сам. `height` 760 даёт тир `roomy`; `null` — только отрисовать без измерения.
 */
async function layout(height: number, width = 375) {
  await act(async () => {
    fireEvent(screen.getByTestId('aba-session'), 'layout', { nativeEvent: { layout: { height, width, x: 0, y: 0 } } });
  });
}
async function mount(height: number | null = 760) {
  await renderWithProviders(
    <AbaClockProvider clock={clock}>
      <AbaSessionScreen />
    </AbaClockProvider>,
  );
  if (height !== null) await layout(height);
}

/**
 * Внутренняя область кадра доступа: `AccessView` рисует карточку только с измеренным местом, а RNTL `onLayout` не шлёт.
 * Своего testID у области нет, она единственная под корнем кадра с `onLayout`.
 */
async function layoutAccessArea(width = 343, height = 543) {
  const [area] = screen.getByTestId(/^aba-access-(play|settle|fold|hold|done)$/).queryAll((n) => typeof n.props.onLayout === 'function');
  await fireEvent(area, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } });
}

/** id стимула на плите (картинка предмета из реестра, заглушка разработчика или фигура). */
const stimOf = (testID: string) => {
  const n = within(screen.getByTestId(testID)).queryAllByTestId(/^aba-(art|stub|stim)-/)[0];
  return String(n?.props.testID ?? '').replace(/^aba-(art|stub|stim)-/, '');
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
  dead = false;
  abaIds.__reset();
  router.replace.mockClear();
  router.dismissTo.mockClear();
  clock = manualClock();
  db = await memoryDb();
  await grantAbaProcessing(db, { childId: KID, accountId: 'acc', lang: 'ru', at: new Date(clock.now() - 60_000).toISOString(), randomBytes: (n) => new Uint8Array(n).fill(7) });
  await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 1 }, new Date(clock.now()).toISOString()));
  useAccount.setState({ db, accountId: 'acc', status: 'ready' });
  useChildSession.setState({ childId: KID, mode: 'account', openedForAba: false });
  useAbaRun.getState().set({ config: 'with_adult', observers: [{ id: OBS, role: 'parent', trained: false }], primaryObserverId: OBS });
});

afterEach(() => {
  dead = true;
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

it('обучение, верно на стартовом уровне, доска не заполнилась — плашка с жетоном: жетон ложится в 340, плашка уходит в 4000, следующий SD в 5000', async () => {
  // ступень 2: первый жетон доску из двух не заполняет — последствие по Ц2.6; доску, заполненную жетоном пробы, — блок
  // «цикл 4» ниже (смена кадра на обмен в посадка + 700, №172)
  await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 2 }, new Date(clock.now()).toISOString()));
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
  const M = clock.now();
  expect(screen.queryAllByTestId('aba-overlay-token-filled', HIDDEN)).toHaveLength(0);
  // срок «плашка» — в момент записи: ручные часы проходят его отдельным шагом
  await tick(0);
  await stepTo(M + 339);
  expect(screen.queryAllByTestId('aba-overlay-token-filled', HIDDEN)).toHaveLength(0);
  await stepTo(M + 340);
  expect(screen.queryAllByTestId('aba-overlay-token-filled', HIDDEN)).toHaveLength(1);
  expect(screen.queryAllByTestId('aba-overlay-token-empty', HIDDEN)).toHaveLength(1);
  await stepTo(M + 3999, 100);
  expect(screen.getByTestId('aba-reinforcement')).toBeTruthy();
  await stepTo(M + 4000);
  expect(screen.queryByTestId('aba-reinforcement')).toBeNull();
  // полоса: жетон на месте, вторая ячейка пустая; обмена нет — доска не полна
  expect(screen.queryAllByTestId('aba-strip-token-filled', HIDDEN)).toHaveLength(1);
  expect(screen.queryAllByTestId('aba-strip-token-empty', HIDDEN)).toHaveLength(1);
  await stepTo(M + 4999, 100);
  expect(screen.queryByTestId('aba-instruction')).toBeNull();
  await stepTo(M + 5000);
  await waitFor(() => expect(screen.getByTestId('aba-instruction')).toBeTruthy());
  expect(screen.queryByTestId('aba-exchange')).toBeNull();
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
  await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
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
  // корня `aba-session` нет — редирект без измерения окна
  await mount(null);
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
  const tickUntil = (pred: () => boolean, step = 1000, max = 300) => tickUntilWith(pred, step, max);
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
    expect(router.dismissTo).toHaveBeenCalledWith('/map');
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
    // кнопки «Получить!» нет: требования к ребёнку в конце нет — на экране обмена ни одной кнопки; выход удержанием —
    // один на экран сессии, вне кадра обмена (Ц4, огр. 9)
    expect(within(screen.getByTestId('aba-exchange')).queryAllByRole('button')).toEqual([]);
    expect(screen.getAllByTestId('aba-exit')).toHaveLength(1);
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
  /**
   * Обучение доске (одна ячейка), верно на L0 — жетон пробы заполнил доску: смена кадра на обмен в посадка + 700
   * (№172); `t0` — показ кадра обмена.
   */
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
    const markedAt = clock.now();
    await tick(0);
    await stepTo(markedAt + 340 + 700);
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    expect(clock.now()).toBe(markedAt + 1040);
    return clock.now();
  }
  /** Доступ после обмена с полной доски, одна ячейка: удержание 1000 (№173) + полёт 360 + «получено» 300 + раскрытие 360. */
  const FULL_BOARD_ONE_CELL_TO_ACCESS = 1000 + 360 + 300 + 360;
  async function holdExit() {
    await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
    await tick(1500);
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
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
      await act(async () => useChildSession.setState({ settings: before }));
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
    // одна ячейка, обмен с полной доски: 1000 (№173) + 360 + 300 + 360
    const A = t0 + FULL_BOARD_ONE_CELL_TO_ACCESS;
    await stepTo(A);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    await layoutAccessArea();
    await stepTo(A + 19_999, 250);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    expect(screen.getByTestId('aba-access-ring', HIDDEN)).toBeTruthy();
    expect(screen.getByTestId('aba-access-ring-silhouette', HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId('aba-access-card')).toBeNull();
    await stepTo(A + 20_000);
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    expect(screen.queryByTestId('aba-access-ring-silhouette', HIDDEN)).toBeNull();
    // сворачивание: кадр стадии `fold` и рамка с тем же testID; карточка встаёт в конце сворачивания
    expect(screen.getAllByTestId('aba-access-fold')).toHaveLength(2);
    expect(screen.queryByTestId('aba-access-card')).toBeNull();
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
    const A = t0 + FULL_BOARD_ONE_CELL_TO_ACCESS;
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
    const A = t0 + FULL_BOARD_ONE_CELL_TO_ACCESS;
    await stepTo(A + 5000, 250);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    await holdExit();
    const [e] = await accessEvents();
    expect(e.startedAt).toBe(new Date(A).toISOString());
    expect(e.endedAt).toBe(new Date(A + 6500).toISOString());
  });

  it('выход удержанием, начатый в сцене и законченный на кадре конца, — доступ пишется до T, а не до выхода (№171)', async () => {
    const t0 = await trainingExchange();
    const A = t0 + FULL_BOARD_ONE_CELL_TO_ACCESS;
    await stepTo(A + 19_500, 250);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
    await stepTo(A + 20_400);
    expect(screen.getByTestId('aba-access-hold')).toBeTruthy();
    await stepTo(A + 21_000);
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
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

/**
 * Цикл 4 (№172–173, итог проверок — огр. 1–3 и 9): доску на ступенях 1–2 заполнил жетон пробы — смена кадра на обмен в
 * посадка + 700 (calm 820), полная доска 1000; заполнил жетон за участие — обычное последствие, падение 140 со звуком,
 * обмен через 700 после посадки. Палец на карточке «перерыв» или «Отказ» откладывает смену до отпускания + 300, не
 * дальше посадка + 920; лежит в потолке — засчитан. Выход удержанием один на экран.
 */
describe('цикл 4 (№172–173): плашка → обмен', () => {
  /** От кадра обмена с полной доски до доступа, одна ячейка: 1000 (№173) + полёт 360 + «получено» 300 + раскрытие 360. */
  const FULL_ONE_CELL = 1000 + 360 + 300 + 360;
  /** Касание одним пальцем: у детской цели событие есть всегда (`ChildPressable` читает `pageX/pageY/identifier`). */
  const TOUCH = { nativeEvent: { pageX: 0, pageY: 0, identifier: 0 } };
  const exFilled =() => screen.queryAllByTestId('aba-exchange-token-filled', HIDDEN).length;
  const exEmpty = () => screen.queryAllByTestId('aba-exchange-token-empty', HIDDEN).length;
  const stripFilled = () => screen.queryAllByTestId('aba-strip-token-filled', HIDDEN).length;
  const stripDropping = () => screen.queryAllByTestId('aba-strip-token-dropping', HIDDEN).length;
  const cardStroke = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style).borderWidth as number;
  /** Проба идёт: у панели взрослого есть «Была подсказка» (на последствии и участии — только «Отказ»). */
  const inTrial = () => screen.queryByTestId('aba-panel-adult_prompted') !== null;
  const overlay = () => screen.queryByTestId('aba-reinforcement') !== null;
  const exchange = () => screen.queryByTestId('aba-exchange') !== null;
  const trace = () => screen.queryByTestId('aba-break-trace') !== null;
  type Host = { type: string; children: (Host | string)[] };
  const hasType = (n: Host | string, type: string): boolean => typeof n !== 'string' && (n.type === type || n.children.some((c) => hasType(c, type)));
  /** Кольцо удержания выхода (`ExitHold`: круг поверх стрелки, с 300 мс удержания). */
  const exitRing = () => hasType(screen.getByTestId('aba-exit') as unknown as Host, 'RNSVGCircle');
  const snapshot = async () => (await loadChildState(db, KID, 'abaSessionInProgress')) as unknown as AbaSessionState;
  const childCardEvents = (s: AbaSessionState) => s.events.filter((e) => e.kind === 'assent' && e.by === 'child_card');
  const tickUntil = (pred: () => boolean, step = 250, max = 400) => tickUntilWith(pred, step, max);

  async function prepare(stage: 1 | 2 | 3) {
    const two = ABA_TARGETS.find((x) => x.id === 'match-same-2')!;
    const states = { [two.id]: { ...initialTargetState(two), phase: 'acquisition' as const, startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const } };
    const at = new Date(clock.now()).toISOString();
    await asAbaWriter(db, KID, async (tx) => {
      await saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage }, at);
      await saveChildState(tx, KID, 'abaTargets', states, at);
    });
  }
  async function toFirstTrial() {
    await mount();
    await skipCardTraining();
    await chooseFirst();
    await waitFor(() => expect(inTrial()).toBe(true));
  }
  /** Верно на старте; возвращает `markedAt` — часы стоят, пока проба пишется. */
  async function answerRight(): Promise<number> {
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await fireEvent.press(screen.getByTestId(correctOption()));
    await waitFor(() => expect(inTrial()).toBe(false));
    return clock.now();
  }
  /** «Была подсказка», затем верно — `prompted`: похвала голосом, без жетона и без плашки. */
  async function answerPrompted() {
    await fireEvent.press(screen.getByTestId('aba-panel-adult_prompted'));
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await fireEvent.press(screen.getByTestId(correctOption()));
    await waitFor(() => expect(inTrial()).toBe(false));
  }
  /** Четыре пробы блока с подсказкой (без жетона); на экране — пятая, последняя проба блока. */
  async function toLastTrialOfBlock() {
    for (let i = 0; i < 4; i += 1) {
      await answerPrompted();
      await tickUntil(inTrial);
    }
    const rows = await db.all<{ body: string }>('SELECT body FROM aba_trials WHERE child_id = ? ORDER BY rowid', [KID]);
    expect(rows.map((r) => JSON.parse(r.body) as { response: string; tokens: number }).map((b) => [b.response, b.tokens])).toEqual(Array(4).fill(['prompted', 0]));
  }
  /** База с задержкой записи: пока `close()` не снят `open()`, запросы экрана ждут (тест держит запись «в полёте»). */
  function gatedDb() {
    let gate: Promise<void> | null = null;
    let release = () => undefined as void;
    const inner = db;
    const wait = async () => {
      if (gate) await gate;
    };
    const gated: SqlDb = {
      async run(sql: string, params?: readonly SqlValue[]) {
        await wait();
        return inner.run(sql, params);
      },
      async all<T>(sql: string, params?: readonly SqlValue[]) {
        await wait();
        return inner.all<T>(sql, params);
      },
      async exec(sql: string) {
        await wait();
        return inner.exec(sql);
      },
      async transaction<T>(fn: (tx: SqlDb) => Promise<T>) {
        await wait();
        return inner.transaction(fn);
      },
    };
    useAccount.setState({ db: gated });
    return {
      close() {
        gate = new Promise<void>((r) => {
          release = r;
        });
      },
      async open() {
        gate = null;
        await act(async () => release());
      },
    };
  }

  describe('путь пробы: доску заполнил жетон этой пробы (ступень 1)', () => {
    it('плашка с падением жетона до посадка + 700, одна смена кадра на обмен в 1040, полная доска 1000, доступ в 3060', async () => {
      await prepare(1);
      await toFirstTrial();
      const M = await answerRight();
      expect(overlay()).toBe(true);
      await tick(0);
      // жетон падает 120 → 340 (Ц4.0 п. 1), звук — при посадке, похвала — в 700
      await stepTo(M + 200);
      expect(screen.queryAllByTestId('aba-overlay-token-dropping', HIDDEN)).toHaveLength(1);
      await stepTo(M + 340);
      expect(screen.queryAllByTestId('aba-overlay-token-filled', HIDDEN)).toHaveLength(1);
      expect(voice.last?.key).toBe('abaSession.sound.token');
      await stepTo(M + 700);
      expect(voice.last?.key).toBe('abaSession.sound.praise');
      // до смены кадра в каждом кадре плашка: ни пустых плит, ни полосы, ни следующего SD
      for (let at = M + 720; at < M + 1040; at += 20) {
        await stepTo(at);
        expect([overlay(), exchange()]).toEqual([true, false]);
      }
      await stepTo(M + 1039);
      expect([overlay(), exchange()]).toEqual([true, false]);
      await stepTo(M + 1040);
      // одна смена кадра: плашка ушла, обмен пришёл в том же кадре, доска полная
      expect([overlay(), exchange()]).toEqual([false, true]);
      expect(screen.queryByTestId('aba-sample')).toBeNull();
      expect([exFilled(), exEmpty()]).toEqual([1, 0]);
      // удержание 1000 при одной ячейке (№173), а не 600 (№171)
      await stepTo(M + 1040 + 999);
      expect([exFilled(), exEmpty()]).toEqual([1, 0]);
      await stepTo(M + 1040 + 1000);
      expect([exFilled(), exEmpty()]).toEqual([0, 1]);
      await stepTo(M + 3059);
      expect(screen.queryByTestId('aba-access-play')).toBeNull();
      await stepTo(M + 3060);
      expect(screen.getByTestId('aba-access-play')).toBeTruthy();
      // в журнале — обмен сразу, перерыва и просьбы нет
      expect(childCardEvents(await snapshot())).toEqual([]);
    });

    it.each(['calm', 'reduce_motion'] as const)('%s: жетон появляется в 120 без падения, обмен в 820, полная доска 1000, в 1820 одна смена кадра, доступ в 2320', async (mode) => {
      const before = useChildSession.getState().settings;
      // в jest-окружении RN это уже мок (`Promise<false>`): spyOn вернул бы его же, а mockRestore стёр бы реализацию
      const reduce = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;
      reduce.mockImplementation(() => Promise.resolve(mode === 'reduce_motion'));
      if (mode === 'calm') useChildSession.setState({ settings: { ...before, calmMode: true } });
      try {
        await prepare(1);
        await toFirstTrial();
        const M = await answerRight();
        await tick(0);
        expect(screen.queryAllByTestId('aba-overlay-token-dropping', HIDDEN)).toHaveLength(0);
        await stepTo(M + 119);
        expect(screen.queryAllByTestId('aba-overlay-token-filled', HIDDEN)).toHaveLength(0);
        await stepTo(M + 120);
        expect(screen.queryAllByTestId('aba-overlay-token-filled', HIDDEN)).toHaveLength(1);
        expect(screen.queryAllByTestId('aba-overlay-token-dropping', HIDDEN)).toHaveLength(0);
        await stepTo(M + 500);
        expect(voice.last?.key).toBe('abaSession.sound.praise');
        await stepTo(M + 819);
        expect([overlay(), exchange()]).toEqual([true, false]);
        await stepTo(M + 820);
        expect([overlay(), exchange()]).toEqual([false, true]);
        await stepTo(M + 1819);
        expect([exFilled(), cardStroke('aba-exchange-card')]).toEqual([1, ABA_CONTROL_STROKE]);
        await stepTo(M + 1820);
        expect([exFilled(), exEmpty(), cardStroke('aba-exchange-card')]).toEqual([0, 1, 6]);
        await stepTo(M + 2319);
        expect(screen.queryByTestId('aba-access-play')).toBeNull();
        await stepTo(M + 2320);
        expect(screen.getByTestId('aba-access-play')).toBeTruthy();
      } finally {
        reduce.mockImplementation(() => Promise.resolve(false));
        await act(async () => useChildSession.setState({ settings: before }));
      }
    });
  });

  describe('путь участия (ступень 2: первый жетон — за ответ, второй — за участие)', () => {
    it('доску заполнил жетон за участие: последствие 5 с, падение 140 со звуком token один раз, обмен через 700 после посадки, удержание 1000', async () => {
      await prepare(2);
      await toFirstTrial();
      await toLastTrialOfBlock();
      const say = jest.spyOn(voice, 'say');
      const tokenSounds = () => say.mock.calls.filter(([k]) => k === 'abaSession.sound.token').length;
      try {
        const M = await answerRight();
        await tick(0);
        await stepTo(M + 340);
        expect(tokenSounds()).toBe(1);
        // жетон пробы доску не заполнил: путь пробы не включается — в 1040 смены кадра нет (огр. 2)
        await stepTo(M + 1040);
        expect([overlay(), exchange()]).toEqual([true, false]);
        await stepTo(M + 3999, 100);
        expect(overlay()).toBe(true);
        await stepTo(M + 4000);
        expect(overlay()).toBe(false);
        expect(stripFilled()).toBe(1);
        await stepTo(M + 4999, 100);
        expect([stripDropping(), exchange()]).toEqual([0, false]);
        // 5000: жетон за участие падает в последнюю ячейку полосы 140 мс
        await stepTo(M + 5000);
        expect([stripFilled(), stripDropping()]).toEqual([1, 1]);
        await stepTo(M + 5139);
        expect(tokenSounds()).toBe(1);
        await stepTo(M + 5140);
        expect(tokenSounds()).toBe(2);
        expect([stripFilled(), stripDropping()]).toEqual([2, 0]);
        // полная полоса 700, затем одна смена кадра на обмен
        await stepTo(M + 5839);
        expect([stripFilled(), exchange()]).toEqual([2, false]);
        await stepTo(M + 5840);
        expect(exchange()).toBe(true);
        expect([exFilled(), exEmpty()]).toEqual([2, 0]);
        await stepTo(M + 5840 + 999);
        expect([exFilled(), exEmpty()]).toEqual([2, 0]);
        await stepTo(M + 5840 + 1000);
        expect([exFilled(), exEmpty()]).toEqual([1, 1]);
        // две ячейки: 1000 + 60 + 360 + 300 + 360
        await stepTo(M + 5840 + 2079);
        expect(screen.queryByTestId('aba-access-play')).toBeNull();
        await stepTo(M + 5840 + 2080);
        expect(screen.getByTestId('aba-access-play')).toBeTruthy();
        // звук жетона за участие — ровно один, похвалы за участие нет
        expect(tokenSounds()).toBe(2);
        expect(say.mock.calls.filter(([k]) => k === 'abaSession.sound.praise')).toHaveLength(1);
      } finally {
        say.mockRestore();
      }
    });

    it('таймер проснулся позже посадки: звук token жетона за участие не пропущен и звучит один раз', async () => {
      await prepare(2);
      await toFirstTrial();
      await toLastTrialOfBlock();
      const say = jest.spyOn(voice, 'say');
      const tokenSounds = () => say.mock.calls.filter(([k]) => k === 'abaSession.sound.token').length;
      try {
        const M = await answerRight();
        await tick(0);
        await stepTo(M + 4999, 100);
        expect(tokenSounds()).toBe(1);
        // один шаг часов через начало участия (5000) и мимо посадки (5140): кадр участия рисуется уже после неё
        await tick(600);
        await tick(1);
        expect(tokenSounds()).toBe(2);
        expect(stripFilled()).toBe(2);
        await tickUntil(exchange, 100);
        expect(tokenSounds()).toBe(2);
      } finally {
        say.mockRestore();
      }
    });

    it('жетон за участие, не заполнивший доску (ступень 3): полоса стоит 1000 после посадки, обмена нет', async () => {
      await prepare(3);
      await toFirstTrial();
      await toLastTrialOfBlock();
      const M = await answerRight();
      await tick(0);
      await stepTo(M + 5000);
      expect(stripDropping()).toBe(1);
      await stepTo(M + 5140);
      expect([stripFilled(), stripDropping()]).toEqual([2, 0]);
      const frame = JSON.stringify(screen.toJSON());
      // 700 — срок только для заполнившего доску: здесь кадр стоит до посадки + 1000
      await stepTo(M + 5840);
      await stepTo(M + 6139);
      expect(JSON.stringify(screen.toJSON())).toBe(frame);
      await stepTo(M + 6140);
      await waitFor(() => expect(JSON.stringify(screen.toJSON())).not.toBe(frame));
      expect(exchange()).toBe(false);
    });
  });

  describe('палец на карточке «перерыв» или «Отказ» в момент смены кадра (огр. 1)', () => {
    it('палец лежит в плановый момент — кадр ждёт; засчитанное отпускание после него — смена в потолке посадка + 920, а не через 300', async () => {
      await prepare(1);
      await toFirstTrial();
      const M = await answerRight();
      await tick(0);
      await stepTo(M + 500);
      await fireEvent(screen.getByTestId('aba-break-card'), 'pressIn', TOUCH);
      await stepTo(M + 1040);
      expect([overlay(), exchange()]).toEqual([true, false]);
      await stepTo(M + 1100);
      // отпустили внутри карточки: на устройстве pressOut, затем press — касание засчитано, контур 6 «принято»
      await fireEvent(screen.getByTestId('aba-break-card'), 'pressOut', TOUCH);
      await fireEvent.press(screen.getByTestId('aba-break-card'), TOUCH);
      expect(cardStroke('aba-break-card')).toBe(6);
      // max(1040, отпускание + 300 = 1400) — дальше потолка 340 + 920 = 1260
      await stepTo(M + 1259);
      expect([overlay(), exchange()]).toEqual([true, false]);
      await stepTo(M + 1260);
      await waitFor(() => expect(exchange()).toBe(true));
      expect(overlay()).toBe(false);
      expect(trace()).toBe(true);
      expect(childCardEvents(await snapshot())).toHaveLength(1);
    });

    it('засчитанное касание, отпущенное меньше чем за 300 мс до плановой смены, её отодвигает: смена в отпускание + 300, контур 6 «принято»', async () => {
      await prepare(1);
      await toFirstTrial();
      const M = await answerRight();
      await tick(0);
      await stepTo(M + 800);
      await fireEvent(screen.getByTestId('aba-break-card'), 'pressIn', TOUCH);
      await stepTo(M + 900);
      await fireEvent(screen.getByTestId('aba-break-card'), 'pressOut', TOUCH);
      await fireEvent.press(screen.getByTestId('aba-break-card'), TOUCH);
      expect(cardStroke('aba-break-card')).toBe(6);
      await stepTo(M + 1040);
      expect([overlay(), exchange()]).toEqual([true, false]);
      expect(cardStroke('aba-break-card')).toBe(6);
      await stepTo(M + 1199);
      expect([overlay(), exchange()]).toEqual([true, false]);
      await stepTo(M + 1200);
      await waitFor(() => expect(exchange()).toBe(true));
      // просьба принята: след на обмене, перерыв — после доступа
      expect(trace()).toBe(true);
      expect((await snapshot()).queue.slice(0, 2).map((q) => q.kind)).toEqual(['access', 'break']);
    });

    it('новое касание, пока кадр уже ждёт отклика прежнего, переносит ожидание на потолок; просьба не дублируется', async () => {
      await prepare(1);
      await toFirstTrial();
      const M = await answerRight();
      await tick(0);
      await stepTo(M + 800);
      await fireEvent(screen.getByTestId('aba-break-card'), 'pressIn', TOUCH);
      await stepTo(M + 900);
      await fireEvent(screen.getByTestId('aba-break-card'), 'pressOut', TOUCH);
      await fireEvent.press(screen.getByTestId('aba-break-card'), TOUCH);
      // в 1040 кадр ждёт до 1200 (отклик засчитанного касания); в 1100 палец ложится снова и лежит
      await stepTo(M + 1100);
      await fireEvent(screen.getByTestId('aba-break-card'), 'pressIn', TOUCH);
      // срок прежнего отклика прошёл, а смены кадра под лежащим пальцем нет
      await stepTo(M + 1200);
      expect([overlay(), exchange()]).toEqual([true, false]);
      await stepTo(M + 1259);
      expect([overlay(), exchange()]).toEqual([true, false]);
      expect(childCardEvents(await snapshot())).toHaveLength(1);
      await stepTo(M + 1260);
      await waitFor(() => expect(exchange()).toBe(true));
      // засчёт в потолке второй просьбы не добавляет: перерыв в очереди один
      const s = await snapshot();
      expect(childCardEvents(s)).toHaveLength(1);
      expect(s.queue.filter((q) => q.kind === 'break')).toHaveLength(1);
      expect(trace()).toBe(true);
    });

    it('палец лежит и в потолке — просьба засчитана: событие child_card, очередь [access, break], след на обмене и доступе, на перерыве — нет', async () => {
      await prepare(1);
      await toFirstTrial();
      const M = await answerRight();
      await tick(0);
      await stepTo(M + 500);
      await fireEvent(screen.getByTestId('aba-break-card'), 'pressIn', TOUCH);
      await stepTo(M + 1259);
      expect([overlay(), exchange()]).toEqual([true, false]);
      expect(childCardEvents(await snapshot())).toEqual([]);
      await stepTo(M + 1260);
      await waitFor(() => expect(exchange()).toBe(true));
      const s = await snapshot();
      expect(childCardEvents(s)).toEqual([expect.objectContaining({ kind: 'assent', by: 'child_card', action: 'break' })]);
      expect(s.queue.slice(0, 2).map((q) => q.kind)).toEqual(['access', 'break']);
      // след — принятая карточка поверх строки 72: на обмене, с ролью image и состоянием «выбрано»
      expect(trace()).toBe(true);
      const card = within(screen.getByTestId('aba-break-trace')).getByRole('image');
      expect(card.props.accessibilityState).toEqual({ selected: true });
      // удержание полной доски 1000 и здесь
      const t0 = clock.now();
      await stepTo(t0 + 999);
      expect(exFilled()).toBe(1);
      await stepTo(t0 + FULL_ONE_CELL);
      expect(screen.getByTestId('aba-access-play')).toBeTruthy();
      expect(trace()).toBe(true);
      // доступ кончился — экран перерыва: просьба исполнена, следа нет
      await tickUntil(() => screen.queryByTestId('aba-break') !== null);
      expect(trace()).toBe(false);
    });

    it('касание, начатое до показа плашки, смену кадра не держит и в потолке не засчитывается', async () => {
      await prepare(1);
      await toFirstTrial();
      // палец лёг на карточку ещё в пробе и не снят
      await fireEvent(screen.getByTestId('aba-break-card'), 'pressIn', TOUCH);
      await tick(100);
      const M = await answerRight();
      await tick(0);
      await stepTo(M + 1040);
      expect([overlay(), exchange()]).toEqual([false, true]);
      await stepTo(M + 1400);
      expect(trace()).toBe(false);
      expect(childCardEvents(await snapshot())).toEqual([]);
    });

    it.each(['снят на следующей пробе', 'не снят'] as const)(
      'палец, лёгший на последствии обычной пробы (%s), не залипает: на следующей полной доске смена кадра в срок и ничего не записано',
      async (how) => {
        await prepare(2);
        await toFirstTrial();
        // первая проба: жетон доску из двух не заполнил — обычное последствие; палец ложится на карточку
        const M1 = await answerRight();
        await tick(0);
        await stepTo(M1 + 1000);
        await fireEvent(screen.getByTestId('aba-break-card'), 'pressIn', TOUCH);
        await tickUntil(inTrial, 100);
        if (how === 'снят на следующей пробе') await fireEvent(screen.getByTestId('aba-break-card'), 'pressOut', TOUCH);
        // вторая проба заполняет доску — путь Ц4
        await tick(500);
        const M2 = await answerRight();
        await tick(0);
        await stepTo(M2 + 1039);
        expect([overlay(), exchange()]).toEqual([true, false]);
        await stepTo(M2 + 1040);
        expect([overlay(), exchange()]).toEqual([false, true]);
        await stepTo(M2 + 1400);
        expect(trace()).toBe(false);
        const s = await snapshot();
        expect(childCardEvents(s)).toEqual([]);
        expect(s.queue.some((q) => q.kind === 'break')).toBe(false);
      },
    );

    it('«Отказ» на плашке пути Ц4 засчитан: дальше обмен (удержание 1000), доступ и нейтральный конец', async () => {
      await prepare(1);
      await toFirstTrial();
      const M = await answerRight();
      await tick(0);
      await stepTo(M + 500);
      await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
      await waitFor(() => expect(exchange()).toBe(true));
      const t0 = clock.now();
      expect(exFilled()).toBe(1);
      await stepTo(t0 + 999);
      expect(exFilled()).toBe(1);
      await stepTo(t0 + 1000);
      expect([exFilled(), exEmpty()]).toEqual([0, 1]);
      await stepTo(t0 + FULL_ONE_CELL);
      expect(screen.getByTestId('aba-access-play')).toBeTruthy();
      await tickUntil(() => screen.queryByTestId('aba-end-neutral') !== null);
      const [row] = await db.all<{ body: string }>('SELECT body FROM aba_sessions WHERE child_id = ?', [KID]);
      expect(JSON.parse(row.body)).toMatchObject({ endReason: 'assent_withdrawn' });
    });

    it('палец на «Отказ» лежит и в потолке — отказ засчитан в потолке: обмен с удержанием 1000, затем доступ', async () => {
      await prepare(1);
      await toFirstTrial();
      const M = await answerRight();
      await tick(0);
      await stepTo(M + 500);
      await fireEvent(screen.getByTestId('aba-panel-refusal'), 'pressIn');
      await stepTo(M + 1259);
      expect([overlay(), exchange()]).toEqual([true, false]);
      await stepTo(M + 1260);
      await waitFor(() => expect(exchange()).toBe(true));
      const t0 = clock.now();
      await stepTo(t0 + 999);
      expect(exFilled()).toBe(1);
      await stepTo(t0 + 1000);
      expect(exFilled()).toBe(0);
      await stepTo(t0 + FULL_ONE_CELL);
      expect(screen.getByTestId('aba-access-play')).toBeTruthy();
      expect((await snapshot()).endReason).toBe('assent_withdrawn');
    });
  });

  it('гонка: просьба о перерыве на плашке, запись которой ещё идёт в момент смены кадра, не теряется и не затирает состояние', async () => {
    await prepare(1);
    const g = gatedDb();
    await toFirstTrial();
    const M = await answerRight();
    await tick(0);
    await stepTo(M + 1000);
    // запись просьбы задерживается — смена кадра в 1040 наступает, пока она идёт
    g.close();
    await fireEvent.press(screen.getByTestId('aba-break-card'), TOUCH);
    await stepTo(M + 1040);
    // кадр замер (busy): плашка стоит, обмена без записи нет
    expect([overlay(), exchange()]).toEqual([true, false]);
    await stepTo(M + 1100);
    expect(exchange()).toBe(false);
    await g.open();
    await waitFor(() => expect(exchange()).toBe(true));
    expect(trace()).toBe(true);
    const s = await snapshot();
    expect(childCardEvents(s)).toHaveLength(1);
    expect(s.queue.slice(0, 2).map((q) => q.kind)).toEqual(['access', 'break']);
    // доступ прошёл — дальше перерыв по просьбе; время доступа ушло в паузу, а не в рабочее время
    await tickUntil(() => screen.queryByTestId('aba-break') !== null);
    const after = await snapshot();
    expect(after.events.filter((e) => e.kind === 'access')).toHaveLength(1);
    expect(after.accessStartedAt).toBeNull();
    expect(after.pausedMs).toBeGreaterThanOrEqual(20_000);
  });

  it('след просьбы виден и в busy после конца доступа, пока пишется шаг; на экране перерыва его нет', async () => {
    await prepare(1);
    const g = gatedDb();
    await toFirstTrial();
    const M = await answerRight();
    await tick(0);
    await stepTo(M + 500);
    await fireEvent.press(screen.getByTestId('aba-break-card'), TOUCH);
    await stepTo(M + 1040);
    await waitFor(() => expect(exchange()).toBe(true));
    expect(trace()).toBe(true);
    const A = clock.now() + FULL_ONE_CELL;
    await stepTo(A, 250);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    // сцена 20 с, сворачивание 360 и кадр конца 1000 — запись конца доступа задерживается
    await stepTo(A + 21_000, 250);
    g.close();
    await stepTo(A + 21_360 + 100);
    expect(screen.queryByTestId('aba-break')).toBeNull();
    expect(trace()).toBe(true);
    await g.open();
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    expect(trace()).toBe(false);
  });

  describe('один выход на экран (огр. 9)', () => {
    it('удержание, начатое на плашке, срабатывает через 1500 от касания после смены кадра на обмен; кольцо не начинается заново', async () => {
      await prepare(1);
      await toFirstTrial();
      const M = await answerRight();
      await tick(0);
      await stepTo(M + 500);
      await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
      await stepTo(M + 800);
      expect(exitRing()).toBe(true);
      await stepTo(M + 1040);
      expect(exchange()).toBe(true);
      expect(screen.getAllByTestId('aba-exit')).toHaveLength(1);
      expect(exitRing()).toBe(true);
      await stepTo(M + 1999);
      expect(router.dismissTo).not.toHaveBeenCalled();
      await stepTo(M + 2000);
      await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
      expect(await count('aba_sessions')).toBe(1);
    });

    it('в busy (идёт запись) выход живой: удержание доводит до выхода', async () => {
      await prepare(1);
      const g = gatedDb();
      await toFirstTrial();
      const M = await answerRight();
      await tick(0);
      await stepTo(M + 1000);
      g.close();
      await fireEvent.press(screen.getByTestId('aba-break-card'), TOUCH);
      await stepTo(M + 1040);
      expect(exchange()).toBe(false);
      await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
      await stepTo(M + 1040 + 1500);
      await g.open();
      await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
    });

    it('на загрузке выход есть: старт завис — удержание уводит на карту', async () => {
      const g = gatedDb();
      g.close();
      await mount();
      expect(screen.getAllByTestId('aba-exit')).toHaveLength(1);
      await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
      await tick(1500);
      expect(router.dismissTo).toHaveBeenCalledWith('/map');
      await g.open();
    });

    it('на экране «Закончили» выхода нет', async () => {
      useAbaRun.getState().set({ config: 'alone', observers: [], primaryObserverId: null });
      await mount();
      await waitFor(() => expect(screen.getByTestId('aba-end-neutral')).toBeTruthy());
      expect(screen.queryByTestId('aba-exit')).toBeNull();
    });
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
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('касание, начатое до 1000 мс и отпущенное после, не засчитывается', async () => {
    await endScreen();
    await tick(500);
    await fireEvent(screen.getByTestId('aba-end-done'), 'pressIn', touch);
    await tick(600);
    await fireEvent.press(screen.getByTestId('aba-end-done'), touch);
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('тап с 1000 мс — на карту', async () => {
    await endScreen();
    await tick(abaEndDone.lockMs);
    await fireEvent(screen.getByTestId('aba-end-done'), 'pressIn', touch);
    await fireEvent.press(screen.getByTestId('aba-end-done'), touch);
    expect(router.dismissTo).toHaveBeenCalledWith('/map');
  });
});

/**
 * Фаза 8: сворачивание и возобновление (`useAbaBackground`, `loadAbaResume`, `model/sessionResume.ts`). `AppState`
 * подменяется (не `spyOn`: `mockRestore` у мока RN снял бы реализацию), события `background` / `active` — внутри `act`.
 * Снимки для холодного старта готовятся настоящими сервисами на часах теста: `updated_at` снимка — момент ухода.
 */
describe('фаза 8: сворачивание и возобновление', () => {
  let handlers: ((s: AppStateStatus) => void)[] = [];
  let originalAdd: typeof AppState.addEventListener;
  /** Подмены на время теста: снимаются и после падения, иначе закрытая запись или шпион останутся следующему тесту. */
  let undo: (() => void)[] = [];
  beforeEach(() => {
    handlers = [];
    undo = [];
    originalAdd = AppState.addEventListener;
    AppState.addEventListener = ((_t: string, fn: (s: AppStateStatus) => void) => {
      handlers.push(fn);
      return {
        remove: () => {
          handlers = handlers.filter((h) => h !== fn);
        },
      };
    }) as typeof AppState.addEventListener;
  });
  afterEach(() => {
    AppState.addEventListener = originalAdd;
    undo.forEach((u) => u());
  });
  const background = () => act(async () => handlers.forEach((h) => h('background')));
  const foreground = () => act(async () => handlers.forEach((h) => h('active')));
  const iso = (ms: number) => new Date(ms).toISOString();
  const snapshot = async () => (await loadChildState(db, KID, 'abaSessionInProgress')) as AbaSessionState | null | undefined;
  const snapshotAt = () => childStateUpdatedAt(db, KID, 'abaSessionInProgress');
  type SessionBody = { endReason: string; endedAt: string; tokensEarned: number; exchangesMade: number; events: { kind: string; startedAt?: string; endedAt?: string }[] };
  const sessions = async () => (await db.all<{ body: string }>('SELECT body FROM aba_sessions WHERE child_id = ? ORDER BY seq', [KID])).map((r) => JSON.parse(r.body) as SessionBody);
  type TailRow = { sessionId: string; accessScene: { startedAt: string; endedAt: string }[]; pairingTokenAt: string | null; leftAtStep: string | null; leftAt: string | null; completed: boolean; sceneStarted?: boolean; exchangeReturned?: { tokens: number; nonContingent: number; at: string; belowBoard?: true } };
  const tails = async () => (await db.all<{ body: string }>('SELECT body FROM aba_session_tails WHERE child_id = ? ORDER BY seq', [KID])).map((r) => JSON.parse(r.body) as TailRow);
  const border = () => StyleSheet.flatten(screen.getByTestId('aba-break-return').props.style).borderWidth as number;
  const tickUntil = (pred: () => boolean, step = 250, max = 400) => tickUntilWith(pred, step, max);
  const acquisitionAtL0 = async (stage: 1 | 2 | 3) => {
    const two = ABA_TARGETS.find((x) => x.id === 'match-same-2')!;
    const states = { [two.id]: { ...initialTargetState(two), phase: 'acquisition' as const, startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const } };
    const at = iso(clock.now());
    await asAbaWriter(db, KID, async (tx) => {
      await saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage }, at);
      await saveChildState(tx, KID, 'abaTargets', states, at);
    });
  };
  const fullBoardOfThree = async () => {
    const at = iso(clock.now());
    await asAbaWriter(db, KID, async (tx) => {
      await saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 3 }, at);
      await saveChildState(tx, KID, 'abaBoard', { earned: 3, nonContingent: 0 }, at);
    });
  };

  /** Сессия со взрослым до первой пробы (обучение карточке пропущено). */
  async function toTrial() {
    await mount();
    await skipCardTraining();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
  }
  async function answerRight() {
    await fireEvent.press(screen.getByTestId('aba-sample'));
    await fireEvent.press(screen.getByTestId(correctOption()));
  }
  /** Кадр обмена сразу, не в хвосте: ступень 1, верно на L0 — жетон заполнил доску, обмен в посадка + 700. Возвращает его начало. */
  async function toExchange(): Promise<number> {
    await acquisitionAtL0(1);
    await toTrial();
    await answerRight();
    await waitFor(() => expect(screen.getByTestId('aba-reinforcement')).toBeTruthy());
    const M = clock.now();
    await tick(0);
    await stepTo(M + 1040);
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    return clock.now();
  }
  /**
   * Доступ в сессии: сцена через 2020 после начала обмена. Возвращает начало сцены `A` и начало доступа по домену `S`
   * (`accessStartedAt` — кадр обмена, на 2020 раньше: приближение ≤ 3 с, методист а7). Тёплый возврат знает настоящую
   * сцену: T и первый отрезок журнала — от `A`. Только холодный старт считает их от `S` (с3а).
   */
  async function toAccess(): Promise<{ A: number; S: number }> {
    const S = await toExchange();
    const A = S + 1000 + 360 + 300 + 360;
    await stepTo(A);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    return { A, S };
  }
  async function holdExit() {
    await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
    await tick(1500);
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
  }
  /**
   * Снимок незаконченной сессии через настоящие сервисы: `loadAbaStart` → `startAbaSession` → выбор первого подкрепителя →
   * первая проба в очереди; `updated_at` снимка — `clock.now() − agoMs` (момент ухода без события ухода).
   */
  async function snapshotAtTrial(agoMs: number, patch: (s: AbaSessionState) => AbaSessionState = (s) => s): Promise<AbaSessionState> {
    const o = useChildSession.getState().settings;
    const now = clock.now() - agoMs;
    const start = await loadAbaStart(db, KID, { config: 'with_adult', band: o.band, soundOn: o.soundEffects, observers: [{ id: OBS, role: 'parent', trained: false }], primaryObserverId: OBS, now });
    if (start.kind !== 'ready') throw new Error(`старт заблокирован: ${start.reason}`);
    const first = nextStep(startAbaSession(start.input), now);
    if (first.step.kind !== 'choose_reinforcer') throw new Error('сессия начинается не с выбора');
    const trial = nextStep(chooseReinforcer(first.state, first.step.options[0], now), now);
    if (trial.step.kind !== 'trial') throw new Error(`ожидалась проба, шаг ${trial.step.kind}`);
    return saveAbaSessionStep(db, KID, patch(trial.state), iso(now));
  }
  /** База с задержкой записи: пока `close()` не снят `open()`, запросы экрана ждут. */
  function gatedDb() {
    let gate: Promise<void> | null = null;
    let release = () => undefined as void;
    const inner = db;
    const wait = async () => {
      if (gate) await gate;
    };
    const gated: SqlDb = {
      async run(sql: string, params?: readonly SqlValue[]) {
        await wait();
        return inner.run(sql, params);
      },
      async all<T>(sql: string, params?: readonly SqlValue[]) {
        await wait();
        return inner.all<T>(sql, params);
      },
      async exec(sql: string) {
        await wait();
        return inner.exec(sql);
      },
      async transaction<T>(fn: (tx: SqlDb) => Promise<T>) {
        await wait();
        return inner.transaction(fn);
      },
    };
    useAccount.setState({ db: gated });
    return {
      close() {
        gate = new Promise<void>((r) => {
          release = r;
        });
      },
      async open() {
        gate = null;
        await act(async () => release());
      },
    };
  }

  it('1. проба → фон → 90 с → возврат: та же проба с SD, проб не прибавилось, между — пустой фон, снимок помечен моментом ухода, pausedMs +90 с', async () => {
    await toTrial();
    const sample = stimOf('aba-sample');
    const before = (await snapshot())!;
    const leftAt = clock.now();
    await background();
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.queryByTestId('aba-sample')).toBeNull();
    expect(await snapshotAt()).toBe(iso(leftAt));
    await tick(90_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(screen.queryByTestId('aba-away')).toBeNull();
    expect(stimOf('aba-sample')).toBe(sample);
    expect(screen.getByTestId('aba-instruction')).toBeTruthy();
    expect(await count('aba_trials')).toBe(0);
    const after = (await snapshot())!;
    expect(after.sessionId).toBe(before.sessionId);
    expect(after.pausedMs).toBe(before.pausedMs + 90_000);
    expect(await count('aba_sessions')).toBe(0);
    // проба живая: ответ записывается как обычно
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
  });

  it('2. проба → фон 5 мин → возврат: новый выбор подкрепителя, затем проба; выборов в истории +1', async () => {
    await toTrial();
    const before = (await snapshot())!;
    const target = (before.queue[0] as { trial: { targetId: string } }).trial.targetId;
    expect(await count('aba_reinforcer_choices')).toBe(1);
    await background();
    await tick(5 * 60_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-choice')).toBeTruthy());
    expect(screen.getAllByTestId(/^aba-reinforcer-(?!stub)/)).toHaveLength(3);
    // обучения карточке заново нет (refs целы, возможности исчерпаны)
    expect(screen.queryByTestId('aba-card-training')).toBeNull();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(await count('aba_reinforcer_choices')).toBe(2);
    const after = (await snapshot())!;
    expect(after.sessionId).toBe(before.sessionId);
    expect([after.rechooseNow, after.reinforcerStale]).toEqual([undefined, undefined]);
    // других освоенных целей в плане нет — высоковероятной вставки нет (домен: `abaPhase8Resume.test`), та же проба
    expect((after.queue[0] as { trial: { targetId: string } }).trial.targetId).toBe(target);
    expect(await count('aba_trials')).toBe(0);
  });

  it('3. фон 31 мин → возврат: на карту без экрана конца, одна сессия app_backgrounded моментом ухода, снимка нет, стор сброшен', async () => {
    await toTrial();
    const leftAt = clock.now();
    await background();
    await tick(31 * 60_000);
    await foreground();
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
    expect(screen.queryByTestId('aba-end-neutral')).toBeNull();
    expect(screen.queryByTestId('aba-end-normal')).toBeNull();
    const rows = await sessions();
    expect(rows).toHaveLength(1);
    expect([rows[0].endReason, rows[0].endedAt]).toEqual(['app_backgrounded', iso(leftAt)]);
    expect(await snapshot()).toBeNull();
    expect(useAbaRun.getState().config).toBeNull();
  });

  it('4. другой локальный день при 5 мин фона — как просрочка: app_backgrounded моментом ухода, на карту', async () => {
    clock = manualClock(new Date(2026, 10, 6, 23, 58).getTime());
    await toTrial();
    const leftAt = clock.now();
    await background();
    await tick(5 * 60_000);
    expect(new Date(clock.now()).getDate()).not.toBe(new Date(leftAt).getDate()); // предпосылка: полночь между
    await foreground();
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
    const rows = await sessions();
    expect(rows).toHaveLength(1);
    expect([rows[0].endReason, rows[0].endedAt]).toEqual(['app_backgrounded', iso(leftAt)]);
    expect(await snapshot()).toBeNull();
    expect(screen.queryByTestId('aba-choice')).toBeNull();
  });

  it('5. холодный старт со снимком (60 с назад): та же сессия и проба, новой сессии и обучения карточке нет, pausedMs +60 с', async () => {
    const saved = await snapshotAtTrial(60_000);
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(screen.queryByTestId('aba-card-training')).toBeNull();
    expect(screen.queryByTestId('aba-choice')).toBeNull();
    const now = (await snapshot())!;
    expect(now.sessionId).toBe(saved.sessionId);
    expect(now.pausedMs).toBe(saved.pausedMs + 60_000);
    expect(await count('aba_sessions')).toBe(0);
    expect(await count('aba_trials')).toBe(0);
    // снимок пересохранён на показе пробы — момент старта
    expect(await snapshotAt()).toBe(iso(clock.now()));
  });

  it('6. снимок с головой очереди «доступ» без начала доступа — экран обмена заново, затем доступ', async () => {
    await snapshotAtTrial(60_000, (s) => ({ ...s, queue: [{ kind: 'access', durationMs: 20_000 }, ...s.queue], accessStartedAt: null }) as AbaSessionState);
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    expect(screen.queryByTestId('aba-access-play')).toBeNull();
    await tickUntil(() => screen.queryByTestId('aba-access-play') !== null, 100, 60);
    expect(await count('aba_sessions')).toBe(0);
  });

  it('7а. возврат в доступе до T: сцена и кольцо с остатка, «закругляемся» на возврате не звучит; в итоге два отрезка access', async () => {
    const { A, S } = await toAccess();
    await stepTo(A + 5000, 250);
    await background();
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect((await snapshot())!.accessStartedAt).toBe(S);
    await tick(10_000);
    voice.stop();
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-access-play')).toBeTruthy());
    expect(screen.getByTestId('aba-access-ring', HIDDEN)).toBeTruthy();
    expect(voice.last).toBeNull();
    // тёплый возврат знает настоящую сцену: T — от её начала, а не от кадра обмена; кольцо исчезает, сворачивание 360 и
    // кадр конца 1000, затем следующий шаг
    const T = A + 20_000;
    await stepTo(T - 1, 250);
    expect(screen.getByTestId('aba-access-play')).toBeTruthy();
    await stepTo(T);
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    await stepTo(T + 1360, 250);
    await tickUntil(() => screen.queryByTestId('aba-sample') !== null, 250, 40);
    await holdExit();
    const [row] = await sessions();
    expect(row.events.filter((e) => e.kind === 'access')).toEqual([
      { kind: 'access', startedAt: iso(A), endedAt: iso(A + 5000) },
      { kind: 'access', startedAt: iso(A + 15_000), endedAt: iso(T) },
    ]);
  });

  it('7б. возврат в доступе после T: кадр конца 1 с (hold) без сцены, затем следующий шаг; в итоге access до момента ухода', async () => {
    const { A } = await toAccess();
    await stepTo(A + 5000, 250);
    await background();
    await tick(30_000);
    const R = clock.now();
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-access-hold')).toBeTruthy());
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    expect(screen.queryByTestId('aba-access-scene')).toBeNull();
    await stepTo(R + 999, 250);
    expect(screen.getByTestId('aba-access-hold')).toBeTruthy();
    await stepTo(R + 1000);
    await waitFor(() => expect(screen.queryByTestId(/^aba-access-/, HIDDEN)).toBeNull());
    await tickUntil(() => screen.queryByTestId('aba-sample') !== null, 250, 40);
    await holdExit();
    const [row] = await sessions();
    expect(row.events.filter((e) => e.kind === 'access')).toEqual([{ kind: 'access', startedAt: iso(A), endedAt: iso(A + 5000) }]);
  });

  /**
   * Перерыв по карточке в первой пробе, затем через 1 с — в фон. Возвращает начало перерыва (момент просьбы: `nextStep`
   * ставит `breakStartedAt`, снимок ложится на входе в перерыв) и его длительность.
   */
  async function breakInTrialThenBackground(): Promise<{ startedAt: number; maxMs: number }> {
    await toTrial();
    await tick(500);
    await fireEvent.press(screen.getByTestId('aba-break-card'));
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    const startedAt = clock.now();
    await tick(1000);
    await background();
    const s = (await snapshot())!;
    expect(s.breakStartedAt).toBe(startedAt);
    return { startedAt, maxMs: CHILD_BREAK_MS[s.band] };
  }

  it('8а. возврат в перерыве с остатком > 5 с: кольцо по остатку (invite 0), первое приглашение — в исходный срок', async () => {
    const { startedAt, maxMs } = await breakInTrialThenBackground();
    await tick(maxMs - 1000 - 10_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    expect(border()).toBe(ABA_CONTROL_STROKE);
    expect(screen.getByTestId('aba-access-ring', HIDDEN)).toBeTruthy();
    await stepTo(startedAt + maxMs - 1, 1000);
    expect(border()).toBe(ABA_CONTROL_STROKE);
    await stepTo(startedAt + maxMs);
    expect(border()).toBe(6);
  });

  it('8б. возврат с остатком < 5 с: сразу первое приглашение без звука; конец по бездействию через 2 × RETURN_INVITE_AFTER_MS от возврата', async () => {
    const { maxMs } = await breakInTrialThenBackground();
    await tick(maxMs - 1000 - 2000);
    voice.stop();
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    const R = clock.now();
    expect(border()).toBe(6);
    expect(voice.last).toBeNull();
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    await stepTo(R + RETURN_INVITE_AFTER_MS - 1, 1000);
    expect(voice.last).toBeNull();
    await stepTo(R + RETURN_INVITE_AFTER_MS);
    expect(voice.last?.key).toBe('abaSession.sound.invite');
    await stepTo(R + 2 * RETURN_INVITE_AFTER_MS - 1, 1000);
    expect(screen.getByTestId('aba-break')).toBeTruthy();
    expect(await count('aba_sessions')).toBe(0);
    await stepTo(R + 2 * RETURN_INVITE_AFTER_MS);
    await waitFor(() => expect(screen.getByTestId('aba-end-neutral')).toBeTruthy());
    expect((await sessions())[0].endReason).toBe('assent_withdrawn');
  });

  it('8в. возврат, когда срок перерыва вышел: сразу приглашение, кольца нет', async () => {
    const { maxMs } = await breakInTrialThenBackground();
    // срок вышел, но фон короче 2 мин — иначе был бы новый выбор подкрепителя, а не перерыв
    await tick(maxMs + 10_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    expect(border()).toBe(6);
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    expect(await count('aba_sessions')).toBe(0);
  });

  it('8г. тихая пауза после «Отказ» истекла в фоне — закрыта своим сроком, не моментом возврата', async () => {
    await fullBoardOfThree();
    await toTrial();
    await tick(500);
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(screen.getByTestId('aba-refusal-pause')).toBeTruthy());
    const P = clock.now();
    await tick(1000);
    await background();
    expect((await snapshot())!.breakStartedAt).toBe(P);
    await tick(REFUSAL_QUIET_MS + 10_000);
    await foreground();
    // пауза закрыта сразу на возврате — без кадра паузы; снятое требование сессию не кончает: дальше следующая проба
    await waitFor(async () => expect((await snapshot())!.breakStartedAt).toBeNull());
    expect(screen.queryByTestId('aba-refusal-pause')).toBeNull();
    const events = (await snapshot())!.events as { kind: string; startedAt?: string; endedAt?: string }[];
    expect(events.filter((e) => e.kind === 'break')).toEqual([expect.objectContaining({ kind: 'break', startedAt: iso(P), endedAt: iso(P + REFUSAL_QUIET_MS) })]);
    expect(await count('aba_sessions')).toBe(0);
    await tickUntil(() => screen.queryByTestId('aba-sample') !== null, 500, 40);
  });

  it('9а. конфликт доски на записи пробы: живая доска и повтор — ответ записан со второй попытки, одна проба, один жетон', async () => {
    await acquisitionAtL0(2);
    await toTrial();
    const s = (await snapshot())!;
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaBoard', { earned: 0, nonContingent: 0, rev: s.boardRev + 1 }, iso(clock.now())));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await answerRight();
      await waitFor(() => expect(screen.getByTestId('aba-reinforcement')).toBeTruthy());
      expect(await count('aba_trials')).toBe(1);
      expect(await loadChildState(db, KID, 'abaBoard')).toMatchObject({ earned: 1 });
      expect((await snapshot())!.board.earned).toBe(1);
      expect(warn.mock.calls.some(([k, e]) => k === 'aba-session' && e instanceof AbaBoardConflictError)).toBe(true);
      expect(screen.queryByTestId('aba-end-neutral')).toBeNull();
    } finally {
      warn.mockRestore();
    }
  });

  it('9б. три конфликта подряд — спокойный конец без итога: aba_sessions пусто, снимок на месте', async () => {
    await acquisitionAtL0(2);
    await toTrial();
    const spy = jest.spyOn(commit, 'recordAbaTrial').mockRejectedValue(new AbaBoardConflictError(0, 1));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await answerRight();
      await waitFor(() => expect(screen.getByTestId('aba-end-neutral')).toBeTruthy());
      expect(spy).toHaveBeenCalledTimes(3);
      expect(await count('aba_sessions')).toBe(0);
      expect(await count('aba_trials')).toBe(0);
      expect(await snapshot()).toBeTruthy();
      expect(useAbaRun.getState().config).toBeNull();
    } finally {
      spy.mockRestore();
      warn.mockRestore();
    }
  });

  it('10а. пауза родителя между уходом и возвратом — спокойный конец без записи, снимок на месте', async () => {
    await toTrial();
    await background();
    expect(await setAbaPaused(db, KID, true, iso(clock.now()))).toBe('saved');
    await tick(10_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-end-neutral')).toBeTruthy());
    expect(await count('aba_sessions')).toBe(0);
    expect(await snapshot()).toBeTruthy();
    expect(useAbaRun.getState().config).toBeNull();
    expect(screen.queryByTestId('aba-sample')).toBeNull();
  });

  it('10б. отзыв согласия между уходом и возвратом — спокойный конец без записи, новая сессия не начинается', async () => {
    await toTrial();
    await background();
    await revokeAbaProcessing(
      db,
      { id: '00000000-0000-4000-8000-0000000000c1', scope: 'aba_processing', action: 'revoke', childId: KID, textVersion: abaConsentTextVersion('ru'), confirmedBy: 'pin', actorId: 'acc', at: iso(clock.now()) },
      'owner',
    );
    expect(await snapshot()).toBeFalsy();
    await tick(10_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-end-neutral')).toBeTruthy());
    expect(await count('aba_sessions')).toBe(0);
    expect(await snapshot()).toBeFalsy();
    expect(screen.queryByTestId('aba-choice')).toBeNull();
    expect(useAbaRun.getState().config).toBeNull();
  });

  it('11. прочая ошибка записи пробы — итог app_error записан, стор сброшен', async () => {
    await toTrial();
    const spy = jest.spyOn(commit, 'recordAbaTrial').mockRejectedValueOnce(new Error('boom'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await answerRight();
      await waitFor(async () => expect(await count('aba_sessions')).toBe(1));
      expect((await sessions())[0].endReason).toBe('app_error');
      expect(await count('aba_trials')).toBe(0);
      expect(await snapshot()).toBeNull();
      expect(useAbaRun.getState().config).toBeNull();
      await waitFor(() => expect(screen.queryByTestId('aba-sample')).toBeNull());
    } finally {
      spy.mockRestore();
      warn.mockRestore();
    }
  });

  it('12. снимок с устаревшим подкрепителем и полной доской: выбор → экран обмена → доступ', async () => {
    await snapshotAtTrial(60_000, (s) => ({ ...s, board: { ...s.board, earned: s.board.size }, reinforcerStale: true }) as AbaSessionState);
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-choice')).toBeTruthy());
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    expect(screen.queryByTestId('aba-access-play')).toBeNull();
    await tickUntil(() => screen.queryByTestId('aba-access-play') !== null, 100, 60);
    const s = (await snapshot())!;
    expect(s.exchangesMade).toBe(1);
    expect(s.reinforcerStale).toBeUndefined();
  });

  it('13а. тир фиксируется первым onLayout: второе измерение меньшей высотой раскладку не меняет', async () => {
    expect([abaTierFor(760, 0), abaTierFor(650, 0)]).toEqual(['roomy', 'compact']);
    await toTrial();
    const panelHeight = () => StyleSheet.flatten(screen.getByTestId('aba-adult-panel').props.style).height as number;
    expect(panelHeight()).toBe(abaLayoutByTier.roomy.adultPanel);
    await layout(650);
    await tick(10);
    expect(panelHeight()).toBe(abaLayoutByTier.roomy.adultPanel);
    expect(screen.getByTestId('aba-sample')).toBeTruthy();
  });

  it('13б. первое измерение «слишком мало» — к гейту /aba, ничего не начато и не записано', async () => {
    expect(abaTierFor(400, 0)).toBeNull();
    await mount(400);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/aba'));
    await tick(1000);
    expect(screen.queryByTestId('aba-card-training')).toBeNull();
    expect(await count('aba_sessions')).toBe(0);
    expect(await snapshot()).toBeFalsy();
  });

  it('14а. хвост доигран: конец с обменом → «Закончили» — одна строка aba_session_tails с одним отрезком доступа, completed', async () => {
    await fullBoardOfThree();
    await toTrial();
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    expect(await tails()).toEqual([]);
    await tickUntil(() => screen.queryByTestId('aba-end-neutral') !== null, 500, 200);
    const rows = await tails();
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({ pairingTokenAt: null, leftAtStep: null, leftAt: null, completed: true });
    expect(row.accessScene).toHaveLength(1);
    expect(Date.parse(row.accessScene[0].endedAt) - Date.parse(row.accessScene[0].startedAt)).toBe(40_000);
    expect(row.sessionId).toBe((await db.all<{ id: string }>('SELECT id FROM aba_sessions WHERE child_id = ?', [KID]))[0].id);
  });

  it('14б. уход на ожидании цикла сопряжения: строка хвоста leftAtStep wait без жетона; возврат — «Закончили», второго жетона нет', async () => {
    await toTrial();
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(screen.getByTestId('aba-end-wait')).toBeTruthy());
    await tick(2000);
    const leftAt = clock.now();
    await background();
    await waitFor(async () => expect(await tails()).toHaveLength(1));
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'wait', pairingTokenAt: null, completed: false, leftAt: iso(leftAt), accessScene: [] });
    await tick(60_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-end-neutral')).toBeTruthy());
    expect(screen.queryByTestId('aba-end-pairing')).toBeNull();
    await tick(60_000);
    expect(screen.queryByTestId('aba-end-pairing')).toBeNull();
    expect(await tails()).toHaveLength(1);
    expect(await count('aba_sessions')).toBe(1);
  });

  it('15. фон во время записи пробы: снимок с моментом ухода ложится после записи, версии доски не расходятся, на возврате продолжение', async () => {
    const g = gatedDb();
    await toTrial();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      g.close();
      await answerRight();
      expect(await count('aba_trials')).toBe(0);
      const leftAt = clock.now();
      await background();
      expect(screen.getByTestId('aba-away')).toBeTruthy();
      await g.open();
      await waitFor(async () => expect(await count('aba_trials')).toBe(1));
      await waitFor(async () => expect(await snapshotAt()).toBe(iso(leftAt)));
      const s = (await snapshot())!;
      const live = (await loadChildState(db, KID, 'abaBoard')) as { rev?: number } | null;
      expect(s.boardRev).toBe(live?.rev ?? 0);
      expect(warn.mock.calls.filter(([k]) => k === 'aba-session-leave' || k === 'aba-session')).toEqual([]);
      await tick(30_000);
      await foreground();
      await tickUntil(() => screen.queryByTestId('aba-sample') !== null, 500, 40);
      expect(screen.queryByTestId('aba-end-neutral')).toBeNull();
      expect(await count('aba_sessions')).toBe(0);
      expect((await snapshot())!.trials).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('15б. фон во время записи пробы: до возврата кадр остаётся пустым — последствие записанной пробы не всплывает в фоне', async () => {
    const g = gatedDb();
    await toTrial();
    g.close();
    await answerRight();
    await background();
    await g.open();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.queryByTestId('aba-reinforcement')).toBeNull();
  });

  // --- обмен, снимки на входе в сцену и перерыв, хвост, гонки ухода и возврата

  /** Запись итога держится до `open()`: итог уже начат (`finish`), а строки в `aba_sessions` ещё нет. */
  function gatedCommit() {
    let release = () => undefined as void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const real = commit.commitAbaSession;
    const spy = jest.spyOn(commit, 'commitAbaSession').mockImplementation(async (...args) => {
      await gate;
      return real(...args);
    });
    undo.push(() => {
      release();
      spy.mockRestore();
    });
    return { spy, open: () => act(async () => release()) };
  }
  const quietWarn = () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    undo.push(() => warn.mockRestore());
    return warn;
  };
  const inTrial = () => screen.queryByTestId('aba-panel-adult_prompted') !== null;
  const accessPlay = () => screen.queryByTestId('aba-access-play') !== null;
  const ended = () => screen.queryByTestId('aba-end-neutral') !== null;
  const accessEvents = async () => (await sessions())[0].events.filter((e) => e.kind === 'access');
  const tailRowsAre = (n: number) => waitFor(async () => expect(await tails()).toHaveLength(n));
  /** Приложение убито без события ухода: экран размонтирован, снимок в базе — последний, что лёг сам. */
  async function kill(ms: number) {
    await screen.unmount();
    await tick(ms);
  }
  /**
   * Обмен показан заново: на экране полная доска, сцены нет; после него доступ на полную длительность. Начало сцены —
   * конец обмена, в журнале сессии ровно один отрезок `durationMs`: уход не съел доступ и не дал его дважды.
   */
  async function exchangeAgainThenFullAccess(durationMs: number) {
    expect(screen.getByTestId('aba-exchange')).toBeTruthy();
    expect(screen.queryAllByTestId('aba-exchange-token-empty', HIDDEN)).toHaveLength(0);
    expect(accessPlay()).toBe(false);
    await tickUntil(accessPlay, 20, 200);
    const O = clock.now();
    await stepTo(O + durationMs - 1, 250);
    expect(screen.getByTestId('aba-access-ring', HIDDEN)).toBeTruthy();
    await stepTo(O + durationMs);
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    // дальше шаг домена: следующая проба или, если доступ был последним шагом, конец сессии с уже записанным итогом
    await tickUntil(() => screen.queryByTestId('aba-access-hold') !== null, 20, 40);
    await tickUntil(() => screen.queryByTestId('aba-access-hold') === null, 20, 80);
    await waitFor(async () => expect((await snapshot())?.accessStartedAt ?? null).toBeNull());
    if ((await count('aba_sessions')) === 0) await holdExit();
    expect(await accessEvents()).toEqual([{ kind: 'access', startedAt: iso(O), endedAt: iso(O + durationMs) }]);
  }
  /** Ступень 2: четыре подсказанные пробы блока без жетона; на экране пятая, последняя проба блока. */
  async function toLastTrialOfBlock() {
    await acquisitionAtL0(2);
    await toTrial();
    for (let i = 0; i < 4; i += 1) {
      await fireEvent.press(screen.getByTestId('aba-panel-adult_prompted'));
      await answerRight();
      await waitFor(() => expect(inTrial()).toBe(false));
      await tickUntil(inTrial);
    }
  }

  it('с1а. уход на кадре обмена, возврат до 2 минут: обмен заново с начала, доступ на полную длительность; в снимке нет начала доступа', async () => {
    await toExchange();
    await tick(500);
    const L = clock.now();
    await background();
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L)));
    const s = (await snapshot())!;
    expect(s.accessStartedAt).toBeNull();
    expect(s.queue[0].kind).toBe('access');
    await tick(2 * 60_000 - 1);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    await exchangeAgainThenFullAccess(EXCHANGE_ACCESS_MS[1]);
    expect(await count('aba_trials')).toBe(1);
  });

  it('с1б. уход на кадре обмена: второй обмен не списывает жетоны заново, начало шага до ухода не считается работой', async () => {
    const S = await toExchange();
    const before = (await snapshot())!;
    await tick(500);
    await background();
    await waitFor(async () => expect((await snapshot())!.pausedMs).toBe(before.pausedMs + (clock.now() - S)));
    await tick(30_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    await tickUntil(accessPlay, 20, 200);
    await waitFor(async () => expect((await snapshot())!.accessStartedAt).not.toBeNull());
    const after = (await snapshot())!;
    expect(after.exchangesMade).toBe(before.exchangesMade);
    expect(after.board.earned).toBe(before.board.earned);
  });

  it('с1в. повторный обмен держит полную доску 1000, и на доске из одной ячейки', async () => {
    await toExchange();
    await tick(500);
    await background();
    await tick(30_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    const R = clock.now();
    await stepTo(R + 999);
    expect(screen.queryAllByTestId('aba-exchange-token-filled', HIDDEN)).toHaveLength(1);
  });

  it('с1г. холодный старт на обмене: повторный обмен тоже держит полную доску 1000', async () => {
    await toExchange();
    await tick(500);
    await kill(5000);
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    const R = clock.now();
    await stepTo(R + 999);
    expect(screen.queryAllByTestId('aba-exchange-token-filled', HIDDEN)).toHaveLength(1);
  });

  it('с2а. уход на плашке, когда обмен ещё впереди: возврат показывает обмен, доступ не начинается без него', async () => {
    await acquisitionAtL0(1);
    await toTrial();
    await answerRight();
    await waitFor(() => expect(screen.getByTestId('aba-reinforcement')).toBeTruthy());
    await tick(0);
    await tick(300);
    const L = clock.now();
    await background();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L)));
    const s = (await snapshot())!;
    expect([s.queue[0].kind, s.accessStartedAt]).toEqual(['access', null]);
    await tick(30_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    await exchangeAgainThenFullAccess(EXCHANGE_ACCESS_MS[1]);
  });

  it('с2б. уход на жетоне за участие, заполнившем доску: тот же исход — обмен заново, доступ целиком', async () => {
    await toLastTrialOfBlock();
    await answerRight();
    await waitFor(() => expect(screen.getByTestId('aba-reinforcement')).toBeTruthy());
    const M = clock.now();
    await tick(0);
    await stepTo(M + 5100, 100);
    // жетон за участие в полёте: `exchangePending` стоит, экран обмена ещё не показан
    expect(screen.queryAllByTestId('aba-strip-token-dropping', HIDDEN)).toHaveLength(1);
    expect(screen.queryByTestId('aba-exchange')).toBeNull();
    const L = clock.now();
    await background();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L)));
    const s = (await snapshot())!;
    expect([s.queue[0].kind, s.accessStartedAt]).toEqual(['access', null]);
    await tick(30_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    await exchangeAgainThenFullAccess(EXCHANGE_ACCESS_MS[2]);
  });

  it('с3а. холодный старт, снимок лёг на входе в сцену: сцена с остатка, обмен не повторяется', async () => {
    const { A, S } = await toAccess();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(A)));
    const saved = (await snapshot())!;
    expect(saved.accessStartedAt).toBe(S);
    await kill(5000);
    const R = clock.now();
    await mount();
    await waitFor(() => expect(accessPlay()).toBe(true));
    expect(screen.queryByTestId('aba-exchange')).toBeNull();
    expect(screen.queryByTestId('aba-card-training')).toBeNull();
    const T = S + EXCHANGE_ACCESS_MS[1];
    await stepTo(T - 1, 250);
    expect(accessPlay()).toBe(true);
    await stepTo(T);
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    await tickUntil(inTrial, 250, 40);
    expect((await snapshot())!.exchangesMade).toBe(saved.exchangesMade);
    await holdExit();
    // на холодном старте экран конца сцены не знает: первый отрезок — от `accessStartedAt` с endUnknown, в длительность не идёт (№181)
    expect(await accessEvents()).toEqual([
      { kind: 'access', startedAt: iso(S), endedAt: iso(A), endUnknown: true },
      { kind: 'access', startedAt: iso(R), endedAt: iso(T) },
    ]);
  });

  it('с3б. холодный старт во время обмена: снимка с началом доступа нет — обмен заново, доступ целиком', async () => {
    await toExchange();
    await tick(500);
    expect((await snapshot())!.accessStartedAt).toBeNull();
    await kill(5000);
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    await exchangeAgainThenFullAccess(EXCHANGE_ACCESS_MS[1]);
  });

  it('с4. холодный старт в перерыве: кольцо с остатка от breakStartedAt — снимок лёг на входе в перерыв', async () => {
    await toTrial();
    await tick(500);
    await fireEvent.press(screen.getByTestId('aba-break-card'));
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    const startedAt = clock.now();
    const saved = (await snapshot())!;
    expect(saved.breakStartedAt).toBe(startedAt);
    const maxMs = CHILD_BREAK_MS[saved.band];
    await tick(1000);
    await kill(10_000);
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    expect(screen.queryByTestId('aba-card-training')).toBeNull();
    expect(screen.getByTestId('aba-access-ring', HIDDEN)).toBeTruthy();
    expect(border()).toBe(ABA_CONTROL_STROKE);
    await stepTo(startedAt + maxMs - 1, 1000);
    expect(border()).toBe(ABA_CONTROL_STROKE);
    await stepTo(startedAt + maxMs);
    expect(border()).toBe(6);
    const now = (await snapshot())!;
    expect([now.sessionId, now.breakStartedAt]).toEqual([saved.sessionId, startedAt]);
    expect(await count('aba_sessions')).toBe(0);
  });

  it('с5а. два ухода в одном доступе: отрезки [сцена, L1], [R1, L2], [R2, T], T — от начала сцены, время в фоне в них не попадает', async () => {
    const { A } = await toAccess();
    await stepTo(A + 3000, 250);
    const L1 = clock.now();
    await background();
    await tick(2000);
    const R1 = clock.now();
    await foreground();
    await waitFor(() => expect(accessPlay()).toBe(true));
    await stepTo(R1 + 3000, 250);
    const L2 = clock.now();
    await background();
    await tick(2000);
    const R2 = clock.now();
    await foreground();
    await waitFor(() => expect(accessPlay()).toBe(true));
    const T = A + EXCHANGE_ACCESS_MS[1];
    await stepTo(T - 1, 250);
    expect(accessPlay()).toBe(true);
    await stepTo(T);
    await tickUntil(inTrial, 250, 40);
    await holdExit();
    expect(await accessEvents()).toEqual([
      { kind: 'access', startedAt: iso(A), endedAt: iso(L1) },
      { kind: 'access', startedAt: iso(R1), endedAt: iso(L2) },
      { kind: 'access', startedAt: iso(R2), endedAt: iso(T) },
    ]);
  });

  it('с5б. выход удержанием во втором отрезке доступа: в журнале оба отрезка, первый не теряется', async () => {
    const { A } = await toAccess();
    await stepTo(A + 3000, 250);
    const L = clock.now();
    await background();
    await tick(2000);
    const R = clock.now();
    await foreground();
    await waitFor(() => expect(accessPlay()).toBe(true));
    await stepTo(R + 3000, 250);
    const X = clock.now();
    await holdExit();
    expect(await accessEvents()).toEqual([
      { kind: 'access', startedAt: iso(A), endedAt: iso(L) },
      { kind: 'access', startedAt: iso(R), endedAt: iso(X + 1500) },
    ]);
  });

  /** Конец с обменом: полная доска из трёх, «Отказ» вне пробы — итог записан, на экране обмен хвоста. */
  async function toTailExchange() {
    await fullBoardOfThree();
    await toTrial();
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
  }
  /** Доступ хвоста (доска из трёх — 40 с); возвращает начало сцены. */
  async function toTailAccess(): Promise<number> {
    await toTailExchange();
    await tickUntil(accessPlay, 20, 200);
    return clock.now();
  }
  const TAIL_ACCESS_MS = EXCHANGE_ACCESS_MS[3];

  it('с6. хвост: уход на обмене, возврат до 2 минут — доступ с начала, затем «Закончили»; строки: уход, «сцена началась» и доигранный итог', async () => {
    await toTailExchange();
    await tick(500);
    const L = clock.now();
    await background();
    await tailRowsAre(1);
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'exchange', leftAt: iso(L), completed: false, accessScene: [] });
    await tick(2 * 60_000 - 1);
    const R = clock.now();
    await foreground();
    await waitFor(() => expect(accessPlay()).toBe(true));
    expect(screen.queryByTestId('aba-exchange')).toBeNull();
    await stepTo(R + TAIL_ACCESS_MS - 1, 250);
    expect(accessPlay()).toBe(true);
    await tickUntil(ended);
    await tailRowsAre(3);
    // №181: сцена хвоста началась — строка «сцена началась» перекрывает уход на обмене
    expect((await tails())[1]).toMatchObject({ leftAtStep: 'access', leftAt: null, completed: false, sceneStarted: true, accessScene: [] });
    expect((await tails())[2]).toMatchObject({ leftAtStep: null, leftAt: null, completed: true, accessScene: [{ startedAt: iso(R), endedAt: iso(R + TAIL_ACCESS_MS) }] });
    expect(await count('aba_sessions')).toBe(1);
  });

  it('с7. хвост: уход на обмене, возврат от 2 минут — «Закончили» без доски, доступа нет, жетоны обмена вернулись (№181)', async () => {
    await toTailExchange();
    await tick(500);
    await background();
    await tailRowsAre(1);
    await tick(2 * 60_000);
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    expect(screen.queryByTestId('aba-end-board')).toBeNull();
    expect(accessPlay()).toBe(false);
    await tick(60_000);
    expect(accessPlay()).toBe(false);
    await tailRowsAre(2);
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'exchange', completed: false, accessScene: [], sceneStarted: false });
    expect((await tails())[1]).toMatchObject({ leftAtStep: 'exchange', completed: false, accessScene: [], exchangeReturned: { tokens: 3, nonContingent: 0 } });
    const sessionId = (await tails())[0].sessionId;
    expect(await loadChildState(db, KID, 'abaBoard')).toMatchObject({ earned: 3, returned: { tokens: 3, fromSessionId: sessionId } });
  });

  it('с7а. хвост: уход на обмене, возврат до 2 минут — доступ доигран, жетоны не возвращаются (№181)', async () => {
    await toTailExchange();
    await tick(500);
    await background();
    await tailRowsAre(1);
    await tick(2 * 60_000 - 1);
    await foreground();
    await waitFor(() => expect(accessPlay()).toBe(true));
    await tickUntil(ended);
    await tailRowsAre(3);
    expect((await tails())[1]).toMatchObject({ leftAtStep: 'access', leftAt: null, completed: false, sceneStarted: true });
    expect((await tails())[2]).toMatchObject({ completed: true });
    expect((await tails()).some((t) => t.exchangeReturned !== undefined)).toBe(false);
    expect((await loadChildState(db, KID, 'abaBoard'))?.earned ?? 0).toBe(0);
  });

  it('с7в. хвост: уход на обмене, возврат до 2 минут, приложение убито в сцене — холодный старт жетоны не возвращает (№181)', async () => {
    await toTailExchange();
    await tick(500);
    await background();
    await tailRowsAre(1);
    await tick(10_000);
    await foreground();
    await waitFor(() => expect(accessPlay()).toBe(true));
    await tailRowsAre(2);
    expect((await tails())[1]).toMatchObject({ leftAtStep: 'access', leftAt: null, sceneStarted: true });
    await tick(5000);
    await kill(5000);
    // тот же вызов, что делают холодный старт (loadAbaStart) и экран родителя: по строкам, которые записал экран
    expect(await commit.settleTailExchange(db, KID, { at: iso(clock.now()) })).toBe(false);
    expect((await tails()).some((t) => t.exchangeReturned !== undefined)).toBe(false);
    expect((await loadChildState(db, KID, 'abaBoard'))?.earned ?? 0).toBe(0);
  });

  it('с7б. хвост: выход удержанием на обмене — жетоны обмена вернулись сразу (№181)', async () => {
    await toTailExchange();
    await tick(500);
    await holdExit();
    await tailRowsAre(1);
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'exchange', completed: false, sceneStarted: false, exchangeReturned: { tokens: 3, nonContingent: 0 } });
    expect(await loadChildState(db, KID, 'abaBoard')).toMatchObject({ earned: 3, returned: { tokens: 3 } });
  });

  it('с8а. хвост: уход в доступе, возврат до T и до 2 минут — сцена с остатка, два отрезка во второй строке', async () => {
    const A = await toTailAccess();
    await stepTo(A + 5000, 250);
    const L = clock.now();
    await background();
    await tailRowsAre(1);
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'access', leftAt: iso(L), completed: false, accessScene: [{ startedAt: iso(A), endedAt: iso(L) }] });
    await tick(10_000);
    const R = clock.now();
    voice.stop();
    await foreground();
    await waitFor(() => expect(accessPlay()).toBe(true));
    expect(screen.getByTestId('aba-access-ring', HIDDEN)).toBeTruthy();
    expect(voice.last).toBeNull();
    const T = A + TAIL_ACCESS_MS;
    await stepTo(T - 1, 250);
    expect(accessPlay()).toBe(true);
    await stepTo(T);
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    await tickUntil(ended);
    await tailRowsAre(2);
    expect((await tails())[1]).toMatchObject({
      leftAtStep: null,
      leftAt: null,
      completed: true,
      accessScene: [
        { startedAt: iso(A), endedAt: iso(L) },
        { startedAt: iso(R), endedAt: iso(T) },
      ],
    });
  });

  it('с8б. хвост: уход в доступе, возврат после T и до 2 минут — кадр конца 1 с, затем «Закончили»; остаток сцены не выдан', async () => {
    const A = await toTailAccess();
    await stepTo(A + 5000, 250);
    const L = clock.now();
    await background();
    await tailRowsAre(1);
    await tick(TAIL_ACCESS_MS);
    const R = clock.now();
    expect(R - L).toBeLessThan(2 * 60_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-access-hold')).toBeTruthy());
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    await stepTo(R + 999, 250);
    expect(screen.getByTestId('aba-access-hold')).toBeTruthy();
    expect(ended()).toBe(false);
    await stepTo(R + 1000);
    await waitFor(() => expect(ended()).toBe(true));
    await tailRowsAre(2);
    expect((await tails())[1]).toMatchObject({ completed: true, accessScene: [{ startedAt: iso(A), endedAt: iso(L) }] });
  });

  it('с8в. хвост: уход в доступе, возврат от 2 минут — «Закончили», одна строка с отрезком до ухода', async () => {
    const A = await toTailAccess();
    await stepTo(A + 5000, 250);
    const L = clock.now();
    await background();
    await tailRowsAre(1);
    await tick(2 * 60_000);
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    expect(accessPlay()).toBe(false);
    await tick(60_000);
    expect(await tails()).toHaveLength(1);
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'access', completed: false, accessScene: [{ startedAt: iso(A), endedAt: iso(L) }] });
  });

  it('с8г. хвост: два ухода в доступе — у последней строки все три отрезка, первые две строки — уходы', async () => {
    const A = await toTailAccess();
    await stepTo(A + 3000, 250);
    const L1 = clock.now();
    await background();
    await tailRowsAre(1);
    await tick(2000);
    const R1 = clock.now();
    await foreground();
    await waitFor(() => expect(accessPlay()).toBe(true));
    await stepTo(R1 + 3000, 250);
    const L2 = clock.now();
    await background();
    await tailRowsAre(2);
    await tick(2000);
    const R2 = clock.now();
    await foreground();
    await waitFor(() => expect(accessPlay()).toBe(true));
    const T = A + TAIL_ACCESS_MS;
    await tickUntil(ended);
    await tailRowsAre(3);
    const [first, second, last] = await tails();
    expect([first.completed, second.completed, last.completed]).toEqual([false, false, true]);
    expect(second.accessScene).toEqual([
      { startedAt: iso(A), endedAt: iso(L1) },
      { startedAt: iso(R1), endedAt: iso(L2) },
    ]);
    expect(last.accessScene).toEqual([
      { startedAt: iso(A), endedAt: iso(L1) },
      { startedAt: iso(R1), endedAt: iso(L2) },
      { startedAt: iso(R2), endedAt: iso(T) },
    ]);
  });

  /** Конец по отказу без полной доски: цикл сопряжения дошёл до жетона; возвращает начало кадра жетона. */
  async function toPairingToken(): Promise<number> {
    await toTrial();
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(screen.getByTestId('aba-end-wait')).toBeTruthy());
    await stepTo(clock.now() + PAIRING.tokenAfterMs, 500);
    expect(screen.getByTestId('aba-end-pairing')).toBeTruthy();
    return clock.now();
  }

  /** Жетон цикла сел, через 100 мс свернули; возвращает момент посадки и момент ухода. */
  async function leaveAfterPairingToken() {
    const t1 = await toPairingToken();
    await stepTo(t1 + 220);
    await tick(100);
    const L = clock.now();
    await background();
    await tailRowsAre(1);
    return { landedAt: t1 + 220, L };
  }

  it('с9а. хвост: уход после севшего жетона цикла, возврат до 2 минут — доступ 20 с, второго жетона нет, момент жетона записан', async () => {
    const { landedAt, L } = await leaveAfterPairingToken();
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'pairing_token', pairingTokenAt: iso(landedAt), leftAt: iso(L), completed: false, accessScene: [] });
    await tick(30_000);
    const R = clock.now();
    const say = jest.spyOn(voice, 'say');
    undo.push(() => say.mockRestore());
    await foreground();
    await waitFor(() => expect(accessPlay()).toBe(true));
    expect(screen.queryByTestId('aba-end-pairing')).toBeNull();
    await stepTo(R + PAIRING.accessMs - 1, 250);
    expect(accessPlay()).toBe(true);
    await stepTo(R + PAIRING.accessMs);
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    await tickUntil(ended);
    expect(screen.queryByTestId('aba-end-pairing')).toBeNull();
    expect(say).not.toHaveBeenCalledWith('abaSession.sound.token');
    await tailRowsAre(2);
    expect((await tails())[1]).toMatchObject({ pairingTokenAt: iso(landedAt), leftAtStep: null, leftAt: null, completed: true, accessScene: [{ startedAt: iso(R), endedAt: iso(R + PAIRING.accessMs) }] });
  });

  it('с9а-2. хвост: уход после севшего жетона цикла, возврат от 2 минут — «Закончили», доступа нет, строка одна', async () => {
    await leaveAfterPairingToken();
    await tick(2 * 60_000);
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    expect(accessPlay()).toBe(false);
    await tick(60_000);
    expect(accessPlay()).toBe(false);
    expect(await tails()).toHaveLength(1);
  });

  it('с9б. хвост: уход на жетоне цикла до посадки — pairingTokenAt null, на возврате жетон не садится', async () => {
    const t1 = await toPairingToken();
    await stepTo(t1 + 100);
    await background();
    await tailRowsAre(1);
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'pairing_token', pairingTokenAt: null, completed: false });
    await tick(30_000);
    voice.stop();
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    await tick(1000);
    expect(voice.last).toBeNull();
    expect(await tails()).toHaveLength(1);
  });

  /** Конец с обменом, но итог ещё пишется; хвоста пока нет. */
  async function refusalWhileTotalIsWritten() {
    await fullBoardOfThree();
    await toTrial();
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    const g = gatedCommit();
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(g.spy).toHaveBeenCalled());
    return g;
  }

  it('с10а. уход, пока пишется итог: хвост не стартует в фоне; возврат до 2 минут — обмен с начала, затем доступ и «Закончили»', async () => {
    const g = await refusalWhileTotalIsWritten();
    const L = clock.now();
    await background();
    expect(await count('aba_sessions')).toBe(0);
    await g.open();
    await waitFor(async () => expect(await count('aba_sessions')).toBe(1));
    await tailRowsAre(1);
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'exchange', leftAt: iso(L), completed: false, accessScene: [] });
    await tick(30_000);
    // хвост стоит: ни кадра, ни его строк в фоне
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.queryByTestId('aba-exchange')).toBeNull();
    expect(await tails()).toHaveLength(1);
    const R = clock.now();
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    expect(screen.queryAllByTestId('aba-exchange-token-filled', HIDDEN)).toHaveLength(3);
    await tickUntil(accessPlay, 20, 200);
    expect(clock.now()).toBe(R + 2140);
    await tickUntil(ended);
    await tailRowsAre(3);
    expect((await tails())[1]).toMatchObject({ leftAtStep: 'access', leftAt: null, completed: false, sceneStarted: true, accessScene: [] });
    expect((await tails())[2]).toMatchObject({ completed: true, accessScene: [{ startedAt: iso(R + 2140), endedAt: iso(R + 2140 + TAIL_ACCESS_MS) }] });
  });

  it('с10б. уход, пока пишется итог, возврат от 2 минут — «Закончили» без доски, ни обмена, ни доступа; жетоны вернулись (№181)', async () => {
    const g = await refusalWhileTotalIsWritten();
    await background();
    await g.open();
    await tailRowsAre(1);
    await tick(2 * 60_000);
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    expect(screen.queryByTestId('aba-end-board')).toBeNull();
    expect(screen.queryByTestId('aba-exchange')).toBeNull();
    expect(accessPlay()).toBe(false);
    await tailRowsAre(2);
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'exchange', completed: false });
    expect((await tails())[1]).toMatchObject({ leftAtStep: 'exchange', completed: false, exchangeReturned: { tokens: 3, nonContingent: 0 } });
    expect((await loadChildState(db, KID, 'abaBoard'))?.earned).toBe(3);
  });

  it('с10в. уход, пока пишется итог без хвоста (только шаг end): на возврате одна строка completed true', async () => {
    await toTrial();
    quietWarn();
    const boom = jest.spyOn(commit, 'recordAbaTrial').mockRejectedValueOnce(new Error('boom'));
    undo.push(() => boom.mockRestore());
    const g = gatedCommit();
    await answerRight();
    await waitFor(() => expect(g.spy).toHaveBeenCalled());
    await background();
    await g.open();
    await waitFor(async () => expect(await count('aba_sessions')).toBe(1));
    expect(await tails()).toEqual([]);
    await tick(30_000);
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    await tailRowsAre(1);
    expect((await tails())[0]).toMatchObject({ leftAtStep: null, leftAt: null, completed: true, accessScene: [] });
  });

  it.each([
    ['запись кончилась до возврата', 'open_first'],
    ['возврат раньше конца записи', 'return_first'],
  ] as const)('с11а. нет взаимной блокировки при уходе во время записи прерванной пробы: %s — перерыв, затем продолжение', async (_name, order) => {
    const g = gatedDb();
    await toTrial();
    await tick(500);
    g.close();
    await fireEvent.press(screen.getByTestId('aba-break-card'));
    expect(await count('aba_trials')).toBe(0);
    const L = clock.now();
    await background();
    const R = L + 30_000;
    if (order === 'open_first') {
      await g.open();
      await waitFor(async () => expect(await snapshotAt()).toBe(iso(L)));
      // запись дошла до `advance`, но шаг не взят: перерыв не начинается в фоне
      expect((await snapshot())!.breakStartedAt).toBeNull();
      await tick(30_000);
      await foreground();
    } else {
      await tick(30_000);
      await foreground();
      await g.open();
    }
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    expect((await snapshot())!.breakStartedAt).toBe(R);
    const [row] = await db.all<{ body: string }>('SELECT body FROM aba_trials WHERE child_id = ?', [KID]);
    expect(JSON.parse(row.body)).toMatchObject({ response: 'interrupted', interruptedBy: 'child_break' });
    await fireEvent.press(screen.getByTestId('aba-break-return'));
    await tickUntil(inTrial, 250, 40);
    expect(await count('aba_trials')).toBe(1);
    expect(await count('aba_sessions')).toBe(0);
  });

  it('с11б. нет взаимной блокировки при уходе во время записи итога по ошибке: возврат ждёт запись и показывает конец', async () => {
    await toTrial();
    quietWarn();
    const boom = jest.spyOn(commit, 'recordAbaTrial').mockRejectedValueOnce(new Error('boom'));
    undo.push(() => boom.mockRestore());
    const g = gatedCommit();
    await answerRight();
    await waitFor(() => expect(g.spy).toHaveBeenCalled());
    await background();
    await tick(10_000);
    await foreground();
    await g.open();
    await waitFor(() => expect(ended()).toBe(true));
    expect(screen.queryByTestId('aba-away')).toBeNull();
    expect((await sessions()).map((r) => r.endReason)).toEqual(['app_error']);
    expect(await snapshot()).toBeNull();
  });

  /**
   * Возврат дошёл до `loadAbaResume` и ждёт базу; пока он ждёт, приложение снова свёрнуто. Кадра между уходами не было:
   * это тот же уход, в снимке остаётся первый момент.
   */
  async function secondLeaveDuringResume(g: ReturnType<typeof gatedDb>, firstAwayMs: number) {
    const load = jest.spyOn(abaResume, 'loadAbaResume');
    undo.push(() => load.mockRestore());
    await tick(100);
    const L1 = clock.now();
    await background();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L1)));
    await tick(firstAwayMs);
    g.close();
    await foreground();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await tick(1000);
    await background();
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    await g.open();
    await act(async () => undefined);
    expect(await snapshotAt()).toBe(iso(L1));
    return load;
  }

  it('с12а. быстрый двойной уход, пока идёт loadAbaResume: экран пуст, новая сессия не начата, следующий active продолжает один раз', async () => {
    const g = gatedDb();
    await toTrial();
    const sample = stimOf('aba-sample');
    const before = (await snapshot())!;
    const load = await secondLeaveDuringResume(g, 10_000);
    // первый возврат устарел: кадра нет, снимок той же сессии
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.queryByTestId('aba-sample')).toBeNull();
    expect(screen.queryByTestId('aba-card-training')).toBeNull();
    expect((await snapshot())!.sessionId).toBe(before.sessionId);
    expect(await count('aba_sessions')).toBe(0);
    await tick(10_000);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(load).toHaveBeenCalledTimes(2);
    expect(stimOf('aba-sample')).toBe(sample);
    expect((await snapshot())!.sessionId).toBe(before.sessionId);
    // продолжение одно: ответ записывается один раз, следующая проба одна
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    await tick(1000);
    expect(await count('aba_trials')).toBe(1);
    expect(await count('aba_sessions')).toBe(0);
  });

  it('с12б. быстрый двойной уход: фон первого ухода тоже не рабочее время', async () => {
    const g = gatedDb();
    await toTrial();
    const before = (await snapshot())!;
    await secondLeaveDuringResume(g, 10_000);
    await tick(10_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    // весь фон от первого ухода до возврата: 10 с, 1 с ожидания первого возврата и 10 с второго ухода
    expect((await snapshot())!.pausedMs).toBe(before.pausedMs + 21_000);
  });

  it('с13а. возврат с ошибкой: loadAbaResume бросает — кадр не остаётся пустым, итог app_error, стор сброшен', async () => {
    await toTrial();
    quietWarn();
    const load = jest.spyOn(abaResume, 'loadAbaResume').mockRejectedValueOnce(new Error('boom'));
    undo.push(() => load.mockRestore());
    await background();
    await tick(10_000);
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    expect(screen.queryByTestId('aba-away')).toBeNull();
    expect((await sessions()).map((r) => r.endReason)).toEqual(['app_error']);
    expect(await snapshot()).toBeNull();
    expect(useAbaRun.getState().config).toBeNull();
  });

  it('с13б. возврат с ошибкой в доступе: в журнале только выданный отрезок до ухода, фон в него не попадает', async () => {
    const { A } = await toAccess();
    await stepTo(A + 5000, 250);
    const L = clock.now();
    quietWarn();
    const load = jest.spyOn(abaResume, 'loadAbaResume').mockRejectedValueOnce(new Error('boom'));
    undo.push(() => load.mockRestore());
    await background();
    await tick(10_000);
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    expect(await accessEvents()).toEqual([{ kind: 'access', startedAt: iso(A), endedAt: iso(L) }]);
  });

  it('с13в. возврат с ошибкой: конец занятия — момент ухода, а не возврата', async () => {
    await toTrial();
    quietWarn();
    spied(jest.spyOn(abaResume, 'loadAbaResume')).mockRejectedValueOnce(new Error('boom'));
    await tick(100);
    const L = clock.now();
    await background();
    await tick(10_000);
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    expect((await sessions())[0]).toMatchObject({ endReason: 'app_error', endedAt: iso(L) });
  });

  it('с14а. reinforcerId === null на шаге доступа: нейтральный конец app_error, пустого экрана нет', async () => {
    await snapshotAtTrial(60_000, (s) => ({ ...s, reinforcerId: null, queue: [{ kind: 'access', durationMs: 20_000 }, ...s.queue], accessStartedAt: null }) as AbaSessionState);
    await mount();
    await waitFor(() => expect(ended()).toBe(true));
    expect(screen.queryByTestId('aba-exchange')).toBeNull();
    expect(accessPlay()).toBe(false);
    const [row] = await sessions();
    expect(row.endReason).toBe('app_error');
    expect(row.events.filter((e) => e.kind === 'access')).toEqual([]);
    expect(await snapshot()).toBeNull();
    expect(useAbaRun.getState().config).toBeNull();
  });

  it('с14б. конец с полной доской без подкрепителя: хвост не проигрывается — сразу «Закончили», итог записан', async () => {
    await fullBoardOfThree();
    await snapshotAtTrial(60_000, (s) => ({ ...s, reinforcerId: null, queue: [], endReason: 'assent_withdrawn' }) as AbaSessionState);
    await mount();
    await waitFor(() => expect(ended()).toBe(true));
    expect(screen.queryByTestId('aba-exchange')).toBeNull();
    expect(accessPlay()).toBe(false);
    expect(await count('aba_sessions')).toBe(1);
    await tailRowsAre(1);
    expect((await tails())[0]).toMatchObject({ completed: true, accessScene: [] });
  });

  it('с15. возврат через 2–30 минут на пробе обучения: после выбора — высоковероятная проба другой освоенной цели, затем та проба', async () => {
    const two = ABA_TARGETS.find((x) => x.id === 'match-same-2')!;
    const three = ABA_TARGETS.find((x) => x.id === 'match-same-3')!;
    const states = {
      [two.id]: { ...initialTargetState(two), phase: 'mastered' as const, startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const, masteredConfig: 'with_adult' as const, masteredBy: 'criterion' as const, lastMaintenanceSessionIndex: 0 },
      [three.id]: { ...initialTargetState(three), phase: 'acquisition' as const, startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const },
    };
    const at = iso(clock.now());
    await asAbaWriter(db, KID, async (tx) => {
      await saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 3 }, at);
      await saveChildState(tx, KID, 'abaTargets', states, at);
    });
    await toTrial();
    type Planned = { kind: string; targetId: string };
    const head = async () => ((await snapshot())!.queue[0] as unknown as { trial: Planned }).trial;
    // разогрев — высоковероятные пробы: при них вставки нет, идём до пробы обучения
    for (let n = 0; (await head()).kind === 'high_p'; n += 1) {
      expect(n).toBeLessThan(5);
      await answerRight();
      await waitFor(async () => expect(await count('aba_trials')).toBe(n + 1));
      await tickUntil(() => !inTrial(), 20, 10);
      await tickUntil(inTrial);
    }
    const done = await count('aba_trials');
    // в плане есть и базовые линии: важно, что это не высоковероятная проба и не освоенная цель
    const teaching = await head();
    expect(teaching.kind).not.toBe('high_p');
    expect(teaching.targetId).not.toBe(two.id);
    await background();
    await tick(5 * 60_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-choice')).toBeTruthy());
    await chooseFirst();
    await waitFor(() => expect(inTrial()).toBe(true));
    expect(await head()).toMatchObject({ kind: 'high_p', targetId: two.id });
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(done + 1));
    const rows = await db.all<{ body: string }>('SELECT body FROM aba_trials WHERE child_id = ? ORDER BY rowid', [KID]);
    expect(JSON.parse(rows[rows.length - 1].body)).toMatchObject({ kind: 'high_p', targetId: two.id });
    await tickUntil(() => !inTrial(), 20, 10);
    await tickUntil(inTrial);
    // высоковероятная проба одна: дальше — та проба обучения, на которой свернули
    expect(await head()).toEqual(expect.objectContaining({ targetId: teaching.targetId, kind: teaching.kind }));
  });

  it('с16а. пока свёрнуто, нет ни звука, ни нового шага: просроченный срок последствия не срабатывает, таймеров экрана нет', async () => {
    await acquisitionAtL0(2);
    await toTrial();
    await answerRight();
    await waitFor(() => expect(screen.getByTestId('aba-reinforcement')).toBeTruthy());
    await tick(0);
    const say = jest.spyOn(voice, 'say');
    undo.push(() => say.mockRestore());
    const L = clock.now();
    await background();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L)));
    expect(clock.pending()).toBe(0);
    const before = (await snapshot())!;
    await tick(90_000);
    await act(async () => undefined);
    expect(say).not.toHaveBeenCalled();
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.queryByTestId('aba-reinforcement')).toBeNull();
    // нового шага нет: снимок и журнал стоят
    expect(await snapshotAt()).toBe(iso(L));
    expect((await snapshot())!.queue).toEqual(before.queue);
    expect(await count('aba_trials')).toBe(1);
    await foreground();
    await tickUntil(inTrial);
    // плашка на возврате не повторяется, звук жетона тоже
    expect(screen.queryByTestId('aba-reinforcement')).toBeNull();
    expect(say).not.toHaveBeenCalledWith('abaSession.sound.token');
  });

  it('с16б. перерыв не начинается в фоне: просьба на плашке лежит в очереди, начало перерыва — момент возврата', async () => {
    await acquisitionAtL0(2);
    await toTrial();
    await answerRight();
    await waitFor(() => expect(screen.getByTestId('aba-reinforcement')).toBeTruthy());
    await tick(0);
    await fireEvent.press(screen.getByTestId('aba-break-card'), { nativeEvent: { pageX: 0, pageY: 0, identifier: 0 } });
    const L = clock.now();
    await background();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L)));
    await tick(60_000);
    const s = (await snapshot())!;
    expect([s.queue[0].kind, s.breakStartedAt]).toEqual(['break', null]);
    expect(screen.queryByTestId('aba-break')).toBeNull();
    const R = clock.now();
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    const after = (await snapshot())!;
    expect(after.breakStartedAt).toBe(R);
    // кольцо целиком: фон не съел перерыв
    const maxMs = CHILD_BREAK_MS[after.band];
    await stepTo(R + maxMs - 1, 1000);
    expect(border()).toBe(ABA_CONTROL_STROKE);
    await stepTo(R + maxMs);
    expect(border()).toBe(6);
  });

  it('с16в. приглашение не звучит в фоне: перерыв на кольце, срок прошёл, пока свёрнуто, — сигнала и конца по бездействию нет', async () => {
    const { maxMs } = await breakInTrialThenBackground();
    const say = jest.spyOn(voice, 'say');
    undo.push(() => say.mockRestore());
    await tick(maxMs + 30_000);
    expect(say).not.toHaveBeenCalled();
    expect(await count('aba_sessions')).toBe(0);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
  });

  // --- ветки старта, возврата, ухода и разбора ошибок вне брифа: снимки и сервисы настоящие, подмены — только там, где
  // ошибку иначе не вызвать

  /** `loadAbaResume` держится до `open()`: старт или возврат стоит на чтении снимка. */
  function gatedLoad() {
    let release = () => undefined as void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const real = abaResume.loadAbaResume;
    const spy = jest.spyOn(abaResume, 'loadAbaResume').mockImplementation(async (...args) => {
      await gate;
      return real(...args);
    });
    undo.push(() => {
      release();
      spy.mockRestore();
    });
    return { spy, open: () => act(async () => release()) };
  }
  /** Подмена на время теста: снимается и после падения. */
  function spied<T extends { mockRestore: () => void }>(spy: T): T {
    undo.push(() => spy.mockRestore());
    return spy;
  }
  /** Экран действительно поймал конфликт доски: тест не прошёл мимо него. */
  const caughtConflict = (warn: jest.SpyInstance) => warn.mock.calls.some(([, e]) => e instanceof AbaBoardConflictError);
  /** Рутина сменила доску: версия в базе на единицу впереди снимка, следующая запись экрана — конфликт. */
  const bumpBoard = async (earned = 0) => {
    const s = (await snapshot())!;
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaBoard', { earned, nonContingent: 0, rev: s.boardRev + 1 }, iso(clock.now())));
  };
  const revoke = () =>
    revokeAbaProcessing(
      db,
      { id: '00000000-0000-4000-8000-0000000000c1', scope: 'aba_processing', action: 'revoke', childId: KID, textVersion: abaConsentTextVersion('ru'), confirmedBy: 'pin', actorId: 'acc', at: iso(clock.now()) },
      'owner',
    );
  const inChoice = () => screen.queryByTestId('aba-choice') !== null;
  const reinforcerCards = () => screen.getAllByTestId(/^aba-reinforcer-(?!stub)/).map((n) => String(n.props.testID));
  /** Выбор на экране: первая карточка, кадр выбора уходит. */
  const pickFirstCard = async () => {
    await fireEvent.press(screen.getAllByTestId(/^aba-reinforcer-(?!stub)/)[0]);
  };
  /** Ячейки доски на «Закончили»: `true` — с жетоном. */
  type Node = { type: string; children: (Node | string)[] };
  const hasToken = (n: Node | string): boolean => typeof n !== 'string' && (n.type === 'RNSVGPath' || n.children.some(hasToken));
  const endBoardFilled = () => (screen.getByTestId('aba-end-board').children as unknown as Node[]).map(hasToken);

  it('к1г. экран размонтирован, пока идёт старт: занятие не стартует и ничего не пишет', async () => {
    const g = gatedLoad();
    await mount();
    await waitFor(() => expect(g.spy).toHaveBeenCalled());
    await screen.unmount();
    await g.open();
    await act(async () => undefined);
    expect(await snapshot()).toBeFalsy();
    expect(await count('aba_sessions')).toBe(0);
  });

  it('к1в. контроль: то же ожидание чтения снимка без второго измерения — занятие стартует', async () => {
    const g = gatedLoad();
    await mount();
    await waitFor(() => expect(g.spy).toHaveBeenCalled());
    await g.open();
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
  });

  it('к1а. второе измерение окна, пока идёт старт: занятие стартует, а не остаётся на загрузке', async () => {
    const g = gatedLoad();
    await mount();
    await waitFor(() => expect(g.spy).toHaveBeenCalled());
    await layout(700);
    await g.open();
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
  });

  it('к1б. «уменьшить движение» пришло, пока идёт старт: занятие стартует, а не остаётся на загрузке', async () => {
    const reduce = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;
    let answer = (_v: boolean) => undefined as void;
    reduce.mockImplementation(() => new Promise<boolean>((r) => (answer = r)));
    undo.push(() => reduce.mockImplementation(() => Promise.resolve(false)));
    const g = gatedLoad();
    await mount();
    await waitFor(() => expect(g.spy).toHaveBeenCalled());
    await act(async () => answer(true));
    await g.open();
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
  });

  it('к2а. холодный старт со снимком 31 мин назад: на карту без экрана конца, итог моментом ухода, новой сессии нет', async () => {
    await snapshotAtTrial(31 * 60_000);
    const leftAt = clock.now() - 31 * 60_000;
    await mount();
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
    expect(ended()).toBe(false);
    expect(screen.queryByTestId('aba-card-training')).toBeNull();
    const rows = await sessions();
    expect(rows).toHaveLength(1);
    expect([rows[0].endReason, rows[0].endedAt]).toEqual(['app_backgrounded', iso(leftAt)]);
    expect(await snapshot()).toBeNull();
    expect(useAbaRun.getState().config).toBeNull();
  });

  it('к2б. холодный старт со снимком под паузой: спокойный конец без записи и без доски, снимок на месте', async () => {
    await snapshotAtTrial(60_000);
    expect(await setAbaPaused(db, KID, true, iso(clock.now()))).toBe('saved');
    await mount();
    await waitFor(() => expect(ended()).toBe(true));
    expect(screen.queryByTestId('aba-end-board')).toBeNull();
    expect(await count('aba_sessions')).toBe(0);
    expect(await snapshot()).toBeTruthy();
    expect(useAbaRun.getState().config).toBeNull();
  });

  it('к2в. холодный старт: чтение снимка бросает — спокойный конец, снимок на месте, итога нет', async () => {
    await snapshotAtTrial(60_000);
    quietWarn();
    spied(jest.spyOn(abaResume, 'loadAbaResume')).mockRejectedValueOnce(new Error('boom'));
    await mount();
    await waitFor(() => expect(ended()).toBe(true));
    expect(await count('aba_sessions')).toBe(0);
    expect(await snapshot()).toBeTruthy();
    expect(useAbaRun.getState().config).toBeNull();
  });

  it('к2г. ошибка на старте после начала сессии (план обучения карточке): одна запись app_error, стор сброшен', async () => {
    quietWarn();
    spied(jest.spyOn(commit, 'loadBreakCardPlan')).mockRejectedValueOnce(new Error('boom'));
    await mount();
    await waitFor(() => expect(ended()).toBe(true));
    expect(screen.queryByTestId('aba-card-training')).toBeNull();
    expect((await sessions()).map((r) => r.endReason)).toEqual(['app_error']);
    expect(await snapshot()).toBeNull();
    expect(useAbaRun.getState().config).toBeNull();
  });

  it('к2д. холодный старт: закрытие просроченного снимка бросает — спокойный конец, снимок ждёт родителя', async () => {
    await snapshotAtTrial(31 * 60_000);
    quietWarn();
    spied(jest.spyOn(abaStart, 'abandonInProgressSession')).mockRejectedValueOnce(new Error('boom'));
    await mount();
    await waitFor(() => expect(ended()).toBe(true));
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(await count('aba_sessions')).toBe(0);
    expect(await snapshot()).toBeTruthy();
  });

  it('к3а. родитель закрыл занятие, пока свёрнуто (снимка нет, согласие живо): спокойный конец, новая сессия не начинается', async () => {
    await toTrial();
    const L = clock.now();
    await background();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L)));
    expect(await finishInProgressSession(db, KID, clock.now())).toBe(true);
    await tick(10_000);
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    expect(screen.queryByTestId('aba-card-training')).toBeNull();
    expect(inChoice()).toBe(false);
    // доска видна как есть (Ц2.10): конец идёт по прежнему состоянию, а не через сбой разбора пустого снимка
    expect(screen.getByTestId('aba-end-board')).toBeTruthy();
    expect((await sessions()).map((r) => r.endReason)).toEqual(['adult_stopped']);
    expect(await snapshot()).toBeNull();
  });

  it('к3б. база закрылась, пока свёрнуто: спокойный конец, кадр не остаётся пустым', async () => {
    await toTrial();
    const L = clock.now();
    await background();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L)));
    await act(async () => useAccount.setState({ db: null }));
    await tick(10_000);
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    expect(screen.queryByTestId('aba-away')).toBeNull();
    expect(useAbaRun.getState().config).toBeNull();
  });

  it('к3в. возврат после 31 мин: закрытие просроченного бросает — кадр не пустой, итог app_error', async () => {
    await toTrial();
    quietWarn();
    spied(jest.spyOn(abaStart, 'abandonInProgressSession')).mockRejectedValueOnce(new Error('boom'));
    await background();
    await tick(31 * 60_000);
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    expect(screen.queryByTestId('aba-away')).toBeNull();
    expect((await sessions()).map((r) => r.endReason)).toEqual(['app_error']);
    expect(await snapshot()).toBeNull();
  });

  it('к3г. уход, возврат и снова уход, пока ещё пишется снимок первого ухода: первый возврат устарел, в снимке первый уход, следующий возврат продолжает один раз', async () => {
    const g = gatedDb();
    await toTrial();
    const sample = stimOf('aba-sample');
    const load = spied(jest.spyOn(abaResume, 'loadAbaResume'));
    await tick(100);
    const L1 = clock.now();
    g.close();
    await background();
    await tick(10_000);
    await foreground();
    await tick(1000);
    await background();
    await g.open();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L1)));
    // возврат до `loadAbaResume` не дошёл: кадра нет, снимок читать незачем
    expect(load).not.toHaveBeenCalled();
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    await tick(10_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(load).toHaveBeenCalledTimes(1);
    expect(stimOf('aba-sample')).toBe(sample);
    expect(await count('aba_sessions')).toBe(0);
  });

  it('к3д. снимок на уходе не записался: возврат не остаётся пустым, та же проба, итога нет', async () => {
    await toTrial();
    quietWarn();
    const sample = stimOf('aba-sample');
    spied(jest.spyOn(abaResume, 'markAbaSessionLeft')).mockRejectedValueOnce(new Error('boom'));
    await background();
    await tick(10_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(stimOf('aba-sample')).toBe(sample);
    expect(await count('aba_sessions')).toBe(0);
  });

  it('к3е. конфликт доски на записи ухода: один повтор, момент ухода в снимке (план, шаг 7)', async () => {
    await toTrial();
    await bumpBoard();
    quietWarn();
    await tick(100);
    const L = clock.now();
    await background();
    await tick(0);
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L)));
  });

  it('к3ж. уход на кадре обмена, возврат через 5 минут: обмен заново, доступ целиком, новый выбор — после доступа', async () => {
    await toExchange();
    await tick(500);
    await background();
    await tick(5 * 60_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    expect(inChoice()).toBe(false);
    await tickUntil(accessPlay, 20, 200);
    const O = clock.now();
    await stepTo(O + EXCHANGE_ACCESS_MS[1], 250);
    await tickUntil(inChoice, 250, 40);
    await chooseFirst();
    await tickUntil(inTrial, 250, 40);
    await holdExit();
    expect(await accessEvents()).toEqual([{ kind: 'access', startedAt: iso(O), endedAt: iso(O + EXCHANGE_ACCESS_MS[1]) }]);
  });

  it('к3з. возврат в перерыве через 5 минут (а5): сначала выбор, затем перерыв с приглашением; бездействие — от показа кадра', async () => {
    const { startedAt } = await breakInTrialThenBackground();
    await tick(5 * 60_000);
    await foreground();
    await waitFor(() => expect(inChoice()).toBe(true));
    expect(screen.queryByTestId('aba-break')).toBeNull();
    await pickFirstCard();
    await tickUntil(() => screen.queryByTestId('aba-break') !== null, 20, 100);
    const shown = clock.now();
    expect(border()).toBe(6);
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    expect((await snapshot())!.breakStartedAt).toBe(startedAt);
    await stepTo(shown + 2 * RETURN_INVITE_AFTER_MS - 1, 1000);
    expect(screen.getByTestId('aba-break')).toBeTruthy();
    expect(await count('aba_sessions')).toBe(0);
    await stepTo(shown + 2 * RETURN_INVITE_AFTER_MS);
    await waitFor(() => expect(ended()).toBe(true));
  });

  it('к3и. возврат в доступе через 5 минут: кадр конца, затем новый выбор и проба; отрезок один, до ухода', async () => {
    const { A } = await toAccess();
    await stepTo(A + 5000, 250);
    const L = clock.now();
    await background();
    await tick(5 * 60_000);
    const R = clock.now();
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-access-hold')).toBeTruthy());
    expect(inChoice()).toBe(false);
    await stepTo(R + 1000);
    await tickUntil(inChoice, 250, 40);
    await chooseFirst();
    await tickUntil(inTrial, 250, 40);
    await holdExit();
    expect(await accessEvents()).toEqual([{ kind: 'access', startedAt: iso(A), endedAt: iso(L) }]);
  });

  it('к3к. уход в тихой паузе после «Отказ», срок не вышел: кадр паузы на возврате, закрыта своим сроком от начала, а не от возврата', async () => {
    await fullBoardOfThree();
    await toTrial();
    await tick(500);
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(screen.getByTestId('aba-refusal-pause')).toBeTruthy());
    const P = clock.now();
    await tick(1000);
    await background();
    await tick(5000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-refusal-pause')).toBeTruthy());
    await stepTo(P + REFUSAL_QUIET_MS - 1, 1000);
    expect(screen.getByTestId('aba-refusal-pause')).toBeTruthy();
    await stepTo(P + REFUSAL_QUIET_MS);
    await waitFor(async () => expect((await snapshot())!.breakStartedAt).toBeNull());
    const events = (await snapshot())!.events as { kind: string; startedAt?: string; endedAt?: string }[];
    expect(events.filter((e) => e.kind === 'break')).toEqual([expect.objectContaining({ startedAt: iso(P), endedAt: iso(P + REFUSAL_QUIET_MS) })]);
  });

  it('к3л. тихая пауза истекла, фон 5 минут: новый выбор, кадра паузы нет, закрыта своим сроком', async () => {
    await fullBoardOfThree();
    await toTrial();
    await tick(500);
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(screen.getByTestId('aba-refusal-pause')).toBeTruthy());
    const P = clock.now();
    await background();
    await tick(5 * 60_000);
    await foreground();
    await waitFor(() => expect(inChoice()).toBe(true));
    await pickFirstCard();
    await tick(800);
    expect(screen.queryByTestId('aba-refusal-pause')).toBeNull();
    await waitFor(async () => expect((await snapshot())!.breakStartedAt).toBeNull());
    const events = (await snapshot())!.events as { kind: string; startedAt?: string; endedAt?: string }[];
    expect(events.filter((e) => e.kind === 'break')).toEqual([expect.objectContaining({ startedAt: iso(P), endedAt: iso(P + REFUSAL_QUIET_MS) })]);
  });

  it('к3м. обучающий перерыв после возврата: второе приглашение сессию не кончает, возврат — за взрослым (№169 п. 3)', async () => {
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    await tick(1000);
    await fireEvent.press(screen.getByTestId('aba-break-card'));
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    const maxMs = CHILD_BREAK_MS[(await snapshot())!.band];
    await tick(1000);
    await background();
    await tick(maxMs + 10_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    const R = clock.now();
    expect(border()).toBe(6);
    await stepTo(R + RETURN_INVITE_AFTER_MS, 1000);
    await tick(10 * RETURN_INVITE_AFTER_MS);
    expect(screen.getByTestId('aba-break')).toBeTruthy();
    expect(await count('aba_sessions')).toBe(0);
    await fireEvent.press(screen.getByTestId('aba-break-return'));
    await waitFor(() => expect(screen.getByTestId('aba-panel-caption').props.children).toBe('Покажите на неё жестом'));
  });

  it('к3н. уход на обучении карточке (а9): тёплый возврат — та же возможность, она не засчитана, всего их три', async () => {
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    const caption = screen.getByTestId('aba-panel-caption').props.children as string;
    await tick(500);
    await background();
    await tick(90_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    expect(screen.getByTestId('aba-panel-caption').props.children).toBe(caption);
    await skipCardTraining();
    await waitFor(() => expect(inChoice()).toBe(true));
  });

  it('к3о. обучение карточке, холодный старт (а9): не повторяется, сразу выбор подкрепителя', async () => {
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-panel-l4_skipped'));
    await waitFor(async () => expect(await snapshot()).toBeTruthy());
    await kill(5000);
    await mount();
    await waitFor(() => expect(inChoice()).toBe(true));
    expect(screen.queryByTestId('aba-card-training')).toBeNull();
    expect(await count('aba_sessions')).toBe(0);
  });

  it('к3п. уход на экране выбора (а3, огр. 5): выбор заново, те же варианты на тех же местах', async () => {
    await mount();
    await skipCardTraining();
    await waitFor(() => expect(inChoice()).toBe(true));
    const cards = reinforcerCards();
    await tick(500);
    await background();
    await tick(90_000);
    await foreground();
    await waitFor(() => expect(inChoice()).toBe(true));
    expect(reinforcerCards()).toEqual(cards);
    expect(await count('aba_reinforcer_choices')).toBe(0);
  });

  it.each([
    ['90 с', 90_000],
    ['5 минут', 5 * 60_000],
  ] as const)('к3р. уход на кадре нового выбора, возврат через %s (а3, огр. 5): те же варианты на тех же местах, выбор один', async (_name, ms) => {
    await toTrial();
    await background();
    await tick(5 * 60_000);
    await foreground();
    await waitFor(() => expect(inChoice()).toBe(true));
    const cards = reinforcerCards();
    const chosen = await count('aba_reinforcer_choices');
    await tick(500);
    await background();
    await tick(ms);
    await foreground();
    await waitFor(() => expect(inChoice()).toBe(true));
    expect(reinforcerCards()).toEqual(cards);
    expect(await count('aba_reinforcer_choices')).toBe(chosen);
  });

  it('к3с. «Сам», новый выбор после 5 минут (а3): 60 с от показа без касания — abandoned, нейтральный конец', async () => {
    const two = ABA_TARGETS.find((x) => x.id === 'match-same-2')!;
    const three = ABA_TARGETS.find((x) => x.id === 'match-same-3')!;
    const states = {
      [two.id]: { ...initialTargetState(two), phase: 'mastered' as const, startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const, masteredConfig: 'with_adult' as const, masteredBy: 'criterion' as const, lastMaintenanceSessionIndex: 0 },
      [three.id]: { ...initialTargetState(three), phase: 'acquisition' as const, startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const },
    };
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaTargets', states, iso(clock.now())));
    useAbaRun.getState().set({ config: 'alone', observers: [], primaryObserverId: null });
    await mount();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    await background();
    await tick(5 * 60_000);
    await foreground();
    await waitFor(() => expect(inChoice()).toBe(true));
    const R = clock.now();
    await stepTo(R + 60_000 - 1, 1000);
    expect(inChoice()).toBe(true);
    expect(await count('aba_sessions')).toBe(0);
    await stepTo(R + 60_000);
    await tickUntil(ended);
    expect((await sessions()).map((r) => r.endReason)).toEqual(['abandoned']);
  });

  it('к3т. уход на кадре конца доступа (после T): на возврате кадр конца, в журнале отрезок до T, а не до ухода', async () => {
    const { A } = await toAccess();
    const T = A + EXCHANGE_ACCESS_MS[1];
    await stepTo(T + 500, 100);
    await background();
    await tick(10_000);
    const R = clock.now();
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-access-hold')).toBeTruthy());
    expect(screen.queryByTestId('aba-access-ring', HIDDEN)).toBeNull();
    await stepTo(R + 1000);
    await tickUntil(inTrial, 250, 40);
    await holdExit();
    expect(await accessEvents()).toEqual([{ kind: 'access', startedAt: iso(A), endedAt: iso(T) }]);
  });

  it('к3у. след просьбы о перерыве не переживает уход (огр. 7): на обмене после возврата карточки-следа нет', async () => {
    await acquisitionAtL0(1);
    await toTrial();
    await answerRight();
    await waitFor(() => expect(screen.getByTestId('aba-reinforcement')).toBeTruthy());
    await tick(0);
    await fireEvent.press(screen.getByTestId('aba-break-card'), { nativeEvent: { pageX: 0, pageY: 0, identifier: 0 } });
    await background();
    await tick(30_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    expect(screen.queryByTestId('aba-break-trace')).toBeNull();
  });

  it('к3ф. пауза перед SD после возврата (поправка Д): проба входит через паузу, SD — в свой срок от показа', async () => {
    await snapshotAtTrial(60_000, (s) => ({ ...s, pendingPauseMs: 1500 }));
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-match-field')).toBeTruthy());
    const R = clock.now();
    expect(screen.queryByTestId('aba-instruction')).toBeNull();
    await stepTo(R + 1499, 250);
    expect(screen.queryByTestId('aba-instruction')).toBeNull();
    await stepTo(R + 1500);
    await waitFor(() => expect(screen.getByTestId('aba-instruction')).toBeTruthy());
  });

  it('к3х. первый кадр пробы после возврата отсчитывает от возврата (огр. 1): показ SD в записи пробы — момент возврата, не исходный', async () => {
    await toTrial();
    await tick(1000);
    await background();
    await tick(90_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    const R = clock.now();
    await tick(700);
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    const [row] = await db.all<{ body: string }>('SELECT body FROM aba_trials WHERE child_id = ?', [KID]);
    const log = (JSON.parse(row.body) as { presentationLog: { startedAt: string }[] }).presentationLog;
    expect(log[0].startedAt).toBe(iso(R));
  });

  it('к4а. inactive (шторка, звонок) — не уход: кадр стоит, снимок не трогается', async () => {
    await toTrial();
    const at = await snapshotAt();
    await act(async () => handlers.forEach((h) => h('inactive')));
    await tick(1000);
    await act(async () => handlers.forEach((h) => h('active')));
    await act(async () => undefined);
    expect(screen.getByTestId('aba-sample')).toBeTruthy();
    expect(screen.queryByTestId('aba-away')).toBeNull();
    expect(await snapshotAt()).toBe(at);
  });

  it('к4б. второй background подряд момент ухода не двигает', async () => {
    await toTrial();
    const before = (await snapshot())!;
    const L = clock.now();
    await background();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L)));
    await tick(1000);
    await background();
    await tick(1000);
    await act(async () => undefined);
    expect(await snapshotAt()).toBe(iso(L));
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect((await snapshot())!.pausedMs).toBe(before.pausedMs + 2000);
  });

  it('к4б-2. контроль: кадр показан между уходами — второй уход это новый момент ухода', async () => {
    await toTrial();
    await background();
    await tick(1000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    await tick(1000);
    const L2 = clock.now();
    await background();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L2)));
  });

  it('к4в. уход на «Закончили»: экран стоит, новой строки хвоста нет, возврат ничего не меняет', async () => {
    await toTailExchange();
    await tickUntil(ended);
    await tailRowsAre(1);
    await background();
    expect(screen.queryByTestId('aba-away')).toBeNull();
    expect(ended()).toBe(true);
    await tick(5 * 60_000);
    await foreground();
    expect(ended()).toBe(true);
    expect(await tails()).toHaveLength(1);
    expect(await count('aba_sessions')).toBe(1);
  });

  it('к4г. размонтирование снимает подписку на AppState', async () => {
    await toTrial();
    expect(handlers.length).toBeGreaterThan(0);
    await screen.unmount();
    expect(handlers).toEqual([]);
  });

  it('к4д. уход, пока следующий шаг ждёт запись просьбы о перерыве: перерыв не начинается в фоне', async () => {
    const g = gatedDb();
    await acquisitionAtL0(2);
    await toTrial();
    await answerRight();
    await waitFor(() => expect(screen.getByTestId('aba-reinforcement')).toBeTruthy());
    const M = clock.now();
    await tick(0);
    g.close();
    await fireEvent.press(screen.getByTestId('aba-break-card'), { nativeEvent: { pageX: 0, pageY: 0, identifier: 0 } });
    await stepTo(M + 5000, 100);
    const L = clock.now();
    await background();
    await g.open();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L)));
    const s = (await snapshot())!;
    expect([s.queue[0].kind, s.breakStartedAt]).toEqual(['break', null]);
    expect(screen.queryByTestId('aba-break')).toBeNull();
    expect(screen.getByTestId('aba-away')).toBeTruthy();
  });

  it.each<[string, () => Promise<unknown>]>([
    ['пауза родителя', () => setAbaPaused(db, KID, true, iso(clock.now()))],
    ['отзыв согласия', () => revoke()],
  ])('к5а. %s во время пробы на экране: запись ответа не проходит — спокойный конец без записи, плашки нет', async (_name, block) => {
    await toTrial();
    quietWarn();
    await block();
    await answerRight();
    await waitFor(() => expect(ended()).toBe(true));
    expect(screen.queryByTestId('aba-reinforcement')).toBeNull();
    expect(await count('aba_sessions')).toBe(0);
    expect(await count('aba_trials')).toBe(0);
    expect(useAbaRun.getState().config).toBeNull();
  });

  it('к5б. пауза, пока запись пробы ждёт, а приложение свёрнуто: конец без записи; на возврате «Закончили», хвоста нет', async () => {
    const g = gatedDb();
    await toTrial();
    quietWarn();
    g.close();
    await answerRight();
    await background();
    expect(await setAbaPaused(db, KID, true, iso(clock.now()))).toBe('saved');
    await g.open();
    await tick(10_000);
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    expect(await tails()).toEqual([]);
    expect(await count('aba_sessions')).toBe(0);
    expect(await count('aba_trials')).toBe(0);
  });

  it('к5в. конфликт доски на записи выбора подкрепителя: живая доска и повтор, выбор записан, проба на экране (план, д: в любой записи)', async () => {
    await mount();
    await skipCardTraining();
    await waitFor(() => expect(inChoice()).toBe(true));
    await bumpBoard();
    quietWarn();
    await chooseFirst();
    await tickUntil(() => inTrial() || ended(), 250, 40);
    expect(ended()).toBe(false);
    expect(await count('aba_reinforcer_choices')).toBe(1);
  });

  it('к5г. конфликт доски в «Отказ» вне пробы: живая доска и повтор, отказ записан (план, д: в любой записи)', async () => {
    await toTrial();
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    await bumpBoard();
    quietWarn();
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await tickUntil(() => ended() || screen.queryByTestId('aba-end-wait') !== null, 250, 40);
    expect((await sessions()).map((r) => r.endReason)).toEqual(['assent_withdrawn']);
  });

  it('к5д. повторы конфликта считаются на сессию, а не на действие: третий конфликт в третьей пробе — спокойный конец', async () => {
    await acquisitionAtL0(2);
    await toTrial();
    quietWarn();
    const spy = spied(jest.spyOn(commit, 'recordAbaTrial'));
    for (let i = 1; i <= 2; i += 1) {
      spy.mockRejectedValueOnce(new AbaBoardConflictError(0, 1));
      await fireEvent.press(screen.getByTestId('aba-panel-adult_prompted'));
      await answerRight();
      await waitFor(async () => expect(await count('aba_trials')).toBe(i));
      await waitFor(() => expect(inTrial()).toBe(false));
      await tickUntil(inTrial);
    }
    spy.mockRejectedValueOnce(new AbaBoardConflictError(0, 1));
    await fireEvent.press(screen.getByTestId('aba-panel-adult_prompted'));
    await answerRight();
    await waitFor(() => expect(ended()).toBe(true));
    expect(await count('aba_trials')).toBe(2);
    expect(await count('aba_sessions')).toBe(0);
    expect(await snapshot()).toBeTruthy();
  });

  it('к5е. конфликт доски на «Вернуться»: повтор, одно событие break, дальше проба', async () => {
    await toTrial();
    await tick(500);
    await fireEvent.press(screen.getByTestId('aba-break-card'));
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    await tick(1000);
    await bumpBoard();
    const warn = quietWarn();
    await fireEvent.press(screen.getByTestId('aba-break-return'));
    await tickUntil(inTrial, 250, 40);
    expect(caughtConflict(warn)).toBe(true);
    expect(((await snapshot())!.events as { kind: string }[]).filter((e) => e.kind === 'break')).toHaveLength(1);
    expect(await count('aba_sessions')).toBe(0);
  });

  it('к5ж. конфликт доски в конце доступа: повтор, один отрезок в журнале, дальше проба', async () => {
    const { A } = await toAccess();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(A)));
    await bumpBoard();
    const warn = quietWarn();
    const T = A + EXCHANGE_ACCESS_MS[1];
    await stepTo(T, 250);
    await tickUntil(inTrial, 250, 40);
    expect(caughtConflict(warn)).toBe(true);
    await holdExit();
    expect(await accessEvents()).toEqual([{ kind: 'access', startedAt: iso(A), endedAt: iso(T) }]);
  });

  it('к5з. конфликт доски на снимке начала сцены: повтор, сцена идёт, снимок с началом доступа лёг', async () => {
    const S = await toExchange();
    await bumpBoard();
    const warn = quietWarn();
    await stepTo(S + 2020);
    expect(accessPlay()).toBe(true);
    await waitFor(async () => expect((await snapshot())!.accessStartedAt).toBe(S));
    expect(caughtConflict(warn)).toBe(true);
    expect(ended()).toBe(false);
  });

  it('к5и. конфликт на следующем шаге после удачной записи конца перерыва: сессия идёт дальше, ложного app_error нет', async () => {
    await toTrial();
    await tick(500);
    await fireEvent.press(screen.getByTestId('aba-break-card'));
    await waitFor(() => expect(screen.getByTestId('aba-break')).toBeTruthy());
    await tick(1000);
    quietWarn();
    const real = commit.saveAbaSessionStep;
    let n = 0;
    spied(jest.spyOn(commit, 'saveAbaSessionStep')).mockImplementation(async (...args) => {
      n += 1;
      if (n === 2) throw new AbaBoardConflictError(0, 1);
      return real(...args);
    });
    await fireEvent.press(screen.getByTestId('aba-break-return'));
    await tickUntil(() => inTrial() || ended(), 250, 40);
    expect((await sessions()).map((r) => r.endReason)).toEqual([]);
    expect(inTrial()).toBe(true);
  });

  it('к5к. конфликт на шаге перерыва после удачной записи прерванной пробы: перерыв, запись одна, ложного app_error нет', async () => {
    await toTrial();
    await tick(500);
    quietWarn();
    spied(jest.spyOn(commit, 'saveAbaSessionStep')).mockRejectedValueOnce(new AbaBoardConflictError(0, 1));
    await fireEvent.press(screen.getByTestId('aba-break-card'));
    await tickUntil(() => screen.queryByTestId('aba-break') !== null || ended(), 250, 40);
    expect((await sessions()).map((r) => r.endReason)).toEqual([]);
    expect(screen.getByTestId('aba-break')).toBeTruthy();
    expect(await count('aba_trials')).toBe(1);
  });

  it.each([
    ['пауза', () => new AbaPausedError(KID)],
    ['отзыв согласия', () => new AbaConsentRequiredError(KID)],
    ['прочая ошибка', () => new Error('boom')],
  ] as const)('к5л. итог конца не записался (%s): «Закончили» без хвоста, снимок на месте, стор сброшен', async (_name, error) => {
    await fullBoardOfThree();
    await toTrial();
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    quietWarn();
    spied(jest.spyOn(commit, 'commitAbaSession')).mockRejectedValue(error());
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(ended()).toBe(true));
    expect(screen.queryByTestId('aba-exchange')).toBeNull();
    expect(await count('aba_sessions')).toBe(0);
    expect(await tails()).toEqual([]);
    expect(await snapshot()).toBeTruthy();
    expect(useAbaRun.getState().config).toBeNull();
  });

  it('к5м. нейтральный конец после конфликта показывает живую доску (д): рутина дала два жетона — два в «Закончили»', async () => {
    await acquisitionAtL0(3);
    await toTrial();
    await bumpBoard(2);
    quietWarn();
    spied(jest.spyOn(commit, 'recordAbaTrial')).mockRejectedValue(new AbaBoardConflictError(0, 1));
    await answerRight();
    await waitFor(() => expect(ended()).toBe(true));
    expect(endBoardFilled()).toEqual([true, true, false]);
  });

  /** Плашка, запись просьбы о перерыве висит, выход удержанием уже сработал; `settle` доводит запись до конца. */
  async function exitWhileBreakIsWritten(settle: (ok: (s: AbaSessionState) => void, no: (e: Error) => void, state: AbaSessionState) => void) {
    await acquisitionAtL0(2);
    await toTrial();
    await answerRight();
    await waitFor(() => expect(screen.getByTestId('aba-reinforcement')).toBeTruthy());
    await tick(0);
    quietWarn();
    let finishWrite = () => undefined as void;
    spied(jest.spyOn(commit, 'saveAbaSessionStep')).mockImplementationOnce(
      (_db, _id, state) =>
        new Promise((ok, no) => {
          finishWrite = () => settle(ok, no, state);
        }),
    );
    await fireEvent.press(screen.getByTestId('aba-break-card'), { nativeEvent: { pageX: 0, pageY: 0, identifier: 0 } });
    await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
    await tick(1500);
    await act(async () => finishWrite());
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
  }

  it('к5н-контроль. выход удержанием, пока пишется просьба о перерыве, запись прошла: на карту', async () => {
    await exitWhileBreakIsWritten((ok, _no, state) => ok(state));
    expect((await sessions()).map((r) => r.endReason)).toEqual(['adult_stopped']);
  });

  it('к5н. выход удержанием, пока пишется просьба о перерыве, запись падает: на карту, экран не застывает', async () => {
    await exitWhileBreakIsWritten((_ok, no) => no(new Error('boom')));
  });

  it('к5о. уход, пока пишется итог, и итог не лёг (пауза): на возврате «Закончили», строк хвоста нет, снимок на месте', async () => {
    await fullBoardOfThree();
    await toTrial();
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    quietWarn();
    let release = () => undefined as void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const spy = spied(jest.spyOn(commit, 'commitAbaSession')).mockImplementation(async () => {
      await gate;
      throw new AbaPausedError(KID);
    });
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await background();
    await act(async () => release());
    await tick(30_000);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    expect(await tails()).toEqual([]);
    expect(await count('aba_sessions')).toBe(0);
    expect(await snapshot()).toBeTruthy();
  });

  it('к5п. конфликт доски на записи пробы, пока свёрнуто: повтор идёт в фоне без кадра, снимок ухода ложится после него', async () => {
    const g = gatedDb();
    await acquisitionAtL0(2);
    await toTrial();
    quietWarn();
    spied(jest.spyOn(commit, 'recordAbaTrial')).mockRejectedValueOnce(new AbaBoardConflictError(0, 1));
    g.close();
    await answerRight();
    const L = clock.now();
    await background();
    await g.open();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(L)));
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.queryByTestId('aba-reinforcement')).toBeNull();
    await tick(30_000);
    await foreground();
    await tickUntil(inTrial);
    expect(ended()).toBe(false);
    expect((await snapshot())!.trials).toHaveLength(1);
  });

  it('к5р. уход, пока пишется итог, конец с циклом сопряжения: строка хвоста wait, на возврате «Закончили», жетона цикла нет', async () => {
    await toTrial();
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    const g = gatedCommit();
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(g.spy).toHaveBeenCalled());
    const L = clock.now();
    await background();
    await g.open();
    await tailRowsAre(1);
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'wait', leftAt: iso(L), pairingTokenAt: null, completed: false });
    await tick(30_000);
    await foreground();
    await waitFor(() => expect(ended()).toBe(true));
    await tick(60_000);
    expect(screen.queryByTestId('aba-end-pairing')).toBeNull();
    expect(await tails()).toHaveLength(1);
  });

  // --- остановка перекрывает плановый конец, выход ждёт запись, конец без итога, уход на загрузке, кадр конца

  /** Закрывающая проба: план решил закончиться, доска полна, обмен в конце впереди. */
  const atClosingProbe =
    (reason: 'completed' | 'time_limit' = 'completed') =>
    (s: AbaSessionState): AbaSessionState => {
      const head = s.queue[0];
      if (head?.kind !== 'trial') throw new Error(`в голове очереди ${head?.kind}, а не проба`);
      return { ...s, endReason: reason, closingAttempts: 1, queue: [{ kind: 'trial', trial: { ...head.trial, kind: 'closing', closes: 'session' } }] };
    };
  const liveEarned = async () => ((await loadChildState(db, KID, 'abaBoard')) as { earned: number } | null)?.earned;
  const exchangeEvents = async () => (await sessions())[0].events.filter((e) => e.kind === 'exchange' || e.kind === 'pairing');

  it('з1. уход на закрывающей пробе, просрочка: жетоны не сгорают, обмена нет, момент ухода, на карту', async () => {
    await fullBoardOfThree();
    await snapshotAtTrial(60_000, atClosingProbe());
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    await tick(100);
    const L = clock.now();
    await background();
    await tick(31 * 60_000);
    await foreground();
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
    expect((await sessions())[0]).toMatchObject({ endReason: 'app_backgrounded', endedAt: iso(L), exchangesMade: 0 });
    expect(await exchangeEvents()).toEqual([]);
    expect(await liveEarned()).toBe(3);
    expect(await tails()).toEqual([]);
  });

  it.each(['completed', 'time_limit'] as const)('з2. холодный старт, просрочка на закрывающей пробе (%s): закрыта abandonInProgressSession, жетоны целы', async (planned) => {
    await fullBoardOfThree();
    await snapshotAtTrial(31 * 60_000, atClosingProbe(planned));
    const leftAt = clock.now() - 31 * 60_000;
    const close = spied(jest.spyOn(abaStart, 'abandonInProgressSession'));
    await mount();
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
    expect(close).toHaveBeenCalledTimes(1);
    expect((await sessions())[0]).toMatchObject({ endReason: 'app_backgrounded', endedAt: iso(leftAt), exchangesMade: 0 });
    expect(await exchangeEvents()).toEqual([]);
    expect(await liveEarned()).toBe(3);
    expect(await snapshot()).toBeNull();
  });

  it('з3. выход удержанием на закрывающей пробе: жетоны целы, причина adult_stopped', async () => {
    await fullBoardOfThree();
    await snapshotAtTrial(60_000, atClosingProbe());
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    await holdExit();
    expect((await sessions())[0]).toMatchObject({ endReason: 'adult_stopped', exchangesMade: 0 });
    expect(await liveEarned()).toBe(3);
  });

  it('з4. контроль: возврат до 2 минут на закрывающую пробу — проба досдаётся, в конце обмен и доступ', async () => {
    await fullBoardOfThree();
    await snapshotAtTrial(60_000, atClosingProbe());
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    await background();
    await tick(30_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    await answerRight();
    await tickUntil(() => screen.queryByTestId('aba-exchange') !== null, 100, 100);
    expect((await sessions())[0]).toMatchObject({ endReason: 'completed', exchangesMade: 1 });
    expect(await liveEarned()).toBe(0);
  });

  it('в1. выход удержанием, пока пишется проба: итог ждёт запись и содержит пробу', async () => {
    const g = gatedDb();
    await acquisitionAtL0(2);
    await toTrial();
    g.close();
    await answerRight();
    await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
    await tick(1500);
    expect(await count('aba_sessions')).toBe(0);
    expect(router.dismissTo).not.toHaveBeenCalled();
    await g.open();
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
    expect(await count('aba_trials')).toBe(1);
    expect((await sessions())[0]).toMatchObject({ endReason: 'adult_stopped', tokensEarned: 1 });
    expect(await snapshot()).toBeNull();
  });

  it('в2. выход удержанием на доступе хвоста: строка с шагом, моментом выхода и выданным отрезком', async () => {
    const A = await toTailAccess();
    await stepTo(A + 5000, 250);
    const X = clock.now() + 1500;
    await holdExit();
    await tailRowsAre(1);
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'access', leftAt: iso(X), completed: false, accessScene: [{ startedAt: iso(A), endedAt: iso(X) }] });
  });

  it('в3. выход удержанием на обмене хвоста: строка exchange, отрезков нет', async () => {
    await toTailExchange();
    const X = clock.now() + 1500;
    await holdExit();
    await tailRowsAre(1);
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'exchange', leftAt: iso(X), completed: false, accessScene: [] });
  });

  it('в4. выход удержанием на ожидании цикла сопряжения: строка wait, жетона нет', async () => {
    await toTrial();
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(screen.getByTestId('aba-end-wait')).toBeTruthy());
    await holdExit();
    await tailRowsAre(1);
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'wait', pairingTokenAt: null, completed: false, accessScene: [] });
  });

  it('в5. выход удержанием после севшего жетона цикла: строка pairing_token с моментом жетона', async () => {
    const t1 = await toPairingToken();
    await stepTo(t1 + 220);
    await holdExit();
    await tailRowsAre(1);
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'pairing_token', pairingTokenAt: iso(t1 + 220), completed: false });
  });

  it('в6. конфликт на несостоявшемся итоге: «Закончили» с живой доской, а не из памяти', async () => {
    await acquisitionAtL0(3);
    await toTrial();
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    quietWarn();
    const s = (await snapshot())!;
    let bumped = false;
    spied(jest.spyOn(commit, 'commitAbaSession')).mockImplementation(async () => {
      if (!bumped) {
        bumped = true;
        await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaBoard', { earned: 2, nonContingent: 0, rev: s.boardRev + 1 }, iso(clock.now())));
      }
      throw new AbaBoardConflictError(0, 1);
    });
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(ended()).toBe(true));
    expect(endBoardFilled()).toEqual([true, true, false]);
    expect(await count('aba_sessions')).toBe(0);
    expect(await snapshot()).toBeTruthy();
  });

  it('в7. запись пробы упала, пока свёрнуто: конец занятия — момент ухода, а не момент ошибки', async () => {
    await toTrial();
    quietWarn();
    let reject = () => undefined as void;
    spied(jest.spyOn(commit, 'recordAbaTrial')).mockImplementationOnce(
      () =>
        new Promise((_ok, no) => {
          reject = () => no(new Error('boom'));
        }),
    );
    await answerRight();
    await tick(100);
    const L = clock.now();
    await background();
    await tick(10_000);
    await act(async () => reject());
    await waitFor(async () => expect(await count('aba_sessions')).toBe(1));
    expect((await sessions())[0]).toMatchObject({ endReason: 'app_error', endedAt: iso(L) });
  });

  /** Что показывает `AppState.currentState` — как на устройстве; в моке React Native там функция, она и возвращается. */
  const appState = AppState as unknown as { currentState: unknown };
  const realAppState = appState.currentState;
  function appStateIs(state: AppStateStatus) {
    appState.currentState = state;
    undo.push(() => {
      appState.currentState = realAppState;
    });
  }
  /** Экран грузится (чтение снимка держится), приложение ушло в фон: подписка выключена, событие не слышно. */
  async function leaveWhileLoading() {
    const g = gatedLoad();
    await mount();
    await waitFor(() => expect(g.spy).toHaveBeenCalled());
    expect(screen.queryByTestId('aba-sample')).toBeNull();
    appStateIs('background');
    await background();
    await g.open();
    await waitFor(() => expect(screen.getByTestId('aba-away')).toBeTruthy());
  }

  it('ж1. уход во время загрузки: проба не идёт в фоне, no_response нет, active продолжает ту же пробу', async () => {
    await snapshotAtTrial(60_000);
    await leaveWhileLoading();
    expect(clock.pending()).toBe(0);
    await tick(60_000);
    expect(await count('aba_trials')).toBe(0);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    appStateIs('active');
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(screen.queryByTestId('aba-away')).toBeNull();
    expect(await count('aba_trials')).toBe(0);
    expect(await count('aba_sessions')).toBe(0);
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    const [row] = await db.all<{ body: string }>('SELECT body FROM aba_trials WHERE child_id = ?', [KID]);
    expect(JSON.parse(row.body).response).not.toBe('no_response');
  });

  it('ж2. уход во время загрузки новой сессии: первый кадр не идёт в фоне, active показывает его', async () => {
    await leaveWhileLoading();
    await tick(60_000);
    expect(screen.queryByTestId('aba-card-training')).toBeNull();
    expect(await count('aba_sessions')).toBe(0);
    appStateIs('active');
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    expect(await count('aba_sessions')).toBe(0);
  });

  it('ж3. контроль: вернулись до конца загрузки — кадр на экране, ухода не было', async () => {
    const g = gatedLoad();
    await mount();
    await waitFor(() => expect(g.spy).toHaveBeenCalled());
    await background();
    await foreground();
    await g.open();
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    expect(screen.queryByTestId('aba-away')).toBeNull();
  });

  it('д1. кадр конца после возврата: до измерения области карточки нет, с измерением она на своём месте', async () => {
    const { A } = await toAccess();
    await stepTo(A + 5000, 250);
    await background();
    await tick(30_000);
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-access-hold')).toBeTruthy());
    expect(screen.queryByTestId('aba-access-card')).toBeNull();
    await layoutAccessArea(343, 543);
    const box = StyleSheet.flatten(screen.getByTestId('aba-access-card').parent!.props.style);
    expect([box.left, box.top]).toEqual([(343 - abaExchange.cardSize) / 2, (543 - (abaExchange.cardSize + abaPairingLayout.gapCardRow + abaExchange.rowHeight)) / 2]);
  });

  // --- третий круг: конец по бездействию при решённом конце, «без выбора» после конца, просьба во время записи, выход
  // на записи итога, двойное касание, конфликт на записи обмена, выход при `openedForAba`

  type SnapshotEvent = AbaSessionState['events'][number];
  const eventsOf = async (kind: SnapshotEvent['kind']) => (await snapshot())!.events.filter((e) => e.kind === kind);
  const normalEnd = () => screen.queryByTestId('aba-end-normal') !== null;
  const inBreak = () => screen.queryByTestId('aba-break') !== null;
  /** Удержание выхода, которое не ждёт ухода с экрана: запись итога держится. */
  async function holdExitOnly() {
    await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
    await tick(1500);
  }

  describe('нет возврата после перерыва по просьбе при вышедшем лимите', () => {
    /** Лимит вышел на шаге после пробы, ребёнок попросил перерыв на последствии: конец решён, перерыв на экране. */
    async function toBreakAfterLimit() {
      await snapshotAtTrial(1000, (s) => ({ ...s, timeLimitMs: 2000 }));
      await mount();
      await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
      await answerRight();
      await waitFor(async () => expect(await count('aba_trials')).toBe(1));
      await tick(100);
      await fireEvent.press(screen.getByTestId('aba-break-card'));
      await tickUntil(inBreak);
      expect((await snapshot())!.endReason).toBe('time_limit'); // предпосылка
    }
    const invites = (say: jest.SpyInstance) => say.mock.calls.filter(([key]) => key === 'abaSession.sound.invite').length;

    it('т1а. два приглашения и конец: приглашения не идут по кругу', async () => {
      await toBreakAfterLimit();
      const say = spied(jest.spyOn(voice, 'say'));
      await tickUntil(ended, 1000, 300);
      expect(invites(say)).toBe(2);
      await tick(3 * RETURN_INVITE_AFTER_MS);
      expect(invites(say)).toBe(2);
    });

    it('т1г. кадр конца нейтрален: за пропущенным приглашением нет ничего приятного', async () => {
      await toBreakAfterLimit();
      await tickUntil(ended, 1000, 300);
      expect(normalEnd()).toBe(false);
    });

    it('т1б. итог с причиной лимита, а не отказа; в журнале бездействие устройства', async () => {
      await toBreakAfterLimit();
      await tickUntil(ended, 1000, 300);
      const [row] = await sessions();
      expect(row.endReason).toBe('time_limit');
      expect(row.events.filter((e) => e.kind === 'assent' && (e as { by?: string }).by === 'device_inactivity')).toHaveLength(1);
      expect(await snapshot()).toBeNull();
    });

    it('т1в. контроль: ребёнок вернулся сам — занятие кончается без бездействия устройства', async () => {
      await toBreakAfterLimit();
      await fireEvent.press(screen.getByTestId('aba-break-return'));
      await waitFor(async () => expect(await count('aba_sessions')).toBe(1));
      const [row] = await sessions();
      expect(row.endReason).toBe('time_limit');
      expect(row.events.filter((e) => e.kind === 'assent' && (e as { by?: string }).by === 'device_inactivity')).toEqual([]);
    });

    it('т1д. контроль: ребёнок вернулся сам — кадр конца обычный', async () => {
      await toBreakAfterLimit();
      await fireEvent.press(screen.getByTestId('aba-break-return'));
      await tickUntil(normalEnd, 1000, 300);
      expect(ended()).toBe(false);
    });
  });

  describe('«Сам», нет выбора при уже решённом конце', () => {
    /** Конец решён, подкрепитель устарел, доска полна: перед концом домен просит новый выбор, ребёнок не выбирает. */
    async function noChoiceAtEnd(reason: 'completed' | 'time_limit') {
      await snapshotAtTrial(60_000, (s) => ({ ...s, config: 'alone', observers: [], primaryObserverId: null, endReason: reason, queue: [], reinforcerStale: true, board: { ...s.board, earned: s.board.size } }) as AbaSessionState);
      useAbaRun.getState().set({ config: 'alone', observers: [], primaryObserverId: null });
      await mount();
      await waitFor(() => expect(inChoice()).toBe(true));
      await stepTo(clock.now() + 60_000, 1000);
      await waitFor(async () => expect(await count('aba_sessions')).toBe(1));
    }

    it.each(['completed', 'time_limit'] as const)('т2. итог с причиной %s, а не abandoned', async (reason) => {
      await noChoiceAtEnd(reason);
      expect((await sessions()).map((r) => r.endReason)).toEqual([reason]);
    });

    it('т2а. обмена без выбора нет: жетоны остаются на доске', async () => {
      await noChoiceAtEnd('completed');
      expect((await sessions())[0]).toMatchObject({ exchangesMade: 0 });
      expect(await liveEarned()).toBeGreaterThan(0);
    });

    it('т2б. журнал объясняет, почему обмена нет: событие stopped с причиной no_choice', async () => {
      await noChoiceAtEnd('completed');
      expect((await sessions())[0].events.filter((e) => e.kind === 'stopped')).toEqual([expect.objectContaining({ kind: 'stopped', reason: 'no_choice' })]);
    });

    it('т2в. полная доска: сессия не идёт в ступень доски', async () => {
      await noChoiceAtEnd('completed');
      expect(await loadChildState(db, KID, 'tokenTraining')).toMatchObject({ stage: 1, atStage: [] });
    });

    it('т2г. цикла сопряжения нет: сразу нейтральный конец, без ожидания', async () => {
      await noChoiceAtEnd('completed');
      await waitFor(() => expect(ended()).toBe(true));
      expect(screen.queryByTestId('aba-end-wait')).toBeNull();
      expect(await tails()).toEqual([expect.objectContaining({ accessScene: [], pairingTokenAt: null, completed: true })]);
    });
  });

  describe('просьба о перерыве во время записи шага перед пробой', () => {
    /** Ответ записан, кадр последствия стоит, запись шага перед следующей пробой держится базой. */
    async function stepWriteHeld() {
      const g = gatedDb();
      await toTrial();
      await answerRight();
      await waitFor(async () => expect(await count('aba_trials')).toBe(1));
      await tick(100);
      const save = spied(jest.spyOn(commit, 'saveAbaSessionStep'));
      g.close();
      await tickUntil(() => save.mock.calls.length > 0, 100, 100);
      expect(inTrial()).toBe(false); // предпосылка: проба не показана, кадр последствия с карточкой
      return g;
    }
    async function askDuringWrite() {
      const warn = quietWarn();
      const g = await stepWriteHeld();
      await fireEvent.press(screen.getByTestId('aba-break-card'));
      await g.open();
      return warn;
    }

    it('т3а. проба не показывается, идёт перерыв', async () => {
      await askDuringWrite();
      await waitFor(() => expect(inBreak()).toBe(true));
      expect(inTrial()).toBe(false);
    });

    it('т3б. событие assent и childBreaks на месте', async () => {
      await askDuringWrite();
      await waitFor(() => expect(inBreak()).toBe(true));
      expect((await snapshot())!.childBreaks).toBe(1);
      expect(await eventsOf('assent')).toHaveLength(1);
      expect((await eventsOf('assent'))[0]).toMatchObject({ by: 'child_card', action: 'break', between: true });
    });

    it('т3в. в следующей записи просьба не теряется', async () => {
      await askDuringWrite();
      await waitFor(() => expect(inBreak()).toBe(true));
      await fireEvent.press(screen.getByTestId('aba-break-return'));
      await tickUntil(inTrial);
      const s = (await snapshot())!;
      expect([s.childBreaks, s.breakStartedAt]).toEqual([1, null]);
      expect(await eventsOf('assent')).toHaveLength(1);
      expect(await eventsOf('break')).toHaveLength(1);
    });

    it('т3г. две записи подряд не дают конфликта доски: запас повторов на сессию цел', async () => {
      const warn = await askDuringWrite();
      await waitFor(() => expect(inBreak()).toBe(true));
      expect(caughtConflict(warn)).toBe(false);
    });

    it('т3д. контроль: без просьбы запись кончается пробой, перерыва и просьбы нет', async () => {
      const g = await stepWriteHeld();
      await g.open();
      await tickUntil(inTrial, 100, 50);
      expect(inBreak()).toBe(false);
      expect((await snapshot())!.childBreaks).toBe(0);
      expect(await eventsOf('assent')).toEqual([]);
    });
  });

  describe('просьба о перерыве во время записи шага перерыва', () => {
    /**
     * За пробой идёт перерыв по расписанию; ответ записан, запись шага перерыва держится базой, на экране кадр последствия
     * с карточкой. `asked` — просьб у ребёнка уже было: при `CHILD_BREAKS_TO_END - 1` эта кончает сессию отказом.
     */
    async function breakStepWriteHeld(asked: number) {
      const warn = quietWarn();
      const g = gatedDb();
      await snapshotAtTrial(60_000, (s) => ({ ...s, childBreaks: asked, queue: [s.queue[0], { kind: 'break' }, ...s.queue.slice(1)] }) as AbaSessionState);
      await mount();
      await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
      await answerRight();
      await waitFor(async () => expect(await count('aba_trials')).toBe(1));
      await tick(100);
      const save = spied(jest.spyOn(commit, 'saveAbaSessionStep'));
      g.close();
      await tickUntil(() => save.mock.calls.length > 0, 100, 100);
      expect(save.mock.calls[0][2].queue[0]).toMatchObject({ kind: 'break' }); // предпосылка: пишется шаг перерыва
      expect(inBreak()).toBe(false); // предпосылка: перерыв ещё не показан
      await fireEvent.press(screen.getByTestId('aba-break-card'));
      await g.open();
      return warn;
    }
    const LAST_ASK = CHILD_BREAKS_TO_END - 1;

    it('т10а. просьба кончает сессию отказом: кадр перерыва не показывается', async () => {
      await breakStepWriteHeld(LAST_ASK);
      await waitFor(async () => expect(await count('aba_sessions')).toBe(1));
      await tick(1000);
      expect(inBreak()).toBe(false);
    });

    it('т10б. итог с причиной отказа по просьбе ребёнка', async () => {
      await breakStepWriteHeld(LAST_ASK);
      await waitFor(async () => expect(await count('aba_sessions')).toBe(1));
      const [row] = await sessions();
      expect(row.endReason).toBe('assent_withdrawn');
      expect(row.events.filter((e) => e.kind === 'assent')).toEqual([expect.objectContaining({ by: 'child_card', action: 'end' })]);
    });

    it('т10в. конфликта доски нет: шаг записан один раз, просьба — следом', async () => {
      const warn = await breakStepWriteHeld(LAST_ASK);
      await waitFor(async () => expect(await count('aba_sessions')).toBe(1));
      expect(caughtConflict(warn)).toBe(false);
    });

    it('т10г. контроль: просьба не последняя — идёт перерыв, сессия продолжается', async () => {
      await breakStepWriteHeld(0);
      await tickUntil(inBreak);
      expect(await count('aba_sessions')).toBe(0);
      expect((await snapshot())!.queue[0]).toMatchObject({ kind: 'break', initiatedBy: 'child_card' });
    });
  });

  describe('`closeSession` бросает исключение: конфликт на записи итога, и живая доска не прочиталась', () => {
    function closeRejects() {
      let conflicted = false;
      const read = db.all.bind(db);
      spied(jest.spyOn(commit, 'commitAbaSession')).mockImplementation(async () => {
        conflicted = true;
        throw new AbaBoardConflictError(1, 2);
      });
      spied(jest.spyOn(db, 'all')).mockImplementation(((sql: string, params?: readonly SqlValue[]) =>
        conflicted && params?.includes('abaBoard') ? Promise.reject(new Error('boom')) : read(sql, params)) as SqlDb['all']);
      return { conflicted: () => conflicted };
    }
    async function closeRejectsAtPlannedEnd() {
      quietWarn();
      await acquisitionAtL0(3);
      await snapshotAtTrial(60_000, atClosingProbe());
      await mount();
      await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
      const close = closeRejects();
      await answerRight();
      await tickUntil(close.conflicted, 100, 100);
    }

    it('т9а. выход удержанием на пробе: уводит с экрана', async () => {
      quietWarn();
      await toTrial();
      closeRejects();
      await holdExit();
      expect(router.dismissTo.mock.calls).toEqual([['/map']]);
    });

    it('т9б. итог не лёг: снимок остаётся, родитель закроет занятие', async () => {
      quietWarn();
      await toTrial();
      closeRejects();
      await holdExit();
      expect(await count('aba_sessions')).toBe(0);
      expect(await snapshot()).toBeTruthy();
    });

    it('т9в. конец по плану: кадр не застывает, спокойный конец', async () => {
      await closeRejectsAtPlannedEnd();
      await tickUntil(ended, 100, 100);
      expect(normalEnd()).toBe(false);
    });

    it('т9г. после спокойного конца «Готово» уводит с экрана', async () => {
      await closeRejectsAtPlannedEnd();
      await tickUntil(ended, 100, 100);
      await tick(abaEndDone.lockMs);
      await fireEvent(screen.getByTestId('aba-end-done'), 'pressIn', { nativeEvent: { pageX: 0, pageY: 0, identifier: 0 } });
      await fireEvent.press(screen.getByTestId('aba-end-done'), { nativeEvent: { pageX: 0, pageY: 0, identifier: 0 } });
      await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
    });

    it('т9д. выход, пока итог пишется: запись упала — уводит с экрана, не остаётся на мёртвом кадре', async () => {
      quietWarn();
      let reject = (_: Error) => undefined as void;
      await acquisitionAtL0(3);
      await snapshotAtTrial(60_000, atClosingProbe());
      await mount();
      await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
      const close = spied(jest.spyOn(abaResume, 'closeSession')).mockImplementation(
        () =>
          new Promise((_, no) => {
            reject = no;
          }),
      );
      await answerRight();
      await tickUntil(() => close.mock.calls.length > 0, 100, 100);
      await holdExitOnly();
      expect(router.dismissTo).not.toHaveBeenCalled();
      await act(async () => reject(new Error('boom')));
      await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
    });
  });

  describe('выход, пока пишется итог', () => {
    /** Закрывающая проба, доска полна, запись итога держится: план решил обмен до выхода. */
    async function commitHeldOnPlannedEnd() {
      await fullBoardOfThree();
      await snapshotAtTrial(60_000, atClosingProbe());
      await mount();
      await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
      const g = gatedCommit();
      await answerRight();
      await tickUntil(() => g.spy.mock.calls.length > 0, 100, 100);
      return g;
    }

    it('т4а. с экрана не уводит, пока итог не записан', async () => {
      const g = await commitHeldOnPlannedEnd();
      await holdExitOnly();
      expect(router.dismissTo).not.toHaveBeenCalled();
      expect(await count('aba_sessions')).toBe(0);
      await g.open();
    });

    it('т4б. после записи — на карту, итог один', async () => {
      const g = await commitHeldOnPlannedEnd();
      await holdExitOnly();
      await g.open();
      await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
      expect(await count('aba_sessions')).toBe(1);
      expect(g.spy).toHaveBeenCalledTimes(1);
    });

    it('т4в. обмен уже в итоге: строка хвоста на шаге exchange, доступ не выдан', async () => {
      const g = await commitHeldOnPlannedEnd();
      await holdExitOnly();
      const X = clock.now();
      await g.open();
      await tailRowsAre(1);
      expect((await tails())[0]).toMatchObject({ leftAtStep: 'exchange', leftAt: iso(X), completed: false, accessScene: [] });
      expect((await sessions())[0]).toMatchObject({ endReason: 'completed', exchangesMade: 1 });
    });

    it('т4г. контроль: хвоста нет (обмена и цикла нет) — на карту без строки', async () => {
      await acquisitionAtL0(3);
      await snapshotAtTrial(60_000, atClosingProbe());
      await mount();
      await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
      const g = gatedCommit();
      await answerRight();
      await tickUntil(() => g.spy.mock.calls.length > 0, 100, 100);
      await holdExitOnly();
      await g.open();
      await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
      expect(await tails()).toEqual([]);
    });

    /**
     * Плановый конец с полной доской. Просьба о перерыве на последствии держит запись, шаг домена ждёт её (`advance`),
     * выход нажат в этом окне: цепочка выхода ждёт тот же шаг, поэтому конец приходит в `finish` с поднятым `exiting`.
     */
    async function exitBeforeCommitOnPlannedEnd() {
      const g = gatedDb();
      await fullBoardOfThree();
      await snapshotAtTrial(60_000, atClosingProbe());
      await mount();
      await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
      await answerRight();
      await waitFor(async () => expect(await count('aba_trials')).toBe(1));
      await tick(100);
      g.close();
      await fireEvent.press(screen.getByTestId('aba-break-card'));
      await stepTo(clock.now() + 6000, 100);
      await holdExitOnly();
      expect(await count('aba_sessions')).toBe(0);
      await g.open();
      await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
    }

    it('т5а. выход до записи итога: остановка перекрывает плановый конец, обмена нет', async () => {
      await exitBeforeCommitOnPlannedEnd();
      expect((await sessions())[0]).toMatchObject({ endReason: 'adult_stopped', exchangesMade: 0 });
      expect(await exchangeEvents()).toEqual([]);
    });

    it('т5б. выход до записи итога: жетоны целы', async () => {
      await exitBeforeCommitOnPlannedEnd();
      expect(await liveEarned()).toBe(3);
    });
  });

  describe('двойное касание карточки', () => {
    it('т6а. на обучении: одна возможность в журнале', async () => {
      const g = gatedDb();
      await mount();
      await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
      await tick(1000);
      g.close();
      await fireEvent.press(screen.getByTestId('aba-break-card'));
      await fireEvent.press(screen.getByTestId('aba-break-card'));
      await g.open();
      await waitFor(() => expect(inBreak()).toBe(true));
      expect(await eventsOf('break_card_training')).toHaveLength(1);
    });

    it('т6б. на обучении: ступень сдвигается на одну, следующая — жест, а не самостоятельное касание', async () => {
      const g = gatedDb();
      await mount();
      await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
      await tick(1000);
      g.close();
      await fireEvent.press(screen.getByTestId('aba-break-card'));
      await fireEvent.press(screen.getByTestId('aba-break-card'));
      await g.open();
      await waitFor(() => expect(inBreak()).toBe(true));
      await fireEvent.press(screen.getByTestId('aba-break-return'));
      await waitFor(() => expect(screen.getByTestId('aba-panel-caption').props.children).toBe('Покажите на неё жестом'));
    });

    /** «Отказ» в пробе — тихая пауза; карточка нажата дважды, пока пишется шаг. */
    async function doubleTapInQuietPause() {
      const g = gatedDb();
      await toTrial();
      await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
      await waitFor(() => expect(screen.getByTestId('aba-refusal-pause')).toBeTruthy());
      await tick(500);
      const save = spied(jest.spyOn(commit, 'saveAbaSessionStep'));
      g.close();
      await fireEvent.press(screen.getByTestId('aba-break-card'));
      await fireEvent.press(screen.getByTestId('aba-break-card'));
      await g.open();
      await waitFor(() => expect(inBreak()).toBe(true));
      return save;
    }

    it('т6в. в тихой паузе: занятие не кончается ошибкой', async () => {
      quietWarn();
      await doubleTapInQuietPause();
      await tick(1000);
      expect(await count('aba_sessions')).toBe(0);
      expect(ended()).toBe(false);
    });

    it('т6г. в тихой паузе: перерыв принят один раз', async () => {
      quietWarn();
      const save = await doubleTapInQuietPause();
      expect(save).toHaveBeenCalledTimes(1);
      expect((await snapshot())!.queue[0]).toMatchObject({ kind: 'break', cardTaken: true });
      expect((await snapshot())!.queue.filter((q) => q.kind === 'break')).toHaveLength(1);
    });
  });

  it('т7а. конфликт на записи выбора: повтор обмена не посчитал — жетон за участие не рисует полную доску', async () => {
    await acquisitionAtL0(2);
    await snapshotAtTrial(60_000, (s) => {
      const end = s.queue.findIndex((q) => q.kind === 'block_end');
      return { ...s, board: { ...s.board, earned: s.board.size }, reinforcerStale: true, queue: s.queue.slice(end - 1) } as AbaSessionState;
    });
    await mount();
    await waitFor(() => expect(inChoice()).toBe(true));
    await bumpBoard(0);
    const warn = quietWarn();
    await chooseFirst();
    await tickUntil(inTrial);
    expect(caughtConflict(warn)).toBe(true);
    expect((await snapshot())!.exchangesMade).toBe(0);
    await fireEvent.press(screen.getByTestId('aba-panel-adult_prompted'));
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    const filled = () => screen.queryAllByTestId('aba-strip-token-filled', HIDDEN).length;
    await tickUntil(() => filled() > 0, 100, 100);
    await stepTo(clock.now() + 500, 50);
    expect(filled()).toBe(1);
  });

  it('т7б. контроль: без конфликта тот же выбор идёт через экран обмена', async () => {
    await acquisitionAtL0(2);
    await snapshotAtTrial(60_000, (s) => {
      const end = s.queue.findIndex((q) => q.kind === 'block_end');
      return { ...s, board: { ...s.board, earned: s.board.size }, reinforcerStale: true, queue: s.queue.slice(end - 1) } as AbaSessionState;
    });
    await mount();
    await waitFor(() => expect(inChoice()).toBe(true));
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
    expect((await snapshot())!.exchangesMade).toBe(1);
  });

  describe('занятие открыто ради другого ребёнка (`openedForAba`): конец ведёт к выбору профиля', () => {
    beforeEach(() => {
      useChildSession.setState({ openedForAba: true });
    });
    const toProfiles = () => waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));

    it('т8а. выход удержанием: к выбору профиля, а не на карту', async () => {
      await toTrial();
      await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
      await tick(1500);
      await toProfiles();
      expect(router.dismissTo).not.toHaveBeenCalled();
    });

    it('т8б. выход удержанием: итог записан этому ребёнку, детская сессия сброшена', async () => {
      await toTrial();
      await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
      await tick(1500);
      await toProfiles();
      expect((await sessions()).map((r) => r.endReason)).toEqual(['adult_stopped']);
      expect(useChildSession.getState()).toMatchObject({ childId: null, mode: 'none', openedForAba: false });
    });

    it('т8в. просроченное занятие на возврате: к выбору профиля, закрыто', async () => {
      await toTrial();
      await background();
      await tick(31 * 60_000);
      await foreground();
      await toProfiles();
      expect((await sessions()).map((r) => r.endReason)).toEqual(['app_backgrounded']);
    });

    it('т8г. «Готово» на экране конца: к выбору профиля', async () => {
      useAbaRun.getState().set({ config: 'alone', observers: [], primaryObserverId: null });
      await mount();
      await waitFor(() => expect(screen.getByTestId('aba-end-neutral')).toBeTruthy());
      await tick(abaEndDone.lockMs);
      await fireEvent(screen.getByTestId('aba-end-done'), 'pressIn', { nativeEvent: { pageX: 0, pageY: 0, identifier: 0 } });
      await fireEvent.press(screen.getByTestId('aba-end-done'), { nativeEvent: { pageX: 0, pageY: 0, identifier: 0 } });
      await toProfiles();
      expect(router.dismissTo).not.toHaveBeenCalled();
    });

    it('т8д. выход, пока пишется итог: к выбору профиля после записи, строка хвоста ушла этому ребёнку', async () => {
      await fullBoardOfThree();
      await snapshotAtTrial(60_000, atClosingProbe());
      await mount();
      await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
      const g = gatedCommit();
      await answerRight();
      await tickUntil(() => g.spy.mock.calls.length > 0, 100, 100);
      await holdExitOnly();
      expect(router.replace).not.toHaveBeenCalledWith('/');
      await g.open();
      await toProfiles();
      await tailRowsAre(1);
    });
  });
});
