/**
 * Потолок нейтральных «без итога» смешанного блока (методист 2026-11-18, раздел «Для специалиста», C): блок начался и
 * не дал итога по нейтральной причине две сессии подряд — следующая сессия идёт без блока (оба слота — обучению),
 * счётчик снят, флага нет, событие `mixed_no_verdict` — `yielded: true`. Сессия с итогом или засчитанная «без итога»
 * счёт снимает. Плюс «Назначить проверку вперемешку» (`assignMixedCheck`) и параметры (`sanitizeSessionParams`).
 */
import type { AbaResponse, AbaTargetState } from '../../types/aba';
import { assignMixedCheck, paramsChanges } from '../abaSpecialist';
import { pruneSessionParams, sanitizeSessionParams } from '../abaSessionParams';
import { startAbaSession, type AbaSessionState, type StartInput } from '../abaSession';
import { finishSession, trial } from './abaFixtures';
import { acq, BASE_MS, DAY, masteredState, POOL, tgt, trained } from './abaSessionDriver';

const S = tgt('S', { mixWith: ['C'] });
const C = tgt('C');
const M = tgt('M');
const A = tgt('A');
const TARGETS = [M, S, C, A];

function start(states: Record<string, AbaTargetState>, over: Partial<StartInput> = {}): AbaSessionState {
  return startAbaSession({
    reinforcerApart: [],
    sessionId: 's',
    sessionIndex: 20,
    day: DAY,
    config: 'with_adult',
    band: '7',
    targets: TARGETS,
    states,
    reinforcerPool: POOL,
    reinforcerHistory: [],
    startedAt: BASE_MS,
    seed: 7,
    tokenTraining: trained(5),
    physicalPromptAllowed: true,
    observers: [{ id: 'obs-spec', role: 'specialist', trained: true }],
    primaryObserverId: 'obs-spec',
    ...over,
  });
}

const bothMastered = (): Record<string, AbaTargetState> => ({
  M: masteredState(M, 20),
  S: { ...masteredState(S, 19), masteredBy: 'criterion' },
  C: { ...masteredState(C, 19), masteredBy: 'criterion' },
  A: acq(A),
});

const mixedOf = (st: AbaSessionState) => st.queue.flatMap((q) => (q.kind === 'trial' && q.trial.kind === 'verification' ? [q.trial] : []));

/** Без последней пробы блока у `ids`: у них меньше 5 проб — итога нет. */
function cut(st: AbaSessionState, ids: readonly string[]): AbaSessionState {
  const drop = new Set(ids.map((id) => st.queue.reduce((at, q, i) => (q.kind === 'trial' && q.trial.kind === 'verification' && q.trial.targetId === id ? i : at), -1)));
  return { ...st, queue: st.queue.filter((_q, i) => !drop.has(i)) };
}

function finish(st: AbaSessionState, endReason: AbaSessionState['endReason'], answer: (id: string) => AbaResponse = () => 'independent') {
  const trials = mixedOf(st).map((p) =>
    trial({ sessionId: st.sessionId, targetId: p.targetId, exemplarId: p.exemplarId, kind: 'verification', response: answer(p.targetId), promptLevelUsed: 0, latencyMs: 1200 }),
  );
  return finishSession({ ...st, trials, queue: [], endReason }, BASE_MS + 600_000);
}

const noVerdictEvent = (r: ReturnType<typeof finish>) => r.session.events.find((e) => e.kind === 'measurement' && e.action === 'mixed_no_verdict');
const withStates = (r: ReturnType<typeof finish>, base = bothMastered()) => ({ ...base, S: r.states.S ?? base.S, C: r.states.C ?? base.C });

describe('потолок нейтральных «без итога» (C)', () => {
  it('первая нейтральная — счёт 1, без пропуска; вторая — `yielded`, счётчик снят, флага нет; `noVerdict` не тронут', () => {
    const one = { days: [], noVerdict: 1 };
    const base = { ...bothMastered(), S: { ...bothMastered().S, mixedCheck: one }, C: { ...bothMastered().C, mixedCheck: one } };
    const r1 = finish(cut(start(base), ['S', 'C']), 'adult_stopped');
    expect(noVerdictEvent(r1)).toMatchObject({ reason: 'adult_stopped', counted: false });
    expect(noVerdictEvent(r1)).not.toHaveProperty('yielded');
    expect(r1.states.S.mixedCheck).toEqual({ days: [], noVerdict: 1, neutralNoVerdict: 1 });

    const r2 = finish(cut(start(withStates(r1, base), { sessionIndex: 21 }), ['S', 'C']), 'app_backgrounded');
    expect(noVerdictEvent(r2)).toMatchObject({ reason: 'app_backgrounded', counted: false, yielded: true });
    for (const id of ['S', 'C']) {
      expect(r2.states[id].mixedCheck).toEqual({ days: [], noVerdict: 1, yieldAt: 22 });
      expect(r2.states[id].flags).not.toContain('mixed_not_established');
    }
  });

  it('следующая сессия идёт без блока — оба слота обучению; через одну блок снова в плане', () => {
    const r1 = finish(cut(start(bothMastered()), ['S', 'C']), 'adult_stopped');
    const r2 = finish(cut(start(withStates(r1), { sessionIndex: 21 }), ['S', 'C']), 'adult_stopped');
    const after = withStates(r2);
    const yielded = start(after, { sessionIndex: 22 });
    expect(yielded.mixedTargetIds).toBeUndefined();
    expect(mixedOf(yielded)).toEqual([]);
    expect(yielded.teachingTargetIds).toEqual(['A']);
    // контроль: без пропуска та же сессия — с блоком и без обучения
    expect(start(bothMastered(), { sessionIndex: 22 }).mixedTargetIds).toEqual(['S', 'C']);
    // пропуск — одна сессия: следующий номер снова с блоком, счётчик начат заново
    const back = start(after, { sessionIndex: 23 });
    expect(back.mixedTargetIds).toEqual(['S', 'C']);
    expect(after.S.mixedCheck?.neutralNoVerdict).toBeUndefined();
  });

  it('засчитанная «без итога» снимает нейтральный счёт', () => {
    const r1 = finish(cut(start(bothMastered()), ['S', 'C']), 'adult_stopped');
    const r2 = finish(cut(start(withStates(r1), { sessionIndex: 21 }), ['S', 'C']), 'time_limit');
    expect(noVerdictEvent(r2)).toMatchObject({ counted: true });
    expect(noVerdictEvent(r2)).not.toHaveProperty('yielded');
    expect(r2.states.S.mixedCheck).toEqual({ days: [], noVerdict: 1 });
  });

  it('итог по участнику снимает нейтральный счёт — и когда другой участник без итога', () => {
    const r1 = finish(cut(start(bothMastered()), ['S', 'C']), 'adult_stopped');
    // S — полные пробы (итог), C — без последней (нет итога), причина нейтральная
    const r2 = finish(cut(start(withStates(r1), { sessionIndex: 21 }), ['C']), 'adult_stopped');
    expect(noVerdictEvent(r2)).toMatchObject({ counted: false, targetIds: ['C'] });
    expect(noVerdictEvent(r2)).not.toHaveProperty('yielded');
    expect(r2.states.S.mixedCheck?.neutralNoVerdict).toBeUndefined();
    expect(r2.states.C.mixedCheck?.neutralNoVerdict).toBeUndefined();
    // сессия с итогом по всем — счётчиков нет вовсе
    const r3 = finish(start(withStates(r1), { sessionIndex: 21 }), 'completed');
    expect(r3.states.C.mixedCheck).toEqual({ days: [DAY] });
  });

  it('блок не начался — сессия нейтральна для потолка: счёт не растёт', () => {
    const st = start(bothMastered());
    const r = finishSession({ ...st, trials: [], queue: [], endReason: 'adult_stopped' }, BASE_MS + 600_000);
    expect(r.states.S?.mixedCheck).toBeUndefined();
  });
});

describe('«Назначить проверку вперемешку»', () => {
  it('снимает флаг у всей группы и сбрасывает счётчики — блок снова в плане', () => {
    const held = (s: AbaTargetState): AbaTargetState => ({ ...s, flags: ['mixed_not_established'], mixedCheck: { days: [], noVerdict: 1, neutralNoVerdict: 1, yieldAt: 3 } });
    const base = bothMastered();
    const states = { ...base, S: held(base.S), C: held(base.C) };
    expect(start(states).mixedTargetIds).toBeUndefined();
    const next = assignMixedCheck(TARGETS, states, 'C');
    expect(Object.keys(next ?? {})).toEqual(['S', 'C']);
    expect(next?.S).toMatchObject({ flags: [], mixedCheck: { days: [] } });
    expect(next?.S.mixedCheck).toEqual({ days: [] });
    expect(start({ ...states, ...next }).mixedTargetIds).toEqual(['S', 'C']);
    // цель без группы или без флага — ничего
    expect(assignMixedCheck(TARGETS, states, 'A')).toBeNull();
    expect(assignMixedCheck(TARGETS, base, 'S')).toBeNull();
  });
});

describe('параметры специалиста: чтение из хранилища и события', () => {
  it('sanitizeSessionParams: годные — как есть, негодные по форме или пределам — undefined', () => {
    expect(sanitizeSessionParams({ paramsBand: '8', timeLimitMs: 600_000, responseWindowMs: { match: 7000 }, maxTeachingTargets: 1 }, '7')).toEqual({
      paramsBand: '8',
      timeLimitMs: 600_000,
      responseWindowMs: { match: 7000 },
      maxTeachingTargets: 1,
    });
    expect(sanitizeSessionParams({}, '7')).toBeUndefined();
    expect(sanitizeSessionParams(undefined, '7')).toBeUndefined();
    expect(sanitizeSessionParams({ timeLimitMs: 16 * 60_000 }, '5-6')).toBeUndefined();
    expect(sanitizeSessionParams({ timeLimitMs: 16 * 60_000, paramsBand: '7' }, '5-6')).toEqual({ timeLimitMs: 960_000, paramsBand: '7' });
    expect(sanitizeSessionParams({ responseWindowMs: { match: 11_000 } }, '7')).toBeUndefined();
    expect(sanitizeSessionParams({ extra: 1 }, '7')).toBeUndefined();
    expect(sanitizeSessionParams([], '7')).toBeUndefined();
  });

  it('pruneSessionParams: смена полосы снимает то, что при ней вне пределов', () => {
    expect(pruneSessionParams({ paramsBand: '5-6', timeLimitMs: 20 * 60_000, responseWindowMs: { match: 6000 } }, '7')).toEqual({ paramsBand: '5-6', responseWindowMs: { match: 6000 } });
  });

  it('paramsChanges: по событию на поле, «по умолчанию» — null, без изменений — пусто', () => {
    const at = '2026-11-18T09:00:00.000Z';
    expect(paramsChanges(undefined, {}, at)).toEqual([]);
    expect(paramsChanges({ timeLimitMs: 600_000 }, { responseWindowMs: { match: 8000 } }, at).map((e) => [e.field, e.from, e.to])).toEqual([
      ['timeLimitMs', 600_000, null],
      ['responseWindowMs.match', null, 8000],
    ]);
  });
});
