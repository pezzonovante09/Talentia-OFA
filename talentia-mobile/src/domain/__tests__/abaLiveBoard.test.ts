/**
 * «Живая доска» (Р3, решения №94 и №95): доска на устройстве — единственный источник жетонов для
 * сессии и прогона рутины. Здесь домен: выплата прогона по доске на момент фиксации
 * (`settleRoutineBoard`), возобновление сессии (`resumeAbaSession`, `reinforcerStale`), ступень
 * доски при обмене рутины в окне сессии. Хранилище и гонки — `services/local/__tests__/liveBoard.test.ts`.
 */
import { finishRoutineRun, settleRoutineBoard, startRoutineRun, type RoutineClaim } from '../abaRoutineRun';
import {
  chooseReinforcer,
  finishAbaSession,
  finishAccess,
  finishBreak,
  nextStep,
  resumeAbaSession,
  stopSession,
  type AbaSessionState,
} from '../abaSession';
import { addTokens, REINFORCER_CHOICES, reinforcerChoices, type TokenBoard } from '../abaTokens';
import { applyStageSession, initialTokenTraining, type BoardStage, type StageSession, type TokenTrainingState } from '../abaTokenTraining';
import { seeded } from '../abaRandom';
import { answerNext, BASE_MS, beginSession, POOL, startedSession, trained } from './abaSessionDriver';
import { finishSession, NO_HISTORY } from './abaFixtures';

const NONE: RoutineClaim = { token: null, tokens: 0, nonContingent: false };
const WORK: RoutineClaim = { token: 'at_start_level', tokens: 1, nonContingent: false };
const PARTICIPATION: RoutineClaim = { token: 'participation', tokens: 1, nonContingent: true };

const settle = (
  live: { earned: number; nonContingent: number },
  size: BoardStage,
  claim: RoutineClaim,
  history: string[] = [],
  seed = 7,
) => settleRoutineBoard(live, size, claim, { pool: POOL, history, seed, apart: [] });

describe('settleRoutineBoard: выплата прогона по живой доске', () => {
  it('Т1: без обмена жетон прогона ложится на доску, как она лежит сейчас', () => {
    const s = settle({ earned: 2, nonContingent: 1 }, 5, WORK);
    expect(s).toEqual({ board: { earned: 3, nonContingent: 1 }, token: 'at_start_level' });
  });

  it('прогон без жетона доску не меняет и обмена не даёт', () => {
    const s = settle({ earned: 4, nonContingent: 2 }, 5, NONE);
    expect(s).toEqual({ board: { earned: 4, nonContingent: 2 }, token: null });
  });

  it('Т2: размер 3, на доске 2 — жетон прогона заполняет доску: предложение обмена на все жетоны, доска НЕ обнуляется', () => {
    const s = settle({ earned: 2, nonContingent: 0 }, 3, WORK);
    expect(s.offer).toMatchObject({ tokens: 3, boardSize: 3 });
    expect(s.board).toEqual({ earned: 3, nonContingent: 0 });
  });

  it('Т2: предложение не уносит жетоны — повторный расчёт без жетона нового предложения не делает', () => {
    const first = settle({ earned: 2, nonContingent: 0 }, 3, WORK);
    const second = settle(first.board, 3, NONE);
    expect([second.offer, second.board.earned]).toEqual([undefined, 3]);
  });

  it('предложение несёт ровно REINFORCER_CHOICES вариантов из пула и размер доски на момент расчёта', () => {
    const s = settle({ earned: 4, nonContingent: 0 }, 5, WORK);
    expect(s.offer?.boardSize).toBe(5);
    expect(s.offer?.options).toHaveLength(REINFORCER_CHOICES);
    for (const o of s.offer!.options) expect(POOL).toContain(o);
  });

  it('Т3: обратный порядок — сессия обменяла раньше, прогон ложится на пустую доску без обмена', () => {
    const afterSessionExchange: TokenBoard = { size: 3, earned: 0, nonContingent: 0 };
    const s = settle(afterSessionExchange, 3, WORK);
    expect([s.offer, s.board.earned]).toEqual([undefined, 1]);
  });

  it('Т5: жетон за участие не помещается, когда не за результат уже size − 1', () => {
    const s = settle({ earned: 4, nonContingent: 4 }, 5, PARTICIPATION);
    expect(s).toEqual({ board: { earned: 4, nonContingent: 4 }, token: null });
  });

  it('Т5: до лимита жетон за участие выплачивается и растёт счёт не за результат', () => {
    const s = settle({ earned: 3, nonContingent: 3 }, 5, PARTICIPATION);
    expect(s).toEqual({ board: { earned: 4, nonContingent: 4 }, token: 'participation' });
  });

  it('Т5: лимит считается от размера доски сейчас: на доске из трёх — два', () => {
    expect(settle({ earned: 2, nonContingent: 2 }, 3, PARTICIPATION).token).toBeNull();
    expect(settle({ earned: 1, nonContingent: 1 }, 3, PARTICIPATION).token).toBe('participation');
  });

  it('Т5: жетон за результат лимитом не ограничен — последний жетон доски оплачен ответом', () => {
    const s = settle({ earned: 4, nonContingent: 4 }, 5, WORK);
    expect(s.offer?.tokens).toBe(5);
    expect(s.token).toBe('at_start_level');
  });

  it('Т8: ступень упала 5 → 3, на доске 5, прогон выплатил жетон — предложены все шесть, а не три; доска остаётся с шестью', () => {
    const s = settle({ earned: 5, nonContingent: 0 }, 3, WORK);
    expect(s.offer?.tokens).toBe(6);
    expect(s.board.earned).toBe(6);
  });

  it('Т8: ступень упала 5 → 3, на доске 4 и жетон прогона — предложение на пять', () => {
    const s = settle({ earned: 4, nonContingent: 0 }, 3, WORK);
    expect(s.offer?.tokens).toBe(5);
  });

  it('Т8: ступень упала 5 → 3, на доске 5, прогон без жетона — доска в покое не предлагается', () => {
    const s = settle({ earned: 5, nonContingent: 0 }, 3, NONE);
    expect([s.offer, s.board.earned]).toEqual([undefined, 5]);
  });

  it('Т8: ступень выросла 3 → 5 — трёх жетонов с жетоном прогона на обмен не хватает', () => {
    expect(settle({ earned: 3, nonContingent: 0 }, 5, WORK).offer).toBeUndefined();
    expect(settle({ earned: 3, nonContingent: 0 }, 3, WORK).offer?.tokens).toBe(4);
  });

  it('В4: срыв (заявка без жетона) на полной доске — предложения нет, доска прежняя', () => {
    const s = settle({ earned: 5, nonContingent: 1 }, 5, NONE);
    expect(s).toEqual({ board: { earned: 5, nonContingent: 1 }, token: null });
  });

  it('В4: жетон за участие не поместился (лимит) на полной доске — предложения нет', () => {
    const s = settle({ earned: 4, nonContingent: 4 }, 5, PARTICIPATION);
    expect([s.offer, s.token, s.board.earned]).toEqual([undefined, null, 4]);
  });

  it('полная доска и прогон с жетоном — предложение на все жетоны, включая заработанный прогоном; на доске их шесть (больше размера)', () => {
    const s = settle({ earned: 5, nonContingent: 0 }, 5, WORK);
    expect([s.offer?.tokens, s.board.earned]).toEqual([6, 6]);
  });

  it('Т9: выбранное дважды подряд в вариантах предложения не предлагается — по живой истории', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const s = settle({ earned: 4, nonContingent: 0 }, 5, WORK, ['drum', 'kaleidoscope', 'kaleidoscope'], seed);
      expect(s.offer?.options).toHaveLength(REINFORCER_CHOICES);
      expect(s.offer?.options).not.toContain('kaleidoscope');
    }
  });

  it('Т10: затравка прогона даёт те же варианты при каждом пересчёте', () => {
    const live = { earned: 4, nonContingent: 0 };
    expect(settle(live, 5, WORK, ['a', 'b'], 99).offer?.options).toEqual(settle(live, 5, WORK, ['a', 'b'], 99).offer?.options);
  });

  it('входную доску не изменяет', () => {
    const live = Object.freeze({ earned: 4, nonContingent: 1 });
    expect(() => settle(live, 5, WORK)).not.toThrow();
    expect(live).toEqual({ earned: 4, nonContingent: 1 });
  });
});

describe('finishRoutineRun: доски в итоге прогона нет', () => {
  it('итог несёт заявку, полосу, пул и затравку — решение о жетоне принимает хранилище', () => {
    // базовая линия: любой прогон звеньев — заявка на жетон за участие
    const R = {
      id: 'R',
      programId: 'p-self',
      format: 'do_action' as const,
      band: '7' as const,
      level: 'cross' as const,
      area: 'self_care' as const,
      sdKind: 'instruction' as const,
      sdKey: 'sd.R',
      chaining: 'total_task' as const,
      steps: [{ id: 'R-s1', order: 1, sdKey: 'sd.R.1', criterionKey: 'c.R.1', modelKey: 'm.R.1', image: 'img-R-1' }],
      exemplars: [{ id: 'R-e', role: 'teaching' as const, targetKey: 'k', modelKey: 'm', partialModelKeys: [] }],
      delayMs: 3000,
      delayMode: 'constant' as const,
      blockSize: 5 as const,
      scoredBy: 'adult' as const,
    };
    const run = startRoutineRun({
      runId: 'run-1',
      day: '2026-10-12',
      target: R,
      band: '5-6',
      tokenTraining: trained(3),
      reinforcerPool: POOL,
      primaryObserverId: null,
      startedAt: BASE_MS,
      seed: 31,
    });
    const interrupted = { ...run, interrupted: 'external' as const, status: 'finished' as const, endedAt: BASE_MS + 1000 };
    const r = finishRoutineRun(interrupted, 1, NO_HISTORY);
    expect(r).toMatchObject({ band: '5-6', seed: 31, reinforcerPool: POOL, claim: NONE });
    expect(r).not.toHaveProperty('board');
    expect(r).not.toHaveProperty('token');
  });
});

describe('reinforcerChoices: правило «дважды подряд»', () => {
  it('(б) выбор взрослого считается как выбор ребёнка: два одинаковых подряд блокируют третий', () => {
    // история хранит только идентификаторы подкрепителей — кто выбрал, на правило не влияет
    for (let seed = 1; seed <= 40; seed += 1) {
      expect(reinforcerChoices(POOL, ['bubbles', 'drum', 'drum'], seeded(seed).rng)).not.toContain('drum');
    }
  });

  it('один выбор, или два разных подряд — ничего не блокирует', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 1) for (const o of reinforcerChoices(POOL, ['bubbles', 'drum'], seeded(seed).rng)) seen.add(o);
    expect(seen).toEqual(new Set(POOL));
  });
});

// ---------------------------------------------------------------------------

describe('(а) ступень доски: сессия с нулём обменов при обмене рутины в её окне', () => {
  const ses = (exchanges: number, endReason: StageSession['endReason'] = 'completed', sessionIndex = 1): StageSession => ({
    sessionIndex,
    exchanges,
    endReason,
  });
  const at = (stage: BoardStage, atStage: StageSession[] = []): TokenTrainingState => ({
    ...initialTokenTraining(),
    pairingDone: true,
    stage,
    atStage,
  });

  it('не засчитывается: ни вниз, ни вверх, окно прежнее (тот же объект)', () => {
    const t = at(3, [ses(0)]);
    expect(applyStageSession(t, '7', { ...ses(0), routineExchangeInWindow: true })).toBe(t);
  });

  it('без обмена рутины те же две сессии с нулём обменов опускают ступень', () => {
    expect(applyStageSession(at(3, [ses(0)]), '7', ses(0)).stage).toBe(2);
  });

  it('серию не рвёт: после такой сессии вторая настоящая с нулём обменов всё же опускает ступень', () => {
    const skipped = applyStageSession(at(3, [ses(0)]), '7', { ...ses(0), routineExchangeInWindow: true });
    expect(applyStageSession(skipped, '7', ses(0, 'completed', 3)).stage).toBe(2);
  });

  it('серию роста не рвёт: пропущенная сессия между двумя с обменами, ступень растёт', () => {
    const skipped = applyStageSession(at(2, [ses(2)]), '7', { ...ses(0), routineExchangeInWindow: true });
    expect(applyStageSession(skipped, '7', ses(3, 'completed', 3)).stage).toBe(3);
  });

  it('сессия со своими обменами при обмене рутины в окне считается как обычно', () => {
    expect(applyStageSession(at(2, [ses(2)]), '7', { ...ses(2), routineExchangeInWindow: true }).stage).toBe(3);
  });

  it('рутинные обмены в exchanges сессии не идут: одного обмена сессии мало для роста', () => {
    expect(applyStageSession(at(2, [ses(1)]), '7', { ...ses(1), routineExchangeInWindow: true }).stage).toBe(2);
  });

  describe('через finishAbaSession', () => {
    // оборванная сессия: обменов нет по построению, ступень 5 с одной записью «0 обменов»
    const abandoned = (training: TokenTrainingState): AbaSessionState =>
      stopSession({ ...beginSession({ tokenTraining: training }), sessionIndex: 11 }, 'abandoned');
    const prior = at(5, [ses(0, 'completed', 9)]);

    it('с признаком окна: ступень и окно не меняются', () => {
      const r = finishAbaSession(abandoned(prior), BASE_MS + 5000, {}, undefined, undefined, { routineExchangeInWindow: true });
      expect([r.tokenTraining.stage, r.tokenTraining.atStage]).toEqual([5, [ses(0, 'completed', 9)]]);
    });

    it('с признаком false при обмене рутины в окне (контроль): ступень решается обычно, 5 → 3', () => {
      const r = finishAbaSession(abandoned(prior), BASE_MS + 5000, {}, undefined, undefined, { routineExchangeInWindow: false });
      expect(r.tokenTraining.stage).toBe(3);
    });

    it('без признака: брошенная сессия с нулём обменов вторым подряд опускает ступень 5 → 3', () => {
      const r = finishSession(abandoned(prior), BASE_MS + 5000);
      expect(r.tokenTraining.stage).toBe(3);
    });

    it('признак пуст (JS-вызов без него) — как «обмена не было»', () => {
      const a = finishSession(abandoned(prior), BASE_MS + 5000);
      const b = finishAbaSession(abandoned(prior), BASE_MS + 5000, {}, undefined, undefined, {} as never);
      expect(b.tokenTraining).toEqual(a.tokenTraining);
    });

    it('в итог попадает версия доски, с которой сессия сверялась', () => {
      const r = finishSession({ ...abandoned(prior), boardRev: 7 }, BASE_MS + 5000);
      expect(r.boardRev).toBe(7);
    });
  });
});

// ---------------------------------------------------------------------------

describe('(в) resumeAbaSession: обмен рутины, пока сессия свёрнута', () => {
  const OPTIONS = ['paint_drop', 'kaleidoscope', 'pinwheel'];

  /** Идём по сессии до перерыва: на нём обмен, если доска полна. */
  function toBreak(state: AbaSessionState) {
    let st = state;
    let now = BASE_MS;
    for (let guard = 0; guard < 60; guard += 1) {
      now += 1000;
      const next = nextStep(st, now);
      if (next.step.kind === 'break') return { state: next.state, step: next.step, now };
      if (next.step.kind !== 'trial') throw new Error(`до перерыва встретили ${next.step.kind}`);
      st = answerNext(st, now).state;
    }
    throw new Error('перерыва нет');
  }

  it('без обмена рутины: доска и версия — с устройства, размер (3) и счётчики сессии свои, stale не ставится', () => {
    const st = { ...beginSession(), tokensEarned: 4, exchangesMade: 1 };
    const r = resumeAbaSession(st, { earned: 3, nonContingent: 1, rev: 6 }, { routineExchanged: false });
    expect(r.board).toEqual({ size: 3, earned: 3, nonContingent: 1 });
    expect([r.boardRev, r.tokensEarned, r.exchangesMade, r.reinforcerStale]).toEqual([6, 4, 1, undefined]);
    expect(r.reinforcerId).toBe(st.reinforcerId);
  });

  it('обмен рутины после выбора подкрепителя: reinforcerStale, варианты новые, утренний выбор остаётся фактом', () => {
    const st = beginSession();
    const r = resumeAbaSession(st, { earned: 0, nonContingent: 0, rev: 2 }, { routineExchanged: true, options: OPTIONS });
    expect(r.reinforcerStale).toBe(true);
    expect(r.reinforcerOptions).toEqual(OPTIONS);
    expect(r.reinforcerId).toBe(st.reinforcerId);
    expect(r.reinforcerChosenBy).toBe(st.reinforcerChosenBy);
  });

  it('обмен рутины до выбора подкрепителя: варианты обновлены, stale не ставится', () => {
    const st = startedSession();
    expect(st.reinforcerId).toBeNull();
    const r = resumeAbaSession(st, { earned: 0, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: OPTIONS });
    expect([r.reinforcerStale, r.reinforcerOptions]).toEqual([undefined, OPTIONS]);
  });

  it('обмен рутины без вариантов для нового выбора — ошибка, а не молчаливый пропуск', () => {
    expect(() => resumeAbaSession(beginSession(), { earned: 0, nonContingent: 0, rev: 1 }, { routineExchanged: true })).toThrow(/варианты/);
    expect(() => resumeAbaSession(beginSession(), { earned: 0, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: [] })).toThrow(/варианты/);
  });

  it('исходное состояние сессии не изменяется', () => {
    const st = beginSession();
    const copy = JSON.parse(JSON.stringify(st));
    resumeAbaSession(st, { earned: 1, nonContingent: 0, rev: 9 }, { routineExchanged: true, options: OPTIONS });
    expect(JSON.parse(JSON.stringify(st))).toEqual(copy);
  });

  /** Идём по сессии, пока не встретим выбор подкрепителя (перерыв или конец раньше — ошибка). */
  function toChoice(state: AbaSessionState) {
    let st = state;
    let now = BASE_MS;
    for (let guard = 0; guard < 60; guard += 1) {
      now += 1000;
      const next = nextStep(st, now);
      if (next.step.kind === 'choose_reinforcer') return { state: next.state, step: next.step, now };
      if (next.step.kind !== 'trial') throw new Error(`до выбора встретили ${next.step.kind}`);
      st = answerNext(st, now).state;
    }
    throw new Error('выбора нет');
  }

  it('пока подкрепитель устарел, перед перерывом сначала выбор из трёх, а не перерыв; жетоны не сгорают', () => {
    const full = beginSession({ board: { earned: 5, nonContingent: 0 } });
    const stale = resumeAbaSession(full, { earned: 5, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: OPTIONS });
    const ch = toChoice(stale);
    expect(ch.step).toMatchObject({ kind: 'choose_reinforcer', options: OPTIONS });
    expect([ch.state.exchangesMade, ch.state.board.earned >= 5]).toEqual([0, true]);
  });

  it('после выбора при устаревшем подкрепителе наступает перерыв, и на нём полная доска обменивается', () => {
    const full = beginSession({ board: { earned: 5, nonContingent: 0 } });
    const stale = resumeAbaSession(full, { earned: 5, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: OPTIONS });
    const ch = toChoice(stale);
    const chosen = chooseReinforcer(ch.state, 'kaleidoscope', ch.now + 500, 'adult');
    expect([chosen.reinforcerStale, chosen.reinforcerId]).toEqual([undefined, 'kaleidoscope']);
    const br = toBreak(chosen);
    expect(br.step).toMatchObject({ kind: 'break', canExchange: true });
    expect(finishBreak(br.state, br.now).exchanged).toBeGreaterThanOrEqual(5);
  });

  it('защита: finishBreak при устаревшем подкрепителе не обменивает, даже если вызван напрямую', () => {
    const full = beginSession({ board: { earned: 5, nonContingent: 0 } });
    const stale = resumeAbaSession(full, { earned: 5, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: OPTIONS });
    const br = { ...stale, queue: [{ kind: 'break' as const }, ...stale.queue], breakStartedAt: BASE_MS + 1000 } as AbaSessionState;
    const done = finishBreak(br, BASE_MS + 2000);
    expect([done.exchanged, done.state.board.earned, done.state.exchangesMade]).toEqual([0, 5, 0]);
  });

  it('устарел, но доска не полна — выбора нет, следующий шаг проба', () => {
    const half = beginSession({ board: { earned: 0, nonContingent: 0 } });
    const stale = resumeAbaSession(half, { earned: 0, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: OPTIONS });
    expect(nextStep(stale, BASE_MS + 1000).step.kind).toBe('trial');
  });

  it('без устаревшего выбора та же полная доска на перерыве обменивается', () => {
    const br = toBreak(beginSession({ board: { earned: 5, nonContingent: 0 } }));
    expect(br.step).toMatchObject({ kind: 'break', canExchange: true });
    expect(finishBreak(br.state, br.now).exchanged).toBeGreaterThanOrEqual(5);
  });

  it('после нового выбора из трёх обмен снова выдаётся', () => {
    const full = beginSession({ board: { earned: 5, nonContingent: 0 } });
    const stale = resumeAbaSession(full, { earned: 5, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: OPTIONS });
    const chosen = chooseReinforcer(stale, 'kaleidoscope', BASE_MS + 500, 'adult');
    expect([chosen.reinforcerStale, chosen.reinforcerId, chosen.reinforcerChosenBy, chosen.reinforcerChosenAt]).toEqual([
      undefined,
      'kaleidoscope',
      'adult',
      BASE_MS + 500,
    ]);
    const br = toBreak(chosen);
    expect(br.step).toMatchObject({ canExchange: true });
    expect(finishBreak(br.state, br.now).exchanged).toBeGreaterThanOrEqual(5);
  });

  it('новый выбор не сбрасывает время работы и не трогает очередь', () => {
    const st = beginSession();
    const stale = resumeAbaSession(st, { earned: 0, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: OPTIONS });
    const chosen = chooseReinforcer(stale, 'paint_drop', BASE_MS + 9000);
    expect([chosen.workStartedAt, chosen.queue]).toEqual([st.workStartedAt, st.queue]);
  });

  it('новый выбор — только из предложенных', () => {
    const stale = resumeAbaSession(beginSession(), { earned: 0, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: OPTIONS });
    expect(() => chooseReinforcer(stale, 'puzzle', BASE_MS)).toThrow(/не предлагался/);
  });

  it('конец сессии при устаревшем подкрепителе и полной доске: перед концом сначала выбор', () => {
    const full = beginSession({ board: { earned: 5, nonContingent: 0 } });
    const stale = resumeAbaSession(full, { earned: 5, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: OPTIONS });
    const emptyQueue = { ...stale, queue: [] } as AbaSessionState;
    expect(nextStep(emptyQueue, BASE_MS + 1000).step).toMatchObject({ kind: 'choose_reinforcer', options: OPTIONS });
  });

  it('защита: finishAbaSession при устаревшем подкрепителе не обменивает, доска целиком уходит на следующую', () => {
    const full = beginSession({ board: { earned: 5, nonContingent: 0 } });
    const stale = resumeAbaSession(full, { earned: 5, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: OPTIONS });
    const r = finishSession(stopSession({ ...stale, endReason: 'completed' }, 'adult_stopped'), BASE_MS + 9000);
    expect([r.exchanged, r.board.earned]).toEqual([0, 5]);
  });

  it('конец сессии без устаревшего подкрепителя при полной доске обменивает', () => {
    const full = beginSession({ board: { earned: 5, nonContingent: 0 } });
    const r = finishSession({ ...stopSession(full, 'adult_stopped'), endReason: 'completed' }, BASE_MS + 9000);
    expect([r.exchanged, r.board.earned]).toEqual([5, 0]);
  });

  it('обучение доске (ступень 2 ниже финальной 3 — обмен сразу): при устаревшем подкрепителе полная доска ждёт выбора, после выбора обменивается', () => {
    const full = beginSession({ tokenTraining: trained(2), board: { earned: 2, nonContingent: 0 } });
    const stale = resumeAbaSession(full, { earned: 2, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: OPTIONS });
    // вместо пробы — выбор из трёх; обмена до выбора нет
    const next = nextStep(stale, BASE_MS + 1000);
    expect(next.step).toMatchObject({ kind: 'choose_reinforcer', options: OPTIONS });
    expect([next.state.exchangesMade, next.state.board.earned]).toEqual([0, 2]);
    // выбор из трёх — полная доска обменивается сразу, доступ первым в очереди
    const chosen = chooseReinforcer(next.state, 'pinwheel', BASE_MS + 2000);
    expect(chosen.exchangesMade).toBe(1);
    expect(chosen.board.earned).toBe(0);
    expect(chosen.queue[0]).toMatchObject({ kind: 'access' });
    expect(finishAccess(chosen, BASE_MS + 3000).queue[0]?.kind).not.toBe('access');
  });

  describe('Б1: выбор вместо пробы, когда проба наполнила доску (ступень 2 — обучение доске, обмен сразу)', () => {
    const staleHalf = () => {
      const half = beginSession({ tokenTraining: trained(2), board: { earned: 0, nonContingent: 0 } });
      return resumeAbaSession(half, { earned: 0, nonContingent: 0, rev: 1 }, { routineExchanged: true, options: OPTIONS });
    };

    it('устарел + проба наполнила доску на ступени с немедленным обменом — следующий шаг выбор, обмена ещё нет', () => {
      let st = staleHalf();
      let now = BASE_MS;
      for (let guard = 0; guard < 30 && st.board.earned < 2; guard += 1) {
        now += 1000;
        st = answerNext(st, now).state;
      }
      expect(st.board.earned).toBeGreaterThanOrEqual(2);
      expect(st.exchangesMade).toBe(0);
      expect(nextStep(st, now + 1000).step).toMatchObject({ kind: 'choose_reinforcer', options: OPTIONS });
    });

    it('устарел + доска не полна — выбора нет, пробы идут, пока доска не наполнится', () => {
      let st = staleHalf();
      let now = BASE_MS;
      let trialSteps = 0;
      for (let guard = 0; guard < 30 && st.board.earned < 2; guard += 1) {
        now += 1000;
        expect(nextStep(st, now).step.kind).toBe('trial');
        trialSteps += 1;
        st = answerNext(st, now).state;
      }
      expect(trialSteps).toBeGreaterThan(0);
    });

    it('не устарел + проба наполнила доску — выбора нет, обмен сразу', () => {
      let st = beginSession({ tokenTraining: trained(2), board: { earned: 0, nonContingent: 0 } });
      let now = BASE_MS;
      for (let guard = 0; guard < 30 && st.exchangesMade === 0; guard += 1) {
        now += 1000;
        expect(nextStep(st, now).step.kind).not.toBe('choose_reinforcer');
        st = answerNext(st, now).state;
      }
      expect(st.exchangesMade).toBe(1);
    });
  });
});

describe('addTokens и живая доска: жетоны только прибавляются', () => {
  it('отрицательная выплата невозможна', () => {
    expect(() => addTokens({ size: 5, earned: 1, nonContingent: 0 }, -1)).toThrow(/не отнимаются/);
  });
});
