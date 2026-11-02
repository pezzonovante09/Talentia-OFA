/**
 * №171 (фаза 7, кадр конца): событие `access` в журнале — время самой сцены (от кадра, когда она отвечает, до T), без
 * экрана обмена, доигрывания и сворачивания; рабочее время (`pausedMs`) по-прежнему теряет весь шаг доступа.
 * Остановка: `null` — сцена не началась (экран обмена), доступа в журнале нет; объект — от начала сцены до
 * `endedAt ?? now`; без аргумента — весь шаг, как раньше.
 */
import { finishAccess, finishBreak, nextStep, stopSession, type AbaSessionState } from '../abaSession';
import { EXCHANGE_ACCESS_MS } from '../abaTokenTraining';
import { answerNext, BASE_MS, beginSession } from './abaSessionDriver';

const T = BASE_MS + 2000;
const iso = (ms: number) => new Date(ms).toISOString();

/** Полная доска, перерыв по расписанию кончился в `T + 30 с`, шаг доступа показан там же (`accessStartedAt`). */
function inAccess(over: Parameters<typeof beginSession>[0] = {}): AbaSessionState {
  const worked = answerNext(beginSession(over), BASE_MS + 1000).state;
  const full = { ...worked, board: { ...worked.board, earned: worked.board.size } };
  const shown = nextStep({ ...full, queue: [{ kind: 'break', maxMs: 30_000 }, ...full.queue] }, T).state;
  const next = nextStep(finishBreak(shown, T + 30_000).state, T + 30_000);
  expect(next.step.kind).toBe('access');
  expect(next.state.accessStartedAt).toBe(T + 30_000);
  return next.state;
}

const STEP = T + 30_000;
const DURATION = EXCHANGE_ACCESS_MS[3];
/** Обмен трёх ячеек: 1000 + 2·60 + 360 + 300 + 360. */
const SCENE_START = STEP + 2140;
const SCENE_END = SCENE_START + DURATION;
/** Сворачивание 360 + карточка 1000. */
const STEP_END = SCENE_END + 1360;
const lastAccess = (st: AbaSessionState) => st.events.filter((e) => e.kind === 'access').at(-1);

describe('finishAccess со сценой (№171)', () => {
  it('событие access — от начала сцены до T, ровно durationMs', () => {
    const after = finishAccess(inAccess(), STEP_END, { startedAt: SCENE_START, endedAt: SCENE_END });
    expect(lastAccess(after)).toEqual({ kind: 'access', startedAt: iso(SCENE_START), endedAt: iso(SCENE_END) });
    const e = lastAccess(after)!;
    expect(Date.parse(e.endedAt) - Date.parse(e.startedAt)).toBe(DURATION);
  });

  it('рабочее время теряет весь шаг: обмен и кадр конца — тоже не работа', () => {
    const st = inAccess();
    const after = finishAccess(st, STEP_END, { startedAt: SCENE_START, endedAt: SCENE_END });
    expect(after.pausedMs - st.pausedMs).toBe(STEP_END - STEP);
  });

  it('pausedMs не зависит от того, передана ли сцена', () => {
    const st = inAccess();
    expect(finishAccess(st, STEP_END, { startedAt: SCENE_START, endedAt: SCENE_END }).pausedMs).toBe(finishAccess(st, STEP_END).pausedMs);
  });

  it('без сцены — как раньше: весь шаг доступа', () => {
    const after = finishAccess(inAccess(), STEP_END);
    expect(lastAccess(after)).toEqual({ kind: 'access', startedAt: iso(STEP), endedAt: iso(STEP_END) });
  });

  it('после доступа очередь идёт дальше и accessStartedAt снят', () => {
    const after = finishAccess(inAccess(), STEP_END, { startedAt: SCENE_START, endedAt: SCENE_END });
    expect(after.accessStartedAt).toBeNull();
    expect(after.queue[0]?.kind).not.toBe('access');
  });

  it('длинный шаг (обмен + кадр конца) не приближает лимит времени работы', () => {
    const st = { ...inAccess(), timeLimitMs: 10_000 };
    const after = finishAccess(st, STEP_END, { startedAt: SCENE_START, endedAt: SCENE_END });
    expect(nextStep(after, STEP_END).step.kind).toBe('trial');
  });
});

describe('stopSession со сценой (№171)', () => {
  it('null — остановили на экране обмена: события access нет', () => {
    const st = stopSession(inAccess(), 'adult_stopped', STEP + 1500, null);
    expect(st.events.some((e) => e.kind === 'access')).toBe(false);
    expect(st.accessStartedAt).toBeNull();
    expect(st.endReason).toBe('adult_stopped');
  });

  it('сцена играет — доступ от начала сцены до остановки', () => {
    const now = SCENE_START + 7000;
    const st = stopSession(inAccess(), 'abandoned', now, { startedAt: SCENE_START });
    expect(lastAccess(st)).toEqual({ kind: 'access', startedAt: iso(SCENE_START), endedAt: iso(now) });
  });

  it('остановили на кадре конца — доступ до T, а не до остановки', () => {
    const st = stopSession(inAccess(), 'adult_stopped', SCENE_END + 900, { startedAt: SCENE_START, endedAt: SCENE_END });
    expect(lastAccess(st)).toEqual({ kind: 'access', startedAt: iso(SCENE_START), endedAt: iso(SCENE_END) });
  });

  it('без аргумента — как раньше: весь шаг доступа до остановки', () => {
    const st = stopSession(inAccess(), 'adult_stopped', STEP + 5000);
    expect(lastAccess(st)).toEqual({ kind: 'access', startedAt: iso(STEP), endedAt: iso(STEP + 5000) });
  });

  it('вне доступа сцена не создаёт события access', () => {
    const worked = answerNext(beginSession(), BASE_MS + 1000).state;
    expect(worked.accessStartedAt).toBeNull();
    const st = stopSession(worked, 'adult_stopped', T, { startedAt: BASE_MS, endedAt: T });
    expect(st.events.some((e) => e.kind === 'access')).toBe(false);
  });

  it('без времени остановки событий не добавляется даже со сценой', () => {
    const st = inAccess();
    expect(stopSession(st, 'adult_stopped', undefined, { startedAt: SCENE_START }).events).toEqual(st.events);
  });
});
