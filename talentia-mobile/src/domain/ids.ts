/**
 * Идентификаторы записей ABA (пробы, сессии, прогоны, IOA, исправления): **только случайные UUIDv4**
 * (раунд 3, `child-privacy-compliance`, В11; ABA.md, «Данные»). Идентификатор из времени —
 * UUID версий 1 / 6 / 7, ULID, `Date.now()` — возвращает в экспорт специалисту время суток, которое
 * мы убрали (№95, №96): режим дня ребёнка читается прямо из id. Хеш от id ребёнка тоже не годится.
 *
 * Генератор не берёт случайность сам: платформа даёт её по-разному (`expo-crypto`,
 * `crypto.getRandomValues`), поэтому источник байт передаётся — в тестах детерминированный.
 */

/** Источник случайных байт: `expo-crypto` `getRandomBytes` или `crypto.getRandomValues`. */
export type RandomBytes = (length: number) => Uint8Array;

/** Случайный UUID версии 4. */
export function uuidV4(randomBytes: RandomBytes): string {
  const b = randomBytes(16);
  if (b.length !== 16) throw new Error('Для UUIDv4 нужно 16 случайных байт');
  const bytes = Uint8Array.from(b);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = [...bytes].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** ULID: 10 знаков времени + 16 случайных, алфавит Крокфорда. */
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

export function isUuidV4(id: string): boolean {
  return UUID_V4.test(id);
}

/**
 * Можно ли прочитать время из идентификатора: UUID версий 1, 2, 6, 7 (и 8, чьё содержимое не
 * определено), ULID, длинное число (метка времени), дата в тексте. UUIDv3 / v5 и v4 времени не несут.
 * Любые другие (`s-5`, `t1`) считаются безвредными: их выдаёт код и тесты, не часы.
 */
export function leaksTime(rawId: string): boolean {
  // замена пробы при исправлении отметки — `<id исходной>~c1` (`abaUndo.ts`): время читается из основы
  const id = rawId.replace(/~c\d+$/, '');
  const m = UUID.exec(id);
  if (m) return ['1', '2', '6', '7', '8'].includes(m[1].toLowerCase());
  if (ULID.test(id)) return true;
  if (/\d{10,}/.test(id)) return true;
  if (/\d{4}-\d{2}-\d{2}/.test(id) || /\d{2}:\d{2}/.test(id)) return true;
  return false;
}
