/**
 * Порт `SqlDb` поверх встроенного SQLite Node — для тестов: та же схема и те же
 * триггеры, что на устройстве, на настоящем SQLite, без моков.
 */
import { migrate } from '../schema';
import type { SqlDb, SqlValue } from '../sql';

type Stmt = { run(...p: SqlValue[]): { changes: number | bigint }; all(...p: SqlValue[]): unknown[] };
type NodeDb = { exec(sql: string): void; prepare(sql: string): Stmt };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => NodeDb };

export async function memoryDb(): Promise<SqlDb> {
  const raw = new DatabaseSync(':memory:');
  const db: SqlDb = {
    async run(sql, params = []) {
      return { changes: Number(raw.prepare(sql).run(...params).changes) };
    },
    async all<T>(sql: string, params: readonly SqlValue[] = []) {
      return raw.prepare(sql).all(...params).map((r) => ({ ...(r as object) })) as T[];
    },
    async exec(sql) {
      raw.exec(sql);
    },
    async transaction(fn) {
      raw.exec('BEGIN');
      try {
        const out = await fn();
        raw.exec('COMMIT');
        return out;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  await migrate(db);
  return db;
}
