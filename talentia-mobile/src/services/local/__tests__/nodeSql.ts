/**
 * Порт `SqlDb` поверх встроенного SQLite Node — для тестов: та же схема и те же
 * триггеры, что на устройстве, на настоящем SQLite, без моков.
 *
 * Транзакции — эксклюзивные, как `withExclusiveTransactionAsync` в приложении: пока идёт
 * транзакция, запросы мимо её `tx` ждут её конца. Иначе тест скрыл бы ровно ту ошибку,
 * из-за которой порт так устроен.
 */
import { migrate } from '../schema';
import type { SqlDb, SqlValue } from '../sql';

type Stmt = { run(...p: SqlValue[]): { changes: number | bigint }; all(...p: SqlValue[]): unknown[] };
type NodeDb = { exec(sql: string): void; prepare(sql: string): Stmt };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => NodeDb };

export async function memoryDb(): Promise<SqlDb> {
  const raw = new DatabaseSync(':memory:');
  let busy: Promise<unknown> = Promise.resolve();

  const direct = (): Omit<SqlDb, 'transaction'> => ({
    async run(sql, params = []) {
      return { changes: Number(raw.prepare(sql).run(...params).changes) };
    },
    async all<T>(sql: string, params: readonly SqlValue[] = []) {
      return raw.prepare(sql).all(...params).map((r) => ({ ...(r as object) })) as T[];
    },
    async exec(sql) {
      raw.exec(sql);
    },
  });

  const tx: SqlDb = { ...direct(), transaction: (fn) => fn(tx) };

  // одна очередь на соединение: одиночный запрос и транзакция идут строго по одному
  const serial = <T>(f: () => Promise<T>): Promise<T> => {
    const next = busy.catch(() => undefined).then(f);
    busy = next;
    return next;
  };

  const root: SqlDb = {
    run: (sql, params) => serial(() => tx.run(sql, params)),
    all: <T>(sql: string, params?: readonly SqlValue[]) => serial(() => tx.all<T>(sql, params)),
    exec: (sql) => serial(() => tx.exec(sql)),
    transaction: <T>(fn: (t: SqlDb) => Promise<T>) =>
      serial(async () => {
        raw.exec('BEGIN IMMEDIATE');
        try {
          const out = await fn(tx);
          raw.exec('COMMIT');
          return out;
        } catch (e) {
          raw.exec('ROLLBACK');
          throw e;
        }
      }),
  };
  await migrate(root);
  return root;
}

/**
 * Запись данных ABA в обход проверки согласия — только для тестов, которым согласие не
 * предмет (порядок журнала, удаление, срок хранения). Открывает те же ворота, что
 * `withAbaWrite` в `commit.ts`, внутри одной транзакции.
 */
export async function asAbaWriter(db: SqlDb, childId: string, fn: (tx: SqlDb) => Promise<void>): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run('INSERT INTO aba_write_gate (child_id) VALUES (?)', [childId]);
    await fn(tx);
    await tx.run('DELETE FROM aba_write_gate WHERE child_id = ?', [childId]);
  });
}
