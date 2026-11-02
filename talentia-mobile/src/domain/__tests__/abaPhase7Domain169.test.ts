/**
 * №169 (фаза 7, домен): обмен на перерыве по расписанию даёт доступ по ступени; перерыв, оборванный концом сессии,
 * пишется; конец по бездействию устройства — без обмена и без сопряжения; сопряжение — только без обмена в конце.
 */
import { REFUSAL_CARD_OFFER_MS, REFUSAL_QUIET_MS } from '../../types/aba';
import { finishAccess, finishBreak, nextStep, recordTrial, stopSession, withdrawAssent, type AbaSessionState } from '../abaSession';
import { EXCHANGE_ACCESS_MS, type BoardStage } from '../abaTokenTraining';
import { finishSession } from './abaFixtures';
import { answerNext, BASE_MS, beginSession, correctInput, tgt, trained } from './abaSessionDriver';

type QueueItem = AbaSessionState['queue'][number];
type BreakItem = Extract<QueueItem, { kind: 'break' }>;

const T = BASE_MS + 2000;
const iso = (ms: number) => new Date(ms).toISOString();

/** Сессия после первой записанной пробы: работа идёт, в очереди дальше пробы. */
function afterTrial(over: Parameters<typeof beginSession>[0] = {}): AbaSessionState {
  return answerNext(beginSession(over), BASE_MS + 1000).state;
}
const full = (st: AbaSessionState): AbaSessionState => ({ ...st, board: { ...st.board, earned: st.board.size } });
const almostFull = (st: AbaSessionState): AbaSessionState => ({ ...st, board: { ...st.board, earned: st.board.size - 1 } });
const SCHEDULE: BreakItem = { kind: 'break', maxMs: 30_000 };

/** Перерыв `item` в голове очереди и показан экраном в `T` (`nextStep` ставит `breakStartedAt`). */
function inBreak(st: AbaSessionState, item: BreakItem = SCHEDULE): AbaSessionState {
  const shown = nextStep({ ...st, queue: [item, ...st.queue] }, T);
  expect(shown.step.kind).toBe('break');
  return shown.state;
}

/** Прогнать сессию до шага `end`: пробы — верно, перерывы и доступ — сразу. */
function driveToEnd(state: AbaSessionState): { state: AbaSessionState; end: Extract<ReturnType<typeof nextStep>['step'], { kind: 'end' }> } {
  let st = state;
  let now = BASE_MS + 1000;
  for (let guard = 0; guard < 200; guard += 1) {
    now += 1000;
    const next = nextStep(st, now);
    if (next.step.kind === 'end') return { state: next.state, end: next.step };
    if (next.step.kind === 'break') st = finishBreak(next.state, now).state;
    else if (next.step.kind === 'access') st = finishAccess(next.state, now);
    else if (next.step.kind === 'trial') st = answerNext(st, now).state;
    else throw new Error(`неожиданный шаг ${next.step.kind}`);
  }
  throw new Error('сессия не кончилась');
}

describe('обмен на перерыве по расписанию даёт доступ (№169, п. 1)', () => {
  it('полная доска: после перерыва следующий шаг — доступ по ступени доски', () => {
    const st = inBreak(full(afterTrial()));
    const done = finishBreak(st, T + 30_000);
    expect(done.exchanged).toBeGreaterThan(0);
    expect(nextStep(done.state, T + 30_000).step).toEqual({ kind: 'access', durationMs: EXCHANGE_ACCESS_MS[st.board.size as BoardStage] });
  });

  it('на доске из трёх ячеек доступ — 40 с', () => {
    const st = inBreak(full(afterTrial()));
    expect(st.board.size).toBe(3);
    expect(finishBreak(st, T + 30_000).state.queue[0]).toEqual({ kind: 'access', durationMs: 40_000 });
  });

  it.each([1, 2, 3] as const)('длительность доступа — по размеру доски %i, как при обмене сразу', (stage) => {
    const st = inBreak(full(afterTrial({ tokenTraining: trained(stage) })));
    expect(st.board.size).toBe(stage);
    expect(finishBreak(st, T + 30_000).state.queue[0]).toEqual({ kind: 'access', durationMs: EXCHANGE_ACCESS_MS[stage] });
  });

  it('после доступа в журнале по порядку перерыв, обмен, доступ', () => {
    const st = finishBreak(inBreak(full(afterTrial())), T + 30_000).state;
    const after = finishAccess(nextStep(st, T + 30_000).state, T + 70_000);
    expect(after.events.slice(-3).map((e) => e.kind)).toEqual(['break', 'exchange', 'access']);
  });

  it('доступ после обмена на перерыве — фактическое время в журнале', () => {
    const st = finishBreak(inBreak(full(afterTrial())), T + 30_000).state;
    const after = finishAccess(nextStep(st, T + 30_000).state, T + 70_000);
    expect(after.events.at(-1)).toEqual({ kind: 'access', startedAt: iso(T + 30_000), endedAt: iso(T + 70_000) });
  });

  it('ни перерыв, ни доступ не съедают рабочее время: лимит не наступает', () => {
    // работа идёт с BASE_MS; к T отработано 2 с, лимит 10 с; перерыв 30 с и доступ 40 с — вне рабочего времени
    const st = inBreak({ ...full(afterTrial()), timeLimitMs: 10_000 });
    const access = nextStep(finishBreak(st, T + 30_000).state, T + 30_000);
    expect(access.step.kind).toBe('access');
    const after = finishAccess(access.state, T + 70_000);
    expect(nextStep(after, T + 70_000).step.kind).toBe('trial');
  });

  it('контроль: те же 70 с без перерыва и доступа — лимит наступает', () => {
    const st = { ...full(afterTrial()), timeLimitMs: 10_000 };
    expect(nextStep(st, T + 70_000).step).toMatchObject({ kind: 'end', reason: 'time_limit' });
  });

  it('перерыв, предложенный приложением (device_offer), — без обмена и доступа (№170): иначе «молчание → перерыв → подкрепитель»', () => {
    const st = inBreak(full(afterTrial()), { kind: 'break', initiatedBy: 'device_offer', maxMs: 90_000 });
    const done = finishBreak(st, T + 30_000);
    expect(done.exchanged).toBe(0);
    expect(done.state.queue.some((q) => q.kind === 'access')).toBe(false);
    expect(done.state.board.earned).toBe(st.board.earned);
  });
});

describe('перерыв без обмена — без доступа (№161, №169)', () => {
  const cases: [string, (st: AbaSessionState) => AbaSessionState][] = [
    ['просьба ребёнка (child_card)', (st) => inBreak(full(st), { kind: 'break', initiatedBy: 'child_card', maxMs: 90_000 })],
    ['карточка после отказа (cardTaken)', (st) => inBreak(full(st), { kind: 'break', initiatedBy: 'adult', cardTaken: true, maxMs: 90_000 })],
    ['обучающий перерыв по карточке (training)', (st) => inBreak(full(st), { kind: 'break', initiatedBy: 'child_card', training: true, maxMs: 20_000 })],
    // при устаревшем подкрепителе экран сначала просит выбор, перерыв начинается без `nextStep`
    ['подкрепитель устарел (reinforcerStale)', (st) => ({ ...full(st), reinforcerStale: true, queue: [SCHEDULE, ...st.queue], breakStartedAt: T })],
    ['неполная доска', (st) => inBreak(almostFull(st))],
  ];

  it.each(cases)('%s: обмена нет, доступа в очереди нет, жетоны на месте', (_name, setup) => {
    const st = setup(afterTrial());
    const done = finishBreak(st, T + 30_000);
    expect(done.exchanged).toBe(0);
    expect(done.state.queue.some((q) => q.kind === 'access')).toBe(false);
    expect(done.state.events.some((e) => e.kind === 'exchange' || e.kind === 'access')).toBe(false);
    expect(done.state.board.earned).toBe(st.board.earned);
    expect(done.state.exchangesMade).toBe(st.exchangesMade);
  });

  /**
   * БАГ (найден при проверке №169). Тихая пауза после «Отказ», когда ребёнок не коснулся карточки
   * (`initiatedBy: 'adult'`, `offerCardMs`, без `cardTaken`), при полной доске кончается обменом, а теперь и
   * доступом к подкрепителю `EXCHANGE_ACCESS_MS` (40 с на доске 3). ABA.md, решения методиста по блоку 4, п. 1:
   * тихая пауза — «без жетонов, подкрепителей и внимания»; иначе проблемное поведение (отказ без карточки)
   * подкрепляется доступом, а функциональная просьба (карточка, №161) — нет: отказ становится выгоднее карточки.
   * Причина: `finishBreak` (abaSession.ts) исключает из обмена только `child_card` и `cardTaken`; экран
   * (`session.tsx`, ветка `offerCardMs` → `endBreak`) кончает паузу через `finishBreak` и показывает обмен и доступ.
   * Решение — за методистом (`aba-pedagogy-specialist`): исключить паузу после отказа из обмена, как карточку.
   */
  it('тихая пауза после «Отказ» без карточки при полной доске не даёт доступа к подкрепителю', () => {
    // настоящий путь: первый «Отказ» в пробе (исход журнала `refusal`) при полной доске
    const st = full(afterTrial());
    const next = nextStep(st, T);
    if (next.step.kind !== 'trial') throw new Error(`ждали пробу, а шаг ${next.step.kind}`);
    const input = correctInput(next.state, next.step);
    const { respondedAt: _drop, ...shown } = input.presentationLog[0];
    const res = recordTrial(next.state, { ...input, presentationLog: [{ ...shown, outcome: 'refusal' }] }, T);
    if (!res.ok) throw new Error(res.errors.join('; '));
    const pause = nextStep(res.state, T + 1);
    expect(pause.step).toMatchObject({ kind: 'break', initiatedBy: 'adult', maxMs: REFUSAL_QUIET_MS, offerCardMs: REFUSAL_CARD_OFFER_MS });
    // карточки не коснулся — экран кончает паузу `finishBreak` (session.tsx, ветка `offerCardMs`)
    const done = finishBreak(pause.state, T + 1 + REFUSAL_CARD_OFFER_MS);
    expect(done.state.queue.some((q) => q.kind === 'access')).toBe(false);
  });
});

describe('перерыв, оборванный концом сессии, пишется (№169, п. 2)', () => {
  const breaks: [string, BreakItem, Record<string, unknown>][] = [
    ['по расписанию', SCHEDULE, { initiatedBy: 'schedule' }],
    ['просьба между пробами', { kind: 'break', initiatedBy: 'child_card', between: true, maxMs: 90_000 }, { initiatedBy: 'child_card', between: true }],
    ['карточка после отказа', { kind: 'break', initiatedBy: 'adult', cardTaken: true, maxMs: 90_000 }, { initiatedBy: 'adult', cardTaken: true }],
    ['обучающий по карточке', { kind: 'break', initiatedBy: 'child_card', training: true, maxMs: 20_000 }, { initiatedBy: 'child_card', training: true }],
  ];
  const END = T + 45_000;
  const breakEvent = (flags: Record<string, unknown>) => ({ kind: 'break', startedAt: iso(T), endedAt: iso(END), ...flags });

  it.each(breaks)('withdrawAssent во время перерыва (%s): событие перерыва со всеми флагами, конец = сейчас', (_n, item, flags) => {
    const r = withdrawAssent(inBreak(afterTrial(), item), END, 'device_inactivity');
    expect(r.events.filter((e) => e.kind === 'break')).toEqual([breakEvent(flags)]);
  });

  it.each(breaks)('stopSession во время перерыва (%s): событие перерыва со всеми флагами, конец = сейчас', (_n, item, flags) => {
    const r = stopSession(inBreak(afterTrial(), item), 'adult_stopped', END);
    expect(r.events.filter((e) => e.kind === 'break')).toEqual([breakEvent(flags)]);
  });

  it('флаги, которых у перерыва нет, в событие не попадают', () => {
    const r = withdrawAssent(inBreak(afterTrial()), END, 'adult_observed');
    const ev = r.events.find((e) => e.kind === 'break')!;
    expect(Object.keys(ev).sort()).toEqual(['endedAt', 'initiatedBy', 'kind', 'startedAt']);
  });

  it('withdrawAssent: перерыв в журнале раньше отказа', () => {
    const r = withdrawAssent(inBreak(afterTrial()), END, 'adult_observed');
    expect(r.events.slice(-2).map((e) => e.kind)).toEqual(['break', 'assent']);
  });

  it('оборванный перерыв не меняет доску: обмена в момент обрыва нет даже при полной доске', () => {
    const st = inBreak(full(afterTrial()));
    const r = withdrawAssent(st, END, 'adult_observed');
    expect(r.events.some((e) => e.kind === 'exchange')).toBe(false);
    expect(r.board).toEqual(st.board);
  });

  it('конец не в перерыве — события перерыва нет', () => {
    expect(withdrawAssent(afterTrial(), END, 'adult_observed').events.some((e) => e.kind === 'break')).toBe(false);
    expect(stopSession(afterTrial(), 'adult_stopped', END).events.some((e) => e.kind === 'break')).toBe(false);
  });

  it('stopSession без времени — события перерыва нет (старый вызов не пишет выдуманную длительность)', () => {
    expect(stopSession(inBreak(afterTrial()), 'adult_stopped').events.some((e) => e.kind === 'break')).toBe(false);
  });

  it('в итоге сессии оборванный перерыв ровно один', () => {
    const st = stopSession(inBreak(afterTrial()), 'adult_stopped', END);
    expect(finishSession(st, END + 1000).session.events.filter((e) => e.kind === 'break')).toHaveLength(1);
  });
});

describe('конец по бездействию устройства (№169, п. 4)', () => {
  // нет возврата после двух приглашений на перерыве по расписанию при полной доске
  const inactive = () => withdrawAssent(inBreak(full(afterTrial())), T + 90_000, 'device_inactivity');

  it('обмена в конце нет: exchanged 0, события обмена нет', () => {
    const r = finishSession(inactive(), T + 91_000);
    expect(r.exchanged).toBe(0);
    expect(r.session.events.some((e) => e.kind === 'exchange')).toBe(false);
  });

  it('цикла сопряжения нет: ни в шаге конца, ни в журнале', () => {
    const st = inactive();
    expect(nextStep(st, T + 90_000).step).toMatchObject({ kind: 'end', reason: 'assent_withdrawn', pairingCycle: false, pairingCycleAfterMs: 0 });
    expect(finishSession(st, T + 91_000).session.events.some((e) => e.kind === 'pairing')).toBe(false);
  });

  it('exchangesMade не растёт: ступень доски не засчитывает обмен, которого не было', () => {
    const st = inactive();
    expect(finishSession(st, T + 91_000).session.exchangesMade).toBe(st.exchangesMade);
  });

  it('доска ждёт следующей сессии: жетоны на месте', () => {
    const st = inactive();
    expect(finishSession(st, T + 91_000).board.earned).toBe(st.board.size);
  });

  it('не после перерыва (бездействие в пробе) — тоже без обмена и без сопряжения', () => {
    const r = finishSession(withdrawAssent(full(afterTrial()), T, 'device_inactivity'), T + 1000);
    expect([r.exchanged, r.session.events.some((e) => e.kind === 'pairing')]).toEqual([0, false]);
  });

  it('ступень доски не решает: отсутствие ребёнка — не «ноль обменов» (№170)', () => {
    const st = withdrawAssent(full(afterTrial({ tokenTraining: trained(3) })), T, 'device_inactivity');
    expect(finishSession(st, T + 1000).tokenTraining).toEqual(st.tokenTraining);
    // для сравнения: отказ, замеченный взрослым, в ступень идёт
    const refused = withdrawAssent(full(afterTrial({ tokenTraining: trained(3) })), T, 'adult_observed');
    expect(finishSession(refused, T + 1000).tokenTraining.atStage).toHaveLength(refused.tokenTraining.atStage.length + 1);
  });
});

describe('конец по отказу и цикл сопряжения (№169, п. 5)', () => {
  it('отказ (adult_observed) с полной доской: обмен в конце есть', () => {
    const st = withdrawAssent(full(afterTrial()), T, 'adult_observed');
    const r = finishSession(st, T + 1000);
    expect(r.exchanged).toBe(st.board.size);
    expect(r.session.events.some((e) => e.kind === 'exchange')).toBe(true);
  });

  it('отказ с полной доской: цикла сопряжения нет — ни в шаге конца, ни в журнале', () => {
    const st = withdrawAssent(full(afterTrial()), T, 'adult_observed');
    expect(nextStep(st, T).step).toMatchObject({ kind: 'end', pairingCycle: false });
    expect(finishSession(st, T + 1000).session.events.some((e) => e.kind === 'pairing')).toBe(false);
  });

  it('отказ, оборвавший перерыв по расписанию с полной доской: обмен в конце, не на перерыве', () => {
    const r = finishSession(withdrawAssent(inBreak(full(afterTrial())), T + 10_000, 'adult_observed'), T + 11_000);
    const kinds = r.session.events.map((e) => e.kind);
    expect(kinds.indexOf('exchange')).toBeGreaterThan(kinds.indexOf('assent'));
    expect(r.exchanged).toBeGreaterThan(0);
  });

  it('отказ с неполной доской в учебной сессии: цикла сопряжения нет ни в шаге конца, ни в журнале (№170)', () => {
    const st = withdrawAssent(almostFull(afterTrial()), T, 'adult_observed');
    expect(nextStep(st, T).step).toMatchObject({ kind: 'end', pairingCycle: false });
    expect(finishSession(st, T + 1000).session.events.some((e) => e.kind === 'pairing')).toBe(false);
  });

  it('отказ с неполной доской, только базовая линия: цикл сопряжения есть, как при обычном конце', () => {
    const st = withdrawAssent(almostFull(afterTrial({ targets: [tgt('N')], states: {} })), T, 'adult_observed');
    expect(st.teachingTargetIds).toHaveLength(0);
    expect(nextStep(st, T).step).toMatchObject({ kind: 'end', pairingCycle: true });
    expect(finishSession(st, T + 1000).session.events.some((e) => e.kind === 'pairing')).toBe(true);
  });

  it('только базовая линия, доска не полная, конец по плану: цикл сопряжения есть', () => {
    const { state, end } = driveToEnd(afterTrial({ targets: [tgt('N')], states: {} }));
    expect(state.teachingTargetIds).toHaveLength(0);
    expect(state.endReason).toBe('completed');
    expect(end.pairingCycle).toBe(true);
    expect(finishSession(state, T + 99_000).session.events.some((e) => e.kind === 'pairing')).toBe(true);
  });

  it('только базовая линия, полная доска, конец по плану: обмен есть, сопряжения нет', () => {
    const { state, end } = driveToEnd(full(afterTrial({ targets: [tgt('N')], states: {} })));
    expect(end.pairingCycle).toBe(false);
    const r = finishSession(state, T + 99_000);
    expect(r.exchanged).toBeGreaterThan(0);
    expect(r.session.events.some((e) => e.kind === 'pairing')).toBe(false);
  });

  it('шаг конца и журнал итога согласованы по сопряжению при любой из причин', () => {
    const variants = [
      withdrawAssent(full(afterTrial()), T, 'adult_observed'),
      withdrawAssent(almostFull(afterTrial()), T, 'adult_observed'),
      withdrawAssent(almostFull(afterTrial()), T, 'device_inactivity'),
      withdrawAssent(almostFull(afterTrial()), T, 'child_card'),
      stopSession(full(afterTrial()), 'adult_stopped', T),
    ];
    for (const st of variants) {
      const step = nextStep(st, T).step;
      if (step.kind !== 'end') throw new Error(`ждали конец, а шаг ${step.kind}`);
      expect(finishSession(st, T + 1000).session.events.some((e) => e.kind === 'pairing')).toBe(step.pairingCycle);
    }
  });
});
