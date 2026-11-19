/**
 * Локальная база для **Expo Web-прототипа** — платформенная замена `expoSqlite.ts` (Metro берёт
 * `.web.ts` только на web; iOS/Android этот файл не видят, Jest тоже).
 *
 * Почему не `expo-sqlite`: его web-реализация поднимает Worker по адресу страницы
 * (`new Worker(new URL('./worker', window.location.href))`), чего Metro-dev не обслуживает, —
 * раздел родителя в браузере не открывался вовсе. Здесь — `sql.js` (asm.js-сборка, без wasm-ассетов),
 * тот же SQLite и та же схема (`migrate`), снимок базы — в `localStorage` после каждой записи.
 * Это ворота прототипа: в выпуске web нет (PARENT.md «Web»), гарантии `secure_delete`/WAL здесь не нужны.
 * Тот же контракт, что у нативного адаптера: файл на аккаунт, `LocalDbClosedError` после удаления,
 * эксклюзивная транзакция через очередь записи.
 */
import initSqlJs from 'sql.js/dist/sql-asm.js';

import { migrate } from './schema';
import type { SqlDb, SqlValue } from './sql';

type Database = initSqlJs.Database;

const ACCOUNT_ID = /^[A-Za-z0-9-]{8,64}$/;
const STORAGE_PREFIX = 'talentia:web-db:';

export function localDbName(accountId: string): string {
  if (!ACCOUNT_ID.test(accountId)) throw new Error('Недопустимый id аккаунта для имени базы');
  return `talentia-${accountId}.db`;
}

export class LocalDbClosedError extends Error {
  constructor() {
    super('Локальная база закрыта: аккаунт удаляется');
  }
}

type WriteQueue = <T>(task: () => Promise<T>) => Promise<T>;
function newWriteQueue(): WriteQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>) => {
    const next = tail.catch(() => undefined).then(task);
    tail = next;
    return next;
  };
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function adapt(db: Database, name: string, serial: WriteQueue, inTransaction = false, closed: () => boolean = () => false): SqlDb {
  const alive = () => {
    if (closed()) throw new LocalDbClosedError();
  };
  const persist = () => {
    try {
      localStorage.setItem(STORAGE_PREFIX + name, toBase64(db.export()));
    } catch {
      // прототип: снимок не сохранился — данные живут до перезагрузки
    }
  };
  const write = <T>(task: () => T): Promise<T> => {
    alive();
    const job = async () => {
      const out = task();
      if (!inTransaction) persist();
      return out;
    };
    return inTransaction ? job() : serial(job);
  };
  const self: SqlDb = {
    run: (sql, params = []) =>
      write(() => {
        db.run(sql, params as SqlValue[]);
        return { changes: db.getRowsModified() };
      }),
    all: async <T>(sql: string, params: readonly SqlValue[] = []) => {
      alive();
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params as SqlValue[]);
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt.free();
      }
    },
    exec: (sql) =>
      write(() => {
        db.exec(sql);
      }),
    async transaction(fn) {
      if (inTransaction) return fn(self);
      alive();
      return serial(async () => {
        db.exec('BEGIN IMMEDIATE');
        try {
          const out = await fn(adapt(db, name, serial, true));
          db.exec('COMMIT');
          persist();
          return out;
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      });
    },
  };
  return self;
}

type Entry = { raw: Promise<Database>; db: Promise<SqlDb>; serial: WriteQueue; dead: boolean };
const opened = new Map<string, Entry>();
const deleting = new Set<string>();
let engine: ReturnType<typeof initSqlJs> | null = null;

export function openLocalDb(accountId: string): Promise<SqlDb> {
  const name = localDbName(accountId);
  if (deleting.has(name)) return Promise.reject(new LocalDbClosedError());
  let entry = opened.get(name);
  if (!entry) {
    engine ??= initSqlJs();
    const raw = engine.then((SQL) => {
      const snapshot = localStorage.getItem(STORAGE_PREFIX + name);
      return new SQL.Database(snapshot ? fromBase64(snapshot) : undefined);
    });
    const serial = newWriteQueue();
    const self: Entry = { raw, db: Promise.resolve(null as unknown as SqlDb), serial, dead: false };
    const db = raw.then(async (r) => {
      const boot = adapt(r, name, serial);
      await boot.exec('PRAGMA foreign_keys = ON;');
      await migrate(boot);
      return adapt(r, name, serial, false, () => self.dead);
    });
    self.db = db;
    entry = self;
    opened.set(name, entry);
    const failed = entry;
    db.catch(() => {
      if (opened.get(name) === failed) opened.delete(name);
    });
  }
  return entry.db;
}

export async function deleteLocalDb(accountId: string): Promise<void> {
  const name = localDbName(accountId);
  deleting.add(name);
  try {
    const entry = opened.get(name);
    if (entry) {
      entry.dead = true;
      opened.delete(name);
      const ready = await entry.db.then(
        () => true,
        () => false,
      );
      if (ready) {
        const raw = await entry.raw;
        await entry.serial(async () => raw.close());
      }
    }
    localStorage.removeItem(STORAGE_PREFIX + name);
  } finally {
    deleting.delete(name);
  }
}
