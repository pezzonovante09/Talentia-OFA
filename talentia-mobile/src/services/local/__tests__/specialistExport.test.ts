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
import type { PairingResult } from '../../../domain/abaPairing';
import { initialTokenTraining, type TokenTrainingState } from '../../../domain/abaTokenTraining';
import type { ConsentEvent } from '../../../domain/consent';
import { abaIdGuard, appendReinforcerChoice, appendRoutineRun, appendTrialCorrection, routineExchangedSince } from '../abaLog';
import { saveChildState } from '../childState';
import { commitAbaSession, commitIoa, commitPairingSession, commitRoutineRun, recordAbaTrial, recordRoutineStep, setAbaObservers } from '../commit';
import { appendConsentEvent } from '../consentLog';
import { exportChild, exportForSpecialist } from '../purge';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';
import { resultTail } from './routineResultTail';

const NOW = '2026-10-11T10:00:00Z';
const OBSERVER = 'obs-uuid-7';
const POOL = ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'];
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
  phase: null,
  primaryObserverId: OBSERVER,
  ...over,
});
const rState = { targetId: 'R', phase: 'acquisition', lastRoutineRunDay: '2026-10-11' } as AbaTargetState;
const routineResult = (id: string, record: Partial<AbaRoutineRun> = {}): RoutineRunResult => {
  const { token: _t, exchangeOffer: _o, ...base } = routineRun(id, record);
  return { trials: [], state: rState, before: { targetId: 'R', phase: 'acquisition' } as AbaTargetState, claim: { token: 'at_start_level', tokens: 1, nonContingent: false }, record: base, band: '7', reinforcerPool: POOL, seed: 7, ...resultTail(base) };
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

// --- сессия сопряжения (№164) ------------------------------------------------------------------

const PAIRING_START = Date.parse('2026-10-11T06:10:00.000Z');
const PAIRING_ID = '5a4b3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d';
const pairingResult: PairingResult = {
  sessionId: PAIRING_ID,
  config: 'with_adult',
  endReason: 'completed',
  cycles: 4,
  startedAt: PAIRING_START,
  endedAt: PAIRING_START + 245_000,
  chosenBy: 'child',
  choices: ['puzzle', 'bubbles', 'drum', 'puzzle'].map((reinforcerId, i) => ({ reinforcerId, by: 'child' as const, at: PAIRING_START + i * 61_000 + 7_000 })),
};

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
    // сопряжение (№164): запись и выборы с точным временем — под те же сквозные проверки
    await commitPairingSession(db, 'kid', pairingResult, NOW, { primaryObserverId: OBSERVER });
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
    expect([out.abaTrials.length, out.abaSessions.length, out.abaIoa.length, out.abaRoutineRuns.length, out.abaPairingSessions.length]).toEqual([3, 1, 1, 1, 1]);
    expect((out.abaReinforcerChoices as { source: string }[]).filter((c) => c.source === 'pairing')).toHaveLength(4);
    expect(out.exportedAt).toBe('2026-10-12T13:37:00.000Z');
    expect(Object.keys(out.state)).toEqual(expect.arrayContaining(['abaTargets', 'physicalPromptAllowed']));
  });

  it('в пробах и сессиях нет абсолютных миллисекунд эпохи', async () => {
    const out = await exportForSpecialist(await richDb(), 'kid', NOW);
    expect(
      numbers([out.abaTrials, out.abaSessions, out.abaRoutineRuns, out.abaPairingSessions, out.abaReinforcerChoices]).filter((n) => Math.abs(n) > 1e11),
    ).toEqual([]);
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

  // обмен рутины — это выбор подкрепителя (`source = 'routine'`, время выбора), а не запись прогона
  const choose = (db: SqlDb, kid: string, runId: string, at: string, source: 'routine' | 'session' = 'routine') =>
    asAbaWriter(db, kid, (tx) => appendReinforcerChoice(tx, kid, { source, sourceId: runId, reinforcerId: 'drum', chosenBy: 'child' }, at));

  it('выбор рутины в ту же секунду, но до отметки (.000 против .500), «после» не считается', async () => {
    const db = await dbWithConsent();
    await choose(db, 'kid', 'r1', '2026-10-11T10:00:00Z');
    expect(await routineExchangedSince(db, 'kid', Date.parse('2026-10-11T10:00:00.500Z'))).toBe(false);
  });

  it('выбор рутины строго после отметки считается', async () => {
    const db = await dbWithConsent();
    await choose(db, 'kid', 'r1', '2026-10-11T10:00:01Z');
    expect(await routineExchangedSince(db, 'kid', Date.parse('2026-10-11T10:00:00.500Z'))).toBe(true);
  });

  it('выбор ровно в момент отметки «после» не считается', async () => {
    const db = await dbWithConsent();
    await choose(db, 'kid', 'r1', '2026-10-11T10:00:00Z');
    expect(await routineExchangedSince(db, 'kid', Date.parse('2026-10-11T10:00:00.000Z'))).toBe(false);
  });

  it('прогон с предложением, но без выбора, не считается, как бы поздно ни был записан', async () => {
    const db = await dbWithConsent();
    await write(db, routineRun('r1', { exchangeOffer: { tokens: 5, boardSize: 5, options: ['a', 'b', 'c'] } }), '2026-10-11T12:00:00Z');
    expect(await routineExchangedSince(db, 'kid', Date.parse('2026-10-11T10:00:00.000Z'))).toBe(false);
  });

  it('выбор сессии (source = session) обменом рутины не считается', async () => {
    const db = await dbWithConsent();
    await choose(db, 'kid', 's-1', '2026-10-11T12:00:00Z', 'session');
    expect(await routineExchangedSince(db, 'kid', Date.parse('2026-10-11T10:00:00.000Z'))).toBe(false);
  });

  it('выбор рутины чужого ребёнка не считается', async () => {
    const db = await dbWithConsent();
    await appendConsentEvent(db, grant('sib', '2026-10-11T09:01:00Z'), 'owner');
    await choose(db, 'sib', 'r-sib', '2026-10-11T12:00:00Z');
    expect(await routineExchangedSince(db, 'kid', Date.parse('2026-10-11T10:00:00.000Z'))).toBe(false);
  });
});

// --- идентификаторы, из которых читается время (раунд 3, В11) ----------------------------------

describe('экспорт специалисту: идентификаторы со временем заменены метками', () => {
  // подстраховка для данных, записанных до гарда записи: здесь id со временем пишутся нарочно
  beforeAll(() => {
    abaIdGuard.enabled = false;
  });
  afterAll(() => {
    abaIdGuard.enabled = true;
  });
  const V7_SESSION = '018f3b5e-7c2a-7d3e-9a1b-2c4d5e6f7a8b';
  const V7_TRIAL = '018f3b5e-7c2b-7d3e-9a1b-2c4d5e6f7a8c';
  const ULID_RUN = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  const V4_SESSION = '3b241101-e2bb-4255-8caf-4136c566a962';
  const EPOCH_ID = '1760000000000';
  const UUID_V7 = /[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  async function dbWithV7() {
    const db = await dbWithConsent();
    await setAbaObservers(db, 'kid', [{ id: OBSERVER, role: 'parent', trained: false }], NOW);
    await recordAbaTrial(db, 'kid', { ...baseTrial, id: V7_TRIAL, sessionId: V7_SESSION }, snapOf(V7_SESSION), NOW);
    await recordAbaTrial(db, 'kid', { ...baseTrial, id: 'tr-8', sessionId: V7_SESSION, index: 1 }, snapOf(V7_SESSION), NOW);
    await commitAbaSession(db, 'kid', sessionResult({ ...SESSION, id: V7_SESSION }), NOW);
    return db;
  }

  it('исходного id сессии и пробы в выгрузке нет, шаблона UUIDv7 тоже', async () => {
    const out = await exportForSpecialist(await dbWithV7(), 'kid', NOW);
    const json = JSON.stringify(out);
    expect(json).not.toContain(V7_SESSION);
    expect(json).not.toContain(V7_TRIAL);
    expect(json).not.toMatch(UUID_V7);
  });

  it('id сессии и sessionId её проб заменены одной и той же меткой (связь не порвана)', async () => {
    const out = await exportForSpecialist(await dbWithV7(), 'kid', NOW);
    const session = out.abaSessions[0] as { id: string };
    const trials = out.abaTrials as { id: string; sessionId: string }[];
    expect(session.id).toMatch(/^A\d+$/);
    expect(trials.map((t) => t.sessionId)).toEqual([session.id, session.id]);
  });

  it('разные id получают разные метки, обычный id пробы остаётся', async () => {
    const out = await exportForSpecialist(await dbWithV7(), 'kid', NOW);
    const session = out.abaSessions[0] as { id: string };
    const [leaky, plain] = out.abaTrials as { id: string }[];
    expect(leaky.id).toMatch(/^A\d+$/);
    expect(leaky.id).not.toBe(session.id);
    expect(plain.id).toBe('tr-8');
  });

  it('остальные поля сессии и пробы те же, что без замены', async () => {
    const withV7 = await exportForSpecialist(await dbWithV7(), 'kid', NOW);
    const plainDb = await dbWithConsent();
    await setAbaObservers(plainDb, 'kid', [{ id: OBSERVER, role: 'parent', trained: false }], NOW);
    await recordAbaTrial(plainDb, 'kid', { ...baseTrial, id: 'tr-7', sessionId: 's-7' }, snapOf('s-7'), NOW);
    await recordAbaTrial(plainDb, 'kid', { ...baseTrial, id: 'tr-8', sessionId: 's-7', index: 1 }, snapOf('s-7'), NOW);
    await commitAbaSession(plainDb, 'kid', sessionResult(SESSION), NOW);
    const plain = await exportForSpecialist(plainDb, 'kid', NOW);
    const strip = (rows: unknown[]) => rows.map((r) => ({ ...(r as object), id: undefined, sessionId: undefined }));
    expect(strip(withV7.abaSessions)).toEqual(strip(plain.abaSessions));
    expect(strip(withV7.abaTrials)).toEqual(strip(plain.abaTrials));
  });

  it('ULID прогона рутины и sessionId его проб — одна метка, шаблона ULID в выгрузке нет', async () => {
    const db = await dbWithConsent();
    await asAbaWriter(db, 'kid', (tx) => appendRoutineRun(tx, 'kid', routineRun(ULID_RUN), NOW));
    await recordRoutineStep(db, 'kid', stepTrial('tr-r', { sessionId: ULID_RUN }), { ...inProgress, runId: ULID_RUN } as RoutineRunState, NOW);
    const out = await exportForSpecialist(db, 'kid', NOW);
    expect(JSON.stringify(out)).not.toContain(ULID_RUN);
    const run = out.abaRoutineRuns[0] as { id: string };
    const trial = out.abaTrials[0] as { sessionId: string };
    expect(run.id).toMatch(/^A\d+$/);
    expect(trial.sessionId).toBe(run.id);
  });

  it('id из метки времени (epoch) заменяется', async () => {
    const db = await dbWithConsent();
    await asAbaWriter(db, 'kid', (tx) => appendRoutineRun(tx, 'kid', routineRun(EPOCH_ID), NOW));
    const out = await exportForSpecialist(db, 'kid', NOW);
    expect(JSON.stringify(out)).not.toContain(EPOCH_ID);
    expect((out.abaRoutineRuns[0] as { id: string }).id).toMatch(/^A\d+$/);
  });

  it('UUIDv4 и обычные id (tr-7) не меняются', async () => {
    const db = await dbWithConsent();
    await recordAbaTrial(db, 'kid', { ...baseTrial, id: 'tr-7', sessionId: V4_SESSION }, snapOf(V4_SESSION), NOW);
    await commitAbaSession(db, 'kid', sessionResult({ ...SESSION, id: V4_SESSION }), NOW);
    const out = await exportForSpecialist(db, 'kid', NOW);
    expect((out.abaSessions[0] as { id: string }).id).toBe(V4_SESSION);
    expect(out.abaTrials[0]).toMatchObject({ id: 'tr-7', sessionId: V4_SESSION });
  });

  it('метки A не пересекаются с метками наблюдателей O', async () => {
    const out = await exportForSpecialist(await dbWithV7(), 'kid', NOW);
    const session = out.abaSessions[0] as { id: string; primaryObserverId: string };
    expect(session.primaryObserverId).toMatch(/^O\d+$/);
    expect(session.id).toMatch(/^A\d+$/);
  });

  it('IOA с sessionId того же id получает ту же метку, что и сессия', async () => {
    const db = await dbWithV7();
    await commitIoa(
      db,
      'kid',
      { id: 'ioa-1', sessionId: V7_SESSION, secondaryObserverId: 'obs-2', source: 'paper_entry', enteredAt: '2026-10-12T21:45:30.000Z', items: [], byTarget: {} },
      {},
      NOW,
    );
    const out = await exportForSpecialist(db, 'kid', NOW);
    expect((out.abaIoa[0] as { sessionId: string }).sessionId).toBe((out.abaSessions[0] as { id: string }).id);
    expect(JSON.stringify(out)).not.toContain(V7_SESSION);
  });

  it('исправление: trialId той же пробы получает ту же метку, что и сама проба', async () => {
    const db = await dbWithV7();
    await asAbaWriter(db, 'kid', (tx) =>
      appendTrialCorrection(tx, 'kid', { trialId: V7_TRIAL, replacementId: 'tr-r1', sessionId: V7_SESSION, msSinceOriginal: 2000, fromResponse: 'independent', toResponse: 'incorrect', tokenKept: 0, tokenAdded: 0 }, NOW),
    );
    const out = await exportForSpecialist(db, 'kid', NOW);
    const correction = out.abaTrialCorrections[0] as { trialId: string; sessionId: string };
    expect(correction.trialId).toBe((out.abaTrials[0] as { id: string }).id);
    expect(correction.sessionId).toBe((out.abaSessions[0] as { id: string }).id);
    expect(JSON.stringify(out.abaTrialCorrections)).not.toMatch(UUID_V7);
  });

  it('проба, поставленная в очередь заново (requeuedFromTrialId), ссылается на ту же метку', async () => {
    const db = await dbWithV7();
    await recordAbaTrial(
      db,
      'kid',
      { ...baseTrial, id: 'tr-9', sessionId: V7_SESSION, index: 2, requeuedFromTrialId: V7_TRIAL } as AbaTrial,
      snapOf(V7_SESSION),
      NOW,
    );
    const out = await exportForSpecialist(db, 'kid', NOW);
    const trials = out.abaTrials as { id: string; requeuedFromTrialId?: string }[];
    expect(trials[2].requeuedFromTrialId).toBe(trials[0].id);
    expect(JSON.stringify(out)).not.toContain(V7_TRIAL);
  });

  it('экспорт родителю не меняется: id как есть', async () => {
    const out = await exportChild(await dbWithV7(), 'kid', NOW, {});
    expect((out.abaSessions[0] as { id: string }).id).toBe(V7_SESSION);
    expect(JSON.stringify(out.abaTrials)).toContain(V7_TRIAL);
  });
});
