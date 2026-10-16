/**
 * Защиты записи итога рутины и сессии (`commit.ts`): один прогон рутины в календарный день,
 * конфликт состояния цели между стартом и фиксацией, слияние состояний по ключам в `commitIoa`,
 * `saveAbaTargets` и `commitAbaSession`. Всё в одной транзакции: отказ — ничего не записано.
 * Окно обмена рутины при итоге сессии — в `liveBoard.test.ts` (там же настоящая сессия).
 */
import type { AbaIoaRecord, AbaSession, AbaTargetState, AbaTrial } from '../../../types/aba';
import type { RoutineRunResult, RoutineRunState } from '../../../domain/abaRoutineRun';
import type { AbaSessionResult } from '../../../domain/abaSession';
import { initialTokenTraining, type TokenTrainingState } from '../../../domain/abaTokenTraining';
import type { ConsentEvent } from '../../../domain/consent';
import { RoutineAlreadyRunError, RoutineStateConflictError, routineRunsOf } from '../abaLog';
import { loadChildState, saveChildState } from '../childState';
import { commitAbaSession, commitIoa, commitRoutineRun, recordRoutineStep, saveAbaTargets } from '../commit';
import { appendConsentEvent } from '../consentLog';
import { exportForSpecialist } from '../purge';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const NOW = '2026-10-12T10:00:00Z';
const POOL = ['puzzle', 'bubbles', 'drum', 'stickers', 'train', 'balloon'];
const TRAINED: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: 5 };

async function dbWithAba(): Promise<SqlDb> {
  const db = await memoryDb();
  const consent: ConsentEvent = {
    id: 'aba-grant-kid',
    scope: 'aba_processing',
    action: 'grant',
    childId: 'kid',
    textVersion: 'ru-draft-1',
    confirmedBy: 'biometric',
    actorId: 'parent',
    at: '2026-10-12T09:00:00Z',
  };
  await appendConsentEvent(db, consent, 'owner');
  await asAbaWriter(db, 'kid', async (tx) => {
    await saveChildState(tx, 'kid', 'tokenTraining', TRAINED, NOW);
    await saveChildState(tx, 'kid', 'abaSessionIndex', 5, NOW);
    await saveChildState(tx, 'kid', 'abaBoard', { earned: 2, nonContingent: 1 }, NOW);
  });
  return db;
}

const targetsOf = (db: SqlDb) => loadChildState(db, 'kid', 'abaTargets');
const boardOf = (db: SqlDb) => loadChildState(db, 'kid', 'abaBoard');
const seedTargets = (db: SqlDb, targets: Record<string, AbaTargetState>) =>
  asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaTargets', targets, NOW));

const state = (targetId: string, over: Partial<AbaTargetState> = {}): AbaTargetState =>
  ({ targetId, phase: 'acquisition', ...over }) as AbaTargetState;

/** Итог прогона рутины в день `day`: `before` — состояние на старте, `after` — после прогона. */
function run(
  id: string,
  day: string,
  before: AbaTargetState,
  over: { targetId?: string; interrupted?: 'external' | null } = {},
): RoutineRunResult {
  const { targetId = 'R', interrupted = null } = over;
  const after = interrupted === 'external' ? before : { ...before, lastRoutineRunDay: day };
  return {
    trials: [],
    state: after,
    before,
    claim: { token: 'at_start_level', tokens: 1, nonContingent: false },
    record: {
      id,
      targetId,
      day,
      kind: 'teaching',
      startedAt: `${day}T08:00:00.000Z`,
      endedAt: `${day}T08:05:00.000Z`,
      interrupted,
      setting: 'usual',
      phase: null,
      primaryObserverId: null,
    },
    band: '7',
    reinforcerPool: POOL,
    seed: 7,
  };
}

describe('commitRoutineRun: один прогон рутины в календарный день', () => {
  it('второй прогон той же рутины в тот же день отклонён, второй записи и жетона нет', async () => {
    const db = await dbWithAba();
    const first = run('run-1', '2026-10-12', state('R'));
    await commitRoutineRun(db, 'kid', first, NOW);
    const boardAfterFirst = await boardOf(db);
    await expect(commitRoutineRun(db, 'kid', run('run-2', '2026-10-12', first.state), NOW)).rejects.toBeInstanceOf(RoutineAlreadyRunError);
    expect((await routineRunsOf(db, 'kid')).map((r) => r.id)).toEqual(['run-1']);
    expect(await boardOf(db)).toEqual(boardAfterFirst);
    expect(await targetsOf(db)).toEqual({ R: first.state });
  });

  it('прогон той же рутины на следующий день принимается', async () => {
    const db = await dbWithAba();
    const first = run('run-1', '2026-10-12', state('R'));
    await commitRoutineRun(db, 'kid', first, NOW);
    await commitRoutineRun(db, 'kid', run('run-2', '2026-10-13', first.state), NOW);
    expect((await routineRunsOf(db, 'kid')).map((r) => r.id)).toEqual(['run-1', 'run-2']);
  });

  it('другая рутина в тот же день принимается: правило на рутину, а не на ребёнка', async () => {
    const db = await dbWithAba();
    await commitRoutineRun(db, 'kid', run('run-1', '2026-10-12', state('R')), NOW);
    await commitRoutineRun(db, 'kid', run('run-2', '2026-10-12', state('R2'), { targetId: 'R2' }), NOW);
    expect((await routineRunsOf(db, 'kid')).map((r) => r.targetId)).toEqual(['R', 'R2']);
  });

  it('прогон с внешним обрывом принимается, даже если день уже занят', async () => {
    const db = await dbWithAba();
    const first = run('run-1', '2026-10-12', state('R'));
    await commitRoutineRun(db, 'kid', first, NOW);
    await commitRoutineRun(db, 'kid', run('run-2', '2026-10-12', first.state, { interrupted: 'external' }), NOW);
    expect(await routineRunsOf(db, 'kid')).toHaveLength(2);
    expect((await targetsOf(db))!.R).toEqual(first.state);
  });

  it('внешний обрыв день не занимает: обычный прогон в тот же день после него принимается', async () => {
    const db = await dbWithAba();
    const interrupted = run('run-1', '2026-10-12', state('R'), { interrupted: 'external' });
    await commitRoutineRun(db, 'kid', interrupted, NOW);
    expect((await targetsOf(db))!.R.lastRoutineRunDay).toBeUndefined();
    await commitRoutineRun(db, 'kid', run('run-2', '2026-10-12', interrupted.state), NOW);
    expect((await targetsOf(db))!.R.lastRoutineRunDay).toBe('2026-10-12');
  });
});

describe('commitRoutineRun: конфликт состояния цели между стартом и фиксацией', () => {
  const inProgress = { runId: 'run-1', observers: [], primaryObserverId: null, done: 1 } as unknown as RoutineRunState;
  const step = {
    id: 'tr-1',
    sessionId: 'run-1',
    targetId: 'R',
    exemplarId: 'R-e',
    stepId: 'R-s1',
    runIndex: 0,
    index: 0,
    kind: 'teaching',
    startPromptLevel: 0,
    promptLevelUsed: 0,
    presentations: 1,
    response: 'independent',
    emittedBeforePrompt: true,
    latencyMs: 500,
    latencyFromFirstSdMs: 500,
    latencySource: 'adult_press',
    promptDelayMs: 3000,
    responseWindowMs: 10000,
    presentationLog: [],
    sdEndedAt: NOW,
    scoredBy: 'adult',
    tokens: 0,
  } as AbaTrial;

  it('чужая запись той же цели за время прогона: RoutineStateConflictError, итог не записан', async () => {
    const db = await dbWithAba();
    const start = state('R');
    await seedTargets(db, { R: start });
    await recordRoutineStep(db, 'kid', step, inProgress, NOW);
    const foreign = state('R', { phase: 'mastered' });
    await saveAbaTargets(db, 'kid', { R: foreign }, NOW);
    const boardBefore = await boardOf(db);

    await expect(commitRoutineRun(db, 'kid', run('run-1', '2026-10-12', start), NOW)).rejects.toBeInstanceOf(RoutineStateConflictError);

    expect(await routineRunsOf(db, 'kid')).toEqual([]);
    expect(await boardOf(db)).toEqual(boardBefore);
    expect(await targetsOf(db)).toEqual({ R: foreign });
    // снимок прогона не снят: экран предложит начать заново, записанное звено на месте
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toEqual(inProgress);
  });

  it('состояние не менялось: прогон записывается', async () => {
    const db = await dbWithAba();
    const start = state('R', { lastSessionIndex: 3 });
    await seedTargets(db, { R: start });
    await commitRoutineRun(db, 'kid', run('run-1', '2026-10-12', start), NOW);
    expect(await routineRunsOf(db, 'kid')).toHaveLength(1);
  });

  it('первый прогон цели, которой в карте ещё нет: конфликта нет', async () => {
    const db = await dbWithAba();
    await commitRoutineRun(db, 'kid', run('run-1', '2026-10-12', state('R')), NOW);
    expect((await targetsOf(db))!.R.lastRoutineRunDay).toBe('2026-10-12');
  });
});

describe('слияние состояний целей по ключам', () => {
  const session = (over: Partial<AbaSession> = {}): AbaSession => ({
    id: 's-5',
    index: 5,
    startedAt: '2026-10-12T08:00:00.000Z',
    endedAt: '2026-10-12T08:10:00.000Z',
    config: 'with_adult',
    targetIds: ['A'],
    reinforcerId: 'puzzle',
    reinforcerChosenBy: 'child',
    tokensEarned: 0,
    exchangesMade: 1,
    endReason: 'completed',
    brokenTargetId: null,
    boardSize: 5,
    endedOnSuccess: true,
    events: [],
    primaryObserverId: null,
    ...over,
  });
  const sessionResult = (states: Record<string, AbaTargetState>): AbaSessionResult =>
    ({
      session: session(),
      states,
      trials: [],
      board: { size: 5, earned: 2, nonContingent: 1 },
      boardRev: 0,
      exchanged: 0,
      tokenTraining: { pairingDone: true, pairingSessions: 2, pairingStreak: 2, stage: 5, atStage: [], flags: [] },
      identifySets: [],
    }) as AbaSessionResult;
  const ioa: AbaIoaRecord = {
    id: 'ioa-1',
    sessionId: 's-5',
    secondaryObserverId: 'obs-2',
    source: 'paper_entry',
    enteredAt: '2026-10-12T21:45:30.000Z',
    items: [],
    byTarget: {},
  };
  const A = state('A');
  const R = state('R', { lastRoutineRunDay: '2026-10-12' });

  async function dbWithSession() {
    const db = await dbWithAba();
    await seedTargets(db, { A, R });
    await commitAbaSession(db, 'kid', sessionResult({ A }), NOW);
    return db;
  }

  it('commitIoa не затирает рутину, записанную между чтением состояний и записью IOA', async () => {
    const db = await dbWithSession();
    // экран прочитал карту с R-до, пока шёл ввод IOA, прогон рутины записал R-после
    const rAfter = state('R', { lastRoutineRunDay: '2026-10-13', phase: 'maintenance' });
    await saveAbaTargets(db, 'kid', { R: rAfter }, NOW);
    const aAfterIoa = state('A', { phase: 'mastered' });
    await commitIoa(db, 'kid', ioa, { A: aAfterIoa }, NOW);
    expect(await targetsOf(db)).toEqual({ A: aAfterIoa, R: rAfter });
  });

  it('saveAbaTargets пишет только переданные цели и не затирает остальные', async () => {
    const db = await dbWithSession();
    const rNew = state('R', { lastRoutineRunDay: '2026-10-14' });
    await saveAbaTargets(db, 'kid', { R: rNew }, NOW);
    const aNew = state('A', { phase: 'maintenance' });
    await saveAbaTargets(db, 'kid', { A: aNew }, NOW);
    expect(await targetsOf(db)).toEqual({ A: aNew, R: rNew });
  });

  it('saveAbaTargets с пустым набором карту не стирает', async () => {
    const db = await dbWithSession();
    await saveAbaTargets(db, 'kid', {}, NOW);
    expect(await targetsOf(db)).toEqual({ A, R });
  });

  it('commitAbaSession пишет только затронутые цели и не затирает пересмотр, записанный за время свёрнутой сессии', async () => {
    const db = await dbWithAba();
    const B = state('B');
    await seedTargets(db, { A, B });
    const bReviewed = state('B', { assentConcernReviewed: { role: 'specialist', at: '2026-10-12' } });
    await saveAbaTargets(db, 'kid', { B: bReviewed }, NOW);
    const aAfter = state('A', { phase: 'maintenance' });
    await commitAbaSession(db, 'kid', sessionResult({ A: aAfter }), NOW);
    expect(await targetsOf(db)).toEqual({ A: aAfter, B: bReviewed });
  });

  it('commitAbaSession не затирает состояние, которое IOA изменил за время свёрнутой сессии', async () => {
    // сессия 5 завершена; IOA по ней обновил B; следующая сессия, начатая раньше IOA, не трогает B
    const db = await dbWithAba();
    const B = state('B');
    await seedTargets(db, { A, B });
    await commitAbaSession(db, 'kid', sessionResult({ A }), NOW);
    const bAfterIoa = state('B', { phase: 'mastered' });
    await commitIoa(db, 'kid', ioa, { B: bAfterIoa }, NOW);
    const next = sessionResult({ A: state('A', { phase: 'maintenance' }) });
    await commitAbaSession(db, 'kid', { ...next, session: { ...next.session, id: 's-6', index: 6 } }, NOW);
    expect((await targetsOf(db))!.B).toEqual(bAfterIoa);
  });
});

describe('экспорт специалисту: день сессии', () => {
  const sessionAt = (over: Record<string, unknown>) =>
    ({
      session: {
        id: 's-1',
        index: 5,
        startedAt: '2026-10-10T23:30:00.000Z', // 05:30 11 октября в Бишкеке (UTC+6)
        endedAt: '2026-10-10T23:40:00.000Z',
        config: 'with_adult',
        targetIds: [],
        reinforcerId: 'puzzle',
        reinforcerChosenBy: 'child',
        tokensEarned: 0,
        exchangesMade: 1,
        endReason: 'completed',
        brokenTargetId: null,
        boardSize: 5,
        endedOnSuccess: true,
        events: [],
        primaryObserverId: null,
        ...over,
      },
      states: {},
      trials: [],
      board: { size: 5, earned: 2, nonContingent: 1 },
      boardRev: 0,
      exchanged: 0,
      tokenTraining: TRAINED,
      identifySets: [],
    }) as unknown as AbaSessionResult;

  const exportedDay = async (over: Record<string, unknown>) => {
    const db = await dbWithAba();
    await commitAbaSession(db, 'kid', sessionAt(over), NOW);
    return ((await exportForSpecialist(db, 'kid', NOW)).abaSessions as { day: string }[])[0].day;
  };

  it('берёт локальный день записи сессии, а не UTC-дату метки (05:30 в Бишкеке)', async () => {
    expect(await exportedDay({ day: '2026-10-11' })).toBe('2026-10-11');
  });

  it('старая запись без day — UTC-дата метки', async () => {
    expect(await exportedDay({})).toBe('2026-10-10');
  });
});
