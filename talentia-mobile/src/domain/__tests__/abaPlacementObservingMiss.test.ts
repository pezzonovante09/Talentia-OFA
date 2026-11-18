/**
 * Дефект с телефона 2026-11-15 и решение методиста 1 (ABA.md, 2026-11-18, №205), срез А. Первое занятие проверки
 * «что уже умеет» (сверху вниз, нужно 100%): на третьей пробе ребёнок не коснулся образца — в `match` варианты
 * неактивны до касания образца, проба кончается `no_response` с `observingLatencyMs === null` (промах наблюдения).
 *
 * Целевое поведение: промах наблюдения — не провал. Первый на цель за сессию заменяется пробой базовой линии с другим
 * экземпляром (`replacesTrialId`); второй закрывает измерение цели без итога (`placementTriedAt` не ставится, та же
 * вершина — в следующий раз). Две сессии подряд, закрытые вторым промахом: проверка — вся лестница снизу вверх,
 * обычная базовая линия — обучение со старта L1; событие `measurement` / `observing_not_established`. В поддержании
 * промахи наблюдения ничего не измеряют.
 *
 * Харнесс — как в `abaParentStage.test.ts`: настоящие цели ABA, полоса 5–6, «Со взрослым», пробы через модель экрана.
 */
import { ABA_TARGETS, readyAbaTargets } from '../../content/aba';
import { DEV_PLACEHOLDER_ART } from '../../services/local/abaStart';
import type { AbaTargetState, AbaTrial } from '../../types/aba';
import { matchDueAt, matchTrialInput, optionActive, startMatchTrial, stepMatchTrial, type MatchTrialRun } from '../../ui/aba/model/matchTrialRun';
import { applyBaseline, isBaselineCountable } from '../abaCriterion';
import { stageOfPlan, type ParentStage } from '../abaParentStage';
import { ladderBelow, ladderOf, placementPassed } from '../abaPlacement';
import {
  accessShown,
  chooseReinforcer,
  finishAbaSession,
  finishAccess,
  finishBreak,
  nextStep,
  recordTrial,
  NEUTRAL_PAUSE_MS,
  startAbaSession,
  type AbaSessionResult,
  type AbaSessionState,
  type StartInput,
  type TrialStep,
} from '../abaSession';
import { targetForBand } from '../abaTargetRules';
import { initialTokenTraining, type TokenTrainingState } from '../abaTokenTraining';

type Act = 'correct' | 'none' | 'incorrect';

const POOL = ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'];
const T0 = Date.UTC(2026, 10, 15, 6);
const TARGETS = readyAbaTargets(ABA_TARGETS, DEV_PLACEHOLDER_ART).map((t) => targetForBand(t, '5-6'));
const IDS = TARGETS.map((t) => t.id);

/** «Верно» — образец и такая же карточка; «неверно» — образец и другая; «нет ответа» — окна истекают без единого касания. */
function runTrial(r0: MatchTrialRun, act: Act, at0: number): { r: MatchTrialRun; at: number } {
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

type Child = {
  states: Record<string, AbaTargetState>;
  tokenTraining: TokenTrainingState;
  board?: StartInput['board'];
  identifySets: StartInput['identifySets'];
  index: number;
  now: number;
};

/** После знакомства: доска на ступени 1, ни одной цели не трогали. */
const freshChild = (): Child => ({ states: {}, tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 1 }, identifySets: [], index: 0, now: T0 });

const inputOf = (c: Child, seed: number): StartInput => ({
  sessionId: `s${c.index}`,
  sessionIndex: c.index,
  day: '2026-11-15',
  config: 'with_adult',
  band: '5-6',
  targets: TARGETS,
  states: c.states,
  reinforcerPool: POOL,
  reinforcerApart: [],
  reinforcerHistory: [],
  tokenTraining: c.tokenTraining,
  startedAt: c.now,
  seed,
  ...(c.board ? { board: c.board } : {}),
  identifySets: c.identifySets,
  physicalPromptAllowed: false,
  autoPlacement: true,
  observers: [{ id: 'o1', role: 'parent', trained: false }],
  primaryObserverId: 'o1',
});

/** Этап следующего занятия, как на экране родителя: план вхолостую. */
const stageOf = (c: Child): ParentStage => {
  const input = inputOf(c, 1);
  return stageOfPlan(startAbaSession(input), input.states, IDS);
};

type Run = {
  child: Child;
  result: AbaSessionResult;
  trials: AbaTrial[];
  planned: AbaSessionState;
  /** Состояние сразу после каждой пробы «нет ответа». */
  afterMisses: AbaSessionState[];
  final: AbaSessionState;
};

/** Ответ на пробу: шаг и её номер среди проб того же вида той же цели в занятии (с нуля). */
type Policy = (step: TrialStep, n: number) => Act;

/** Одно занятие до конца: пробы — по `policy`, высоковероятные и завершающие — верно. */
function runSession(c: Child, policy: Policy): Run {
  let now = c.now + 3 * 3600_000;
  let st = startAbaSession(inputOf({ ...c, now }, 1000 + c.index));
  const planned = st;
  let seq = 0;
  const afterMisses: AbaSessionState[] = [];
  const seen = new Map<string, number>();
  for (let guard = 0; guard < 400; guard += 1) {
    const next = nextStep(st, now);
    st = next.state;
    const step = next.step;
    if (step.kind === 'choose_reinforcer') st = chooseReinforcer(st, step.options[0], now, 'child');
    else if (step.kind === 'break') {
      now += 60_000;
      st = finishBreak(st, now).state;
    } else if (step.kind === 'access') {
      st = accessShown(st);
      now += step.durationMs;
      st = finishAccess(st, now);
    } else if (step.kind === 'end') break;
    else if (step.kind === 'adult_finish_chain') throw new Error('цепочек в match нет');
    else {
      const key = `${step.targetId}|${step.trialKind}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      const act = step.trialKind === 'high_p' || step.trialKind === 'closing' ? 'correct' : policy(step, n);
      const run = startMatchTrial({ step, target: st.targets[step.targetId], config: 'with_adult', seed: st.seed, trialId: `t${(seq += 1)}`, sessionId: st.sessionId, index: st.trials.length, shownAt: now });
      const done = runTrial(run, act, now);
      now = done.at + 200;
      const res = recordTrial(st, matchTrialInput(done.r), now);
      if (!res.ok) throw new Error(res.errors.join('; '));
      st = res.state;
      if (act === 'none') afterMisses.push(st);
      now += 5000;
    }
  }
  const result = finishAbaSession(st, now, {}, undefined, undefined, { routineExchangeInWindow: false });
  const child: Child = {
    states: { ...c.states, ...result.states },
    tokenTraining: result.tokenTraining,
    board: { earned: result.board.earned, nonContingent: result.board.nonContingent, ...(result.board.returned ? { returned: result.board.returned } : {}) },
    identifySets: result.identifySets,
    index: c.index + 1,
    now,
  };
  return { child, result, trials: st.trials, planned, afterMisses, final: st };
}


const allCorrect: Policy = () => 'correct';
const TOP = 'match-shape';
const isTop = (s: TrialStep) => s.targetId === TOP && s.trialKind === 'baseline';
/** Телефон: две верные, с третьей пробы проверки — образца не касается (и замену тоже). */
const phoneMiss: Policy = (s, n) => (isTop(s) && n >= 2 ? 'none' : 'correct');
/** Один промах наблюдения на третьей пробе проверки, остальное верно. */
const oneMiss: Policy = (s, n) => (isTop(s) && n === 2 ? 'none' : 'correct');
/** Промах наблюдения на последней пробе проверки (остатка нет). */
const lastMiss = (last: number): Policy => (s, n) => (isTop(s) && n === last ? 'none' : 'correct');

/** Этапы занятий 1..n после первого (по `first` в первом, дальше всё верно). */
function path(first: Policy, n: number): ParentStage[] {
  let c = runSession(freshChild(), first).child;
  const out: ParentStage[] = [stageOf(c)];
  for (let i = 1; i < n; i += 1) {
    c = runSession(c, allCorrect).child;
    out.push(stageOf(c));
  }
  return out;
}

/** Сколько проб базовой линии цели осталось в очереди. */
const baselineLeft = (st: AbaSessionState, id: string) =>
  st.queue.filter((q) => q.kind === 'trial' && q.trial.kind === 'baseline' && q.trial.targetId === id).length;
const baselineOf = (trials: AbaTrial[], id: string) => trials.filter((t) => t.targetId === id && t.kind === 'baseline');
const TARGET = (id: string) => TARGETS.find((t) => t.id === id)!;
const placementEvents = (r: Run) => r.result.session.events.filter((e) => e.kind === 'placement');

describe('телефон: на третьей пробе проверки образца не коснулись и дальше не касается', () => {
  const first = runSession(freshChild(), phoneMiss);
  const missed = baselineOf(first.trials, TOP);

  it('первое занятие после обучения доске — проверка match-shape сверху вниз', () => {
    expect(first.planned.placementTargetIds).toEqual([TOP]);
  });

  it('проба без касания образца — промах наблюдения: no_response, observingLatencyMs === null', () => {
    expect([missed[2].response, missed[2].observingLatencyMs]).toEqual(['no_response', null]);
  });

  it('первый промах не снимает проверку: остаток на месте и ещё одна проба взамен', () => {
    expect(baselineLeft(first.afterMisses[0], TOP)).toBe(baselineLeft(first.planned, TOP) - 3 + 1);
  });

  it('замена — та же цель, другой экземпляр, ссылка на промах; сразу за остатком блока (высоковероятных ещё нет)', () => {
    const q = first.afterMisses[0].queue;
    const i = q.findIndex((x) => x.kind === 'trial' && x.trial.replacesTrialId === missed[2].id);
    const item = q[i];
    if (item?.kind !== 'trial') throw new Error('замены нет в очереди');
    expect([item.trial.kind, item.trial.targetId]).toEqual(['baseline', TOP]);
    expect(item.trial.exemplarId).not.toBe(missed[2].exemplarId);
    const restAfter = q.slice(i + 1).filter((x) => x.kind === 'trial' && x.trial.kind === 'baseline' && x.trial.targetId === TOP);
    expect(restAfter).toEqual([]);
    expect(first.afterMisses[0].highPTargetIds).toEqual([]);
    expect(q[i - 1]).toMatchObject({ kind: 'trial', trial: { kind: 'baseline', targetId: TOP } });
  });

  it('второй промах — проверка закрыта без итога, второй замены нет', () => {
    expect(baselineLeft(first.afterMisses[1], TOP)).toBe(0);
    expect(missed).toHaveLength(4);
  });

  it('два промаха подряд — не срыв: занятие не закрыто по breakdown', () => {
    expect(first.final.endReason).not.toBe('breakdown');
  });

  it('итога нет: события placement нет, placementTriedAt не ставится, счётчик сессий без итога = 1', () => {
    expect(placementEvents(first)).toEqual([]);
    const s = first.child.states[TOP];
    expect([s.phase, s.placementTriedAt, s.observingMissSessions]).toEqual(['baseline', undefined, 1]);
  });

  it('ничего ниже по лестнице не отмечено и не выведено', () => {
    for (const x of ladderOf(TARGET(TOP), TARGETS).filter((y) => y.id !== TOP)) {
      expect([first.child.states[x.id]?.phase ?? 'baseline', first.child.states[x.id]?.placementTriedAt]).toEqual(['baseline', undefined]);
    }
  });

  // цвет из 3 (решение методиста 40): поле 3 осваивается по базовой линии — при «всё верно» обучения нет вовсе
  // за ним — смешанный блок формы и цвета (решение методиста 43): «всё освоено» только после него
  it('контроль: при «всё верно» следующее занятие — первые пробы цвета из трёх, за ним — повторение вперемешку', () => {
    expect(path(allCorrect, 2)).toEqual([
      { kind: 'baseline', targetId: 'match-color-3' },
      { kind: 'maintenance', targetIds: ['match-shape', 'match-color-3'] },
    ]);
  });

  it('путь не откатывается: следующим — снова проверка той же вершины, дальше как при «всё верно» со сдвигом на одно занятие', () => {
    expect(path(phoneMiss, 3)).toEqual([
      { kind: 'placement', targetId: TOP },
      { kind: 'baseline', targetId: 'match-color-3' },
      { kind: 'maintenance', targetIds: ['match-shape', 'match-color-3'] },
    ]);
  });
});

describe('один промах наблюдения на проверке — замена и итог по остальным', () => {
  const run = runSession(freshChild(), oneMiss);
  const trials = baselineOf(run.trials, TOP);

  it('проб на одну больше плана, промах — один, замена с другим экземпляром записана с replacesTrialId', () => {
    expect(trials).toHaveLength(baselineLeft(run.planned, TOP) + 1);
    expect(trials.filter((t) => t.observingLatencyMs === null)).toHaveLength(1);
    const repl = trials.filter((t) => t.replacesTrialId !== undefined);
    expect(repl.map((t) => t.replacesTrialId)).toEqual([trials[2].id]);
    expect(repl[0].exemplarId).not.toBe(trials[2].exemplarId);
  });

  it('проверка прошла: цель освоена, счётчика нет', () => {
    expect(placementEvents(run)).toEqual([expect.objectContaining({ targetId: TOP, passed: true })]);
    expect([run.child.states[TOP].phase, run.child.states[TOP].observingMissSessions]).toEqual(['mastered', undefined]);
  });

  it('промах на последней пробе (остатка нет) — замена перед следующей пробой, с нейтральной паузой; проверка прошла', () => {
    const last = baselineLeft(runSession(freshChild(), allCorrect).planned, TOP) - 1;
    const r = runSession(freshChild(), lastMiss(last));
    const q = r.afterMisses[0].queue;
    const firstTrial = q.findIndex((x) => x.kind === 'trial');
    expect(q[firstTrial]).toMatchObject({ kind: 'trial', trial: { kind: 'baseline', targetId: TOP, pauseBeforeMs: NEUTRAL_PAUSE_MS } });
    expect(q.slice(0, firstTrial).every((x) => x.kind !== 'trial')).toBe(true);
    expect(baselineOf(r.trials, TOP)).toHaveLength(last + 2);
    expect(placementEvents(r)).toEqual([expect.objectContaining({ targetId: TOP, passed: true })]);
  });

  it('контроль: настоящая ошибка на той же пробе — проверка не прошла, placementTriedAt ставится', () => {
    const r = runSession(freshChild(), (s, n) => (isTop(s) && n === 2 ? 'incorrect' : 'correct'));
    expect(placementEvents(r)).toEqual([expect.objectContaining({ targetId: TOP, passed: false })]);
    expect(r.child.states[TOP].placementTriedAt).toBe(0);
  });
});

describe('две сессии подряд без итога из-за промахов — лестница снизу вверх', () => {
  const s1 = runSession(freshChild(), phoneMiss);
  const s2 = runSession(s1.child, phoneMiss);
  const ladder = ladderOf(TARGET(TOP), TARGETS);

  it('вторая сессия — снова проверка той же вершины', () => {
    expect(s2.planned.placementTargetIds).toEqual([TOP]);
  });

  it('после второй: placementTriedAt = индекс сессии у всей лестницы, ни одного «не прошла»', () => {
    expect(ladder.length).toBeGreaterThan(1);
    expect(ladder.map((x) => [x.id, s2.child.states[x.id]?.placementTriedAt])).toEqual(ladder.map((x) => [x.id, 1]));
    expect(placementEvents(s2)).toEqual([]);
  });

  it('событие measurement: внимание к образцу не установлено, проверка снята со всей лестницы; счётчик сброшен', () => {
    const ev = s2.result.session.events.filter((e) => e.kind === 'measurement');
    expect(ev).toEqual([expect.objectContaining({ targetId: TOP, action: 'observing_not_established', then: 'placement_dropped' })]);
    expect(ev[0].kind === 'measurement' && ev[0].action === 'observing_not_established' && [...ev[0].targetIds].sort()).toEqual(ladder.map((x) => x.id).sort());
    expect(s2.child.states[TOP].observingMissSessions).toBeUndefined();
  });

  it('после первой сессии события measurement нет', () => {
    expect(s1.result.session.events.filter((e) => e.kind === 'measurement')).toEqual([]);
  });

  it('следующая сессия без проверки сверху вниз, этап — базовая линия нижней цели лестницы', () => {
    const plan = startAbaSession(inputOf(s2.child, 1));
    expect(plan.placementTargetIds).toEqual([]);
    const bottom = ladder.find((x) => !(x.prerequisiteTargetIds ?? []).some((id) => ladder.some((y) => y.id === id)))!;
    expect(stageOf(s2.child)).toEqual({ kind: 'baseline', targetId: bottom.id });
  });

  it('проверка с итогом между ними обнуляет счётчик: успех', () => {
    const ok = runSession(s1.child, allCorrect);
    expect([ok.child.states[TOP].phase, ok.child.states[TOP].observingMissSessions]).toEqual(['mastered', undefined]);
  });

  it('проверка с итогом между ними обнуляет счётчик: настоящий провал', () => {
    const bad = runSession(s1.child, (s, n) => (isTop(s) && n === 0 ? 'incorrect' : 'correct'));
    const st = bad.child.states[TOP];
    expect([st.placementTriedAt, st.observingMissSessions]).toEqual([1, undefined]);
  });
});

describe('обычная базовая линия: промах наблюдения не понижает старт', () => {
  const placed = runSession(freshChild(), allCorrect).child;
  const COLOR = 'match-color-3';
  const isColor = (s: TrialStep) => s.targetId === COLOR && s.trialKind === 'baseline';
  const control = runSession(placed, allCorrect);
  const missed = runSession(placed, (s, n) => (isColor(s) && n === 0 ? 'none' : 'correct'));
  const twice = runSession(placed, (s, n) => (isColor(s) && n <= 1 ? 'none' : 'correct'));
  const wrong = runSession(placed, (s, n) => (isColor(s) && n === 0 ? 'incorrect' : 'correct'));
  const pick = (s: AbaTargetState) => [s.phase, s.startPromptLevel];

  it('предусловие: match-color-3 — обычная базовая линия, не проверка', () => {
    expect(control.planned.baselineTargetIds).toContain(COLOR);
    expect(control.planned.placementTargetIds).not.toContain(COLOR);
  });

  it('один промах — заменён, итог как при «всё верно», счётчик не растёт', () => {
    expect(baselineOf(missed.trials, COLOR)).toHaveLength(baselineOf(control.trials, COLOR).length + 1);
    expect(pick(missed.child.states[COLOR])).toEqual(pick(control.child.states[COLOR]));
    expect(missed.child.states[COLOR].observingMissSessions).toBeUndefined();
  });

  it('замена в конце блока цели, перед ней — высоковероятная', () => {
    const st = missed.afterMisses[0];
    const first0 = baselineOf(missed.trials, COLOR)[0];
    const i = st.queue.findIndex((x) => x.kind === 'trial' && x.trial.replacesTrialId === first0.id);
    expect(st.highPTargetIds.length).toBeGreaterThan(0);
    expect(i).toBeGreaterThan(0);
    expect(st.queue[i - 1]).toMatchObject({ kind: 'trial', trial: { kind: 'high_p' } });
    expect(st.queue.slice(i + 1).some((x) => x.kind === 'trial' && x.trial.kind === 'baseline' && x.trial.targetId === COLOR)).toBe(false);
  });

  it('второй промах подряд — не заменяется и снимает остаток базовой линии цели', () => {
    expect(baselineOf(twice.trials, COLOR).map((t) => t.observingLatencyMs)).toEqual([null, null]);
    expect(baselineLeft(twice.afterMisses[1], COLOR)).toBe(0);
  });

  it('измерение закрыто вторым промахом: базовая линия без итога, счётчик = 1, события нет', () => {
    const st = twice.child.states[COLOR];
    expect([st.phase, st.observingMissSessions]).toEqual(['baseline', 1]);
    expect(twice.result.session.events.filter((e) => e.kind === 'measurement')).toEqual([]);
  });

  it('две такие сессии подряд — обучение со старта L1, событие teaching_from_l1, счётчик сброшен', () => {
    const again = runSession(twice.child, (s, n) => (isColor(s) && n <= 1 ? 'none' : 'correct'));
    const st = again.child.states[COLOR];
    expect([st.phase, st.startPromptLevel, st.observingMissSessions]).toEqual(['acquisition', 1, undefined]);
    expect(again.result.session.events.filter((e) => e.kind === 'measurement')).toEqual([
      expect.objectContaining({ targetId: COLOR, action: 'observing_not_established', then: 'teaching_from_l1', targetIds: [COLOR] }),
    ]);
  });

  it('базовая линия с итогом между ними сбрасывает счётчик', () => {
    const done = runSession(twice.child, allCorrect);
    expect(done.child.states[COLOR].phase).not.toBe('baseline');
    expect(done.child.states[COLOR].observingMissSessions).toBeUndefined();
  });

  it('контроль: настоящая ошибка меняет итог базовой линии', () => {
    expect(pick(wrong.child.states[COLOR])).not.toEqual(pick(control.child.states[COLOR]));
  });

  it('applyBaseline, isBaselineCountable, placementPassed не видят промаха наблюдения', () => {
    const all = baselineOf(missed.trials, COLOR);
    const miss = all.find((t) => t.observingLatencyMs === null)!;
    expect(isBaselineCountable(miss)).toBe(false);
    const rest = all.filter((t) => t !== miss);
    const s0 = placed.states[COLOR];
    expect(applyBaseline(s0, all, 1, TARGET(COLOR), 'with_adult')).toEqual(applyBaseline(s0, rest, 1, TARGET(COLOR), 'with_adult'));
    expect(placementPassed(TARGET(COLOR), all)).toBe(placementPassed(TARGET(COLOR), rest));
  });
});

describe('поддержание выведенной цели: промах наблюдения — не провал', () => {
  const placed = runSession(freshChild(), allCorrect).child;
  const inferred = ladderBelow(TARGET(TOP), TARGETS)
    .map((x) => x.id)
    .filter((id) => placed.states[id]?.masteredBy === 'inferred');
  const isMaint = (s: TrialStep) => s.trialKind === 'maintenance' && inferred.includes(s.targetId);
  const missed = runSession(placed, (s) => (isMaint(s) ? 'none' : 'correct'));
  const wrong = runSession(placed, (s) => (isMaint(s) ? 'incorrect' : 'correct'));
  const probed = missed.trials.filter((t) => t.kind === 'maintenance' && inferred.includes(t.targetId));

  it('предусловие: есть выведенные цели и их пробы поддержания, все — промахи наблюдения', () => {
    expect(inferred.length).toBeGreaterThan(0);
    expect(probed.length).toBeGreaterThan(0);
    expect(probed.every((t) => t.response === 'no_response' && t.observingLatencyMs === null)).toBe(true);
  });

  it('фаза не меняется, события inferred_not_confirmed нет', () => {
    for (const t of probed) expect(missed.child.states[t.targetId].phase).toBe(placed.states[t.targetId].phase);
    expect(missed.result.session.events.filter((e) => e.kind === 'phase' && e.reason === 'inferred_not_confirmed')).toEqual([]);
  });

  it('контроль: настоящая ошибка возвращает выведенную цель на базовую линию', () => {
    const t = wrong.trials.find((x) => x.kind === 'maintenance' && inferred.includes(x.targetId))!;
    expect(wrong.child.states[t.targetId].phase).toBe('baseline');
  });
});
