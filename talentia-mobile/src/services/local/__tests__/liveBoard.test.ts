/**
 * «Живая доска» в хранилище (Р3, решения №94 и №95): версия доски, конфликт записи, выплата
 * прогона по доске на момент фиксации, журнал выборов подкрепителя (миграция 9), экспорт.
 * Домен — `domain/__tests__/abaLiveBoard.test.ts`.
 */
import type { AbaRoutineRun, AbaSession, AbaTargetState } from '../../../types/aba';
import type { RoutineClaim, RoutineRunResult } from '../../../domain/abaRoutineRun';
import {
  chooseReinforcer,
  finishAbaSession,
  finishBreak,
  finishAccess,
  finishChainByAdult,
  nextStep,
  recordTrial,
  stopSession,
  type AbaSessionState,
} from '../../../domain/abaSession';
import { boardRevOf } from '../../../domain/abaTokens';
import { seeded } from '../../../domain/abaRandom';
import { initialTokenTraining, type BoardStage, type StageSession, type TokenTrainingState } from '../../../domain/abaTokenTraining';
import type { ConsentEvent } from '../../../domain/consent';
import { correctInput, answerNext, BASE_MS, beginSession, POOL } from '../../../domain/__tests__/abaSessionDriver';
import { finishSession } from '../../../domain/__tests__/abaFixtures';
import {
  AbaBoardConflictError,
  AbaConsentRequiredError,
  AbaPausedError,
  appendReinforcerChoice,
  ExchangeNotOpenError,
  openRoutineOfferOf,
  reinforcerHistoryOf,
  routineExchangedSince,
  RoutineWindowNotAccountedError,
  routineRunsOf,
  sessionsOf,
  trialsOfSession,
} from '../abaLog';
import { loadChildState, saveChildState } from '../childState';
import {
  commitAbaSession,
  commitRoutineExchange,
  commitRoutineRun,
  recordAbaTrial,
  resumeAbaSession,
  routineExchangeInSessionWindow,
  saveAbaSessionStep,
  setAbaPaused,
} from '../commit';
import { appendConsentEvent, insertConsentEvent } from '../consentLog';
import {
  abaDataSummary,
  applyRetention,
  clearChildProgress,
  exportChild,
  exportForSpecialist,
  purgeChild,
  revokeAbaProcessing,
  wipeDevice,
} from '../purge';
import { MIGRATIONS, migrate } from '../schema';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';
import { resultTail } from './routineResultTail';

const NOW = '2026-10-12T10:00:00Z';
const PSEUDO = '5f0c2a8e-3b1d-4c6e-9a7f-2d8b1e4c7a90';
const iso = (ms: number) => new Date(ms).toISOString();

const NONE: RoutineClaim = { token: null, tokens: 0, nonContingent: false };
const WORK: RoutineClaim = { token: 'at_start_level', tokens: 1, nonContingent: false };
const PARTICIPATION: RoutineClaim = { token: 'participation', tokens: 1, nonContingent: true };

const abaConsent = (action: 'grant' | 'revoke', over: Partial<ConsentEvent> = {}): ConsentEvent => ({
  id: `aba-${action}-${over.childId ?? 'kid'}-${over.at ?? NOW}`,
  scope: 'aba_processing',
  action,
  childId: 'kid',
  textVersion: 'ru-draft-1',
  confirmedBy: 'biometric',
  actorId: 'parent',
  at: NOW,
  ...over,
});

type Setup = { stage?: BoardStage; board?: { earned: number; nonContingent: number; rev?: number }; kids?: string[] };

/** База с согласием на ABA, обучением доске и живой доской. */
async function setup({ stage = 5, board, kids = ['kid'] }: Setup = {}): Promise<SqlDb> {
  const db = await memoryDb();
  for (const [i, kid] of kids.entries()) {
    await appendConsentEvent(db, abaConsent('grant', { childId: kid, at: `2026-10-12T07:0${i}:00Z` }), 'owner');
    await asAbaWriter(db, kid, async (tx) => {
      await saveChildState(tx, kid, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage }, NOW);
      if (board) await saveChildState(tx, kid, 'abaBoard', board, NOW);
    });
  }
  return db;
}

const boardOf = (db: SqlDb, kid = 'kid') => loadChildState(db, kid, 'abaBoard');

function routineResult(runId: string, claim: RoutineClaim, over: { endedMs?: number; band?: '5-6' | '7'; seed?: number } = {}): RoutineRunResult {
  const { endedMs = BASE_MS + 5000, band = '7', seed = 7 } = over;
  // номер прогона из id: k-й прогон идёт в k-й день, а `before` — итог (k−1)-го (один прогон в день, без конфликта состояния)
  const k = Number(/(\d+)$/.exec(runId)?.[1] ?? 1);
  const dayOf = (n: number) => `2026-10-${String(11 + n).padStart(2, '0')}`;
  const stateOf = (n: number) =>
    ({ targetId: 'R', phase: 'acquisition', ...(n > 0 ? { lastRoutineRunDay: dayOf(n) } : {}) }) as AbaTargetState;
  return {
    ...resultTail({ id: runId, day: dayOf(k), targetId: 'R', setting: 'usual' }),
    trials: [],
    state: stateOf(k),
    before: stateOf(k - 1),
    claim,
    record: {
      id: runId,
      targetId: 'R',
      day: dayOf(k),
      kind: 'teaching',
      startedAt: iso(endedMs - 60_000),
      endedAt: iso(endedMs),
      interrupted: null,
      setting: 'usual',
      phase: null,
      primaryObserverId: null,
    },
    band,
    reinforcerPool: POOL,
    seed,
  };
}

/** Локальный день первого прогона из `routineResult`: тот же, что у сессии драйвера (`2026-10-12`). */
const RUN_DAY = '2026-10-12';

/** Прогон с жетоном, предложение и выбор: обмен рутины состоялся. */
async function routineWithExchange(
  db: SqlDb,
  runId: string,
  claim: RoutineClaim,
  chosenAtMs: number,
  over: Parameters<typeof routineResult>[2] = {},
) {
  const out = await commitRoutineRun(db, 'kid', routineResult(runId, claim, over), iso(chosenAtMs - 100));
  if (!out.offer) throw new Error('предложения нет');
  const spent = await commitRoutineExchange(db, 'kid', runId, out.offer.options[0], 'child', iso(chosenAtMs));
  return { out, spent };
}

/** Сессия, записанная в хранилище как «в работе». */
async function startSession(db: SqlDb, over: Parameters<typeof beginSession>[0] = {}): Promise<AbaSessionState> {
  const live = await boardOf(db);
  const st = beginSession({ board: live ?? { earned: 0, nonContingent: 0 }, boardRev: boardRevOf(live), ...over });
  return saveAbaSessionStep(db, 'kid', st, iso(BASE_MS), {
    source: 'session',
    sourceId: st.sessionId,
    reinforcerId: st.reinforcerId!,
    chosenBy: 'child',
  });
}

/** Следующая проба сессии, записанная в хранилище. */
async function workTrial(db: SqlDb, st: AbaSessionState, now: number): Promise<AbaSessionState> {
  const { state, res } = answerNext(st, now);
  return recordAbaTrial(db, 'kid', res.trial, state, iso(now));
}

// ---------------------------------------------------------------------------

describe('Т1: сессия и рутина без обменов — жетоны складываются', () => {
  it('жетон пробы, затем жетон рутины: на доске оба, версия растёт на каждую запись', async () => {
    const db = await setup({ board: { earned: 1, nonContingent: 0 } });
    let st = await startSession(db);
    st = await workTrial(db, st, BASE_MS + 1000);
    const afterTrial = await boardOf(db);
    expect(afterTrial).toMatchObject({ earned: st.board.earned, nonContingent: st.board.nonContingent, rev: 1 });

    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', WORK), iso(BASE_MS + 5000));
    expect(out.offer).toBeUndefined();
    expect(await boardOf(db)).toEqual({ earned: afterTrial!.earned + 1, nonContingent: afterTrial!.nonContingent, rev: 2 });
  });

  it('запись прогона несёт настоящий token, решённый доской, и не несёт предложения, пока доска не полна', async () => {
    const db = await setup({ board: { earned: 1, nonContingent: 0 } });
    await commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW);
    const [run] = await routineRunsOf(db, 'kid');
    expect(run).toMatchObject({ id: 'run-1', token: 'at_start_level' });
    expect(run).not.toHaveProperty('exchangeOffer');
    expect(run).not.toHaveProperty('exchanged');
  });

  it('прогон без жетона доску не пишет: версия прежняя', async () => {
    const db = await setup({ board: { earned: 2, nonContingent: 0, rev: 4 } });
    await commitRoutineRun(db, 'kid', routineResult('run-1', NONE), NOW);
    expect(await boardOf(db)).toEqual({ earned: 2, nonContingent: 0, rev: 4 });
  });

  it('старая запись доски без версии читается как 0, первая запись ставит 1', async () => {
    const db = await setup({ board: { earned: 0, nonContingent: 0 } });
    await commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW);
    expect((await boardOf(db))?.rev).toBe(1);
  });

  it('прогон без обучения доске записать нельзя, ничего не записано', async () => {
    const db = await memoryDb();
    await appendConsentEvent(db, abaConsent('grant', { at: '2026-10-12T07:00:00Z' }), 'owner');
    await expect(commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW)).rejects.toThrow(/Сопряжение/);
    expect(await routineRunsOf(db, 'kid')).toEqual([]);
    expect(await boardOf(db)).toBeUndefined();
  });
});

describe('Т2 и Т4: рутина заполняет доску, пока сессия в работе', () => {
  async function scenario() {
    const db = await setup({ stage: 3, board: { earned: 2, nonContingent: 0 } });
    const st = await startSession(db, { band: '5-6', tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 3 } });
    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', WORK, { band: '5-6' }), iso(BASE_MS + 5000));
    return { db, st, out };
  }

  it('рутина предлагает обмен трёх жетонов, но доску не обнуляет: жетоны на доске, версия выросла один раз', async () => {
    const { db, out } = await scenario();
    expect(out.offer).toMatchObject({ tokens: 3, boardSize: 3 });
    expect(out.offer?.options).toHaveLength(3);
    expect(await boardOf(db)).toEqual({ earned: 3, nonContingent: 0, rev: 1 });
    expect((await routineRunsOf(db, 'kid'))[0]).toMatchObject({ exchangeOffer: out.offer });
  });

  it('сессия со старой доской вторым обменом не пишется: конфликт версий, ничего не записано', async () => {
    const { db, st } = await scenario();
    const before = await loadChildState(db, 'kid', 'abaSessionInProgress');
    const { state, res } = answerNext(st, BASE_MS + 6000);
    await expect(recordAbaTrial(db, 'kid', res.trial, state, NOW)).rejects.toBeInstanceOf(AbaBoardConflictError);
    expect(await trialsOfSession(db, 'kid', st.sessionId)).toEqual([]);
    expect(await boardOf(db)).toEqual({ earned: 3, nonContingent: 0, rev: 1 });
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toEqual(before);
  });

  it('возобновление при открытом предложении: на доске три жетона, версия 1, подкрепитель устарел, варианты — из предложения', async () => {
    const { db, st, out } = await scenario();
    const r = (await resumeAbaSession(db, 'kid', POOL))!;
    expect(r.board).toMatchObject({ earned: 3, nonContingent: 0 });
    expect([r.boardRev, r.reinforcerStale, r.reinforcerId]).toEqual([1, true, st.reinforcerId]);
    expect(r.reinforcerOptions).toEqual(out.offer!.options);
  });

  /** Возобновлённая сессия, дошедшая до перерыва: на нём обмен, если доска полна и подкрепитель не устарел. */
  const atBreak = (r: AbaSessionState) =>
    ({ ...r, queue: [{ kind: 'break' as const }, ...r.queue], breakStartedAt: BASE_MS + 6000 }) as AbaSessionState;

  it('после возобновления перед перерывом сессия сначала просит выбор: обмена сессии нет, жетоны на доске', async () => {
    const { db } = await scenario();
    const r = (await resumeAbaSession(db, 'kid', POOL))!;
    const next = nextStep(atBreak(r), BASE_MS + 7000);
    expect(next.step.kind).toBe('choose_reinforcer');
    expect([next.state.exchangesMade, next.state.board.earned]).toEqual([0, 3]);
  });

  it('сессия выбрала подкрепитель и обменяла сама на перерыве: доска пуста, предложение рутины закрыто, второго обмена нет', async () => {
    const { db } = await scenario();
    const r = (await resumeAbaSession(db, 'kid', POOL))!;
    const pick = r.reinforcerOptions[0];
    const chosen = chooseReinforcer(atBreak(r), pick, BASE_MS + 7000, 'child');
    const done = finishBreak(chosen, BASE_MS + 8000);
    expect(done.exchanged).toBe(3);
    const saved = await saveAbaSessionStep(db, 'kid', done.state, iso(BASE_MS + 8000), {
      source: 'session',
      sourceId: chosen.sessionId,
      reinforcerId: pick,
      chosenBy: 'child',
    });
    expect(saved.exchangesMade).toBe(1);
    expect((await boardOf(db))!.earned).toBe(0);
    expect(await openRoutineOfferOf(db, 'kid', RUN_DAY)).toBeNull();
    await expect(commitRoutineExchange(db, 'kid', 'run-1', pick, 'child', NOW)).rejects.toBeInstanceOf(ExchangeNotOpenError);
  });
});

describe('Т3: обратный порядок — сессия обменяла, потом рутина', () => {
  it('рутина ложится на пустую доску без обмена', async () => {
    const db = await setup({ stage: 3, board: { earned: 2, nonContingent: 0 } });
    const st = await startSession(db, { band: '5-6', tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 3 } });
    // перерыв с обменом (доска полна: 2 + жетон пробы)
    const full = await workTrial(db, st, BASE_MS + 1000);
    expect(full.board.earned).toBeGreaterThanOrEqual(3);
    const br = { ...full, queue: [{ kind: 'break' as const }, ...full.queue], breakStartedAt: BASE_MS + 2000 } as AbaSessionState;
    const done = finishBreak(br, BASE_MS + 3000);
    expect(done.exchanged).toBeGreaterThanOrEqual(3);
    await saveAbaSessionStep(db, 'kid', done.state, iso(BASE_MS + 3000));
    expect((await boardOf(db))!.earned).toBe(0);

    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', WORK, { band: '5-6' }), iso(BASE_MS + 5000));
    expect(out.offer).toBeUndefined();
    expect((await boardOf(db))!.earned).toBe(1);
  });
});

describe('Т5: лимит жетонов не за результат — по живой доске', () => {
  it('на доске size − 1 не за результат жетон за участие не выплачен, версия не растёт', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 4, rev: 3 } });
    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', PARTICIPATION), NOW);
    expect(out.token).toBeNull();
    expect(await boardOf(db)).toEqual({ earned: 4, nonContingent: 4, rev: 3 });
    expect((await routineRunsOf(db, 'kid'))[0]).toMatchObject({ token: null });
  });

  it('на размер меньше — выплачен и записан в счёт не за результат', async () => {
    const db = await setup({ board: { earned: 3, nonContingent: 3 } });
    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', PARTICIPATION), NOW);
    expect(out.token).toBe('participation');
    expect(await boardOf(db)).toEqual({ earned: 4, nonContingent: 4, rev: 1 });
  });

  it('жетоны, добавленные сессией после старта прогона, учитываются: лимит по доске на момент фиксации', async () => {
    const db = await setup({ board: { earned: 2, nonContingent: 2 } });
    // прогон «начался», когда место ещё было; пока он шёл, сессия добавила не за результат
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaBoard', { earned: 4, nonContingent: 4, rev: 1 }, NOW));
    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', PARTICIPATION), NOW);
    expect(out.token).toBeNull();
  });
});

describe('Т6: конфликт версии — ничего не записано', () => {
  async function conflicted() {
    const db = await setup({ board: { earned: 1, nonContingent: 0 } });
    const st = await startSession(db);
    await commitRoutineRun(db, 'kid', routineResult('run-1', WORK), iso(BASE_MS + 5000));
    return { db, st };
  }

  it('recordAbaTrial: AbaBoardConflictError с версиями; проба, снимок и доска прежние', async () => {
    const { db, st } = await conflicted();
    const snapshot = await loadChildState(db, 'kid', 'abaSessionInProgress');
    const { state, res } = answerNext(st, BASE_MS + 6000);
    const err = await recordAbaTrial(db, 'kid', res.trial, state, NOW).catch((e) => e);
    expect(err).toBeInstanceOf(AbaBoardConflictError);
    expect([err.expectedRev, err.actualRev]).toEqual([0, 1]);
    expect(await trialsOfSession(db, 'kid', st.sessionId)).toEqual([]);
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toEqual(snapshot);
    expect(await boardOf(db)).toEqual({ earned: 2, nonContingent: 0, rev: 1 });
  });

  it('saveAbaSessionStep: конфликт, выбор подкрепителя в историю не попал', async () => {
    const { db, st } = await conflicted();
    const before = await reinforcerHistoryOf(db, 'kid');
    await expect(
      saveAbaSessionStep(db, 'kid', { ...st, board: { ...st.board, earned: 0 } }, NOW, { source: 'session', sourceId: 's', reinforcerId: 'drum', chosenBy: 'child' }),
    ).rejects.toBeInstanceOf(AbaBoardConflictError);
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual(before);
  });

  it('commitAbaSession: конфликт, нет сессии, номер, ступень и сессия в работе прежние', async () => {
    const { db, st } = await conflicted();
    const stopped = { ...stopSession(st, 'adult_stopped'), endReason: 'completed' as const };
    const result = finishSession(stopped, BASE_MS + 9000);
    const indexBefore = await loadChildState(db, 'kid', 'abaSessionIndex');
    const inProgress = await loadChildState(db, 'kid', 'abaSessionInProgress');
    await expect(commitAbaSession(db, 'kid', result, NOW)).rejects.toBeInstanceOf(AbaBoardConflictError);
    expect(await sessionsOf(db, 'kid')).toEqual([]);
    expect(await loadChildState(db, 'kid', 'abaSessionIndex')).toEqual(indexBefore);
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toEqual(inProgress);
    expect((await loadChildState(db, 'kid', 'tokenTraining'))!.atStage).toEqual([]);
  });

  it('после возобновления тот же шаг проходит', async () => {
    const { db } = await conflicted();
    const r = (await resumeAbaSession(db, 'kid', POOL))!;
    const next = await workTrial(db, r, BASE_MS + 6000);
    expect(next.boardRev).toBe(2);
  });

  it('возобновление без сессии в работе — null', async () => {
    const db = await setup();
    expect(await resumeAbaSession(db, 'kid', POOL)).toBeNull();
  });
});

describe('Т7: пауза или отзыв между стартом и фиксацией рутины', () => {
  it('пауза: AbaPausedError, ничего из итога не записано; после снятия — фиксируется по живой доске', async () => {
    const db = await setup({ board: { earned: 1, nonContingent: 0 } });
    await setAbaPaused(db, 'kid', true, NOW);
    await expect(commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW)).rejects.toBeInstanceOf(AbaPausedError);
    expect(await routineRunsOf(db, 'kid')).toEqual([]);
    expect(await boardOf(db)).toEqual({ earned: 1, nonContingent: 0 });
    await setAbaPaused(db, 'kid', false, NOW);
    await commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW);
    expect((await boardOf(db))!.earned).toBe(2);
  });

  it('отзыв: AbaConsentRequiredError, доска и прогоны удалены отзывом и не возвращаются', async () => {
    const db = await setup({ board: { earned: 1, nonContingent: 0 } });
    await revokeAbaProcessing(db, abaConsent('revoke', { at: '2026-10-12T11:00:00Z' }), 'owner');
    await expect(commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    expect(await routineRunsOf(db, 'kid')).toEqual([]);
    expect(await boardOf(db)).toBeUndefined();
  });

  it('пауза: шаг сессии тоже не пишется', async () => {
    const db = await setup();
    const st = await startSession(db);
    await setAbaPaused(db, 'kid', true, NOW);
    await expect(saveAbaSessionStep(db, 'kid', st, NOW)).rejects.toBeInstanceOf(AbaPausedError);
  });
});

describe('Т8: смена ступени между стартом прогона и фиксацией', () => {
  const setStage = (db: SqlDb, stage: BoardStage) =>
    asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage }, NOW));

  it('5 → 3, на доске 5 и жетон прогона: размер берётся по текущему обучению, предложены все шесть жетонов, на доске остаются', async () => {
    const db = await setup({ stage: 5, board: { earned: 5, nonContingent: 0 } });
    await setStage(db, 3);
    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', WORK, { band: '7' }), NOW);
    expect(out.offer).toMatchObject({ tokens: 6, boardSize: 3 });
    expect((await boardOf(db))!.earned).toBe(6);
  });

  it('5 → 3, на доске 5, прогон без жетона: доска в покое не обменивается, версия прежняя', async () => {
    const db = await setup({ stage: 5, board: { earned: 5, nonContingent: 0, rev: 2 } });
    await setStage(db, 3);
    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', NONE, { band: '7' }), NOW);
    expect(out.offer).toBeUndefined();
    expect(await boardOf(db)).toEqual({ earned: 5, nonContingent: 0, rev: 2 });
  });

  it('5 → 3, на доске 4 и жетон прогона: предложение на пять', async () => {
    const db = await setup({ stage: 5, board: { earned: 4, nonContingent: 0 } });
    await setStage(db, 3);
    expect((await commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW)).offer?.tokens).toBe(5);
  });

  it('3 → 5 (и полоса 7): трёх жетонов с жетоном прогона для обмена мало', async () => {
    const db = await setup({ stage: 3, board: { earned: 3, nonContingent: 0 } });
    await setStage(db, 5);
    expect((await commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW)).offer).toBeUndefined();
  });

  it('ступень выше финальной по полосе не поднимает доску: полоса 5–6, ступень 5 — размер 3', async () => {
    const db = await setup({ stage: 5, board: { earned: 2, nonContingent: 0 } });
    expect((await commitRoutineRun(db, 'kid', routineResult('run-1', WORK, { band: '5-6' }), NOW)).offer?.tokens).toBe(3);
  });
});

describe('В4: срыв прогона на полной доске', () => {
  it('заявка без жетона на полной доске: предложения нет, доска и версия прежние, запись прогона — без предложения', async () => {
    const db = await setup({ stage: 5, board: { earned: 5, nonContingent: 1, rev: 3 } });
    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', NONE), NOW);
    expect([out.token, out.offer]).toEqual([null, undefined]);
    expect(await boardOf(db)).toEqual({ earned: 5, nonContingent: 1, rev: 3 });
    const [run] = await routineRunsOf(db, 'kid');
    expect(run).toMatchObject({ id: 'run-1', token: null });
    expect(run).not.toHaveProperty('exchangeOffer');
  });

  it('после срыва предложения нет и в окне сессии обмена не видно', async () => {
    const db = await setup({ stage: 5, board: { earned: 5, nonContingent: 0 } });
    await commitRoutineRun(db, 'kid', routineResult('run-1', NONE), NOW);
    expect(await openRoutineOfferOf(db, 'kid', RUN_DAY)).toBeNull();
    expect(await routineExchangedSince(db, 'kid', 0)).toBe(false);
  });

  it('следующий прогон с жетоном предлагает обмен всей полной доски (шесть жетонов), доска остаётся', async () => {
    const db = await setup({ stage: 5, board: { earned: 5, nonContingent: 0 } });
    await commitRoutineRun(db, 'kid', routineResult('run-1', NONE), NOW);
    const out = await commitRoutineRun(db, 'kid', routineResult('run-2', WORK), NOW);
    expect(out.offer?.tokens).toBe(6);
    expect((await boardOf(db))!.earned).toBe(6);
  });
});

describe('Т9: история выборов — по порядку записи (seq), а не по часам', () => {
  const choice = (id: string, by: 'child' | 'adult' = 'child', source: 'session' | 'routine' = 'session') => ({
    source,
    sourceId: `${source}-${id}`,
    reinforcerId: id,
    chosenBy: by,
  });

  it('часы ушли назад: позднее записанный выбор с более ранним временем остаётся последним (В-5)', async () => {
    const db = await setup();
    await asAbaWriter(db, 'kid', async (tx) => {
      await appendReinforcerChoice(tx, 'kid', choice('b'), '2026-10-12T09:00:00Z');
      await appendReinforcerChoice(tx, 'kid', choice('a'), '2026-10-12T08:00:00Z');
      await appendReinforcerChoice(tx, 'kid', choice('c', 'adult', 'routine'), '2026-10-12T08:00:00Z');
    });
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual(['b', 'a', 'c']);
  });

  it('выбор взрослого входит в историю', async () => {
    const db = await setup();
    await asAbaWriter(db, 'kid', (tx) => appendReinforcerChoice(tx, 'kid', choice('drum', 'adult'), NOW));
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual(['drum']);
  });

  it('(б) взрослый выбрал одно дважды подряд — ни в одном предложении рутины третий раз оно не предлагается', async () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const db = await setup({ board: { earned: 4, nonContingent: 0 } });
      await asAbaWriter(db, 'kid', async (tx) => {
        await appendReinforcerChoice(tx, 'kid', choice('drum', 'adult'), '2026-10-12T08:00:00Z');
        await appendReinforcerChoice(tx, 'kid', choice('drum', 'adult', 'routine'), '2026-10-12T08:30:00Z');
      });
      const out = await commitRoutineRun(db, 'kid', routineResult('run-1', WORK, { seed }), NOW);
      expect(out.offer?.options).not.toContain('drum');
    }
  });

  it('время выбора пишется единообразно: UTC, миллисекунды, из часового пояса и без миллисекунд', async () => {
    const db = await setup();
    await asAbaWriter(db, 'kid', async (tx) => {
      await appendReinforcerChoice(tx, 'kid', choice('a'), '2026-10-12T13:00:00+03:00');
      await appendReinforcerChoice(tx, 'kid', choice('b'), '2026-10-12T10:00:00Z');
      await appendReinforcerChoice(tx, 'kid', choice('c'), '2026-10-12T10:00:00.250Z');
    });
    const rows = await db.all<{ chosen_at: string }>('SELECT chosen_at FROM aba_reinforcer_choices ORDER BY seq');
    expect(rows.map((r) => r.chosen_at)).toEqual(['2026-10-12T10:00:00.000Z', '2026-10-12T10:00:00.000Z', '2026-10-12T10:00:00.250Z']);
  });

  it('порядок истории не зависит от формата и пояса времени выбора: только порядок записи', async () => {
    const db = await setup();
    await asAbaWriter(db, 'kid', async (tx) => {
      await appendReinforcerChoice(tx, 'kid', choice('late'), '2026-10-12T09:00:00.500Z');
      await appendReinforcerChoice(tx, 'kid', choice('early'), '2026-10-12T09:00:00Z');
      // 11:30 по +03:00 — 08:30 UTC, раньше обоих, но записан последним
      await appendReinforcerChoice(tx, 'kid', choice('zone'), '2026-10-12T11:30:00+03:00');
    });
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual(['late', 'early', 'zone']);
  });

  it('невалидная дата выбора — ошибка, в историю ничего не попало', async () => {
    const db = await setup();
    await expect(asAbaWriter(db, 'kid', (tx) => appendReinforcerChoice(tx, 'kid', choice('a'), 'вчера'))).rejects.toThrow(/не дата/);
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual([]);
  });

  it('выбор рутины через commitRoutineExchange тоже пишется в едином формате, с числом ушедших жетонов', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW);
    await commitRoutineExchange(db, 'kid', 'run-1', out.offer!.options[0], 'child', '2026-10-12T13:00:00+03:00');
    const [row] = await db.all<{ chosen_at: string; tokens: number }>('SELECT chosen_at, tokens FROM aba_reinforcer_choices');
    expect(row).toEqual({ chosen_at: '2026-10-12T10:00:00.000Z', tokens: 5 });
  });

  it('пустой подкрепитель в историю не пишется', async () => {
    const db = await setup();
    await expect(asAbaWriter(db, 'kid', (tx) => appendReinforcerChoice(tx, 'kid', choice(''), NOW))).rejects.toThrow(/без подкрепителя/);
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual([]);
  });

  it('выбор сессии при saveAbaSessionStep попадает в историю в той же транзакции', async () => {
    const db = await setup();
    const st = await startSession(db);
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual([st.reinforcerId]);
  });
});

describe('Т10: приложение убили до выбора подкрепителя после предложения рутины', () => {
  async function offered(board = { earned: 4, nonContingent: 0 }) {
    const db = await setup({ board });
    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW);
    return { db, out, offer: out.offer! };
  }

  it('openRoutineOfferOf даёт то же предложение и те же варианты при каждом открытии в тот же день', async () => {
    const { db, offer } = await offered();
    const expected = { runId: 'run-1', day: RUN_DAY, tokens: 5, boardSize: 5, options: offer.options };
    expect(await openRoutineOfferOf(db, 'kid', RUN_DAY)).toEqual(expected);
    expect(await openRoutineOfferOf(db, 'kid', RUN_DAY)).toEqual(expected);
  });

  it('commitRoutineExchange: жетоны уходят вместе с выбором — доска обнулена одной записью, версия +1, ушло столько, сколько лежало', async () => {
    const { db, offer } = await offered();
    const spent = await commitRoutineExchange(db, 'kid', 'run-1', offer.options[1], 'child', NOW);
    expect(spent).toEqual({ tokens: 5, boardSize: 5 });
    expect(await boardOf(db)).toEqual({ earned: 0, nonContingent: 0, rev: 2 });
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual([offer.options[1]]);
    expect(await openRoutineOfferOf(db, 'kid', RUN_DAY)).toBeNull();
  });

  it('commitRoutineExchange пишет в выбор число жетонов, включая сверх доски (шесть на доске из пяти)', async () => {
    const { db, offer } = await offered({ earned: 5, nonContingent: 0 });
    expect(offer.tokens).toBe(6);
    await commitRoutineExchange(db, 'kid', 'run-1', offer.options[0], 'adult', NOW);
    const [row] = await db.all<{ tokens: number; chosen_by: string; source: string; source_id: string }>(
      'SELECT tokens, chosen_by, source, source_id FROM aba_reinforcer_choices',
    );
    expect(row).toEqual({ tokens: 6, chosen_by: 'adult', source: 'routine', source_id: 'run-1' });
  });

  it('предложение без выбора жетоны не уносит: доска и версия как после прогона, сколько ни открывай', async () => {
    const { db } = await offered();
    await openRoutineOfferOf(db, 'kid', RUN_DAY);
    expect(await boardOf(db)).toEqual({ earned: 5, nonContingent: 0, rev: 1 });
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual([]);
  });

  it('второй выбор на тот же прогон: ExchangeNotOpenError, история и доска не меняются', async () => {
    const { db, offer } = await offered();
    await commitRoutineExchange(db, 'kid', 'run-1', offer.options[0], 'child', NOW);
    await expect(commitRoutineExchange(db, 'kid', 'run-1', offer.options[2], 'adult', NOW)).rejects.toBeInstanceOf(ExchangeNotOpenError);
    expect(await reinforcerHistoryOf(db, 'kid')).toHaveLength(1);
    expect(await boardOf(db)).toEqual({ earned: 0, nonContingent: 0, rev: 2 });
  });

  it('второй выбор на тот же прогон, когда доска снова полна: ExchangeNotOpenError, а не повторный обмен', async () => {
    const { db, offer } = await offered();
    await commitRoutineExchange(db, 'kid', 'run-1', offer.options[0], 'child', NOW);
    // сессия снова набрала полную доску; прогон run-1 всё ещё последний с предложением
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaBoard', { earned: 5, nonContingent: 0, rev: 7 }, NOW));
    await expect(commitRoutineExchange(db, 'kid', 'run-1', offer.options[1], 'child', NOW)).rejects.toBeInstanceOf(ExchangeNotOpenError);
    expect(await boardOf(db)).toEqual({ earned: 5, nonContingent: 0, rev: 7 });
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual([offer.options[0]]);
  });

  it('подкрепитель не из предложенных: ExchangeNotOpenError, предложение остаётся открытым, жетоны на доске', async () => {
    const { db, offer } = await offered();
    const other = POOL.find((p) => !offer.options.includes(p))!;
    await expect(commitRoutineExchange(db, 'kid', 'run-1', other, 'child', NOW)).rejects.toBeInstanceOf(ExchangeNotOpenError);
    expect(await openRoutineOfferOf(db, 'kid', RUN_DAY)).not.toBeNull();
    expect((await boardOf(db))!.earned).toBe(5);
  });

  it('прогон без предложения и несуществующий прогон: ExchangeNotOpenError', async () => {
    const db = await setup({ board: { earned: 0, nonContingent: 0 } });
    await commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW);
    expect(await openRoutineOfferOf(db, 'kid', RUN_DAY)).toBeNull();
    await expect(commitRoutineExchange(db, 'kid', 'run-1', POOL[0], 'child', NOW)).rejects.toBeInstanceOf(ExchangeNotOpenError);
    await expect(commitRoutineExchange(db, 'kid', 'nope', POOL[0], 'child', NOW)).rejects.toBeInstanceOf(ExchangeNotOpenError);
  });

  it('доска не полна (сессия обменяла раньше): предложение закрыто, commitRoutineExchange — ExchangeNotOpenError, выбор не пишется', async () => {
    const { db, offer } = await offered();
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaBoard', { earned: 1, nonContingent: 0, rev: 5 }, NOW));
    expect(await openRoutineOfferOf(db, 'kid', RUN_DAY)).toBeNull();
    await expect(commitRoutineExchange(db, 'kid', 'run-1', offer.options[0], 'child', NOW)).rejects.toBeInstanceOf(ExchangeNotOpenError);
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual([]);
    expect(await boardOf(db)).toEqual({ earned: 1, nonContingent: 0, rev: 5 });
  });

  it('на следующий день предложение закрыто без записи, жетоны остаются на доске', async () => {
    const { db } = await offered();
    expect(await openRoutineOfferOf(db, 'kid', '2026-10-13')).toBeNull();
    expect(await boardOf(db)).toEqual({ earned: 5, nonContingent: 0, rev: 1 });
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual([]);
  });

  it('вторая рутина при открытом предложении: побеждает последнее, старое не обменять', async () => {
    const { db, offer: first } = await offered();
    const out2 = await commitRoutineRun(db, 'kid', routineResult('run-2', WORK), NOW);
    expect(out2.offer?.tokens).toBe(6);
    const open = await openRoutineOfferOf(db, 'kid', '2026-10-13');
    expect(open).toMatchObject({ runId: 'run-2', tokens: 6 });
    await expect(commitRoutineExchange(db, 'kid', 'run-1', first.options[0], 'child', NOW)).rejects.toBeInstanceOf(ExchangeNotOpenError);
    expect(await commitRoutineExchange(db, 'kid', 'run-2', out2.offer!.options[0], 'child', NOW)).toEqual({ tokens: 6, boardSize: 5 });
    expect((await boardOf(db))!.earned).toBe(0);
  });

  it('прогон без жетона после предложения последнее предложение не затирает: обмен по первому ещё возможен', async () => {
    const { db, offer } = await offered();
    await commitRoutineRun(db, 'kid', routineResult('run-2', NONE), NOW);
    expect(await commitRoutineExchange(db, 'kid', 'run-1', offer.options[0], 'child', NOW)).toEqual({ tokens: 5, boardSize: 5 });
  });

  it('выбор взрослого принимается и пишется как взрослого', async () => {
    const { db, offer } = await offered();
    await commitRoutineExchange(db, 'kid', 'run-1', offer.options[0], 'adult', NOW);
    expect((await db.all<{ chosen_by: string }>('SELECT chosen_by FROM aba_reinforcer_choices'))[0].chosen_by).toBe('adult');
  });

  it('чужой ребёнок: предложения нет, выбор по чужому прогону — ExchangeNotOpenError', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 0 }, kids: ['kid', 'sib'] });
    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW);
    expect(await openRoutineOfferOf(db, 'sib', RUN_DAY)).toBeNull();
    await expect(commitRoutineExchange(db, 'sib', 'run-1', out.offer!.options[0], 'child', NOW)).rejects.toBeInstanceOf(ExchangeNotOpenError);
    expect((await boardOf(db))!.earned).toBe(5);
  });

  it('routineExchangedSince считает только выбор: предложение без выбора обменом не является', async () => {
    const { db, offer } = await offered();
    expect(await routineExchangedSince(db, 'kid', 0)).toBe(false);
    await commitRoutineExchange(db, 'kid', 'run-1', offer.options[0], 'child', NOW);
    expect(await routineExchangedSince(db, 'kid', 0)).toBe(true);
  });

  it('выбор сессии routineExchangedSince не считает (source = session)', async () => {
    const db = await setup();
    await startSession(db);
    expect(await routineExchangedSince(db, 'kid', 0)).toBe(false);
  });
});

describe('(а) и (в) в хранилище', () => {
  const ses = (exchanges: number, sessionIndex: number): StageSession => ({ sessionIndex, exchanges, endReason: 'completed' });

  it('routineExchangedSince: выбор рутины позже границы — да, раньше — нет, без выбора — нет', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    await routineWithExchange(db, 'run-1', WORK, BASE_MS + 5000);
    expect(await routineExchangedSince(db, 'kid', BASE_MS)).toBe(true);
    expect(await routineExchangedSince(db, 'kid', BASE_MS + 6000)).toBe(false);
    const other = await setup({ board: { earned: 0, nonContingent: 0 } });
    await commitRoutineRun(other, 'kid', routineResult('run-2', WORK), NOW);
    expect(await routineExchangedSince(other, 'kid', 0)).toBe(false);
  });

  it('routineExchangedSince: прогон закончился до границы, а выбор сделан после — обмен виден (по времени выбора, не по endedAt)', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    await routineWithExchange(db, 'run-1', WORK, BASE_MS + 30_000, { endedMs: BASE_MS - 1000 });
    expect(await routineExchangedSince(db, 'kid', BASE_MS)).toBe(true);
  });

  it('routineExchangedSince: прогон закончился после границы, а выбор сделан до неё — не виден', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    await routineWithExchange(db, 'run-1', WORK, BASE_MS - 5000, { endedMs: BASE_MS + 60_000 });
    expect(await routineExchangedSince(db, 'kid', BASE_MS)).toBe(false);
  });

  it('(а)(в) прогон кончился до старта сессии, но обмен зафиксирован в её окне: подкрепитель устарел и признак окна есть', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    const training: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: 5, atStage: [ses(0, 9)] };
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'tokenTraining', training, NOW));
    const st = await startSession(db, { tokenTraining: training });
    await routineWithExchange(db, 'run-1', WORK, BASE_MS + 5000, { endedMs: BASE_MS - 1000 });
    const resumed = (await resumeAbaSession(db, 'kid', POOL))!;
    expect(resumed.reinforcerStale).toBe(true);
    const ended = stopSession({ ...resumed, sessionIndex: st.sessionIndex }, 'abandoned');
    expect(await routineExchangeInSessionWindow(db, 'kid', ended)).toBe(true);
  });

  async function abandonedWithPrior(withRoutineExchange: boolean) {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    const training: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: 5, atStage: [ses(0, 9)] };
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'tokenTraining', training, NOW));
    const st = await startSession(db, { tokenTraining: training });
    if (withRoutineExchange) await routineWithExchange(db, 'run-1', WORK, BASE_MS + 5000);
    const resumed = (await resumeAbaSession(db, 'kid', POOL))!;
    const ended = stopSession({ ...resumed, sessionIndex: st.sessionIndex }, 'abandoned');
    const inWindow = await routineExchangeInSessionWindow(db, 'kid', ended);
    const result = finishAbaSession(ended, BASE_MS + 9000, {}, undefined, undefined, { routineExchangeInWindow: inWindow });
    await commitAbaSession(db, 'kid', result, iso(BASE_MS + 9000));
    return { db, inWindow };
  }

  it('(а) сессия с нулём обменов при обмене рутины в окне ступень не меняет', async () => {
    const { db, inWindow } = await abandonedWithPrior(true);
    expect(inWindow).toBe(true);
    const t = (await loadChildState(db, 'kid', 'tokenTraining'))!;
    expect([t.stage, t.atStage]).toEqual([5, [ses(0, 9)]]);
  });

  it('(а) без обмена рутины та же сессия опускает ступень 5 → 3', async () => {
    const { db, inWindow } = await abandonedWithPrior(false);
    expect(inWindow).toBe(false);
    expect((await loadChildState(db, 'kid', 'tokenTraining'))!.stage).toBe(3);
  });

  it('(в) без обмена и без предложения возобновление stale не ставит, даже если рутина прошла', async () => {
    const db = await setup({ board: { earned: 0, nonContingent: 0 } });
    await startSession(db);
    await commitRoutineRun(db, 'kid', routineResult('run-1', WORK, { endedMs: BASE_MS + 5000 }), NOW);
    const r = (await resumeAbaSession(db, 'kid', POOL))!;
    expect([r.reinforcerStale, r.board.earned, r.boardRev]).toEqual([undefined, 1, 1]);
  });

  it('(в) открытое предложение рутины → stale с вариантами предложения; до нового выбора обмена в сессии нет, после — есть', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    await startSession(db);
    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', WORK, { endedMs: BASE_MS + 5000 }), iso(BASE_MS + 5000));
    const stale = (await resumeAbaSession(db, 'kid', POOL))!;
    expect(stale.reinforcerStale).toBe(true);
    expect(stale.reinforcerOptions).toEqual(out.offer!.options);
    // доска снова набирается; на перерыве обмена нет, пока не выбрали
    const full = { ...stale, board: { ...stale.board, earned: 5 }, queue: [{ kind: 'break' as const }, ...stale.queue], breakStartedAt: BASE_MS + 6000 } as AbaSessionState;
    expect(finishBreak(full, BASE_MS + 7000).exchanged).toBe(0);
    const chosen = chooseReinforcer(stale, stale.reinforcerOptions[0], BASE_MS + 8000, 'child');
    expect(chosen.reinforcerStale).toBeUndefined();
    const fullChosen = { ...chosen, board: { ...chosen.board, earned: 5 }, queue: [{ kind: 'break' as const }, ...chosen.queue], breakStartedAt: BASE_MS + 8500 } as AbaSessionState;
    expect(finishBreak(fullChosen, BASE_MS + 9000).exchanged).toBe(5);
  });

  it('(в) повторное возобновление после выбора рутины и нового выбора сессии stale заново не ставит; новый выбор рутины — ставит', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    await startSession(db);
    await routineWithExchange(db, 'run-1', WORK, BASE_MS + 5000);
    const stale = (await resumeAbaSession(db, 'kid', POOL))!;
    expect(stale.reinforcerStale).toBe(true);
    const id = stale.reinforcerOptions[0];
    const chosen = chooseReinforcer(stale, id, BASE_MS + 8000, 'adult');
    await saveAbaSessionStep(db, 'kid', chosen, iso(BASE_MS + 8000), { source: 'session', sourceId: chosen.sessionId, reinforcerId: id, chosenBy: 'adult' });
    const again = (await resumeAbaSession(db, 'kid', POOL))!;
    expect(again.reinforcerStale).toBeUndefined();
    expect(again.reinforcerId).toBe(id);
    // второй выбор рутины после выбора сессии
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaBoard', { earned: 4, nonContingent: 0, rev: 9 }, NOW));
    await routineWithExchange(db, 'run-2', WORK, BASE_MS + 12_000);
    expect((await resumeAbaSession(db, 'kid', POOL))!.reinforcerStale).toBe(true);
  });

  it('(в) предложение рутины другого дня сессию не устаревает: жетоны ждут ближайшей точки обмена', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    await startSession(db);
    // второй прогон идёт на следующий день относительно дня сессии (`state.day`)
    const out = await commitRoutineRun(db, 'kid', routineResult('run-2', WORK), iso(BASE_MS + 5000));
    expect(out.offer).toBeDefined();
    const r = (await resumeAbaSession(db, 'kid', POOL))!;
    expect([r.reinforcerStale, r.board.earned]).toEqual([undefined, 5]);
  });
});

// ---------------------------------------------------------------------------

describe('commitAbaSession: обмен рутины в окне сессии без учёта — отказ', () => {
  const ses = (exchanges: number, sessionIndex: number): StageSession => ({ sessionIndex, exchanges, endReason: 'completed' });

  /** Оборванная сессия со ступенью 5 и одной записью «0 обменов»; обмен рутины в её окне — по желанию. */
  async function abandoned(withRoutineExchange: boolean) {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    const training: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: 5, atStage: [ses(0, 9)] };
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'tokenTraining', training, NOW));
    const st = await startSession(db, { tokenTraining: training });
    if (withRoutineExchange) await routineWithExchange(db, 'run-1', WORK, BASE_MS + 5000);
    const resumed = (await resumeAbaSession(db, 'kid', POOL))!;
    const ended = stopSession({ ...resumed, sessionIndex: st.sessionIndex }, 'abandoned');
    // признак не передан (устаревший итог или JS-вызов) — : поле остаётся пустым
    const finish = (extra: { routineExchangeInWindow?: boolean } = {}) =>
      finishAbaSession(ended, BASE_MS + 9000, {}, undefined, undefined, extra as { routineExchangeInWindow: boolean });
    return { db, finish, training };
  }
  const at = iso(BASE_MS + 9000);

  it('ноль обменов, обмен рутины в окне, признак не передан: RoutineWindowNotAccountedError, ничего не записано', async () => {
    const { db, finish, training } = await abandoned(true);
    const boardBefore = await boardOf(db);
    await expect(commitAbaSession(db, 'kid', finish(), at)).rejects.toBeInstanceOf(RoutineWindowNotAccountedError);
    expect(await sessionsOf(db, 'kid')).toEqual([]);
    expect(await loadChildState(db, 'kid', 'tokenTraining')).toEqual(training);
    expect(await boardOf(db)).toEqual(boardBefore);
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).not.toBeNull();
  });

  it('тот же итог с признаком true: записан, ступень 5 не падает', async () => {
    const { db, finish, training } = await abandoned(true);
    await commitAbaSession(db, 'kid', finish({ routineExchangeInWindow: true }), at);
    expect((await loadChildState(db, 'kid', 'tokenTraining'))!.stage).toBe(5);
    expect((await loadChildState(db, 'kid', 'tokenTraining'))!.atStage).toEqual(training.atStage);
    expect(await sessionsOf(db, 'kid')).toHaveLength(1);
  });

  it('признак false при обмене рутины в окне (контроль): отказа нет, ступень решается обычно, 5 → 3', async () => {
    const { db, finish } = await abandoned(true);
    await commitAbaSession(db, 'kid', finish({ routineExchangeInWindow: false }), at);
    expect((await loadChildState(db, 'kid', 'tokenTraining'))!.stage).toBe(3);
  });

  it('признак не передан, но обмена рутины в окне не было: записывается', async () => {
    const { db, finish } = await abandoned(false);
    await commitAbaSession(db, 'kid', finish(), at);
    expect(await sessionsOf(db, 'kid')).toHaveLength(1);
  });

  it('признак не передан и обмен рутины в окне, но у сессии обмены были (>0): без отказа', async () => {
    const { db, finish } = await abandoned(true);
    const r = finish();
    await commitAbaSession(db, 'kid', { ...r, session: { ...r.session, exchangesMade: 2 } }, at);
    expect(await sessionsOf(db, 'kid')).toHaveLength(1);
  });

  it('предложение рутины без выбора в окне обменом не считается: признак не нужен, сессия записывается', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    const st = await startSession(db);
    await commitRoutineRun(db, 'kid', routineResult('run-1', WORK, { endedMs: BASE_MS + 5000 }), iso(BASE_MS + 5000));
    const resumed = (await resumeAbaSession(db, 'kid', POOL))!;
    const ended = stopSession({ ...resumed, sessionIndex: st.sessionIndex }, 'abandoned');
    await commitAbaSession(db, 'kid', finishSession(ended, BASE_MS + 9000), at);
    expect(await sessionsOf(db, 'kid')).toHaveLength(1);
  });

  it('обмен рутины до старта сессии в окно не входит: признак не нужен', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    await routineWithExchange(db, 'run-1', WORK, BASE_MS - 4000, { endedMs: BASE_MS - 5000 });
    const st = await startSession(db);
    const ended = stopSession({ ...((await resumeAbaSession(db, 'kid', POOL))!), sessionIndex: st.sessionIndex }, 'abandoned');
    await commitAbaSession(db, 'kid', finishSession(ended, BASE_MS + 9000), at);
    expect(await sessionsOf(db, 'kid')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------

describe('миграция 9: журнал выборов подкрепителя', () => {
  const sessionRow = (index: number, reinforcerId: string | undefined, chosenBy?: 'child' | 'adult'): AbaSession =>
    ({
      id: `s-${index}`,
      index,
      startedAt: NOW,
      endedAt: NOW,
      config: 'with_adult',
      targetIds: [],
      reinforcerId,
      reinforcerChosenBy: chosenBy,
      tokensEarned: 0,
      exchangesMade: 0,
      endReason: 'completed',
      brokenTargetId: null,
      boardSize: 5,
      endedOnSuccess: true,
      events: [],
      primaryObserverId: null,
    }) as unknown as AbaSession;

  it('на базе версии 8 с данными: история переносится из сессий по порядку, пустой выбор — нет', async () => {
    const db = await memoryDb(8);
    expect(await db.all('PRAGMA user_version')).toEqual([{ user_version: 8 }]);
    await asAbaWriter(db, 'kid', async (tx) => {
      const rows: [number, string | undefined, 'child' | 'adult' | undefined, string][] = [
        [1, 'puzzle', 'child', '2026-09-01T10:00:00Z'],
        [2, '', undefined, '2026-09-02T10:00:00Z'],
        [3, 'drum', 'adult', '2026-09-03T10:00:00Z'],
        [4, 'train', undefined, '2026-09-04T10:00:00Z'],
        [5, undefined, undefined, '2026-09-05T10:00:00Z'],
      ];
      for (const [i, r, by, at] of rows) {
        await tx.run('INSERT INTO aba_sessions (child_id, id, session_index, body, recorded_at) VALUES (?, ?, ?, ?, ?)', [
          'kid',
          `s-${i}`,
          i,
          JSON.stringify(sessionRow(i, r, by)),
          at,
        ]);
      }
    });
    await migrate(db);
    expect(await db.all('PRAGMA user_version')).toEqual([{ user_version: MIGRATIONS.length }]);
    const rows = await db.all<Record<string, string>>(
      'SELECT child_id, chosen_at, source, source_id, reinforcer_id, chosen_by FROM aba_reinforcer_choices ORDER BY seq',
    );
    expect(rows).toEqual([
      { child_id: 'kid', chosen_at: '2026-09-01T10:00:00Z', source: 'session', source_id: 's-1', reinforcer_id: 'puzzle', chosen_by: 'child' },
      { child_id: 'kid', chosen_at: '2026-09-03T10:00:00Z', source: 'session', source_id: 's-3', reinforcer_id: 'drum', chosen_by: 'adult' },
      { child_id: 'kid', chosen_at: '2026-09-04T10:00:00Z', source: 'session', source_id: 's-4', reinforcer_id: 'train', chosen_by: 'child' },
    ]);
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual(['puzzle', 'drum', 'train']);
  });

  it('на пустой базе версии 8 миграция проходит, журнал пуст', async () => {
    const db = await memoryDb(8);
    await migrate(db);
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual([]);
  });

  it('повторное открытие базы ничего не дублирует', async () => {
    const db = await memoryDb(8);
    await asAbaWriter(db, 'kid', async (tx) => {
      await tx.run('INSERT INTO aba_sessions (child_id, id, session_index, body, recorded_at) VALUES (?, ?, ?, ?, ?)', ['kid', 's-1', 1, JSON.stringify(sessionRow(1, 'puzzle', 'child')), NOW]);
    });
    await migrate(db);
    await migrate(db);
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual(['puzzle']);
  });

  it('прежние триггеры на месте: запись проб в обход ворот по-прежнему отклоняется', async () => {
    const db = await memoryDb(8);
    await migrate(db);
    await expect(db.run("INSERT INTO aba_routine_runs (child_id, id, target_id, day, body, recorded_at) VALUES ('kid','x','R','2026-10-12','{}',?)", [NOW])).rejects.toThrow(/при согласии/);
  });
});

describe('журнал выборов: согласие, неизменяемость, удаление', () => {
  const raw = (db: SqlDb, kid = 'kid', id = 'puzzle', source = 'session', sourceId = 's-1') =>
    db.run(
      'INSERT INTO aba_reinforcer_choices (child_id, chosen_at, source, source_id, reinforcer_id, chosen_by) VALUES (?, ?, ?, ?, ?, ?)',
      [kid, NOW, source, sourceId, id, 'child'],
    );
  const put = (db: SqlDb, kid: string, id: string, at = NOW, sourceId = `s-${id}`) =>
    asAbaWriter(db, kid, (tx) => appendReinforcerChoice(tx, kid, { source: 'session', sourceId, reinforcerId: id, chosenBy: 'child' }, at));

  it('запись без согласия (мимо ворот) отклоняется базой', async () => {
    const db = await setup();
    await expect(raw(db)).rejects.toThrow(/при согласии/);
  });

  it('без согласия не пишется ни выбор рутины, ни шаг сессии с выбором', async () => {
    const db = await memoryDb();
    await expect(commitRoutineExchange(db, 'kid', 'run-1', 'drum', 'child', NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual([]);
  });

  it('журнал только дописывается: UPDATE и DELETE отклоняются', async () => {
    const db = await setup();
    await put(db, 'kid', 'puzzle');
    await expect(db.run("UPDATE aba_reinforcer_choices SET reinforcer_id = 'x'")).rejects.toThrow(/только дописывание/);
    await expect(db.run('DELETE FROM aba_reinforcer_choices')).rejects.toThrow(/только дописывание/);
  });

  it('пустой reinforcer_id и второй выбор на тот же прогон отклоняет сама база', async () => {
    const db = await setup();
    await expect(asAbaWriter(db, 'kid', async (tx) => {
        await raw(tx, 'kid', '', 'session', 's-1');
      })).rejects.toThrow();
    await asAbaWriter(db, 'kid', async (tx) => {
      await raw(tx, 'kid', 'a', 'routine', 'run-1');
    });
    await expect(asAbaWriter(db, 'kid', async (tx) => {
      await raw(tx, 'kid', 'b', 'routine', 'run-1');
    })).rejects.toThrow(/UNIQUE/);
  });

  it('отзыв согласия при оставшихся выборах база отклоняет', async () => {
    const db = await setup();
    await put(db, 'kid', 'puzzle');
    await expect(
      db.transaction((tx) => insertConsentEvent(tx, abaConsent('revoke', { at: '2026-10-12T12:00:00Z' }), 'owner')),
    ).rejects.toThrow(/вместе с удалением/);
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual(['puzzle']);
  });

  it('revokeAbaProcessing удаляет выборы ребёнка, чужие остаются', async () => {
    const db = await setup({ kids: ['kid', 'sib'] });
    await put(db, 'kid', 'puzzle');
    await put(db, 'sib', 'drum');
    await revokeAbaProcessing(db, abaConsent('revoke', { at: '2026-10-12T12:00:00Z' }), 'owner');
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual([]);
    expect(await reinforcerHistoryOf(db, 'sib')).toEqual(['drum']);
  });

  it('clearChildProgress удаляет выборы ребёнка, чужие остаются', async () => {
    const db = await setup({ kids: ['kid', 'sib'] });
    await put(db, 'kid', 'puzzle');
    await put(db, 'sib', 'drum');
    await clearChildProgress(db, 'kid');
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual([]);
    expect(await reinforcerHistoryOf(db, 'sib')).toEqual(['drum']);
  });

  it('purgeChild удаляет выборы ребёнка, чужие остаются', async () => {
    const db = await setup({ kids: ['kid', 'sib'] });
    await put(db, 'kid', 'train');
    await put(db, 'sib', 'drum');
    await purgeChild(db, 'kid', PSEUDO);
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual([]);
    expect(await reinforcerHistoryOf(db, 'sib')).toEqual(['drum']);
  });

  it('wipeDevice удаляет выборы всех детей', async () => {
    const db = await setup({ kids: ['kid', 'sib'] });
    await put(db, 'kid', 'puzzle');
    await put(db, 'sib', 'drum');
    await wipeDevice(db);
    expect(await db.all('SELECT 1 FROM aba_reinforcer_choices')).toEqual([]);
  });

  it('abaDataSummary считает выборы подкрепителя ребёнка, чужие не считает', async () => {
    const db = await setup({ kids: ['kid', 'sib'] });
    await put(db, 'kid', 'puzzle');
    await put(db, 'kid', 'drum', '2026-10-12T10:05:00Z', 's-drum');
    await put(db, 'sib', 'train');
    expect((await abaDataSummary(db, 'kid')).reinforcerChoices).toBe(2);
    expect((await abaDataSummary(db, 'sib')).reinforcerChoices).toBe(1);
  });

  it('abaDataSummary: после отзыва выборов не остаётся', async () => {
    const db = await setup();
    await put(db, 'kid', 'puzzle');
    await revokeAbaProcessing(db, abaConsent('revoke', { at: '2026-10-12T12:00:00Z' }), 'owner');
    expect((await abaDataSummary(db, 'kid')).reinforcerChoices).toBe(0);
  });

  it('срок хранения удаляет старые выборы по chosen_at, свежие остаются', async () => {
    const db = await setup();
    await put(db, 'kid', 'old', '2025-09-01T10:00:00Z');
    await put(db, 'kid', 'new', '2026-10-01T10:00:00Z');
    expect(await applyRetention(db, new Date(NOW))).toBe(1);
    expect(await reinforcerHistoryOf(db, 'kid')).toEqual(['new']);
  });
});

describe('экспорт: прогоны и выборы', () => {
  it('родителю — история выборов как записана, прогон с предложением обмена и вариантами', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    const out = await commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW);
    await commitRoutineExchange(db, 'kid', 'run-1', out.offer!.options[0], 'child', NOW);
    const exp = await exportChild(db, 'kid', NOW, {});
    expect(exp.abaReinforcerChoices).toEqual([
      { chosenAt: '2026-10-12T10:00:00.000Z', source: 'routine', sourceId: 'run-1', reinforcerId: out.offer!.options[0], chosenBy: 'child', tokens: 5 },
    ]);
    expect((exp.abaRoutineRuns as AbaRoutineRun[])[0].exchangeOffer).toEqual(out.offer);
  });

  it('специалисту — день и длительность вместо точного времени; предложение без вариантов подкрепителей', async () => {
    const db = await setup({ board: { earned: 4, nonContingent: 0 } });
    await commitRoutineRun(db, 'kid', routineResult('run-1', WORK), NOW);
    const [run] = (await exportForSpecialist(db, 'kid', NOW)).abaRoutineRuns as Record<string, unknown>[];
    expect(run).not.toHaveProperty('startedAt');
    expect(run).not.toHaveProperty('endedAt');
    expect(run).not.toHaveProperty('exchanged');
    expect(run).toMatchObject({ day: '2026-10-12', durationSec: 60, exchangeOffer: { tokens: 5, boardSize: 5 } });
    expect(Object.keys(run.exchangeOffer as object).sort()).toEqual(['boardSize', 'tokens']);
  });

  it('специалисту: отрицательная длительность при сбитых часах не уходит в минус', async () => {
    const db = await setup({ board: { earned: 0, nonContingent: 0 } });
    const r = routineResult('run-1', NONE);
    await commitRoutineRun(db, 'kid', { ...r, record: { ...r.record, startedAt: iso(BASE_MS + 100_000), endedAt: iso(BASE_MS) } }, NOW);
    const [run] = (await exportForSpecialist(db, 'kid', NOW)).abaRoutineRuns as { durationSec: number }[];
    expect(run.durationSec).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe('Т11: свойство — случайные чередования сессии и рутин сохраняют жетоны', () => {
  // инвариант новой модели: начало + жетоны сессии + жетоны рутин − обмены сессии − tokens выбранных обменов
  // рутин = итог. Предложение без выбора жетоны не уносит.
  const RUNS = 220;
  const stats = { chosenOffers: 0, choiceSteps: 0, conflicts: 0, routineExchanges: 0, sessionExchanges: 0, stale: 0, pending: 0, routines: 0, ended: 0 };

  async function scenario(n: number): Promise<{ seed: number; expected: number; actual: number }> {
    const seed = 9000 + n;
    const rng = seeded(seed).rng;
    const pick = (k: number) => Math.floor(rng() * k);
    const cfg = [
      { band: '7' as const, stage: 5 as BoardStage },
      { band: '5-6' as const, stage: 3 as BoardStage },
      { band: '7' as const, stage: 3 as BoardStage },
    ][pick(3)];
    const size = cfg.band === '5-6' ? 3 : cfg.stage;
    const startEarned = pick(size);
    const db = await setup({ stage: cfg.stage, board: { earned: startEarned, nonContingent: Math.min(startEarned, pick(size)) } });
    const training: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: cfg.stage };
    let now = BASE_MS;
    let routinePaid = 0;
    let routineExchanged = 0; // сумма tokens выбранных обменов рутин
    let routineNo = 0;
    const doRoutine = async () => {
      now += 500;
      routineNo += 1;
      const claim = [NONE, WORK, PARTICIPATION][pick(3)];
      const out = await commitRoutineRun(
        db,
        'kid',
        routineResult(`r-${routineNo}`, claim, { endedMs: now, band: cfg.band, seed: seed + routineNo }),
        iso(now),
      );
      stats.routines += 1;
      routinePaid += out.token === null ? 0 : claim.tokens;
      if (out.offer) {
        stats.routineExchanges += 1;
        if (rng() < 0.5) {
          // выбор может не состояться: сессия обменяла раньше, или это уже не последнее предложение
          try {
            const spent = await commitRoutineExchange(db, 'kid', `r-${routineNo}`, out.offer.options[pick(3)], rng() < 0.3 ? 'adult' : 'child', iso(now));
            routineExchanged += spent.tokens;
            stats.chosenOffers += 1;
          } catch (e) {
            if (!(e instanceof ExchangeNotOpenError)) throw e;
          }
        }
      }
    };

    if (rng() < 0.3) await doRoutine();
    const start = (await boardOf(db))!;
    const startEarnedLive = start.earned;
    // рутина до старта уже на доске: в учёт идут только прогоны после старта сессии
    const paidBefore = routinePaid;
    const exchangedBefore = routineExchanged;
    let st = beginSession({ band: cfg.band, tokenTraining: training, board: start, boardRev: boardRevOf(start), seed, startedAt: BASE_MS });
    st = await saveAbaSessionStep(db, 'kid', st, iso(now), { source: 'session', sourceId: st.sessionId, reinforcerId: st.reinforcerId!, chosenBy: 'child' });

    let result: ReturnType<typeof finishAbaSession> | undefined;
    for (let guard = 0; guard < 400 && !result; guard += 1) {
      if (routineNo < 3 && rng() < 0.2) await doRoutine();
      now += 1000;
      try {
        if (st.reinforcerStale && rng() < 0.5) {
          const id = st.reinforcerOptions[pick(st.reinforcerOptions.length)];
          const by = rng() < 0.3 ? 'adult' : 'child';
          st = await saveAbaSessionStep(db, 'kid', chooseReinforcer(st, id, now, by), iso(now), { source: 'session', sourceId: st.sessionId, reinforcerId: id, chosenBy: by });
          continue;
        }
        const next = nextStep(st, now);
        switch (next.step.kind) {
          case 'trial': {
            const res = recordTrial(next.state, correctInput(next.state, next.step), now);
            if (!res.ok) throw new Error(res.errors.join('; '));
            st = await recordAbaTrial(db, 'kid', res.trial, res.state, iso(now));
            break;
          }
          case 'choose_reinforcer': {
            // устарел и доска полна: сессия сама просит выбор до обмена (перерыв, конец, обучение доске)
            expect(next.state.reinforcerStale).toBe(true);
            stats.choiceSteps += 1;
            const id = next.step.options[pick(next.step.options.length)];
            const by = rng() < 0.3 ? 'adult' : 'child';
            st = await saveAbaSessionStep(db, 'kid', chooseReinforcer(next.state, id, now, by), iso(now), {
              source: 'session',
              sourceId: st.sessionId,
              reinforcerId: id,
              chosenBy: by,
            });
            break;
          }
          case 'break':
            st = await saveAbaSessionStep(db, 'kid', finishBreak(next.state, now).state, iso(now));
            break;
          case 'access':
            st = await saveAbaSessionStep(db, 'kid', finishAccess(next.state, now), iso(now));
            break;
          case 'adult_finish_chain':
            st = await saveAbaSessionStep(db, 'kid', finishChainByAdult(next.state), iso(now));
            break;
          case 'end': {
            const inWindow = await routineExchangeInSessionWindow(db, 'kid', next.state);
            const r = finishAbaSession(next.state, now, {}, undefined, undefined, { routineExchangeInWindow: inWindow });
            await commitAbaSession(db, 'kid', r, iso(now));
            result = r;
            break;
          }
          default:
            throw new Error(`неожиданный шаг ${JSON.stringify(next.step)}`);
        }
      } catch (e) {
        if (!(e instanceof AbaBoardConflictError)) throw e;
        stats.conflicts += 1;
        st = (await resumeAbaSession(db, 'kid', POOL))!;
        if (st.reinforcerStale) stats.stale += 1;
      }
    }
    if (!result) throw new Error(`seed ${seed}: сессия не кончилась`);
    stats.ended += 1;

    const sessionExchanged = result.session.events.reduce((sum, e) => sum + (e.kind === 'exchange' ? e.tokens : 0), 0);
    if (sessionExchanged > 0) stats.sessionExchanges += 1;
    if (rng() < 0.5) await doRoutine();
    if (rng() < 0.3) await doRoutine();

    // записи прогонов согласуются с учётом
    // выбранные обмены рутин в журнале — ровно те, что учтены; сумма tokens сходится
    const chosenRows = await db.all<{ tokens: number }>("SELECT tokens FROM aba_reinforcer_choices WHERE source = 'routine'");
    expect(chosenRows.reduce((s, r) => s + r.tokens, 0)).toBe(routineExchanged);
    const open = await openRoutineOfferOf(db, 'kid', `2026-10-${11 + routineNo}`);
    if (open) {
      stats.pending += 1;
      // открытое предложение: доска всё ещё полна, жетоны никуда не делись
      expect((await boardOf(db))!.earned).toBeGreaterThanOrEqual(open.boardSize);
    }

    const expected =
      startEarnedLive + result.session.tokensEarned + (routinePaid - paidBefore) - sessionExchanged - (routineExchanged - exchangedBefore);
    return { seed, expected, actual: (await boardOf(db))!.earned };
  }

  it(`${RUNS} случайных прогонов: начало + жетоны сессии + жетоны рутин − обмены сессии − tokens выбранных обменов рутин = итог на доске`, async () => {
    for (let n = 0; n < RUNS; n += 1) {
      const r = await scenario(n);
      expect({ seed: r.seed, earned: r.actual }).toEqual({ seed: r.seed, earned: r.expected });
    }
    // свойство не пустое: конфликты, устаревший выбор и обмены обеих сторон действительно случались
    expect(stats.ended).toBe(RUNS);
    expect(stats.conflicts).toBeGreaterThan(0);
    expect(stats.stale).toBeGreaterThan(0);
    expect(stats.choiceSteps).toBeGreaterThan(0);
    expect(stats.routineExchanges).toBeGreaterThan(0);
    expect(stats.sessionExchanges).toBeGreaterThan(0);
    expect(stats.pending).toBeGreaterThan(0);
    expect(stats.chosenOffers).toBeGreaterThan(0);
  }, 300_000);
});
