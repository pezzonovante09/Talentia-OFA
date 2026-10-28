/**
 * Сессия сопряжения на экране (раздел 3 направления, Ц2.4): домен `abaPairing.ts` ведёт фазы, модель добавляет то,
 * что видит ребёнок между ними.
 *
 * - `choose` — выбор тапом (`reinforcerChoiceRun`); засчитанный выбор (конец удержания) — событие домена `choose`.
 * - `wait_token` — 10 с от выбора или конца прошлого доступа; затем жетон въезжает в ячейку (`motion.base`, calm —
 *   на месте), лежит 600 мс, уходит в карточку (`motion.slow`, calm — исчезает на месте). Событие домена `token`
 *   пишется, **когда открывается доступ**: 20 с доступа ребёнка не съедаются анимацией обмена.
 * - `access` — 20 с, затем `access_done`; после четвёртого — конец.
 * - «Сам» без выбора 60 с — сопряжение кончается как брошенное (`abandoned`): предпочтение не показано.
 */
import { PAIRING } from '../../../domain/abaTokenTraining';
import { applyPairingEvent, pairingDueAt, type PairingState } from '../../../domain/abaPairing';
import { abaPairingLayout } from '../../../design/abaTokens';
import { motion } from '../../../design/tokens';
import type { AbaConfig } from '../../../types/aba';
import { choiceDueAt, startChoice, stepChoice, type ChoiceEffect, type ChoiceRun } from './reinforcerChoiceRun';

export type TokenStage = 'landing' | 'landed' | 'exchange';

export type PairingRun = {
  state: PairingState;
  config: AbaConfig;
  calm: boolean;
  /** Выбор текущего цикла; только в фазе `choose`. */
  choice: ChoiceRun | null;
  /** Жетон после 10 с ожидания; `null` — ячейка пуста, ждём срока. */
  token: { stage: TokenStage; until: number } | null;
};

export type PairingEffect = Exclude<ChoiceEffect, { type: 'chosen' } | { type: 'no_choice' }> | { type: 'token_landed' } | { type: 'done' };

export type PairingRunEvent =
  | { type: 'tap'; reinforcerId: string; now: number }
  | { type: 'adult_tap'; reinforcerId: string; now: number }
  | { type: 'due'; at: number }
  | { type: 'stop'; reason: 'adult_stopped' | 'abandoned' | 'app_backgrounded'; now: number };

export function pairingTokenTiming(calm: boolean) {
  return { landMs: calm ? 0 : motion.base, holdMs: abaPairingLayout.exchangeDelayMs, exchangeMs: calm ? 0 : motion.slow };
}

export function startPairingRun(state: PairingState, config: AbaConfig, calm: boolean): PairingRun {
  return { state, config, calm, choice: state.phase === 'choose' ? startChoice(config, state.phaseSince) : null, token: null };
}

export function pairingRunDueAt(r: PairingRun): number | null {
  switch (r.state.phase) {
    case 'choose':
      return r.choice ? choiceDueAt(r.choice) : null;
    case 'wait_token':
      return r.token ? r.token.until : r.state.phaseSince + PAIRING.tokenAfterMs;
    case 'access':
      return pairingDueAt(r.state)!.at;
    case 'done':
      return null;
  }
}

/** Жетон: сдвинуть стадии, чей срок наступил к `at` (стадии нулевой длины в calm проходятся сразу). */
function advanceToken(r: PairingRun, at: number, effects: PairingEffect[]): PairingRun {
  const tm = pairingTokenTiming(r.calm);
  let token = r.token;
  const tokenAt = r.state.phaseSince + PAIRING.tokenAfterMs;
  if (token === null) {
    if (at < tokenAt) return r;
    token = { stage: 'landing', until: tokenAt + tm.landMs };
  }
  for (;;) {
    if (at < token.until) return { ...r, token };
    if (token.stage === 'landing') {
      effects.push({ type: 'token_landed' });
      token = { stage: 'landed', until: token.until + tm.holdMs };
    } else if (token.stage === 'landed') {
      token = { stage: 'exchange', until: token.until + tm.exchangeMs };
    } else {
      // доступ открывается сейчас — с этого момента домен считает его 20 с
      return { ...r, token: null, state: applyPairingEvent(r.state, { type: 'token', now: token.until }) };
    }
  }
}

export function stepPairingRun(r: PairingRun, e: PairingRunEvent): { run: PairingRun; effects: PairingEffect[] } {
  if (r.state.phase === 'done') return { run: r, effects: [] };
  const effects: PairingEffect[] = [];
  if (e.type === 'stop') {
    return { run: { ...r, choice: null, token: null, state: applyPairingEvent(r.state, e) }, effects: [{ type: 'done' }] };
  }
  switch (r.state.phase) {
    case 'choose': {
      if (!r.choice) return { run: r, effects };
      const step = stepChoice(r.choice, e);
      let run: PairingRun = { ...r, choice: step.run };
      for (const fx of step.effects) {
        if (fx.type === 'chosen') {
          run = { ...run, choice: null, state: applyPairingEvent(run.state, { type: 'choose', reinforcerId: fx.reinforcerId, by: fx.by, now: fx.at }) };
        } else if (fx.type === 'no_choice') {
          run = { ...run, choice: null, state: applyPairingEvent(run.state, { type: 'stop', reason: 'abandoned', now: fx.at }) };
          effects.push({ type: 'done' });
        } else {
          effects.push(fx);
        }
      }
      return { run, effects };
    }
    case 'wait_token':
      if (e.type !== 'due') return { run: r, effects };
      return { run: advanceToken(r, e.at, effects), effects };
    case 'access': {
      if (e.type !== 'due') return { run: r, effects };
      const due = pairingDueAt(r.state)!.at;
      if (e.at < due) return { run: r, effects };
      const state = applyPairingEvent(r.state, { type: 'access_done', now: due });
      if (state.phase === 'done') return { run: { ...r, state }, effects: [{ type: 'done' }] };
      return { run: { ...r, state, choice: startChoice(r.config, state.phaseSince) }, effects };
    }
  }
}
