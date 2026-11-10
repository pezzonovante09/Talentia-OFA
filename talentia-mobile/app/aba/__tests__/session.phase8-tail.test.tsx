/**
 * Рабочая сессия ABA, фаза 8 — часть 2: обмен, снимки на входе в сцену и перерыв, хвост, гонки ухода и возврата.
 * Общие помощники фазы 8 — `src/test/abaSessionHarness.tsx`.
 */
import { ABA_TARGETS } from '../../../src/content/aba';
import { ABA_CONTROL_STROKE } from '../../../src/design/abaTokens';
import { initialTargetState } from '../../../src/domain/abaPrompting';
import { EXCHANGE_ACCESS_MS, initialTokenTraining, PAIRING } from '../../../src/domain/abaTokenTraining';
import * as abaResume from '../../../src/services/local/abaResume';
import * as commit from '../../../src/services/local/commit';
import { loadChildState, saveChildState } from '../../../src/services/local/childState';
import { asAbaWriter } from '../../../src/services/local/__tests__/nodeSql';
import { type AbaSessionState } from '../../../src/domain/abaSession';
import { voice } from '../../../src/services/voice';
import { useAbaRun } from '../../../src/state/abaRun';
import { act, fireEvent, screen, waitFor } from '../../../src/test/render';
import { KID, HIDDEN, clock, db, count, mount, stimOf, chooseFirst, registerAbaSessionHooks, tickUntil, inTrial, holdExit, gatedDb, undo, registerPhase8Hooks, background, foreground, iso, snapshot, snapshotAt, sessions, tails, border, acquisitionAtL0, fullBoardOfThree, toTrial, answerRight, toExchange, toAccess, snapshotAtTrial, breakInTrialThenBackground, gatedCommit, quietWarn, accessPlay, ended, accessEvents, tailRowsAre, kill, toLastTrialOfBlock, toTailExchange, toTailAccess, toPairingToken, spied, tick, stepTo } from '../../../src/test/abaSessionHarness';
import { CHILD_BREAK_MS } from '../../../src/types/aba';

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

  // --- обмен, снимки на входе в сцену и перерыв, хвост, гонки ухода и возврата

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

});
