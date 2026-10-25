/**
 * Сворачивание и конец до работы (`aba-pedagogy-specialist` 2026-10-25, правила 2, 6, 10): свёрнутое время не
 * рабочее, после 2 мин — новый выбор сразу, дольше 30 мин — брошено; отказ до выбора — без цикла сопряжения;
 * остановка во время доступа пишет доступ.
 */
import {
  AWAY_ABANDON_MS,
  AWAY_RECHOOSE_MS,
  awayOutcome,
  chooseReinforcer,
  nextStep,
  resumeAbaSession,
  stopSession,
  withdrawAssent,
} from '../abaSession';
import { BASE_MS, beginSession, startedSession } from './abaSessionDriver';

const LIVE = { earned: 0, nonContingent: 0, rev: 1 };
const OPTIONS = ['bubbles', 'drum', 'puzzle'];

describe('возврат после сворачивания', () => {
  it('awayOutcome: < 2 мин — та же проба; 2–30 мин — новый выбор; дольше или другой день — брошено', () => {
    expect(awayOutcome(AWAY_RECHOOSE_MS - 1)).toBe('same_trial');
    expect(awayOutcome(AWAY_RECHOOSE_MS)).toBe('rechoose');
    expect(awayOutcome(AWAY_ABANDON_MS)).toBe('rechoose');
    expect(awayOutcome(AWAY_ABANDON_MS + 1)).toBe('abandon');
    expect(awayOutcome(1000, false)).toBe('abandon');
  });

  it('свёрнутое время вычитается из рабочего: 10 мин в фоне не доводят сессию до лимита', () => {
    const st = beginSession();
    const away = 10 * 60_000;
    const r = resumeAbaSession(st, LIVE, { routineExchanged: false, awayMs: away, options: OPTIONS });
    expect(r.pausedMs).toBe(st.pausedMs + away);
    const step = nextStep(r, BASE_MS + away + 1000).step;
    expect(step.kind === 'end' && step.reason === 'time_limit').toBe(false);
  });

  it('до 2 мин — подкрепитель прежний, выбора нет', () => {
    const r = resumeAbaSession(beginSession(), LIVE, { routineExchanged: false, awayMs: 60_000 });
    expect([r.reinforcerStale, r.rechooseNow]).toEqual([undefined, undefined]);
  });

  it('2–30 мин — выбор из трёх сразу; после выбора флаги сняты', () => {
    const st = beginSession();
    const r = resumeAbaSession(st, LIVE, { routineExchanged: false, awayMs: 5 * 60_000, options: OPTIONS });
    expect(r.rechooseNow).toBe(true);
    const next = nextStep(r, BASE_MS + 5 * 60_000 + 1000);
    expect(next.step).toMatchObject({ kind: 'choose_reinforcer', options: OPTIONS });
    const chosen = chooseReinforcer(next.state, OPTIONS[1], BASE_MS + 5 * 60_000 + 2000);
    expect([chosen.reinforcerId, chosen.reinforcerStale, chosen.rechooseNow]).toEqual([OPTIONS[1], undefined, undefined]);
  });

  it('новый выбор без вариантов — ошибка программы', () => {
    expect(() => resumeAbaSession(beginSession(), LIVE, { routineExchanged: false, awayMs: 5 * 60_000 })).toThrow();
  });
});

describe('конец до работы и остановка во время доступа', () => {
  it('отказ до выбора подкрепителя — без цикла сопряжения', () => {
    const st = withdrawAssent(startedSession(), BASE_MS + 60_000, 'device_inactivity');
    const step = nextStep(st, BASE_MS + 61_000).step;
    expect(step).toMatchObject({ kind: 'end', reason: 'assent_withdrawn', pairingCycle: false });
  });

  it('отказ после начала работы — цикл сопряжения остаётся', () => {
    const st = withdrawAssent(beginSession(), BASE_MS + 60_000, 'child_card');
    expect(nextStep(st, BASE_MS + 61_000).step).toMatchObject({ kind: 'end', pairingCycle: true });
  });

  it('остановка во время доступа пишет событие доступа', () => {
    const st = { ...beginSession(), accessStartedAt: BASE_MS + 10_000 };
    const stopped = stopSession(st, 'adult_stopped', BASE_MS + 25_000);
    expect(stopped.events.at(-1)).toEqual({ kind: 'access', startedAt: new Date(BASE_MS + 10_000).toISOString(), endedAt: new Date(BASE_MS + 25_000).toISOString() });
    expect(stopped.accessStartedAt).toBeNull();
  });
});
