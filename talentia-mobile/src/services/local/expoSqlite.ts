/**
 * Локальная база приложения на `expo-sqlite`. **Файл на аккаунт** (`talentia-<uid>.db`):
 * выход из аккаунта прогресс не стирает, но аккаунты на одном устройстве не видят
 * журналов друг друга, в том числе согласий (PARENT.md, «Данные на устройстве»). Внутри
 * файла данные детей разделены колонкой `child_id`.
 *
 * `secure_delete` — удалённое затирается на диске, а не остаётся в свободных страницах (на
 * соединении КАЖДОЙ транзакции, см. `CONNECTION_PRAGMAS`); после удалений журнал WAL сжимается
 * (`compactAfterDelete`). Резервная копия базы
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
 * Настройки, которые действуют только на своём соединении, а не на файле: `secure_delete`
 * (затирание удалённого) и `busy_timeout` (ждать замок, а не падать с `database is locked`).
 * `withExclusiveTransactionAsync` открывает на КАЖДУЮ транзакцию новое нативное соединение и шлёт на
 * нём обычный `BEGIN`, так что PRAGMA основного соединения транзакции не касаются — а все
 * удаления (`purgeChild`, `revokeAbaProcessing`, `applyRetention`, `wipeDevice`) идут как раз
 * транзакциями. Поэтому PRAGMA выставляются заново внутри каждой транзакции (раунд 3, Г1).
 * `foreign_keys` внутри транзакции не действует; в локальной схеме внешних ключей нет.
 */
const CONNECTION_PRAGMAS = 'PRAGMA busy_timeout = 5000; PRAGMA secure_delete = ON;';

/**
 * Очередь записи на файл базы: транзакции и записи вне транзакции идут по одной, как в тестовой
 * модели (`__tests__/nodeSql.ts`). Нативный SQLite с WAL пускает одного писателя; без очереди
 * фоновая синхронизация, пишущая на основном соединении, сталкивалась бы с `recordAbaTrial`, и
 * вторая запись падала бы с `SQLITE_BUSY` (в отложенной транзакции — `SQLITE_BUSY_SNAPSHOT`, и
 * `busy_timeout` тут не помогает). Чтения очередь не ждут. Внутри транзакции работать только с её
 * `tx`: обращение к корневой базе из `fn` встало бы в очередь за самой транзакцией.
 */
type WriteQueue = <T>(task: () => Promise<T>) => Promise<T>;

function newWriteQueue(): WriteQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>) => {
    const next = tail.catch(() => undefined).then(task);
    tail = next;
    return next;
  };
}

/**
 * `withExclusiveTransactionAsync`, а не `withTransactionAsync`: второй, по документации
 * expo-sqlite, не эксклюзивен, и чужой запрос на том же соединении попадал внутрь — откат
 * согласия молча стирал пробу из журнала (аудит 2026-09-30). Внутри — только `tx`.
 */
function adapt(db: SQLite.SQLiteDatabase, serial: WriteQueue, inTransaction = false): SqlDb {
  const write = <T>(task: () => Promise<T>) => (inTransaction ? task() : serial(task));
  const self: SqlDb = {
    run: (sql, params = []) =>
      write(async () => {
        const r = await db.runAsync(sql, params as SqlValue[]);
        return { changes: r.changes };
      }),
    all: <T>(sql: string, params: readonly SqlValue[] = []) => db.getAllAsync<T>(sql, params as SqlValue[]),
    exec: (sql) => write(() => db.execAsync(sql)),
    async transaction(fn) {
      if (inTransaction) return fn(self);
      return serial(async () => {
        let out!: Awaited<ReturnType<typeof fn>>;
        await db.withExclusiveTransactionAsync(async (txn) => {
          await txn.execAsync(CONNECTION_PRAGMAS);
          out = await fn(adapt(txn, serial, true));
        });
        return out;
      });
    },
  };
  return self;
}

const opened = new Map<string, { raw: Promise<SQLite.SQLiteDatabase>; db: Promise<SqlDb>; serial: WriteQueue }>();

/** Открыть базу аккаунта и накатить схему. Повторные вызовы возвращают ту же базу. */
export function openLocalDb(accountId: string): Promise<SqlDb> {
  const name = localDbName(accountId);
  let entry = opened.get(name);
  if (!entry) {
    const raw = SQLite.openDatabaseAsync(name);
    const serial = newWriteQueue();
    const db = raw.then(async (r) => {
      const a = adapt(r, serial);
      await a.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; ${CONNECTION_PRAGMAS}`);
      await migrate(a);
      return a;
    });
    entry = { raw, db, serial };
    opened.set(name, entry);
    // Сбой открытия или наката не должен навсегда остаться в кэше: повторный вызов пробует заново.
    const failed = entry;
    db.catch(() => {
      if (opened.get(name) === failed) opened.delete(name);
      raw.then((r) => r.closeAsync()).catch(() => undefined);
    });
  }
  return entry.db;
}

/**
 * Удаление аккаунта: закрыть базу и удалить файл целиком, а не только строки. Закрытие встаёт в
 * очередь записи — за накатом схемы и транзакциями, начатыми до вызова: нативный `closeAsync`
 * посреди транзакции, а `deleteDatabaseAsync` при открытом соединении бросают, и файл, ключи и
 * PIN остались бы на устройстве (раунд 4, backend 1). Новые записи после вызова базы уже не видят.
 */
export async function deleteLocalDb(accountId: string): Promise<void> {
  const name = localDbName(accountId);
  const entry = opened.get(name);
  if (entry) {
    opened.delete(name);
    // сбой открытия или наката соединение уже закрыл (`openLocalDb`): дождаться и не закрывать второй раз
    const ready = await entry.db.then(
      () => true,
      () => false,
    );
    if (ready) {
      const raw = await entry.raw;
      await entry.serial(() => raw.closeAsync());
    }
  }
  await SQLite.deleteDatabaseAsync(name);
}
