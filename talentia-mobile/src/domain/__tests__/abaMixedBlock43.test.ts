/**
 * Решение методиста 43 (2026-11-18): смешанный блок целей, связанных `mixWith`, после освоения каждой по отдельности —
 * 10 проб (5 + 5), одна цель не больше двух раз подряд, со старта L0 без подсказок; «освоено» окончательно — ≥ 80 %
 * самостоятельных по каждой цели в двух сессиях в разные дни, иначе цель назад в обучение (`abaMixedBlock.ts`).
 */
import { ABA_TARGETS, readyAbaTargets } from '../../content/aba';
import { MATCH_LEVEL1 } from '../../content/aba/match-level1';
import { DEV_PLACEHOLDER_ART } from '../../services/local/abaStart';
import type { AbaResponse, AbaTarget, AbaTargetState } from '../../types/aba';
import { matchDueAt, matchTrialInput, optionActive, startMatchTrial, stepMatchTrial, type MatchTrialRun } from '../../ui/aba/model/matchTrialRun';
import { mixedVerdict, mixErrors, mixGroups } from '../abaMixedBlock';
import { accessShown, chooseReinforcer, finishAbaSession, finishAccess, finishBreak, nextStep, recordTrial, startAbaSession, type AbaSessionState, type StartInput } from '../abaSession';
import { answerLevel, isBreakdown } from '../abaPrompting';
import { programErrors, targetForBand } from '../abaTargetRules';
import { finishSession, trial } from './abaFixtures';
import { acq, BASE_MS, correctInput, DAY, masteredState, POOL, tgt, trained } from './abaSessionDriver';

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
  // поддержание M не подошло — она разогрев
  M: masteredState(M, 20),
  S: { ...masteredState(S, 19), masteredBy: 'criterion' },
  C: { ...masteredState(C, 19), masteredBy: 'criterion' },
  A: acq(A),
});

const plannedTrials = (st: AbaSessionState) => st.queue.flatMap((q) => (q.kind === 'trial' ? [q.trial] : []));
const mixedOf = (st: AbaSessionState) => plannedTrials(st).filter((t) => t.kind === 'verification');

function longestRun(ids: readonly string[]): number {
  let best = 0;
  let run = 0;
  ids.forEach((id, i) => {
    run = i > 0 && ids[i - 1] === id ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** Закончить сессию с ответами на пробы смешанного блока: `answer(targetId, i)` — i-я проба цели в блоке. */
function finishMixed(st: AbaSessionState, answer: (targetId: string, i: number) => AbaResponse, day = st.day) {
  const seen: Record<string, number> = {};
  const trials = mixedOf(st).map((p) => {
    const i = (seen[p.targetId] = (seen[p.targetId] ?? 0) + 1) - 1;
    const response = answer(p.targetId, i);
    return trial({
      sessionId: st.sessionId,
      targetId: p.targetId,
      exemplarId: p.exemplarId,
      kind: 'verification',
      response,
      promptLevelUsed: 0,
      emittedBeforePrompt: response !== 'no_response',
      latencyMs: response === 'no_response' ? null : 1200,
    });
  });
  return finishSession({ ...st, day, trials, queue: [], endReason: 'completed' }, BASE_MS + 600_000);
}

describe('решение 43: смешанный блок', () => {
  it('связь mixWith симметрична, группы — по программе; ошибки связи ловит programErrors', () => {
    expect(mixGroups(TARGETS).map((g) => g.map((t) => t.id))).toEqual([['S', 'C']]);
    expect(mixGroups([tgt('X'), tgt('Y', { mixWith: ['X'] })]).map((g) => g.map((t) => t.id))).toEqual([['X', 'Y']]);
    expect(programErrors([tgt('X', { mixWith: ['Z'] })]).join()).toMatch(/неизвестной целью Z/);
    expect(mixErrors([tgt('X', { mixWith: ['Y'] }), tgt('Y', { format: 'repeat_word' })]).join()).toMatch(/другая область, формат/);
    // контент: форма ↔ цвет объявлены и проходят гард
    expect(mixGroups(MATCH_LEVEL1).length).toBe(1);
    expect(programErrors(MATCH_LEVEL1)).toEqual([]);
  });

  it('план: 5 + 5 проб `verification` сразу после разогрева, одна цель не больше двух раз подряд, оба слота обучения', () => {
    const st = start(bothMastered());
    const mixed = mixedOf(st);
    expect(mixed.filter((t) => t.targetId === 'S')).toHaveLength(5);
    expect(mixed.filter((t) => t.targetId === 'C')).toHaveLength(5);
    expect(longestRun(mixed.map((t) => t.targetId))).toBeLessThanOrEqual(2);
    // экземпляры по кругу — не один и тот же
    expect(new Set(mixed.filter((t) => t.targetId === 'S').map((t) => t.exemplarId)).size).toBeGreaterThan(1);
    expect(st.mixedTargetIds).toEqual(['S', 'C']);
    expect(st.teachingTargetIds).toEqual([]);
    // разогрев — не на целях блока, сам блок — сразу за ним, конец блока — с участниками
    const kinds = plannedTrials(st).map((t) => t.kind);
    expect(kinds.slice(0, 2)).toEqual(['high_p', 'high_p']);
    expect(plannedTrials(st).slice(0, 2).every((t) => t.targetId === 'M')).toBe(true);
    expect(kinds.slice(2, 12).every((k) => k === 'verification')).toBe(true);
    expect(st.queue.find((q) => q.kind === 'block_end')).toMatchObject({ targetId: 'mixed:S+C', participation: true, members: ['S', 'C'] });
    expect(st.highPTargetIds).not.toContain('S');
    expect(st.maintenanceTargetIds).toEqual(expect.arrayContaining(['S', 'C']));
  });

  it('правило чередования держится на любом зерне', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const ids = mixedOf(start(bothMastered(), { seed })).map((t) => t.targetId);
      expect(ids).toHaveLength(10);
      expect(longestRun(ids)).toBeLessThanOrEqual(2);
    }
  });

  it('проба блока — со старта L0, без подсказки по задержке и без эскалации; запись принимается', () => {
    let st = start(bothMastered());
    let next = nextStep(st, BASE_MS);
    if (next.step.kind !== 'choose_reinforcer') throw new Error('ждали выбор подкрепителя');
    st = chooseReinforcer(next.state, next.step.options[0], BASE_MS, 'child');
    let seen = 0;
    for (let i = 0; i < 12; i += 1) {
      next = nextStep(st, BASE_MS + i * 10_000);
      if (next.step.kind !== 'trial') throw new Error(`ждали пробу, а шаг ${next.step.kind}`);
      if (next.step.trialKind === 'verification') {
        seen += 1;
        expect(next.step).toMatchObject({ startPromptLevel: 0, promptDelayMs: null, allowEscalation: false });
      }
      const res = recordTrial(next.state, correctInput(next.state, next.step), BASE_MS + i * 10_000 + 5000);
      if (!res.ok) throw new Error(res.errors.join('; '));
      st = res.state;
    }
    expect(seen).toBe(10);
  });

  it('не начинается, пока обе цели не освоены по отдельности', () => {
    const states = { ...bothMastered(), C: acq(C) };
    const st = start(states);
    expect(mixedOf(st)).toEqual([]);
    expect(st.mixedTargetIds).toBeUndefined();
    expect(st.teachingTargetIds).toContain('C');
    // освоенная «дома, без проверки» — сначала своя проверка
    const home = start({ ...bothMastered(), C: { ...masteredState(C, 19), masteredBy: 'home_unverified' } });
    expect(home.mixedTargetIds).toBeUndefined();
  });

  it('два дня по ≥ 80 % → освоено окончательно; второй зачёт в тот же день не считается', () => {
    const r1 = finishMixed(start(bothMastered()), (_id, i) => (i === 0 ? 'incorrect' : 'independent'));
    expect(r1.states.S.mixedCheck).toEqual({ days: [DAY] });
    expect(r1.states.C.mixedCheck).toEqual({ days: [DAY] });
    expect(r1.states.S.phase).not.toBe('acquisition');
    // проверка «дома, без проверки» на этих пробах не срабатывает, хотя ведёт обученный
    expect(r1.session.events.some((e) => e.kind === 'phase')).toBe(false);

    const after1 = { ...bothMastered(), S: r1.states.S, C: r1.states.C };
    // тот же день — блок не планируется
    expect(start(after1, { sessionIndex: 21 }).mixedTargetIds).toBeUndefined();
    // а если всё же прошёл в тот же день — день не удваивается
    const sameDay = mixedVerdict(r1.states.S, S, [], 21, DAY);
    expect(sameDay).toBeNull();

    const day2 = '2026-10-13';
    const st2 = start(after1, { sessionIndex: 21, day: day2 });
    expect(st2.mixedTargetIds).toEqual(['S', 'C']);
    const r2 = finishMixed(st2, () => 'independent');
    expect(r2.states.S.mixedCheck).toEqual({ days: [DAY, day2], done: true });
    expect(r2.states.C.mixedCheck).toEqual({ days: [DAY, day2], done: true });
    expect(r2.states.S.masteredBy).toBe('criterion');
    const passed = r2.session.events.filter((e) => e.kind === 'phase' && e.reason === 'mixed_passed');
    expect(passed.map((e) => (e.kind === 'phase' ? e.targetId : '')).sort()).toEqual(['C', 'S']);

    // пройдено — больше не планируется
    const later = { ...bothMastered(), S: r2.states.S, C: r2.states.C };
    expect(start(later, { sessionIndex: 22, day: '2026-10-14' }).mixedTargetIds).toBeUndefined();
  });

  it('меньше 80 % по цели → она в обучение, партнёр остаётся освоенным со своим днём', () => {
    const r = finishMixed(start(bothMastered()), (id, i) => (id === 'C' && i < 2 ? 'incorrect' : 'independent'));
    expect(r.states.C).toMatchObject({ phase: 'acquisition', sessionsAtCriterion: 0, criterionDays: [], maintenanceGapIndex: 0 });
    expect(r.states.C.mixedCheck).toBeUndefined();
    expect(r.states.C.masteredBy).toBeUndefined();
    // 3 из 5 — с последнего успешного уровня
    expect(r.states.C.startPromptLevel).toBe(0);
    expect(r.states.S.phase).toBe('mastered');
    expect(r.states.S.mixedCheck).toEqual({ days: [DAY] });
    expect(r.session.events).toContainEqual(expect.objectContaining({ kind: 'phase', targetId: 'C', from: 'mastered', to: 'acquisition', reason: 'mixed_failed' }));

    // 0–2 из 5 — со старта первого уровня, несущего ответ
    const low = finishMixed(start(bothMastered()), (id, i) => (id === 'C' && i < 3 ? 'no_response' : 'independent'));
    expect(low.states.C.startPromptLevel).toBeGreaterThan(0);

    // пока цель снова не освоена, блок не планируется — она учится обычным блоком
    const next = start({ ...bothMastered(), S: r.states.S, C: r.states.C }, { sessionIndex: 21, day: '2026-10-13' });
    expect(next.mixedTargetIds).toBeUndefined();
    expect(next.teachingTargetIds).toContain('C');
  });

  it('оборванный блок (меньше 5 проб цели) ничего не решает', () => {
    const st = start(bothMastered());
    const lastC = st.queue.reduce((at, q, i) => (q.kind === 'trial' && q.trial.targetId === 'C' ? i : at), -1);
    const r = finishMixed({ ...st, queue: st.queue.filter((_q, i) => i !== lastC) }, () => 'incorrect');
    expect(r.states.C.phase).toBe('mastered');
    expect(r.states.C.mixedCheck).toBeUndefined();
  });

  it('ошибки подряд в блоке не обрывают сессию срывом — это измерение, а не обучение', () => {
    const t: AbaTarget = S;
    const own = Array.from({ length: 5 }, () => trial({ targetId: t.id, kind: 'verification', response: 'incorrect', promptLevelUsed: 0 }));
    expect(isBreakdown(own, t.id)).toBe(false);
    expect(mixedVerdict(masteredState(t), t, own, 20, DAY)?.reason).toBe('mixed_failed');
  });

  it('3 из 5 у освоенной по базовой линии — не с полной модели: не выше первого уровня, несущего ответ', () => {
    // формат, где первый уровень, несущий ответ, ниже полной модели (у `match` и подражания это и есть L3)
    const V = tgt('V', { format: 'voice_volume' });
    const fromBaseline: AbaTargetState = { ...masteredState(V), masteredBy: 'baseline', startPromptLevel: 3, lastSuccessfulPromptLevel: 3 };
    const own = [0, 1, 2, 3, 4].map((i) =>
      trial({ targetId: V.id, kind: 'verification', response: i < 3 ? 'independent' : 'incorrect', promptLevelUsed: 0 }),
    );
    const v = mixedVerdict(fromBaseline, V, own, 20, DAY);
    expect(v?.reason).toBe('mixed_failed');
    expect(v?.state.startPromptLevel).toBe(answerLevel(V));
    expect(v?.state.startPromptLevel).toBeLessThan(3);
  });
});

// ---------- настоящие цели `match`: форма ↔ цвет через модель экрана ----------

type Act = 'correct' | 'none' | 'incorrect';
const T0 = Date.UTC(2026, 10, 18, 6);
const REAL = readyAbaTargets(ABA_TARGETS, DEV_PLACEHOLDER_ART).map((t) => targetForBand(t, '5-6'));
const SHAPE = REAL.find((t) => t.mixWith?.length)!;
const PAIR = mixGroups(REAL)[0].map((t) => t.id);

/** «Верно» — образец и такая же карточка; «неверно» — образец и другая; «нет ответа» — окна истекают без касаний. */
function runMatch(r0: MatchTrialRun, act: Act, at0: number): { r: MatchTrialRun; at: number } {
  let r = r0;
  let at = at0;
  if (act !== 'none') {
    if (r.sampleTouchedAt === null) r = stepMatchTrial(r, { type: 'tap_sample', at: (at += 1000) });
    const id = act === 'correct' ? r.step.sampleCardId! : r.step.field!.find((x) => x !== r.step.sampleCardId)!;
    if (optionActive(r, id)) r = stepMatchTrial(r, { type: 'tap_option', id, at: (at += 500) });
  }
  for (let guard = 0; !r.done && guard < 50; guard += 1) {
    if (r.awaitingL4) {
      r = stepMatchTrial(r, { type: 'adult', button: 'l4_skipped', at });
      break;
    }
    const due = matchDueAt(r);
    if (due === null) break;
    at = Math.max(at, due);
    r = stepMatchTrial(r, { type: 'due', at });
  }
  return { r, at };
}

/** Занятие целиком; `policy(targetId, n)` — n-я проба смешанного блока цели, остальное верно. */
function runReal(states: Record<string, AbaTargetState>, day: string, index: number, policy: (id: string, n: number) => Act) {
  let now = T0 + index * 86_400_000;
  let st = startAbaSession({
    sessionId: `r${index}`,
    sessionIndex: index,
    day,
    config: 'with_adult',
    band: '5-6',
    targets: REAL,
    states,
    reinforcerPool: POOL,
    reinforcerApart: [],
    reinforcerHistory: [],
    tokenTraining: trained(5),
    startedAt: now,
    seed: 500 + index,
    physicalPromptAllowed: false,
    observers: [{ id: 'o1', role: 'specialist', trained: true }],
    primaryObserverId: 'o1',
  });
  const planned = st;
  const seen = new Map<string, number>();
  let seq = 0;
  for (let guard = 0; guard < 400; guard += 1) {
    const next = nextStep(st, now);
    st = next.state;
    const step = next.step;
    if (step.kind === 'choose_reinforcer') st = chooseReinforcer(st, step.options[0], now, 'child');
    else if (step.kind === 'break') st = finishBreak(st, (now += 60_000)).state;
    else if (step.kind === 'access') {
      st = accessShown(st);
      st = finishAccess(st, (now += step.durationMs));
    } else if (step.kind === 'end') break;
    else if (step.kind === 'adult_finish_chain') throw new Error('цепочек в match нет');
    else {
      const n = seen.get(step.targetId) ?? 0;
      const mixedTrial = step.trialKind === 'verification';
      if (mixedTrial) seen.set(step.targetId, n + 1);
      const act = mixedTrial ? policy(step.targetId, n) : 'correct';
      const run = startMatchTrial({
        step,
        target: st.targets[step.targetId],
        config: 'with_adult',
        seed: st.seed,
        trialId: `t${(seq += 1)}`,
        sessionId: st.sessionId,
        index: st.trials.length,
        shownAt: now,
      });
      const done = runMatch(run, act, now);
      now = done.at + 200;
      const res = recordTrial(st, matchTrialInput(done.r), now);
      if (!res.ok) throw new Error(res.errors.join('; '));
      st = res.state;
      now += 5000;
    }
  }
  const result = finishAbaSession(st, now, {}, undefined, undefined, { routineExchangeInWindow: false });
  return { planned, final: st, result, states: { ...states, ...result.states } };
}

describe('решение 43 на настоящих целях: форма и цвет', () => {
  const allMastered = (): Record<string, AbaTargetState> =>
    Object.fromEntries(REAL.map((t) => [t.id, { ...masteredState(t, 1), masteredBy: 'criterion' as const }]));

  it('пара в контенте — форма и цвет; поля строятся, записи принимаются, два дня — освоено', () => {
    expect(SHAPE.id).toBe('match-shape');
    expect(PAIR).toHaveLength(2);
    const d1 = runReal(allMastered(), '2026-11-18', 1, () => 'correct');
    expect(d1.planned.mixedTargetIds).toEqual(PAIR);
    const mixed = d1.final.trials.filter((t) => t.kind === 'verification');
    expect(mixed).toHaveLength(10);
    expect(mixed.every((t) => t.field?.length === d1.final.targets[t.targetId].fieldSize && t.startPromptLevel === 0)).toBe(true);
    expect(longestRun(mixed.map((t) => t.targetId))).toBeLessThanOrEqual(2);
    for (const id of PAIR) expect(d1.result.states[id].mixedCheck).toEqual({ days: ['2026-11-18'] });
    // сессия, где был только смешанный блок, не кончается циклом сопряжения
    expect(d1.result.session.events.some((e) => e.kind === 'pairing')).toBe(false);

    const d2 = runReal(d1.states, '2026-11-19', 2, () => 'correct');
    for (const id of PAIR) expect(d2.result.states[id].mixedCheck).toEqual({ days: ['2026-11-18', '2026-11-19'], done: true });
  });

  it('промах наблюдения в блоке не заменяется базовой линией освоенной цели и итога не даёт', () => {
    const r = runReal(allMastered(), '2026-11-18', 1, (id, n) => (id === SHAPE.id && n === 1 ? 'none' : 'correct'));
    expect(r.final.trials.some((t) => t.kind === 'baseline')).toBe(false);
    expect(r.result.states[SHAPE.id].mixedCheck).toBeUndefined();
    expect(r.result.states[SHAPE.id].phase).not.toBe('acquisition');
  });

  it('ошибки по цвету — цвет в обучение, форма остаётся освоенной', () => {
    const color = PAIR.find((id) => id !== SHAPE.id)!;
    const r = runReal(allMastered(), '2026-11-18', 1, (id, n) => (id === color && n < 2 ? 'incorrect' : 'correct'));
    expect(r.result.states[color].phase).toBe('acquisition');
    expect(r.result.states[SHAPE.id].mixedCheck).toEqual({ days: ['2026-11-18'] });
  });
});
