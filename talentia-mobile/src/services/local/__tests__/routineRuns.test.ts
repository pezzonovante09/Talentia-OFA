/**
 * Журнал прогонов рутин (миграция 8; раунд 2, Р3): запись — только через `commit.ts` при
 * согласии на данные ABA и одной транзакцией; журнал только дописывается; удаление, срок
 * хранения, отзыв и экспорт видят прогоны.
 */
import type { AbaRoutineRun, AbaSession, AbaTargetState, AbaTrial } from '../../../types/aba';
import type { RoutineRunResult, RoutineRunState } from '../../../domain/abaRoutineRun';
import type { AbaSessionResult, AbaSessionState } from '../../../domain/abaSession';
import { isPromptDependent } from '../../../domain/abaPrompting';
import { initialTokenTraining, type TokenTrainingState } from '../../../domain/abaTokenTraining';
import type { ConsentEvent } from '../../../domain/consent';
import {
  AbaConsentRequiredError,
  RoutineAlreadyRunError,
  RoutineStateConflictError,
  appendIoa,
  appendRoutineRun,
  appendSession,
  appendTrial,
  routineHistoryOf,
  routineRunsOf,
  trialsOfTarget,
} from '../abaLog';
import { ABA_STATE_KEYS, loadChildState, saveChildState } from '../childState';
import { commitAbaSession, commitIoa, commitRoutineRun, recordAbaTrial, recordRoutineStep, resumeAbaSession, setAbaObservers } from '../commit';
import { appendConsentEvent, insertConsentEvent } from '../consentLog';
import {
  abaDataSummary,
  applyRetention,
  clearChildProgress,
  exportChild,
  exportForSpecialist,
  purgeChild,
  revokeAbaProcessing,
  SPECIALIST_STATE_KEYS,
} from '../purge';
import type { SqlDb, SqlValue } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';
import { resultTail } from './routineResultTail';

const NOW = '2026-10-11T10:00:00Z';
const ABA_TEXT = 'ru-draft-1';
const PSEUDO = '5f0c2a8e-3b1d-4c6e-9a7f-2d8b1e4c7a90';
const OBSERVER = 'obs-uuid-7';

const abaConsent = (action: 'grant' | 'revoke', over: Partial<ConsentEvent> = {}): ConsentEvent => ({
  id: `aba-${action}-${over.childId ?? 'kid'}-${over.at ?? NOW}`,
  scope: 'aba_processing',
  action,
  childId: 'kid',
  textVersion: ABA_TEXT,
  confirmedBy: 'biometric',
  actorId: 'parent',
  at: NOW,
  ...over,
});

/** Сопряжение закончено, ступень 5: итог прогона без обучения доске `commitRoutineRun` не пишет. */
const TRAINED: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: 5 };
const POOL = ['puzzle', 'bubbles', 'drum', 'stickers', 'train', 'balloon'];

async function dbWithAbaConsent(...children: string[]) {
  const db = await memoryDb();
  for (const [i, childId] of (children.length ? children : ['kid']).entries()) {
    await appendConsentEvent(db, abaConsent('grant', { childId, at: `2026-10-11T09:0${i}:00Z` }), 'owner');
    await asAbaWriter(db, childId, (tx) => saveChildState(tx, childId, 'tokenTraining', TRAINED, NOW));
  }
  return db;
}

const routineRun = (id = 'run-1', over: Partial<AbaRoutineRun> = {}): AbaRoutineRun => ({
  id,
  targetId: 'R',
  day: '2026-10-11',
  kind: 'teaching',
  startedAt: '2026-10-11T08:00:00.000Z',
  endedAt: '2026-10-11T08:05:00.000Z',
  interrupted: null,
  setting: 'usual',
  token: 'at_start_level',
  phase: null,
  primaryObserverId: OBSERVER,
  ...over,
});

/** Запись прогона без того, что решает доска на момент фиксации. */
const recordBase = (id: string) => {
  const { token: _t, exchangeOffer: _o, ...base } = routineRun(id);
  return base;
};

const rState = { targetId: 'R', phase: 'acquisition', lastRoutineRunDay: '2026-10-11' } as AbaTargetState;
/** Состояние рутины на старте прогона (`RoutineRunResult.before`): ещё без прогонов. */
const rBefore = { targetId: 'R', phase: 'acquisition' } as AbaTargetState;
const aState = { targetId: 'A', phase: 'mastered' } as AbaTargetState;

const result = (id = 'run-1', over: Partial<RoutineRunResult> = {}): RoutineRunResult => ({
  trials: [],
  state: rState,
  before: rBefore,
  claim: { token: 'at_start_level', tokens: 1, nonContingent: false },
  record: recordBase(id),
  band: '7',
  reinforcerPool: POOL,
  seed: 7,
  ...resultTail(recordBase(id)),
  ...over,
});

const stepTrial = (id: string): AbaTrial => ({
  id,
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
});

const inProgress = { runId: 'run-1', observers: [], primaryObserverId: null, done: 1 } as unknown as RoutineRunState;

/** Ребёнок с ABA-состоянием до прогона: номер следующей сессии, цели, доска. */
async function seeded(db: SqlDb, childId = 'kid') {
  await asAbaWriter(db, childId, async (tx) => {
    await saveChildState(tx, childId, 'abaSessionIndex', 5, NOW);
    await saveChildState(tx, childId, 'abaTargets', { A: aState }, NOW);
    await saveChildState(tx, childId, 'abaBoard', { earned: 2, nonContingent: 1 }, NOW);
  });
}

describe('итог прогона рутины (commitRoutineRun)', () => {
  it('запись прогона, состояние рутины, доска и снятие свёрнутого прогона — вместе', async () => {
    const db = await dbWithAbaConsent();
    await seeded(db);
    await recordRoutineStep(db, 'kid', stepTrial('tr-1'), inProgress, NOW);
    await commitRoutineRun(db, 'kid', result(), NOW);
    expect(await routineRunsOf(db, 'kid')).toEqual([routineRun()]);
    expect(await routineRunsOf(db, 'kid', 'R')).toHaveLength(1);
    expect(await routineRunsOf(db, 'kid', 'A')).toEqual([]);
    expect(await loadChildState(db, 'kid', 'abaTargets')).toEqual({ A: aState, R: rState });
    expect(await loadChildState(db, 'kid', 'abaBoard')).toEqual({ earned: 3, nonContingent: 1, rev: 1 });
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toBeNull();
  });

  it('прогон не двигает номер сессии', async () => {
    const db = await dbWithAbaConsent();
    await seeded(db);
    await commitRoutineRun(db, 'kid', result(), NOW);
    expect(await loadChildState(db, 'kid', 'abaSessionIndex')).toBe(5);
  });

  it('звено прогона и снимок свёрнутого прогона пишутся вместе', async () => {
    const db = await dbWithAbaConsent();
    await recordRoutineStep(db, 'kid', stepTrial('tr-1'), inProgress, NOW);
    expect(await trialsOfTarget(db, 'kid', 'R')).toHaveLength(1);
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toEqual(inProgress);
    // противоречивая проба не пишется — снимок прежний
    const bad = { ...stepTrial('tr-2'), promptLevelUsed: 2 as const };
    await expect(recordRoutineStep(db, 'kid', bad, { ...inProgress, done: 2 }, NOW)).rejects.toThrow();
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toEqual(inProgress);
  });

  it('повтор того же прогона — сбой, и ничего из итога не записано', async () => {
    const db = await dbWithAbaConsent();
    await seeded(db);
    await commitRoutineRun(db, 'kid', result(), NOW);
    await recordRoutineStep(db, 'kid', stepTrial('tr-2'), inProgress, NOW);
    // другой день и верное «до»: правила дня и состояния пройдены, отказывает именно повтор id прогона
    const again = result('run-1', {
      state: { ...rState, phase: 'mastered', lastRoutineRunDay: '2026-10-12' },
      before: rState,
      record: { ...recordBase('run-1'), day: '2026-10-12' },
    });
    const err = await commitRoutineRun(db, 'kid', again, NOW).then(() => null, (e: unknown) => e);
    expect(err).not.toBeNull();
    expect(err).not.toBeInstanceOf(RoutineAlreadyRunError);
    expect(err).not.toBeInstanceOf(RoutineStateConflictError);
    expect(await routineRunsOf(db, 'kid')).toHaveLength(1);
    expect(await loadChildState(db, 'kid', 'abaTargets')).toEqual({ A: aState, R: rState });
    expect(await loadChildState(db, 'kid', 'abaBoard')).toEqual({ earned: 3, nonContingent: 1, rev: 1 });
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toEqual(inProgress);
  });

  /** Порт, который роняет запись снимка прогона — последнюю запись итога. */
  function failingLastWrite(db: SqlDb): SqlDb {
    const wrap = (d: SqlDb): SqlDb => ({
      run: async (sql: string, params?: readonly SqlValue[]) => {
        if (sql.startsWith('INSERT INTO child_state') && params?.[1] === 'abaRoutineRunInProgress') throw new Error('диск полон');
        return d.run(sql, params);
      },
      all: (sql, params) => d.all(sql, params),
      exec: (sql) => d.exec(sql),
      transaction: (fn) => d.transaction((tx) => fn(wrap(tx))),
    });
    return wrap(db);
  }

  it('сбой на последней записи итога откатывает весь итог', async () => {
    const db = await dbWithAbaConsent();
    await seeded(db);
    await recordRoutineStep(db, 'kid', stepTrial('tr-1'), inProgress, NOW);
    await expect(commitRoutineRun(failingLastWrite(db), 'kid', result(), NOW)).rejects.toThrow(/диск полон/);
    expect(await routineRunsOf(db, 'kid')).toEqual([]);
    expect(await loadChildState(db, 'kid', 'abaTargets')).toEqual({ A: aState });
    expect(await loadChildState(db, 'kid', 'abaBoard')).toEqual({ earned: 2, nonContingent: 1 });
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toEqual(inProgress);
  });
});

describe('согласие и неизменяемость журнала прогонов', () => {
  it('без согласия на ABA не пишется ни звено, ни итог прогона', async () => {
    const db = await memoryDb();
    await expect(recordRoutineStep(db, 'kid', stepTrial('tr-1'), inProgress, NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    await expect(commitRoutineRun(db, 'kid', result(), NOW)).rejects.toBeInstanceOf(AbaConsentRequiredError);
    expect(await routineRunsOf(db, 'kid')).toEqual([]);
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toBeUndefined();
  });

  it('в обход commit.ts база не пускает ни прогон, ни снимок прогона — даже при согласии', async () => {
    const db = await dbWithAbaConsent();
    await expect(appendRoutineRun(db, 'kid', routineRun(), NOW)).rejects.toThrow(/при согласии/);
    await expect(
      db.run("INSERT INTO aba_routine_runs (child_id, id, target_id, day, body, recorded_at) VALUES ('kid', 'x', 'R', '2026-10-11', '{}', ?)", [NOW]),
    ).rejects.toThrow(/при согласии/);
    await expect(saveChildState(db, 'kid', 'abaRoutineRunInProgress', inProgress, NOW)).rejects.toThrow(/при согласии/);
    expect(await routineRunsOf(db, 'kid')).toEqual([]);
  });

  it('журнал прогонов только дописывается: UPDATE и DELETE отклоняются', async () => {
    const db = await dbWithAbaConsent();
    await commitRoutineRun(db, 'kid', result(), NOW);
    await expect(db.run("UPDATE aba_routine_runs SET body = '{}'")).rejects.toThrow(/только дописывание/);
    await expect(db.run('DELETE FROM aba_routine_runs')).rejects.toThrow(/только дописывание/);
    expect(await routineRunsOf(db, 'kid')).toHaveLength(1);
  });
});

describe('удаление, срок хранения и отзыв видят прогоны', () => {
  async function twoKids() {
    const db = await dbWithAbaConsent('kid', 'sib');
    for (const kid of ['kid', 'sib']) {
      await recordRoutineStep(db, kid, { ...stepTrial(`tr-${kid}`) }, inProgress, NOW);
      await commitRoutineRun(db, kid, result(`run-${kid}`), NOW);
      await recordRoutineStep(db, kid, { ...stepTrial(`tr2-${kid}`) }, inProgress, NOW);
    }
    return db;
  }

  it('purgeChild удаляет прогоны и свёрнутый прогон ребёнка, другого не трогает', async () => {
    const db = await twoKids();
    await purgeChild(db, 'kid', PSEUDO);
    expect(await routineRunsOf(db, 'kid')).toEqual([]);
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toBeUndefined();
    expect(await routineRunsOf(db, 'sib')).toHaveLength(1);
  });

  it('clearChildProgress удаляет прогоны ребёнка', async () => {
    const db = await twoKids();
    await clearChildProgress(db, 'kid');
    expect(await routineRunsOf(db, 'kid')).toEqual([]);
    expect(await routineRunsOf(db, 'sib')).toHaveLength(1);
  });

  it('revokeAbaProcessing удаляет прогоны и свёрнутый прогон, подсчёт перед отзывом их видит', async () => {
    const db = await twoKids();
    expect((await abaDataSummary(db, 'kid')).routineRuns).toBe(1);
    await revokeAbaProcessing(db, abaConsent('revoke', { at: '2026-10-11T11:00:00Z' }), 'owner');
    expect(await abaDataSummary(db, 'kid')).toMatchObject({ routineRuns: 0, trials: 0, settings: false });
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toBeUndefined();
    expect(await routineRunsOf(db, 'sib')).toHaveLength(1);
  });

  it('срок хранения удаляет старые прогоны, свежие остаются, удаление свежего не открывается', async () => {
    const db = await dbWithAbaConsent();
    await commitRoutineRun(db, 'kid', result('run-old'), '2025-09-01T10:00:00Z');
    // тот же день занят: новый прогон — на следующий день, от итога первого
    const next = { ...rState, lastRoutineRunDay: '2026-10-12' };
    await commitRoutineRun(db, 'kid', result('run-new', { state: next, before: rState, record: { ...recordBase('run-new'), day: '2026-10-12' } }), '2026-10-01T10:00:00Z');
    expect(await applyRetention(db, new Date(NOW))).toBe(1);
    expect((await routineRunsOf(db, 'kid')).map((r) => r.id)).toEqual(['run-new']);
    await expect(db.run('DELETE FROM aba_routine_runs')).rejects.toThrow(/только дописывание/);
  });

  it('отзыв мимо удаления при оставшемся прогоне база не примет', async () => {
    const db = await dbWithAbaConsent();
    await asAbaWriter(db, 'kid', (tx) => appendRoutineRun(tx, 'kid', routineRun(), NOW));
    await expect(
      db.transaction((tx) => insertConsentEvent(tx, abaConsent('revoke', { at: '2026-10-11T12:00:00Z' }), 'owner')),
    ).rejects.toThrow(/вместе с удалением/);
    expect(await routineRunsOf(db, 'kid')).toHaveLength(1);
  });

  it('отзыв мимо удаления при свёрнутом прогоне база не примет', async () => {
    const db = await dbWithAbaConsent();
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaRoutineRunInProgress', inProgress, NOW));
    await expect(
      db.transaction((tx) => insertConsentEvent(tx, abaConsent('revoke', { at: '2026-10-11T12:00:00Z' }), 'owner')),
    ).rejects.toThrow(/вместе с удалением/);
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toEqual(inProgress);
  });
});

describe('экспорт видит прогоны', () => {
  it('родителю — прогоны как записаны', async () => {
    const db = await dbWithAbaConsent();
    await commitRoutineRun(db, 'kid', result(), NOW);
    const out = await exportChild(db, 'kid', NOW, {});
    expect(out.abaRoutineRuns).toEqual([routineRun()]);
  });

  it('специалисту — прогоны, ведущий наблюдатель меткой O1, без uuid взрослого', async () => {
    const db = await dbWithAbaConsent();
    await setAbaObservers(db, 'kid', [{ id: OBSERVER, role: 'parent', trained: false }], NOW);
    await commitRoutineRun(db, 'kid', result(), NOW);
    const out = await exportForSpecialist(db, 'kid', NOW);
    const { startedAt: _s, endedAt: _e, ...rest } = routineRun();
    expect(out.abaRoutineRuns).toEqual([{ ...rest, durationSec: 300, primaryObserverId: 'O1' }]);
    expect(out.state.abaObservers).toEqual([{ id: 'O1', role: 'parent', trained: false }]);
    expect(JSON.stringify(out)).not.toContain(OBSERVER);
  });
});

describe('экспорт специалисту: пробы звеньев рутины без абсолютного времени', () => {
  // прогон стартовал в 08:00:00.000Z (routineRun): все времена звена — смещения от него
  const at = (ms: number) => new Date(Date.parse('2026-10-11T08:00:00.000Z') + ms).toISOString();
  const timedStep = (id: string): AbaTrial => ({
    ...stepTrial(id),
    sdEndedAt: at(2000),
    latencyMs: 500,
    latencyFromFirstSdMs: 500,
    presentationLog: [
      { level: 0, by: 'app', startedAt: at(1000), endedAt: at(4000), windowMs: 10000, outcome: 'correct', respondedAt: at(3500) },
    ],
    // поля, которого нет в типе сегодня: любая ISO-дата внутри пробы тоже заменяется
    ...({ futureAt: at(9000) } as object),
  });
  type Exported = {
    sdEndedAt: unknown;
    latencyMs: unknown;
    latencyFromFirstSdMs: unknown;
    futureAt?: unknown;
    presentationLog: Record<string, unknown>[];
  };

  async function exported(startedAt = '2026-10-11T08:00:00.000Z') {
    const db = await dbWithAbaConsent();
    await recordRoutineStep(db, 'kid', timedStep('tr-r'), inProgress, NOW);
    await commitRoutineRun(db, 'kid', result('run-1', { record: { ...recordBase('run-1'), startedAt } }), NOW);
    return db;
  }

  it('в пробах рутины нет ни одной ISO-даты и часов прогона', async () => {
    const db = await exported();
    const out = await exportForSpecialist(db, 'kid', NOW);
    const json = JSON.stringify(out.abaTrials);
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(json).not.toContain('2026-10-11');
    expect(json).not.toContain('08:00');
  });

  it('даты заменены смещениями в мс от начала прогона, латентности сохранены', async () => {
    const db = await exported();
    const [t] = (await exportForSpecialist(db, 'kid', NOW)).abaTrials as Exported[];
    expect(t.sdEndedAt).toBe(2000);
    expect(t.futureAt).toBe(9000);
    expect(t.presentationLog[0]).toMatchObject({ startedAt: 1000, endedAt: 4000, respondedAt: 3500, windowMs: 10000 });
    expect([t.latencyMs, t.latencyFromFirstSdMs]).toEqual([500, 500]);
  });

  it('пробы сессии без записи сессии (свёрнута) не теряются, но и времени суток не несут: отсчёт от самой ранней пробы', async () => {
    const db = await exported();
    const sessionTrial = { ...timedStep('tr-s'), sessionId: 's-5', targetId: 'A', stepId: undefined, runIndex: undefined };
    const snapshot = { sessionId: 's-5', board: { size: 5, earned: 1, nonContingent: 0 }, boardRev: 1, observers: [], primaryObserverId: null } as unknown as AbaSessionState;
    await recordAbaTrial(db, 'kid', sessionTrial, snapshot, NOW);
    const out = (await exportForSpecialist(db, 'kid', NOW)).abaTrials as (Exported & { sessionId: string })[];
    const orphan = out.find((t) => t.sessionId === 's-5');
    expect(orphan?.sdEndedAt).toBe(0);
    expect(JSON.stringify(orphan)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('родителю пробы рутины уходят с датами как записано', async () => {
    const db = await exported();
    const [t] = (await exportChild(db, 'kid', NOW, {})).abaTrials as Exported[];
    expect(t.sdEndedAt).toBe(at(2000));
  });

  it('битая дата начала прогона: durationSec = null, а даты проб не остаются ISO', async () => {
    const db = await exported('не дата');
    const out = await exportForSpecialist(db, 'kid', NOW);
    expect((out.abaRoutineRuns as { durationSec: number | null }[])[0].durationSec).toBeNull();
    expect(JSON.stringify(out.abaTrials)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('сессия, свёрнутая на время прогона рутины', () => {
  const session: AbaSession = {
    id: 's-5',
    index: 5,
    startedAt: NOW,
    endedAt: NOW,
    config: 'with_adult',
    targetIds: ['A'],
    reinforcerId: 'puzzle',
    reinforcerChosenBy: 'child',
    tokensEarned: 1,
    exchangesMade: 0,
    endReason: 'completed',
    brokenTargetId: null,
    boardSize: 5,
    endedOnSuccess: true,
    events: [],
    primaryObserverId: null,
  };
  const aAfter = { targetId: 'A', phase: 'maintenance' } as AbaTargetState;
  const sessionSnapshot = () =>
    ({ sessionId: 's-5', startedAt: Date.parse(NOW), seed: 1, reinforcerChosenAt: null, board: { size: 5, earned: 2, nonContingent: 1 }, boardRev: 0 }) as unknown as AbaSessionState;
  // итог сессии рутин не содержит (`finishAbaSession`): только её цели
  const sessionResult = {
    session,
    states: { A: aAfter },
    trials: [],
    board: { size: 5, earned: 4, nonContingent: 1 },
    boardRev: 1,
    exchanged: 0,
    tokenTraining: { pairingDone: true, pairingSessions: 2, pairingStreak: 2, stage: 5, atStage: [], flags: [] },
    identifySets: [],
  } as AbaSessionResult;

  it('итог прогона, записанный посреди сессии, переживает итог сессии', async () => {
    const db = await dbWithAbaConsent();
    await seeded(db);
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaTargets', { A: aState, R: rBefore }, NOW));
    // сессия начата и свёрнута на шаге
    await recordAbaTrial(db, 'kid', { ...stepTrial('tr-s'), sessionId: 's-5', targetId: 'A', stepId: undefined, runIndex: undefined }, sessionSnapshot(), NOW);
    // прогон рутины прошёл и зафиксирован
    await commitRoutineRun(db, 'kid', result(), NOW);
    expect((await loadChildState(db, 'kid', 'abaTargets'))?.R).toEqual(rState);
    // сессию возобновили по живой доске (рутина добавила жетон) и закончили
    const resumed = await resumeAbaSession(db, 'kid', POOL);
    expect([resumed?.board.earned, resumed?.boardRev]).toEqual([3, 1]);
    await commitAbaSession(db, 'kid', sessionResult, NOW);
    expect(await loadChildState(db, 'kid', 'abaTargets')).toEqual({ A: aAfter, R: rState });
  });
});

describe('экспорт специалисту без снимков «в работе»', () => {
  const sessionSnapshotBase = { sessionId: 's-5', board: { size: 5, earned: 0, nonContingent: 0 }, boardRev: 0 };

  it('при свёрнутых сессии и прогоне в выгрузке нет uuid наблюдателя', async () => {
    const db = await dbWithAbaConsent();
    const observers = [{ id: OBSERVER, role: 'parent' as const, trained: false }];
    await setAbaObservers(db, 'kid', observers, NOW);
    await recordAbaTrial(
      db,
      'kid',
      { ...stepTrial('tr-s'), sessionId: 's-5', targetId: 'A', stepId: undefined, runIndex: undefined },
      { ...sessionSnapshotBase, observers, primaryObserverId: OBSERVER } as unknown as AbaSessionState,
      NOW,
    );
    await recordRoutineStep(db, 'kid', stepTrial('tr-r'), { ...inProgress, observers, primaryObserverId: OBSERVER } as RoutineRunState, NOW);
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).not.toBeUndefined();
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).not.toBeUndefined();

    const out = await exportForSpecialist(db, 'kid', NOW);
    expect(JSON.stringify(out)).not.toContain(OBSERVER);
    expect(out.state).not.toHaveProperty('abaSessionInProgress');
    expect(out.state).not.toHaveProperty('abaRoutineRunInProgress');
    expect(out.abaTrials).toHaveLength(2);
  });

  it('фиксатор: специалисту не уходят ровно три ключа ABA — снимки «в работе» и открытая форма места', () => {
    const excluded = ABA_STATE_KEYS.filter((k) => !(SPECIALIST_STATE_KEYS as readonly string[]).includes(k));
    expect(excluded).toEqual(['abaSessionInProgress', 'abaRoutineRunInProgress', 'abaRoutineSettingOpen']);
  });
});

describe('экспорт специалисту: сессии, пробы сессий, IOA и состояние без времени суток (№96)', () => {
  const ISO_DATETIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
  const START = '2026-10-11T07:31:15.000Z';
  const at = (ms: number) => new Date(Date.parse(START) + ms).toISOString();
  const SESSION: AbaSession = {
    id: 's-7',
    index: 7,
    startedAt: START,
    endedAt: at(600_000),
    config: 'with_adult',
    targetIds: ['A'],
    reinforcerId: 'puzzle',
    reinforcerChosenBy: 'child',
    tokensEarned: 1,
    exchangesMade: 1,
    endReason: 'completed',
    brokenTargetId: null,
    boardSize: 5,
    endedOnSuccess: true,
    events: [
      { kind: 'break', startedAt: at(60_000), endedAt: at(90_000) },
      { kind: 'exchange', at: at(120_000), tokens: 1 },
      { kind: 'access', startedAt: at(121_000), endedAt: at(151_000) },
    ],
    primaryObserverId: null,
  };
  const sessionResult = (session: AbaSession): AbaSessionResult =>
    ({
      session,
      states: {},
      trials: [],
      board: { size: 5, earned: 0, nonContingent: 0 },
      boardRev: 0,
      exchanged: 1,
      tokenTraining: { pairingDone: true, pairingSessions: 2, pairingStreak: 2, stage: 5, atStage: [], flags: [] },
      identifySets: [],
    }) as AbaSessionResult;
  const timedTrial: AbaTrial = {
    ...stepTrial('tr-7'),
    sessionId: 's-7',
    targetId: 'A',
    stepId: undefined,
    runIndex: undefined,
    sdEndedAt: at(5000),
    latencyMs: 700,
    latencyFromFirstSdMs: 700,
    presentationLog: [
      { level: 0, by: 'app', startedAt: at(1000), endedAt: at(4000), windowMs: 10000, outcome: 'correct', respondedAt: at(2700) },
    ],
  };
  const snap = { sessionId: 's-7', board: { size: 5, earned: 0, nonContingent: 0 }, boardRev: 0, observers: [], primaryObserverId: null } as unknown as AbaSessionState;
  const ioaRecord = {
    id: 'ioa-1',
    sessionId: 's-7',
    secondaryObserverId: 'obs-2',
    source: 'paper_entry' as const,
    enteredAt: '2026-10-12T21:45:30.000Z',
    items: [],
    byTarget: {},
  };

  async function withSession(session: AbaSession = SESSION) {
    const db = await dbWithAbaConsent();
    await recordAbaTrial(db, 'kid', timedTrial, snap, NOW);
    await commitAbaSession(db, 'kid', sessionResult(session), NOW);
    return db;
  }
  type ExportedSession = Record<string, unknown> & { events: Record<string, unknown>[] };

  it('сессия: нет ISO-датавремени и часов начала, есть day и durationSec', async () => {
    const db = await withSession();
    const out = await exportForSpecialist(db, 'kid', NOW);
    const json = JSON.stringify(out.abaSessions);
    expect(json).not.toMatch(ISO_DATETIME);
    expect(json).not.toContain('07:31');
    const [s] = out.abaSessions as ExportedSession[];
    expect([s.day, s.durationSec]).toEqual(['2026-10-11', 600]);
    expect(s).not.toHaveProperty('startedAt');
    expect(s).not.toHaveProperty('endedAt');
  });

  it('сессия: времена событий — смещения в мс от начала сессии', async () => {
    const db = await withSession();
    const [s] = (await exportForSpecialist(db, 'kid', NOW)).abaSessions as ExportedSession[];
    expect(s.events).toEqual([
      { kind: 'break', startedAt: 60_000, endedAt: 90_000 },
      { kind: 'exchange', at: 120_000, tokens: 1 },
      { kind: 'access', startedAt: 121_000, endedAt: 151_000 },
    ]);
  });

  it('незавершённая сессия (endedAt = null): durationSec = null', async () => {
    const db = await withSession({ ...SESSION, endedAt: null });
    const [s] = (await exportForSpecialist(db, 'kid', NOW)).abaSessions as ExportedSession[];
    expect(s.durationSec).toBeNull();
    expect(JSON.stringify(s)).not.toMatch(ISO_DATETIME);
  });

  it('сессия: конец раньше начала (часы ушли назад) — durationSec = 0, а не отрицательное число', async () => {
    const db = await withSession({ ...SESSION, endedAt: at(-90_000) });
    const [s] = (await exportForSpecialist(db, 'kid', NOW)).abaSessions as ExportedSession[];
    expect(s.durationSec).toBe(0);
  });

  it('пробы сессии: нет ISO, даты — смещения от начала своей сессии, латентности целы', async () => {
    const db = await withSession();
    const out = await exportForSpecialist(db, 'kid', NOW);
    expect(JSON.stringify(out.abaTrials)).not.toMatch(ISO_DATETIME);
    const [t] = out.abaTrials as { sdEndedAt: unknown; latencyMs: unknown; latencyFromFirstSdMs: unknown; presentationLog: Record<string, unknown>[] }[];
    expect(t.sdEndedAt).toBe(5000);
    expect(t.presentationLog[0]).toMatchObject({ startedAt: 1000, endedAt: 4000, respondedAt: 2700, windowMs: 10000 });
    expect([t.latencyMs, t.latencyFromFirstSdMs]).toEqual([700, 700]);
  });

  it('пробы сессии и пробы рутины считаются каждая от своего начала', async () => {
    const db = await withSession();
    const runAt = (ms: number) => new Date(Date.parse('2026-10-11T08:00:00.000Z') + ms).toISOString();
    await recordRoutineStep(db, 'kid', { ...stepTrial('tr-r'), sdEndedAt: runAt(2000) }, inProgress, NOW);
    await commitRoutineRun(db, 'kid', result(), NOW);
    const out = (await exportForSpecialist(db, 'kid', NOW)).abaTrials as { id: string; sdEndedAt: unknown }[];
    expect(out.map((t) => [t.id, t.sdEndedAt])).toEqual([
      ['tr-7', 5000],
      ['tr-r', 2000],
    ]);
  });

  it('IOA: нет enteredAt, есть enteredDay', async () => {
    const db = await withSession();
    await commitIoa(db, 'kid', ioaRecord, {}, NOW);
    const out = await exportForSpecialist(db, 'kid', NOW);
    const [r] = out.abaIoa as Record<string, unknown>[];
    expect(r).not.toHaveProperty('enteredAt');
    expect(r.enteredDay).toBe('2026-10-12');
    expect(JSON.stringify(out.abaIoa)).not.toMatch(ISO_DATETIME);
  });

  it('сквозное: во всей выгрузке специалисту нет времени суток вида ЧЧ:ММ (кроме момента самой выгрузки)', async () => {
    const db = await withSession();
    await commitIoa(db, 'kid', ioaRecord, {}, NOW);
    await recordRoutineStep(db, 'kid', { ...stepTrial('tr-r'), sdEndedAt: '2026-10-11T08:03:40.000Z' }, inProgress, NOW);
    await commitRoutineRun(db, 'kid', result(), NOW);
    await asAbaWriter(db, 'kid', async (tx) => {
      await saveChildState(tx, 'kid', 'abaTargets', { A: { ...aState, assentConcernReviewed: { role: 'specialist', at: '2026-10-09T18:20:00.000Z' } } }, NOW);
      await saveChildState(tx, 'kid', 'physicalPromptAllowed', { value: true, setAt: '2026-10-10T06:05:00.000Z', setByRole: 'owner' }, NOW);
    });
    const { exportedAt, ...rest } = await exportForSpecialist(db, 'kid', NOW);
    expect(exportedAt).toBe(NOW);
    const json = JSON.stringify(rest);
    expect(json).not.toMatch(/dd:dd/);
    // проверка не пустая: пробы, сессия, IOA, прогон рутины и состояние — на месте
    expect([rest.abaTrials.length, rest.abaSessions.length, rest.abaIoa.length, rest.abaRoutineRuns.length]).toEqual([2, 1, 1, 1]);
  });

  it('состояние: assentConcernReviewed.at и physicalPromptAllowed.setAt — только даты', async () => {
    const db = await dbWithAbaConsent();
    await asAbaWriter(db, 'kid', async (tx) => {
      await saveChildState(
        tx,
        'kid',
        'abaTargets',
        { A: { ...aState, assentConcernReviewed: { role: 'specialist', at: '2026-10-09T18:20:00.000Z' } } },
        NOW,
      );
      await saveChildState(tx, 'kid', 'physicalPromptAllowed', { value: true, setAt: '2026-10-10T06:05:00.000Z', setByRole: 'owner' }, NOW);
    });
    const out = await exportForSpecialist(db, 'kid', NOW);
    const targets = out.state.abaTargets as Record<string, { assentConcernReviewed: { role: string; at: string } }>;
    expect(targets.A.assentConcernReviewed).toEqual({ role: 'specialist', at: '2026-10-09' });
    expect(out.state.physicalPromptAllowed).toEqual({ value: true, setAt: '2026-10-10', setByRole: 'owner' });
    expect(JSON.stringify(out.state)).not.toMatch(ISO_DATETIME);
  });

  it('родителю (exportChild) всё как записано: даты и время суток целы', async () => {
    const db = await withSession();
    await commitIoa(db, 'kid', ioaRecord, {}, NOW);
    await asAbaWriter(db, 'kid', (tx) =>
      saveChildState(tx, 'kid', 'physicalPromptAllowed', { value: true, setAt: '2026-10-10T06:05:00.000Z', setByRole: 'owner' }, NOW),
    );
    const out = await exportChild(db, 'kid', NOW, {});
    const [s] = out.abaSessions as AbaSession[];
    expect([s.startedAt, s.endedAt, s.events]).toEqual([SESSION.startedAt, SESSION.endedAt, SESSION.events]);
    const [t] = out.abaTrials as AbaTrial[];
    expect([t.sdEndedAt, t.presentationLog[0].startedAt]).toEqual([at(5000), at(1000)]);
    expect((out.abaIoa as { enteredAt: string }[])[0].enteredAt).toBe('2026-10-12T21:45:30.000Z');
    expect(out.state.physicalPromptAllowed).toMatchObject({ setAt: '2026-10-10T06:05:00.000Z' });
  });
});

describe('срок хранения снимков «в работе»', () => {
  const OLD = Date.parse('2025-09-01T10:00:00Z');
  const FRESH = Date.parse('2026-10-10T10:00:00Z');

  it('старый снимок удалён, свежий остался, у другого ребёнка не тронут', async () => {
    const db = await dbWithAbaConsent('kid', 'sib');
    await asAbaWriter(db, 'kid', async (tx) => {
      await saveChildState(tx, 'kid', 'abaSessionInProgress', { sessionId: 's-old', startedAt: OLD } as AbaSessionState, NOW);
      await saveChildState(tx, 'kid', 'abaRoutineRunInProgress', { ...inProgress, startedAt: FRESH } as RoutineRunState, NOW);
      await saveChildState(tx, 'kid', 'abaSessionIndex', 3, NOW);
    });
    await asAbaWriter(db, 'sib', (tx) =>
      saveChildState(tx, 'sib', 'abaRoutineRunInProgress', { ...inProgress, startedAt: FRESH } as RoutineRunState, NOW),
    );

    expect(await applyRetention(db, new Date(NOW))).toBe(1);
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toBeUndefined();
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toMatchObject({ startedAt: FRESH });
    expect(await loadChildState(db, 'kid', 'abaSessionIndex')).toBe(3);
    expect(await loadChildState(db, 'sib', 'abaRoutineRunInProgress')).toMatchObject({ startedAt: FRESH });
  });

  it('старый снимок прогона рутины тоже удаляется, снятый (null) — не мешает', async () => {
    const db = await dbWithAbaConsent();
    await asAbaWriter(db, 'kid', async (tx) => {
      await saveChildState(tx, 'kid', 'abaRoutineRunInProgress', { ...inProgress, startedAt: OLD } as RoutineRunState, NOW);
      await saveChildState(tx, 'kid', 'abaSessionInProgress', null, NOW);
    });
    expect(await applyRetention(db, new Date(NOW))).toBe(1);
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toBeUndefined();
    expect(await loadChildState(db, 'kid', 'abaSessionInProgress')).toBeNull();
  });
});

describe('история прогонов рутины для детектора зависимости (routineHistoryOf)', () => {
  const st = (d: string) => ({ targetId: 'R', phase: 'acquisition', lastRoutineRunDay: d }) as AbaTargetState;
  async function finishRun(
    db: SqlDb,
    id: string,
    d: string,
    before: AbaTargetState,
    after: AbaTargetState,
    over: Partial<AbaRoutineRun> = {},
    at = NOW,
    trials: AbaTrial[] = [{ ...stepTrial(`tr-${id}`), sessionId: id }],
  ) {
    for (const t of trials) await recordRoutineStep(db, 'kid', { ...t, sessionId: id }, { ...inProgress, runId: id } as RoutineRunState, at);
    await commitRoutineRun(db, 'kid', result(id, { before, state: after, record: { ...recordBase(id), day: d, ...over } }), at);
  }

  it('номера — сквозные `runNo`; входят только прогоны обучения, не отменённые извне и не оборванные срывом, с пробами', async () => {
    const db = await dbWithAbaConsent();
    await finishRun(db, 'run-1', '2026-10-11', rBefore, st('2026-10-11'), { runNo: 1 });
    await finishRun(db, 'run-2', '2026-10-12', st('2026-10-11'), st('2026-10-12'), { kind: 'maintenance', runNo: 2 });
    await finishRun(db, 'run-3', '2026-10-13', st('2026-10-12'), st('2026-10-12'), { interrupted: 'external' });
    await finishRun(db, 'run-4', '2026-10-14', st('2026-10-12'), st('2026-10-14'), { interrupted: 'breakdown', runNo: 3 });
    await finishRun(db, 'run-5', '2026-10-15', st('2026-10-14'), st('2026-10-15'), { runNo: 4 });
    const history = await routineHistoryOf(db, 'kid', 'R');
    expect(history.runs.map((x) => [x.index, x.trials.map((t) => t.id)])).toEqual([
      [1, ['tr-run-1']],
      [4, ['tr-run-5']],
    ]);
  });

  it('пробы, не идущие в освоение (оценка устройством без права на освоение), в историю не входят — как в finishRoutineRun', async () => {
    const db = await dbWithAbaConsent();
    const own = { ...stepTrial('tr-own'), sessionId: 'run-1' };
    const child = { ...stepTrial('tr-child'), sessionId: 'run-1', scoredBy: 'device_onset' as const, latencySource: 'device_onset' as const };
    await finishRun(db, 'run-1', '2026-10-11', rBefore, st('2026-10-11'), { runNo: 1 }, NOW, [own, child]);
    const [only] = (await routineHistoryOf(db, 'kid', 'R')).runs;
    expect(only.trials.map((t) => t.id)).toEqual(['tr-own']);
  });

  it('рутина без прогонов: пусто; чужая рутина и чужой ребёнок не мешают', async () => {
    const db = await dbWithAbaConsent('kid', 'sib');
    expect(await routineHistoryOf(db, 'kid', 'R')).toEqual({ runs: [] });
    await finishRun(db, 'run-1', '2026-10-11', rBefore, st('2026-10-11'), { runNo: 1 });
    expect((await routineHistoryOf(db, 'kid', 'R2')).runs).toEqual([]);
    expect((await routineHistoryOf(db, 'sib', 'R')).runs).toEqual([]);
  });

  it('окно ограничено limit: свежие прогоны, номера сохранены', async () => {
    const db = await dbWithAbaConsent();
    await finishRun(db, 'run-1', '2026-10-11', rBefore, st('2026-10-11'), { runNo: 1 });
    await finishRun(db, 'run-2', '2026-10-12', st('2026-10-11'), st('2026-10-12'), { runNo: 2 });
    await finishRun(db, 'run-3', '2026-10-13', st('2026-10-12'), st('2026-10-13'), { runNo: 3 });
    const history = await routineHistoryOf(db, 'kid', 'R', 2);
    expect(history.runs.map((x) => x.index)).toEqual([2, 3]);
  });

  it('после срока хранения номера не сдвигаются: детектор с флагом на прогоне 2 по-прежнему видит новые прогоны', async () => {
    const db = await dbWithAbaConsent();
    const OLD = '2025-01-01T00:00:00Z';
    await finishRun(db, 'run-1', '2025-01-01', rBefore, st('2025-01-01'), { runNo: 1 }, OLD);
    await finishRun(db, 'run-2', '2025-01-02', st('2025-01-01'), st('2025-01-02'), { runNo: 2 }, OLD);
    // зависимость: «молчал до подсказки» — две пробы в прогоне, три прогона по пять с лишним
    const dependent = (id: string, n: number): AbaTrial[] =>
      [1, 2].map((k) => ({
        ...stepTrial(`tr-${id}-${k}`),
        sessionId: id,
        stepId: `R-s${k}`,
        response: 'prompted' as const,
        promptLevelUsed: 1,
        emittedBeforePrompt: false,
        latencyFromFirstSdMs: 3500,
        id: `tr-${id}-${k}-${n}`,
      }));
    await finishRun(db, 'run-3', '2026-10-11', st('2025-01-02'), st('2026-10-11'), { runNo: 3 }, NOW, dependent('run-3', 3));
    await finishRun(db, 'run-4', '2026-10-12', st('2026-10-11'), st('2026-10-12'), { runNo: 4 }, NOW, dependent('run-4', 4));
    await finishRun(db, 'run-5', '2026-10-13', st('2026-10-12'), st('2026-10-13'), { runNo: 5 }, NOW, dependent('run-5', 5));
    expect((await routineHistoryOf(db, 'kid', 'R')).runs.map((x) => x.index)).toEqual([1, 2, 3, 4, 5]);

    expect(await applyRetention(db, new Date(NOW))).toBeGreaterThan(0);

    const { runs } = await routineHistoryOf(db, 'kid', 'R');
    // позиции сдвинулись бы на 1..3, а флаг стоит на 2 — старый индекс отсёк бы два из трёх прогонов
    expect(runs.map((x) => x.index)).toEqual([3, 4, 5]);
    const flaggedAt2 = { ...(rState as AbaTargetState), dependenceFlaggedAtSession: 2 } as AbaTargetState;
    expect(isPromptDependent(flaggedAt2, [...runs])).toBe(true);
    // и флаг на прогоне 3 их, наоборот, честно отсекает: окно начинается заново
    expect(isPromptDependent({ ...flaggedAt2, dependenceFlaggedAtSession: 3 }, [...runs])).toBe(false);
  });
});

describe('время записи журнала — всегда UTC ISO с миллисекундами (В-4)', () => {
  const session = { id: 's-1', index: 1 } as AbaSession;
  const ioa = { id: 'i-1', sessionId: 's-1' } as never;
  const stamp = async (db: SqlDb, table: string) => (await db.all<{ recorded_at: string }>(`SELECT recorded_at FROM ${table}`))[0].recorded_at;

  it('пояс и доли секунды приводятся к UTC с миллисекундами в пробе, сессии, IOA и прогоне рутины', async () => {
    const db = await dbWithAbaConsent();
    await asAbaWriter(db, 'kid', async (tx) => {
      await appendTrial(tx, 'kid', stepTrial('tr-1'), '2026-10-11T13:00:00+03:00');
      await appendSession(tx, 'kid', session, '2026-10-11T10:00:00Z');
      await appendIoa(tx, 'kid', ioa, '2026-10-11T10:00:00.5Z');
      await appendRoutineRun(tx, 'kid', routineRun('run-1'), '2026-10-11T16:00:00+06:00');
    });
    expect(await stamp(db, 'aba_trials')).toBe('2026-10-11T10:00:00.000Z');
    expect(await stamp(db, 'aba_sessions')).toBe('2026-10-11T10:00:00.000Z');
    expect(await stamp(db, 'aba_ioa')).toBe('2026-10-11T10:00:00.500Z');
    expect(await stamp(db, 'aba_routine_runs')).toBe('2026-10-11T10:00:00.000Z');
  });

  it('не дата — понятная ошибка, ничего не записано', async () => {
    const db = await dbWithAbaConsent();
    for (const bad of ['', 'вчера', '2026-13-45']) {
      await expect(asAbaWriter(db, 'kid', (tx) => appendRoutineRun(tx, 'kid', routineRun('run-x'), bad))).rejects.toThrow(/не дата/);
      await expect(asAbaWriter(db, 'kid', (tx) => appendTrial(tx, 'kid', stepTrial('tr-x'), bad))).rejects.toThrow(/не дата/);
    }
    expect(await db.all('SELECT 1 FROM aba_routine_runs')).toEqual([]);
    expect(await db.all('SELECT 1 FROM aba_trials')).toEqual([]);
  });
});
