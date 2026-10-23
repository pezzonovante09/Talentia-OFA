/**
 * Порт `SqlDb` поверх встроенного SQLite Node — для тестов: та же схема и те же
 * триггеры, что на устройстве, на настоящем SQLite, без моков.
 *
 * Транзакции — эксклюзивные, как `withExclusiveTransactionAsync` в приложении: пока идёт
 * транзакция, запросы мимо её `tx` ждут её конца. Иначе тест скрыл бы ровно ту ошибку,
 * из-за которой порт так устроен.
 */
import type { LessonRun } from '../../../domain/parentReport';
import { saveChildState, type ChildStateValues, type LESSON_STATE_KEYS } from '../childState';
import { appendLessonRun } from '../lessonRuns';
import { MIGRATIONS, migrate } from '../schema';
import type { SqlDb, SqlValue } from '../sql';

type Stmt = { run(...p: SqlValue[]): { changes: number | bigint }; all(...p: SqlValue[]): unknown[] };
type NodeDb = { exec(sql: string): void; prepare(sql: string): Stmt };

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => NodeDb };

/** Событие согласия `account_local`, которым `memoryDb` открывает базу «с аккаунтом». */
export const TEST_ACCOUNT_CONSENT = {
  id: 'test-account-local',
  textVersion: 'ru-draft-1',
  actorId: 'test-owner',
  at: '2026-01-01T00:00:00.000Z',
} as const;

/**
 * `upTo` — накатить только первые N миграций (база «как была на версии N»): для проверки
 * миграции на данных предыдущей версии. Дальше — `migrate(db)`, как при открытии приложения.
 *
 * `account` — устройство с аккаунтом: в журнале уже есть согласие `account_local` (№124), без
 * него не пишется ничего о ребёнке. `false` — режим без записи, для тестов самого согласия.
 */
export async function memoryDb(upTo?: number, { account = true }: { account?: boolean } = {}): Promise<SqlDb> {
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
  if (upTo === undefined) {
    await migrate(root);
  } else {
    for (let v = 0; v < upTo; v += 1) {
      await root.transaction(async (t) => {
        await t.exec(MIGRATIONS[v]);
        await t.exec(`PRAGMA user_version = ${v + 1}`);
      });
    }
  }
  if (account) {
    const c = TEST_ACCOUNT_CONSENT;
    await root.run(
      `INSERT INTO consent_events (id, scope, action, child_id, text_version, confirmed_by, actor_id, at)
       VALUES (?, 'account_local', 'grant', NULL, ?, 'signup', ?, ?)`,
      [c.id, c.textVersion, c.actorId, c.at],
    );
  }
  return root;
}

/**
 * Запись итогов урока в обход проверки согласия — только для тестов, которым согласие не
 * предмет. Открывает те же ворота, что `withLessonWrite` в `lessonRuns.ts`, внутри одной
 * транзакции.
 */
export async function asLessonWriter(db: SqlDb, childId: string, fn: (tx: SqlDb) => Promise<void>): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.run('INSERT INTO lesson_write_gate (child_id) VALUES (?)', [childId]);
    await fn(tx);
    await tx.run('DELETE FROM lesson_write_gate WHERE child_id = ?', [childId]);
  });
}

/** Прохождение через ворота урока — для тестов синхронизации, срока хранения и формата. */
export const writeLessonRun = (db: SqlDb, run: LessonRun): Promise<void> =>
  asLessonWriter(db, run.childId, (tx) => appendLessonRun(tx, run));

/** Навыки, атлас или счётчик уроков через ворота урока. */
export const writeLessonState = <K extends (typeof LESSON_STATE_KEYS)[number]>(
  db: SqlDb,
  childId: string,
  key: K,
  value: ChildStateValues[K],
  at: string,
): Promise<void> => asLessonWriter(db, childId, (tx) => saveChildState(tx, childId, key, value, at));

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
