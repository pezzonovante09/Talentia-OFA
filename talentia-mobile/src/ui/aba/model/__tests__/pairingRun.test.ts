/**
 * Выбор тапом (Ц2.4) и сопряжение на экране (раздел 3): удержание 800 мс, полоса взрослого через 30 с с блоком
 * 500 мс, «Сам» — пульс в 30 с и конец в 60 с; жетон по таймеру 10 с, обмен одной ячейки (`exchangeRun`), событие
 * `token` — при открытии доступа, `access_done` — после кадра конца (№171);
 * четыре цикла, итог через настоящий домен.
 */
import { pairingResultOf, startPairing } from '../../../../domain/abaPairing';
import { PAIRING } from '../../../../domain/abaTokenTraining';
import { seeded } from '../../../../domain/abaRandom';
import { motion } from '../../../../design/tokens';
import { pairingRunDueAt, startPairingRun, stepPairingRun, type PairingEffect, type PairingRun, type PairingRunEvent } from '../pairingRun';
import { choiceDueAt, startChoice, stepChoice, type ChoiceRun } from '../reinforcerChoiceRun';
import { exchangeView } from '../exchangeRun';

const T0 = 1_000_000;
const POOL = ['bubbles', 'kaleidoscope', 'pinwheel', 'marble_run', 'tali_dance', 'paint_drop'];

describe('выбор тапом', () => {
  const due = (r: ChoiceRun) => stepChoice(r, { type: 'due', at: choiceDueAt(r)! });

  it('тап — удержание 800 мс, затем выбор ребёнка со сроком удержания', () => {
    let r = stepChoice(startChoice('alone', T0), { type: 'tap', reinforcerId: 'a', now: T0 + 1000 }).run;
    expect(choiceDueAt(r)).toBe(T0 + 1800);
    const s = due(r);
    expect(s.effects).toEqual([{ type: 'chosen', reinforcerId: 'a', by: 'child', at: T0 + 1800, tappedAt: T0 + 1000, firstTappedId: 'a' }]);
    r = s.run;
    expect(choiceDueAt(r)).toBeNull();
  });

  it('латентность — от показа до первого касания, перенос выбора её не сдвигает (№165)', () => {
    let r = stepChoice(startChoice('alone', T0), { type: 'tap', reinforcerId: 'a', now: T0 + 4000 }).run;
    r = stepChoice(r, { type: 'tap', reinforcerId: 'b', now: T0 + 4500 }).run;
    expect(due(r).effects[0]).toMatchObject({ reinforcerId: 'b', at: T0 + 5300, tappedAt: T0 + 4000, firstTappedId: 'a' });
  });

  it('тап по другой за 800 мс переносит выбор и начинает удержание заново; по выбранной — ничего', () => {
    let r = stepChoice(startChoice('alone', T0), { type: 'tap', reinforcerId: 'a', now: T0 + 1000 }).run;
    r = stepChoice(r, { type: 'tap', reinforcerId: 'a', now: T0 + 1500 }).run;
    expect(choiceDueAt(r)).toBe(T0 + 1800);
    r = stepChoice(r, { type: 'tap', reinforcerId: 'b', now: T0 + 1600 }).run;
    expect(choiceDueAt(r)).toBe(T0 + 2400);
    expect(due(r).effects[0]).toMatchObject({ reinforcerId: 'b', by: 'child' });
  });

  it('«Со взрослым»: полоса через 30 с, первые 500 мс не принимает, затем выбор взрослого', () => {
    let r = startChoice('with_adult', T0);
    expect(choiceDueAt(r)).toBe(T0 + 30_000);
    const shown = due(r);
    expect(shown.effects).toEqual([{ type: 'show_strip' }]);
    r = shown.run;
    expect(stepChoice(r, { type: 'adult_tap', reinforcerId: 'a', now: T0 + 30_400 }).run).toBe(r);
    r = stepChoice(r, { type: 'adult_tap', reinforcerId: 'a', now: T0 + 30_500 }).run;
    expect(r.stripShownAt).toBeNull();
    expect(due(r).effects[0]).toMatchObject({ reinforcerId: 'a', by: 'adult', at: T0 + 31_300 });
  });

  it('«Со взрослым»: тап ребёнка после 30 с — выбор ребёнка, полоса уходит', () => {
    let r = due(startChoice('with_adult', T0)).run;
    r = stepChoice(r, { type: 'tap', reinforcerId: 'c', now: T0 + 40_000 }).run;
    expect(r.stripShownAt).toBeNull();
    expect(due(r).effects[0]).toMatchObject({ by: 'child' });
  });

  it('«Сам»: полосы нет, в 30 с один пульс, в 60 с конец без выбора', () => {
    let r = startChoice('alone', T0);
    const a = due(r);
    expect(a.effects).toEqual([{ type: 'nudge' }]);
    r = a.run;
    expect(r.stripShownAt).toBeNull();
    expect(choiceDueAt(r)).toBe(T0 + 60_000);
    expect(due(r).effects).toEqual([{ type: 'no_choice', at: T0 + 60_000 }]);
  });
});

describe('сопряжение', () => {
  const start = (config: 'alone' | 'with_adult' = 'with_adult', calm = false) =>
    startPairingRun(startPairing({ sessionId: 'p1', config, pool: POOL, history: [], apart: [], rng: seeded(7).rng, now: T0 }), config, calm);

  function go(r: PairingRun, e: PairingRunEvent, fx: PairingEffect[] = []): PairingRun {
    const s = stepPairingRun(r, e);
    fx.push(...s.effects);
    return s.run;
  }
  const dueStep = (r: PairingRun, fx?: PairingEffect[]) => go(r, { type: 'due', at: pairingRunDueAt(r)! }, fx);

  it('цикл: выбор → 10 с → въезд 220 → удержание 600 → полёт 360 → «получено» 300 → раскрытие 360 → доступ 20 с с момента открытия', () => {
    let r = start();
    const pick = r.state.options[1];
    r = go(r, { type: 'tap', reinforcerId: pick, now: T0 + 2000 });
    r = dueStep(r);
    expect(r.state.phase).toBe('wait_token');
    expect(r.state.phaseSince).toBe(T0 + 2800);
    expect(r.exchange).toBeNull();
    expect(pairingRunDueAt(r)).toBe(T0 + 12_800);
    const fx: PairingEffect[] = [];
    // 10 с — обмен одной ячейки начинается с въезда жетона
    r = dueStep(r, fx);
    expect(r.exchange).toEqual({ startedAt: T0 + 12_800, cells: 1, calm: false, landFirst: true });
    expect(exchangeView(r.exchange!, r.at)).toMatchObject({ stage: 'land', tokenInCell: false });
    expect(fx).toEqual([]);
    expect(pairingRunDueAt(r)).toBe(T0 + 12_800 + motion.base);
    // жетон лёг — удержание 600 (одна ячейка)
    r = dueStep(r, fx);
    expect(fx).toEqual([{ type: 'token_landed' }]);
    expect(exchangeView(r.exchange!, r.at)).toMatchObject({ stage: 'hold', tokenInCell: true });
    expect(pairingRunDueAt(r)).toBe(T0 + 12_800 + motion.base + 600);
    r = dueStep(r, fx);
    expect(exchangeView(r.exchange!, r.at).stage).toBe('fly');
    r = dueStep(r, fx);
    expect(exchangeView(r.exchange!, r.at)).toMatchObject({ stage: 'received', cardStroke: 6 });
    r = dueStep(r, fx);
    expect(exchangeView(r.exchange!, r.at)).toMatchObject({ stage: 'open', rowVisible: false });
    expect(r.state.phase).toBe('wait_token');
    r = dueStep(r, fx);
    expect(fx).toEqual([{ type: 'token_landed' }]);
    // событие `token` — в момент открытия доступа: 20 с ребёнка не съедаются обменом
    const open = T0 + 12_800 + motion.base + 600 + motion.slow + 300 + motion.slow;
    expect(r.state).toMatchObject({ phase: 'access', phaseSince: open, reinforcerId: pick });
    expect(r.exchange).toBeNull();
    expect(r.access).toMatchObject({ startedAt: open, durationMs: PAIRING.accessMs, stage: 'play' });
    expect(pairingRunDueAt(r)).toBe(open + PAIRING.accessMs - 5000);
    // «закругляемся», затем T: кольцо уходит, сцена сворачивается — домен ещё в доступе
    r = dueStep(r);
    r = dueStep(r);
    expect(r.at).toBe(open + PAIRING.accessMs);
    expect(r.access?.stage).toBe('fold');
    expect(r.state.phase).toBe('access');
    r = dueStep(r);
    expect(r.access?.stage).toBe('hold');
    expect(r.state.phase).toBe('access');
    // кадр конца прошёл (fold 360 + 1000) — следующий выбор показывается отсюда
    const next = open + PAIRING.accessMs + motion.slow + 1000;
    expect(pairingRunDueAt(r)).toBe(next);
    r = dueStep(r);
    expect(r.state).toMatchObject({ phase: 'choose', cycles: 1, phaseSince: next });
    expect(r.access).toBeNull();
    expect(r.choice?.shownAt).toBe(next);
  });

  it('до 10 с ожидания обмен не начинается: шаг раньше срока ничего не меняет', () => {
    let r = start();
    r = go(r, { type: 'tap', reinforcerId: r.state.options[0], now: T0 + 1000 });
    r = dueStep(r);
    const since = r.state.phaseSince;
    const fx: PairingEffect[] = [];
    r = go(r, { type: 'due', at: since + PAIRING.tokenAfterMs - 1 }, fx);
    expect(r.exchange).toBeNull();
    expect(fx).toEqual([]);
    expect(pairingRunDueAt(r)).toBe(since + PAIRING.tokenAfterMs);
  });

  it('просрочка (экран был свёрнут): один шаг далеко за концом обмена — жетон лёг один раз, доступ с расписанного момента', () => {
    let r = start();
    r = go(r, { type: 'tap', reinforcerId: r.state.options[0], now: T0 + 1000 });
    r = dueStep(r);
    const tokenAt = r.state.phaseSince + PAIRING.tokenAfterMs;
    const fx: PairingEffect[] = [];
    r = go(r, { type: 'due', at: tokenAt + 60_000 }, fx);
    expect(fx).toEqual([{ type: 'token_landed' }]);
    expect(r.state).toMatchObject({ phase: 'access', phaseSince: tokenAt + 1840 });
  });

  it('calm: жетон на месте сразу, «получено» 500, доступ без раскрытия', () => {
    let r = start('with_adult', true);
    r = go(r, { type: 'tap', reinforcerId: r.state.options[0], now: T0 });
    r = dueStep(r);
    const fx: PairingEffect[] = [];
    r = dueStep(r, fx);
    expect(fx).toEqual([{ type: 'token_landed' }]);
    expect(exchangeView(r.exchange!, r.at)).toMatchObject({ stage: 'hold', tokenInCell: true });
    expect(pairingRunDueAt(r)).toBe(T0 + 800 + 10_000 + 600);
    r = dueStep(r);
    expect(exchangeView(r.exchange!, r.at)).toMatchObject({ stage: 'received', flown: 1, cardStroke: 6 });
    r = dueStep(r);
    expect(r.state).toMatchObject({ phase: 'access', phaseSince: T0 + 800 + 10_600 + 500 });
    expect(r.access?.calm).toBe(true);
  });

  it('calm: кадр конца без сворачивания — следующий выбор через T + 1000', () => {
    let r = start('with_adult', true);
    r = go(r, { type: 'tap', reinforcerId: r.state.options[0], now: T0 });
    while (r.state.phase !== 'access') r = dueStep(r);
    const open = r.state.phaseSince;
    while (r.state.phase === 'access') r = dueStep(r);
    expect(r.state).toMatchObject({ phase: 'choose', phaseSince: open + PAIRING.accessMs + 1000 });
  });

  it('остановка во время обмена и доступа снимает обмен и сцену', () => {
    let r = start();
    r = go(r, { type: 'tap', reinforcerId: r.state.options[0], now: T0 });
    r = dueStep(r);
    r = dueStep(r);
    expect(r.exchange).not.toBeNull();
    const s = stepPairingRun(r, { type: 'stop', reason: 'adult_stopped', now: r.at + 1 });
    expect(s.effects).toEqual([{ type: 'done' }]);
    expect([s.run.exchange, s.run.access, s.run.state.phase]).toEqual([null, null, 'done']);
  });

  it('четыре цикла — конец `completed`, все выборы ребёнка → критерий `child`', () => {
    let r = start();
    const fx: PairingEffect[] = [];
    for (let i = 0; i < PAIRING.cycles; i += 1) {
      r = go(r, { type: 'tap', reinforcerId: r.state.options[i % 3], now: r.state.phaseSince + 1000 });
      while (r.state.phase !== 'choose' && r.state.phase !== 'done') r = dueStep(r, fx);
      if (r.state.phase === 'choose' && r.choice?.holdUntil) r = dueStep(r, fx);
      while (r.state.phase !== 'choose' && r.state.phase !== 'done') r = dueStep(r, fx);
    }
    expect(r.state.phase).toBe('done');
    expect(fx.filter((f) => f.type === 'done')).toHaveLength(1);
    expect(pairingResultOf(r.state)).toMatchObject({ endReason: 'completed', chosenBy: 'child' });
    expect(pairingResultOf(r.state).choices).toHaveLength(4);
    // латентность каждого цикла — от начала его фазы выбора, тройка — в итоге (№165)
    expect(pairingResultOf(r.state).choices.map((c) => c.latencyMs)).toEqual([1000, 1000, 1000, 1000]);
    expect(pairingResultOf(r.state).options).toEqual(r.state.options);
  });

  it('выбор взрослого полосой — критерий `adult`', () => {
    let r = start();
    r = dueStep(r);
    expect(r.choice?.stripShownAt).toBe(T0 + 30_000);
    r = go(r, { type: 'adult_tap', reinforcerId: r.state.options[2], now: T0 + 31_000 });
    r = dueStep(r);
    expect(r.state.choices[0]).toEqual({ reinforcerId: r.state.options[2], by: 'adult', at: T0 + 31_800, latencyMs: 31_000 });
    r = go(r, { type: 'stop', reason: 'adult_stopped', now: T0 + 35_000 });
    expect(pairingResultOf(r.state)).toMatchObject({ endReason: 'adult_stopped', chosenBy: 'adult' });
  });

  it('«Сам» без выбора 60 с — исход `no_choice` (№165), не «ушёл»', () => {
    let r = start('alone');
    const fx: PairingEffect[] = [];
    r = dueStep(r, fx);
    r = dueStep(r, fx);
    expect(fx.map((f) => f.type)).toEqual(['nudge', 'done']);
    expect(pairingResultOf(r.state)).toMatchObject({ endReason: 'no_choice', choices: [] });
  });
});

describe('остановка на кадре конца доступа (методист, цикл 3)', () => {
  const start = () =>
    startPairingRun(startPairing({ sessionId: 'p2', config: 'with_adult', pool: POOL, history: [], apart: [], rng: seeded(11).rng, now: T0 }), 'with_adult', false);
  const dueStep = (r: PairingRun) => stepPairingRun(r, { type: 'due', at: pairingRunDueAt(r)! }).run;

  /** Пройти `done` полных циклов и в следующем дойти до доступа в стадии `stage`. */
  function inAccess(done: number, stage: 'play' | 'fold' | 'hold'): PairingRun {
    let r = start();
    for (let i = 0; i <= done; i += 1) {
      r = stepPairingRun(r, { type: 'tap', reinforcerId: r.state.options[i % 3], now: r.state.phaseSince + 1000 }).run;
      while (r.state.phase !== 'access') r = dueStep(r);
      if (i < done) while (r.state.phase === 'access') r = dueStep(r);
    }
    while (r.access!.stage !== stage) r = dueStep(r);
    expect(r.state.phase).toBe('access');
    return r;
  }
  const stop = (r: PairingRun, reason: 'adult_stopped' | 'abandoned' | 'app_backgrounded') => stepPairingRun(r, { type: 'stop', reason, now: r.at + 100 });

  it.each(['fold', 'hold'] as const)('четвёртый цикл, стоп на %s — исход completed, cycles 4', (stage) => {
    const s = stop(inAccess(3, stage), 'adult_stopped');
    expect(s.effects).toEqual([{ type: 'done' }]);
    expect(pairingResultOf(s.run.state)).toMatchObject({ endReason: 'completed', cycles: 4 });
  });

  it('четвёртый цикл, свернули (app_backgrounded) на hold — тоже completed', () => {
    expect(pairingResultOf(stop(inAccess(3, 'hold'), 'app_backgrounded').run.state)).toMatchObject({ endReason: 'completed', cycles: 4 });
  });

  it('четвёртый цикл, стоп на settle (сцена доигрывает) — completed', () => {
    // у заглушки доигрывание 0 и settle проходится в T разом — стадия задаётся явно, как у позиции каталога
    const r = inAccess(3, 'play');
    const settle = { ...r, access: { ...r.access!, stage: 'settle' as const, cued: true }, at: r.access!.startedAt + PAIRING.accessMs + 50 };
    expect(pairingResultOf(stop(settle, 'abandoned').run.state)).toMatchObject({ endReason: 'completed', cycles: 4 });
  });

  it('access_done при стопе на кадре конца пишется моментом T, а не моментом стопа', () => {
    const r = inAccess(3, 'hold');
    const T = r.access!.startedAt + PAIRING.accessMs;
    expect(stop(r, 'adult_stopped').run.state.phaseSince).toBe(T);
  });

  it('второй цикл, стоп на fold — цикл засчитан (cycles 2), исход — стопа', () => {
    const s = stop(inAccess(1, 'fold'), 'adult_stopped');
    expect(pairingResultOf(s.run.state)).toMatchObject({ endReason: 'adult_stopped', cycles: 2 });
  });

  it('второй цикл, свернули на hold — cycles 2, app_backgrounded', () => {
    expect(pairingResultOf(stop(inAccess(1, 'hold'), 'app_backgrounded').run.state)).toMatchObject({ endReason: 'app_backgrounded', cycles: 2 });
  });

  it('стоп, пока сцена играет, — как раньше: цикл не засчитан, исход стопа', () => {
    expect(pairingResultOf(stop(inAccess(3, 'play'), 'abandoned').run.state)).toMatchObject({ endReason: 'abandoned', cycles: 3 });
    expect(pairingResultOf(stop(inAccess(1, 'play'), 'adult_stopped').run.state)).toMatchObject({ endReason: 'adult_stopped', cycles: 1 });
  });

  it('после стопа обмена и сцены нет, сроков нет', () => {
    const s = stop(inAccess(3, 'fold'), 'adult_stopped');
    expect([s.run.access, s.run.exchange, pairingRunDueAt(s.run)]).toEqual([null, null, null]);
  });
});
