/**
 * Идентификаторы ABA (раунд 3, В11): только случайные UUIDv4; всё, из чего читается время,
 * распознаётся `leaksTime`.
 */
import { isUuidV4, leaksTime, uuidV4 } from '../ids';

const bytes = (fill: number | ((i: number) => number)) => (n: number) =>
  Uint8Array.from({ length: n }, (_, i) => (typeof fill === 'function' ? fill(i) : fill));

describe('uuidV4', () => {
  it('формат 8-4-4-4-12 в нижнем регистре hex', () => {
    expect(uuidV4(bytes((i) => i * 17))).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('версия 4 при любых входных байтах', () => {
    for (const fill of [0x00, 0xff, 0x5a, 0xa5]) expect(uuidV4(bytes(fill))[14]).toBe('4');
  });

  it('вариант 8, 9, a или b при любых входных байтах', () => {
    for (const fill of [0x00, 0x3f, 0x40, 0x80, 0xc0, 0xff]) expect(uuidV4(bytes(fill))[19]).toMatch(/[89ab]/);
  });

  it('детерминированный источник — детерминированный результат', () => {
    const src = bytes((i) => i);
    expect(uuidV4(src)).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(uuidV4(src)).toBe(uuidV4(src));
  });

  it('разные байты — разные id', () => {
    expect(uuidV4(bytes(1))).not.toBe(uuidV4(bytes(2)));
  });

  it('не изменяет массив источника', () => {
    const arr = new Uint8Array(16).fill(0xff);
    uuidV4(() => arr);
    expect([...arr]).toEqual(new Array(16).fill(0xff));
  });

  it.each([0, 8, 15, 17, 32])('источник вернул %i байт — ошибка (нужно ровно 16)', (n) => {
    expect(() => uuidV4(() => new Uint8Array(n))).toThrow();
  });

  it('результат проходит isUuidV4 и не «течёт» временем', () => {
    const id = uuidV4(bytes(0x7f));
    expect(isUuidV4(id)).toBe(true);
    expect(leaksTime(id)).toBe(false);
  });
});

describe('isUuidV4', () => {
  it('принимает v4, в том числе в верхнем регистре', () => {
    expect(isUuidV4('3b241101-e2bb-4255-8caf-4136c566a962')).toBe(true);
    expect(isUuidV4('3B241101-E2BB-4255-8CAF-4136C566A962')).toBe(true);
  });

  it.each([
    ['v1', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
    ['v5', '886313e1-3b8a-5372-9b90-0c9aee199e5d'],
    ['v7', '018f3b5e-7c2a-7d3e-9a1b-2c4d5e6f7a8b'],
    ['вариант вне 8-b', '3b241101-e2bb-4255-4caf-4136c566a962'],
    ['пустая строка', ''],
    ['не uuid', 's-5'],
    ['uuid с лишним хвостом', '3b241101-e2bb-4255-8caf-4136c566a962x'],
  ])('отклоняет %s', (_, id) => {
    expect(isUuidV4(id)).toBe(false);
  });
});

describe('leaksTime', () => {
  it.each([
    ['UUID v1', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
    ['UUID v2', '000003e8-9dad-21d1-80b4-00c04fd430c8'],
    ['UUID v6', '1ec9414c-232a-6b00-b3c8-9e6bdeced846'],
    ['UUID v7', '018f3b5e-7c2a-7d3e-9a1b-2c4d5e6f7a8b'],
    ['UUID v7 в верхнем регистре', '018F3B5E-7C2A-7D3E-9A1B-2C4D5E6F7A8B'],
    ['UUID v8', '018f3b5e-7c2a-8d3e-9a1b-2c4d5e6f7a8b'],
    ['ULID', '01ARZ3NDEKTSV4RRFFQ69G5FAV'],
    ['ULID в нижнем регистре', '01arz3ndektsv4rrffq69g5fav'],
    ['метка времени (мс эпохи)', '1760000000000'],
    ['метка времени с префиксом', 'tr-1760000000000'],
    ['ровно 10 цифр подряд', 's-1760000000'],
    ['дата', 'run-2026-10-11'],
    ['время суток', 'session-07:31'],
  ])('%s — течёт временем', (_, id) => {
    expect(leaksTime(id)).toBe(true);
  });

  it.each([
    ['UUID v4', '3b241101-e2bb-4255-8caf-4136c566a962'],
    ['UUID v3', 'a3bb189e-8bf9-3888-9912-ace4e6543002'],
    ['UUID v5', '886313e1-3b8a-5372-9b90-0c9aee199e5d'],
    ['тестовый id s-5', 's-5'],
    ['тестовый id t1', 't1'],
    ['9 цифр подряд', 's-176000000'],
    ['пустая строка', ''],
    ['id наблюдателя', 'obs-uuid-7'],
  ])('%s — безвреден', (_, id) => {
    expect(leaksTime(id)).toBe(false);
  });
});

describe('leaksTime: суффикс замены пробы ~cN (раунд 3)', () => {
  it('время читается из основы: uuid v7 / ULID / epoch с суффиксом тоже', () => {
    expect(leaksTime('0191d3f0-7c3a-7abc-8def-0123456789ab~c1')).toBe(true);
    expect(leaksTime('01ARZ3NDEKTSV4RRFFQ69G5FAV~c2')).toBe(true);
    expect(leaksTime('1760000000000~c1')).toBe(true);
  });
  it('основа без времени остаётся безвредной', () => {
    expect(leaksTime('123e4567-e89b-42d3-a456-426614174000~c1')).toBe(false);
    expect(leaksTime('tr-7~c1')).toBe(false);
  });
});
