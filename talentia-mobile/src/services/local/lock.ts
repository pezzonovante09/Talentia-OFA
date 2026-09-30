/**
 * Замок на базу: запись согласия и проход синхронизации не идут одновременно. Иначе
 * родитель отзывает согласие, пока проход между чтением журнала и отправкой, — и данные
 * уходят уже после локального отзыва.
 */
import type { SqlDb } from './sql';

const tails = new WeakMap<SqlDb, Promise<unknown>>();

export function withDbLock<T>(db: SqlDb, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(db) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  tails.set(db, next.catch(() => undefined));
  return next;
}
