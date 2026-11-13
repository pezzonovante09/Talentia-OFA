/**
 * Рабочая сессия ABA, фаза 8 — часть 1: уход и возврат в пробе, перерыве и доступе, холодный старт по снимку, тир окна
 * (№182). Части 2–3 — `session.phase8-tail.test.tsx`, `session.phase8-errors.test.tsx`; общие помощники фазы 8 —
 * `src/test/abaSessionHarness.tsx`.
 */
import { AppState, StyleSheet, type AppStateStatus } from 'react-native';

import { abaLayoutByTier, abaTierFor, ABA_CONTROL_STROKE } from '../../../src/design/abaTokens';
import ru from '../../../src/i18n/locales/ru.json';
import { abaConsentTextVersion } from '../../../src/services/local/abaConsent';
import { AbaBoardConflictError } from '../../../src/services/local/abaLog';
import * as abaResume from '../../../src/services/local/abaResume';
import * as commit from '../../../src/services/local/commit';
import { setAbaPaused } from '../../../src/services/local/commit';
import { revokeAbaProcessing } from '../../../src/services/local/purge';
import { loadChildState, saveChildState } from '../../../src/services/local/childState';
import { asAbaWriter } from '../../../src/services/local/__tests__/nodeSql';
import { type AbaSessionState } from '../../../src/domain/abaSession';
import { voice } from '../../../src/services/voice';
import { useAbaRun } from '../../../src/state/abaRun';
import { fireEvent, screen, waitFor } from '../../../src/test/render';
import { KID, HIDDEN, router, clock, db, restartClock, count, layout, mount, stimOf, chooseFirst, skipCardTraining, registerAbaSessionHooks, tickUntil, holdExit, gatedDb, undo, registerPhase8Hooks, background, foreground, iso, snapshot, snapshotAt, sessions, tails, border, acquisitionAtL0, fullBoardOfThree, toTrial, answerRight, toAccess, snapshotAtTrial, breakInTrialThenBackground, gatedLoad, tick, stepTo } from '../../../src/test/abaSessionHarness';
import { REFUSAL_QUIET_MS, RETURN_INVITE_AFTER_MS } from '../../../src/types/aba';

// экран на ручных часах: тест — сотни шагов `act`; под нагрузкой всего набора нужен прежний запас (общий testTimeout — 15 с)
jest.setTimeout(60_000);

jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => undefined }));
// каждая картинка предмета — свой View с `testID="aba-art-<id>"` (`stimOf` → верный вариант)
jest.mock('../../../src/assets/registry', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').registryWithArtTestIds());
// счётчик id вместо детерминированного `expo-crypto`: две пробы подряд не падают на UNIQUE `aba_trials.id`
jest.mock('../../../src/services/abaIds', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').countingAbaIds());
jest.mock('expo-router', () => jest.requireActual<typeof import('../../../src/test/abaScreenMocks')>('../../../src/test/abaScreenMocks').expoRouterMock());

registerAbaSessionHooks();

/**
 * Фаза 8: сворачивание и возобновление (`useAbaBackground`, `loadAbaResume`, `model/sessionResume.ts`). `AppState`
 * подменяется (не `spyOn`: `mockRestore` у мока RN снял бы реализацию), события `background` / `active` — внутри `act`.
 * Снимки для холодного старта готовятся настоящими сервисами на часах теста: `updated_at` снимка — момент ухода.
 */
describe('фаза 8: сворачивание и возобновление', () => {
  registerPhase8Hooks();

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
    restartClock(new Date(2026, 10, 6, 23, 58).getTime());
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

  /** Высота панели взрослого — по ней видно, в каком тире стоит проба. */
  const panelHeight = () => StyleSheet.flatten(screen.getByTestId('aba-adult-panel').props.style).height as number;
  /**
   * `AppState.currentState` в моке RN — функция: тест, где окно возвращается в фоне, ставит состояние сам. Снимается
   * один раз — к исходному свойству, а не к предыдущей подмене.
   */
  const setAppState = (s: AppStateStatus) => {
    const original = Object.getOwnPropertyDescriptor(AppState, 'currentState');
    if (original && !('__set' in AppState)) {
      Object.defineProperty(AppState, '__set', { value: true, configurable: true });
      undo.push(() => {
        Object.defineProperty(AppState, 'currentState', original);
        delete (AppState as { __set?: true }).__set;
      });
    }
    Object.defineProperty(AppState, 'currentState', { value: s, configurable: true, writable: true });
  };

  it('13а. тир фиксируется первым onLayout: второе измерение меньшей высотой посреди пробы — пауза (№182): кадр away со строкой «Верните размер окна», проба не пишется', async () => {
    expect([abaTierFor(760, 0), abaTierFor(650, 0)]).toEqual(['roomy', 'compact']);
    await toTrial();
    expect(panelHeight()).toBe(abaLayoutByTier.roomy.adultPanel);
    const leftAt = clock.now();
    await layout(650);
    await tick(10);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.getByTestId('aba-window-squeezed')).toHaveTextContent(ru.abaScreen.tooSmall.paused);
    expect(screen.queryByTestId('aba-sample')).toBeNull();
    expect(screen.queryByTestId('aba-adult-panel')).toBeNull();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(leftAt)));
    await tick(30_000);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(await count('aba_trials')).toBe(0);
  });

  it('13в. сжатие посреди пробы, возврат размера через 30 с — та же проба с SD, тот же тир, проб не прибавилось', async () => {
    await toTrial();
    const sample = stimOf('aba-sample');
    const before = (await snapshot())!;
    await layout(650);
    await tick(30_000);
    await layout(760);
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(screen.queryByTestId('aba-away')).toBeNull();
    expect(stimOf('aba-sample')).toBe(sample);
    expect(screen.getByTestId('aba-instruction')).toBeTruthy();
    expect(panelHeight()).toBe(abaLayoutByTier.roomy.adultPanel);
    expect(await count('aba_trials')).toBe(0);
    const after = (await snapshot())!;
    expect(after.sessionId).toBe(before.sessionId);
    expect(after.pausedMs).toBe(before.pausedMs + 30_000);
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
  });

  /** Сторона плиты образца: roomy 120, compact 88, tight 80 (`abaChoiceZone`) — панель у compact и tight одна (124). */
  const sampleSide = () => StyleSheet.flatten(screen.getByTestId('aba-sample').props.style).width as number;

  it('13г. второе измерение меньше на обучении карточке — уже не первая проверка (она прошла на старте обучения): пауза со строкой «Верните размер окна», тир не меняется; размер вернулся — обучение карточке, проба в roomy', async () => {
    await mount();
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    await layout(650);
    await tick(10);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.getByTestId('aba-window-squeezed')).toHaveTextContent(ru.abaScreen.tooSmall.paused);
    expect(screen.queryByTestId('aba-card-training')).toBeNull();
    await tick(5000);
    await layout(760);
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    expect(screen.queryByTestId('aba-window-squeezed')).toBeNull();
    await skipCardTraining();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(panelHeight()).toBe(abaLayoutByTier.roomy.adultPanel);
  });

  it('13д. второе измерение меньше на выборе подкрепителя — уже не первая проверка: пауза со строкой «Верните размер окна», тир не меняется; размер вернулся — проба в roomy', async () => {
    await mount();
    await skipCardTraining();
    await waitFor(() => expect(screen.getByTestId('aba-choice')).toBeTruthy());
    await layout(650);
    await tick(10);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.getByTestId('aba-window-squeezed')).toHaveTextContent(ru.abaScreen.tooSmall.paused);
    expect(screen.queryByTestId('aba-choice')).toBeNull();
    await tick(5000);
    await layout(760);
    await waitFor(() => expect(screen.getByTestId('aba-choice')).toBeTruthy());
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(panelHeight()).toBe(abaLayoutByTier.roomy.adultPanel);
    expect(sampleSide()).toBe(120);
  });

  it('13е. сжатие → фон → active при сжатом окне: занятие не продолжается; окно вернулось — продолжение ровно один раз', async () => {
    await toTrial();
    const sample = stimOf('aba-sample');
    const load = jest.spyOn(abaResume, 'loadAbaResume');
    undo.push(() => load.mockRestore());
    await layout(650);
    await tick(10);
    await background();
    await tick(10_000);
    await foreground();
    await tick(2000);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.getByTestId('aba-window-squeezed')).toBeTruthy();
    expect(screen.queryByTestId('aba-sample')).toBeNull();
    expect(load).not.toHaveBeenCalled();
    await layout(760);
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(stimOf('aba-sample')).toBe(sample);
    await tick(2000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('aba-sample')).toBeTruthy();
    expect(await count('aba_trials')).toBe(0);
  });

  it('13ж. сжатие → фон → окно вернулось, пока приложение в фоне: продолжения нет до active, на active — один раз', async () => {
    await toTrial();
    const load = jest.spyOn(abaResume, 'loadAbaResume');
    undo.push(() => load.mockRestore());
    await layout(650);
    await tick(10);
    setAppState('background');
    await background();
    await tick(5000);
    await layout(760);
    await tick(2000);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.queryByTestId('aba-sample')).toBeNull();
    expect(load).not.toHaveBeenCalled();
    setAppState('active');
    await foreground();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    await tick(2000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(panelHeight()).toBe(abaLayoutByTier.roomy.adultPanel);
  });

  it('13з. сжатие на хвосте конца (ожидание цикла сопряжения) — тот же путь ухода: строка хвоста leftAtStep wait; возврат размера — «Закончили»', async () => {
    await toTrial();
    await answerRight();
    await waitFor(async () => expect(await count('aba_trials')).toBe(1));
    await fireEvent.press(screen.getByTestId('aba-panel-refusal'));
    await waitFor(() => expect(screen.getByTestId('aba-end-wait')).toBeTruthy());
    await tick(2000);
    const leftAt = clock.now();
    await layout(650);
    await tick(10);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.getByTestId('aba-window-squeezed')).toBeTruthy();
    await waitFor(async () => expect(await tails()).toHaveLength(1));
    expect((await tails())[0]).toMatchObject({ leftAtStep: 'wait', pairingTokenAt: null, completed: false, leftAt: iso(leftAt), accessScene: [] });
    await tick(60_000);
    await layout(760);
    await waitFor(() => expect(screen.getByTestId('aba-end-neutral')).toBeTruthy());
    expect(screen.queryByTestId('aba-end-pairing')).toBeNull();
    expect(await count('aba_sessions')).toBe(1);
  });

  it('13и. планшет: сужение по ширине уже ряда из трёх плит (разделённый экран) — пауза; ширина вернулась — та же проба', async () => {
    await mount(null);
    await layout(1000, 768);
    await skipCardTraining();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    const sample = stimOf('aba-sample');
    await layout(1000, 300);
    await tick(10);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.getByTestId('aba-window-squeezed')).toBeTruthy();
    await tick(5000);
    await layout(1000, 768);
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(stimOf('aba-sample')).toBe(sample);
    expect(await count('aba_trials')).toBe(0);
  });

  // `layout` шлёт высоту корня, экран вычитает insets.top 20: 760 → 740, 716 → 696 — нижняя граница roomy
  it('13к. лёгкое колебание высоты, которое тир вмещает (760 → 740 → 716 → 760), паузы не даёт', async () => {
    expect(abaTierFor(696, 0)).toBe('roomy');
    await toTrial();
    const load = jest.spyOn(abaResume, 'loadAbaResume');
    undo.push(() => load.mockRestore());
    for (const h of [740, 716, 760]) {
      await layout(h);
      await tick(10);
      expect(screen.queryByTestId('aba-away')).toBeNull();
      expect(screen.getByTestId('aba-sample')).toBeTruthy();
    }
    expect(panelHeight()).toBe(abaLayoutByTier.roomy.adultPanel);
    expect(load).not.toHaveBeenCalled();
  });

  /**
   * Регрессия №182 (была ошибкой кода: `canRetier` выбирал тир заново на кадре `away` после первой пробы). Стимул уже был
   * показан — сжатие в фоне даёт паузу, как посреди пробы (13а), а не новый тир.
   */
  it('13л. первая проба показана, фон, окно сжалось в фоне — стимул уже был: на возврате пауза, а не новый тир', async () => {
    await toTrial();
    await background();
    await layout(650);
    await tick(5000);
    await foreground();
    await tick(2000);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.getByTestId('aba-window-squeezed')).toBeTruthy();
    expect(screen.queryByTestId('aba-sample')).toBeNull();
  });

  it('13м. второе измерение меньше, пока идёт старт (первая проверка ещё впереди): тир выбран заново по высоте и ширине — 630 × 300 даёт tight, паузы нет', async () => {
    expect(abaTierFor(630, 0)).toBe('compact');
    const g = gatedLoad();
    await mount();
    await waitFor(() => expect(g.spy).toHaveBeenCalled());
    await layout(650, 300);
    await g.open();
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    await tick(10);
    expect(screen.queryByTestId('aba-away')).toBeNull();
    await skipCardTraining();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(screen.queryByTestId('aba-window-squeezed')).toBeNull();
    expect(sampleSide()).toBe(80);
  });

  /**
   * Регрессия (№182): старт и гейт окна выбирают тир по высоте и ширине (`tierForWindow`) — узкое с первого измерения
   * окно получает тир, ряд которого помещается, а не roomy с обрезанным рядом.
   */
  it('13н. узкое окно с первого измерения: высота roomy, ширина 300 уже ряда roomy (336) — на первой проверке тир по ширине (tight), а не roomy', async () => {
    await mount(null);
    await layout(760, 300);
    await waitFor(() => expect(screen.getByTestId('aba-card-training')).toBeTruthy());
    await tick(10);
    expect(screen.queryByTestId('aba-away')).toBeNull();
    await skipCardTraining();
    await chooseFirst();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(sampleSide()).toBe(80);
  });

  it('13о. размер окна вернулся, а возврат ещё читает снимок: строка «Верните размер окна» исчезает сразу, кадр away стоит до конца loadAbaResume', async () => {
    const g = gatedDb();
    await toTrial();
    const sample = stimOf('aba-sample');
    const leftAt = clock.now();
    await layout(650);
    await tick(10);
    expect(screen.getByTestId('aba-window-squeezed')).toBeTruthy();
    await waitFor(async () => expect(await snapshotAt()).toBe(iso(leftAt)));
    const load = jest.spyOn(abaResume, 'loadAbaResume');
    undo.push(() => load.mockRestore());
    g.close();
    await layout(760);
    await tick(10);
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('aba-away')).toBeTruthy();
    expect(screen.queryByTestId('aba-window-squeezed')).toBeNull();
    expect(screen.queryByTestId('aba-sample')).toBeNull();
    await g.open();
    await waitFor(() => expect(screen.getByTestId('aba-sample')).toBeTruthy());
    expect(stimOf('aba-sample')).toBe(sample);
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

});
