/**
 * Исправление отметки звена рутины (`abaUndo.ts`: `beginRoutineUndo`, `canUndoRoutineStep`,
 * `undoRoutineStep`; раунд 4, В7): последнее звено, один раз, 5 с, до SD следующего; прерванное звено
 * и «Звено — самостоятельно» не исправляются; замена `~c1`; жетонов за звено нет. Хранилище —
 * `services/local/__tests__/routineSetting.test.ts`.
 */
import type { AbaPresentation } from '../../types/aba';
import { finishRoutineRun, recordRoutineStep, resumeRoutineRun } from '../abaRoutineRun';
import { beginRoutineUndo, canUndoRoutineStep, undoRoutineStep, UNDO_WINDOW_MS } from '../abaUndo';
import { NO_HISTORY } from './abaFixtures';
import { initialTargetState } from '../abaPrompting';
import { racq, rday, rinput, rnow, rplay, rstart, rstep, RT } from './abaRoutineDriver';

/** Записать звено и сразу снять снимок исправления. */
function marked(run = rstart(racq(), rday(3)), how: 'ok' | 'break' | 'refuse' = 'ok') {
  const s = rstep(run, how);
  return { ...s, ctx: beginRoutineUndo(s.before, s.input, s.trial, s.at) };
}

describe('canUndoRoutineStep: окно и закрывающие условия', () => {
  it('сразу после отметки исправление доступно', () => {
    const m = marked();
    expect(canUndoRoutineStep(m.run, m.ctx, m.at)).toBe(true);
  });

  it('нет снимка — нельзя', () => {
    const m = marked();
    expect(canUndoRoutineStep(m.run, null, m.at)).toBe(false);
  });

  it('ровно в 5 с можно, через 5 с и 1 мс — нельзя', () => {
    const m = marked();
    expect(canUndoRoutineStep(m.run, m.ctx, m.at + UNDO_WINDOW_MS)).toBe(true);
    expect(canUndoRoutineStep(m.run, m.ctx, m.at + UNDO_WINDOW_MS + 1)).toBe(false);
  });

  it('показан SD следующего звена — нельзя', () => {
    const m = marked();
    expect(canUndoRoutineStep(m.run, { ...m.ctx, sdStarted: true }, m.at + 100)).toBe(false);
  });

  it('записано следующее звено — исправлять можно только последнее', () => {
    const m = marked();
    const next = rstep(m.run).run;
    expect(canUndoRoutineStep(next, m.ctx, m.at + 100)).toBe(false);
  });

  it('прерванное звено (детская карточка, «Отказ») не исправляется', () => {
    const b = marked(undefined, 'break');
    expect(canUndoRoutineStep(b.run, b.ctx, b.at)).toBe(false);
    const r = marked(undefined, 'refuse');
    expect(canUndoRoutineStep(r.run, r.ctx, r.at)).toBe(false);
  });

  it('«Звено — самостоятельно» (adult_completed) не исправляется', () => {
    const mastered = { ...initialTargetState(RT), phase: 'mastered' as const, masteredBy: 'criterion' as const, lastMaintenanceDay: '2026-09-01' };
    const run = rstart(mastered, rday(10));
    const input = rinput(run);
    const { respondedAt: _r, ...last } = input.presentationLog[0] as AbaPresentation;
    const adult = { ...input, presentationLog: [{ ...last, outcome: 'adult_completed' as const }] };
    const res = recordRoutineStep(run, adult, rnow(run));
    if (!res.ok) throw new Error(res.errors.join('; '));
    expect(res.trial.adultCompleted).toBe(true);
    expect(canUndoRoutineStep(res.run, beginRoutineUndo(run, adult, res.trial, rnow(run)), rnow(run))).toBe(false);
  });
});

describe('undoRoutineStep: замена пробы', () => {
  it('«Верно» → «Неверно»: замена ~c1, исправление без жетонов, звено засчитано заново', () => {
    const m = marked();
    const res = undoRoutineStep(m.run, m.ctx, 'incorrect', m.at + 2000);
    if (!res.ok) throw new Error(res.errors.join('; '));
    expect(res.replacement).toMatchObject({ id: `${m.trial.id}~c1`, stepId: m.trial.stepId, response: 'incorrect', tokens: 0 });
    expect(res.correction).toEqual({
      trialId: m.trial.id,
      replacementId: `${m.trial.id}~c1`,
      sessionId: m.run.runId,
      msSinceOriginal: 2000,
      fromResponse: 'independent',
      toResponse: 'incorrect',
      tokenKept: 0,
      tokenAdded: 0,
    });
    expect(res.run.trials.map((t) => t.id)).toEqual([`${m.trial.id}~c1`]);
    expect(res.run.done).toBe(1);
  });

  it('один раз: после исправления тот же снимок больше не действует', () => {
    const m = marked();
    const res = undoRoutineStep(m.run, m.ctx, 'incorrect', m.at + 100);
    if (!res.ok) throw new Error(res.errors.join('; '));
    expect(canUndoRoutineStep(res.run, m.ctx, m.at + 200)).toBe(false);
    expect(undoRoutineStep(res.run, m.ctx, 'correct', m.at + 200).ok).toBe(false);
  });

  it('исход тот же или исход, который отметкой не ставится, — отказ', () => {
    const m = marked();
    expect(undoRoutineStep(m.run, m.ctx, 'correct', m.at).ok).toBe(false);
    expect(undoRoutineStep(m.run, m.ctx, 'child_break', m.at).ok).toBe(false);
    expect(undoRoutineStep(m.run, m.ctx, 'adult_completed', m.at).ok).toBe(false);
  });

  it('последнее звено: конец прогона — исходный момент записи, исправление его не сдвигает', () => {
    const two = rplay(rstart(racq(), rday(3)), ['ok', 'ok']);
    const m = marked(two);
    expect(m.run.endedAt).toBe(m.at);
    const res = undoRoutineStep(m.run, m.ctx, 'incorrect', m.at + 4000);
    if (!res.ok) throw new Error(res.errors.join('; '));
    expect(res.run.endedAt).toBe(m.at);
    // итог пересчитывается: прогон уже не целиком сам
    expect(finishRoutineRun(m.run, 7, NO_HISTORY).state.routineRuns?.at(-1)?.whole).toBe(true);
    expect(finishRoutineRun(res.run, 7, NO_HISTORY).state.routineRuns?.at(-1)?.whole).toBe(false);
  });

  it('повтор звена после перерыва сохраняет ссылку на снятую пробу', () => {
    const paused = rstep(rstart(racq(), rday(3)), 'break');
    const m = marked(resumeRoutineRun(paused.run));
    expect(m.trial.requeuedFromTrialId).toBe(paused.trial.id);
    const res = undoRoutineStep(m.run, m.ctx, 'incorrect', m.at + 100);
    if (!res.ok) throw new Error(res.errors.join('; '));
    expect(res.replacement.requeuedFromTrialId).toBe(paused.trial.id);
  });

  it('место «где и с кем» прогона исправление не сбрасывает', () => {
    const m = marked();
    const res = undoRoutineStep({ ...m.run, setting: 'other_place' }, m.ctx, 'incorrect', m.at + 100);
    if (!res.ok) throw new Error(res.errors.join('; '));
    expect(res.run.setting).toBe('other_place');
  });
});
