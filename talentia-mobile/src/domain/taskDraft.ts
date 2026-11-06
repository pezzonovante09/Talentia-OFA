/**
 * Черновик ответа — что ребёнок собрал на экране до «Проверить» (скилл `format-screen`, шаг 1).
 * Чистые редьюсеры касаний по SCREENS.md 3.1 / 3.3 / 3.4 и «Единому правилу составных форматов»:
 * повторный тап по выбранному состояние не меняет; действие — только тапом по цели; после действия
 * выбор снят; касание, которое ничего не меняет, — не попытка. Проверяет ответ только оркестратор.
 */
import type { LessonAnswer } from './lessonSession';
import type { ChooseTask, MatchTask, OrderTask } from '../types/task';

/** Что сделало касание — для отклика и голоса; черновик при `none` не изменился. */
export type TapEffect =
  | 'select'
  | 'reselect'
  /** Повторный тап по выбранному: `selectedRepeatPress`, состояние то же. */
  | 'repeat'
  | 'pair'
  | 'place'
  | 'swap'
  | 'return'
  /** Пустое место без выбора: сжатие места и голос, не попытка. */
  | 'emptyPlace'
  /** Закреплённый / оставшийся после сужения элемент: «это уже на месте». */
  | 'locked'
  | 'none';

export type TapResult<D> = { draft: D; effect: TapEffect };

/* ───────────────────────── choose ───────────────────────── */

export type ChooseDraft = { selected: string | null };

export const emptyChooseDraft = (): ChooseDraft => ({ selected: null });

export function chooseTap(draft: ChooseDraft, optionId: string, removed: readonly string[]): TapResult<ChooseDraft> {
  if (removed.includes(optionId)) return { draft, effect: 'none' };
  if (draft.selected === optionId) return { draft, effect: 'repeat' };
  return { draft: { selected: optionId }, effect: draft.selected ? 'reselect' : 'select' };
}

export const chooseAnswerOf = (draft: ChooseDraft): LessonAnswer | null =>
  draft.selected ? { format: 'choose', optionId: draft.selected } : null;

export const chooseCorrectId = (task: ChooseTask): string => task.options.find((o) => o.correct)!.id;

/* ───────────────────────── match ───────────────────────── */

export type MatchSide = 'left' | 'right';
/** Обе стороны адресуются id пары: `pairs[leftPairId] = rightPairId`. */
export type MatchDraft = { selected: { side: MatchSide; id: string } | null; pairs: Record<string, string> };

export const emptyMatchDraft = (): MatchDraft => ({ selected: null, pairs: {} });

/** Пары, которые ребёнок менять не может: оставшиеся верные и закреплённая (после сужения). */
export type MatchLocks = ReadonlySet<string>;

export function matchTap(draft: MatchDraft, target: { side: MatchSide; id: string }, locks: MatchLocks = new Set()): TapResult<MatchDraft> {
  if (locks.has(target.id)) return { draft, effect: 'locked' };
  const sel = draft.selected;
  if (!sel) return { draft: { ...draft, selected: target }, effect: 'select' };
  if (sel.side === target.side) {
    if (sel.id === target.id) return { draft, effect: 'repeat' };
    return { draft: { ...draft, selected: target }, effect: 'reselect' };
  }
  const left = sel.side === 'left' ? sel.id : target.id;
  const right = sel.side === 'right' ? sel.id : target.id;
  const pairs: Record<string, string> = {};
  for (const [l, r] of Object.entries(draft.pairs)) if (l !== left && r !== right) pairs[l] = r;
  pairs[left] = right;
  return { draft: { selected: null, pairs }, effect: 'pair' };
}

export const matchAnswerOf = (draft: MatchDraft, task: MatchTask): LessonAnswer | null =>
  Object.keys(draft.pairs).length === task.pairs.length
    ? { format: 'match', pairs: task.pairs.map((p) => ({ left: p.id, right: draft.pairs[p.id] })) }
    : null;

/** Что остаётся после первой ошибки (SCREENS.md 2.5): `kept` и `pinned` стоят верно, остальное снято. */
export function matchAfterNarrowing(kept: readonly string[], pinned: string | null): MatchDraft {
  const pairs: Record<string, string> = {};
  for (const id of kept) pairs[id] = id;
  if (pinned) pairs[pinned] = pinned;
  return { selected: null, pairs };
}

export const matchShown = (task: MatchTask): MatchDraft => ({
  selected: null,
  pairs: Object.fromEntries(task.pairs.map((p) => [p.id, p.id])),
});

/** id пар, стоящих неверно (крест на обеих плитках). */
export const matchWrongOf = (draft: MatchDraft): string[] => Object.entries(draft.pairs).filter(([l, r]) => l !== r).map(([l]) => l);

/* ───────────────────────── order ───────────────────────── */

/** `slots[position]` — id предмета или пусто; выбранный предмет — в лотке или на месте. */
export type OrderDraft = { selected: string | null; slots: (string | null)[] };

export const emptyOrderDraft = (task: OrderTask): OrderDraft => ({ selected: null, slots: task.items.map(() => null) });

export type OrderTarget = { kind: 'tray'; id: string } | { kind: 'slot'; index: number };

export const slotOf = (draft: OrderDraft, id: string): number => draft.slots.indexOf(id);

export function orderTap(draft: OrderDraft, target: OrderTarget, locks: ReadonlySet<string> = new Set()): TapResult<OrderDraft> {
  const sel = draft.selected;
  if (target.kind === 'tray') {
    if (locks.has(target.id)) return { draft, effect: 'locked' };
    const placedAt = slotOf(draft, target.id);
    if (placedAt >= 0) {
      // Тень в лотке: первый тап выбирает её предмет (он на месте), второй — возвращает в лоток.
      if (sel === target.id) {
        const slots = [...draft.slots];
        slots[placedAt] = null;
        return { draft: { selected: null, slots }, effect: 'return' };
      }
      return { draft: { ...draft, selected: target.id }, effect: sel ? 'reselect' : 'select' };
    }
    if (sel === target.id) return { draft, effect: 'repeat' };
    return { draft: { ...draft, selected: target.id }, effect: sel ? 'reselect' : 'select' };
  }

  const occupant = draft.slots[target.index];
  if (occupant && locks.has(occupant)) return { draft, effect: 'locked' };
  if (!sel) {
    if (!occupant) return { draft, effect: 'emptyPlace' };
    return { draft: { ...draft, selected: occupant }, effect: 'select' };
  }
  if (occupant === sel) return { draft, effect: 'repeat' };
  const slots = [...draft.slots];
  const from = slotOf(draft, sel);
  if (from >= 0) slots[from] = occupant ?? null; // обмен мест или перенос на пустое
  slots[target.index] = sel;
  return { draft: { selected: null, slots }, effect: !occupant ? 'place' : from >= 0 ? 'swap' : 'place' };
}

export const orderAnswerOf = (draft: OrderDraft): LessonAnswer | null =>
  draft.slots.every((s) => s !== null) ? { format: 'order', slots: draft.slots as string[] } : null;

export function orderAfterNarrowing(task: OrderTask, kept: readonly string[], pinned: string | null): OrderDraft {
  const slots = task.items.map<string | null>(() => null);
  for (const item of task.items) if (kept.includes(item.id) || item.id === pinned) slots[item.position] = item.id;
  return { selected: null, slots };
}

export function orderShown(task: OrderTask): OrderDraft {
  const slots = task.items.map<string | null>(() => null);
  for (const item of task.items) slots[item.position] = item.id;
  return { selected: null, slots };
}

/** id предметов, стоящих не на своём месте. */
export const orderWrongOf = (draft: OrderDraft, task: OrderTask): string[] =>
  task.items.filter((i) => draft.slots[i.position] !== i.id && draft.slots.includes(i.id)).map((i) => i.id);

/** Позиция места на стреле для голоса пустого места (`orderEmptyPlaceTap.voice.tick`). */
export const placeVoice = (index: number, total: number): 'start' | 'middle' | 'end' =>
  index === 0 ? 'start' : index === total - 1 ? 'end' : 'middle';
