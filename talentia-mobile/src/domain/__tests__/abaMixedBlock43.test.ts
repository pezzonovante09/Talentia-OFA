/**
 * Решение методиста 43 (2026-11-18): смешанный блок целей, связанных `mixWith`, после освоения каждой по отдельности —
 * 10 проб (5 + 5), одна цель не больше двух раз подряд, со старта L0 без подсказок; «освоено» окончательно — ≥ 80 %
 * самостоятельных по каждой цели в двух сессиях в разные дни, иначе цель назад в обучение (`abaMixedBlock.ts`).
 * Ревью методиста 2026-11-18: замена первого промаха наблюдения, потолок «две сессии без итога», повтор в тот же день не
 * судит, в обучение — только после двух проваленных блоков подряд, пробы переноса не обнуляются; родителю — «освоено
 * отдельно, ждёт проверки вперемешку».
 */
import { ABA_TARGETS, readyAbaTargets } from '../../content/aba';
import { MATCH_LEVEL1 } from '../../content/aba/match-level1';
import { DEV_PLACEHOLDER_ART } from '../../services/local/abaStart';
import type { AbaGeneralizationProbe, AbaResponse, AbaTarget, AbaTargetState } from '../../types/aba';
import { matchDueAt, matchTrialInput, optionActive, startMatchTrial, stepMatchTrial, type MatchTrialRun } from '../../ui/aba/model/matchTrialRun';
import { arrange } from '../abaIdentifySet';
import { mixedGroupDue, mixedVerdict, mixErrors, mixGroups, replacementSlot } from '../abaMixedBlock';
import { seeded } from '../abaRandom';
import { stageOfPlan } from '../abaParentStage';
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
function finishMixed(
  st: AbaSessionState,
  answer: (targetId: string, i: number) => AbaResponse,
  day = st.day,
  end: Pick<AbaSessionState, 'endReason' | 'events'> = { endReason: 'completed', events: st.events },
) {
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
  return finishSession({ ...st, day, trials, queue: [], ...end }, BASE_MS + 600_000);
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

  it('один проваленный блок — цель остаётся освоенной со своим днём; второй подряд — в обучение, партнёр со своим днём', () => {
    const probe = { kind: 'new_exemplar', exemplarId: 'C-e2', response: 'independent', sessionIndex: 10 } as unknown as AbaGeneralizationProbe;
    const states = { ...bothMastered(), C: { ...bothMastered().C, mixedCheck: { days: ['2026-10-10'] }, generalizationProbes: [probe] } };
    const failC = (id: string, i: number): AbaResponse => (id === 'C' && i < 2 ? 'incorrect' : 'independent');
    const r1 = finishMixed(start(states), failC);
    expect(r1.states.C.phase).toBe('mastered');
    expect(r1.states.C.masteredBy).toBe('criterion');
    expect(r1.states.C.mixedCheck).toEqual({ days: ['2026-10-10'], failsInRow: 1, failedDay: DAY });
    expect(r1.session.events.some((e) => e.kind === 'phase' && e.targetId === 'C')).toBe(false);
    expect(r1.states.S.mixedCheck).toEqual({ days: [DAY] });

    // следующий блок — снова провал: цель в обучение
    const day2 = '2026-10-13';
    const st2 = start({ ...states, S: r1.states.S, C: r1.states.C }, { sessionIndex: 21, day: day2 });
    expect(st2.mixedTargetIds).toEqual(['S', 'C']);
    const r = finishMixed(st2, failC);
    expect(r.states.C).toMatchObject({ phase: 'acquisition', sessionsAtCriterion: 0, criterionDays: [], maintenanceGapIndex: 0 });
    expect(r.states.C.mixedCheck).toBeUndefined();
    expect(r.states.C.masteredBy).toBeUndefined();
    // пробы переноса провал блока не обнуляет
    expect(r.states.C.generalizationProbes).toEqual([probe]);
    // 3 из 5 — с последнего успешного уровня
    expect(r.states.C.startPromptLevel).toBe(0);
    expect(r.states.S.phase).toBe('mastered');
    expect(r.states.S.mixedCheck).toEqual({ days: [DAY, day2], done: true });
    expect(r.session.events).toContainEqual(expect.objectContaining({ kind: 'phase', targetId: 'C', from: 'mastered', to: 'acquisition', reason: 'mixed_failed' }));

    // 0–2 из 5 — со старта первого уровня, несущего ответ
    const low = finishMixed(start({ ...states, C: r1.states.C }, { day: day2 }), (id, i) => (id === 'C' && i < 3 ? 'no_response' : 'independent'));
    expect(low.states.C.phase).toBe('acquisition');
    expect(low.states.C.startPromptLevel).toBeGreaterThan(0);

    // пока цель снова не освоена, блок не планируется — она учится обычным блоком
    const next = start({ ...bothMastered(), S: r.states.S, C: r.states.C }, { sessionIndex: 22, day: '2026-10-14' });
    expect(next.mixedTargetIds).toBeUndefined();
    expect(next.teachingTargetIds).toContain('C');
  });

  it('пройденный блок между провалами обнуляет счёт провалов', () => {
    const own = (r: AbaResponse[]) => r.map((response) => trial({ targetId: 'C', kind: 'verification', response, promptLevelUsed: 0 }));
    const fail = own(['incorrect', 'incorrect', 'independent', 'independent', 'independent']);
    const pass = own(['independent', 'independent', 'independent', 'independent', 'independent']);
    const once = mixedVerdict(masteredState(C), C, fail, 20, '2026-10-12')!;
    expect(once).toMatchObject({ reason: null, state: { phase: 'mastered', mixedCheck: { days: [], failsInRow: 1, failedDay: '2026-10-12' } } });
    const passed = mixedVerdict(once.state, C, pass, 21, '2026-10-13')!;
    expect(passed.state.mixedCheck).toEqual({ days: ['2026-10-13'] });
    expect(mixedVerdict(passed.state, C, fail, 22, '2026-10-14')?.state.phase).toBe('mastered');
  });

  it('зачёт и провал вперемешку не держат блок без конца: дни копятся до `done`', () => {
    const own = (r: AbaResponse[]) => r.map((response) => trial({ targetId: 'C', kind: 'verification', response, promptLevelUsed: 0 }));
    const fail = own(['incorrect', 'incorrect', 'independent', 'independent', 'independent']);
    const pass = own(['independent', 'independent', 'independent', 'independent', 'independent']);
    let s = masteredState(C);
    const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'];
    const answers = [pass, fail, pass, fail];
    let at = 0;
    for (; at < days.length && !s.mixedCheck?.done && s.phase !== 'acquisition'; at += 1) {
      s = mixedVerdict(s, C, answers[at], 20 + at, days[at])!.state;
    }
    // зачёт, провал, зачёт — освоено окончательно на третьем блоке
    expect(at).toBe(3);
    expect(s.mixedCheck).toEqual({ days: ['2026-10-12', '2026-10-14'], done: true });
  });

  it('повтор блока в день, уже засчитанный цели, её не судит: пробы пишутся, провала нет', () => {
    // S засчитан сегодня, C — нет (блок не дал по нему итога): блок снова в плане того же дня
    const states = { ...bothMastered(), S: { ...bothMastered().S, mixedCheck: { days: [DAY] } } };
    const st = start(states, { sessionIndex: 21 });
    expect(st.mixedTargetIds).toEqual(['S', 'C']);
    const r = finishMixed(st, (id) => (id === 'S' ? 'incorrect' : 'independent'));
    expect(r.states.S.phase).toBe('mastered');
    expect(r.states.S.mixedCheck).toEqual({ days: [DAY] });
    expect(r.trials.filter((t) => t.targetId === 'S' && t.kind === 'verification')).toHaveLength(5);
    expect(r.states.C.mixedCheck).toEqual({ days: [DAY] });
    expect(r.session.events.some((e) => e.kind === 'phase')).toBe(false);
    // и сам вердикт в засчитанный день — `null`
    const own = Array.from({ length: 5 }, () => trial({ targetId: 'S', kind: 'verification', response: 'incorrect', promptLevelUsed: 0 }));
    expect(mixedVerdict(states.S, S, own, 21, DAY)).toBeNull();
  });

  it('оборванный лимитом времени блок (меньше 5 проб цели) ничего не решает, сессия — в счёт «без итога»', () => {
    const st = start(bothMastered());
    const lastC = st.queue.reduce((at, q, i) => (q.kind === 'trial' && q.trial.targetId === 'C' ? i : at), -1);
    const r = finishMixed({ ...st, queue: st.queue.filter((_q, i) => i !== lastC) }, () => 'incorrect', DAY, { endReason: 'time_limit', events: st.events });
    expect(r.states.C.phase).toBe('mastered');
    // итога нет — сессия идёт в счёт «без итога» (потолок ревью 2026-11-18); S провален впервые — тоже без фазы
    expect(r.states.C.mixedCheck).toEqual({ days: [], noVerdict: 1 });
    expect(r.states.S.mixedCheck).toEqual({ days: [], failsInRow: 1, failedDay: DAY, noVerdict: 1 });
    expect(r.states.S.phase).toBe('mastered');
    // причина — в журнале сессии
    expect(r.session.events).toContainEqual({
      kind: 'measurement',
      at: expect.any(String),
      targetId: 'C',
      action: 'mixed_no_verdict',
      reason: 'time_limit',
      counted: true,
      targetIds: ['C'],
    });
  });

  it('причины без итога: отказ — в счёт; остановка взрослым, бездействие, сворачивание, ошибка — нейтральны', () => {
    const st = start(bothMastered());
    const lastC = st.queue.reduce((at, q, i) => (q.kind === 'trial' && q.trial.targetId === 'C' ? i : at), -1);
    const cut = { ...st, queue: st.queue.filter((_q, i) => i !== lastC) };
    const inactivity = { kind: 'assent' as const, at: new Date(BASE_MS + 500_000).toISOString(), by: 'device_inactivity' as const, action: 'end' as const };
    const cases = [
      { end: { endReason: 'assent_withdrawn' as const, events: st.events }, reason: 'assent_withdrawn', counted: true },
      { end: { endReason: 'adult_stopped' as const, events: st.events }, reason: 'adult_stopped', counted: false },
      { end: { endReason: 'assent_withdrawn' as const, events: [...st.events, inactivity] }, reason: 'device_inactivity', counted: false },
      { end: { endReason: 'app_backgrounded' as const, events: st.events }, reason: 'app_backgrounded', counted: false },
      { end: { endReason: 'app_error' as const, events: st.events }, reason: 'app_error', counted: false },
    ];
    for (const c of cases) {
      const r = finishMixed(cut, () => 'independent', DAY, c.end);
      const ev = r.session.events.find((e) => e.kind === 'measurement' && e.action === 'mixed_no_verdict');
      expect(ev).toMatchObject({ reason: c.reason, counted: c.counted });
      expect(r.states.C.mixedCheck?.noVerdict).toBe(c.counted ? 1 : undefined);
    }
  });

  it('нейтральная причина не считается и счёт «без итога» не сбрасывает — даже когда партнёр засчитан', () => {
    const one = { days: [], noVerdict: 1 };
    const states = { ...bothMastered(), S: { ...bothMastered().S, mixedCheck: one }, C: { ...bothMastered().C, mixedCheck: one } };
    const st = start(states);
    const lastC = st.queue.reduce((at, q, i) => (q.kind === 'trial' && q.trial.targetId === 'C' ? i : at), -1);
    const cut = { ...st, queue: st.queue.filter((_q, i) => i !== lastC) };
    const r = finishMixed(cut, () => 'independent', DAY, { endReason: 'adult_stopped', events: st.events });
    expect(r.states.S.mixedCheck).toEqual({ days: [DAY], noVerdict: 1 });
    expect(r.states.C.mixedCheck).toEqual(one);
    expect(r.states.C.flags).not.toContain('mixed_not_established');
    // та же сессия, оборванная отказом, — вторая подряд: блок снят, событие говорит об этом
    const refused = finishMixed(cut, () => 'independent', DAY, { endReason: 'assent_withdrawn', events: st.events });
    expect(refused.states.C.flags).toContain('mixed_not_established');
    expect(refused.session.events).toContainEqual(expect.objectContaining({ action: 'mixed_no_verdict', reason: 'assent_withdrawn', counted: true, dropped: true }));
  });

  it('провал за день — один: в день провала блок не планируется снова, повтор цель не судит и в счёт не идёт', () => {
    const failC = (id: string, i: number): AbaResponse => (id === 'C' && i < 2 ? 'incorrect' : 'independent');
    const r1 = finishMixed(start(bothMastered()), failC);
    expect(r1.states.C.mixedCheck).toEqual({ days: [], failsInRow: 1, failedDay: DAY });
    const after = { ...bothMastered(), S: r1.states.S, C: r1.states.C };
    // тот же день — блока нет, хотя C зачёта не имеет
    expect(start(after, { sessionIndex: 21 }).mixedTargetIds).toBeUndefined();
    // блок всё же прошёл в тот же день (план прежней версии) — второго провала нет, в обучение цель не идёт
    const st0 = start(bothMastered());
    const again = finishMixed({ ...st0, sessionIndex: 21, states: { ...st0.states, S: r1.states.S, C: r1.states.C } }, failC);
    expect(again.states.C).toMatchObject({ phase: 'mastered', mixedCheck: { days: [], failsInRow: 1, failedDay: DAY } });
    expect(again.session.events.some((e) => e.kind === 'phase' || e.kind === 'measurement')).toBe(false);
    expect(mixedVerdict(r1.states.C, C, again.trials.filter((t) => t.targetId === 'C'), 21, DAY)).toBeNull();
    // назавтра — блок снова в плане, второй провал подряд — в обучение
    const day2 = '2026-10-13';
    const st2 = start(after, { sessionIndex: 21, day: day2 });
    expect(st2.mixedTargetIds).toEqual(['S', 'C']);
    expect(finishMixed(st2, failC).states.C.phase).toBe('acquisition');
  });

  it('место замены промаха: самое позднее, где цель не идёт больше двух раз подряд; места нет — null', () => {
    expect(replacementSlot(['A', 'A'], [], 'A')).toBeNull();
    expect(replacementSlot(['B', 'A'], [], 'A')).toBe(0);
    expect(replacementSlot(['B', 'A'], ['A'], 'A')).toBeNull();
    expect(replacementSlot(['A'], ['B', 'A', 'A'], 'A')).toBe(0);
    expect(replacementSlot(['A'], ['A', 'B', 'B', 'A'], 'A')).toBe(4);
    expect(replacementSlot(['B', 'A'], ['B', 'A', 'A', 'B', 'B'], 'A')).toBe(5);
    // любая раскладка блока × любой промах: замена не даёт трёх подряд и стоит как можно позже
    let replaced = 0;
    for (let seed = 1; seed <= 60; seed += 1) {
      const items = ['S', 'C'].flatMap((targetId) => Array.from({ length: 5 }, () => ({ targetId })));
      const seq = arrange(items, seeded(seed).rng).map((x) => x.targetId);
      for (let k = 0; k < seq.length; k += 1) {
        const shown = seq.slice(0, k + 1);
        const ahead = seq.slice(k + 1);
        const withAt = (p: number) => [...shown, ...ahead.slice(0, p), seq[k], ...ahead.slice(p)];
        const slot = replacementSlot(shown, ahead, seq[k]);
        for (let p = ahead.length; p > (slot ?? -1); p -= 1) expect(longestRun(withAt(p))).toBeGreaterThan(2);
        if (slot !== null) {
          expect(longestRun(withAt(slot))).toBeLessThanOrEqual(2);
          replaced += 1;
        }
      }
    }
    // место почти всегда есть
    expect(replaced).toBeGreaterThan(60 * 10 * 0.8);
  });

  it('блок не начался (сессия кончилась раньше) — сессия для счётчика «без итога» нейтральна', () => {
    const st = start(bothMastered());
    const r = finishSession({ ...st, trials: [], queue: [], endReason: 'assent_withdrawn' }, BASE_MS + 600_000);
    expect(r.states.S?.mixedCheck).toBeUndefined();
    expect(r.states.C?.mixedCheck).toBeUndefined();
  });

  it('ошибки подряд в блоке не обрывают сессию срывом — это измерение, а не обучение', () => {
    const t: AbaTarget = S;
    const own = Array.from({ length: 5 }, () => trial({ targetId: t.id, kind: 'verification', response: 'incorrect', promptLevelUsed: 0 }));
    expect(isBreakdown(own, t.id)).toBe(false);
    expect(mixedVerdict(masteredState(t), t, own, 20, DAY)?.reason).toBeNull();
    expect(mixedVerdict({ ...masteredState(t), mixedCheck: { days: [], failsInRow: 1 } }, t, own, 20, DAY)?.reason).toBe('mixed_failed');
  });

  it('3 из 5 у освоенной по базовой линии — не с полной модели: не выше первого уровня, несущего ответ', () => {
    // формат, где первый уровень, несущий ответ, ниже полной модели (у `match` и подражания это и есть L3)
    const V = tgt('V', { format: 'voice_volume' });
    const fromBaseline: AbaTargetState = {
      ...masteredState(V),
      masteredBy: 'baseline',
      startPromptLevel: 3,
      lastSuccessfulPromptLevel: 3,
      mixedCheck: { days: [], failsInRow: 1 },
    };
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

  it('первый промах наблюдения заменяется пробой блока с другим экземпляром в конце блока — итог есть', () => {
    const r = runReal(allMastered(), '2026-11-18', 1, (id, n) => (id === SHAPE.id && n === 1 ? 'none' : 'correct'));
    expect(r.final.trials.some((t) => t.kind === 'baseline')).toBe(false);
    const shape = r.final.trials.filter((t) => t.kind === 'verification' && t.targetId === SHAPE.id);
    expect(shape).toHaveLength(6);
    const missed = shape[1];
    expect(missed.observingLatencyMs).toBeNull();
    const replacement = shape[5];
    expect(replacement.replacesTrialId).toBe(missed.id);
    expect(replacement.exemplarId).not.toBe(missed.exemplarId);
    // в конце блока: после неё проб блока нет
    const mixed = r.final.trials.filter((t) => t.kind === 'verification');
    expect(mixed.at(-1)?.id).toBe(replacement.id);
    expect(r.result.states[SHAPE.id].mixedCheck).toEqual({ days: ['2026-11-18'] });
    expect(r.result.states[SHAPE.id].phase).not.toBe('acquisition');
  });

  it('промах на последней пробе блока — замена сразу за ней, до конца блока', () => {
    const last = (r: ReturnType<typeof runReal>) => r.planned.queue.flatMap((q) => (q.kind === 'trial' && q.trial.kind === 'verification' ? [q.trial] : [])).at(-1)!;
    const plan = runReal(allMastered(), '2026-11-18', 1, () => 'correct');
    const lastId = last(plan).targetId;
    const r = runReal(allMastered(), '2026-11-18', 1, (id, n) => (id === lastId && n === 4 ? 'none' : 'correct'));
    const mixed = r.final.trials.filter((t) => t.kind === 'verification');
    expect(mixed).toHaveLength(11);
    expect(mixed[10]).toMatchObject({ targetId: lastId, replacesTrialId: mixed[9].id });
    expect(mixed[10].exemplarId).not.toBe(mixed[9].exemplarId);
    for (const id of PAIR) expect(r.result.states[id].mixedCheck).toEqual({ days: ['2026-11-18'] });
  });

  it('замена через настоящую сессию: любой промах, любое зерно — цель не идёт больше двух раз подряд', () => {
    let moved = 0;
    let skipped = 0;
    for (const index of [1, 2, 3, 4, 5, 6]) {
      for (const id of PAIR) {
        for (let n = 0; n < 5; n += 1) {
          const r = runReal(allMastered(), '2026-11-18', index, (t, k) => (t === id && k === n ? 'none' : 'correct'));
          const mixed = r.final.trials.filter((t) => t.kind === 'verification');
          expect(longestRun(mixed.map((t) => t.targetId))).toBeLessThanOrEqual(2);
          const replacement = mixed.find((t) => t.replacesTrialId);
          if (replacement) {
            if (mixed.at(-1)?.id !== replacement.id) moved += 1;
            expect(r.result.states[id].mixedCheck?.days).toEqual(['2026-11-18']);
          } else {
            // места нет — замены нет, блок без итога по промаху наблюдения (в счёт)
            skipped += 1;
            expect(r.result.session.events).toContainEqual(expect.objectContaining({ action: 'mixed_no_verdict', reason: 'observing_miss', counted: true }));
          }
        }
      }
    }
    // предусловие: были и замены не в самом конце блока (там вышла бы третья подряд)
    expect(moved).toBeGreaterThan(0);
    expect(skipped).toBeLessThan(6 * 2 * 5);
  });

  it('второй промах цели не заменяется; две сессии подряд без итога — блок снят с плана, флаг специалисту', () => {
    const color = PAIR.find((id) => id !== SHAPE.id)!;
    const twoMisses = (id: string, n: number): Act => (id === SHAPE.id && (n === 1 || n === 2) ? 'none' : 'correct');
    const d1 = runReal(allMastered(), '2026-11-18', 1, twoMisses);
    expect(d1.final.trials.filter((t) => t.targetId === SHAPE.id && t.replacesTrialId)).toHaveLength(1);
    // у формы 4 засчитываемых пробы — итога нет; цвет засчитан
    expect(d1.result.states[SHAPE.id].mixedCheck).toEqual({ days: [], noVerdict: 1 });
    expect(d1.result.states[color].mixedCheck).toEqual({ days: ['2026-11-18'], noVerdict: 1 });
    expect(d1.result.states[SHAPE.id].phase).not.toBe('acquisition');
    expect(d1.result.session.events).toContainEqual(
      expect.objectContaining({ kind: 'measurement', action: 'mixed_no_verdict', reason: 'observing_miss', counted: true, targetIds: [SHAPE.id] }),
    );

    const d2 = runReal(d1.states, '2026-11-19', 2, twoMisses);
    expect(d2.result.session.events).toContainEqual(expect.objectContaining({ action: 'mixed_no_verdict', reason: 'observing_miss', dropped: true }));
    expect(d2.planned.mixedTargetIds).toEqual(PAIR);
    for (const id of PAIR) expect(d2.result.states[id].flags).toContain('mixed_not_established');
    expect(d2.result.states[SHAPE.id].mixedCheck).toEqual({ days: [] });
    expect(d2.result.states[color].mixedCheck).toEqual({ days: ['2026-11-18', '2026-11-19'], done: true });

    // третья сессия: блока нет, занятие идёт обычным порядком
    const d3 = runReal(d2.states, '2026-11-20', 3, () => 'correct');
    expect(d3.planned.mixedTargetIds).toBeUndefined();
    expect(d3.final.trials.some((t) => t.kind === 'verification')).toBe(false);
    expect(d3.final.trials.length).toBeGreaterThan(0);
  });

  it('сессия с итогом по всем участникам снимает счётчик «без итога»', () => {
    const d1 = runReal(allMastered(), '2026-11-18', 1, (id, n) => (id === SHAPE.id && (n === 1 || n === 2) ? 'none' : 'correct'));
    const d2 = runReal(d1.states, '2026-11-19', 2, () => 'correct');
    expect(d2.result.states[SHAPE.id].mixedCheck).toEqual({ days: ['2026-11-19'] });
    expect(d2.result.states[SHAPE.id].flags).not.toContain('mixed_not_established');
  });

  it('ошибки по цвету — первый блок: цвет освоен, дни заново; второй подряд — в обучение, форма остаётся освоенной', () => {
    const color = PAIR.find((id) => id !== SHAPE.id)!;
    const failColor = (id: string, n: number): Act => (id === color && n < 2 ? 'incorrect' : 'correct');
    const d1 = runReal(allMastered(), '2026-11-18', 1, failColor);
    expect(d1.result.states[color].phase).not.toBe('acquisition');
    expect(d1.result.states[color].mixedCheck).toEqual({ days: [], failsInRow: 1, failedDay: '2026-11-18' });
    expect(d1.result.states[color].masteredBy).toBe('criterion');
    expect(d1.result.states[SHAPE.id].mixedCheck).toEqual({ days: ['2026-11-18'] });
    const d2 = runReal(d1.states, '2026-11-19', 2, failColor);
    expect(d2.result.states[color].phase).toBe('acquisition');
    expect(d2.result.states[SHAPE.id].mixedCheck).toEqual({ days: ['2026-11-18', '2026-11-19'], done: true });
  });

  it('родителю «всё освоено» — только после смешанного блока', () => {
    const states = allMastered();
    const plan = startAbaSession({
      sessionId: 'p',
      sessionIndex: 1,
      day: '2026-11-18',
      config: 'with_adult',
      band: '5-6',
      targets: REAL,
      states,
      reinforcerPool: POOL,
      reinforcerApart: [],
      reinforcerHistory: [],
      tokenTraining: trained(5),
      startedAt: T0,
      seed: 1,
    });
    const ids = REAL.map((t) => t.id);
    expect(plan.mixedTargetIds).toEqual(PAIR);
    expect(stageOfPlan(plan, states, ids).kind).not.toBe('all_mastered');
    const done = Object.fromEntries(
      Object.entries(states).map(([id, s]) => [id, PAIR.includes(id) ? { ...s, mixedCheck: { days: ['a', 'b'], done: true as const } } : s]),
    );
    expect(mixedGroupDue(mixGroups(REAL), done, '2026-11-18', () => true)).toBeNull();
    expect(stageOfPlan({ ...plan, mixedTargetIds: undefined }, done, ids)).toEqual({ kind: 'all_mastered' });
  });
});
