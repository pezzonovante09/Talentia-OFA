/**
 * Обвязка тестов экрана сессии ABA (`app/aba/__tests__/session.*.test.tsx`): ручные часы с выключателем, `memoryDb`,
 * монтирование с первым `onLayout`, шаги сессии и снимки фазы 8.
 *
 * Не под `__tests__`: jest `testMatch` берёт только файлы `*.test.ts(x)` внутри `__tests__`. Вызовы `jest.mock` остаются в каждом файле
 * теста (их поднимает babel-jest), тела моков — `abaScreenMocks.ts`. `db` и `clock` — живые привязки модуля: их
 * меняет `beforeEach` из `registerAbaSessionHooks()`, тест читает текущие.
 */
import { StyleSheet } from 'react-native';
import AbaSessionScreen from '../../app/aba/session';
import { ABA_TARGETS } from '../content/aba';
import { initialTargetState } from '../domain/abaPrompting';
import { initialTokenTraining, PAIRING } from '../domain/abaTokenTraining';
import { grantAbaProcessing } from '../services/local/abaConsent';
import * as abaResume from '../services/local/abaResume';
import { loadAbaStart } from '../services/local/abaStart';
import * as commit from '../services/local/commit';
import { saveAbaSessionStep } from '../services/local/commit';
import { childStateUpdatedAt, loadChildState, saveChildState } from '../services/local/childState';
import { asAbaWriter, memoryDb } from '../services/local/__tests__/nodeSql';
import type { SqlDb, SqlValue } from '../services/local/sql';
import { chooseReinforcer, nextStep, startAbaSession, type AbaSessionState } from '../domain/abaSession';
import { useAbaRun } from '../state/abaRun';
import { useAccount } from '../state/account';
import { useChildSession } from '../state/childSession';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import { adultI18n } from '../i18n';
import { act, fireEvent, renderWithProviders, screen, waitFor, within } from './render';
import { CHILD_BREAK_MS } from '../types/aba';
import { AbaClockProvider, type ManualClock } from '../ui/aba/clock';
import { appStateFake } from './appStateFake';
import { manualClockDriver } from './manualClockDriver';

export const KID = '00000000-0000-4000-8000-0000000000a1';
export const OBS = '00000000-0000-4000-8000-0000000000b1';
export const HIDDEN = { includeHiddenElements: true };

/** Роутер и счётчик id — моки файла теста (`jest.mock` с фабриками из `abaScreenMocks`). */
export const router = (jest.requireMock('expo-router') as { __router: { replace: jest.Mock; dismissTo: jest.Mock } }).__router;
const abaIds = jest.requireMock('../services/abaIds') as { __reset: () => void };

/**
 * Часы теста с выключателем (`manualClockDriver`): `afterEach` помечает тест мёртвым, и цикл, переживший таймаут, не
 * двигает часы и экран следующего теста (каскад падений при таймауте одного — REBUILD.md).
 */
const clockDriver = manualClockDriver();
export const { tick, stepTo, tickUntilWith } = clockDriver;
export let clock: ManualClock;
export let db: SqlDb;
/** Другие часы посреди теста (иная дата): циклы прежних часов останавливаются. */
export function restartClock(startMs: number): ManualClock {
  clock = clockDriver.start(startMs);
  return clock;
}
export const count = async (table: string) => (await db.all<{ n: number }>(`SELECT count(*) AS n FROM ${table} WHERE child_id = ?`, [KID]))[0].n;

/**
 * Экран стартует после первого `onLayout` корня (фаза 8: тир фиксируется один раз на сессию); RNTL его не шлёт —
 * хелпер посылает измерение сам. `height` 760 даёт тир `roomy`; `null` — только отрисовать без измерения.
 */
export async function layout(height: number, width = 375) {
  await act(async () => {
    fireEvent(screen.getByTestId('aba-session'), 'layout', { nativeEvent: { layout: { height, width, x: 0, y: 0 } } });
  });
}
/** Провайдер языка взрослого — компонентом: `adultI18n()` берётся при рендере, после `initI18n` в `renderWithProviders`. */
function AdultLanguage({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={adultI18n()}>{children}</I18nextProvider>;
}

/** `adult` — экран под провайдером языка взрослого, как в `app/aba/_layout.tsx` (№190). */
export async function mount(height: number | null = 760, { adult = false }: { adult?: boolean } = {}) {
  const screenEl = (
    <AbaClockProvider clock={clock}>
      <AbaSessionScreen />
    </AbaClockProvider>
  );
  await renderWithProviders(adult ? <AdultLanguage>{screenEl}</AdultLanguage> : screenEl);
  if (height !== null) await layout(height);
}

/**
 * Внутренняя область кадра доступа: `AccessView` рисует карточку только с измеренным местом, а RNTL `onLayout` не шлёт.
 * Своего testID у области нет, она единственная под корнем кадра с `onLayout`.
 */
export async function layoutAccessArea(width = 343, height = 543) {
  const [area] = screen.getByTestId(/^aba-access-(play|settle|fold|hold|done)$/).queryAll((n) => typeof n.props.onLayout === 'function');
  await fireEvent(area, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height } } });
}

/** id стимула на плите (картинка предмета из реестра, заглушка разработчика или фигура). */
export const stimOf = (testID: string) => {
  const n = within(screen.getByTestId(testID)).queryAllByTestId(/^aba-(art|stub|stim)-/)[0];
  return String(n?.props.testID ?? '').replace(/^aba-(art|stub|stim)-/, '');
};
export const correctOption = () => {
  const sample = stimOf('aba-sample');
  for (let i = 0; i < 3; i += 1) if (screen.queryByTestId(`aba-option-${i}`) && stimOf(`aba-option-${i}`) === sample) return `aba-option-${i}`;
  throw new Error('верный вариант не найден');
};

export async function chooseFirst() {
  await waitFor(() => expect(screen.getByTestId('aba-choice')).toBeTruthy());
  const card = screen.getAllByTestId(/^aba-reinforcer-(?!stub)/)[0];
  await fireEvent.press(card);
  await tick(800);
}

export async function skipCardTraining() {
  for (let i = 0; i < 3; i += 1) {
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('aba-panel-l4_skipped'));
  }
}

/** Общие `beforeEach` / `afterEach` файла: база с согласием, ступень 1 после сопряжения, со взрослым и наблюдателем. */
export function registerAbaSessionHooks() {
  beforeEach(async () => {
    abaIds.__reset();
    router.replace.mockClear();
    router.dismissTo.mockClear();
    clock = clockDriver.start();
    db = await memoryDb();
    await grantAbaProcessing(db, { childId: KID, accountId: 'acc', lang: 'ru', at: new Date(clock.now() - 60_000).toISOString(), randomBytes: (n) => new Uint8Array(n).fill(7) });
    await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 1 }, new Date(clock.now()).toISOString()));
    useAccount.setState({ db, accountId: 'acc', status: 'ready' });
    useChildSession.setState({ childId: KID, mode: 'account', openedForAba: false });
    useAbaRun.getState().set({ config: 'with_adult', observers: [{ id: OBS, role: 'parent', trained: false }], primaryObserverId: OBS });
  });

  afterEach(() => {
    clockDriver.kill();
  });
}

/** Шагать, пока условие не выполнится (по 250 мс, не дольше 400 шагов). */
export const tickUntil = (pred: () => boolean, step = 250, max = 400) => tickUntilWith(pred, step, max);
/** Проба идёт: у панели взрослого есть «Была подсказка» (на последствии и участии — только «Отказ»). */
export const inTrial = () => screen.queryByTestId('aba-panel-adult_prompted') !== null;
export async function holdExit() {
  await fireEvent(screen.getByTestId('aba-exit'), 'pressIn');
  await tick(1500);
  await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/map'));
}
/** База с задержкой записи: пока `close()` не снят `open()`, запросы экрана ждут (тест держит запись «в полёте»). */
export function gatedDb() {
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

/* ---------- фаза 8: сворачивание и возобновление ---------- */

/** `AppState` фазы 8 (`appStateFake`): ставится и снимается `registerPhase8Hooks()`. */
export const fakeAppState = appStateFake();
/** Подмены на время теста: снимаются и после падения, иначе закрытая запись или шпион останутся следующему тесту. */
export const undo: (() => void)[] = [];
/** `beforeEach` / `afterEach` блока фазы 8 — звать внутри его `describe`. */
export function registerPhase8Hooks() {
  beforeEach(() => {
    undo.length = 0;
    fakeAppState.install();
  });
  afterEach(() => {
    fakeAppState.restore();
    undo.splice(0).forEach((u) => u());
  });
}
export const background = () => fakeAppState.emit('background');
export const foreground = () => fakeAppState.emit('active');
export const iso = (ms: number) => new Date(ms).toISOString();
export const snapshot = async () => (await loadChildState(db, KID, 'abaSessionInProgress')) as AbaSessionState | null | undefined;
export const snapshotAt = () => childStateUpdatedAt(db, KID, 'abaSessionInProgress');
export type SessionBody = { endReason: string; endedAt: string; tokensEarned: number; exchangesMade: number; events: { kind: string; startedAt?: string; endedAt?: string }[] };
export const sessions = async () => (await db.all<{ body: string }>('SELECT body FROM aba_sessions WHERE child_id = ? ORDER BY seq', [KID])).map((r) => JSON.parse(r.body) as SessionBody);
export type TailRow = { sessionId: string; accessScene: { startedAt: string; endedAt: string }[]; pairingTokenAt: string | null; leftAtStep: string | null; leftAt: string | null; completed: boolean; sceneStarted?: boolean; exchangeReturned?: { tokens: number; nonContingent: number; at: string; belowBoard?: true } };
export const tails = async () => (await db.all<{ body: string }>('SELECT body FROM aba_session_tails WHERE child_id = ? ORDER BY seq', [KID])).map((r) => JSON.parse(r.body) as TailRow);
export const border = () => StyleSheet.flatten(screen.getByTestId('aba-break-return').props.style).borderWidth as number;
export const acquisitionAtL0 = async (stage: 1 | 2 | 3) => {
  const two = ABA_TARGETS.find((x) => x.id === 'match-same-2')!;
  const states = { [two.id]: { ...initialTargetState(two), phase: 'acquisition' as const, startPromptLevel: 0 as const, lastSuccessfulPromptLevel: 0 as const } };
  const at = iso(clock.now());
  await asAbaWriter(db, KID, async (tx) => {
    await saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage }, at);
    await saveChildState(tx, KID, 'abaTargets', states, at);
  });
};
export const fullBoardOfThree = async () => {
  const at = iso(clock.now());
  await asAbaWriter(db, KID, async (tx) => {
    await saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 3 }, at);
    await saveChildState(tx, KID, 'abaBoard', { earned: 3, nonContingent: 0 }, at);
  });
};

/** Сессия со взрослым до первой пробы (обучение карточке пропущено). */
export async function toTrial() {
  await mount();
  await skipCardTraining();
  await chooseFirst();
  await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
}
export async function answerRight() {
  await fireEvent.press(screen.getByTestId('aba-sample'));
  await fireEvent.press(screen.getByTestId(correctOption()));
}
/** Кадр обмена сразу, не в хвосте: ступень 1, верно на L0 — жетон заполнил доску, обмен в посадка + 700. Возвращает его начало. */
export async function toExchange(): Promise<number> {
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
export async function toAccess(): Promise<{ A: number; S: number }> {
  const S = await toExchange();
  const A = S + 1000 + 360 + 300 + 360;
  await stepTo(A);
  expect(screen.getByTestId('aba-access-play')).toBeTruthy();
  return { A, S };
}
/**
 * Снимок незаконченной сессии через настоящие сервисы: `loadAbaStart` → `startAbaSession` → выбор первого подкрепителя →
 * первая проба в очереди; `updated_at` снимка — `clock.now() − agoMs` (момент ухода без события ухода).
 */
export async function snapshotAtTrial(agoMs: number, patch: (s: AbaSessionState) => AbaSessionState = (s) => s): Promise<AbaSessionState> {
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

/**
 * Перерыв по карточке в первой пробе, затем через 1 с — в фон. Возвращает начало перерыва (момент просьбы: `nextStep`
 * ставит `breakStartedAt`, снимок ложится на входе в перерыв) и его длительность.
 */
export async function breakInTrialThenBackground(): Promise<{ startedAt: number; maxMs: number }> {
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
/** Запись итога держится до `open()`: итог уже начат (`finish`), а строки в `aba_sessions` ещё нет. */
export function gatedCommit() {
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
export const quietWarn = () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  undo.push(() => warn.mockRestore());
  return warn;
};
export const accessPlay = () => screen.queryByTestId('aba-access-play') !== null;
export const ended = () => screen.queryByTestId('aba-end-neutral') !== null;
export const accessEvents = async () => (await sessions())[0].events.filter((e) => e.kind === 'access');
export const tailRowsAre = (n: number) => waitFor(async () => expect(await tails()).toHaveLength(n));
/** Приложение убито без события ухода: экран размонтирован, снимок в базе — последний, что лёг сам. */
export async function kill(ms: number) {
  await screen.unmount();
  await tick(ms);
}
/** Ступень 2: четыре подсказанные пробы блока без жетона; на экране пятая, последняя проба блока. */
export async function toLastTrialOfBlock() {
  await acquisitionAtL0(2);
  await toTrial();
  for (let i = 0; i < 4; i += 1) {
    await fireEvent.press(screen.getByTestId('aba-panel-adult_prompted'));
    await answerRight();
    await waitFor(() => expect(inTrial()).toBe(false));
    await tickUntil(inTrial);
  }
}
/** Конец с обменом: полная доска из трёх, «Отказ» вне пробы — итог записан, на экране обмен хвоста. */
export async function toTailExchange() {
  await fullBoardOfThree();
  await toTrial();
  await answerRight();
  await waitFor(async () => expect(await count('aba_trials')).toBe(1));
  await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
  await waitFor(() => expect(screen.getByTestId('aba-exchange')).toBeTruthy());
}
/** Доступ хвоста (доска из трёх — 40 с); возвращает начало сцены. */
export async function toTailAccess(): Promise<number> {
  await toTailExchange();
  await tickUntil(accessPlay, 20, 200);
  return clock.now();
}
/** Конец по отказу без полной доски: цикл сопряжения дошёл до жетона; возвращает начало кадра жетона. */
export async function toPairingToken(): Promise<number> {
  await toTrial();
  await answerRight();
  await waitFor(async () => expect(await count('aba_trials')).toBe(1));
  await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
  await waitFor(() => expect(screen.getByTestId('aba-end-wait')).toBeTruthy());
  await stepTo(clock.now() + PAIRING.tokenAfterMs, 500);
  expect(screen.getByTestId('aba-end-pairing')).toBeTruthy();
  return clock.now();
}
/** `loadAbaResume` держится до `open()`: старт или возврат стоит на чтении снимка. */
export function gatedLoad() {
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
export function spied<T extends { mockRestore: () => void }>(spy: T): T {
  undo.push(() => spy.mockRestore());
  return spy;
}
