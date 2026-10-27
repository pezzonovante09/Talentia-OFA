/**
 * Выбор тапом (Ц2.4) и сопряжение на экране (раздел 3): удержание 800 мс, полоса взрослого через 30 с с блоком
 * 500 мс, «Сам» — пульс в 30 с и конец в 60 с; жетон по таймеру 10 с, событие `token` — при открытии доступа;
 * четыре цикла, итог через настоящий домен.
 */
import { pairingResultOf, startPairing } from '../../../../domain/abaPairing';
import { PAIRING } from '../../../../domain/abaTokenTraining';
import { seeded } from '../../../../domain/abaRandom';
import { motion } from '../../../../design/tokens';
import { pairingRunDueAt, startPairingRun, stepPairingRun, type PairingEffect, type PairingRun, type PairingRunEvent } from '../pairingRun';
import { choiceDueAt, startChoice, stepChoice, type ChoiceRun } from '../reinforcerChoiceRun';

const T0 = 1_000_000;
const POOL = ['bubbles', 'kaleidoscope', 'pinwheel', 'marble_run', 'tali_dance', 'paint_drop'];

describe('выбор тапом', () => {
  const due = (r: ChoiceRun) => stepChoice(r, { type: 'due', at: choiceDueAt(r)! });

  it('тап — удержание 800 мс, затем выбор ребёнка со сроком удержания', () => {
    let r = stepChoice(startChoice('alone', T0), { type: 'tap', reinforcerId: 'a', now: T0 + 1000 }).run;
    expect(choiceDueAt(r)).toBe(T0 + 1800);
    const s = due(r);
    expect(s.effects).toEqual([{ type: 'chosen', reinforcerId: 'a', by: 'child', at: T0 + 1800 }]);
    r = s.run;
    expect(choiceDueAt(r)).toBeNull();
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
    startPairingRun(startPairing({ sessionId: 'p1', pool: POOL, history: [], rng: seeded(7).rng, now: T0 }), config, calm);

  function go(r: PairingRun, e: PairingRunEvent, fx: PairingEffect[] = []): PairingRun {
    const s = stepPairingRun(r, e);
    fx.push(...s.effects);
    return s.run;
  }
  const dueStep = (r: PairingRun, fx?: PairingEffect[]) => go(r, { type: 'due', at: pairingRunDueAt(r)! }, fx);

  it('цикл: выбор → 10 с → жетон 220 → 600 → обмен 360 → доступ 20 с с момента открытия', () => {
    let r = start();
    const pick = r.state.options[1];
    r = go(r, { type: 'tap', reinforcerId: pick, now: T0 + 2000 });
    r = dueStep(r);
    expect(r.state.phase).toBe('wait_token');
    expect(r.state.phaseSince).toBe(T0 + 2800);
    expect(pairingRunDueAt(r)).toBe(T0 + 12_800);
    const fx: PairingEffect[] = [];
    r = dueStep(r, fx);
    expect(r.token).toEqual({ stage: 'landing', until: T0 + 12_800 + motion.base });
    r = dueStep(r, fx);
    expect(fx).toEqual([{ type: 'token_landed' }]);
    expect(r.token?.stage).toBe('landed');
    r = dueStep(r);
    expect(r.token?.stage).toBe('exchange');
    r = dueStep(r);
    const open = T0 + 12_800 + motion.base + 600 + motion.slow;
    expect(r.state).toMatchObject({ phase: 'access', phaseSince: open, reinforcerId: pick });
    expect(pairingRunDueAt(r)).toBe(open + PAIRING.accessMs);
    r = dueStep(r);
    expect(r.state).toMatchObject({ phase: 'choose', cycles: 1, phaseSince: open + PAIRING.accessMs });
    expect(r.choice?.shownAt).toBe(open + PAIRING.accessMs);
  });

  it('calm: жетон на месте — стадии нулевой длины проходятся одним сроком', () => {
    let r = start('with_adult', true);
    r = go(r, { type: 'tap', reinforcerId: r.state.options[0], now: T0 });
    r = dueStep(r);
    const fx: PairingEffect[] = [];
    r = dueStep(r, fx);
    expect(fx).toEqual([{ type: 'token_landed' }]);
    expect(r.token).toEqual({ stage: 'landed', until: T0 + 800 + 10_000 + 600 });
    r = dueStep(r);
    expect(r.state).toMatchObject({ phase: 'access', phaseSince: T0 + 800 + 10_600 });
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
  });

  it('выбор взрослого полосой — критерий `adult`', () => {
    let r = start();
    r = dueStep(r);
    expect(r.choice?.stripShownAt).toBe(T0 + 30_000);
    r = go(r, { type: 'adult_tap', reinforcerId: r.state.options[2], now: T0 + 31_000 });
    r = dueStep(r);
    expect(r.state.choices[0]).toEqual({ reinforcerId: r.state.options[2], by: 'adult', at: T0 + 31_800 });
    r = go(r, { type: 'stop', reason: 'adult_stopped', now: T0 + 35_000 });
    expect(pairingResultOf(r.state)).toMatchObject({ endReason: 'adult_stopped', chosenBy: 'adult' });
  });

  it('«Сам» без выбора 60 с — конец как брошенное', () => {
    let r = start('alone');
    const fx: PairingEffect[] = [];
    r = dueStep(r, fx);
    r = dueStep(r, fx);
    expect(fx.map((f) => f.type)).toEqual(['nudge', 'done']);
    expect(pairingResultOf(r.state)).toMatchObject({ endReason: 'abandoned', choices: [] });
  });
});
