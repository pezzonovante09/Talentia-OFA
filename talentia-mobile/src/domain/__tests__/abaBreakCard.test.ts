/**
 * Карточка «перерыв» (`abaBreakCard.ts`, ABA.md «Отмена отметки и карточка «перерыв»», решение №99):
 * план обучения, итог обучающих возможностей, итог рабочей сессии; в сессии — `recordBreakCardTraining`,
 * `acceptBreakOffer`; в оценке пробы — `msSinceSd`. Хранилище — `services/local/__tests__/breakCardStore.test.ts`.
 */
import type { AbaPresentation } from '../../types/aba';
import {
  applyBreakCardRoutine,
  applyBreakCardSession,
  BREAK_CARD_ROUTINE_KEEP,
  applyBreakCardTraining,
  BREAK_CARD_LONG_GAP_DAYS,
  BREAK_CARD_MAX_OPPORTUNITIES,
  BREAK_CARD_RECENT_WINDOW,
  BREAK_CARD_RESET_AFTER,
  BREAK_CARD_SESSIONS_BEFORE_FLAG,
  BREAK_CARD_TRAINING_SECONDS,
  breakCardPlan,
  breakCardRequestsOf,
  initialBreakCard,
  type BreakCardState,
} from '../abaBreakCard';
import { scoreTrial, type ScoreContext } from '../abaScoring';
import { acceptBreakOffer, finishBreak, nextStep, recordBreakCardTraining } from '../abaSession';
import { BASE_MS, beginSession } from './abaSessionDriver';

const acquired = (over: Partial<BreakCardState> = {}): BreakCardState => ({
  ...initialBreakCard(),
  acquired: true,
  acquiredAt: '2026-10-01',
  acquiredVia: 'training',
  step: 'independent',
  lastSessionDay: '2026-10-10',
  observerId: 'obs-a',
  deviceId: 'dev-1',
  ...over,
});

const touch = (step: 'model' | 'prompted' | 'independent', touched: boolean, gestureGiven: boolean) => ({ step, touched, gestureGiven, latencyMs: touched ? 800 : null });
const ctx = (over: Partial<Parameters<typeof applyBreakCardTraining>[2]> = {}) => ({ day: '2026-10-12', observerId: 'obs-a', ...over });

describe('breakCardPlan: сколько возможностей на сессию', () => {
  const day = '2026-10-12';

  it('не принята, со взрослым: три возможности со ступени model', () => {
    expect(breakCardPlan(initialBreakCard(), { config: 'with_adult', day, observerId: 'obs-a' })).toEqual({
      opportunities: BREAK_CARD_MAX_OPPORTUNITIES,
      startStep: 'model',
      adultCoaching: false,
      retrain: false,
    });
  });

  it('не принята, ступень уже prompted: три возможности начинаются с неё', () => {
    const p = breakCardPlan({ ...initialBreakCard(), step: 'prompted' }, { config: 'with_adult', day, observerId: null });
    expect([p.opportunities, p.startStep]).toEqual([3, 'prompted']);
  });

  it('«Сам»: обучения нет, даже если карточка не принята', () => {
    expect(breakCardPlan(initialBreakCard(), { config: 'alone', day, observerId: null }).opportunities).toBe(0);
    expect(breakCardPlan(acquired(), { config: 'alone', day: '2027-01-01', observerId: 'другой' }).opportunities).toBe(0);
  });

  it('принята, те же условия — возможностей нет', () => {
    expect(breakCardPlan(acquired(), { config: 'with_adult', day, observerId: 'obs-a', deviceId: 'dev-1' })).toMatchObject({ opportunities: 0, retrain: false });
  });

  it(`принята, перерыв в занятиях ${BREAK_CARD_LONG_GAP_DAYS} дней — одна возможность без модели`, () => {
    const p = breakCardPlan(acquired({ lastSessionDay: '2026-09-28' }), { config: 'with_adult', day, observerId: 'obs-a' });
    expect(p).toEqual({ opportunities: 1, startStep: 'independent', adultCoaching: false, retrain: true });
  });

  it(`принята, ${BREAK_CARD_LONG_GAP_DAYS - 1} дней перерыва — ещё не повтор (граница)`, () => {
    const p = breakCardPlan(acquired({ lastSessionDay: '2026-09-29' }), { config: 'with_adult', day, observerId: 'obs-a' });
    expect(p.opportunities).toBe(0);
  });

  it('принята, сменился основной наблюдатель — одна возможность и подсказка взрослому «жестом, не словами»', () => {
    const p = breakCardPlan(acquired(), { config: 'with_adult', day, observerId: 'obs-b' });
    expect(p).toEqual({ opportunities: 1, startStep: 'independent', adultCoaching: true, retrain: true });
  });

  it('принята, наблюдателя в сессии нет — смена не фиксируется', () => {
    expect(breakCardPlan(acquired(), { config: 'with_adult', day, observerId: null }).opportunities).toBe(0);
  });

  it('принята, другое устройство — одна возможность, подсказки взрослому нет', () => {
    const p = breakCardPlan(acquired(), { config: 'with_adult', day, observerId: 'obs-a', deviceId: 'dev-2' });
    expect(p).toMatchObject({ opportunities: 1, adultCoaching: false, retrain: true });
  });

  it('принята, у карточки нет дня прошлой сессии — перерыв в занятиях не считается', () => {
    expect(breakCardPlan(acquired({ lastSessionDay: null }), { config: 'with_adult', day, observerId: 'obs-a' }).opportunities).toBe(0);
  });
});

describe('applyBreakCardTraining: итог обучающих возможностей', () => {
  it('нет событий — карточка не меняется (тот же объект)', () => {
    const c = initialBreakCard();
    expect(applyBreakCardTraining(c, [], ctx())).toBe(c);
  });

  it('касание без жеста на ступени independent — карточка принята (training), ступень independent, день принятия записан', () => {
    const c = applyBreakCardTraining(initialBreakCard(), [touch('independent', true, false)], ctx());
    expect(c).toMatchObject({ acquired: true, acquiredVia: 'training', acquiredAt: '2026-10-12', step: 'independent' });
  });

  it('касание без жеста на model принятием не считается: на этой ступени касается взрослый', () => {
    const c = applyBreakCardTraining(initialBreakCard(), [touch('model', true, false)], ctx());
    expect(c.acquired).toBe(false);
  });

  it('касание без жеста на ступени prompted (жест ещё не дан) — самостоятельное: карточка принята', () => {
    const c = applyBreakCardTraining({ ...initialBreakCard(), step: 'prompted' }, [touch('prompted', true, false)], ctx());
    expect(c).toMatchObject({ acquired: true, acquiredVia: 'training', step: 'independent' });
  });

  it('не принята, ни одного касания: сессия обучения засчитана, ступень model → prompted', () => {
    const c = applyBreakCardTraining(initialBreakCard(), [touch('model', false, false), touch('prompted', false, true)], ctx());
    expect([c.acquired, c.sessionsTried, c.step]).toEqual([false, 1, 'prompted']);
  });

  it('касание после жеста ведёт на independent', () => {
    const c = applyBreakCardTraining({ ...initialBreakCard(), step: 'prompted' }, [touch('prompted', true, true)], ctx());
    expect([c.acquired, c.step]).toEqual([false, 'independent']);
  });

  it('ступень не опускается: prompted без касаний остаётся prompted, independent — independent', () => {
    const p = applyBreakCardTraining({ ...initialBreakCard(), step: 'prompted' }, [touch('prompted', false, true)], ctx());
    const i = applyBreakCardTraining({ ...initialBreakCard(), step: 'independent' }, [touch('independent', false, true)], ctx());
    expect([p.step, i.step]).toEqual(['prompted', 'independent']);
  });

  it(`флаг break_card_not_acquired — после ${BREAK_CARD_SESSIONS_BEFORE_FLAG} сессий без принятия, а не раньше`, () => {
    let c = initialBreakCard();
    const flags: boolean[] = [];
    for (let i = 0; i < BREAK_CARD_SESSIONS_BEFORE_FLAG; i += 1) {
      c = applyBreakCardTraining(c, [touch('model', false, false)], ctx());
      flags.push(c.flags.includes('break_card_not_acquired'));
    }
    expect(flags).toEqual([false, false, true]);
  });

  it('принятие снимает флаг break_card_not_acquired', () => {
    const flagged = { ...initialBreakCard(), sessionsTried: 3, flags: ['break_card_not_acquired' as const] };
    const c = applyBreakCardTraining(flagged, [touch('independent', true, false)], ctx());
    expect([c.acquired, c.flags]).toEqual([true, []]);
  });

  it('принята: повторное касание без жеста — всё в порядке, счётчик повторов с жестом обнулён', () => {
    const c = applyBreakCardTraining(acquired({ repeatsPrompted: 1 }), [touch('independent', true, false)], ctx());
    expect([c.acquired, c.repeatsPrompted]).toEqual([true, 0]);
  });

  it('принята: касание только после жеста — повтор в следующей сессии (счётчик 1), карточка пока принята', () => {
    const c = applyBreakCardTraining(acquired(), [touch('independent', false, false), touch('independent', true, true)], ctx());
    expect([c.acquired, c.repeatsPrompted]).toEqual([true, 1]);
  });

  it(`принята: ${BREAK_CARD_RESET_AFTER} повтора подряд с касанием только после жеста сбрасывают «обучена»`, () => {
    const one = applyBreakCardTraining(acquired(), [touch('independent', true, true)], ctx());
    const two = applyBreakCardTraining(one, [touch('independent', true, true)], ctx({ day: '2026-10-13' }));
    expect(two).toMatchObject({ acquired: false, step: 'model', sessionsTried: 0, repeatsPrompted: 0 });
    expect(two).not.toHaveProperty('acquiredAt');
    expect(two).not.toHaveProperty('acquiredVia');
  });

  it('сброс не копит прошлое: касание без жеста между двумя повторами обнуляет серию', () => {
    const one = applyBreakCardTraining(acquired(), [touch('independent', true, true)], ctx());
    const calm = applyBreakCardTraining(one, [touch('independent', true, false)], ctx());
    const again = applyBreakCardTraining(calm, [touch('independent', true, true)], ctx());
    expect(again.acquired).toBe(true);
  });

  it('принята, касания не было вовсе — карточка принята и дальше (без сброса), день сессии записан', () => {
    const c = applyBreakCardTraining(acquired(), [touch('independent', false, false)], ctx());
    expect([c.acquired, c.lastSessionDay]).toEqual([true, '2026-10-12']);
  });

  it('наблюдатель и устройство обновляются; пустой наблюдатель прежнего не стирает', () => {
    const c = applyBreakCardTraining(acquired(), [touch('independent', false, false)], { day: '2026-10-12', observerId: null, deviceId: 'dev-9' });
    expect([c.observerId, c.deviceId]).toEqual(['obs-a', 'dev-9']);
  });

  it('исходная карточка не изменяется', () => {
    const c = initialBreakCard();
    const copy = JSON.parse(JSON.stringify(c));
    applyBreakCardTraining(c, [touch('independent', true, false)], ctx());
    expect(c).toEqual(copy);
  });
});

describe('breakCardRequestsOf и applyBreakCardSession: просьбы в пробе', () => {
  const child = { kind: 'assent', by: 'child_card', action: 'break' };

  it('breakCardRequestsOf считает только детские просьбы; взрослый, обучение и предложение Tali не в счёт', () => {
    const r = breakCardRequestsOf([child, { kind: 'assent', by: 'adult_observed', action: 'break' }, { kind: 'break_card_training' }, { kind: 'break' }]);
    expect(r).toEqual({ requests: 1, byLimit: false });
  });

  it('конец по третьей просьбе (action = end) — byLimit', () => {
    expect(breakCardRequestsOf([child, child, { kind: 'assent', by: 'child_card', action: 'end' }])).toEqual({ requests: 3, byLimit: true });
  });

  it('нет событий — ноль просьб', () => {
    expect(breakCardRequestsOf([])).toEqual({ requests: 0, byLimit: false });
  });

  const sess = (i: number, requests: number, byLimit = false) => ({ sessionIndex: i, day: `2026-10-${String(i).padStart(2, '0')}`, requests, byLimit, endReason: 'completed' as const });
  const run = (card: BreakCardState, ...s: ReturnType<typeof sess>[]) => s.reduce((c, x) => applyBreakCardSession(c, x, { observerId: 'obs-a' }), card);

  it('просьба в пробе при непринятой карточке — это принятие (in_trial), ступень independent', () => {
    const c = applyBreakCardSession(initialBreakCard(), sess(12, 1), { observerId: 'obs-a' });
    expect(c).toMatchObject({ acquired: true, acquiredVia: 'in_trial', acquiredAt: '2026-10-12', step: 'independent' });
  });

  it('принятие в пробе снимает флаг break_card_not_acquired', () => {
    const flagged = { ...initialBreakCard(), flags: ['break_card_not_acquired' as const] };
    expect(applyBreakCardSession(flagged, sess(12, 1), { observerId: null }).flags).toEqual([]);
  });

  it('без просьб карточка не принимается', () => {
    expect(applyBreakCardSession(initialBreakCard(), sess(12, 0), { observerId: null }).acquired).toBe(false);
  });

  it('уже принятая обучением карточка способ принятия не меняет', () => {
    expect(applyBreakCardSession(acquired(), sess(12, 1), { observerId: 'obs-a' })).toMatchObject({ acquiredVia: 'training', acquiredAt: '2026-10-01' });
  });

  it('«частая» сессия — две просьбы и больше или конец по лимиту; одна просьба — нет', () => {
    const c = run(acquired(), sess(1, 1), sess(2, 2), sess(3, 0, true));
    expect(c.recent.map((r) => r.requests >= 2 || r.byLimit)).toEqual([false, true, true]);
    expect(c.flags).toEqual([]);
  });

  it('флаг break_card_frequent — три частые сессии из последних пяти', () => {
    const two = run(acquired(), sess(1, 2), sess(2, 0), sess(3, 3));
    expect(two.flags).not.toContain('break_card_frequent');
    const three = run(two, sess(4, 0, true));
    expect(three.flags).toContain('break_card_frequent');
  });

  it('флаг снимается, когда частые сессии уходят из окна последних пяти', () => {
    let c = run(acquired(), sess(1, 2), sess(2, 2), sess(3, 2));
    expect(c.flags).toContain('break_card_frequent');
    c = run(c, sess(4, 0), sess(5, 0));
    expect(c.flags).toContain('break_card_frequent'); // 3 из 5 ещё в окне
    c = run(c, sess(6, 0));
    expect(c.flags).not.toContain('break_card_frequent'); // первая частая вышла из окна
  });

  it(`окно хранит не больше ${BREAK_CARD_RECENT_WINDOW} последних сессий`, () => {
    const c = run(acquired(), ...[1, 2, 3, 4, 5, 6, 7].map((i) => sess(i, 0)));
    expect(c.recent.map((r) => r.sessionIndex)).toEqual([3, 4, 5, 6, 7]);
  });

  it('две частые сессии подряд — этого мало, флага нет', () => {
    expect(run(acquired(), sess(1, 3), sess(2, 3)).flags).toEqual([]);
  });

  it('день сессии и наблюдатель записываются в карточку', () => {
    const c = applyBreakCardSession(acquired({ observerId: 'obs-a' }), sess(4, 0), { observerId: 'obs-z', deviceId: 'dev-5' });
    expect([c.lastSessionDay, c.observerId, c.deviceId]).toEqual(['2026-10-04', 'obs-z', 'dev-5']);
  });

  it('просьба не влияет на счётчики обучения (sessionsTried не растёт)', () => {
    expect(applyBreakCardSession(initialBreakCard(), sess(1, 2), { observerId: null }).sessionsTried).toBe(0);
  });
});

describe('recordBreakCardTraining: обучающая возможность в сессии', () => {
  const T = BASE_MS + 5000;

  it('касание: событие break_card_training и обучающий перерыв первым в очереди', () => {
    const s = recordBreakCardTraining(beginSession(), { step: 'model', touched: true, gestureGiven: false, latencyMs: 600 }, T);
    expect(s.events.at(-1)).toMatchObject({ kind: 'break_card_training', step: 'model', touched: true, gestureGiven: false, latencyMs: 600 });
    expect(s.queue[0]).toMatchObject({ kind: 'break', initiatedBy: 'child_card', training: true });
  });

  it.each([
    ['5-6', 15_000],
    ['7', 20_000],
    ['8', 20_000],
    ['9-10', 20_000],
  ] as const)('полоса %s: обучающий перерыв %i мс', (band, ms) => {
    const s = recordBreakCardTraining(beginSession({ band }), touchInput, T);
    expect((s.queue[0] as { maxMs: number }).maxMs).toBe(ms);
    expect(BREAK_CARD_TRAINING_SECONDS[band] * 1000).toBe(ms);
  });
  const touchInput = { step: 'prompted' as const, touched: true, gestureGiven: true, latencyMs: 1200 };

  it('без касания: только событие, очередь не меняется', () => {
    const st = beginSession();
    const s = recordBreakCardTraining(st, { step: 'independent', touched: false, gestureGiven: true, latencyMs: null }, T);
    expect(s.queue).toEqual(st.queue);
    expect(s.events.at(-1)).toMatchObject({ kind: 'break_card_training', touched: false });
  });

  it(`не больше ${BREAK_CARD_MAX_OPPORTUNITIES} за сессию: четвёртая — ошибка`, () => {
    let s = beginSession();
    for (let i = 0; i < BREAK_CARD_MAX_OPPORTUNITIES; i += 1) {
      s = recordBreakCardTraining(s, { step: 'independent', touched: false, gestureGiven: false, latencyMs: null }, T + i);
    }
    expect(() => recordBreakCardTraining(s, touchInput, T + 9)).toThrow(/не больше трёх/);
  });

  it('«Сам»: обучение запрещено', () => {
    expect(() => recordBreakCardTraining(beginSession({ config: 'alone' }), touchInput, T)).toThrow(/в «Сам» обучения нет/);
  });

  it('сессия кончилась — обучать поздно', () => {
    expect(() => recordBreakCardTraining({ ...beginSession(), endReason: 'completed' }, touchInput, T)).toThrow(/поздно/);
  });

  it('на модели жеста нет: касается взрослый', () => {
    expect(() => recordBreakCardTraining(beginSession(), { step: 'model', touched: true, gestureGiven: true, latencyMs: 500 }, T)).toThrow(/жеста нет/);
  });

  it('childBreaks и refusals не растут: ни после записи, ни после самого перерыва; в событии перерыва training = true', () => {
    const s0 = beginSession();
    const s1 = recordBreakCardTraining(s0, touchInput, T);
    const step = nextStep(s1, T + 100);
    expect(step.step).toMatchObject({ kind: 'break', initiatedBy: 'child_card' });
    const done = finishBreak(step.state, T + 15_000).state;
    expect([done.childBreaks, done.refusals]).toEqual([s0.childBreaks, s0.refusals]);
    expect(done.events.find((e) => e.kind === 'break')).toMatchObject({ initiatedBy: 'child_card', training: true });
  });

  it('обучающий перерыв не кончает сессию и не даёт жетонов', () => {
    const s0 = beginSession();
    const s1 = recordBreakCardTraining(s0, touchInput, T);
    const done = finishBreak(nextStep(s1, T + 100).state, T + 15_000).state;
    expect([done.endReason, done.tokensEarned, done.board]).toEqual([null, s0.tokensEarned, s0.board]);
  });

  it('просьбой карточки в счёт не идёт: breakCardRequestsOf по событиям сессии даёт ноль', () => {
    const s1 = recordBreakCardTraining(beginSession(), touchInput, T);
    const done = finishBreak(nextStep(s1, T + 100).state, T + 15_000).state;
    expect(breakCardRequestsOf(done.events)).toEqual({ requests: 0, byLimit: false });
  });

  it('исходное состояние не изменяется', () => {
    const st = beginSession();
    const copy = JSON.parse(JSON.stringify(st));
    recordBreakCardTraining(st, touchInput, T);
    expect(JSON.parse(JSON.stringify(st))).toEqual(copy);
  });
});

describe('acceptBreakOffer: «Tali предлагает перерыв» — да', () => {
  const T = BASE_MS + 5000;

  it('первым в очереди перерыв device_offer; не training', () => {
    const s = acceptBreakOffer(beginSession());
    expect(s.queue[0]).toMatchObject({ kind: 'break', initiatedBy: 'device_offer' });
    expect(s.queue[0]).not.toHaveProperty('training');
  });

  it('в childBreaks и refusals не идёт; в просьбы карточки не идёт; событие перерыва — device_offer', () => {
    const s0 = beginSession();
    const s1 = acceptBreakOffer(s0);
    const done = finishBreak(nextStep(s1, T).state, T + 20_000).state;
    expect([done.childBreaks, done.refusals]).toEqual([s0.childBreaks, s0.refusals]);
    expect(done.events.find((e) => e.kind === 'break')).toMatchObject({ initiatedBy: 'device_offer' });
    expect(breakCardRequestsOf(done.events)).toEqual({ requests: 0, byLimit: false });
  });

  it('сессия кончилась — ошибка', () => {
    expect(() => acceptBreakOffer({ ...beginSession(), endReason: 'completed' })).toThrow(/поздно/);
  });
});

describe('msSinceSd: сколько прошло от конца SD до касания карточки', () => {
  const T0 = Date.UTC(2026, 9, 12, 10);
  const iso = (ms: number) => new Date(ms).toISOString();
  const sc: ScoreContext = {
    startPromptLevel: 0,
    scoredBy: 'adult',
    allowEscalation: true,
    escalateOnIncorrect: false,
    askAdultForL4: true,
    chainStep: false,
    promptDelayMs: 2000,
    responseWindowMs: 5000,
  };
  const presentation = (outcome: AbaPresentation['outcome'], respondedAt?: number): AbaPresentation => ({
    level: 0,
    by: 'app',
    startedAt: iso(T0),
    endedAt: iso(T0 + 1000),
    windowMs: 2000,
    outcome,
    ...(respondedAt !== undefined ? { respondedAt: iso(respondedAt) } : {}),
  });
  const fields = (p: AbaPresentation) => {
    const r = scoreTrial([p], sc);
    if (!r.ok) throw new Error(r.errors.join('; '));
    return r.fields;
  };

  it('нет в пробах без карточки: верный ответ, отказ, нет ответа', () => {
    for (const p of [presentation('correct', T0 + 1700), presentation('refusal'), presentation('none')]) {
      expect(fields(p)).not.toHaveProperty('msSinceSd');
    }
  });

  it('карточка без отметки времени касания — поля нет (измерить нечем)', () => {
    expect(fields(presentation('child_break'))).not.toHaveProperty('msSinceSd');
  });

  // `logErrors` пускает `respondedAt` у касания карточки (оно не ответ, латентности не даёт): msSinceSd достижим.
  it('child_break со временем касания: msSinceSd = касание − конец SD, interruptedBy child_break, латентности нет', () => {
    const r = scoreTrial([presentation('child_break', T0 + 2500)], sc);
    if (!r.ok) throw new Error(r.errors.join('; '));
    expect(r.fields).toMatchObject({ interruptedBy: 'child_break', msSinceSd: 1500, latencyMs: null });
  });
});

describe('applyBreakCardRoutine: просьбы в прогонах рутин (раунд 4, Д3)', () => {
  const run = (n: number, requests = 1, ended = false) => ({ runId: `run-${n}`, day: `2026-10-${String(n).padStart(2, '0')}`, requests, ended });

  it('прогон без просьб карточку не меняет', () => {
    const card = acquired();
    expect(applyBreakCardRoutine(card, run(1, 0))).toBe(card);
  });

  it('просьба пишется в routineRequests, а не в окно сессий recent', () => {
    const card = acquired({ recent: [{ sessionIndex: 3, day: '2026-10-09', requests: 0, byLimit: false }] });
    const c = applyBreakCardRoutine(card, run(12, 2, true));
    expect(c.routineRequests).toEqual([run(12, 2, true)]);
    expect(c.recent).toEqual(card.recent);
    expect(c.flags).toEqual(card.flags);
  });

  it(`хранит последние ${BREAK_CARD_ROUTINE_KEEP} прогонов с просьбой`, () => {
    let c = acquired();
    for (let i = 1; i <= BREAK_CARD_ROUTINE_KEEP + 3; i += 1) c = applyBreakCardRoutine(c, run(i));
    expect(c.routineRequests).toHaveLength(BREAK_CARD_ROUTINE_KEEP);
    expect(c.routineRequests![0].runId).toBe('run-4');
    expect(c.routineRequests!.at(-1)!.runId).toBe(`run-${BREAK_CARD_ROUTINE_KEEP + 3}`);
  });

  it('просьба при не принятой карточке — принятие in_trial, флаг непринятой снят', () => {
    const card: BreakCardState = { ...initialBreakCard(), flags: ['break_card_not_acquired'] };
    const c = applyBreakCardRoutine(card, run(12));
    expect(c).toMatchObject({ acquired: true, acquiredAt: '2026-10-12', acquiredVia: 'in_trial', step: 'independent' });
    expect(c.flags).not.toContain('break_card_not_acquired');
  });

  it('у принятой карточки дата и путь принятия не меняются', () => {
    const c = applyBreakCardRoutine(acquired(), run(12));
    expect([c.acquiredAt, c.acquiredVia]).toEqual(['2026-10-01', 'training']);
  });
});
