/**
 * Локальная база приложения на `expo-sqlite`. Один файл на устройство: данные детей
 * разделены колонкой `child_id` во всех таблицах, а не отдельными файлами — так удаление
 * ребёнка и экспорт видят всё сразу.
 */
import * as SQLite from 'expo-sqlite';
import { migrate } from './schema';
import type { SqlDb, SqlValue } from './sql';

export const LOCAL_DB_NAME = 'talentia.db';

function adapt(db: SQLite.SQLiteDatabase): SqlDb {
  return {
    async run(sql, params = []) {
      const r = await db.runAsync(sql, params as SqlValue[]);
      return { changes: r.changes };
    },
    all: <T>(sql: string, params: readonly SqlValue[] = []) => db.getAllAsync<T>(sql, params as SqlValue[]),
    exec: (sql) => db.execAsync(sql),
    async transaction(fn) {
      let out!: Awaited<ReturnType<typeof fn>>;
      await db.withTransactionAsync(async () => {
        out = await fn();
      });
      return out;
    },
  };
}

let opened: Promise<SqlDb> | null = null;

/** Открыть базу и накатить схему. Повторные вызовы возвращают ту же базу. */
export function openLocalDb(): Promise<SqlDb> {
  opened ??= (async () => {
    const db = adapt(await SQLite.openDatabaseAsync(LOCAL_DB_NAME));
    await db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    await migrate(db);
    return db;
  })();
  return opened;
}
