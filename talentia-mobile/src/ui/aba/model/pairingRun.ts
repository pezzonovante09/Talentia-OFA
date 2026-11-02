/**
 * Сессия сопряжения на экране (раздел 3 направления, Ц2.4, цикл 3): домен `abaPairing.ts` ведёт фазы, модель
 * добавляет то, что видит ребёнок между ними.
 *
 * - `choose` — выбор тапом (`reinforcerChoiceRun`); засчитанный выбор (конец удержания) — событие домена `choose`.
 * - `wait_token` — 10 с от выбора или конца прошлого доступа; затем обмен одной ячейки (`exchangeRun`, Ц3.4): жетон
 *   въезжает, лежит 600 мс, уходит в карточку, «получено», раскрытие. Событие домена `token` пишется, **когда
 *   открывается доступ**: 20 с доступа ребёнка не съедаются анимацией обмена.
 * - `access` — 20 с (`accessRun`), затем кадр конца (Ц3.5): кольцо исчезает в T, сцена сворачивается в карточку, 1 с.
 *   `access_done` пишется после кадра конца: латентность следующего выбора считается от показа выбора, а не от T.
 *   После четвёртого — конец.
 * - «Сам» без выбора 60 с — сопряжение кончается исходом `no_choice` (№165): предпочтение не показано; удержанный
 *   выход — `abandoned`.
 */
import { PAIRING } from '../../../domain/abaTokenTraining';
import { applyPairingEvent, type PairingState } from '../../../domain/abaPairing';
import type { AbaConfig } from '../../../types/aba';
import { accessDueAt, accessEndsAt, startAccess, stepAccess, type AccessRun } from './accessRun';
import { exchangeDueAt, exchangeEndsAt, exchangeView, startExchange, type ExchangeRun } from './exchangeRun';
import { choiceDueAt, startChoice, stepChoice, type ChoiceEffect, type ChoiceRun } from './reinforcerChoiceRun';

export type PairingRun = {
  state: PairingState;
  config: AbaConfig;
  calm: boolean;
  /** Выбор текущего цикла; только в фазе `choose`. */
  choice: ChoiceRun | null;
  /** Обмен после 10 с ожидания; `null` — ячейка пуста, ждём срока. */
  exchange: ExchangeRun | null;
  access: AccessRun | null;
  /** Время последнего шага: по нему экран рисует кадр обмена и кольцо. */
  at: number;
};

export type PairingEffect = Exclude<ChoiceEffect, { type: 'chosen' } | { type: 'no_choice' }> | { type: 'token_landed' } | { type: 'done' };

export type PairingRunEvent =
  | { type: 'tap'; reinforcerId: string; now: number }
  | { type: 'adult_tap'; reinforcerId: string; now: number }
  | { type: 'due'; at: number }
  | { type: 'stop'; reason: 'adult_stopped' | 'abandoned' | 'app_backgrounded'; now: number };

export function startPairingRun(state: PairingState, config: AbaConfig, calm: boolean): PairingRun {
  return { state, config, calm, choice: state.phase === 'choose' ? startChoice(config, state.phaseSince) : null, exchange: null, access: null, at: state.phaseSince };
}

export function pairingRunDueAt(r: PairingRun): number | null {
  switch (r.state.phase) {
    case 'choose':
      return r.choice ? choiceDueAt(r.choice) : null;
    case 'wait_token':
      return r.exchange ? exchangeDueAt(r.exchange, r.at) : r.state.phaseSince + PAIRING.tokenAfterMs;
    case 'access':
      return r.access ? accessDueAt(r.access) : null;
    case 'done':
      return null;
  }
}

/** Ожидание и обмен: сдвинуть кадры, чей срок наступил к `at`; доступ открывается в конце обмена. */
function advanceExchange(r: PairingRun, at: number, effects: PairingEffect[]): PairingRun {
  const tokenAt = r.state.phaseSince + PAIRING.tokenAfterMs;
  if (at < tokenAt) return r;
  const exchange = r.exchange ?? startExchange({ at: tokenAt, cells: 1, calm: r.calm, landFirst: true });
  const before = exchangeView(exchange, r.exchange ? r.at : tokenAt - 1);
  const view = exchangeView(exchange, at);
  if (!before.tokenInCell && view.tokenInCell) effects.push({ type: 'token_landed' });
  if (view.stage !== 'done') return { ...r, exchange, at };
  // доступ открывается сейчас — с этого момента домен считает его 20 с
  const opened = exchangeEndsAt(exchange);
  return { ...r, exchange: null, access: startAccess(opened, PAIRING.accessMs, 0, r.calm), at, state: applyPairingEvent(r.state, { type: 'token', now: opened }) };
}

export function stepPairingRun(r: PairingRun, e: PairingRunEvent): { run: PairingRun; effects: PairingEffect[] } {
  if (r.state.phase === 'done') return { run: r, effects: [] };
  const effects: PairingEffect[] = [];
  if (e.type === 'stop') {
    // доступ для процедуры кончился в T, кадр конца — оформление: уход на нём не отнимает пройденный цикл, а после
    // четвёртого сессия остаётся `completed` (методист, цикл 3: критерий сопряжения считает только законченные)
    let state = r.state;
    if (r.access && r.access.stage !== 'play') state = applyPairingEvent(state, { type: 'access_done', now: accessEndsAt(r.access) });
    if (state.phase !== 'done') state = applyPairingEvent(state, e);
    return { run: { ...r, choice: null, exchange: null, access: null, state }, effects: [{ type: 'done' }] };
  }
  switch (r.state.phase) {
    case 'choose': {
      if (!r.choice) return { run: r, effects };
      const step = stepChoice(r.choice, e);
      let run: PairingRun = { ...r, choice: step.run };
      for (const fx of step.effects) {
        if (fx.type === 'chosen') {
          run = { ...run, choice: null, at: fx.at, state: applyPairingEvent(run.state, { type: 'choose', reinforcerId: fx.reinforcerId, by: fx.by, now: fx.at, tappedAt: fx.tappedAt, firstTappedId: fx.firstTappedId }) };
        } else if (fx.type === 'no_choice') {
          run = { ...run, choice: null, state: applyPairingEvent(run.state, { type: 'stop', reason: 'no_choice', now: fx.at }) };
          effects.push({ type: 'done' });
        } else {
          effects.push(fx);
        }
      }
      return { run, effects };
    }
    case 'wait_token':
      if (e.type !== 'due') return { run: r, effects };
      return { run: advanceExchange(r, e.at, effects), effects };
    case 'access': {
      if (e.type !== 'due' || !r.access) return { run: r, effects };
      const step = stepAccess(r.access, e.at);
      const done = step.effects.find((f) => f.type === 'done');
      if (!done || done.type !== 'done') return { run: { ...r, access: step.run, at: e.at }, effects };
      // кадр конца прошёл — доступ кончился для домена; следующий выбор показывается с этого кадра
      const state = applyPairingEvent(r.state, { type: 'access_done', now: done.at });
      if (state.phase === 'done') return { run: { ...r, state, access: null, at: e.at }, effects: [{ type: 'done' }] };
      return { run: { ...r, state, access: null, at: e.at, choice: startChoice(r.config, state.phaseSince) }, effects };
    }
  }
}
