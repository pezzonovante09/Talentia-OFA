/**
 * Подсказка на экране выбора по формату — раунд 2, Р5 (`aba-pedagogy-specialist` 2026-10-11):
 * в `match` и сортировке L1–L2 ответа не раскрывают, у `identify` жест L1 и есть ответ.
 */
import type { AbaTarget } from '../../types/aba';
import { answerLevel, ladderUp, promptLadder, promptVisualFor } from '../abaPrompting';

type Kind = Pick<AbaTarget, 'format' | 'sdKind' | 'fieldSize' | 'matchMode'>;
const identify: Kind = { format: 'identify', sdKind: 'name' };
const match3: Kind = { format: 'match', fieldSize: 3 };
const match2: Kind = { format: 'match', fieldSize: 2 };
const sort: Kind = { format: 'match', matchMode: 'sort' };

const three = { correctId: 'b', choiceIds: ['a', 'b', 'c'], sampleId: 's' } as const;
const two = { correctId: 'b', choiceIds: ['a', 'b'], sampleId: 's', itemId: 'i' } as const;

describe('Р5: подсказка на экране выбора', () => {
  it('L0 у всех — без метки, активны все, верный не выделен', () => {
    for (const [k, t] of [[identify, three], [match3, three], [sort, two]] as const) {
      expect(promptVisualFor(k, 0, t, 1)).toEqual({ focus: null, activeChoiceIds: t.choiceIds, highlightCorrect: false, adultPhysical: false });
    }
  });

  it('identify: жест к верной с L1 — она выделена; на L3 активна только она', () => {
    expect(promptVisualFor(identify, 1, three, 1)).toMatchObject({ focus: { on: 'choice', id: 'b' }, activeChoiceIds: ['a', 'b', 'c'], highlightCorrect: true });
    expect(promptVisualFor(identify, 2, three, 1)).toMatchObject({ highlightCorrect: true, activeChoiceIds: ['a', 'b', 'c'] });
    expect(promptVisualFor(identify, 3, three, 1)).toMatchObject({ activeChoiceIds: ['b'] });
  });

  it('match, поле 3: L1 — метка и пульс над образцом, верный не выделен, активны все', () => {
    expect(promptVisualFor(match3, 1, three, 1)).toEqual({
      focus: { on: 'sample', id: 's', pulse: true },
      activeChoiceIds: ['a', 'b', 'c'],
      highlightCorrect: false,
      adultPhysical: false,
    });
  });

  it('match, поле 3: L2 — ровно два активных, верный среди них и не выделен; дистрактор из seed', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed += 1) {
      const p = promptVisualFor(match3, 2, three, seed);
      expect(p.activeChoiceIds).toHaveLength(2);
      expect(p.activeChoiceIds).toContain('b');
      expect(p.highlightCorrect).toBe(false);
      expect(p.focus).toBeNull();
      // позиции не меняются — порядок как на экране
      expect(p.activeChoiceIds).toEqual(three.choiceIds.filter((id) => p.activeChoiceIds.includes(id)));
      // тот же seed (восстановление сессии) — тот же дистрактор
      expect(promptVisualFor(match3, 2, three, seed)).toEqual(p);
      seen.add(p.activeChoiceIds.find((id) => id !== 'b')!);
    }
    expect(seen).toEqual(new Set(['a', 'c']));
  });

  it('match: L3 — активен только верный, не выделен', () => {
    expect(promptVisualFor(match3, 3, three, 1)).toMatchObject({ focus: null, activeChoiceIds: ['b'], highlightCorrect: false });
    expect(promptVisualFor(match2, 3, two, 1)).toMatchObject({ activeChoiceIds: ['b'] });
  });

  it('выбор из двух (match поле 2, сортировка): L1 — метка над образцом / предметом; L2 недостижим', () => {
    expect(promptVisualFor(match2, 1, two, 1).focus).toEqual({ on: 'sample', id: 's', pulse: true });
    expect(promptVisualFor(sort, 1, two, 1).focus).toEqual({ on: 'item', id: 'i', pulse: true });
    expect(promptLadder(match2)).toBe('two_choice');
    expect(promptLadder(sort)).toBe('two_choice');
    expect(ladderUp(1, 'two_choice')).toBe(3);
    expect(() => promptVisualFor(sort, 2, two, 1)).toThrow(/L2 нет/);
  });

  it('сортировка: L3 — неверная категория приглушена, активна только верная', () => {
    expect(promptVisualFor(sort, 3, two, 1)).toMatchObject({ activeChoiceIds: ['b'], highlightCorrect: false });
  });

  it('L4 — экран как на L3 и указание взрослому; ниже L4 указания нет', () => {
    for (const [k, t] of [[identify, three], [match3, three], [sort, two]] as const) {
      const l3 = promptVisualFor(k, 3, t, 1);
      expect(promptVisualFor(k, 4, t, 1)).toEqual({ ...l3, adultPhysical: true });
      expect(l3.adultPhysical).toBe(false);
    }
  });

  it('коррекция в match и сортировке — с L3, у identify — с L1', () => {
    expect(answerLevel(match3)).toBe(3);
    expect(answerLevel(sort)).toBe(3);
    expect(answerLevel(identify)).toBe(1);
  });

  it('образца или предмета нет на L1 — ошибка данных, а не пустая метка', () => {
    expect(() => promptVisualFor(match3, 1, { correctId: 'b', choiceIds: ['a', 'b', 'c'] }, 1)).toThrow(/образца/);
    expect(() => promptVisualFor(sort, 1, { correctId: 'b', choiceIds: ['a', 'b'] }, 1)).toThrow(/предмета/);
  });
});
