import { regionLessons } from '../../content';
import type { ChooseTask, MatchTask, OrderTask } from '../../types/task';
import {
  chooseAnswerOf,
  chooseTap,
  emptyChooseDraft,
  emptyMatchDraft,
  emptyOrderDraft,
  matchAfterNarrowing,
  matchAnswerOf,
  matchShown,
  matchTap,
  matchWrongOf,
  orderAfterNarrowing,
  orderAnswerOf,
  orderShown,
  orderTap,
  orderWrongOf,
  placeVoice,
} from '../taskDraft';

const tasks = regionLessons('numbers').flatMap((l) => l.tasks);
const choose = tasks.find((t) => t.format === 'choose' && t.options.length === 3) as ChooseTask;
const match = tasks.find((t) => t.format === 'match' && t.pairs.length === 3) as MatchTask;
const order = tasks.find((t) => t.format === 'order') as OrderTask;

describe('choose', () => {
  it('выбор, перевыбор, повтор; снятый вариант не выбирается', () => {
    const [a, b] = choose.options.map((o) => o.id);
    let r = chooseTap(emptyChooseDraft(), a, []);
    expect(r.effect).toBe('select');
    expect(chooseAnswerOf(r.draft)).toEqual({ format: 'choose', optionId: a });
    r = chooseTap(r.draft, a, []);
    expect(r.effect).toBe('repeat');
    r = chooseTap(r.draft, b, []);
    expect(r.effect).toBe('reselect');
    expect(chooseTap(r.draft, a, [a]).effect).toBe('none');
    expect(chooseAnswerOf(emptyChooseDraft())).toBeNull();
  });
});

describe('match — единое правило составных форматов', () => {
  const [p1, p2, p3] = match.pairs.map((p) => p.id);

  it('ответ не собран, пока не все пары; пара ставится тапом по другой стороне и снимает выбор', () => {
    let r = matchTap(emptyMatchDraft(), { side: 'left', id: p1 });
    expect(r.effect).toBe('select');
    r = matchTap(r.draft, { side: 'right', id: p2 });
    expect(r.effect).toBe('pair');
    expect(r.draft.selected).toBeNull();
    expect(r.draft.pairs).toEqual({ [p1]: p2 });
    expect(matchAnswerOf(r.draft, match)).toBeNull();
  });

  it('повторный тап по выбранному — состояние то же; тап по той же стороне — перевыбор', () => {
    let r = matchTap(emptyMatchDraft(), { side: 'left', id: p1 });
    expect(matchTap(r.draft, { side: 'left', id: p1 }).effect).toBe('repeat');
    r = matchTap(r.draft, { side: 'left', id: p2 });
    expect(r.effect).toBe('reselect');
    expect(r.draft.selected).toEqual({ side: 'left', id: p2 });
  });

  it('новая пара снимает прежние пары обоих участников', () => {
    let d = matchTap(matchTap(emptyMatchDraft(), { side: 'left', id: p1 }).draft, { side: 'right', id: p1 }).draft;
    d = matchTap(matchTap(d, { side: 'left', id: p2 }).draft, { side: 'right', id: p2 }).draft;
    // p1 соединяют с правой p2: прежние пары p1–p1 и p2–p2 снимаются.
    d = matchTap(matchTap(d, { side: 'left', id: p1 }).draft, { side: 'right', id: p2 }).draft;
    expect(d.pairs).toEqual({ [p1]: p2 });
  });

  it('полный ответ; неверные пары — крест; после первой ошибки остаются верные и закреплённая', () => {
    let d = emptyMatchDraft();
    for (const [l, r] of [
      [p1, p1],
      [p2, p3],
      [p3, p2],
    ]) {
      d = matchTap(matchTap(d, { side: 'left', id: l }).draft, { side: 'right', id: r }).draft;
    }
    expect(matchAnswerOf(d, match)?.format).toBe('match');
    expect(matchWrongOf(d).sort()).toEqual([p2, p3].sort());
    const after = matchAfterNarrowing([p1], null);
    expect(after.pairs).toEqual({ [p1]: p1 });
    expect(matchTap(after, { side: 'left', id: p1 }, new Set([p1])).effect).toBe('locked');
    expect(matchShown(match).pairs).toEqual({ [p1]: p1, [p2]: p2, [p3]: p3 });
  });
});

describe('order — таблица касаний SCREENS.md 3.4', () => {
  const ids = order.items.map((i) => i.id);
  const [i1, i2, i3] = ids;

  it('лоток → место: выбор, перелёт, тень; выбор снят', () => {
    let r = orderTap(emptyOrderDraft(order), { kind: 'tray', id: i1 });
    expect(r.effect).toBe('select');
    r = orderTap(r.draft, { kind: 'slot', index: 1 });
    expect(r.effect).toBe('place');
    expect(r.draft).toEqual({ selected: null, slots: [null, i1, null] });
  });

  it('повтор по выбранному — ничего; пустое место без выбора — только отклик', () => {
    const r = orderTap(emptyOrderDraft(order), { kind: 'tray', id: i1 });
    expect(orderTap(r.draft, { kind: 'tray', id: i1 }).effect).toBe('repeat');
    const e = orderTap(emptyOrderDraft(order), { kind: 'slot', index: 2 });
    expect(e.effect).toBe('emptyPlace');
    expect(e.draft).toEqual(emptyOrderDraft(order));
  });

  it('занятое место без выбора — выбирает предмет на месте; обмен двух мест; замена из лотка', () => {
    let d = orderTap(orderTap(emptyOrderDraft(order), { kind: 'tray', id: i1 }).draft, { kind: 'slot', index: 0 }).draft;
    d = orderTap(orderTap(d, { kind: 'tray', id: i2 }).draft, { kind: 'slot', index: 1 }).draft;
    let r = orderTap(d, { kind: 'slot', index: 0 });
    expect(r.effect).toBe('select');
    expect(r.draft.selected).toBe(i1);
    r = orderTap(r.draft, { kind: 'slot', index: 1 });
    expect(r.effect).toBe('swap');
    expect(r.draft.slots).toEqual([i2, i1, null]);
    r = orderTap(orderTap(r.draft, { kind: 'tray', id: i3 }).draft, { kind: 'slot', index: 0 });
    expect(r.effect).toBe('place');
    expect(r.draft.slots).toEqual([i3, i1, null]);
    expect(r.draft.slots.includes(i2)).toBe(false);
  });

  it('тень: первый тап выбирает её предмет, второй возвращает в лоток', () => {
    const d = orderTap(orderTap(emptyOrderDraft(order), { kind: 'tray', id: i1 }).draft, { kind: 'slot', index: 2 }).draft;
    let r = orderTap(d, { kind: 'tray', id: i1 });
    expect(r.effect).toBe('select');
    expect(r.draft.selected).toBe(i1);
    r = orderTap(r.draft, { kind: 'tray', id: i1 });
    expect(r.effect).toBe('return');
    expect(r.draft).toEqual(emptyOrderDraft(order));
  });

  it('ответ собран только при всех местах; неверные — крест; сужение и показ', () => {
    const wrong = { selected: null, slots: [...order.items].sort((a, b) => b.position - a.position).map((i) => i.id) };
    expect(orderAnswerOf(wrong)?.format).toBe('order');
    expect(orderAnswerOf(emptyOrderDraft(order))).toBeNull();
    const shown = orderShown(order);
    expect(orderWrongOf(shown, order)).toEqual([]);
    expect(orderWrongOf(wrong, order).length).toBeGreaterThan(0);
    const after = orderAfterNarrowing(order, [], i1);
    const item = order.items.find((i) => i.id === i1)!;
    expect(after.slots[item.position]).toBe(i1);
    expect(orderTap(after, { kind: 'slot', index: item.position }, new Set([i1])).effect).toBe('locked');
  });

  it('голос пустого места: начало, середина, конец', () => {
    expect([placeVoice(0, 3), placeVoice(1, 3), placeVoice(2, 3)]).toEqual(['start', 'middle', 'end']);
  });
});
