/**
 * Решение методиста 16 (2026-11-18, к порядку №161): доска полна перед перерывом по расписанию — обмен и доступ сразу,
 * затем перерыв по плану. Перерыв по карточке ребёнка обмена по-прежнему не даёт; неполная доска идёт на перерыв как
 * есть; начатый перерыв доступом не перебивается.
 */
import { CHILD_BREAK_MS } from '../../types/aba';
import {
  chooseReinforcer,
  finishAccess,
  finishBreak,
  nextStep,
  requestBreakBetweenTrials,
  type AbaSessionState,
} from '../abaSession';
import { EXCHANGE_ACCESS_MS, type BoardStage } from '../abaTokenTraining';
import { answerNext, BASE_MS, beginSession } from './abaSessionDriver';

type BreakItem = Extract<AbaSessionState['queue'][number], { kind: 'break' }>;

const T = BASE_MS + 2000;
const SCHEDULE: BreakItem = { kind: 'break', maxMs: 30_000 };

const afterTrial = (): AbaSessionState => answerNext(beginSession(), BASE_MS + 1000).state;
const withBoard = (st: AbaSessionState, earned: number): AbaSessionState => ({ ...st, board: { ...st.board, earned } });
const full = (st: AbaSessionState) => withBoard(st, st.board.size);
const withHead = (st: AbaSessionState, item: BreakItem): AbaSessionState => ({ ...st, queue: [item, ...st.queue] });
const exchanges = (st: AbaSessionState) => st.events.filter((e) => e.kind === 'exchange');

describe('решение 16: полная доска перед перерывом по расписанию — обмен и доступ до него', () => {
  it('следующий шаг — доступ по ступени, перерыв по плану сразу за ним', () => {
    const st = withHead(full(afterTrial()), SCHEDULE);
    const next = nextStep(st, T);
    expect(next.step).toEqual({ kind: 'access', durationMs: EXCHANGE_ACCESS_MS[st.board.size as BoardStage] });
    expect(next.state.queue.slice(0, 2)).toEqual([{ kind: 'access', durationMs: EXCHANGE_ACCESS_MS[st.board.size as BoardStage] }, SCHEDULE]);
    expect(next.state.breakStartedAt).toBeNull();
  });

  it('один обмен: событие, exchangesMade + 1, ожидание сцены (№181), доска пуста', () => {
    const st = withHead(full(afterTrial()), SCHEDULE);
    const next = nextStep(st, T);
    expect(next.exchanged).toBe(st.board.size);
    expect(exchanges(next.state)).toHaveLength(1);
    expect(next.state.exchangesMade).toBe(st.exchangesMade + 1);
    expect(next.state.pendingExchange).toEqual({ at: T, tokens: st.board.size, nonContingent: st.board.nonContingent });
    expect(next.state.board.earned).toBe(0);
  });

  it('повторный nextStep в доступе второго обмена не даёт', () => {
    const once = nextStep(withHead(full(afterTrial()), SCHEDULE), T);
    const again = nextStep(once.state, T + 500);
    expect([again.step.kind, again.exchanged, exchanges(again.state).length]).toEqual(['access', 0, 1]);
  });

  it('после доступа — перерыв без обмена; журнал: обмен, доступ, перерыв', () => {
    const accessed = finishAccess(nextStep(withHead(full(afterTrial()), SCHEDULE), T).state, T + 40_000);
    const brk = nextStep(accessed, T + 40_000);
    expect(brk.step).toMatchObject({ kind: 'break', canExchange: false });
    const done = finishBreak(brk.state, T + 70_000);
    expect(done.exchanged).toBe(0);
    expect(done.state.queue.some((q) => q.kind === 'access')).toBe(false);
    expect(done.state.events.slice(-3).map((e) => e.kind)).toEqual(['exchange', 'access', 'break']);
    expect(done.state.events.at(-1)).toMatchObject({ kind: 'break', initiatedBy: 'schedule' });
  });

  it('подкрепитель устарел: сначала выбор, после выбора — обмен и доступ, потом перерыв', () => {
    const st: AbaSessionState = { ...withHead(full(afterTrial()), SCHEDULE), immediateExchange: false, reinforcerStale: true };
    expect(nextStep(st, T).step.kind).toBe('choose_reinforcer');
    const chosen = chooseReinforcer(st, st.reinforcerOptions[0], T);
    const next = nextStep(chosen, T + 100);
    expect(next.step.kind).toBe('access');
    expect(next.state.queue[1]).toEqual(SCHEDULE);
  });
});

describe('решение 16: без обмена перед перерывом', () => {
  it('неполная доска — сразу перерыв, жетоны на месте', () => {
    const st = withHead(withBoard(afterTrial(), 1), SCHEDULE);
    const next = nextStep(st, T);
    expect(next.step).toMatchObject({ kind: 'break', canExchange: false });
    expect([next.exchanged, next.state.board.earned, next.state.exchangesMade]).toEqual([0, 1, st.exchangesMade]);
    expect(finishBreak(next.state, T + 30_000).exchanged).toBe(0);
  });

  it('перерыв по карточке ребёнка при полной доске — ни до, ни после обмена нет', () => {
    const st = withHead(full(afterTrial()), { kind: 'break', initiatedBy: 'child_card', between: true, maxMs: 90_000 });
    const next = nextStep(st, T);
    expect(next.step.kind).toBe('break');
    expect(next.exchanged).toBe(0);
    const done = finishBreak(next.state, T + 30_000);
    expect([done.exchanged, done.state.board.earned]).toEqual([0, st.board.size]);
    expect(exchanges(done.state)).toHaveLength(0);
  });

  it('просьба карточкой перед перерывом по расписанию — перерыв становится просьбой, обмена нет', () => {
    const asked = requestBreakBetweenTrials(withHead(full(afterTrial()), SCHEDULE), T);
    const next = nextStep(asked, T + 100);
    expect(next.step).toMatchObject({ kind: 'break', initiatedBy: 'child_card' });
    expect(next.exchanged).toBe(0);
    expect(finishBreak(next.state, T + 30_000).exchanged).toBe(0);
  });

  it('тихая пауза после «Отказ» с карточкой (cardTaken) — без обмена', () => {
    const st = withHead(full(afterTrial()), { kind: 'break', initiatedBy: 'adult', cardTaken: true, maxMs: 60_000 });
    const next = nextStep(st, T);
    expect([next.step.kind, next.exchanged]).toEqual(['break', 0]);
  });

  it('начатый перерыв по расписанию (возврат из фона) доступом не перебивается', () => {
    const st: AbaSessionState = { ...withHead(full(afterTrial()), SCHEDULE), breakStartedAt: T };
    const next = nextStep(st, T + 5000);
    expect([next.step.kind, next.exchanged, next.state.queue[0]]).toEqual(['break', 0, SCHEDULE]);
    // запасной путь: доска так и полна в конце перерыва — обмен в `finishBreak`, доступ следом (прежний порядок)
    const done = finishBreak(next.state, T + 30_000);
    expect(done.exchanged).toBe(st.board.size);
    expect(done.state.queue[0]).toMatchObject({ kind: 'access' });
  });
});

describe('решение 16: просьба карточкой во время доступа перед перерывом', () => {
  it('просьба удовлетворяется плановым перерывом — один перерыв, не два подряд', () => {
    const inAccess = nextStep(withHead(full(afterTrial()), SCHEDULE), T).state;
    const asked = requestBreakBetweenTrials(inAccess, T + 1000);
    expect(asked.queue.slice(0, 2)).toEqual([
      inAccess.queue[0],
      { kind: 'break', initiatedBy: 'child_card', between: true, maxMs: Math.max(30_000, CHILD_BREAK_MS[asked.band]) },
    ]);
    const breaks = (st: AbaSessionState) => st.queue.filter((q) => q.kind === 'break').length;
    expect(breaks(asked)).toBe(breaks(inAccess));
    expect(asked.childBreaks).toBe(inAccess.childBreaks + 1);
  });

  it('за доступом проба, а не перерыв — перерыв ребёнка встаёт после доступа, как раньше', () => {
    const st = full(afterTrial());
    const inAccess: AbaSessionState = { ...st, queue: [{ kind: 'access', durationMs: 40_000 }, ...st.queue] };
    const asked = requestBreakBetweenTrials(inAccess, T);
    expect(asked.queue[1]).toMatchObject({ kind: 'break', initiatedBy: 'child_card', between: true });
    expect(asked.queue.length).toBe(inAccess.queue.length + 1);
  });
});
