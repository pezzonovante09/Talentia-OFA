/**
 * Возобновление и закрытие свёрнутой сессии ABA в хранилище (фаза 8): `loadAbaResume` по снимку и его `updated_at`,
 * `abandonInProgressSession` / `finishInProgressSession` моментом ухода одной транзакцией, `abaBlockOf` с просрочкой,
 * `closeSession` с повтором после конфликта доски, `classifyAbaWriteError`.
 */
import { CURRENT_CONSENT_TEXTS } from '../../../domain/consentTexts';
import type { ConsentEvent } from '../../../domain/consent';
import { stopSession, type AbaSessionState } from '../../../domain/abaSession';
import { initialTokenTraining } from '../../../domain/abaTokenTraining';
import { answerNext, BASE_MS, beginSession } from '../../../domain/__tests__/abaSessionDriver';
import { AbaBoardConflictError, AbaConsentRequiredError, AbaPausedError, abaLocalDay, sessionsOf } from '../abaLog';
import { classifyAbaWriteError, closeSession, loadAbaResume, MAX_BOARD_CONFLICT_RETRIES } from '../abaResume';
import { abandonInProgressSession, abaBlockOf, abaOverview, DEV_PLACEHOLDER_ART, finishInProgressSession, type AbaOverview } from '../abaStart';
import { loadChildState, saveChildState } from '../childState';
import { saveAbaSessionStep, setAbaPaused } from '../commit';
import { appendConsentEvent } from '../consentLog';
import { revokeAbaProcessing } from '../purge';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const KID = 'kid';
/** «Сейчас» в тестах — 2026-11-06 12:00 по часам устройства: до и после него в тот же локальный день есть по часу. */
const NOW_MS = new Date(2026, 10, 6, 12, 0).getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const MIN = 60_000;
const ART = DEV_PLACEHOLDER_ART;
const opts = (now = NOW_MS) => ({ soundOn: true, now, art: ART });

const consent = (action: 'grant' | 'revoke', at: string): ConsentEvent => ({
  id: `aba-${action}-${KID}-${at}`,
  scope: 'aba_processing',
  action,
  childId: KID,
  textVersion: CURRENT_CONSENT_TEXTS.aba_processing[0],
  confirmedBy: 'pin',
  actorId: 'parent',
  at,
});

/** База с согласием на ABA и обучением доске. */
async function setup(): Promise<SqlDb> {
  const db = await memoryDb();
  await appendConsentEvent(db, consent('grant', iso(NOW_MS - 60 * MIN)), 'owner');
  await asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'tokenTraining', { ...initialTokenTraining(), pairingDone: true, stage: 5 }, iso(NOW_MS - 60 * MIN)));
  return db;
}

/** Сессия драйвера на локальный день `day` (по умолчанию — день `NOW_MS`), после двух проб разогрева. */
function session(day = abaLocalDay(NOW_MS)): AbaSessionState {
  let st = beginSession({ day });
  st = answerNext(st, BASE_MS + 1000).state;
  st = answerNext(st, BASE_MS + 2000).state;
  return st;
}

/** Снимок сессии «ушли в `leftAt`»: `updated_at` снимка — момент ухода. */
async function snapshot(db: SqlDb, leftAt: number, st: AbaSessionState = session()): Promise<AbaSessionState> {
  return saveAbaSessionStep(db, KID, st, iso(leftAt));
}

const atBreak = (st: AbaSessionState, startedAt: number): AbaSessionState =>
  ({ ...st, queue: [{ kind: 'break' }, ...st.queue], breakStartedAt: startedAt }) as AbaSessionState;
const atAccess = (st: AbaSessionState, startedAt: number): AbaSessionState =>
  ({ ...st, queue: [{ kind: 'access', durationMs: 30_000 }, ...st.queue], accessStartedAt: startedAt }) as AbaSessionState;

const bumpBoard = (db: SqlDb, board: { earned: number; nonContingent: number; rev: number }) =>
  asAbaWriter(db, KID, (tx) => saveChildState(tx, KID, 'abaBoard', board, iso(NOW_MS)));
const sessionRows = (db: SqlDb) => db.all<{ id: string; recorded_at: string }>('SELECT id, recorded_at FROM aba_sessions WHERE child_id = ? ORDER BY seq', [KID]);
const inProgress = (db: SqlDb) => loadChildState(db, KID, 'abaSessionInProgress');

// --- 8. loadAbaResume -------------------------------------------------------------------------

describe('loadAbaResume', () => {
  it('без снимка — none', async () => {
    const db = await setup();
    expect(await loadAbaResume(db, KID, opts())).toEqual({ kind: 'none' });
  });

  it('на паузе — blocked paused, даже со снимком', async () => {
    const db = await setup();
    await snapshot(db, NOW_MS - 90_000);
    expect(await setAbaPaused(db, KID, true, iso(NOW_MS))).toBe('saved');
    expect(await loadAbaResume(db, KID, opts())).toEqual({ kind: 'blocked', reason: 'paused' });
  });

  it('без согласия — blocked no_consent', async () => {
    const db = await memoryDb();
    expect(await loadAbaResume(db, KID, opts())).toEqual({ kind: 'blocked', reason: 'no_consent' });
  });

  it('после отзыва согласия — blocked no_consent: снимка больше нет, и согласия тоже', async () => {
    const db = await setup();
    await snapshot(db, NOW_MS - 90_000);
    await revokeAbaProcessing(db, consent('revoke', iso(NOW_MS - 30_000)), 'owner');
    expect(await inProgress(db)).toBeUndefined(); // строки ключа нет вовсе, не «тело null»
    expect(await loadAbaResume(db, KID, opts())).toEqual({ kind: 'blocked', reason: 'no_consent' });
  });

  it('снимок 90 с назад — resume same_trial, awayMs 90 000, leftAt — updated_at, состояние по живой доске', async () => {
    const db = await setup();
    const saved = await snapshot(db, NOW_MS - 90_000);
    const r = await loadAbaResume(db, KID, opts());
    expect(r.kind).toBe('resume');
    if (r.kind !== 'resume') return;
    expect([r.outcome, r.awayMs, r.leftAt]).toEqual(['same_trial', 90_000, NOW_MS - 90_000]);
    expect(r.state.queue).toEqual(saved.queue);
    expect([r.state.rechooseNow, r.state.reinforcerStale]).toEqual([undefined, undefined]);
    expect(r.state.pausedMs).toBe(saved.pausedMs + 90_000);
  });

  it('снимок 5 мин назад — resume rechoose: rechooseNow и reinforcerStale, варианты из трёх', async () => {
    const db = await setup();
    await snapshot(db, NOW_MS - 5 * MIN);
    const r = await loadAbaResume(db, KID, opts());
    expect(r.kind).toBe('resume');
    if (r.kind !== 'resume') return;
    expect([r.outcome, r.awayMs]).toEqual(['rechoose', 5 * MIN]);
    expect([r.state.rechooseNow, r.state.reinforcerStale]).toEqual([true, true]);
    expect(r.state.reinforcerOptions).toHaveLength(3);
  });

  it('снимок 31 мин назад — abandon с leftAt = updated_at, состояние — сырой снимок', async () => {
    const db = await setup();
    const saved = await snapshot(db, NOW_MS - 31 * MIN);
    const r = await loadAbaResume(db, KID, opts());
    expect(r).toEqual({ kind: 'abandon', state: saved, leftAt: NOW_MS - 31 * MIN });
  });

  it('другой локальный день при 5 мин — abandon', async () => {
    const db = await setup();
    const late = new Date(2026, 10, 6, 23, 58).getTime();
    const now = late + 5 * MIN;
    expect(abaLocalDay(late)).not.toBe(abaLocalDay(now)); // предпосылка: полночь между
    await snapshot(db, late, session(abaLocalDay(late)));
    const r = await loadAbaResume(db, KID, opts(now));
    expect(r).toMatchObject({ kind: 'abandon', leftAt: late });
  });

  it('контроль: тот же снимок за 5 мин до полуночи, но now до полуночи — resume', async () => {
    const db = await setup();
    const late = new Date(2026, 10, 6, 23, 50).getTime();
    await snapshot(db, late, session(abaLocalDay(late)));
    expect((await loadAbaResume(db, KID, opts(late + 5 * MIN))).kind).toBe('resume');
  });

  it('updated_at в будущем (часы сдвинуты) — leftAt не позже now, awayMs 0, resume same_trial', async () => {
    const db = await setup();
    await snapshot(db, NOW_MS + 10 * MIN);
    const r = await loadAbaResume(db, KID, opts());
    expect(r).toMatchObject({ kind: 'resume', outcome: 'same_trial', awayMs: 0, leftAt: NOW_MS });
  });

  it('updated_at не разбирается — момент ухода неизвестен: «ушли только что», занятие не закрывается', async () => {
    const db = await setup();
    await snapshot(db, NOW_MS - 90_000);
    await asAbaWriter(db, KID, async (tx) => void (await tx.run("UPDATE child_state SET updated_at = ? WHERE child_id = ? AND key = 'abaSessionInProgress'", ['не дата', KID])));
    const r = await loadAbaResume(db, KID, opts());
    expect(r).toMatchObject({ kind: 'resume', outcome: 'same_trial', awayMs: 0, leftAt: NOW_MS });
  });

  it('согласие на прежний текст — blocked outdated, даже со снимком: снимок на месте, продолжения нет', async () => {
    const db = await setup();
    await snapshot(db, NOW_MS - 90_000);
    await appendConsentEvent(db, { ...consent('grant', iso(NOW_MS - MIN)), textVersion: 'ru-old' }, 'owner');
    expect(await loadAbaResume(db, KID, opts())).toEqual({ kind: 'blocked', reason: 'outdated' });
    expect(await inProgress(db)).toBeTruthy();
  });
});

// --- 9. abandonInProgressSession / finishInProgressSession ---------------------------------------

describe('abandonInProgressSession', () => {
  const LEFT = NOW_MS - 40 * MIN;

  it('пишет итог моментом ухода: endedAt = at, recorded_at = now, причина, снимок снят, номер сессии +1', async () => {
    const db = await setup();
    const saved = await snapshot(db, LEFT);
    expect(await abandonInProgressSession(db, KID, { reason: 'app_backgrounded', at: LEFT, now: NOW_MS, art: ART })).toBe(true);
    const [s] = await sessionsOf(db, KID);
    expect([s.id, s.endedAt, s.endReason]).toEqual([saved.sessionId, iso(LEFT), 'app_backgrounded']);
    expect((await sessionRows(db)).map((r) => r.recorded_at)).toEqual([iso(NOW_MS)]);
    expect(await inProgress(db)).toBeNull();
    expect(await loadChildState(db, KID, 'abaSessionIndex')).toBe(saved.sessionIndex + 1);
  });

  it('adult_stopped — та же запись с этой причиной', async () => {
    const db = await setup();
    await snapshot(db, LEFT);
    await abandonInProgressSession(db, KID, { reason: 'adult_stopped', at: LEFT, now: NOW_MS, art: ART });
    expect((await sessionsOf(db, KID))[0]).toMatchObject({ endReason: 'adult_stopped', endedAt: iso(LEFT) });
  });

  it('открытый перерыв в снимке закрывается моментом ухода', async () => {
    const db = await setup();
    const breakAt = LEFT - 20_000;
    await snapshot(db, LEFT, atBreak(session(), breakAt));
    await abandonInProgressSession(db, KID, { reason: 'app_backgrounded', at: LEFT, now: NOW_MS, art: ART });
    const [s] = await sessionsOf(db, KID);
    expect(s.events.filter((e) => e.kind === 'break')).toEqual([{ kind: 'break', startedAt: iso(breakAt), endedAt: iso(LEFT), initiatedBy: 'schedule' }]);
  });

  it('открытый доступ в снимке закрывается моментом ухода', async () => {
    const db = await setup();
    const accessAt = LEFT - 15_000;
    await snapshot(db, LEFT, atAccess(session(), accessAt));
    await abandonInProgressSession(db, KID, { reason: 'app_backgrounded', at: LEFT, now: NOW_MS, art: ART });
    const [s] = await sessionsOf(db, KID);
    expect(s.events.filter((e) => e.kind === 'access')).toEqual([{ kind: 'access', startedAt: iso(accessAt), endedAt: iso(LEFT) }]);
  });

  it('at раньше updated_at снимка — endedAt = updated_at: конец не раньше последней записи', async () => {
    const db = await setup();
    await snapshot(db, LEFT);
    await abandonInProgressSession(db, KID, { reason: 'app_backgrounded', at: LEFT - 10 * MIN, now: NOW_MS, art: ART });
    expect((await sessionsOf(db, KID))[0].endedAt).toBe(iso(LEFT));
  });

  it('версия доски изменена рутиной — закрывается без ошибки по живой доске', async () => {
    const db = await setup();
    const saved = await snapshot(db, LEFT);
    await bumpBoard(db, { earned: 2, nonContingent: 0, rev: saved.boardRev + 1 });
    await expect(abandonInProgressSession(db, KID, { reason: 'app_backgrounded', at: LEFT, now: NOW_MS, art: ART })).resolves.toBe(true);
    expect(await sessionsOf(db, KID)).toHaveLength(1);
    expect(await inProgress(db)).toBeNull();
    // жетоны живой доски не сгорают: обмена в конце при app_backgrounded нет
    expect(await loadChildState(db, KID, 'abaBoard')).toEqual({ earned: 2, nonContingent: 0, rev: saved.boardRev + 1 });
  });

  it('без снимка — false, записи нет', async () => {
    const db = await setup();
    expect(await abandonInProgressSession(db, KID, { reason: 'app_backgrounded', at: LEFT, now: NOW_MS, art: ART })).toBe(false);
    expect(await sessionsOf(db, KID)).toEqual([]);
  });

  it('повторный вызов — false, вторая строка не появляется', async () => {
    const db = await setup();
    await snapshot(db, LEFT);
    expect(await abandonInProgressSession(db, KID, { reason: 'app_backgrounded', at: LEFT, now: NOW_MS, art: ART })).toBe(true);
    expect(await abandonInProgressSession(db, KID, { reason: 'app_backgrounded', at: LEFT, now: NOW_MS + MIN, art: ART })).toBe(false);
    expect(await sessionsOf(db, KID)).toHaveLength(1);
  });

  it('finishInProgressSession — adult_stopped моментом updated_at снимка, recorded_at — now', async () => {
    const db = await setup();
    await snapshot(db, LEFT);
    expect(await finishInProgressSession(db, KID, NOW_MS)).toBe(true);
    expect((await sessionsOf(db, KID))[0]).toMatchObject({ endReason: 'adult_stopped', endedAt: iso(LEFT) });
    expect((await sessionRows(db))[0].recorded_at).toBe(iso(NOW_MS));
    expect(await finishInProgressSession(db, KID, NOW_MS + MIN)).toBe(false);
  });
});

// --- 10. abaBlockOf с просрочкой ---------------------------------------------------------------

describe('abaBlockOf(o, now)', () => {
  const base: AbaOverview = {
    consent: 'granted',
    paused: false,
    inProgress: null,
    inProgressLeftAt: null,
    pairingDone: true,
    trainedObserverId: null,
    readyTargets: 3,
    aloneAvailable: true,
    suggestAdult: false,
  };
  const withSnapshot = (leftAt: number | null, day = abaLocalDay(NOW_MS)): AbaOverview => ({
    ...base,
    inProgress: { ...session(day) },
    inProgressLeftAt: leftAt === null ? null : iso(leftAt),
  });

  it('просроченный снимок (31 мин) с now — in_progress_stale', () => {
    expect(abaBlockOf(withSnapshot(NOW_MS - 31 * MIN), NOW_MS)).toBe('in_progress_stale');
  });

  it('снимок другого локального дня с now — in_progress_stale', () => {
    const late = new Date(2026, 10, 5, 23, 58).getTime();
    expect(abaBlockOf(withSnapshot(late, abaLocalDay(late)), NOW_MS)).toBe('in_progress_stale');
  });

  it('свежий снимок (5 мин) с now — in_progress', () => {
    expect(abaBlockOf(withSnapshot(NOW_MS - 5 * MIN), NOW_MS)).toBe('in_progress');
  });

  it('без now — in_progress и для просроченного', () => {
    expect(abaBlockOf(withSnapshot(NOW_MS - 31 * MIN))).toBe('in_progress');
  });

  it('inProgressLeftAt null — не stale', () => {
    expect(abaBlockOf(withSnapshot(null), NOW_MS)).toBe('in_progress');
  });

  it('пауза раньше обоих', () => {
    expect(abaBlockOf({ ...withSnapshot(NOW_MS - 31 * MIN), paused: true }, NOW_MS)).toBe('paused');
    expect(abaBlockOf({ ...withSnapshot(NOW_MS - 5 * MIN), paused: true }, NOW_MS)).toBe('paused');
  });

  it('согласие раньше паузы и снимка', () => {
    expect(abaBlockOf({ ...withSnapshot(NOW_MS - 31 * MIN), paused: true, consent: 'outdated' }, NOW_MS)).toBe('outdated');
    expect(abaBlockOf({ ...withSnapshot(NOW_MS - 31 * MIN), consent: 'revoked' }, NOW_MS)).toBe('no_consent');
  });

  it('без снимка — прежние причины', () => {
    expect(abaBlockOf(base, NOW_MS)).toBeNull();
    expect(abaBlockOf({ ...base, readyTargets: 0 }, NOW_MS)).toBe('no_ready_targets');
  });

  it('abaOverview отдаёт inProgressLeftAt = updated_at снимка и null без снимка', async () => {
    const db = await setup();
    expect((await abaOverview(db, KID, ART)).inProgressLeftAt).toBeNull();
    await snapshot(db, NOW_MS - 31 * MIN);
    const ov = await abaOverview(db, KID, ART);
    expect(ov.inProgressLeftAt).toBe(iso(NOW_MS - 31 * MIN));
    expect(abaBlockOf(ov, NOW_MS)).toBe('in_progress_stale');
  });
});

// --- 11. closeSession ---------------------------------------------------------------------------

describe('closeSession', () => {
  const ENDED = NOW_MS - 10_000;

  async function stoppedSnapshot(db: SqlDb) {
    const saved = await snapshot(db, ENDED - 5000);
    return { saved, stopped: stopSession(saved, 'adult_stopped', ENDED) };
  }

  it('ok: итог записан моментом endedAt, recorded_at — now, снимок снят', async () => {
    const db = await setup();
    const { saved, stopped } = await stoppedSnapshot(db);
    const out = await closeSession(db, KID, stopped, { endedAt: ENDED, now: NOW_MS });
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') return;
    expect([out.result.session.id, out.result.session.endedAt, out.result.session.endReason]).toEqual([saved.sessionId, iso(ENDED), 'adult_stopped']);
    expect(await sessionRows(db)).toEqual([{ id: saved.sessionId, recorded_at: iso(NOW_MS) }]);
    expect(await inProgress(db)).toBeNull();
  });

  it('конфликт доски (rev +1) — ok со второй попытки, итог по живой доске', async () => {
    const db = await setup();
    const { saved, stopped } = await stoppedSnapshot(db);
    await bumpBoard(db, { earned: 2, nonContingent: 0, rev: saved.boardRev + 1 });
    const out = await closeSession(db, KID, stopped, { endedAt: ENDED, now: NOW_MS });
    expect(out.kind).toBe('ok');
    if (out.kind !== 'ok') return;
    expect([out.result.board.earned, out.result.boardRev]).toEqual([2, saved.boardRev + 1]);
    expect(await loadChildState(db, KID, 'abaBoard')).toEqual({ earned: 2, nonContingent: 0, rev: saved.boardRev + 1 });
    expect(await sessionsOf(db, KID)).toHaveLength(1);
  });

  it('пауза — blocked, снимок на месте, записи нет', async () => {
    const db = await setup();
    const { saved, stopped } = await stoppedSnapshot(db);
    await setAbaPaused(db, KID, true, iso(NOW_MS));
    expect(await closeSession(db, KID, stopped, { endedAt: ENDED, now: NOW_MS })).toEqual({ kind: 'blocked' });
    expect(await inProgress(db)).toEqual(saved);
    expect(await sessionsOf(db, KID)).toEqual([]);
  });

  it('maxConflicts 0 и конфликт — failed с AbaBoardConflictError, снимок на месте', async () => {
    const db = await setup();
    const { saved, stopped } = await stoppedSnapshot(db);
    await bumpBoard(db, { earned: 2, nonContingent: 0, rev: saved.boardRev + 1 });
    const out = await closeSession(db, KID, stopped, { endedAt: ENDED, now: NOW_MS, maxConflicts: 0 });
    expect(out.kind).toBe('failed');
    if (out.kind !== 'failed') return;
    expect(out.error).toBeInstanceOf(AbaBoardConflictError);
    expect(await inProgress(db)).toEqual(saved);
    expect(await sessionsOf(db, KID)).toEqual([]);
  });

  it('сессия ещё идёт (endReason null) — failed с ошибкой домена, ничего не записано', async () => {
    const db = await setup();
    const saved = await snapshot(db, ENDED - 5000);
    const out = await closeSession(db, KID, saved, { endedAt: ENDED, now: NOW_MS });
    expect(out.kind).toBe('failed');
    expect(await sessionsOf(db, KID)).toEqual([]);
    expect(await inProgress(db)).toEqual(saved);
  });

  it('повторов после конфликта по умолчанию — MAX_BOARD_CONFLICT_RETRIES = 2', () => {
    expect(MAX_BOARD_CONFLICT_RETRIES).toBe(2);
  });
});

// --- 12. classifyAbaWriteError ------------------------------------------------------------------

describe('classifyAbaWriteError', () => {
  it('конфликт доски — conflict', () => {
    expect(classifyAbaWriteError(new AbaBoardConflictError(0, 1))).toBe('conflict');
  });

  it('пауза и отзыв согласия — blocked', () => {
    expect(classifyAbaWriteError(new AbaPausedError(KID))).toBe('blocked');
    expect(classifyAbaWriteError(new AbaConsentRequiredError(KID))).toBe('blocked');
  });

  it('прочее — other: обычная ошибка, строка, undefined', () => {
    expect(classifyAbaWriteError(new Error('x'))).toBe('other');
    expect(classifyAbaWriteError('x')).toBe('other');
    expect(classifyAbaWriteError(undefined)).toBe('other');
  });
});
