/**
 * Рабочая сессия ABA, фаза 8 — часть 3: ветки старта, возврата, ухода и разбора ошибок; остановка поверх планового
 * конца, выход во время записи, уход на загрузке; третий круг (бездействие при решённом конце, двойное касание,
 * `openedForAba`). Общие помощники фазы 8 — `src/test/abaSessionHarness.tsx`.
 */
import { AccessibilityInfo, AppState, StyleSheet, type AppStateStatus } from 'react-native';

import { ABA_TARGETS } from '../../../src/content/aba';
import { abaEndDone, abaExchange, abaPairingLayout } from '../../../src/design/abaTokens';
import { initialTargetState } from '../../../src/domain/abaPrompting';
import { EXCHANGE_ACCESS_MS } from '../../../src/domain/abaTokenTraining';
import { abaConsentTextVersion } from '../../../src/services/local/abaConsent';
import { AbaBoardConflictError, AbaConsentRequiredError, AbaPausedError } from '../../../src/services/local/abaLog';
import * as abaResume from '../../../src/services/local/abaResume';
import * as abaStart from '../../../src/services/local/abaStart';
import { finishInProgressSession } from '../../../src/services/local/abaStart';
import * as commit from '../../../src/services/local/commit';
import { setAbaPaused } from '../../../src/services/local/commit';
import { revokeAbaProcessing } from '../../../src/services/local/purge';
import { loadChildState, saveChildState } from '../../../src/services/local/childState';
import { asAbaWriter } from '../../../src/services/local/__tests__/nodeSql';
import type { SqlDb, SqlValue } from '../../../src/services/local/sql';
import { type AbaSessionState } from '../../../src/domain/abaSession';
import { voice } from '../../../src/services/voice';
import { useAbaRun } from '../../../src/state/abaRun';
import { useAccount } from '../../../src/state/account';
import { useChildSession } from '../../../src/state/childSession';
import { act, fireEvent, screen, waitFor } from '../../../src/test/render';
import { KID, HIDDEN, router, clock, db, count, layout, mount, layoutAccessArea, stimOf, chooseFirst, skipCardTraining, registerAbaSessionHooks, tickUntil, inTrial, holdExit, gatedDb, fakeAppState, undo, registerPhase8Hooks, background, foreground, iso, snapshot, snapshotAt, sessions, tails, border, acquisitionAtL0, fullBoardOfThree, toTrial, answerRight, toExchange, toAccess, snapshotAtTrial, breakInTrialThenBackground, gatedCommit, quietWarn, accessPlay, ended, accessEvents, tailRowsAre, kill, toTailExchange, toTailAccess, toPairingToken, gatedLoad, spied, tick, stepTo } from '../../../src/test/abaSessionHarness';
import { CHILD_BREAK_MS, CHILD_BREAKS_TO_END, REFUSAL_QUIET_MS, RETURN_INVITE_AFTER_MS } from '../../../src/types/aba';

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

  // --- ветки старта, возврата, ухода и разбора ошибок вне брифа: снимки и сервисы настоящие, подмены — только там, где
  // ошибку иначе не вызвать

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
    await fakeAppState.emit('inactive');
    await tick(1000);
    await fakeAppState.emit('active');
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
    expect(fakeAppState.handlers().length).toBeGreaterThan(0);
    await screen.unmount();
    expect(fakeAppState.handlers()).toEqual([]);
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
