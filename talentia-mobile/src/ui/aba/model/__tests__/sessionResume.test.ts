/**
 * Чистые правила возврата на экран сессии после сворачивания (фаза 8, `model/sessionResume.ts`): обмен, которого ребёнок
 * не видел; перерыв с остатка; доступ до и после T; записи хвоста конца и как он продолжается на возврате.
 */
import { abaAccessScene } from '../../../../design/abaTokens';
import { AWAY_RECHOOSE_MS, type AbaSessionState } from '../../../../domain/abaSession';
import { accessDueAt, startAccess } from '../accessRun';
import { startExchange } from '../exchangeRun';
import { accessSceneOnStop, accessScenesAtEnd, tailStepOf, type AccessScene, type Phase } from '../sessionPhase';
import {
  accessOnReturn,
  breakOnReturn,
  exchangePendingOnResume,
  exchangeUnseen,
  RESUME_RING_MIN_MS,
  tailOnEnd,
  tailOnLeave,
  tailOnReturn,
  tailOnSceneStart,
  type TailFacts,
} from '../sessionResume';

const T0 = Date.UTC(2026, 10, 6, 9, 0);
const iso = (ms: number) => new Date(ms).toISOString();
const stateWith = (over: Partial<AbaSessionState>): AbaSessionState => ({ queue: [], accessStartedAt: null, ...over }) as unknown as AbaSessionState;

describe('exchangePendingOnResume', () => {
  it('голова очереди — доступ, а доступ не начат: обмен показывается заново', () => {
    expect(exchangePendingOnResume(stateWith({ queue: [{ kind: 'access', durationMs: 20_000 }] as AbaSessionState['queue'] }))).toBe(true);
  });

  it('доступ уже начат — обмена заново нет', () => {
    expect(exchangePendingOnResume(stateWith({ queue: [{ kind: 'access', durationMs: 20_000 }] as AbaSessionState['queue'], accessStartedAt: T0 }))).toBe(false);
  });

  it('голова очереди — не доступ (проба, перерыв, пусто) — обмена нет', () => {
    expect(exchangePendingOnResume(stateWith({ queue: [{ kind: 'break' }] as AbaSessionState['queue'] }))).toBe(false);
    expect(exchangePendingOnResume(stateWith({ queue: [] }))).toBe(false);
  });
});

describe('exchangeUnseen', () => {
  it('отметки начала доступа нет — то же состояние: откатывать нечего, рабочее время не меняется', () => {
    const s = stateWith({ accessStartedAt: null, pausedMs: 7000 });
    expect(exchangeUnseen(s, T0 + 5000)).toBe(s);
  });

  it('отметка есть — снята: возврат покажет обмен и даст доступ целиком', () => {
    const s = stateWith({ queue: [{ kind: 'access', durationMs: 20_000 }] as AbaSessionState['queue'], accessStartedAt: T0, pausedMs: 0 });
    const out = exchangeUnseen(s, T0 + 1500);
    expect(out.accessStartedAt).toBeNull();
    expect(exchangePendingOnResume(out)).toBe(true);
  });

  it('время от отметки до ухода уходит в pausedMs: кадр обмена — не работа, как и весь шаг доступа', () => {
    const s = stateWith({ accessStartedAt: T0, pausedMs: 7000 });
    expect(exchangeUnseen(s, T0 + 1500).pausedMs).toBe(8500);
  });

  it('уход в тот же момент, что отметка: pausedMs не меняется, отметка снята', () => {
    const out = exchangeUnseen(stateWith({ accessStartedAt: T0, pausedMs: 7000 }), T0);
    expect([out.accessStartedAt, out.pausedMs]).toEqual([null, 7000]);
  });

  it('часы ушли назад (at раньше отметки): pausedMs не уменьшается', () => {
    expect(exchangeUnseen(stateWith({ accessStartedAt: T0, pausedMs: 7000 }), T0 - 1000).pausedMs).toBe(7000);
  });

  it('исходное состояние не мутируется', () => {
    const s = stateWith({ accessStartedAt: T0, pausedMs: 0 });
    exchangeUnseen(s, T0 + 1000);
    expect([s.accessStartedAt, s.pausedMs]).toEqual([T0, 0]);
  });
});

describe('breakOnReturn', () => {
  const MAX = 90_000;

  it('остаток ≥ 5 с — кольцо с того же начала (invite 0), кадр и tick — момент возврата', () => {
    const now = T0 + MAX - RESUME_RING_MIN_MS;
    expect(breakOnReturn({ startedAt: T0, maxMs: MAX, now })).toEqual({ startedAt: T0, shownAt: now, until: T0 + MAX, tick: now, invite: 0, inviteAt: null });
  });

  it('остаток < 5 с — сразу первое приглашение, inviteAt — момент возврата, until — исходный срок', () => {
    const now = T0 + MAX - RESUME_RING_MIN_MS + 1;
    expect(breakOnReturn({ startedAt: T0, maxMs: MAX, now })).toEqual({ startedAt: T0, shownAt: now, until: T0 + MAX, tick: now, invite: 1, inviteAt: now });
  });

  it('срок вышел в фоне — первое приглашение с inviteAt = now: бездействие считается от возврата', () => {
    const now = T0 + MAX + 10 * 60_000;
    expect(breakOnReturn({ startedAt: T0, maxMs: MAX, now })).toMatchObject({ invite: 1, inviteAt: now, until: T0 + MAX, shownAt: now });
  });
});

describe('accessOnReturn', () => {
  const A = T0;
  const D = 20_000;
  const base = { accessStartedAt: A, durationMs: D, still: false };

  it('до T: сцена продолжается с остатка — play, отрезок до ухода, sceneFrom = now; эффектов (cue) наружу нет', () => {
    const r = accessOnReturn({ ...base, leftAt: A + 5000, now: A + 16_000 });
    expect(r.run).toMatchObject({ stage: 'play', startedAt: A, durationMs: D, cued: true });
    expect(r.scenes).toEqual([{ startedAt: A, endedAt: A + 5000, endUnknown: true }]);
    expect(r.sceneFrom).toBe(A + 16_000);
    expect('effects' in r).toBe(false);
  });

  it('до T и до «закругляемся»: cued ещё false — подсказка прозвучит в свой срок', () => {
    const r = accessOnReturn({ ...base, leftAt: A + 2000, now: A + 8000 });
    expect(r.run).toMatchObject({ stage: 'play', cued: false });
    expect(accessDueAt(r.run)).toBe(A + D - abaAccessScene.endCue.beforeEndMs);
  });

  it('после T: стадия hold, кадр конца endSettleMs от возврата, сцены больше нет (sceneFrom null)', () => {
    const now = A + D + 60_000;
    const r = accessOnReturn({ ...base, leftAt: A + 5000, now });
    expect(r.run).toMatchObject({ stage: 'hold', cued: true, startedAt: now, durationMs: 0 });
    expect(accessDueAt(r.run)).toBe(now + abaAccessScene.endSettleMs);
    expect(accessDueAt(r.run)).toBe(now + 1000);
    expect(r.sceneFrom).toBeNull();
    expect(r.scenes).toEqual([{ startedAt: A, endedAt: A + 5000, endUnknown: true }]);
  });

  it('ушли уже после T — отрезок обрезан по T', () => {
    const r = accessOnReturn({ ...base, leftAt: A + D + 3000, now: A + D + 30_000 });
    expect(r.scenes).toEqual([{ startedAt: A, endedAt: A + D, endUnknown: true }]);
  });

  it('холодный старт, leftAt не позже accessStartedAt: сцена шла (снимок ложится в её начале), конец неизвестен — отрезок нулевой длины с endUnknown (№181)', () => {
    expect(accessOnReturn({ ...base, leftAt: A - 1000, now: A + 3000 }).scenes).toEqual([{ startedAt: A, endedAt: A, endUnknown: true }]);
    expect(accessOnReturn({ ...base, leftAt: A, now: A + 3000 }).scenes).toEqual([{ startedAt: A, endedAt: A, endUnknown: true }]);
  });

  it('still (calm): run после T — calm, до T — still сессии', () => {
    expect(accessOnReturn({ ...base, still: true, leftAt: A + 1000, now: A + 2000 }).run.calm).toBe(true);
    expect(accessOnReturn({ ...base, still: false, leftAt: A + 1000, now: A + D + 2000 }).run.calm).toBe(true);
  });

  describe('delivered — отрезки, известные экрану (тёплый возврат)', () => {
    const shown: AccessScene[] = [{ startedAt: A + 2020, endedAt: A + 5000 }];

    it('до T: отрезки — как выдал экран, а не приближение от accessStartedAt', () => {
      const r = accessOnReturn({ ...base, leftAt: A + 5000, now: A + 9000, delivered: shown });
      expect(r.scenes).toEqual(shown);
      expect(r.sceneFrom).toBe(A + 9000);
      expect(r.run).toMatchObject({ stage: 'play', startedAt: A });
    });

    it('после T: отрезки те же, сцены больше нет — только кадр конца', () => {
      const r = accessOnReturn({ ...base, leftAt: A + 5000, now: A + D + 1000, delivered: shown });
      expect(r.scenes).toEqual(shown);
      expect(r.sceneFrom).toBeNull();
      expect(r.run.stage).toBe('hold');
    });

    it('два ухода: уже выданные два отрезка не склеиваются и идут по порядку', () => {
      const two: AccessScene[] = [...shown, { startedAt: A + 7000, endedAt: A + 9000 }];
      expect(accessOnReturn({ ...base, leftAt: A + 9000, now: A + 11_000, delivered: two }).scenes).toEqual(two);
    });

    it('пустой массив — ничего не выдано, а не «считай от accessStartedAt»: ушли на кадре конца без сцены', () => {
      expect(accessOnReturn({ ...base, leftAt: A + 5000, now: A + 6000, delivered: [] }).scenes).toEqual([]);
    });

    it('контроль: без delivered (холодный старт) — один отрезок от accessStartedAt с endUnknown', () => {
      expect(accessOnReturn({ ...base, leftAt: A + 5000, now: A + 6000 }).scenes).toEqual([{ startedAt: A, endedAt: A + 5000, endUnknown: true }]);
    });
  });
});

describe('tailOnReturn: таблица шагов и порога 2 минуты', () => {
  const L = T0;
  const JUST_BEFORE = L + AWAY_RECHOOSE_MS - 1;
  const AT_THRESHOLD = L + AWAY_RECHOOSE_MS;

  it('порог тот же, что у продолжения пробы: 2 минуты', () => {
    expect(AWAY_RECHOOSE_MS).toBe(120_000);
  });

  it.each([
    ['exchange', L, 'next'],
    ['exchange', JUST_BEFORE, 'next'],
    ['exchange', AT_THRESHOLD, 'end'],
    ['access', L, 'access'],
    ['access', JUST_BEFORE, 'access'],
    ['access', AT_THRESHOLD, 'end'],
    ['wait', L, 'end'],
    ['wait', JUST_BEFORE, 'end'],
    ['wait', AT_THRESHOLD, 'end'],
    ['pairing_token', L, 'end'],
    ['pairing_token', JUST_BEFORE, 'end'],
    ['pairing_token', AT_THRESHOLD, 'end'],
  ] as const)('шаг %s, возврат в %d — %s', (step, now, want) => {
    expect(tailOnReturn({ step, at: L }, now)).toBe(want);
  });

  it.each([L, JUST_BEFORE, AT_THRESHOLD, L + 3_600_000])('ушли на «Закончили» (шаг end): хвост идёт своим ходом при возврате в %d', (now) => {
    expect(tailOnReturn({ step: 'end', at: L }, now)).toBe('next');
  });

  it('ушли не на шаге хвоста (left = null): хвост идёт своим ходом', () => {
    expect(tailOnReturn(null, AT_THRESHOLD)).toBe('next');
  });

  it.each([
    [L, 'next'],
    [JUST_BEFORE, 'next'],
    [AT_THRESHOLD, 'end'],
  ] as const)('жетон цикла сел, возврат в %d — %s: купленный доступ идёт дальше по очереди, жетон не повторяется', (now, want) => {
    expect(tailOnReturn({ step: 'pairing_token', at: L }, now, true)).toBe(want);
  });

  it('севший жетон меняет только шаг жетона: ожидание и остальные шаги по прежней таблице', () => {
    expect(tailOnReturn({ step: 'wait', at: L }, JUST_BEFORE, true)).toBe('end');
    expect(tailOnReturn({ step: 'exchange', at: L }, JUST_BEFORE, true)).toBe('next');
    expect(tailOnReturn({ step: 'access', at: L }, JUST_BEFORE, true)).toBe('access');
  });
});

describe('tailStepOf: шаг хвоста, на котором свернули', () => {
  const exchange = (pairing: boolean): Phase => ({ kind: 'exchange', run: startExchange({ at: T0, cells: 1, calm: false }), tick: T0, pairing, next: 'tail', trace: false });

  it('обмен — exchange, жетон цикла сопряжения — pairing_token', () => {
    expect([tailStepOf(exchange(false)), tailStepOf(exchange(true))]).toEqual(['exchange', 'pairing_token']);
  });

  it('доступ — access, ожидание цикла — wait', () => {
    const access: Phase = { kind: 'access', run: startAccess(T0, 20_000, 0, false), tick: T0, tail: true, sceneEndedAt: null, trace: false, scenes: [], sceneFrom: T0 };
    expect([tailStepOf(access), tailStepOf({ kind: 'end_wait', until: T0 + 10_000 })]).toEqual(['access', 'wait']);
  });

  it.each<[string, Phase]>([
    ['запись (busy)', { kind: 'busy' }],
    ['свёрнуто (away)', { kind: 'away' }],
    ['«Закончили»', { kind: 'ended', variant: 'neutral', board: null }],
    ['загрузка', { kind: 'loading' }],
  ])('%s — не шаг хвоста: end', (_name, phase) => {
    expect(tailStepOf(phase)).toBe('end');
  });
});

describe('tailOnLeave / tailOnEnd', () => {
  const facts: TailFacts = { sessionId: 's1', accessScenes: [{ startedAt: T0, endedAt: T0 + 20_000 }], pairingTokenAt: T0 - 500 };

  it('tailOnLeave: шаг и момент ухода, факты в ISO, completed false', () => {
    expect(tailOnLeave('access', facts, T0 + 7000)).toEqual({
      sessionId: 's1',
      accessScene: [{ startedAt: iso(T0), endedAt: iso(T0 + 20_000) }],
      pairingTokenAt: iso(T0 - 500),
      leftAtStep: 'access',
      leftAt: iso(T0 + 7000),
      completed: false,
      sceneStarted: true,
    });
  });

  it('tailOnLeave на шаге end — leftAtStep null, но completed false и leftAt стоит', () => {
    expect(tailOnLeave('end', { ...facts, pairingTokenAt: null, accessScenes: [] }, T0)).toEqual({
      sessionId: 's1',
      accessScene: [],
      pairingTokenAt: null,
      leftAtStep: null,
      leftAt: iso(T0),
      completed: false,
      sceneStarted: false,
    });
  });

  it('tailOnLeave на обмене до сцены — sceneStarted false (№181: жетоны обмена в конце вернутся)', () => {
    expect(tailOnLeave('exchange', { ...facts, accessScenes: [] }, T0).sceneStarted).toBe(false);
  });

  it('tailOnLeave на доступе без выданных отрезков — sceneStarted true: шаг доступа и есть сцена', () => {
    expect(tailOnLeave('access', { ...facts, accessScenes: [] }, T0).sceneStarted).toBe(true);
  });

  it('tailOnLeave: wait, exchange, pairing_token проходят как есть', () => {
    expect(tailOnLeave('wait', facts, T0).leftAtStep).toBe('wait');
    expect(tailOnLeave('exchange', facts, T0).leftAtStep).toBe('exchange');
    expect(tailOnLeave('pairing_token', facts, T0).leftAtStep).toBe('pairing_token');
  });

  it('tailOnSceneStart: сцена хвоста началась — шаг access, ухода нет, sceneStarted true, completed false (№181)', () => {
    expect(tailOnSceneStart({ ...facts, accessScenes: [] })).toEqual({
      sessionId: 's1',
      accessScene: [],
      pairingTokenAt: iso(T0 - 500),
      leftAtStep: 'access',
      leftAt: null,
      completed: false,
      sceneStarted: true,
    });
  });

  it('tailOnSceneStart: уже выданные отрезки и жетон цикла — в ISO, как у строки ухода', () => {
    expect(tailOnSceneStart(facts)).toMatchObject({ accessScene: [{ startedAt: iso(T0), endedAt: iso(T0 + 20_000) }], pairingTokenAt: iso(T0 - 500), leftAt: null });
  });

  it('tailOnEnd: completed true, ухода нет', () => {
    expect(tailOnEnd(facts)).toEqual({
      sessionId: 's1',
      accessScene: [{ startedAt: iso(T0), endedAt: iso(T0 + 20_000) }],
      pairingTokenAt: iso(T0 - 500),
      leftAtStep: null,
      leftAt: null,
      completed: true,
    });
    expect(tailOnEnd({ sessionId: 's2', accessScenes: [], pairingTokenAt: null })).toMatchObject({ accessScene: [], pairingTokenAt: null, completed: true });
  });
});

describe('accessSceneOnStop и accessScenesAtEnd: отрезки сцены на выходе', () => {
  const given: AccessScene = { startedAt: T0, endedAt: T0 + 3000 };
  const access = (over: Partial<Extract<Phase, { kind: 'access' }>> = {}): Extract<Phase, { kind: 'access' }> => ({
    kind: 'access',
    run: startAccess(T0, 20_000, 0, false),
    tick: T0,
    tail: false,
    sceneEndedAt: null,
    trace: false,
    scenes: [],
    sceneFrom: T0,
    ...over,
  });
  const exchange = (next: Extract<Phase, { kind: 'exchange' }>['next']): Phase => ({ kind: 'exchange', run: startExchange({ at: T0, cells: 1, calm: false }), tick: T0, pairing: false, next, trace: false });

  it('экран обмена в ходе сессии: сцена не началась — null, доступа в журнале нет', () => {
    expect(accessSceneOnStop(exchange({ kind: 'access', durationMs: 20_000 }))).toBeNull();
  });

  it('обмен хвоста: итог уже записан — решения о сцене нет', () => {
    expect(accessSceneOnStop(exchange('tail'))).toBeUndefined();
  });

  const participation = (then: Extract<Phase, { kind: 'participation' }>['then']): Phase => ({ kind: 'participation', landAt: T0, landed: true, until: T0, earned: 1, field: null, then, breakAsked: false, gate: null });

  it('жетон за участие перед уже взятым шагом доступа: сцена не начиналась, доступа в журнале нет', () => {
    expect(accessSceneOnStop(participation({ kind: 'access', durationMs: 20_000 }))).toBeNull();
  });

  it('жетон за участие без взятого шага доступа: сцены нет, решает домен', () => {
    expect(accessSceneOnStop(participation(null))).toBeUndefined();
  });

  it('доступ без ухода: один открытый отрезок', () => {
    expect(accessSceneOnStop(access())).toEqual([{ startedAt: T0, endedAt: undefined }]);
  });

  it('второй отрезок после возврата: выданный не теряется, текущий открыт', () => {
    expect(accessSceneOnStop(access({ scenes: [given], sceneFrom: T0 + 9000 }))).toEqual([given, { startedAt: T0 + 9000, endedAt: undefined }]);
  });

  it('после T текущий отрезок кончается в T, а не в момент выхода', () => {
    expect(accessSceneOnStop(access({ sceneEndedAt: T0 + 20_000 }))).toEqual([{ startedAt: T0, endedAt: T0 + 20_000 }]);
  });

  it('кадр конца после возврата: сцены больше нет, только выданное', () => {
    expect(accessSceneOnStop(access({ scenes: [given], sceneFrom: null }))).toEqual([given]);
    expect(accessSceneOnStop(access({ scenes: [], sceneFrom: null }))).toEqual([]);
  });

  it('доступ хвоста: итог уже записан, отрезки идут в строку хвоста', () => {
    expect(accessSceneOnStop(access({ tail: true, scenes: [given] }))).toBeUndefined();
  });

  it.each<[string, Phase]>([
    ['запись', { kind: 'busy' }],
    ['свёрнуто', { kind: 'away' }],
    ['загрузка', { kind: 'loading' }],
  ])('%s: не доступ — весь шаг (undefined)', (_name, phase) => {
    expect(accessSceneOnStop(phase)).toBeUndefined();
  });

  it('accessScenesAtEnd: текущий отрезок закрыт концом шага, а после T — самим T', () => {
    expect(accessScenesAtEnd(access({ scenes: [given], sceneFrom: T0 + 9000 }), T0 + 15_000)).toEqual([given, { startedAt: T0 + 9000, endedAt: T0 + 15_000 }]);
    expect(accessScenesAtEnd(access({ sceneEndedAt: T0 + 20_000 }), T0 + 21_000)).toEqual([{ startedAt: T0, endedAt: T0 + 20_000 }]);
    expect(accessScenesAtEnd(access({ scenes: [given], sceneFrom: null }), T0 + 21_000)).toEqual([given]);
  });
});
