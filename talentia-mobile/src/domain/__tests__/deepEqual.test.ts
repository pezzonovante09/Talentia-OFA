import { deepEqual } from '../deepEqual';

describe('deepEqual', () => {
  it('одинаковые примитивы равны, разные — нет', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('a', 'b')).toBe(false);
    expect(deepEqual(true, false)).toBe(false);
  });

  it('число и строка с тем же видом не равны', () => {
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual(0, false)).toBe(false);
  });

  it('ноль: 0 равен 0, отрицательный и положительный не равны', () => {
    expect(deepEqual(0, 0)).toBe(true);
    expect(deepEqual(-1, 1)).toBe(false);
  });

  it('NaN равен NaN, но не числу', () => {
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual(NaN, 0)).toBe(false);
  });

  it('null равен null, но не undefined, не объекту и не нулю', () => {
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({}, null)).toBe(false);
    expect(deepEqual(null, 0)).toBe(false);
  });

  it('порядок ключей не важен', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('значение поля отличается — не равны', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
  });

  it('ключ со значением undefined — то же, что отсутствующий ключ (в обе стороны)', () => {
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(true);
  });

  it('ключ со значением null — не то же, что отсутствующий', () => {
    expect(deepEqual({ a: 1, b: null }, { a: 1 })).toBe(false);
  });

  it('лишний ключ с определённым значением — не равны', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 0 })).toBe(false);
    expect(deepEqual({ a: 1, b: 0 }, { a: 1 })).toBe(false);
  });

  it('одинаковое число ключей, но разные имена — не равны', () => {
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(deepEqual({ a: undefined, b: 1 }, { c: undefined, d: 1 })).toBe(false);
  });

  it('вложенные объекты сравниваются структурно, независимо от порядка ключей на любой глубине', () => {
    expect(deepEqual({ x: { a: 1, b: { c: 2, d: 3 } } }, { x: { b: { d: 3, c: 2 }, a: 1 } })).toBe(true);
    expect(deepEqual({ x: { a: 1, b: { c: 2 } } }, { x: { a: 1, b: { c: 9 } } })).toBe(false);
  });

  it('вложенный undefined игнорируется', () => {
    expect(deepEqual({ x: { a: 1, z: undefined } }, { x: { a: 1 } })).toBe(true);
  });

  it('массивы сравниваются по порядку', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([1, 2, 3], [3, 2, 1])).toBe(false);
  });

  it('массивы разной длины не равны', () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([], [undefined])).toBe(false);
  });

  it('пустые массивы и пустые объекты равны', () => {
    expect(deepEqual([], [])).toBe(true);
    expect(deepEqual({}, {})).toBe(true);
  });

  it('массив не равен объекту с теми же индексами', () => {
    expect(deepEqual([1], { 0: 1 })).toBe(false);
    expect(deepEqual({ 0: 1 }, [1])).toBe(false);
    expect(deepEqual([], {})).toBe(false);
  });

  it('объекты внутри массивов сравниваются структурно', () => {
    expect(deepEqual([{ a: 1, b: 2 }], [{ b: 2, a: 1 }])).toBe(true);
    expect(deepEqual([{ a: 1 }], [{ a: 2 }])).toBe(false);
  });

  it('ссылка на тот же объект равна сама себе', () => {
    const o = { a: [1, { b: 2 }] };
    expect(deepEqual(o, o)).toBe(true);
  });

  it('результат JSON-круга равен исходнику с undefined-полями', () => {
    const original = { a: 1, b: undefined, c: [1, { d: undefined, e: 'x' }] };
    expect(deepEqual(original, JSON.parse(JSON.stringify(original)))).toBe(true);
  });
});
