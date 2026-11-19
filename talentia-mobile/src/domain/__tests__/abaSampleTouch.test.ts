/**
 * Шаг «коснись картинки» (решение 1, часть В; `docs/aba-center/specialist-and-touch-spec-2026-11-18.md`, раздел А):
 * план (только «Со взрослым», до первой пробы `match`; в «Сам» без пройденного шага `match` нет), прохождение — 5
 * самостоятельных подряд, не больше 10 проб за сессию, флаг после 3 сессий, «бесплатные» обмены и нейтральная для
 * ступени сессия только с касаниями, возврат к шагу вторым промахом наблюдения (срез А).
 *
 * Харнесс — как в `abaPlacementObservingMiss.test.ts`: настоящие цели ABA, полоса 5–6, пробы через модели экрана.
 */
import { ABA_TARGETS, readyAbaTargets } from '../../content/aba';
import { DEV_PLACEHOLDER_ART } from '../../services/local/abaStart';
import { REFUSAL_CARD_OFFER_MS, REFUSAL_QUIET_MS, type AbaSessionEvent, type AbaTargetState } from '../../types/aba';
import { matchDueAt, matchTrialInput, optionActive, startMatchTrial, stepMatchTrial, type MatchTrialRun } from '../../ui/aba/model/matchTrialRun';
import { sampleTouchDueAt, sampleTouchInput, startSampleTouch, stepSampleTouch, touchModelDelayMs, type SampleTouchRun } from '../../ui/aba/model/sampleTouchRun';
import { abaSampleTouch } from '../../design/abaTokens';
import { stageOfPlan } from '../abaParentStage';
import {
  closeSampleTouchSession,
  fadeSampleTouch,
  initialSampleTouch,
  reviewSampleTouchAssentConcern,
  SAMPLE_TOUCH_MAX_TRIALS,
  SAMPLE_TOUCH_SESSIONS_BEFORE_FLAG,
  SAMPLE_TOUCH_STREAK,
  type SampleTouchState,
} from '../abaSampleTouch';
import {
  accessShown,
  chooseReinforcer,
  finishAbaSession,
  finishAccess,
  finishBreak,
  nextStep,
  recordSampleTouch,
  recordTrial,
  requestBreakBetweenTrials,
  startAbaSession,
  stopSession,
  type AbaSessionResult,
  type AbaSessionState,
  type StartInput,
  type TrialStep,
} from '../abaSession';
import { targetForBand } from '../abaTargetRules';
import { initialTokenTraining, type TokenTrainingState } from '../abaTokenTraining';

const POOL = ['puzzle', 'bubbles', 'drum', 'paint_drop', 'kaleidoscope', 'pinwheel'];
const T0 = Date.UTC(2026, 10, 18, 6);
const TARGETS = readyAbaTargets(ABA_TARGETS, DEV_PLACEHOLDER_ART).map((t) => targetForBand(t, '5-6'));
const IDS = TARGETS.map((t) => t.id);
const PASSED: SampleTouchState = { ...initialSampleTouch(), passed: true };

type Child = { states: Record<string, AbaTargetState>; tokenTraining: TokenTrainingState; sampleTouch?: SampleTouchState; index: number; now: number };
const freshChild = (sampleTouch: SampleTouchState | null = initialSampleTouch()): Child => ({
  states: {},
  tokenTraining: { ...initialTokenTraining(), pairingDone: true, stage: 1 },
  ...(sampleTouch ? { sampleTouch } : {}),
  index: 0,
  now: T0,
});

const inputOf = (c: Child, seed: number, config: 'with_adult' | 'alone' = 'with_adult'): StartInput => ({
  sessionId: `s${c.index}`,
  sessionIndex: c.index,
  day: '2026-11-18',
  config,
  band: '5-6',
  targets: TARGETS,
  states: c.states,
  reinforcerPool: POOL,
  reinforcerApart: [],
  reinforcerHistory: [],
  tokenTraining: c.tokenTraining,
  startedAt: c.now,
  seed,
  identifySets: [],
  physicalPromptAllowed: false,
  autoPlacement: config === 'with_adult',
  observers: config === 'with_adult' ? [{ id: 'o1', role: 'parent', trained: false }] : [],
  primaryObserverId: config === 'with_adult' ? 'o1' : null,
  ...(c.sampleTouch ? { sampleTouch: c.sampleTouch } : {}),
});

/** Касание: `l0` — сам сразу; `l1` — дождался метки; `none` — окна истекают. */
type Touch = 'l0' | 'l1' | 'none';
function runTouch(r0: SampleTouchRun, act: Touch, at0: number): { r: SampleTouchRun; at: number } {
  let r = r0;
  let at = at0;
  if (act === 'l0' && r.step.startLevel === 0) return { r: stepSampleTouch(r, { type: 'tap_sample', at: at + 500 }), at: at + 500 };
  for (let guard = 0; !r.done && guard < 10; guard += 1) {
    if (act !== 'none' && r.log[r.log.length - 1].level >= 1) return { r: stepSampleTouch(r, { type: 'tap_sample', at: at + 300 }), at: at + 300 };
    const due = sampleTouchDueAt(r);
    if (due === null) break;
    at = due;
    r = stepSampleTouch(r, { type: 'due', at });
  }
  return { r, at };
}

function runMatch(r0: MatchTrialRun, at0: number, correct: boolean): { r: MatchTrialRun; at: number } {
  let r = r0;
  let at = at0;
  if (correct) {
    r = stepMatchTrial(r, { type: 'tap_sample', at: (at += 1000) });
    if (optionActive(r, r.step.sampleCardId!)) r = stepMatchTrial(r, { type: 'tap_option', id: r.step.sampleCardId!, at: (at += 500) });
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

type Run = { child: Child; result: AbaSessionResult; final: AbaSessionState; planned: AbaSessionState; touchesBeforeMatch: number };

/** Одно занятие: касания по `touch(i)`, пробы `match` — по `matchCorrect` (по умолчанию верно). */
function runSession(c: Child, touch: (i: number) => Touch, o: { matchCorrect?: (s: TrialStep, n: number) => boolean; stopAt?: 'adult_stopped' | 'app_error' } = {}): Run {
  let now = c.now + 3 * 3600_000;
  let st = startAbaSession(inputOf({ ...c, now }, 1000 + c.index));
  const planned = st;
  let ti = 0;
  let seq = 0;
  let touchesBeforeMatch = -1;
  const seen = new Map<string, number>();
  for (let guard = 0; guard < 500; guard += 1) {
    const next = nextStep(st, now);
    st = next.state;
    const step = next.step;
    if (step.kind === 'choose_reinforcer') st = chooseReinforcer(st, step.options[0], now, 'child');
    else if (step.kind === 'break') st = finishBreak(st, (now += 60_000)).state;
    else if (step.kind === 'access') {
      st = accessShown(st);
      st = finishAccess(st, (now += step.durationMs));
    } else if (step.kind === 'end') break;
    else if (step.kind === 'adult_finish_chain') throw new Error('цепочек нет');
    else if (step.kind === 'sample_touch') {
      const done = runTouch(startSampleTouch(step, now), step.closes ? 'l1' : touch(ti), now);
      ti += 1;
      now = done.at + 200;
      st = recordSampleTouch(st, sampleTouchInput(done.r), now).state;
      now += 2000;
      if (o.stopAt && ti === 2) {
        st = stopSession(st, o.stopAt, now);
      }
    } else {
      if (touchesBeforeMatch < 0) touchesBeforeMatch = ti;
      const key = `${step.targetId}|${step.trialKind}`;
      const n = seen.get(key) ?? 0;
      seen.set(key, n + 1);
      const ok = step.trialKind === 'high_p' || step.trialKind === 'closing' || (o.matchCorrect?.(step, n) ?? true);
      const run = startMatchTrial({ step, target: st.targets[step.targetId], config: st.config, seed: st.seed, trialId: `t${(seq += 1)}`, sessionId: st.sessionId, index: st.trials.length, shownAt: now });
      const done = runMatch(run, now, ok);
      now = done.at + 200;
      const res = recordTrial(st, matchTrialInput(done.r), now);
      if (!res.ok) throw new Error(res.errors.join('; '));
      st = res.state;
      now += 5000;
    }
  }
  const result = finishAbaSession(st, now, {}, undefined, undefined, { routineExchangeInWindow: false });
  const child: Child = {
    states: { ...c.states, ...result.states },
    tokenTraining: result.tokenTraining,
    ...(result.sampleTouch ? { sampleTouch: result.sampleTouch } : {}),
    index: c.index + 1,
    now,
  };
  return { child, result, final: st, planned, touchesBeforeMatch };
}

const touches = (r: Run) => r.result.session.events.filter((e) => e.kind === 'sample_touch');
const always = (t: Touch) => () => t;

describe('план', () => {
  it('со взрослым, шаг не пройден — сразу после выбора подкрепителя, до первой пробы match', () => {
    const st = startAbaSession(inputOf(freshChild(), 1));
    expect(st.queue[0]).toEqual({ kind: 'reinforcer' });
    expect(st.queue[1]).toEqual({ kind: 'sample_touch' });
    expect(stageOfPlan(st, {}, IDS)).toEqual({ kind: 'sample_touch', returned: false });
  });

  it('пройден или состояния нет (домен без шага) — шага нет', () => {
    expect(startAbaSession(inputOf(freshChild(PASSED), 1)).queue.some((q) => q.kind === 'sample_touch')).toBe(false);
    expect(startAbaSession(inputOf(freshChild(null), 1)).queue.some((q) => q.kind === 'sample_touch')).toBe(false);
  });

  it('«Сам»: шага нет, и цели match ребёнку с непройденным шагом не планируются', () => {
    const st = startAbaSession(inputOf(freshChild(), 1, 'alone'));
    expect(st.queue.some((q) => q.kind === 'sample_touch')).toBe(false);
    expect(st.queue.some((q) => q.kind === 'trial' && st.targets[q.trial.targetId].format === 'match')).toBe(false);
    expect(() => recordSampleTouch(st, { startLevel: 0, levelUsed: 0, outcome: 'touched', adultPrompted: false, latencyMs: 500 }, T0)).toThrow();
  });
});

describe('прохождение и объём', () => {
  it('5 самостоятельных подряд — шаг пройден, дальше пробы match той же сессии', () => {
    const r = runSession(freshChild(), always('l0'));
    expect(touches(r)).toHaveLength(SAMPLE_TOUCH_STREAK);
    expect(r.touchesBeforeMatch).toBe(SAMPLE_TOUCH_STREAK);
    expect(r.result.trials.length).toBeGreaterThan(0);
    expect(r.result.sampleTouch).toMatchObject({ passed: true, passedAt: '2026-11-18', sessionsTried: 0 });
    // доска из одной ячейки: каждое касание L0 — обмен и доступ, поэтому цикла сопряжения в конце занятия-проверки нет
    expect(r.result.session.exchangesMade).toBeGreaterThanOrEqual(SAMPLE_TOUCH_STREAK);
    expect(r.result.session.events.some((e) => e.kind === 'pairing')).toBe(false);
    // следующее занятие — без шага
    expect(startAbaSession(inputOf(r.child, 2)).queue.some((q) => q.kind === 'sample_touch')).toBe(false);
  });

  it('серия рвётся: «дождался метки» между самостоятельными — серия заново', () => {
    const seq: Touch[] = ['l0', 'l0', 'l0', 'l0', 'l1', 'l0', 'l0', 'l0', 'l0', 'l0'];
    const r = runSession(freshChild(), (i) => seq[i]);
    expect(touches(r)).toHaveLength(10);
    expect(r.result.sampleTouch?.passed).toBe(true);
  });

  it('не больше 10 проб: не пройден — match в сессии нет, конец на успешной пробе', () => {
    const r = runSession(freshChild(), always('l1'));
    expect(touches(r).filter((e) => !e.closes)).toHaveLength(SAMPLE_TOUCH_MAX_TRIALS);
    expect(r.result.trials).toHaveLength(0);
    expect(r.final.teachingTargetIds.concat(r.final.baselineTargetIds).some((id) => r.final.targets[id].format === 'match')).toBe(false);
    expect(r.result.session.endedOnSuccess).toBe(true);
    expect(r.result.sampleTouch).toMatchObject({ passed: false, sessionsTried: 1 });
  });

  it('десятая без касания и больше ничего — закрывающая проба на модели', () => {
    const r = runSession(freshChild(), always('none'));
    const all = touches(r);
    expect(all.filter((e) => !e.closes)).toHaveLength(SAMPLE_TOUCH_MAX_TRIALS);
    expect(all.filter((e) => e.closes)).toHaveLength(1);
    expect(all.at(-1)).toMatchObject({ closes: true, startLevel: 3, outcome: 'touched' });
    expect(r.result.session.endedOnSuccess).toBe(true);
  });

  it('3 сессии без прохождения — флаг sample_touch_not_acquired, шаг продолжается; прохождение флаг снимает', () => {
    let c = freshChild();
    for (let i = 0; i < SAMPLE_TOUCH_SESSIONS_BEFORE_FLAG; i += 1) c = runSession(c, always('l1')).child;
    expect(c.sampleTouch).toMatchObject({ passed: false, sessionsTried: 3, flags: ['sample_touch_not_acquired'] });
    expect(startAbaSession(inputOf(c, 9)).queue[1]).toEqual({ kind: 'sample_touch' });
    // «дождался метки» со старта L0 старт не поднимает — затухание по общему правилу
    expect(c.sampleTouch?.startLevel).toBe(0);
    const passed = runSession({ ...c, sampleTouch: { ...c.sampleTouch!, startLevel: 0 } }, always('l0')).child;
    expect(passed.sampleTouch).toMatchObject({ passed: true, flags: [] });
  });

  it('остановка взрослым и ошибка приложения сессию шага не засчитывают', () => {
    for (const reason of ['adult_stopped', 'app_error'] as const) {
      const r = runSession(freshChild(), always('l1'), { stopAt: reason });
      expect(r.result.sampleTouch?.sessionsTried).toBe(0);
    }
  });
});

describe('жетоны и ступень доски', () => {
  it('L0 — жетон observing не за результат; обмен доски шага «бесплатный»; сессия только с касаниями ступень не трогает', () => {
    const seq: Touch[] = ['l0', 'l1', 'l1', 'l1', 'l1', 'l1', 'l1', 'l1', 'l1', 'l1'];
    const r = runSession(freshChild(), (i) => seq[i]);
    const ex = r.result.session.events.filter((e) => e.kind === 'exchange');
    expect(ex.length).toBeGreaterThan(0);
    expect(ex.every((e) => e.kind === 'exchange' && e.sampleTouch === true)).toBe(true);
    expect(r.result.trials).toHaveLength(0);
    expect(r.result.tokenTraining).toEqual(freshChild().tokenTraining);
  });

  it('L1 — «принято», без жетона; «Была подсказка» на L0 — тоже подсказанная', () => {
    const st = nextStep(chooseReinforcer(startAbaSession(inputOf(freshChild(), 1)), POOL[0], T0, 'child'), T0).state;
    const l1 = recordSampleTouch(st, { startLevel: 0, levelUsed: 1, outcome: 'touched', adultPrompted: false, latencyMs: 4500 }, T0);
    expect(l1.consequence).toBe('praise');
    expect(l1.state.tokensEarned).toBe(0);
    const prompted = recordSampleTouch(st, { startLevel: 0, levelUsed: 0, outcome: 'touched', adultPrompted: true, latencyMs: 900 }, T0);
    expect(prompted.consequence).toBe('praise');
    const l0 = recordSampleTouch(st, { startLevel: 0, levelUsed: 0, outcome: 'touched', adultPrompted: false, latencyMs: 900 }, T0);
    expect(l0.consequence).toBe('token');
    expect(l0.state.board.nonContingent + l0.state.exchangesMade).toBeGreaterThan(0);
    expect(l0.state.events.find((e) => e.kind === 'sample_touch')).toMatchObject({ tokens: 1, tokenReason: 'observing', independent: true });
    expect(l1.state.events.find((e) => e.kind === 'sample_touch')).toMatchObject({ tokens: 0 });
    expect(l1.state.events.find((e) => e.kind === 'sample_touch')).not.toHaveProperty('tokenReason');
  });

  it('«Сопротивляется» — шаг на сегодня кончен, L4 до конца сессии нет', () => {
    const st = nextStep(chooseReinforcer(startAbaSession(inputOf(freshChild(), 1)), POOL[0], T0, 'child'), T0).state;
    const out = recordSampleTouch(st, { startLevel: 0, levelUsed: 3, outcome: 'l4_resisted', adultPrompted: false, latencyMs: null }, T0);
    expect(out.consequence).toBe('none');
    expect(out.state.l4Stopped).toBe(true);
    expect(out.state.queue.some((q) => q.kind === 'sample_touch')).toBe(false);
  });
});

describe('сворачивание и перерыв посреди шага', () => {
  /** Доска из одной ячейки: жетон L0 — обмен и доступ; до следующей пробы шага. */
  const toTouch = (st0: AbaSessionState, at: number) => {
    let st = st0;
    for (;;) {
      const n = nextStep(st, at);
      if (n.step.kind !== 'access') return n;
      st = finishAccess(accessShown(n.state), at + n.step.durationMs);
    }
  };
  it('«5 подряд» считается по событиям сессии: снимок посреди шага (JSON) продолжает серию', () => {
    let st = nextStep(chooseReinforcer(startAbaSession(inputOf(freshChild(), 1)), POOL[0], T0, 'child'), T0).state;
    const l0 = { startLevel: 0 as const, levelUsed: 0 as const, outcome: 'touched' as const, adultPrompted: false, latencyMs: 600 };
    let now = T0;
    for (let i = 0; i < 3; i += 1) st = toTouch(recordSampleTouch(st, l0, (now += 3000)).state, now).state;
    st = JSON.parse(JSON.stringify(st)) as AbaSessionState;
    for (let i = 0; i < 2; i += 1) {
      const step = toTouch(st, (now += 30_000));
      expect(step.step.kind).toBe('sample_touch');
      st = recordSampleTouch(step.state, l0, now).state;
    }
    expect(st.sampleTouch?.passed).toBe(true);
    expect(st.events.filter((e) => e.kind === 'sample_touch' && e.independent)).toHaveLength(SAMPLE_TOUCH_STREAK);
    expect(st.queue.some((q) => q.kind === 'sample_touch')).toBe(false);
  });

  it('карточка «перерыв» посреди пробы шага — перерыв, потом тот же образец; серия не рвётся', () => {
    let st = nextStep(chooseReinforcer(startAbaSession(inputOf(freshChild(), 1)), POOL[0], T0, 'child'), T0).state;
    const l0 = { startLevel: 0 as const, levelUsed: 0 as const, outcome: 'touched' as const, adultPrompted: false, latencyMs: 600 };
    st = recordSampleTouch(st, l0, T0 + 1000).state;
    const shown = toTouch(st, T0 + 4000);
    const sample = shown.step.kind === 'sample_touch' ? shown.step.sampleId : null;
    st = requestBreakBetweenTrials(shown.state, T0 + 5000);
    const brk = nextStep(st, T0 + 5000);
    expect(brk.step.kind).toBe('break');
    st = finishBreak(brk.state, T0 + 20_000).state;
    const again = toTouch(st, T0 + 60_000);
    expect(again.step).toMatchObject({ kind: 'sample_touch', sampleId: sample });
    st = recordSampleTouch(again.state, l0, T0 + 61_000).state;
    expect(st.events.filter((e) => e.kind === 'sample_touch' && e.independent)).toHaveLength(2);
  });
});

describe('связь со срезом А: второй промах наблюдения возвращает к шагу', () => {
  // проверка сверху вниз: с третьей пробы образца не касается (и замену тоже) — измерение закрыто промахами
  const phoneMiss = (s: TrialStep, n: number) => !(s.targetId === 'match-shape' && s.trialKind === 'baseline' && n >= 2);

  it('первое закрытие — шаг снова не пройден («возвращён»), счётчик промахов растёт; второе — обучение с L1, как раньше', () => {
    const first = runSession(freshChild(PASSED), always('l0'), { matchCorrect: phoneMiss });
    expect(first.result.sampleTouch).toMatchObject({ passed: false, returned: true });
    expect(first.child.states['match-shape'].observingMissSessions).toBe(1);
    const plan = startAbaSession(inputOf(first.child, 5));
    expect(plan.queue[1]).toEqual({ kind: 'sample_touch' });
    expect(stageOfPlan(plan, first.child.states, IDS)).toEqual({ kind: 'sample_touch', returned: true });

    // шаг снова пройден в той же сессии, измерение снова закрыто промахами — `observing_not_established`
    const second = runSession(first.child, always('l0'), { matchCorrect: phoneMiss });
    const events = second.result.session.events;
    expect(events.some((e) => e.kind === 'measurement' && e.action === 'observing_not_established')).toBe(true);
    expect(second.result.sampleTouch).toMatchObject({ passed: true, observingNotEstablishedSession: second.result.session.index });
    expect(second.result.sampleTouch?.returned).toBeUndefined();
  });
});

describe('правила шага', () => {
  it('затухание: два «дождался метки» не поднимают старт; два провала — ступень вверх (L0 → L1), два успеха на L1 — вниз', () => {
    let s = initialSampleTouch();
    const waited = { startLevel: 0 as const, levelUsed: 1 as const, outcome: 'touched' as const, adultPrompted: false, latencyMs: 4500 };
    s = fadeSampleTouch(fadeSampleTouch(s, waited), waited);
    expect(s.startLevel).toBe(0);
    const miss = { startLevel: 0 as const, levelUsed: 3 as const, outcome: 'no_response' as const, adultPrompted: false, latencyMs: null };
    s = fadeSampleTouch(fadeSampleTouch(s, miss), miss);
    expect(s.startLevel).toBe(1);
    const atL1 = { startLevel: 1 as const, levelUsed: 1 as const, outcome: 'touched' as const, adultPrompted: false, latencyMs: 800 };
    s = fadeSampleTouch(fadeSampleTouch(s, atL1), atL1);
    expect(s.startLevel).toBe(0);
  });

  it('возврат к шагу не откатывает стартовый уровень', () => {
    const s = closeSampleTouchSession({ ...PASSED, startLevel: 1 }, [], { day: '2026-11-18', sessionIndex: 3, endReason: 'completed', returnToStep: true, observingNotEstablished: false });
    expect(s).toMatchObject({ passed: false, returned: true, startLevel: 1 });
  });
});

describe('модель экрана', () => {
  const step = { kind: 'sample_touch' as const, sampleId: 'x', startLevel: 0 as const, delayMs: 4000, windowMs: 5000, l4Available: true, index: 0, closes: false, pauseBeforeMs: 0 };

  it('L0 → L1 → L3 (L2 нет), не больше трёх предъявлений, потом карточка L4', () => {
    let r = startSampleTouch(step, 0);
    r = stepSampleTouch(r, { type: 'due', at: 4000 });
    expect(r.log.map((p) => p.level)).toEqual([0, 1]);
    r = stepSampleTouch(r, { type: 'due', at: 9000 });
    expect(r.log.map((p) => p.level)).toEqual([0, 1, 3]);
    r = stepSampleTouch(r, { type: 'due', at: 14_000 });
    expect(r.awaitingL4).toBe(true);
    r = stepSampleTouch(r, { type: 'adult', button: 'l4_done', at: 15_000 });
    expect(sampleTouchInput(r)).toMatchObject({ levelUsed: 4, outcome: 'l4_done' });
  });

  it('без L4 после модели — без касания; «Отказ» — исход refusal', () => {
    let r = startSampleTouch({ ...step, l4Available: false, startLevel: 3 }, 0);
    // модель в одном кадре с новой картинкой идёт через `modelDelayMs`, окно касания — от её начала (методист 2026-11-19)
    expect(touchModelDelayMs(r)).toBe(abaSampleTouch.modelDelayMs);
    expect(sampleTouchDueAt(r)).toBe(abaSampleTouch.modelDelayMs + 5000);
    r = stepSampleTouch(r, { type: 'due', at: 5000 });
    expect(r.done).toBe(false);
    r = stepSampleTouch(r, { type: 'due', at: abaSampleTouch.modelDelayMs + 5000 });
    expect(sampleTouchInput(r)).toMatchObject({ outcome: 'no_response', levelUsed: 3 });
    const refused = stepSampleTouch(startSampleTouch(step, 0), { type: 'adult', button: 'refusal', at: 100 });
    expect(sampleTouchInput(refused).outcome).toBe('refusal');
  });
});

describe('согласие на шаге (финальная рецензия методиста 2026-11-18)', () => {
  const atTouch = () => nextStep(chooseReinforcer(startAbaSession(inputOf(freshChild(), 1)), POOL[0], T0, 'child'), T0).state;
  const refusal = { startLevel: 0 as const, levelUsed: 1 as const, outcome: 'refusal' as const, adultPrompted: false, latencyMs: null };
  const resisted = { startLevel: 0 as const, levelUsed: 3 as const, outcome: 'l4_resisted' as const, adultPrompted: false, latencyMs: null };
  const l1 = { startLevel: 0 as const, levelUsed: 1 as const, outcome: 'touched' as const, adultPrompted: false, latencyMs: 4000 };
  const ctx = (endReason: 'completed' | 'adult_stopped' | 'app_error' | 'app_backgrounded' | 'assent_withdrawn' = 'completed') => ({
    day: '2026-11-18',
    sessionIndex: 1,
    endReason,
    returnToStep: false,
    observingNotEstablished: false,
  });
  const assents = (events: readonly AbaSessionEvent[]) => events.filter((e) => e.kind === 'assent');

  it('«Отказ» на шаге — ход согласия с отметкой шага, в счёт отказов, тихая пауза с подсвеченной карточкой', () => {
    const out = recordSampleTouch(atTouch(), refusal, T0 + 1000).state;
    expect(assents(out.events)).toEqual([{ kind: 'assent', at: new Date(T0 + 1000).toISOString(), by: 'adult_observed', action: 'break', step: 'sample_touch' }]);
    expect(out.refusals).toBe(1);
    expect(out.queue[0]).toEqual({ kind: 'break', initiatedBy: 'adult', maxMs: REFUSAL_QUIET_MS, offerCardMs: REFUSAL_CARD_OFFER_MS });
    expect(out.queue.some((q) => q.kind === 'sample_touch')).toBe(false);
    expect(out.endReason).toBeNull();
    const brk = nextStep(out, T0 + 2000);
    expect(brk.step).toMatchObject({ kind: 'break', offerCardMs: REFUSAL_CARD_OFFER_MS });
  });

  it('второй «Отказ» в сессии (первый — на пробе) — конец по отказу, отметка шага в событии конца', () => {
    const out = recordSampleTouch({ ...atTouch(), refusals: 1 }, refusal, T0 + 1000).state;
    expect(out.endReason).toBe('assent_withdrawn');
    expect(assents(out.events)).toEqual([expect.objectContaining({ by: 'adult_observed', action: 'end', step: 'sample_touch' })]);
    // конец отказом на шаге — тревожная сессия шага
    expect(closeSampleTouchSession(initialSampleTouch(), out.events, ctx('assent_withdrawn')).assentSessionsInRow).toBe(1);
  });

  it('«Сопротивляется» на шаге — ход l4_stopped с отметкой шага', () => {
    const out = recordSampleTouch(atTouch(), resisted, T0 + 1000).state;
    expect(assents(out.events)).toEqual([expect.objectContaining({ by: 'adult_observed', action: 'l4_stopped', step: 'sample_touch' })]);
    expect(out.refusals).toBe(0);
  });

  it('карточка «перерыв» посреди пробы шага — с отметкой шага', () => {
    const st = requestBreakBetweenTrials(atTouch(), T0 + 1000);
    expect(assents(st.events)).toEqual([expect.objectContaining({ by: 'child_card', action: 'break', step: 'sample_touch' })]);
  });

  it('две тревожные сессии шага подряд — assent_concern у шага; спокойная обнуляет; прохождение не снимает; снимает отметка', () => {
    const refusedEvents = recordSampleTouch(atTouch(), refusal, T0 + 1000).state.events;
    const calmEvents = recordSampleTouch(atTouch(), l1, T0 + 1000).state.events;
    let s = closeSampleTouchSession(initialSampleTouch(), refusedEvents, ctx());
    expect(s).toMatchObject({ assentSessionsInRow: 1, flags: [] });
    s = closeSampleTouchSession(s, calmEvents, ctx());
    expect(s.assentSessionsInRow).toBe(0);
    s = closeSampleTouchSession(s, refusedEvents, ctx());
    s = closeSampleTouchSession(s, recordSampleTouch(atTouch(), resisted, T0 + 1000).state.events, ctx('adult_stopped'));
    expect(s).toMatchObject({ assentSessionsInRow: 2, flags: ['assent_concern'] });
    // сессии без проб шага счётчик не трогают
    expect(closeSampleTouchSession(s, [], ctx()).assentSessionsInRow).toBe(2);
    const passed = closeSampleTouchSession({ ...s, passed: true }, calmEvents, ctx());
    expect(passed.flags).toContain('assent_concern');
    const reviewed = reviewSampleTouchAssentConcern(s, 'specialist', '2026-11-19T10:00:00.000Z');
    expect(reviewed).toMatchObject({ flags: [], assentSessionsInRow: 0, assentConcernReviewed: { role: 'specialist' } });
    expect(reviewSampleTouchAssentConcern(reviewed!, 'specialist', '2026-11-19T10:00:00.000Z')).toBeNull();
  });

  it('одна карточка на шаге — не тревожно; две — тревожно', () => {
    const one = requestBreakBetweenTrials(atTouch(), T0 + 1000);
    expect(closeSampleTouchSession(initialSampleTouch(), one.events, ctx()).assentSessionsInRow).toBe(0);
    const two: AbaSessionEvent[] = [...one.events, { ...assents(one.events)[0], at: new Date(T0 + 9000).toISOString() }];
    expect(closeSampleTouchSession(initialSampleTouch(), two, ctx()).assentSessionsInRow).toBe(1);
  });

  it('sample_touch_not_acquired: в счёт — только шаг, дошедший до своего конца, и не оборванная сессия', () => {
    // «Отказ» кончает шаг, но не своим концом — не в счёт
    const refusedEvents = recordSampleTouch(atTouch(), refusal, T0 + 1000).state.events;
    expect(closeSampleTouchSession(initialSampleTouch(), refusedEvents, ctx()).sessionsTried).toBe(0);
    // «Сопротивляется» — свой конец шага: в счёт
    const resistedEvents = recordSampleTouch(atTouch(), resisted, T0 + 1000).state.events;
    expect(closeSampleTouchSession(initialSampleTouch(), resistedEvents, ctx()).sessionsTried).toBe(1);
    // десять проб, но конец сессии — сворачивание, отказ, остановка, ошибка: не в счёт
    const ten = runSession(freshChild(), always('l1')).final.events;
    expect(closeSampleTouchSession(initialSampleTouch(), ten, ctx()).sessionsTried).toBe(1);
    for (const reason of ['app_backgrounded', 'assent_withdrawn', 'adult_stopped', 'app_error'] as const) {
      expect(closeSampleTouchSession(initialSampleTouch(), ten, ctx(reason)).sessionsTried).toBe(0);
    }
    // шаг оборван посреди (две пробы) — не в счёт и при обычном конце
    const two = recordSampleTouch(atTouch(), l1, T0 + 1000).state.events;
    expect(closeSampleTouchSession(initialSampleTouch(), two, ctx()).sessionsTried).toBe(0);
  });
});
