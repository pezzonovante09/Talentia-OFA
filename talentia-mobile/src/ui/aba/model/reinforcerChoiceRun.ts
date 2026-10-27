/**
 * Выбор подкрепителя тапом (Ц2.4, `abaReinforcerChoice`) — одно правило на 2.3, `reinforcerStale` и `choose`
 * сопряжения: тап по карточке — выбор, удержание 800 мс, затем выбор засчитан. Тап по другой за 800 мс переносит
 * выбор и начинает удержание заново; тап по выбранной ничего не меняет.
 *
 * Без выбора: «Со взрослым» — через 30 с полоса взрослого, первые 500 мс после появления она нажатий не принимает;
 * тап ребёнка по карточке и после 30 с — выбор `'child'`, выбор `'adult'` — только кнопкой полосы. «Сам» — через
 * 30 с один пульс трёх карточек и повтор инструкции, ещё через 30 с — конец без выбора.
 *
 * Модель чистая: время приходит в событиях, срок следующего события — `choiceDueAt`.
 */
import { abaReinforcerChoice } from '../../../design/abaTokens';
import type { AbaConfig } from '../../../types/aba';

export type ChoiceRun = {
  config: AbaConfig;
  /** Когда экран выбора показан: от него считаются 30 / 60 с. */
  shownAt: number;
  selected: string | null;
  by: 'child' | 'adult' | null;
  holdUntil: number | null;
  stripShownAt: number | null;
  pulsed: boolean;
  ended: 'chosen' | 'no_choice' | null;
};

export type ChoiceEvent =
  | { type: 'tap'; reinforcerId: string; now: number }
  | { type: 'adult_tap'; reinforcerId: string; now: number }
  | { type: 'due'; at: number };

export type ChoiceEffect =
  | { type: 'chosen'; reinforcerId: string; by: 'child' | 'adult'; at: number }
  | { type: 'show_strip' }
  /** «Сам», 30 с: один пульс трёх карточек и повтор инструкции голосом. */
  | { type: 'nudge' }
  | { type: 'no_choice'; at: number };

const [NUDGE_MS, END_MS] = abaReinforcerChoice.aloneNoChoiceMs;
/** Полоса взрослого появляется в тот же срок, что пульс в «Сам». */
export const ADULT_STRIP_AFTER_MS = NUDGE_MS;

export function startChoice(config: AbaConfig, shownAt: number): ChoiceRun {
  return { config, shownAt, selected: null, by: null, holdUntil: null, stripShownAt: null, pulsed: false, ended: null };
}

/** Принимает ли полоса взрослого нажатие (500 мс после появления — нет). */
export function stripAccepts(r: ChoiceRun, now: number): boolean {
  return r.stripShownAt !== null && now - r.stripShownAt >= abaReinforcerChoice.adultStripLockMs;
}

export function choiceDueAt(r: ChoiceRun): number | null {
  if (r.ended) return null;
  if (r.holdUntil !== null) return r.holdUntil;
  if (r.selected !== null) return null;
  if (r.config === 'with_adult') return r.stripShownAt === null ? r.shownAt + ADULT_STRIP_AFTER_MS : null;
  return r.pulsed ? r.shownAt + END_MS : r.shownAt + NUDGE_MS;
}

export function stepChoice(r: ChoiceRun, e: ChoiceEvent): { run: ChoiceRun; effects: ChoiceEffect[] } {
  if (r.ended) return { run: r, effects: [] };
  switch (e.type) {
    case 'tap':
      if (r.selected === e.reinforcerId) return { run: r, effects: [] };
      return { run: { ...r, selected: e.reinforcerId, by: 'child', holdUntil: e.now + abaReinforcerChoice.holdMs, stripShownAt: null }, effects: [] };
    case 'adult_tap':
      if (!stripAccepts(r, e.now)) return { run: r, effects: [] };
      return { run: { ...r, selected: e.reinforcerId, by: 'adult', holdUntil: e.now + abaReinforcerChoice.holdMs, stripShownAt: null }, effects: [] };
    case 'due': {
      if (r.holdUntil !== null) {
        if (e.at < r.holdUntil) return { run: r, effects: [] };
        return { run: { ...r, holdUntil: null, ended: 'chosen' }, effects: [{ type: 'chosen', reinforcerId: r.selected!, by: r.by!, at: r.holdUntil }] };
      }
      if (r.selected !== null) return { run: r, effects: [] };
      if (r.config === 'with_adult') {
        if (r.stripShownAt !== null || e.at < r.shownAt + ADULT_STRIP_AFTER_MS) return { run: r, effects: [] };
        return { run: { ...r, stripShownAt: e.at }, effects: [{ type: 'show_strip' }] };
      }
      if (!r.pulsed) {
        if (e.at < r.shownAt + NUDGE_MS) return { run: r, effects: [] };
        return { run: { ...r, pulsed: true }, effects: [{ type: 'nudge' }] };
      }
      if (e.at < r.shownAt + END_MS) return { run: r, effects: [] };
      return { run: { ...r, ended: 'no_choice' }, effects: [{ type: 'no_choice', at: e.at }] };
    }
  }
}
