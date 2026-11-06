/**
 * №160: просьба «перерыв» во время последствия — не теряется ни при какой голове очереди
 * (`aba-pedagogy-specialist` 2026-10-25: Б1, В2–В4, В6).
 */
import { CHILD_BREAKS_TO_END } from '../../types/aba';
import { breakCardRequestsOf } from '../abaBreakCard';
import { finishBreak, nextStep, requestBreakBetweenTrials, stopSession, type AbaSessionState } from '../abaSession';
import { answerNext, BASE_MS, beginSession } from './abaSessionDriver';

/** Сессия после первой записанной пробы — фаза последствия, следующий в очереди — проба. */
function afterTrial(): AbaSessionState {
  return answerNext(beginSession(), BASE_MS + 1000).state;
}

const T = BASE_MS + 2000;

describe('просьба «перерыв» между пробами (№160)', () => {
  it('следом проба: перерыв вместо её SD; проба не повторяется; просьба в счёте и в журнале', () => {
    const st = afterTrial();
    const trialsBefore = st.queue.filter((q) => q.kind === 'trial').length;
    const r = requestBreakBetweenTrials(st, T);
    expect(r.queue[0]).toMatchObject({ kind: 'break', initiatedBy: 'child_card', between: true });
    expect(r.queue.filter((q) => q.kind === 'trial').length).toBe(trialsBefore);
    expect(r.childBreaks).toBe(st.childBreaks + 1);
    expect(r.events.at(-1)).toMatchObject({ kind: 'assent', by: 'child_card', action: 'break', between: true });
    expect(nextStep(r, T + 500).step.kind).toBe('break');
  });

  it('повторный тап до перерыва — ничего нового', () => {
    const r = requestBreakBetweenTrials(afterTrial(), T);
    expect(requestBreakBetweenTrials(r, T + 100)).toBe(r);
  });

  it('третья просьба (две настоящие до неё через лимит) — конец по отказу', () => {
    const st = { ...afterTrial(), childBreaks: CHILD_BREAKS_TO_END - 1 };
    expect(requestBreakBetweenTrials(st, T).endReason).toBe('assent_withdrawn');
  });

  it('в защитном окне — конец по отказу', () => {
    const st = afterTrial();
    const head = st.queue[0];
    if (head?.kind !== 'trial') throw new Error('ожидали пробу');
    const guarded: AbaSessionState = { ...st, queue: [{ ...head, trial: { ...head.trial, requeuedFromTrialId: 'x' } }, ...st.queue.slice(1)] };
    expect(requestBreakBetweenTrials(guarded, T).endReason).toBe('assent_withdrawn');
  });

  it('следом коррекция: перерыв, затем коррекция с защитным окном (как перерыв в пробе)', () => {
    const st = afterTrial();
    const head = st.queue[0];
    if (head?.kind !== 'trial') throw new Error('ожидали пробу');
    const withCorrection: AbaSessionState = { ...st, queue: [{ kind: 'trial', trial: { ...head.trial, kind: 'correction' } }, ...st.queue.slice(1)] };
    const r = requestBreakBetweenTrials(withCorrection, T);
    expect(r.queue[0]).toMatchObject({ kind: 'break', between: true });
    const correction = r.queue.find((q) => q.kind === 'trial' && q.trial.kind === 'correction');
    expect(correction && correction.kind === 'trial' && correction.trial.requeuedFromTrialId).toBeTruthy();
  });

  it('следом перерыв по расписанию — он и есть ответ на просьбу, второго перерыва нет', () => {
    const st = afterTrial();
    const scheduled: AbaSessionState = { ...st, queue: [{ kind: 'break', maxMs: 30_000 }, ...st.queue] };
    const r = requestBreakBetweenTrials(scheduled, T);
    const breaks = (x: AbaSessionState) => x.queue.filter((q) => q.kind === 'break').length;
    expect(breaks(r)).toBe(breaks(scheduled));
    expect(r.queue[0]).toMatchObject({ kind: 'break', initiatedBy: 'child_card', between: true });
  });

  it('следом доступ — перерыв сразу после доступа', () => {
    const st = afterTrial();
    const withAccess: AbaSessionState = { ...st, queue: [{ kind: 'access', durationMs: 20_000 }, ...st.queue] };
    const r = requestBreakBetweenTrials(withAccess, T);
    expect(r.queue.slice(0, 2).map((q) => q.kind)).toEqual(['access', 'break']);
  });

  it('сессия кончается — закрывающего требования нет, просьба записана', () => {
    const ended: AbaSessionState = { ...afterTrial(), endReason: 'time_limit' };
    const r = requestBreakBetweenTrials(ended, T);
    expect(r.queue.some((q) => q.kind === 'trial')).toBe(false);
    expect(r.events.at(-1)).toMatchObject({ kind: 'assent', between: true });
    const stopped = stopSession(afterTrial(), 'adult_stopped');
    expect(() => requestBreakBetweenTrials(stopped, T)).not.toThrow();
  });

  it('лимит времени между просьбой и перерывом не съедает обещанный перерыв (В4)', () => {
    const r = requestBreakBetweenTrials(afterTrial(), T);
    const late = nextStep({ ...r, timeLimitMs: 1 }, T + 60_000);
    expect(late.state.queue.some((q) => q.kind === 'break' && q.between)).toBe(true);
  });

  it('событие перерыва несёт between; карточка видит просьбу (breakCardRequestsOf)', () => {
    const r = requestBreakBetweenTrials(afterTrial(), T);
    const started = nextStep(r, T + 100).state;
    const done = finishBreak({ ...started, breakStartedAt: T + 100 }, T + 30_000).state;
    expect(done.events.find((e) => e.kind === 'break')).toMatchObject({ initiatedBy: 'child_card', between: true });
    expect(breakCardRequestsOf(done.events).requests).toBe(1);
  });
});

describe('обмен на перерыве по просьбе ребёнка (№161)', () => {
  const full = (st: AbaSessionState): AbaSessionState => ({ ...st, board: { ...st.board, earned: st.board.size } });

  it('просьба между пробами при полной доске: обмена нет, жетоны на месте', () => {
    const r = requestBreakBetweenTrials(full(afterTrial()), T);
    const step = nextStep(r, T + 100);
    expect(step.step).toMatchObject({ kind: 'break', canExchange: false });
    const done = finishBreak(step.state, T + 30_000);
    expect(done.exchanged).toBe(0);
    expect(done.state.board.earned).toBe(done.state.board.size);
  });

  it('перерыв по расписанию при полной доске — обмен как раньше', () => {
    const st = full(afterTrial());
    const scheduled: AbaSessionState = { ...st, queue: [{ kind: 'break', maxMs: 30_000 }, ...st.queue] };
    const step = nextStep(scheduled, T);
    expect(step.step).toMatchObject({ kind: 'break', canExchange: true });
    expect(finishBreak(step.state, T + 30_000).exchanged).toBeGreaterThan(0);
  });

  it('карточка после отказа (cardTaken) — тоже без обмена', () => {
    const st = full(afterTrial());
    const taken: AbaSessionState = { ...st, queue: [{ kind: 'break', initiatedBy: 'adult', cardTaken: true, maxMs: 60_000 }, ...st.queue] };
    const step = nextStep(taken, T);
    expect(finishBreak(step.state, T + 30_000).exchanged).toBe(0);
  });
});
