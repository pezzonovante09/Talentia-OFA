/**
 * Фейк `expo-sqlite`, повторяющий то боевое поведение, из-за которого нужны очередь записи и PRAGMA
 * на каждой транзакции (раунд 3, Г1). Не тест: имя без `.test`, jest его не запускает.
 *
 * - `withExclusiveTransactionAsync` создаёт НОВОЕ соединение-объект на каждый вызов (как нативный
 *   модуль): его PRAGMA не зависят от основного соединения, `secure_delete` по умолчанию OFF.
 * - Файл базы пускает одного писателя: транзакция держит замок от начала до конца, запись на
 *   основном соединении (`runAsync` / `execAsync`) — на время своей операции. Если писатель пришёл,
 *   пока замок у другого, — `database is locked` (в бою `busy_timeout` не помогает при
 *   `SQLITE_BUSY_SNAPSHOT`, поэтому модель строгая). Чтения (`getAllAsync`) замок не ждут (WAL).
 * - Время в модели — микрозадачи (`hop`): детерминированно, без таймеров.
 */

export type StatementLog = {
  sql: string;
  conn: string;
  /** `secure_delete` соединения в момент выполнения оператора. */
  secureDelete: 'ON' | 'OFF';
  busyTimeout: number;
  inTransaction: boolean;
};

type Conn = { id: string; secureDelete: 'ON' | 'OFF'; busyTimeout: number };

export class FakeFile {
  name: string;
  holder: string | null = null;
  concurrent = 0;
  maxConcurrentWriters = 0;
  userVersion = 0;
  /** Сколько раз открыта транзакция (`withExclusiveTransactionAsync`). */
  transactions = 0;
  /** События по порядку: `begin:<conn>` / `end:<conn>` у записей, `read` у чтений. */
  events: string[] = [];
  statements: StatementLog[] = [];
  mainConn: Conn;
  closed = false;
  private seq = 0;

  constructor(name: string) {
    this.name = name;
    this.mainConn = this.newConn('main');
  }

  newConn(prefix: string): Conn {
    this.seq += 1;
    return { id: `${prefix}#${this.seq}`, secureDelete: 'OFF', busyTimeout: 0 };
  }
}

/** Несколько микрозадач: операция «длится» и другие успевают вклиниться. */
export const hop = async (n = 4): Promise<void> => {
  for (let i = 0; i < n; i += 1) await Promise.resolve();
};

function applyPragmas(conn: Conn, sql: string, file: FakeFile): void {
  for (const m of sql.matchAll(/PRAGMA\s+(\w+)\s*=\s*(\w+)/gi)) {
    const [, key, value] = m;
    if (key.toLowerCase() === 'secure_delete') conn.secureDelete = /^(on|1|true)$/i.test(value) ? 'ON' : 'OFF';
    if (key.toLowerCase() === 'busy_timeout') conn.busyTimeout = Number(value);
    if (key.toLowerCase() === 'user_version') file.userVersion = Number(value);
  }
}

function makeConnection(file: FakeFile, conn: Conn, owner: string | null) {
  const log = (sql: string) =>
    file.statements.push({
      sql,
      conn: conn.id,
      secureDelete: conn.secureDelete,
      busyTimeout: conn.busyTimeout,
      inTransaction: owner !== null,
    });

  /** Запись: внутри транзакции замок уже у неё, вне — берётся на время операции. */
  async function write<T>(sql: string, body: () => T): Promise<T> {
    if (owner === null) {
      if (file.holder !== null) throw new Error(`database is locked (${conn.id} vs ${file.holder})`);
      file.holder = conn.id;
      file.concurrent += 1;
      file.maxConcurrentWriters = Math.max(file.maxConcurrentWriters, file.concurrent);
      file.events.push(`begin:${conn.id}`);
    } else if (file.holder !== owner) {
      throw new Error('транзакция уже закончилась');
    }
    try {
      log(sql);
      applyPragmas(conn, sql, file);
      await hop();
      return body();
    } finally {
      if (owner === null) {
        file.events.push(`end:${conn.id}`);
        file.concurrent -= 1;
        file.holder = null;
      }
    }
  }

  return {
    runAsync: (sql: string, _params?: unknown[]) => write(sql, () => ({ changes: 1, lastInsertRowId: 1 })),
    execAsync: (sql: string) => write(sql, () => undefined),
    getAllAsync: async <T>(sql: string, _params?: unknown[]): Promise<T[]> => {
      file.events.push(`read:${conn.id}`);
      log(sql);
      await hop();
      if (/PRAGMA\s+user_version\s*$/i.test(sql.trim())) return [{ user_version: file.userVersion }] as T[];
      if (/PRAGMA\s+secure_delete\s*$/i.test(sql.trim())) return [{ secure_delete: conn.secureDelete === 'ON' ? 1 : 0 }] as T[];
      return [];
    },
  };
}

export const files = new Map<string, FakeFile>();

export function fileOf(name: string): FakeFile {
  const f = files.get(name);
  if (!f) throw new Error(`файл ${name} не открывался`);
  return f;
}

export const fakeExpoSqlite = {
  async openDatabaseAsync(name: string) {
    let file = files.get(name);
    if (!file) {
      file = new FakeFile(name);
      files.set(name, file);
    }
    const f = file;
    return {
      ...makeConnection(f, f.mainConn, null),
      closeAsync: async () => {
        f.closed = true;
      },
      async withExclusiveTransactionAsync(task: (txn: unknown) => Promise<void>) {
        if (f.holder !== null) throw new Error(`database is locked (BEGIN vs ${f.holder})`);
        const conn = f.newConn('tx');
        f.holder = conn.id;
        f.concurrent += 1;
        f.maxConcurrentWriters = Math.max(f.maxConcurrentWriters, f.concurrent);
        f.transactions += 1;
        f.events.push(`begin:${conn.id}`);
        try {
          await hop();
          await task(makeConnection(f, conn, conn.id));
        } finally {
          f.events.push(`end:${conn.id}`);
          f.concurrent -= 1;
          f.holder = null;
        }
      },
    };
  },
  async deleteDatabaseAsync(name: string) {
    files.delete(name);
  },
};
