/**
 * Фаза 8 — возобновление и закрытие свёрнутой сессии в домене: новые причины конца (`app_backgrounded`, `app_error`),
 * `finishBreak` / `finishAccess` с границами по моменту ухода, высоковероятная проба после долгого сворачивания
 * (`resumeAbaSession` при `rechoose`), ступень доски для новых причин, цепочка закрытия моментом ухода.
 */
import type { AbaSessionEndReason } from '../../types/aba';
import {
  awayOutcome,
  chooseReinforcer,
  finishAccess,
  finishBreak,
  nextStep,
  noChoiceAtEnd,
  requestBreakBetweenTrials,
  resumeAbaSession,
  stopSession,
  withdrawAssent,
  type AbaSessionState,
} from '../abaSession';
import { applyStageSession, initialTokenTraining, STAGE_WINDOW, type StageSession, type TokenTrainingState } from '../abaTokenTraining';
import { finishSession } from './abaFixtures';
import { acq, answerNext, BASE_MS, beginSession, masteredState, startedSession, tgt, trained } from './abaSessionDriver';

const iso = (ms: number) => new Date(ms).toISOString();
const LIVE = { earned: 0, nonContingent: 0, rev: 1 };
const OPTIONS = ['bubbles', 'drum', 'puzzle'];
const NEW_REASONS = ['app_backgrounded', 'app_error'] as const;

/** Сессия в перерыве по расписанию, начатом в `startedAt`. */
const atBreak = (st: AbaSessionState, startedAt: number): AbaSessionState =>
  ({ ...st, queue: [{ kind: 'break' }, ...st.queue], breakStartedAt: startedAt }) as AbaSessionState;
/** Сессия в доступе к подкрепителю, начатом в `startedAt`. */
const atAccess = (st: AbaSessionState, startedAt: number): AbaSessionState =>
  ({ ...st, queue: [{ kind: 'access', durationMs: 30_000 }, ...st.queue], accessStartedAt: startedAt }) as AbaSessionState;
const ended = (st: AbaSessionState, endReason: AbaSessionEndReason): AbaSessionState => ({ ...st, endReason, queue: [] });

/** Сессия после двух проб разогрева: в голове очереди — проба базовой линии цели N (не high_p). */
function afterWarmup(): AbaSessionState {
  let st = beginSession();
  st = answerNext(st, BASE_MS + 1000).state;
  st = answerNext(st, BASE_MS + 2000).state;
  const head = st.queue[0];
  expect(head.kind === 'trial' && head.trial.kind === 'baseline' && head.trial.targetId === 'N').toBe(true); // предпосылка
  return st;
}

const trialKinds = (st: AbaSessionState) => st.queue.filter((q) => q.kind === 'trial').map((q) => (q.kind === 'trial' ? q.trial : null)!);

// --- 1. stopSession с новыми причинами ---------------------------------------------------------

describe.each(NEW_REASONS)('stopSession(%s, leftAt)', (reason) => {
  const LEFT = BASE_MS + 70_000;

  it('ставит причину и снимает очередь', () => {
    const stopped = stopSession(beginSession(), reason, LEFT);
    expect([stopped.endReason, stopped.queue]).toEqual([reason, []]);
  });

  it('открытый перерыв закрывается моментом ухода, а не часами позже', () => {
    const stopped = stopSession(atBreak(beginSession(), BASE_MS + 10_000), reason, LEFT);
    expect(stopped.events.at(-1)).toEqual({ kind: 'break', startedAt: iso(BASE_MS + 10_000), endedAt: iso(LEFT), initiatedBy: 'schedule' });
    expect(stopped.breakStartedAt).toBeNull();
  });

  it('открытый доступ закрывается моментом ухода', () => {
    const stopped = stopSession(atAccess(beginSession(), BASE_MS + 10_000), reason, LEFT);
    expect(stopped.events.at(-1)).toEqual({ kind: 'access', startedAt: iso(BASE_MS + 10_000), endedAt: iso(LEFT) });
    expect(stopped.accessStartedAt).toBeNull();
  });

  it('первая причина побеждает: повторная остановка другой причиной её не меняет', () => {
    const other = reason === 'app_error' ? 'app_backgrounded' : 'app_error';
    const twice = stopSession(stopSession(beginSession(), reason, LEFT), other, LEFT + 1000);
    expect(twice.endReason).toBe(reason);
    expect(stopSession(stopSession(beginSession(), 'adult_stopped', LEFT), reason, LEFT + 1000).endReason).toBe('adult_stopped');
  });
});

// --- 2. finishAbaSession: обмена и цикла сопряжения нет ---------------------------------------

describe.each(NEW_REASONS)('finishAbaSession при %s', (reason) => {
  it('полная доска не обменивается: жетоны остаются на доске', () => {
    const r = finishSession(ended(beginSession({ board: { earned: 5, nonContingent: 0 } }), reason), BASE_MS + 60_000);
    expect([r.exchanged, r.session.exchangesMade, r.board.earned]).toEqual([0, 0, 5]);
    expect(r.session.events.filter((e) => e.kind === 'exchange')).toEqual([]);
  });

  it('события pairing нет', () => {
    const r = finishSession(ended(beginSession(), reason), BASE_MS + 60_000);
    expect(r.session.events.filter((e) => e.kind === 'pairing')).toEqual([]);
    expect(r.session.endReason).toBe(reason);
  });

  it('сессия из одной базовой линии: экран конца без цикла сопряжения', () => {
    const N = tgt('N');
    const st = beginSession({ targets: [N], states: {} });
    expect([st.teachingTargetIds, st.highPTargetIds]).toEqual([[], []]); // предпосылка: только базовая линия
    const step = nextStep(stopSession(st, reason, BASE_MS + 30_000), BASE_MS + 31_000).step;
    expect(step).toMatchObject({ kind: 'end', reason, pairingCycle: false });
  });

  it('контроль: та же сессия, законченная по отказу после начала работы, цикл сопряжения даёт', () => {
    const N = tgt('N');
    const st = beginSession({ targets: [N], states: {} });
    const step = nextStep(ended(st, 'assent_withdrawn'), BASE_MS + 31_000).step;
    expect(step).toMatchObject({ kind: 'end', pairingCycle: true });
  });
});

// --- 3. applyStageSession ---------------------------------------------------------------------

describe('applyStageSession: новые причины конца', () => {
  const ses = (exchanges: number, over: Partial<StageSession> = {}): StageSession => ({ sessionIndex: 1, exchanges, endReason: 'completed', ...over });
  const at = (stage: 1 | 2 | 3, atStage: StageSession[]): TokenTrainingState => ({ ...initialTokenTraining(), pairingDone: true, stage, atStage });
  /** Одна хорошая сессия в окне: следующая хорошая подняла бы ступень. */
  const oneGood = () => at(2, Array.from({ length: STAGE_WINDOW - 1 }, () => ses(2)));
  /** Одна пустая сессия в окне: следующая пустая или брошенная опустила бы ступень. */
  const oneEmpty = () => at(2, Array.from({ length: STAGE_WINDOW - 1 }, () => ses(0)));

  it('app_backgrounded со взрослым не участвует: состояние прежнее', () => {
    const t = oneGood();
    expect(applyStageSession(t, '7', ses(2, { endReason: 'app_backgrounded', config: 'with_adult' }))).toBe(t);
    expect(applyStageSession(oneEmpty(), '7', ses(0, { endReason: 'app_backgrounded', config: 'with_adult' })).stage).toBe(2);
  });

  it('запись без config — как со взрослым: не участвует', () => {
    const t = oneGood();
    expect(applyStageSession(t, '7', ses(2, { endReason: 'app_backgrounded' }))).toBe(t);
  });

  it('app_backgrounded в «Сам» блокирует рост: две сессии с обменами, но ступень не растёт', () => {
    const r = applyStageSession(oneGood(), '7', ses(2, { endReason: 'app_backgrounded', config: 'alone' }));
    expect(r.stage).toBe(2);
    expect(r.atStage).toHaveLength(STAGE_WINDOW);
  });

  it('app_backgrounded в «Сам» входит в falls: с пустой сессией перед ним ступень опускается', () => {
    const r = applyStageSession(oneEmpty(), '7', ses(2, { endReason: 'app_backgrounded', config: 'alone' }));
    expect(r).toMatchObject({ stage: 1, atStage: [] });
  });

  it('контроль: та же сессия в «Сам» с причиной completed поднимает ступень', () => {
    expect(applyStageSession(oneGood(), '7', ses(2, { config: 'alone' })).stage).toBe(3);
  });

  it.each(['with_adult', 'alone'] as const)('app_error (%s) не участвует ни в росте, ни в падении', (config) => {
    const good = oneGood();
    expect(applyStageSession(good, '7', ses(2, { endReason: 'app_error', config }))).toBe(good);
    const empty = oneEmpty();
    expect(applyStageSession(empty, '7', ses(0, { endReason: 'app_error', config }))).toBe(empty);
  });
});

// --- 4. resumeAbaSession при rechoose: высоковероятная проба другой цели ----------------------

describe('resumeAbaSession после 2–30 мин: высоковероятная проба другой цели перед первой пробой', () => {
  const AWAY = 5 * 60_000;

  it('ровно одна проба high_p другой освоенной цели встаёт перед первой пробой очереди', () => {
    const st = afterWarmup();
    const r = resumeAbaSession(st, LIVE, { routineExchanged: false, awayMs: AWAY, options: OPTIONS });
    const before = trialKinds(st);
    const after = trialKinds(r);
    expect(after).toHaveLength(before.length + 1);
    expect(after[0].kind).toBe('high_p');
    expect(['M1', 'M2']).toContain(after[0].targetId);
    expect(after[0].targetId).not.toBe(before[0].targetId);
    expect(after.slice(1)).toEqual(before);
    expect(r.rechooseNow).toBe(true);
  });

  it('встаёт после ведущего перерыва, а не перед ним', () => {
    const st = atBreak(afterWarmup(), BASE_MS + 3000);
    const r = resumeAbaSession(st, LIVE, { routineExchanged: false, awayMs: AWAY, options: OPTIONS });
    expect(r.queue[0].kind).toBe('break');
    expect(r.queue[1]).toMatchObject({ kind: 'trial', trial: { kind: 'high_p' } });
    expect(r.queue[2]).toEqual(st.queue[1]);
  });

  it('встаёт после ведущего доступа', () => {
    const st = atAccess(afterWarmup(), BASE_MS + 3000);
    const r = resumeAbaSession(st, LIVE, { routineExchanged: false, awayMs: AWAY, options: OPTIONS });
    expect(r.queue[0].kind).toBe('access');
    expect(r.queue[1]).toMatchObject({ kind: 'trial', trial: { kind: 'high_p' } });
  });

  it('не вставляется при same_trial (90 с)', () => {
    const st = afterWarmup();
    const r = resumeAbaSession(st, LIVE, { routineExchanged: false, awayMs: 90_000 });
    expect(r.queue).toEqual(st.queue);
    expect(awayOutcome(90_000)).toBe('same_trial');
  });

  it('не вставляется при awayMs = 0 с обменом рутины (повтор после конфликта доски)', () => {
    const st = afterWarmup();
    const r = resumeAbaSession(st, LIVE, { routineExchanged: true, awayMs: 0, options: OPTIONS });
    expect(r.queue).toEqual(st.queue);
    expect([r.reinforcerStale, r.rechooseNow]).toEqual([true, undefined]);
  });

  it('не вставляется до выбора подкрепителя (reinforcerId === null)', () => {
    const st = startedSession();
    const r = resumeAbaSession(st, LIVE, { routineExchanged: false, awayMs: AWAY, options: OPTIONS });
    expect(r.queue).toEqual(st.queue);
    expect(r.rechooseNow).toBeUndefined();
  });

  it('не вставляется, если первая проба очереди уже high_p (разогрев)', () => {
    const st = beginSession();
    expect(trialKinds(st)[0].kind).toBe('high_p'); // предпосылка
    const r = resumeAbaSession(st, LIVE, { routineExchanged: false, awayMs: AWAY, options: OPTIONS });
    expect(r.queue).toEqual(st.queue);
    expect(r.rechooseNow).toBe(true);
  });

  it('не вставляется без других освоенных целей (план без освоенных)', () => {
    const A = tgt('A');
    const st = beginSession({ targets: [A], states: { A: acq(A) } });
    expect(st.highPTargetIds).toEqual([]); // предпосылка
    const r = resumeAbaSession(st, LIVE, { routineExchanged: false, awayMs: AWAY, options: OPTIONS });
    expect(r.queue).toEqual(st.queue);
  });

  it('единственная освоенная — та же, что первая проба: другой нет, вставки нет', () => {
    const [M1, A] = [tgt('M1'), tgt('A')];
    let st = beginSession({ targets: [M1, A], states: { M1: masteredState(M1), A: acq(A) } });
    // после разогрева в голову ставим пробу самой M1: другой освоенной, кроме M1, нет
    st = answerNext(st, BASE_MS + 1000).state;
    st = answerNext(st, BASE_MS + 2000).state;
    const withM1 = { ...st, queue: [{ kind: 'trial', trial: { kind: 'teaching', targetId: 'M1', exemplarId: 'M1-1' } }, ...st.queue] } as AbaSessionState;
    const r = resumeAbaSession(withM1, LIVE, { routineExchanged: false, awayMs: AWAY, options: OPTIONS });
    expect(r.queue).toEqual(withM1.queue);
  });

  it('очередь без проб — без вставки', () => {
    const st = { ...afterWarmup(), queue: [{ kind: 'break' }] } as AbaSessionState;
    const r = resumeAbaSession(st, LIVE, { routineExchanged: false, awayMs: AWAY, options: OPTIONS });
    expect(r.queue).toEqual(st.queue);
  });

  it('вставленная проба без requeuedFromTrialId: защитное окно не открыто — просьба карточки после возврата не кончает сессию', () => {
    const st = afterWarmup();
    const r = resumeAbaSession(st, LIVE, { routineExchanged: false, awayMs: AWAY, options: OPTIONS });
    expect(trialKinds(r).every((t) => t.requeuedFromTrialId === undefined)).toBe(true);
    const now = BASE_MS + AWAY + 3000;
    const choose = nextStep(r, now);
    expect(choose.step.kind).toBe('choose_reinforcer');
    const chosen = chooseReinforcer(choose.state, OPTIONS[0], now + 1000);
    const asked = requestBreakBetweenTrials(chosen, now + 2000);
    expect(asked.endReason).toBeNull();
    expect(asked.queue[0]).toMatchObject({ kind: 'break', initiatedBy: 'child_card', between: true });
  });

  it('после нового выбора первой идёт вставленная высоковероятная проба', () => {
    const r = resumeAbaSession(afterWarmup(), LIVE, { routineExchanged: false, awayMs: AWAY, options: OPTIONS });
    const now = BASE_MS + AWAY + 3000;
    const chosen = chooseReinforcer(nextStep(r, now).state, OPTIONS[1], now + 1000);
    const step = nextStep(chosen, now + 2000).step;
    expect(step).toMatchObject({ kind: 'trial', trialKind: 'high_p' });
  });
});

// --- 5. finishBreak(state, now, until) ---------------------------------------------------------

describe('finishBreak с моментом конца перерыва', () => {
  const BREAK_AT = BASE_MS + 60_000;
  const UNTIL = BREAK_AT + 90_000;
  const BACKGROUND = 25 * 60_000;
  const NOW = UNTIL + BACKGROUND;

  it('событие break кончается в until, а не в now', () => {
    const { state } = finishBreak(atBreak(beginSession(), BREAK_AT), NOW, UNTIL);
    expect(state.events.at(-1)).toEqual({ kind: 'break', startedAt: iso(BREAK_AT), endedAt: iso(UNTIL), initiatedBy: 'schedule' });
  });

  it('pausedMs включает весь отрезок до now: фон — не работа', () => {
    const st = atBreak(beginSession(), BREAK_AT);
    const { state } = finishBreak(st, NOW, UNTIL);
    expect(state.pausedMs).toBe(st.pausedMs + (NOW - BREAK_AT));
    expect(state.breakStartedAt).toBeNull();
  });

  it('25 мин фона в перерыве не доводят сессию до лимита времени', () => {
    const { state } = finishBreak(atBreak(beginSession(), BREAK_AT), NOW, UNTIL);
    const step = nextStep(state, NOW + 1000).step;
    expect(step.kind === 'end' && step.reason === 'time_limit').toBe(false);
    expect(step.kind).toBe('trial');
  });

  it('until позже now не растягивает событие: конец — now', () => {
    const { state } = finishBreak(atBreak(beginSession(), BREAK_AT), UNTIL, UNTIL + 5000);
    expect(state.events.at(-1)).toMatchObject({ kind: 'break', endedAt: iso(UNTIL) });
  });

  it('без третьего аргумента — прежнее поведение: конец и пауза по now', () => {
    const st = atBreak(beginSession(), BREAK_AT);
    const { state } = finishBreak(st, UNTIL);
    expect(state.events.at(-1)).toMatchObject({ kind: 'break', startedAt: iso(BREAK_AT), endedAt: iso(UNTIL) });
    expect(state.pausedMs).toBe(st.pausedMs + (UNTIL - BREAK_AT));
  });
});

// --- 6. finishAccess с отрезками сцены -------------------------------------------------------

describe('finishAccess с отрезками сцены', () => {
  const ACCESS_AT = BASE_MS + 10_000;
  const NOW = ACCESS_AT + 120_000;
  const seg = (from: number, to: number) => ({ startedAt: ACCESS_AT + from, endedAt: ACCESS_AT + to });
  const accessEvents = (st: AbaSessionState) => st.events.filter((e) => e.kind === 'access');

  it('два отрезка → два события access с этими границами, по порядку', () => {
    const r = finishAccess(atAccess(beginSession(), ACCESS_AT), NOW, [seg(1000, 15_000), seg(60_000, 76_000)]);
    expect(accessEvents(r)).toEqual([
      { kind: 'access', startedAt: iso(ACCESS_AT + 1000), endedAt: iso(ACCESS_AT + 15_000) },
      { kind: 'access', startedAt: iso(ACCESS_AT + 60_000), endedAt: iso(ACCESS_AT + 76_000) },
    ]);
  });

  it('один отрезок до момента ухода → одно событие до него', () => {
    const r = finishAccess(atAccess(beginSession(), ACCESS_AT), NOW, [seg(1000, 15_000)]);
    expect(accessEvents(r)).toEqual([{ kind: 'access', startedAt: iso(ACCESS_AT + 1000), endedAt: iso(ACCESS_AT + 15_000) }]);
  });

  it('пустой массив → события нет, шаг доступа снят', () => {
    const st = atAccess(beginSession(), ACCESS_AT);
    const r = finishAccess(st, NOW, []);
    expect(accessEvents(r)).toEqual([]);
    expect([r.accessStartedAt, r.queue]).toEqual([null, st.queue.slice(1)]);
  });

  it('старая сигнатура с объектом — одно событие по нему', () => {
    const r = finishAccess(atAccess(beginSession(), ACCESS_AT), NOW, seg(2000, 32_000));
    expect(accessEvents(r)).toEqual([{ kind: 'access', startedAt: iso(ACCESS_AT + 2000), endedAt: iso(ACCESS_AT + 32_000) }]);
  });

  it('без сцены — весь шаг доступа, от начала до now', () => {
    const r = finishAccess(atAccess(beginSession(), ACCESS_AT), NOW);
    expect(accessEvents(r)).toEqual([{ kind: 'access', startedAt: iso(ACCESS_AT), endedAt: iso(NOW) }]);
  });

  it.each([
    ['два отрезка', [seg(1000, 15_000), seg(60_000, 76_000)]],
    ['пустой массив', []],
    ['без сцены', undefined],
  ] as const)('pausedMs считается через now, а не по отрезкам (%s)', (_, scene) => {
    const st = atAccess(beginSession(), ACCESS_AT);
    const r = finishAccess(st, NOW, scene as Parameters<typeof finishAccess>[2]);
    expect(r.pausedMs).toBe(st.pausedMs + (NOW - ACCESS_AT));
  });
});

// --- 7. цепочка закрытия моментом ухода ------------------------------------------------------

describe('цепочка закрытия просроченной сессии', () => {
  it('снимок → resume(live, 0) → stopSession(app_backgrounded, leftAt) → finish(leftAt): endedAt — момент ухода', () => {
    const snapshot = afterWarmup();
    const leftAt = BASE_MS + 2500;
    const live = { earned: snapshot.board.earned + 1, nonContingent: 0, rev: snapshot.boardRev + 1 };
    const resumed = resumeAbaSession(snapshot, live, { routineExchanged: false, awayMs: 0 });
    expect([resumed.board.earned, resumed.boardRev, resumed.queue]).toEqual([live.earned, live.rev, snapshot.queue]);
    const stopped = stopSession(resumed, 'app_backgrounded', leftAt);
    const r = finishSession(stopped, leftAt);
    expect(r.session.endedAt).toBe(iso(leftAt));
    expect(r.session.endReason).toBe('app_backgrounded');
    expect(r.session.endedOnSuccess).toBe(true);
    expect([r.board.earned, r.boardRev, r.exchanged]).toEqual([live.earned, live.rev, 0]);
  });

  it('снимок в перерыве: перерыв в журнале кончается моментом ухода', () => {
    const leftAt = BASE_MS + 5000;
    const snapshot = atBreak(afterWarmup(), BASE_MS + 2500);
    const stopped = stopSession(resumeAbaSession(snapshot, LIVE, { routineExchanged: false, awayMs: 0 }), 'app_backgrounded', leftAt);
    const r = finishSession(stopped, leftAt);
    expect(r.session.events.filter((e) => e.kind === 'break')).toEqual([{ kind: 'break', startedAt: iso(BASE_MS + 2500), endedAt: iso(leftAt), initiatedBy: 'schedule' }]);
  });
});

// --- 8. остановка перекрывает плановый конец ---------------------------------------------------

describe('остановка перекрывает плановый конец: ребёнка нет, обмен прошёл бы в пустоту', () => {
  const STOPS = ['app_backgrounded', 'adult_stopped', 'abandoned', 'app_error'] as const;
  const PLANNED = ['completed', 'time_limit'] as const;
  const LEFT = BASE_MS + 70_000;
  const FULL = { earned: 5, nonContingent: 0 };

  /** Снимок: план решил закончиться, закрывающая проба в очереди, доска полна — обмен в конце впереди. */
  function planEnded(endReason: AbaSessionEndReason, over: Parameters<typeof beginSession>[0] = {}): AbaSessionState {
    const st = beginSession({ board: FULL, ...over });
    const head = st.queue.find((q) => q.kind === 'trial');
    if (head?.kind !== 'trial') throw new Error('в очереди нет пробы');
    return { ...st, endReason, closingAttempts: 1, queue: [{ kind: 'trial', trial: { ...head.trial, kind: 'closing', closes: 'session' } }] };
  }
  const exchangeOrPairing = (r: ReturnType<typeof finishSession>) => r.session.events.filter((e) => e.kind === 'exchange' || e.kind === 'pairing');

  describe.each(STOPS)('%s', (stop) => {
    it.each(PLANNED)('поверх %s: обмена нет, доска цела, события pairing нет, причина — остановка', (planned) => {
      const r = finishSession(stopSession(planEnded(planned), stop, LEFT), LEFT);
      expect([r.exchanged, r.session.exchangesMade, r.board.earned]).toEqual([0, 0, 5]);
      expect(exchangeOrPairing(r)).toEqual([]);
      expect(r.session.endReason).toBe(stop);
    });

    it('закрывающая проба снята: шаг домена — конец без цикла сопряжения', () => {
      const stopped = stopSession(planEnded('completed'), stop, LEFT);
      expect(stopped.queue).toEqual([]);
      expect(nextStep(stopped, LEFT + 1000).step).toMatchObject({ kind: 'end', reason: stop, pairingCycle: false });
    });

    it('поверх breakdown: причина — остановка, цель с остановкой на месте', () => {
      const r = finishSession(stopSession({ ...planEnded('breakdown'), brokenTargetId: 'A' }, stop, LEFT), LEFT);
      expect([r.session.endReason, r.session.brokenTargetId, r.exchanged, r.board.earned]).toEqual([stop, 'A', 0, 5]);
    });

    it('ступень доски не меняется: сессия, которая подняла бы её плановым концом, не поднимает', () => {
      const training = { ...trained(2), atStage: [{ sessionIndex: 9, exchanges: 2, endReason: 'completed' as const }] };
      const snap = { ...planEnded('completed', { tokenTraining: training, board: { earned: 2, nonContingent: 0 } }), exchangesMade: 1 };
      expect(finishSession(snap, LEFT).tokenTraining.stage).toBe(3); // контроль: плановый конец поднимает
      expect(finishSession(stopSession(snap, stop, LEFT), LEFT).tokenTraining.stage).toBe(2);
    });

    it.each(STOPS.filter((other) => other !== stop))('первая остановка побеждает вторую (%s)', (second) => {
      const twice = stopSession(stopSession(planEnded('completed'), stop, LEFT), second, LEFT + 1000);
      expect(twice.endReason).toBe(stop);
    });
  });

  it.each([...PLANNED, 'assent_withdrawn'] as const)('контроль: %s без остановки обменивает полную доску', (planned) => {
    const r = finishSession(planEnded(planned), LEFT);
    expect([r.exchanged, r.board.earned]).toEqual([5, 0]);
    expect(r.session.endReason).toBe(planned);
  });

  it('плановый конец при устаревшем подкрепителе обмена не даёт: защита сама по себе, без остановки', () => {
    const r = finishSession({ ...planEnded('completed'), reinforcerStale: true }, LEFT);
    expect([r.exchanged, r.board.earned]).toEqual([0, 5]);
  });

  describe.each(['abandoned', 'app_backgrounded'] as const)('«Сам», %s поверх планового конца при полной доске', (stop) => {
    const ALONE = { config: 'alone' as const, observers: [], primaryObserverId: null };
    const ALL_PLANNED = [...PLANNED, 'breakdown'] as const;
    /** В окне одна пустая сессия: засчитанный уход опустил бы ступень. */
    const ONE_EMPTY: TokenTrainingState = { ...trained(2), atStage: [{ sessionIndex: 9, exchanges: 0, endReason: 'completed' }] };
    const alone = (planned: AbaSessionEndReason, tokenTraining: TokenTrainingState = ONE_EMPTY): AbaSessionState => ({ ...planEnded(planned, ALONE), tokenTraining });
    const stopAndFinish = (st: AbaSessionState) => finishSession(stopSession(st, stop, LEFT), LEFT);

    it.each(ALL_PLANNED)('поверх %s: ступень и её окно не меняются', (planned) => {
      expect(stopAndFinish(alone(planned)).tokenTraining).toEqual(ONE_EMPTY);
    });

    it.each(ALL_PLANNED)('поверх %s: обмена нет, жетоны целы', (planned) => {
      const r = stopAndFinish(alone(planned));
      expect([r.exchanged, r.session.exchangesMade, r.board.earned]).toEqual([0, 0, 5]);
    });

    it.each(ALL_PLANNED)('поверх %s: причина — остановка', (planned) => {
      expect(stopAndFinish(alone(planned)).session.endReason).toBe(stop);
    });

    it('контроль: доска не полна — снимать нечего, уход идёт в окно и опускает ступень', () => {
      const st = alone('completed');
      expect(stopAndFinish({ ...st, board: { ...st.board, earned: st.board.size - 1 } }).tokenTraining).toMatchObject({ stage: 1, atStage: [] });
    });

    it('настоящие обмены за сессию: сессия идёт в окно с этими обменами и причиной остановки', () => {
      const r = stopAndFinish({ ...alone('completed', trained(2)), exchangesMade: 2 });
      expect(r.tokenTraining.atStage).toEqual([expect.objectContaining({ exchanges: 2, endReason: stop, config: 'alone' })]);
    });

    it('настоящие обмены за сессию: уход засчитан, с пустой сессией в окне ступень опускается', () => {
      expect(stopAndFinish({ ...alone('completed'), exchangesMade: 2 }).tokenTraining).toMatchObject({ stage: 1, atStage: [] });
    });

    it('настоящие обмены за сессию: последняя полная доска не обменивается, жетоны целы', () => {
      const r = stopAndFinish({ ...alone('completed'), exchangesMade: 2 });
      expect([r.exchanged, r.session.exchangesMade, r.board.earned]).toEqual([0, 2, 5]);
    });
  });
});

// --- 8а. решённый конец остаётся причиной, остановка — событием журнала ----------------------------

describe('остановка после отказа: причина — решение ребёнка, остановка снимает обмен и цикл сопряжения', () => {
  const STOPS = ['app_backgrounded', 'adult_stopped', 'abandoned', 'app_error'] as const;
  const LEFT = BASE_MS + 5 * 60_000;
  const stoppedOf = (r: ReturnType<typeof finishSession>) => r.session.events.filter((e) => e.kind === 'stopped');
  const exchangeOrPairing = (r: ReturnType<typeof finishSession>) => r.session.events.filter((e) => e.kind === 'exchange' || e.kind === 'pairing');

  /** Блок цели A отработан самостоятельно (сессия на критерий), доска полна: обмен в конце впереди. */
  function worked(over: Parameters<typeof beginSession>[0] = {}): { st: AbaSessionState; at: number } {
    const A = tgt('A');
    let st = beginSession({ targets: [A], states: { A: acq(A, 0) }, ...over });
    let at = BASE_MS + 1000;
    while (st.trials.filter((t) => t.kind === 'teaching').length < A.blockSize) {
      st = answerNext(st, at).state;
      at += 2000;
    }
    return { st: { ...st, board: { ...st.board, earned: st.board.size } }, at };
  }
  /** То же, и ребёнок отказался вне пробы: конец решён (`assent_withdrawn`), обмен ещё не случился. */
  function refused(over: Parameters<typeof beginSession>[0] = {}): AbaSessionState {
    const { st, at } = worked(over);
    return withdrawAssent(st, at, 'adult_observed', { targetId: 'A', trialId: st.trials.at(-1)!.id });
  }
  /** Сессия из одной базовой линии, работа начата: конец по отказу даёт цикл сопряжения. */
  const refusedBaseline = () => withdrawAssent(beginSession({ targets: [tgt('N')], states: {} }), BASE_MS + 30_000, 'adult_observed');
  /** В окне ступени одна пустая сессия: ещё одна пустая опустит ступень. */
  const ONE_EMPTY: TokenTrainingState = { ...trained(2), atStage: Array.from({ length: STAGE_WINDOW - 1 }, (_, i) => ({ sessionIndex: 9 - i, exchanges: 0, endReason: 'completed' as const })) };

  it('контроль: без отказа сессия идёт в серию критерия — значит, она на критерий', () => {
    const { st } = worked();
    expect(finishSession({ ...st, endReason: 'completed', queue: [] }, LEFT).states.A.sessionsAtCriterion).toBe(1);
  });

  it('контроль: отказ без остановки — серия не идёт, полная доска обменивается, события stopped нет', () => {
    const r = finishSession(refused(), LEFT);
    expect([r.session.endReason, r.states.A.sessionsAtCriterion, r.exchanged, stoppedOf(r)]).toEqual(['assent_withdrawn', 0, r.session.boardSize, []]);
  });

  it('контроль: отказ без остановки в сессии из базовой линии — цикл сопряжения есть', () => {
    expect(nextStep(refusedBaseline(), LEFT).step).toMatchObject({ kind: 'end', pairingCycle: true });
  });

  describe.each(STOPS)('%s', (stop) => {
    it('причина остаётся отказом, конец не успешный', () => {
      const r = finishSession(stopSession(refused(), stop, LEFT), LEFT);
      expect([r.session.endReason, r.session.endedOnSuccess]).toEqual(['assent_withdrawn', false]);
    });

    it('сессия на критерий остаётся нейтральной: серия не продлевается', () => {
      const r = finishSession(stopSession(refused(), stop, LEFT), LEFT);
      expect([r.states.A.sessionsAtCriterion, r.states.A.criterionDays]).toEqual([0, []]);
    });

    it('обмена и pairing нет, доска цела', () => {
      const st = refused();
      const r = finishSession(stopSession(st, stop, LEFT), LEFT);
      expect([r.exchanged, r.session.exchangesMade, r.board.earned]).toEqual([0, 0, st.board.size]);
      expect(exchangeOrPairing(r)).toEqual([]);
    });

    it('в журнале одно событие stopped: кто остановил и когда', () => {
      const r = finishSession(stopSession(refused(), stop, LEFT), LEFT);
      expect(stoppedOf(r)).toEqual([{ kind: 'stopped', at: iso(LEFT), reason: stop }]);
    });

    it('сессия из одной базовой линии: цикла сопряжения нет ни в шаге, ни в журнале', () => {
      const stopped = stopSession(refusedBaseline(), stop, LEFT);
      expect(nextStep(stopped, LEFT + 1000).step).toMatchObject({ kind: 'end', reason: 'assent_withdrawn', endedOnSuccess: false, pairingCycle: false, pairingCycleAfterMs: 0 });
      expect(exchangeOrPairing(finishSession(stopped, LEFT))).toEqual([]);
    });

    it.each(STOPS.filter((other) => other !== stop))('из двух остановок действует первая (вторая — %s)', (second) => {
      const r = finishSession(stopSession(stopSession(refused(), stop, LEFT), second, LEFT + 1000), LEFT + 1000);
      expect(stoppedOf(r)).toEqual([{ kind: 'stopped', at: iso(LEFT), reason: stop }]);
      expect(r.session.endReason).toBe('assent_withdrawn');
    });

    it('unreliable_measurement остаётся причиной, остановка — событием, доска цела', () => {
      const st = ended(beginSession({ board: { earned: 5, nonContingent: 0 } }), 'unreliable_measurement');
      const r = finishSession(stopSession(st, stop, LEFT), LEFT);
      expect([r.session.endReason, r.exchanged, r.board.earned]).toEqual(['unreliable_measurement', 0, st.board.earned]);
      expect(stoppedOf(r)).toEqual([{ kind: 'stopped', at: iso(LEFT), reason: stop }]);
    });
  });

  // обмен, снятый остановкой, не считается пустой сессией: сам отказ без остановки ступень не тронул бы (контроль ниже)
  it('остановка взрослым после отказа не опускает ступень доски', () => {
    const r = finishSession(stopSession({ ...refused(), tokenTraining: ONE_EMPTY }, 'adult_stopped', LEFT), LEFT);
    expect(r.tokenTraining.stage).toBe(2);
  });

  it('контроль: тот же отказ без остановки ступень не опускает — обмен состоялся', () => {
    const r = finishSession({ ...refused(), tokenTraining: ONE_EMPTY }, LEFT);
    expect([r.exchanged > 0, r.tokenTraining.stage]).toEqual([true, 2]);
  });

  describe('обмен снят остановкой: сессия не идёт в ступень доски (`exchangeDropped`)', () => {
    /** Отказ при полной доске: обмен в конце был бы, остановка его снимает. */
    const fullBoard = () => ({ ...refused(), tokenTraining: ONE_EMPTY });
    /** Отказ при доске без одного жетона: обмена не было бы и без остановки. */
    const shortBoard = () => {
      const st = fullBoard();
      return { ...st, board: { ...st.board, earned: st.board.size - 1 } };
    };

    it.each(STOPS)('%s, доска полна: окно ступени не тронуто', (stop) => {
      expect(finishSession(stopSession(fullBoard(), stop, LEFT), LEFT).tokenTraining).toEqual(ONE_EMPTY);
    });

    it.each(STOPS)('%s, доска не полна: снимать нечего, пустая сессия опускает ступень', (stop) => {
      expect(finishSession(stopSession(shortBoard(), stop, LEFT), LEFT).tokenTraining.stage).toBe(1);
    });

    it('контроль: отказ без остановки при неполной доске ступень опускает так же', () => {
      expect(finishSession(shortBoard(), LEFT).tokenTraining.stage).toBe(1);
    });

    it('причина вне `EXCHANGE_AT_END`: обмена не было бы и без остановки, сессия идёт в окно', () => {
      const st = { ...ended(beginSession({ board: { earned: 5, nonContingent: 0 } }), 'unreliable_measurement'), tokenTraining: ONE_EMPTY };
      expect(finishSession(stopSession(st, 'abandoned', LEFT), LEFT).tokenTraining.stage).toBe(1);
    });

    it('контроль: обмен состоялся — сессия идёт в окно ступени', () => {
      expect(finishSession(fullBoard(), LEFT).tokenTraining.atStage).toHaveLength(STAGE_WINDOW);
    });
  });

  describe('«Сам», 60 с без выбора при наступившем конце (`noChoiceAtEnd`)', () => {
    const FULL = { earned: 5, nonContingent: 0 };
    const ALONE = { config: 'alone' as const, observers: [], primaryObserverId: null, board: FULL };
    /** Конец наступил, подкрепитель устарел, доска полна: домен просит новый выбор, ребёнок не выбирает. */
    function askedAtEnd(reason: AbaSessionEndReason = 'completed', over: Parameters<typeof beginSession>[0] = {}): AbaSessionState {
      const st: AbaSessionState = { ...ended(beginSession({ ...ALONE, ...over }), reason), reinforcerStale: true };
      expect(nextStep(st, LEFT).step.kind).toBe('choose_reinforcer'); // предпосылка
      return st;
    }
    const BREAK_AT = LEFT - 40_000;
    const BASELINE_ONLY = { targets: [tgt('N')], states: {} };

    it.each(['completed', 'time_limit', 'breakdown', 'assent_withdrawn'] as const)('причина %s остаётся: план выполнен, это не уход ребёнка', (reason) => {
      expect(finishSession(noChoiceAtEnd(askedAtEnd(reason), LEFT), LEFT).session.endReason).toBe(reason);
    });

    it('в журнале одно событие stopped с моментом и причиной no_choice', () => {
      const r = finishSession(noChoiceAtEnd(askedAtEnd(), LEFT), LEFT);
      expect(stoppedOf(r)).toEqual([{ kind: 'stopped', at: iso(LEFT), reason: 'no_choice' }]);
    });

    it('оборванный перерыв закрывается моментом конца, до события stopped', () => {
      const st = noChoiceAtEnd(atBreak(askedAtEnd(), BREAK_AT), LEFT);
      expect(st.events.slice(-2)).toEqual([
        { kind: 'break', startedAt: iso(BREAK_AT), endedAt: iso(LEFT), initiatedBy: 'schedule' },
        { kind: 'stopped', at: iso(LEFT), reason: 'no_choice' },
      ]);
    });

    it('оборванный перерыв снят: перерыва и очереди больше нет', () => {
      const st = noChoiceAtEnd(atBreak(askedAtEnd(), BREAK_AT), LEFT);
      expect([st.breakStartedAt, st.queue]).toEqual([null, []]);
    });

    it('перерыва не было: события break нет', () => {
      expect(noChoiceAtEnd(askedAtEnd(), LEFT).events.filter((e) => e.kind === 'break')).toEqual([]);
    });

    it('обмена нет: жетоны остаются на доске', () => {
      const r = finishSession(noChoiceAtEnd(askedAtEnd(), LEFT), LEFT);
      expect([r.exchanged, r.session.exchangesMade, r.board.earned]).toEqual([0, 0, FULL.earned]);
      expect(exchangeOrPairing(r)).toEqual([]);
    });

    it('базовая линия с устаревшим подкрепителем: цикла сопряжения нет', () => {
      expect(exchangeOrPairing(finishSession(noChoiceAtEnd(askedAtEnd('completed', BASELINE_ONLY), LEFT), LEFT))).toEqual([]);
    });

    it('контроль: та же сессия без `noChoiceAtEnd` цикл сопряжения пишет', () => {
      expect(exchangeOrPairing(finishSession(askedAtEnd('completed', BASELINE_ONLY), LEFT)).map((e) => e.kind)).toEqual(['pairing']);
    });

    it.each(['completed', 'time_limit', 'breakdown'] as const)('%s, полная доска, выбор не сделан: окно ступени не тронуто', (reason) => {
      expect(finishSession(noChoiceAtEnd({ ...askedAtEnd(reason), tokenTraining: ONE_EMPTY }, LEFT), LEFT).tokenTraining).toEqual(ONE_EMPTY);
    });

    it('контроль: без `noChoiceAtEnd` та же сессия идёт в окно и опускает ступень', () => {
      expect(finishSession({ ...askedAtEnd(), tokenTraining: ONE_EMPTY }, LEFT).tokenTraining.stage).toBe(1);
    });

    it('остановка после него не пишет второе stopped', () => {
      const st = stopSession(noChoiceAtEnd(askedAtEnd('assent_withdrawn'), LEFT), 'adult_stopped', LEFT + 1000);
      expect(st.events.filter((e) => e.kind === 'stopped')).toHaveLength(1);
    });

    it('настоящие обмены за сессию: выбор не сделан, но сессия идёт в окно ступени', () => {
      const r = finishSession(noChoiceAtEnd({ ...askedAtEnd(), tokenTraining: trained(2), exchangesMade: 2 }, LEFT), LEFT);
      expect(r.tokenTraining.atStage).toEqual([expect.objectContaining({ exchanges: 2, endReason: 'completed' })]);
    });

    describe.each(['completed', 'time_limit', 'breakdown'] as const)('вторая остановка после noChoiceAtEnd с причиной %s', (reason) => {
      const twice = (stop: (typeof STOPS)[number]) => stopSession(noChoiceAtEnd(askedAtEnd(reason), LEFT), stop, LEFT + 1000);

      it.each(STOPS)('%s: причина конца не меняется', (stop) => {
        expect(finishSession(twice(stop), LEFT + 1000).session.endReason).toBe(reason);
      });

      it.each(STOPS)('%s: в журнале только запись о том, что выбора не было', (stop) => {
        expect(twice(stop).events.filter((e) => e.kind === 'stopped')).toEqual([{ kind: 'stopped', at: iso(LEFT), reason: 'no_choice' }]);
      });
    });

    it.each(STOPS)('контроль: %s без noChoiceAtEnd плановую причину перекрывает', (stop) => {
      expect(stopSession(askedAtEnd('completed'), stop, LEFT).endReason).toBe(stop);
    });
  });
});

// --- 8б. перерыв по просьбе после лимита: возврата нет --------------------------------------------

describe('перерыв по просьбе после лимита: конец по бездействию при уже решённом конце', () => {
  const LIMIT = 60_000;
  const FULL = { earned: 5, nonContingent: 0 };
  const ASK = BASE_MS + 30_000;
  const LIMIT_AT = BASE_MS + LIMIT + 1000;
  const NO_RETURN = LIMIT_AT + 180_000;

  /** Ребёнок попросил перерыв, лимит вышел на шаге: конец решён, перерыв по просьбе остался в очереди и начался. */
  function limitOnBreak(over: Parameters<typeof beginSession>[0] = {}): AbaSessionState {
    const next = nextStep(requestBreakBetweenTrials(beginSession({ timeLimitMs: LIMIT, ...over }), ASK), LIMIT_AT);
    expect([next.state.endReason, next.step.kind]).toEqual(['time_limit', 'break']); // предпосылка
    return next.state;
  }
  const noReturn = (st: AbaSessionState) => withdrawAssent(st, NO_RETURN, 'device_inactivity');
  const BASELINE_ONLY = { targets: [tgt('N')], states: {} };

  it('причина — лимит, а не отказ', () => {
    expect(noReturn(limitOnBreak()).endReason).toBe('time_limit');
  });

  it('перерыв снят из очереди и закрыт в журнале: приглашения не идут по кругу', () => {
    const st = noReturn(limitOnBreak());
    expect(st.queue.filter((q) => q.kind === 'break')).toEqual([]);
    expect(st.breakStartedAt).toBeNull();
    expect(st.events.filter((e) => e.kind === 'break')).toEqual([{ kind: 'break', startedAt: iso(LIMIT_AT), endedAt: iso(NO_RETURN), initiatedBy: 'child_card', between: true }]);
  });

  it('следующий шаг — конец, а не тот же перерыв', () => {
    expect(nextStep(noReturn(limitOnBreak()), NO_RETURN + 1000).step).toMatchObject({ kind: 'end', reason: 'time_limit' });
  });

  describe('шаг конца несёт `byInactivity`', () => {
    const endStep = (st: AbaSessionState) => nextStep(st, NO_RETURN + 1000).step;

    it('лимит и нет возврата: шаг помечен, хотя конец успешный', () => {
      expect(endStep(noReturn(limitOnBreak()))).toMatchObject({ kind: 'end', reason: 'time_limit', endedOnSuccess: true, byInactivity: true });
    });

    it('бездействие без решённого конца: шаг помечен, причина — отказ', () => {
      expect(endStep(withdrawAssent(beginSession(), ASK, 'device_inactivity'))).toMatchObject({ kind: 'end', reason: 'assent_withdrawn', endedOnSuccess: false, byInactivity: true });
    });

    it('контроль: ребёнок вернулся с перерыва после лимита — шаг не помечен', () => {
      const { state } = finishBreak(limitOnBreak(), NO_RETURN);
      expect(endStep(state)).toMatchObject({ kind: 'end', reason: 'time_limit', byInactivity: false });
    });

    it.each(['adult_observed', 'child_card'] as const)('контроль: отказ %s — шаг не помечен', (by) => {
      expect(endStep(withdrawAssent(beginSession(), ASK, by))).toMatchObject({ kind: 'end', reason: 'assent_withdrawn', byInactivity: false });
    });

    it('контроль: просьба о перерыве с тем же событием assent — шаг не помечен', () => {
      const st: AbaSessionState = { ...requestBreakBetweenTrials(beginSession(), ASK), endReason: 'completed', queue: [] };
      expect(endStep(st)).toMatchObject({ kind: 'end', reason: 'completed', byInactivity: false });
    });
  });

  it('обмена нет, доска цела', () => {
    const r = finishSession(noReturn(limitOnBreak({ board: FULL })), NO_RETURN);
    expect([r.exchanged, r.session.exchangesMade, r.board.earned]).toEqual([0, 0, 5]);
    expect(r.session.events.filter((e) => e.kind === 'exchange')).toEqual([]);
  });

  it('контроль: лимит без бездействия полную доску обменивает', () => {
    const st = limitOnBreak({ board: FULL });
    const r = finishSession({ ...st, queue: [], breakStartedAt: null }, NO_RETURN);
    expect([r.session.endReason, r.exchanged]).toEqual(['time_limit', 5]);
  });

  it('цикла сопряжения нет ни в шаге, ни в журнале', () => {
    const st = noReturn(limitOnBreak(BASELINE_ONLY));
    expect(nextStep(st, NO_RETURN + 1000).step).toMatchObject({ kind: 'end', pairingCycle: false });
    expect(finishSession(st, NO_RETURN).session.events.filter((e) => e.kind === 'pairing')).toEqual([]);
  });

  it('контроль: ребёнок вернулся с перерыва после лимита — цикл сопряжения есть', () => {
    const { state } = finishBreak(limitOnBreak(BASELINE_ONLY), NO_RETURN);
    expect(nextStep(state, NO_RETURN + 1000).step).toMatchObject({ kind: 'end', reason: 'time_limit', pairingCycle: true });
  });

  it('ступень доски не решает: ребёнка нет', () => {
    const training = { ...trained(2), atStage: [{ sessionIndex: 9, exchanges: 2, endReason: 'completed' as const }] };
    const st = limitOnBreak({ tokenTraining: training, board: { earned: 2, nonContingent: 0 } });
    expect(finishSession(noReturn({ ...st, exchangesMade: 2 }), NO_RETURN).tokenTraining).toEqual(st.tokenTraining);
  });

  it('отказ взрослого при уже решённом конце ничего не меняет', () => {
    const st = limitOnBreak();
    expect(withdrawAssent(st, NO_RETURN, 'adult_observed')).toBe(st);
  });

  describe('обычный assent_withdrawn не задет', () => {
    it.each(['adult_observed', 'child_card'] as const)('%s: полная доска обменивается', (by) => {
      const r = finishSession(withdrawAssent(beginSession({ board: FULL }), ASK, by), NO_RETURN);
      expect([r.session.endReason, r.exchanged, r.board.earned]).toEqual(['assent_withdrawn', 5, 0]);
    });

    it.each(['adult_observed', 'child_card'] as const)('%s: сессия из одной базовой линии получает цикл сопряжения', (by) => {
      expect(nextStep(withdrawAssent(beginSession(BASELINE_ONLY), ASK, by), NO_RETURN).step).toMatchObject({ kind: 'end', pairingCycle: true });
    });

    it('device_inactivity без решённого конца: причина — отказ, обмена и сопряжения нет', () => {
      const r = finishSession(withdrawAssent(beginSession({ board: FULL }), ASK, 'device_inactivity'), NO_RETURN);
      expect([r.session.endReason, r.exchanged, r.board.earned]).toEqual(['assent_withdrawn', 0, 5]);
      expect(nextStep(withdrawAssent(beginSession(BASELINE_ONLY), ASK, 'device_inactivity'), NO_RETURN).step).toMatchObject({ kind: 'end', pairingCycle: false });
    });

    it('просьба о перерыве с тем же событием assent не считается бездействием', () => {
      const r = finishSession({ ...requestBreakBetweenTrials(beginSession({ board: FULL }), ASK), endReason: 'completed', queue: [] }, NO_RETURN);
      expect(r.exchanged).toBe(5);
    });
  });
});

// --- 8в. новый выбор только там, где в конце будет обмен --------------------------------------------

describe('устаревший подкрепитель и полная доска: выбор не просится, если обмена в конце не будет', () => {
  const STOPS = ['app_backgrounded', 'adult_stopped', 'abandoned', 'app_error'] as const;
  const ALONE = { config: 'alone' as const, observers: [], primaryObserverId: null };
  const FULL = { earned: 5, nonContingent: 0 };
  const AT = BASE_MS + 5 * 60_000;
  const stepOf = (st: AbaSessionState) => nextStep(st, AT + 1000).step;
  /** Сессия идёт, подкрепитель устарел, доска полна: конец ещё не решён. */
  const running = (): AbaSessionState => ({ ...beginSession({ ...ALONE, board: FULL }), reinforcerStale: true });
  /** Конец решён, очередь пуста, подкрепитель устарел, доска полна. */
  const decided = (reason: AbaSessionEndReason): AbaSessionState => ended(running(), reason);

  it.each(['completed', 'time_limit', 'breakdown', 'assent_withdrawn'] as const)('контроль: причина %s без остановки выбор просит', (reason) => {
    expect(stepOf(decided(reason)).kind).toBe('choose_reinforcer');
  });

  it('контроль: отказ не по бездействию выбор просит', () => {
    expect(stepOf(withdrawAssent(running(), AT, 'adult_observed')).kind).toBe('choose_reinforcer');
  });

  it('бездействие без решённого конца: следующий шаг — конец с byInactivity', () => {
    expect(stepOf(withdrawAssent(running(), AT, 'device_inactivity'))).toMatchObject({ kind: 'end', reason: 'assent_withdrawn', byInactivity: true });
  });

  it.each(['completed', 'time_limit', 'breakdown'] as const)('бездействие при решённом конце %s: следующий шаг — конец с byInactivity', (reason) => {
    expect(stepOf(withdrawAssent(decided(reason), AT, 'device_inactivity'))).toMatchObject({ kind: 'end', reason, byInactivity: true });
  });

  it('unreliable_measurement: следующий шаг — конец', () => {
    expect(stepOf(decided('unreliable_measurement'))).toMatchObject({ kind: 'end', reason: 'unreliable_measurement', byInactivity: false });
  });

  it.each(STOPS)('unreliable_measurement и остановка %s: следующий шаг — конец', (stop) => {
    expect(stepOf(stopSession(decided('unreliable_measurement'), stop, AT))).toMatchObject({ kind: 'end', reason: 'unreliable_measurement', byInactivity: false });
  });

  it.each(['completed', 'time_limit', 'breakdown', 'assent_withdrawn'] as const)('stoppedAfterEnd от noChoiceAtEnd при %s: следующий шаг — конец', (reason) => {
    expect(stepOf(noChoiceAtEnd(decided(reason), AT))).toMatchObject({ kind: 'end', reason, byInactivity: false });
  });

  it.each(STOPS)('stoppedAfterEnd от остановки %s после отказа: следующий шаг — конец', (stop) => {
    expect(stepOf(stopSession(withdrawAssent(running(), AT, 'adult_observed'), stop, AT))).toMatchObject({ kind: 'end', reason: 'assent_withdrawn', byInactivity: false });
  });

  describe('последняя проба провалена, закрывающая в очереди', () => {
    /**
     * Обучение доске (обмен сразу), «Сам»: лимит вышел после провала, в очереди закрывающая проба, подкрепитель устарел,
     * доска полна — домен просит новый выбор раньше пробы.
     */
    function closingPending() {
      let st = beginSession({ ...ALONE, tokenTraining: trained(2) });
      st = answerNext(st, BASE_MS + 1000).state;
      st = answerNext(st, BASE_MS + 3000).state;
      const failed = { ...st.trials.at(-1)!, response: 'no_response' as const };
      return nextStep({ ...st, trials: [...st.trials.slice(0, -1), failed], board: { ...st.board, earned: st.board.size }, reinforcerStale: true, timeLimitMs: 1 }, AT);
    }

    it('предпосылка: конец решён лимитом, выбор просится при закрывающей пробе в очереди', () => {
      const { state, step } = closingPending();
      expect([state.endReason, step.kind]).toEqual(['time_limit', 'choose_reinforcer']);
      expect(state.queue).toEqual([expect.objectContaining({ kind: 'trial', trial: expect.objectContaining({ kind: 'closing' }) })]);
    });

    // ребёнка нет: nextStep не ставит закрывающую пробу заново, отсутствующему требование не предъявляется
    it('после noChoiceAtEnd следующий шаг — конец, а не закрывающая проба', () => {
      expect(stepOf(noChoiceAtEnd(closingPending().state, AT))).toMatchObject({ kind: 'end', reason: 'time_limit', byInactivity: false });
    });

    // та же причина: withdrawAssent снял закрывающую пробу, nextStep тут же вернул новую
    it('после бездействия следующий шаг — конец с byInactivity, а не закрывающая проба', () => {
      expect(stepOf(withdrawAssent(closingPending().state, AT, 'device_inactivity'))).toMatchObject({ kind: 'end', reason: 'time_limit', byInactivity: true });
    });
  });
});

describe('stopSession со сценой из отрезков', () => {
  const ACCESS_AT = BASE_MS + 10_000;
  const STOP = ACCESS_AT + 60_000;
  const accessEvents = (st: AbaSessionState) => st.events.filter((e) => e.kind === 'access');

  it('выданный отрезок и открытый текущий: по событию на отрезок, открытый кончается остановкой', () => {
    const st = stopSession(atAccess(beginSession(), ACCESS_AT), 'adult_stopped', STOP, [
      { startedAt: ACCESS_AT + 2000, endedAt: ACCESS_AT + 5000 },
      { startedAt: ACCESS_AT + 40_000 },
    ]);
    expect(accessEvents(st)).toEqual([
      { kind: 'access', startedAt: iso(ACCESS_AT + 2000), endedAt: iso(ACCESS_AT + 5000) },
      { kind: 'access', startedAt: iso(ACCESS_AT + 40_000), endedAt: iso(STOP) },
    ]);
  });

  it('пустой массив: сцены не было, доступа в журнале нет, шаг снят', () => {
    const st = stopSession(atAccess(beginSession(), ACCESS_AT), 'app_error', STOP, []);
    expect(accessEvents(st)).toEqual([]);
    expect(st.accessStartedAt).toBeNull();
  });

  it('доступа нет: отрезки игнорируются, журнал не получает лишнего события', () => {
    expect(accessEvents(stopSession(beginSession(), 'adult_stopped', STOP, [{ startedAt: ACCESS_AT }]))).toEqual([]);
  });
});
