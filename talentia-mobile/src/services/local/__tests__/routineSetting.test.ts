/**
 * Фиксация рутины в две транзакции (раунд 4, Д2; методист 2026-10-19) и исправление звена (В7):
 * Т1 `commitRoutineRun` — сразу после последнего звена: запись, жетон, доска, обмен, просьбы о
 * перерыве на карточку, форма места открыта; Т2 `commitRoutineSetting` — пересчёт с местом от
 * состояния до прогона, тот же `runNo`, поправка в журнал, доска не меняется; брошенная форма —
 * «как обычно»; `commitRoutineCorrection` — в ходе прогона и после Т1. Настоящие прогоны домена,
 * а не их пересказ руками.
 */
import { CURRENT_CONSENT_TEXTS } from '../../../domain/consentTexts';
import type { AbaTargetState } from '../../../types/aba';
import { finishRoutineRun, interruptRoutineRun, resumeRoutineRun, type RoutineRunResult, type RoutineRunState } from '../../../domain/abaRoutineRun';
import { beginRoutineUndo, undoRoutineStep } from '../../../domain/abaUndo';
import type { ConsentEvent } from '../../../domain/consent';
import { racq, rday, ROUTINE_TRAINED, rplay, rstart, rstep, type RHow } from '../../../domain/__tests__/abaRoutineDriver';
import { RoutineRunClosedError, RoutineStateConflictError, routineHistoryOf, routineRunsOf, trialsOfTarget } from '../abaLog';
import { loadChildState, saveChildState } from '../childState';
import {
  closeRoutineSettingForm,
  commitRoutineCorrection,
  commitRoutineRun,
  commitRoutineSetting,
  recordRoutineStep as storeRoutineStep,
} from '../commit';
import { appendConsentEvent } from '../consentLog';
import { exportChild, exportForSpecialist } from '../purge';
import type { SqlDb } from '../sql';
import { asAbaWriter, memoryDb } from './nodeSql';

const NOW = '2026-10-01T07:00:00Z';
const iso = (ms: number) => new Date(ms).toISOString();

const grant: ConsentEvent = {
  id: 'aba-grant-kid',
  scope: 'aba_processing',
  action: 'grant',
  childId: 'kid',
  textVersion: CURRENT_CONSENT_TEXTS.aba_processing[0],
  confirmedBy: 'biometric',
  actorId: 'parent',
  at: NOW,
};

async function setup(board = { earned: 0, nonContingent: 0 }): Promise<SqlDb> {
  const db = await memoryDb();
  await appendConsentEvent(db, grant, 'owner');
  await asAbaWriter(db, 'kid', async (tx) => {
    await saveChildState(tx, 'kid', 'tokenTraining', ROUTINE_TRAINED, NOW);
    await saveChildState(tx, 'kid', 'abaBoard', board, NOW);
  });
  return db;
}

/**
 * Прогон через хранилище так, как его ведёт экран: каждое звено — в журнал со снимком, затем итог
 * (история — из журнала) и Т1 в момент последнего звена.
 */
async function runT1(db: SqlDb, state: AbaTargetState | undefined, d: string, hows: RHow[] = ['ok', 'ok', 'ok']) {
  let run = rstart(state, d);
  for (const how of hows) {
    const s = rstep(run, how);
    run = how === 'ok' ? s.run : s.run.pause ? resumeRoutineRun(s.run) : s.run;
    await storeRoutineStep(db, 'kid', s.trial, run, iso(s.at));
  }
  const result = finishRoutineRun(run, 7, await routineHistoryOf(db, 'kid', 'R'));
  const out = await commitRoutineRun(db, 'kid', result, iso(run.endedAt!));
  return { run, result, out };
}

/** Четыре прогона целиком сами в привычном месте, формы брошены: пятый даст «почти» (needs_transfer). */
async function fourUsual(db: SqlDb): Promise<AbaTargetState> {
  let s: AbaTargetState = racq();
  for (let i = 1; i <= 4; i += 1) {
    s = (await runT1(db, s, rday(i))).result.state;
    await closeRoutineSettingForm(db, 'kid', NOW);
  }
  return s;
}

const targetR = async (db: SqlDb) => (await loadChildState(db, 'kid', 'abaTargets'))?.R;
const amendments = (db: SqlDb) => db.all<{ run_id: string; body: string }>('SELECT run_id, body FROM aba_routine_run_amendments ORDER BY seq');

describe('Т1: итог сразу после последнего звена', () => {
  it('жетон, доска и обмен — в Т1; снимок «в работе» снят; форма места открыта с состоянием Т1', async () => {
    const db = await setup({ earned: 4, nonContingent: 0 });
    const { result, out } = await runT1(db, racq(), rday(1));
    expect(out.token).toBe('at_start_level');
    expect(out.board.earned).toBe(5);
    expect(out.offer?.tokens).toBe(5);
    expect(await loadChildState(db, 'kid', 'abaBoard')).toMatchObject({ earned: 5 });
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toBeNull();
    const open = await loadChildState(db, 'kid', 'abaRoutineSettingOpen');
    expect(open).toEqual({ run: result.run, t1State: result.state, sessionIndex: 7, history: result.history });
    expect(await targetR(db)).toEqual(result.state);
    const [rec] = await routineRunsOf(db, 'kid', 'R');
    expect([rec.setting, rec.token, rec.runNo]).toEqual(['usual', 'at_start_level', 1]);
  });

  it('длительность специалисту — от старта до последнего звена: время до Т2 в неё не входит', async () => {
    const db = await setup();
    const { run } = await runT1(db, racq(), rday(1));
    await commitRoutineSetting(db, 'kid', run.runId, 'other_adult', rday(1), iso(run.endedAt! + 10 * 60_000));
    const [spec] = (await exportForSpecialist(db, 'kid', NOW)).abaRoutineRuns as { durationSec: number; setting: string }[];
    expect(spec.durationSec).toBe(180);
    expect(spec.setting).toBe('other_adult');
  });

  it('внешний обрыв: формы места нет', async () => {
    const db = await setup();
    const one = rstep(rstart(racq(), rday(1))).run;
    const cut = interruptRoutineRun(one, 'external', one.startedAt + 120_000);
    await commitRoutineRun(db, 'kid', finishRoutineRun(cut, 7, { runs: [] }), NOW);
    expect(await loadChildState(db, 'kid', 'abaRoutineSettingOpen')).toBeNull();
  });

  it('просьба о перерыве в звене — на карточку ребёнка (routineRequests, принятие in_trial), не в срывы рутины', async () => {
    const db = await setup();
    const { result } = await runT1(db, racq(), rday(1), ['break', 'ok', 'ok', 'ok']);
    expect(result.breakRequests).toEqual({ requests: 1, ended: false });
    const card = await loadChildState(db, 'kid', 'breakCard');
    expect(card?.routineRequests).toEqual([{ runId: 'run-2026x10x01', day: rday(1), requests: 1, ended: false }]);
    expect([card?.acquired, card?.acquiredVia]).toEqual([true, 'in_trial']);
    expect((await targetR(db))?.routineBreakdowns).toBeUndefined();
  });

  it('прогон без просьб карточку не создаёт', async () => {
    const db = await setup();
    await runT1(db, racq(), rday(1));
    expect(await loadChildState(db, 'kid', 'breakCard')).toBeUndefined();
  });
});

describe('Т2: место «где и с кем» после записи', () => {
  it('other_place: окно и перенос пересчитаны (почти → освоено), runNo тот же, доска не тронута, поправка в журнале и в routineRunsOf', async () => {
    const db = await setup();
    const s4 = await fourUsual(db);
    const { run, result } = await runT1(db, s4, rday(5));
    expect([result.state.phase, result.state.flags.includes('needs_transfer')]).toEqual(['acquisition', true]);
    const boardBefore = await loadChildState(db, 'kid', 'abaBoard');

    await commitRoutineSetting(db, 'kid', run.runId, 'other_place', rday(5), '2026-10-05T08:10:00Z');

    const after = await targetR(db);
    expect([after?.phase, after?.flags.includes('needs_transfer'), after?.routineRunSeq]).toEqual(['mastered', false, 5]);
    expect(await loadChildState(db, 'kid', 'abaBoard')).toEqual(boardBefore);
    const runs = await routineRunsOf(db, 'kid', 'R');
    expect(runs).toHaveLength(5);
    expect(runs[4]).toMatchObject({ id: run.runId, runNo: 5, setting: 'other_place', phase: { from: 'acquisition', to: 'mastered' }, token: 'at_start_level' });
    expect((await amendments(db)).map((a) => [a.run_id, JSON.parse(a.body).reason])).toEqual([[run.runId, 'setting']]);
    expect(await loadChildState(db, 'kid', 'abaRoutineSettingOpen')).toBeNull();
    // родительский экспорт отдаёт и сам прогон, и поправку
    expect((await exportChild(db, 'kid', NOW, {})).abaRoutineRunAmendments).toHaveLength(1);
  });

  it('«как обычно» — форма закрыта, пересчёта и поправки нет', async () => {
    const db = await setup();
    const { run, result } = await runT1(db, racq(), rday(1));
    await commitRoutineSetting(db, 'kid', run.runId, 'usual', rday(1), NOW);
    expect(await amendments(db)).toEqual([]);
    expect(await targetR(db)).toEqual(result.state);
    expect(await loadChildState(db, 'kid', 'abaRoutineSettingOpen')).toBeNull();
  });

  it('брошенная форма — «как обычно»: после закрытия отметка не пишется (RoutineRunClosedError)', async () => {
    const db = await setup();
    const { run, result } = await runT1(db, racq(), rday(1));
    await closeRoutineSettingForm(db, 'kid', NOW);
    await expect(commitRoutineSetting(db, 'kid', run.runId, 'other_place', rday(1), NOW)).rejects.toBeInstanceOf(RoutineRunClosedError);
    expect(await amendments(db)).toEqual([]);
    expect(await targetR(db)).toEqual(result.state);
    expect((await routineRunsOf(db, 'kid', 'R'))[0].setting).toBe('usual');
  });

  it('другой день или другой прогон — форма считается закрытой, ничего не пишется', async () => {
    const db = await setup();
    const { run } = await runT1(db, racq(), rday(1));
    await expect(commitRoutineSetting(db, 'kid', run.runId, 'other_place', rday(2), NOW)).rejects.toBeInstanceOf(RoutineRunClosedError);
    await expect(commitRoutineSetting(db, 'kid', 'run-other', 'other_place', rday(1), NOW)).rejects.toBeInstanceOf(RoutineRunClosedError);
    expect(await amendments(db)).toEqual([]);
  });

  it('цель изменилась после Т1 — RoutineStateConflictError; ни состояния, ни поправки, форма остаётся', async () => {
    const db = await setup();
    const { run, result } = await runT1(db, racq(), rday(1));
    const foreign = { ...result.state, flags: [...result.state.flags, 'no_progress' as const] };
    await asAbaWriter(db, 'kid', (tx) => saveChildState(tx, 'kid', 'abaTargets', { R: foreign }, NOW));
    await expect(commitRoutineSetting(db, 'kid', run.runId, 'other_place', rday(1), NOW)).rejects.toBeInstanceOf(RoutineStateConflictError);
    expect(await targetR(db)).toEqual(foreign);
    expect(await amendments(db)).toEqual([]);
    expect(await loadChildState(db, 'kid', 'abaRoutineSettingOpen')).not.toBeNull();
  });

  it('звено следующего прогона закрывает форму прошлого', async () => {
    const db = await setup();
    const { result } = await runT1(db, racq(), rday(1));
    const next = rstep(rstart(result.state, rday(2)));
    await storeRoutineStep(db, 'kid', next.trial, next.run, NOW);
    expect(await loadChildState(db, 'kid', 'abaRoutineSettingOpen')).toBeNull();
  });
});

describe('В7: исправление звена в хранилище', () => {
  it('в ходе прогона: замена пробы, строка исправления, снимок — одной транзакцией', async () => {
    const db = await setup();
    const s = rstep(rstart(racq(), rday(1)));
    await storeRoutineStep(db, 'kid', s.trial, s.run, iso(s.at));
    const undo = undoRoutineStep(s.run, beginRoutineUndo(s.before, s.input, s.trial, s.at), 'incorrect', s.at + 1000);
    if (!undo.ok) throw new Error(undo.errors.join('; '));
    await commitRoutineCorrection(db, 'kid', { correction: undo.correction, replacement: undo.replacement, run: undo.run }, rday(1), iso(s.at + 1000));
    expect((await trialsOfTarget(db, 'kid', 'R')).map((t) => [t.id, t.response])).toEqual([[`${s.trial.id}~c1`, 'incorrect']]);
    expect(await loadChildState(db, 'kid', 'abaRoutineRunInProgress')).toEqual(undo.run);
    expect(await amendments(db)).toEqual([]);
  });

  it('последнее звено после Т1: итог пересчитан (окно — не целиком сам), поправка correction, жетон и доска не меняются', async () => {
    const db = await setup();
    const two = rplay(rstart(racq(), rday(1)), ['ok', 'ok']);
    const last = rstep(two);
    for (const [trial, run] of [...two.trials.map((t) => [t, two] as const), [last.trial, last.run] as const]) {
      await storeRoutineStep(db, 'kid', trial, run as RoutineRunState, NOW);
    }
    const t1: RoutineRunResult = finishRoutineRun(last.run, 7, { runs: [] });
    const out = await commitRoutineRun(db, 'kid', t1, iso(last.at));
    const board = await loadChildState(db, 'kid', 'abaBoard');

    const undo = undoRoutineStep(last.run, beginRoutineUndo(last.before, last.input, last.trial, last.at), 'incorrect', last.at + 3000);
    if (!undo.ok) throw new Error(undo.errors.join('; '));
    await commitRoutineCorrection(db, 'kid', { correction: undo.correction, replacement: undo.replacement, run: undo.run }, rday(1), iso(last.at + 3000));

    const after = await targetR(db);
    expect(after?.routineRuns?.at(-1)?.whole).toBe(false);
    expect(t1.state.routineRuns?.at(-1)?.whole).toBe(true);
    expect(await loadChildState(db, 'kid', 'abaBoard')).toEqual(board);
    const [rec] = await routineRunsOf(db, 'kid', 'R');
    expect([rec.token, rec.runNo]).toEqual([out.token, 1]);
    expect((await amendments(db)).map((a) => JSON.parse(a.body).reason)).toEqual(['correction']);
    // форма держит состояние после исправления: следующая отметка места не даёт ложного конфликта
    expect((await loadChildState(db, 'kid', 'abaRoutineSettingOpen'))?.t1State).toEqual(after);
    await commitRoutineSetting(db, 'kid', last.run.runId, 'other_place', rday(1), NOW);
    expect((await routineRunsOf(db, 'kid', 'R'))[0].setting).toBe('other_place');
  });

  it('форма закрыта — исправление после Т1 не пишется: ни замены, ни строки', async () => {
    const db = await setup();
    const two = rplay(rstart(racq(), rday(1)), ['ok', 'ok']);
    const last = rstep(two);
    await commitRoutineRun(db, 'kid', finishRoutineRun(last.run, 7, { runs: [] }), iso(last.at));
    await closeRoutineSettingForm(db, 'kid', NOW);
    const undo = undoRoutineStep(last.run, beginRoutineUndo(last.before, last.input, last.trial, last.at), 'incorrect', last.at + 1000);
    if (!undo.ok) throw new Error(undo.errors.join('; '));
    await expect(
      commitRoutineCorrection(db, 'kid', { correction: undo.correction, replacement: undo.replacement, run: undo.run }, rday(1), NOW),
    ).rejects.toBeInstanceOf(RoutineRunClosedError);
    expect(await db.all('SELECT 1 FROM aba_trial_corrections')).toEqual([]);
    expect(await amendments(db)).toEqual([]);
  });
});
