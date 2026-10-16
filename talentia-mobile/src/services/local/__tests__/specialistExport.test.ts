/**
 * Экспорт специалисту (№95, №96) сквозным тестом и граничные случаи раунда 3:
 * - в данных ребёнка нет ни времени суток (`чч:мм`), ни ISO-даты со временем — кроме `exportedAt`;
 * - проба без отсчёта (нет записи сессии и нет разбираемого `sdEndedAt`) отдаёт `null` на месте дат,
 *   а не абсолютные миллисекунды эпохи;
 * - `endedAt` раньше `startedAt` — длительность 0, не отрицательная;
 * - `recorded_at` прогона нормализован до `toISOString()`, `routineExchangedSince` сравнивает верно.
 */
import type { AbaRoutineRun, AbaSession, AbaTargetState, AbaTrial } from '../../../types/aba';
import type { RoutineRunResult, RoutineRunState } from '../../../domain/abaRoutineRun';
import type { AbaSessionResult, AbaSessionState } from '../../../domain/abaSession';
import { initialTokenTraining, type TokenTrainingState } from '../../../domain/abaTokenTraining';
import type { ConsentEvent } from '../../../domain/consent';
import { appendRoutineRun, routineExchangedSince } from '../abaLog';
import { saveChildState } from '../childState';
import { commitAbaSession, commitIoa, commitRoutineRun, recordAbaTrial, recordRoutineStep, setAbaObservers } from '../commit';
import { appendConsentEvent } from '../consentLog';
import { exportForSpecialist } from '../purge';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const NOW = '2026-10-11T10:00:00Z';
const OBSERVER = 'obs-uuid-7';
const POOL = ['puzzle', 'bubbles', 'drum', 'stickers', 'train', 'balloon'];
const TRAINED: TokenTrainingState = { ...initialTokenTraining(), pairingDone: true, stage: 5 };
const TOKEN_TRAINING = { pairingDone: true, pairingSessions: 2, pairingStreak: 2, stage: 5, atStage: [], flags: [] };

const grant = (childId: string, at: string): ConsentEvent => ({
  id: `aba-grant-${childId}`,
  scope: 'aba_processing',
  action: 'grant',
  childId,
  textVersion: 'ru-draft-1',
  confirmedBy: 'biometric',
  actorId: 'parent',
  at,
});

async function dbWithConsent(): Promise<SqlDb> {
  const db = await memoryDb();
  await appendConsentEvent(db, grant('kid', '2026-10-11T09:00:00Z'), 'owner');
  await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'tokenTraining', TRAINED, NOW));
  return db;
}

// --- сессия ------------------------------------------------------------------------------------

const START = '2026-10-11T07:31:15.000Z';
const at = (ms: number, base = START) => new Date(Date.parse(base) + ms).toISOString();
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
  primaryObserverId: OBSERVER,
};
const sessionResult = (session: AbaSession): AbaSessionResult =>
  ({
    session,
    states: {},
    trials: [],
    board: { size: 5, earned: 0, nonContingent: 0 },
    boardRev: 0,
    exchanged: 1,
    tokenTraining: TOKEN_TRAINING,
    identifySets: [],
  }) as AbaSessionResult;

const baseTrial: AbaTrial = {
  id: 'tr-7',
  sessionId: 's-7',
  targetId: 'A',
  exemplarId: 'A-e',
  stepId: undefined,
  runIndex: undefined,
  index: 0,
  kind: 'teaching',
  startPromptLevel: 0,
  promptLevelUsed: 0,
  presentations: 1,
  response: 'independent',
  emittedBeforePrompt: true,
  latencyMs: 700,
  latencyFromFirstSdMs: 700,
  latencySource: 'adult_press',
  promptDelayMs: 3000,
  responseWindowMs: 10000,
  presentationLog: [{ level: 0, by: 'app', startedAt: at(1000), endedAt: at(4000), windowMs: 10000, outcome: 'correct', respondedAt: at(2700) }],
  sdEndedAt: at(5000),
  scoredBy: 'adult',
  tokens: 0,
};
const snapOf = (sessionId: string) =>
  ({ sessionId, board: { size: 5, earned: 0, nonContingent: 0 }, boardRev: 0, observers: [], primaryObserverId: null }) as unknown as AbaSessionState;

// --- прогон рутины -----------------------------------------------------------------------------

const RUN_START = '2026-10-11T08:00:00.000Z';
const routineRun = (id = 'run-1', over: Partial<AbaRoutineRun> = {}): AbaRoutineRun => ({
  id,
  targetId: 'R',
  day: '2026-10-11',
  kind: 'teaching',
  startedAt: RUN_START,
  endedAt: at(300_000, RUN_START),
  interrupted: null,
  setting: 'usual',
  token: 'at_start_level',
  exchanged: 0,
  phase: null,
  primaryObserverId: OBSERVER,
  ...over,
});
const rState = { targetId: 'R', phase: 'acquisition', lastRoutineRunDay: '2026-10-11' } as AbaTargetState;
const routineResult = (id: string, record: Partial<AbaRoutineRun> = {}): RoutineRunResult => {
  const { token: _t, exchanged: _e, exchangeOptions: _o, ...base } = routineRun(id, record);
  return { trials: [], state: rState, before: { targetId: 'R', phase: 'acquisition' } as AbaTargetState, claim: { token: 'at_start_level', tokens: 1, nonContingent: false }, record: base, band: '7', reinforcerPool: POOL, seed: 7 };
};
const stepTrial = (id: string, over: Partial<AbaTrial> = {}): AbaTrial => ({
  ...baseTrial,
  id,
  sessionId: 'run-1',
  targetId: 'R',
  exemplarId: 'R-e',
  stepId: 'R-s1',
  runIndex: 0,
  sdEndedAt: at(2000, RUN_START),
  presentationLog: [{ level: 0, by: 'app', startedAt: at(1000, RUN_START), endedAt: at(4000, RUN_START), windowMs: 10000, outcome: 'correct', respondedAt: at(3500, RUN_START) }],
  ...over,
});
const inProgress = { runId: 'run-1', observers: [], primaryObserverId: null, done: 1 } as unknown as RoutineRunState;

/** Все числа внутри значения. */
function numbers(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(numbers);
  if (value && typeof value === 'object') return Object.values(value).flatMap(numbers);
  return [];
}

describe('экспорт специалисту: нет времени суток в данных ребёнка (сквозной)', () => {
  async function richDb() {
    const db = await dbWithConsent();
    await setAbaObservers(db, 'kid', [{ id: OBSERVER, role: 'parent', trained: false }], NOW);
    await recordAbaTrial(db, 'kid', baseTrial, snapOf('s-7'), NOW);
    await commitAbaSession(db, 'kid', sessionResult(SESSION), NOW);
    // свёрнутая сессия без записи: отсчёт от самой ранней пробы
    await recordAbaTrial(db, 'kid', { ...baseTrial, id: 'tr-orphan', sessionId: 's-9', sdEndedAt: at(9000) }, snapOf('s-9'), NOW);
    await commitIoa(
      db,
      'kid',
      { id: 'ioa-1', sessionId: 's-7', secondaryObserverId: 'obs-2', source: 'paper_entry', enteredAt: '2026-10-12T21:45:30.000Z', items: [], byTarget: {} },
      {},
      NOW,
    );
    // рутина последней: её жетон двигает доску, и записи сессии после неё потребовали бы возобновления
    await recordRoutineStep(db, 'kid', stepTrial('tr-r'), inProgress, NOW);
    await commitRoutineRun(db, 'kid', routineResult('run-1'), NOW);
    await asAbaWriter(db, 'kid', async (tx) => {
      await saveChildState(
        tx,
        'kid',
        'abaTargets',
        { A: { targetId: 'A', phase: 'mastered', assentConcernReviewed: { role: 'specialist', at: '2026-10-09T18:20:00.000Z' } } as AbaTargetState },
        NOW,
      );
      await saveChildState(tx, 'kid', 'physicalPromptAllowed', { value: true, setAt: '2026-10-10T06:05:00.000Z', setByRole: 'owner' }, NOW);
    });
    return db;
  }

  it('без поля exportedAt в JSON нет шаблона чч:мм', async () => {
    const { exportedAt: _ignored, ...child } = await exportForSpecialist(await richDb(), 'kid', '2026-10-12T13:37:00.000Z');
    expect(JSON.stringify(child)).not.toMatch(/\d{2}:\d{2}/);
  });

  it('без поля exportedAt в JSON нет ни одной ISO-даты со временем', async () => {
    const { exportedAt: _ignored, ...child } = await exportForSpecialist(await richDb(), 'kid', '2026-10-12T13:37:00.000Z');
    expect(JSON.stringify(child)).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}/);
  });

  it('фиксатор: выгрузка непустая — проверяемые разделы на месте и exportedAt остаётся как передан', async () => {
    const out = await exportForSpecialist(await richDb(), 'kid', '2026-10-12T13:37:00.000Z');
    expect([out.abaTrials.length, out.abaSessions.length, out.abaIoa.length, out.abaRoutineRuns.length]).toEqual([3, 1, 1, 1]);
    expect(out.exportedAt).toBe('2026-10-12T13:37:00.000Z');
    expect(Object.keys(out.state)).toEqual(expect.arrayContaining(['abaTargets', 'physicalPromptAllowed']));
  });

  it('в пробах и сессиях нет абсолютных миллисекунд эпохи', async () => {
    const out = await exportForSpecialist(await richDb(), 'kid', NOW);
    expect(numbers([out.abaTrials, out.abaSessions, out.abaRoutineRuns]).filter((n) => Math.abs(n) > 1e11)).toEqual([]);
  });

  it('в выгрузке нет uuid наблюдателя', async () => {
    const out = await exportForSpecialist(await richDb(), 'kid', NOW);
    expect(JSON.stringify(out)).not.toContain(OBSERVER);
  });
});

describe('экспорт специалисту: проба без отсчёта', () => {
  const noAnchor = (over: Partial<AbaTrial> = {}): AbaTrial => ({ ...baseTrial, id: 'tr-x', sessionId: 's-ghost', sdEndedAt: 'не дата', ...over });

  async function exportedWith(trial: AbaTrial) {
    const db = await dbWithConsent();
    await recordAbaTrial(db, 'kid', trial, snapOf(trial.sessionId), NOW);
    return (await exportForSpecialist(db, 'kid', NOW)).abaTrials as { id: string; sdEndedAt: unknown; presentationLog: Record<string, unknown>[] }[];
  }

  it('без записи сессии и без разбираемого sdEndedAt даты в журнале предъявлений — null', async () => {
    const [t] = await exportedWith(noAnchor());
    expect(t.presentationLog[0]).toMatchObject({ startedAt: null, endedAt: null, respondedAt: null });
  });

  it('такая проба не отдаёт чисел больше 10^11 (абсолютное время эпохи)', async () => {
    const [t] = await exportedWith(noAnchor());
    expect(numbers(t).filter((n) => Math.abs(n) > 1e11)).toEqual([]);
  });

  it('такая проба не несёт ISO-даты и времени суток', async () => {
    const [t] = await exportedWith(noAnchor());
    expect(JSON.stringify(t)).not.toMatch(/\d{4}-\d{2}-\d{2}T|\d{2}:\d{2}/);
  });

  it('латентности целы, а нечитаемая строка sdEndedAt проходит как есть', async () => {
    const [t] = await exportedWith(noAnchor());
    expect([t.sdEndedAt, (t as unknown as { latencyMs: number }).latencyMs]).toEqual(['не дата', 700]);
  });

  it('контроль: с разбираемым sdEndedAt отсчёт есть — смещения числами от самой ранней пробы', async () => {
    const [t] = await exportedWith(noAnchor({ sdEndedAt: at(5000) }));
    expect([t.sdEndedAt, t.presentationLog[0]]).toEqual([0, expect.objectContaining({ startedAt: -4000, endedAt: -1000, respondedAt: -2300 })]);
  });
});

describe('экспорт специалисту: отрицательная длительность', () => {
  async function exportedSession(session: AbaSession) {
    const db = await dbWithConsent();
    await commitAbaSession(db, 'kid', sessionResult(session), NOW);
    return (await exportForSpecialist(db, 'kid', NOW)).abaSessions as { durationSec: unknown }[];
  }

  it('сессия: endedAt раньше startedAt — durationSec = 0, а не отрицательная', async () => {
    const [s] = await exportedSession({ ...SESSION, endedAt: at(-90_000) });
    expect(s.durationSec).toBe(0);
  });

  it('сессия: endedAt равен startedAt — durationSec = 0', async () => {
    const [s] = await exportedSession({ ...SESSION, endedAt: START });
    expect(s.durationSec).toBe(0);
  });

  it('контроль: нормальная сессия на 10 минут — 600 с', async () => {
    const [s] = await exportedSession(SESSION);
    expect(s.durationSec).toBe(600);
  });

  it('прогон рутины: endedAt раньше startedAt — durationSec = 0', async () => {
    const db = await dbWithConsent();
    await asAbaWriter(db, 'kid', (tx) => appendRoutineRun(tx, 'kid', routineRun('run-neg', { endedAt: at(-60_000, RUN_START) }), NOW));
    const [r] = (await exportForSpecialist(db, 'kid', NOW)).abaRoutineRuns as { durationSec: unknown }[];
    expect(r.durationSec).toBe(0);
  });
});

describe('время записи прогона рутины (appendRoutineRun) и routineExchangedSince', () => {
  const recordedAtOf = async (db: SqlDb) => (await db.all<{ recorded_at: string }>('SELECT recorded_at FROM aba_routine_runs ORDER BY seq')).map((r) => r.recorded_at);
  const write = (db: SqlDb, run: AbaRoutineRun, recordedAt: string) => asAbaWriter(db, 'kid', (tx) => appendRoutineRun(tx, 'kid', run, recordedAt));

  it('время без миллисекунд записывается как .000Z', async () => {
    const db = await dbWithConsent();
    await write(db, routineRun('r1'), '2026-10-11T10:00:00Z');
    expect(await recordedAtOf(db)).toEqual(['2026-10-11T10:00:00.000Z']);
  });

  it('время со смещением пояса приводится к UTC', async () => {
    const db = await dbWithConsent();
    await write(db, routineRun('r1'), '2026-10-11T15:00:00+05:00');
    expect(await recordedAtOf(db)).toEqual(['2026-10-11T10:00:00.000Z']);
  });

  it('commitRoutineRun тоже пишет нормализованное время', async () => {
    const db = await dbWithConsent();
    await commitRoutineRun(db, 'kid', routineResult('r1'), '2026-10-11T10:00:00Z');
    expect(await recordedAtOf(db)).toEqual(['2026-10-11T10:00:00.000Z']);
  });

  it('время, не являющееся датой, не пишется', async () => {
    const db = await dbWithConsent();
    await expect(write(db, routineRun('r1'), 'не дата')).rejects.toThrow();
    expect(await recordedAtOf(db)).toEqual([]);
  });

  it('обмен рутины, записанный в ту же секунду, но до отметки (.000 против .500), «после» не считается', async () => {
    const db = await dbWithConsent();
    await write(db, routineRun('r1', { exchanged: 3 }), '2026-10-11T10:00:00Z');
    expect(await routineExchangedSince(db, 'kid', Date.parse('2026-10-11T10:00:00.500Z'))).toBe(false);
  });

  it('обмен рутины строго после отметки считается', async () => {
    const db = await dbWithConsent();
    await write(db, routineRun('r1', { exchanged: 3 }), '2026-10-11T10:00:01Z');
    expect(await routineExchangedSince(db, 'kid', Date.parse('2026-10-11T10:00:00.500Z'))).toBe(true);
  });

  it('обмен ровно в момент отметки «после» не считается', async () => {
    const db = await dbWithConsent();
    await write(db, routineRun('r1', { exchanged: 3 }), '2026-10-11T10:00:00Z');
    expect(await routineExchangedSince(db, 'kid', Date.parse('2026-10-11T10:00:00.000Z'))).toBe(false);
  });

  it('прогон без обмена (exchanged = 0) не считается, как бы поздно ни был записан', async () => {
    const db = await dbWithConsent();
    await write(db, routineRun('r1', { exchanged: 0 }), '2026-10-11T12:00:00Z');
    expect(await routineExchangedSince(db, 'kid', Date.parse('2026-10-11T10:00:00.000Z'))).toBe(false);
  });

  it('обмен чужого ребёнка не считается', async () => {
    const db = await dbWithConsent();
    await appendConsentEvent(db, grant('sib', '2026-10-11T09:01:00Z'), 'owner');
    await asAbaWriter(db, 'sib', (tx) => appendRoutineRun(tx, 'sib', routineRun('r-sib', { exchanged: 3 }), '2026-10-11T12:00:00Z'));
    expect(await routineExchangedSince(db, 'kid', Date.parse('2026-10-11T10:00:00.000Z'))).toBe(false);
  });
});
