/**
 * Локальная база приложения на `expo-sqlite`. **Файл на аккаунт** (`talentia-<uid>.db`):
 * выход из аккаунта прогресс не стирает, но аккаунты на одном устройстве не видят
 * журналов друг друга, в том числе согласий (PARENT.md, «Данные на устройстве»). Внутри
 * файла данные детей разделены колонкой `child_id`.
 *
 * `secure_delete` — удалённое затирается на диске, а не остаётся в свободных страницах;
 * после удалений журнал WAL сжимается (`compactAfterDelete`). Резервная копия базы
 * запрещена config plugin `plugins/withNoDataBackup.js`: на iOS каталог `Documents/SQLite`
 * помечается `isExcludedFromBackup` при запуске, на Android — `allowBackup: false` и
 * `dataExtractionRules` (облачная копия и перенос на новое устройство).
 */
import * as SQLite from 'expo-sqlite';
import { migrate } from './schema';
import type { SqlDb, SqlValue } from './sql';

const ACCOUNT_ID = /^[A-Za-z0-9-]{8,64}$/;

export function localDbName(accountId: string): string {
  if (!ACCOUNT_ID.test(accountId)) throw new Error('Недопустимый id аккаунта для имени базы');
  return `talentia-${accountId}.db`;
}

/**
 * `withExclusiveTransactionAsync`, а не `withTransactionAsync`: второй, по документации
 * expo-sqlite, не эксклюзивен, и чужой запрос на том же соединении попадал внутрь — откат
 * согласия молча стирал пробу из журнала (аудит 2026-09-30). Внутри — только `tx`.
 */
function adapt(db: SQLite.SQLiteDatabase, inTransaction = false): SqlDb {
  const self: SqlDb = {
    async run(sql, params = []) {
      const r = await db.runAsync(sql, params as SqlValue[]);
      return { changes: r.changes };
    },
    all: <T>(sql: string, params: readonly SqlValue[] = []) => db.getAllAsync<T>(sql, params as SqlValue[]),
    exec: (sql) => db.execAsync(sql),
    async transaction(fn) {
      if (inTransaction) return fn(self);
      let out!: Awaited<ReturnType<typeof fn>>;
      await db.withExclusiveTransactionAsync(async (txn) => {
        out = await fn(adapt(txn, true));
      });
      return out;
    },
  };
  return self;
}

const opened = new Map<string, { raw: Promise<SQLite.SQLiteDatabase>; db: Promise<SqlDb> }>();

/** Открыть базу аккаунта и накатить схему. Повторные вызовы возвращают ту же базу. */
export function openLocalDb(accountId: string): Promise<SqlDb> {
  const name = localDbName(accountId);
  let entry = opened.get(name);
  if (!entry) {
    const raw = SQLite.openDatabaseAsync(name);
    const db = raw.then(async (r) => {
      const a = adapt(r);
      await a.exec('PRAGMA journal_mode = WAL; PRAGMA secure_delete = ON; PRAGMA foreign_keys = ON;');
      await migrate(a);
      return a;
    });
    entry = { raw, db };
    opened.set(name, entry);
  }
  return entry.db;
}

/** Удаление аккаунта: закрыть базу и удалить файл целиком, а не только строки. */
export async function deleteLocalDb(accountId: string): Promise<void> {
  const name = localDbName(accountId);
  const entry = opened.get(name);
  if (entry) {
    await (await entry.raw).closeAsync();
    opened.delete(name);
  }
  await SQLite.deleteDatabaseAsync(name);
}
