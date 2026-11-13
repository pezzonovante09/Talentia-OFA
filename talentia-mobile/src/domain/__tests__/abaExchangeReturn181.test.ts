/**
 * №181 (вопрос 82, 2026-11-08): обмен прошёл, а сцена доступа не началась — остановка возвращает жетоны этого обмена на
 * доску. Окно — от обмена (`settleBoard`, `finishBreak`, `chooseReinforcer` с полной доской) до первого кадра сцены
 * (`accessShown`) или `finishAccess`. Доступа в журнале нет, событие `exchange_returned` одно, `exchangesMade − 1`,
 * `tokensEarned` не трогается, событие `exchange` остаётся. Доска итога — живая плюс вернувшиеся, с меткой; обмен
 * вернувшихся жетонов в следующей сессии помечен `includesReturned` и в ступень доски не идёт.
 */
import {
  accessShown,
  chooseReinforcer,
  finishAbaSession,
  finishAccess,
  finishBreak,
  nextStep,
  resumeAbaSession,
  stopSession,
  withdrawAssent,
  type AbaSessionState,
  type StartInput,
} from '../abaSession';
import { answerNext, BASE_MS, beginSession, trained } from './abaSessionDriver';

const T = BASE_MS + 2000;
const STEP = T + 30_000;
const iso = (ms: number) => new Date(ms).toISOString();
const finish = (st: AbaSessionState, at: number) => finishAbaSession(st, at, {}, undefined, undefined, { routineExchangeInWindow: false });
const returnedEvents = (st: AbaSessionState) => st.events.filter((e) => e.kind === 'exchange_returned');
const accessEvents = (st: AbaSessionState) => st.events.filter((e) => e.kind === 'access');
const exchangeEvents = (st: AbaSessionState) => st.events.filter((e) => e.kind === 'exchange');

/** Перерыв по расписанию кончился в `STEP` при доске `earned/nonContingent`: `finishBreak` обменял, голова — доступ. */
function exchangedOnBreak(board: { earned?: number; nonContingent?: number } = {}, over: Partial<StartInput> = {}): AbaSessionState {
  const worked = answerNext(beginSession(over), BASE_MS + 1000).state;
  const full = { ...worked, board: { ...worked.board, earned: board.earned ?? worked.board.size, nonContingent: board.nonContingent ?? 0 } };
  const shown = nextStep({ ...full, queue: [{ kind: 'break', maxMs: 30_000 }, ...full.queue] }, T).state;
  const st = finishBreak(shown, STEP).state;
  expect(st.queue[0]?.kind).toBe('access');
  return st;
}

/** Тот же обмен, шаг доступа показан (`accessStartedAt`) — на экране кадр обмена, сцены ещё нет. */
const onExchangeFrame = (board?: { earned?: number; nonContingent?: number }) => {
  const next = nextStep(exchangedOnBreak(board), STEP);
  expect(next.step.kind).toBe('access');
  return next.state;
};

/** Обучение доске (немедленный обмен): доска без одного жетона, верные ответы до обмена в `settleBoard`. */
function exchangedBySettle(over: Partial<StartInput> = {}, prefill?: (st: AbaSessionState) => AbaSessionState): AbaSessionState {
  const begun = beginSession({ tokenTraining: trained(2), ...over });
  let st: AbaSessionState = prefill ? prefill(begun) : { ...begun, board: { ...begun.board, earned: begun.board.size - 1 } };
  expect(st.immediateExchange).toBe(true);
  let now = BASE_MS + 1000;
  for (let i = 0; i < 12; i += 1) {
    st = answerNext(st, now).state;
    now += 1000;
    if (st.queue[0]?.kind === 'access') return st;
  }
  throw new Error('обмена в settleBoard не случилось');
}

/** Повторный выбор после обмена рутины: полная доска ждала выбора, `chooseReinforcer` обменял её. */
function exchangedOnRechoose(): AbaSessionState {
  const begun = beginSession({ tokenTraining: trained(2) });
  const stale: AbaSessionState = { ...begun, reinforcerStale: true, board: { ...begun.board, earned: begun.board.size } };
  const st = chooseReinforcer(stale, stale.reinforcerOptions[0], T);
  expect(st.queue[0]?.kind).toBe('access');
  expect(exchangeEvents(st)).toHaveLength(1);
  return st;
}

describe('stopSession на кадре обмена (№181): жетоны обмена возвращаются', () => {
  it.each<[string, () => AbaSessionState]>([
    ['после finishBreak', () => exchangedOnBreak()],
    ['после settleBoard (обучение доске)', () => exchangedBySettle()],
    ['после chooseReinforcer с полной доской', exchangedOnRechoose],
  ])('%s: доска итога — вернувшиеся жетоны, доступа нет, exchange_returned один', (_name, make) => {
    const st = make();
    const tokens = exchangeEvents(st).at(-1)!.kind === 'exchange' ? (exchangeEvents(st).at(-1) as { tokens: number }).tokens : 0;
    const stopped = stopSession(st, 'adult_stopped', STEP + 1500, null);
    const r = finish(stopped, STEP + 1500);
    expect({
      earned: r.board.earned,
      returned: r.board.returned,
      returnedEvents: returnedEvents(r.session as unknown as AbaSessionState).length,
      access: accessEvents(r.session as unknown as AbaSessionState).length,
    }).toEqual({ earned: st.board.earned + tokens, returned: { tokens, fromSessionId: st.sessionId }, returnedEvents: 1, access: 0 });
  });

  it('жетон за участие после обмена не теряется: earned = вернувшиеся + текущие', () => {
    const st = onExchangeFrame();
    const plusOne = { ...st, board: { ...st.board, earned: 1, nonContingent: 1 } };
    const r = finish(stopSession(plusOne, 'adult_stopped', STEP + 1500, null), STEP + 1500);
    expect([r.board.earned, r.board.nonContingent]).toEqual([1 + st.board.size, 1]);
  });

  it('доля не за результат восстановлена: nonContingent обмена — снова на доске', () => {
    const st = onExchangeFrame({ nonContingent: 1 });
    expect(st.board.nonContingent).toBe(0);
    const r = finish(stopSession(st, 'adult_stopped', STEP + 1500, null), STEP + 1500);
    expect(r.board.nonContingent).toBe(1);
  });

  it('exchangesMade − 1: возврат и есть снятый обмен', () => {
    const st = onExchangeFrame();
    expect(stopSession(st, 'adult_stopped', STEP + 1500, null).exchangesMade).toBe(st.exchangesMade - 1);
  });

  it('tokensEarned не меняется: жетоны заработаны, вернулись только на доску', () => {
    const st = onExchangeFrame();
    const r = finish(stopSession(st, 'adult_stopped', STEP + 1500, null), STEP + 1500);
    expect(r.session.tokensEarned).toBe(st.tokensEarned);
  });

  it('событие exchange остаётся в журнале: обмен был', () => {
    const st = onExchangeFrame();
    expect(exchangeEvents(stopSession(st, 'adult_stopped', STEP + 1500, null))).toEqual(exchangeEvents(st));
  });

  it('exchange_returned — tokens, nonContingent, момент обмена и причина', () => {
    const st = onExchangeFrame({ nonContingent: 1 });
    expect(returnedEvents(stopSession(st, 'abandoned', STEP + 1500, null))).toEqual([
      { kind: 'exchange_returned', at: iso(STEP + 1500), tokens: st.board.size, nonContingent: 1, exchangeAt: iso(STEP), reason: 'abandoned' },
    ]);
  });

  it('accessStartedAt null при голове access (кадр доступа ещё не показан) — возврат', () => {
    const st = exchangedOnBreak();
    expect(st.accessStartedAt).toBeNull();
    expect(returnedEvents(stopSession(st, 'adult_stopped', STEP + 100))).toHaveLength(1);
  });

  it('без accessScene (весь шаг) на кадре обмена — доступа в журнале всё равно нет', () => {
    expect(accessEvents(stopSession(onExchangeFrame(), 'adult_stopped', STEP + 1500))).toEqual([]);
  });

  it('сцена началась (accessShown) — возврата нет, доступ в журнале', () => {
    const st = stopSession(accessShown(onExchangeFrame()), 'adult_stopped', STEP + 9000, { startedAt: STEP + 2140 });
    expect([returnedEvents(st).length, accessEvents(st).length, st.returnedOnStop ?? null]).toEqual([0, 1, null]);
  });

  it('сцена началась — exchangesMade не уменьшается', () => {
    const st = accessShown(onExchangeFrame());
    expect(stopSession(st, 'adult_stopped', STEP + 9000, { startedAt: STEP + 2140 }).exchangesMade).toBe(st.exchangesMade);
  });

  it('холодный старт в доступе: отрезок endUnknown — возврата нет, событие access с endUnknown', () => {
    const st = stopSession(accessShown(onExchangeFrame()), 'abandoned', STEP + 9000, [{ startedAt: STEP, endedAt: STEP + 5000, endUnknown: true }]);
    expect([returnedEvents(st).length, accessEvents(st)]).toEqual([0, [{ kind: 'access', startedAt: iso(STEP), endedAt: iso(STEP + 5000), endUnknown: true }]]);
  });

  it('finishAccess с endUnknown — событие access с отметкой', () => {
    const st = finishAccess(accessShown(onExchangeFrame()), STEP + 9000, [{ startedAt: STEP, endedAt: STEP + 5000, endUnknown: true }]);
    expect(accessEvents(st)).toEqual([{ kind: 'access', startedAt: iso(STEP), endedAt: iso(STEP + 5000), endUnknown: true }]);
  });

  it('finishAccess снимает ожидание сцены: остановка после доступа не возвращает', () => {
    const st = finishAccess(onExchangeFrame(), STEP + 9000);
    expect(returnedEvents(stopSession(st, 'adult_stopped', STEP + 9500))).toEqual([]);
  });

  it('переполненная доска: возвращаются все жетоны обмена, включая сверх доски', () => {
    const st = onExchangeFrame({ earned: 4 });
    const r = finish(stopSession(st, 'adult_stopped', STEP + 1500, null), STEP + 1500);
    expect([r.board.earned, r.board.returned?.tokens]).toEqual([4, 4]);
  });

  it('повторный stopSession — второго возврата нет', () => {
    const once = stopSession(onExchangeFrame(), 'adult_stopped', STEP + 1500, null);
    expect(returnedEvents(stopSession(once, 'adult_stopped', STEP + 2500, null))).toHaveLength(1);
  });

  it('повторный stopSession — exchangesMade уменьшен один раз', () => {
    const st = onExchangeFrame();
    const twice = stopSession(stopSession(st, 'adult_stopped', STEP + 1500, null), 'adult_stopped', STEP + 2500, null);
    expect(twice.exchangesMade).toBe(st.exchangesMade - 1);
  });

  it.each(['adult_stopped', 'abandoned', 'app_backgrounded', 'app_error'] as const)('причина %s — возврат с этой причиной', (reason) => {
    const r = finish(stopSession(onExchangeFrame(), reason, STEP + 1500, null), STEP + 1500);
    expect([r.board.earned, (r.session.events.find((e) => e.kind === 'exchange_returned') as { reason?: string } | undefined)?.reason]).toEqual([3, reason]);
  });

  it('withdrawAssent при голове access — доступ играется до конца, возврата нет', () => {
    let st = withdrawAssent(exchangedOnBreak(), STEP + 100, 'child_card');
    const access = nextStep(st, STEP + 200);
    expect(access.step.kind).toBe('access');
    st = finishAccess(accessShown(access.state), STEP + 50_000);
    const r = finish(nextStep(st, STEP + 50_000).state, STEP + 50_000);
    expect([returnedEvents(r.session as unknown as AbaSessionState).length, accessEvents(r.session as unknown as AbaSessionState).length]).toEqual([0, 1]);
  });

  it('отказ, потом остановка на кадре обмена — ступень доски не двигается', () => {
    const st = nextStep(withdrawAssent(exchangedOnBreak(), STEP + 100, 'child_card'), STEP + 200).state;
    const r = finish(stopSession(st, 'abandoned', STEP + 1500, null), STEP + 1500);
    expect(r.tokenTraining).toEqual(st.tokenTraining);
  });

  it('контроль: отказ и доступ доигран — ступень доски видит сессию', () => {
    const st = nextStep(withdrawAssent(exchangedOnBreak(), STEP + 100, 'child_card'), STEP + 200).state;
    const played = finishAccess(accessShown(st), STEP + 50_000);
    const r = finish(nextStep(played, STEP + 50_000).state, STEP + 50_000);
    expect(r.tokenTraining.atStage.length).toBe(st.tokenTraining.atStage.length + 1);
  });

  it('finishAbaSession после возврата и конфликта по живой доске — возврат поверх живой доски', () => {
    const stopped = stopSession(onExchangeFrame(), 'adult_stopped', STEP + 1500, null);
    const again = resumeAbaSession(stopped, { earned: 2, nonContingent: 1, rev: 7 }, { routineExchanged: false });
    const r = finish(again, STEP + 1500);
    expect([r.board.earned, r.board.nonContingent, r.board.returned?.tokens, r.boardRev]).toEqual([5, 1, 3, 7]);
  });
});

describe('следующая сессия с вернувшейся доской (№181)', () => {
  const returnedBoard = { earned: 1, nonContingent: 0, returned: { tokens: 1, fromSessionId: 'prev' } };

  it('обмен вернувшихся жетонов помечен includesReturned и сессией-источником', () => {
    const st = exchangedBySettle({ board: returnedBoard }, (s) => s);
    expect(exchangeEvents(st).at(-1)).toMatchObject({ kind: 'exchange', includesReturned: true, fromSessionId: 'prev' });
  });

  it('обмен сбрасывает метку вернувшихся', () => {
    const st = exchangedBySettle({ board: returnedBoard }, (s) => s);
    expect(st.board.returned).toBeUndefined();
  });

  it('обмен вернувшихся в ступень доски не идёт: в atStage — ноль обменов', () => {
    const st = exchangedBySettle({ board: returnedBoard }, (s) => s);
    const played = finishAccess(accessShown(nextStep(st, BASE_MS + 20_000).state), BASE_MS + 40_000);
    const r = finish(stopSession(played, 'abandoned', BASE_MS + 41_000), BASE_MS + 41_000);
    expect(r.tokenTraining.atStage.at(-1)?.exchanges).toBe(0);
  });

  it('контроль: без метки тот же обмен идёт в ступень — один обмен', () => {
    const st = exchangedBySettle({ board: { earned: 1, nonContingent: 0 } }, (s) => s);
    const played = finishAccess(accessShown(nextStep(st, BASE_MS + 20_000).state), BASE_MS + 40_000);
    const r = finish(stopSession(played, 'abandoned', BASE_MS + 41_000), BASE_MS + 41_000);
    expect(r.tokenTraining.atStage.at(-1)?.exchanges).toBe(1);
  });

  // снятый остановкой обмен вернувшихся вычитается один раз (`exchangesMade − 1` в stopSession), а не ещё раз в
  // finishAbaSession: иначе `stageExchanges = −1`, проверка `exchangeDropped && stageExchanges === 0` не срабатывает и в
  // `atStage` ложится брошенная сессия с `exchanges: −1`
  it('обмен вернувшихся снят остановкой на кадре обмена — сессия с нулём обменов ступень не решает (двойного вычета нет)', () => {
    const st = exchangedBySettle({ board: returnedBoard }, (s) => s);
    const r = finish(stopSession(st, 'abandoned', BASE_MS + 20_000, null), BASE_MS + 20_000);
    expect(r.tokenTraining).toEqual(st.tokenTraining);
  });

  it('обмен вернувшихся снят остановкой на кадре обмена — в atStage нет отрицательных обменов', () => {
    const st = exchangedBySettle({ board: returnedBoard }, (s) => s);
    const r = finish(stopSession(st, 'abandoned', BASE_MS + 20_000, null), BASE_MS + 20_000);
    expect(r.tokenTraining.atStage.filter((x) => x.exchanges < 0)).toEqual([]);
  });

  /** Перерыв кончился при доске `earned`, из них `returnedTokens` вернулись с прошлого раза: обмен, доступ доигран, сессия брошена. */
  function returnedExchangePlayed(earned: number, returnedTokens: number) {
    const worked = answerNext(beginSession(), BASE_MS + 1000).state;
    const full: AbaSessionState = {
      ...worked,
      board: { ...worked.board, earned, nonContingent: 0, returned: { tokens: returnedTokens, fromSessionId: 'prev' } },
    };
    const shown = nextStep({ ...full, queue: [{ kind: 'break', maxMs: 30_000 }, ...full.queue] }, T).state;
    const st = finishBreak(shown, STEP).state;
    const played = finishAccess(accessShown(nextStep(st, STEP).state), STEP + 50_000);
    return { st, r: finish(stopSession(played, 'abandoned', STEP + 51_000), STEP + 51_000) };
  }

  it('обмен с вернувшимися, где своих на целую доску (4 = 1 вернувшийся + 3 своих), в ступень идёт: один обмен', () => {
    const { st, r } = returnedExchangePlayed(4, 1);
    expect(exchangeEvents(st).at(-1)).toMatchObject({ includesReturned: true, returnedTokens: 1, tokens: 4 });
    expect(r.tokenTraining.atStage.at(-1)?.exchanges).toBe(1);
  });

  it('контроль: своих меньше доски (3 = 1 вернувшийся + 2 своих) — в ступени ноль обменов', () => {
    const { st, r } = returnedExchangePlayed(3, 1);
    expect(exchangeEvents(st).at(-1)).toMatchObject({ includesReturned: true, returnedTokens: 1, tokens: 3 });
    expect(r.tokenTraining.atStage.at(-1)?.exchanges).toBe(0);
  });
});
