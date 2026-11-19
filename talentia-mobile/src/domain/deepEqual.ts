/**
 * Структурное сравнение значений состояния (цели ABA, снимки). Сравнение через `JSON.stringify`
 * зависит от порядка ключей и от полей со значением `undefined`: объект, собранный spread-ом с другим
 * порядком, или прочитанный из базы, давал ложное «не равно» (раунд 3, `backend-auditor`: конфликт
 * состояния рутины). Здесь порядок ключей не важен, ключ со значением `undefined` — то же, что
 * отсутствующий ключ (как после `JSON.parse(JSON.stringify(x))`), массивы сравниваются по порядку.
 *
 * Без зависимостей: в React Native нет `util.isDeepStrictEqual`, lodash не подключён. Рассчитано на
 * JSON-подобные данные (объекты, массивы, строки, числа, булевы, `null`); `NaN` равен `NaN`.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b);
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;

  const arrayA = Array.isArray(a);
  if (arrayA !== Array.isArray(b)) return false;
  if (arrayA) {
    const x = a as unknown[];
    const y = b as unknown[];
    return x.length === y.length && x.every((v, i) => deepEqual(v, y[i]));
  }

  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const keysX = Object.keys(x).filter((k) => x[k] !== undefined);
  const keysY = Object.keys(y).filter((k) => y[k] !== undefined);
  return keysX.length === keysY.length && keysX.every((k) => Object.prototype.hasOwnProperty.call(y, k) && deepEqual(x[k], y[k]));
}
