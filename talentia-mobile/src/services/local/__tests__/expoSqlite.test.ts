/**
 * Адаптер `expo-sqlite` (раунд 3, Г1 / НБ-1): очередь записи на файл базы, PRAGMA на соединении
 * каждой транзакции и на основном соединении. Нативный модуль заменён фейком, который ведёт себя
 * как боевой: новое соединение на каждую транзакцию, один писатель на файл, `database is locked`
 * при пересечении, `secure_delete` по умолчанию OFF (`fakeExpoSqlite.ts`).
 */
import { fakeExpoSqlite, failNextExec, failNextOpen, files, fileOf, hop, injected, resetInjected } from './fakeExpoSqlite';
import { deleteLocalDb, localDbName, openLocalDb } from '../expoSqlite';
import type { SqlDb } from '../sql';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('expo-sqlite', () => require('./fakeExpoSqlite').fakeExpoSqlite);

let n = 0;
/** Свежий аккаунт на тест: `openLocalDb` помнит базы по имени файла. */
async function open() {
  n += 1;
  const account = `account-${String(n).padStart(4, '0')}`;
  const db = await openLocalDb(account);
  return { db, file: fileOf(localDbName(account)) };
}

/** Транзакция вроде `recordAbaTrial`: чтение согласия, затем две записи. */
const recordLike = (db: SqlDb, id: string) =>
  db.transaction(async (tx) => {
    await tx.all('SELECT body FROM consent_events');
    await tx.run(`INSERT INTO aba_trials (id) VALUES ('${id}')`);
    await hop();
    await tx.run(`INSERT INTO child_state (key) VALUES ('${id}')`);
    return id;
  });

beforeEach(() => {
  files.clear();
  resetInjected();
});

describe('сбой открытия не остаётся в кэше', () => {
  let account = '';
  // openLocalDb кэширует по имени: свой аккаунт на каждый тест
  beforeEach(() => {
    n += 1;
    account = 'retry-' + String(n).padStart(4, '0');
  });

  it('сбой наката миграции: openLocalDb отклоняется, второй вызов успешен', async () => {
    failNextExec(2); // PRAGMA основного соединения, PRAGMA транзакции — проходят, сама миграция падает
    await expect(openLocalDb(account)).rejects.toThrow(/внедрённый сбой exec/);

    const db = await openLocalDb(account);

    expect(await db.all('PRAGMA user_version')).toEqual([{ user_version: fileOf(localDbName(account)).userVersion }]);
    expect(fileOf(localDbName(account)).userVersion).toBeGreaterThan(0);
  });

  it('после сбоя наката второй вызов возвращает новую базу, а не отклонённый промис', async () => {
    failNextExec(2);
    const first = openLocalDb(account);
    await expect(first).rejects.toThrow();

    const second = openLocalDb(account);

    expect(second).not.toBe(first);
    await expect(second).resolves.toBeDefined();
  });

  it('сбой наката закрывает нативное соединение неудавшейся попытки', async () => {
    failNextExec(2);
    await expect(openLocalDb(account)).rejects.toThrow();
    await Promise.resolve();
    await hop(10);

    expect(injected.closeCalls).toBe(1);
  });

  it('повторный вызов после успешного открытия по-прежнему возвращает ту же базу', async () => {
    failNextExec(2);
    await expect(openLocalDb(account)).rejects.toThrow();
    const ok = await openLocalDb(account);

    expect(await openLocalDb(account)).toBe(ok);
  });

  it('сбой самого открытия файла: отклонение, затем успешный повтор', async () => {
    failNextOpen();
    await expect(openLocalDb(account)).rejects.toThrow(/внедрённый сбой open/);

    await expect(openLocalDb(account)).resolves.toBeDefined();
  });

  it('сбой самого PRAGMA основного соединения: повтор успешен', async () => {
    failNextExec(0);
    await expect(openLocalDb(account)).rejects.toThrow(/внедрённый сбой exec/);

    await expect(openLocalDb(account)).resolves.toBeDefined();
  });

  it('успешный накат повторной попытки закрывает ворота: DELETE из ворот выполнен после сбоя', async () => {
    failNextExec(2);
    await expect(openLocalDb(account)).rejects.toThrow();
    const file = fileOf(localDbName(account));
    const before = file.statements.length;

    await openLocalDb(account);

    const gateClears = file.statements.slice(before).filter((s) => /DELETE FROM aba_write_gate/.test(s.sql));
    expect(gateClears).toHaveLength(1);
  });

  it('сбой одного аккаунта не мешает открытию другого', async () => {
    failNextOpen();
    await expect(openLocalDb('account-bad')).rejects.toThrow();

    await expect(openLocalDb('account-good')).resolves.toBeDefined();
  });
});

describe('очередь записи на файл базы', () => {
  it('две параллельные транзакции не пересекаются во времени и обе завершаются', async () => {
    const { db, file } = await open();
    const results = await Promise.all([recordLike(db, 'a'), recordLike(db, 'b')]);
    expect(results).toEqual(['a', 'b']);
    expect(file.maxConcurrentWriters).toBe(1);
  });

  it('параллельные транзакции идут в порядке вызова', async () => {
    const { db, file } = await open();
    const before = file.statements.length;
    await Promise.all([recordLike(db, 'a'), recordLike(db, 'b'), recordLike(db, 'c')]);
    const writes = file.statements.slice(before).filter((s) => s.sql.startsWith('INSERT'));
    expect(writes.map((s) => s.sql.match(/'(\w)'/)![1])).toEqual(['a', 'a', 'b', 'b', 'c', 'c']);
  });

  it('запись run вне транзакции ждёт конца идущей транзакции', async () => {
    const { db, file } = await open();
    const before = file.events.length;
    const tx = recordLike(db, 'a');
    const outside = db.run('INSERT INTO sync_cursor (child_id) VALUES (?)', ['kid']);
    await Promise.all([tx, outside]);
    const order = file.events.slice(before).filter((e) => !e.startsWith('read:'));
    expect(order).toEqual([
      expect.stringMatching(/^begin:tx#/),
      expect.stringMatching(/^end:tx#/),
      'begin:main#1',
      'end:main#1',
    ]);
  });

  it('транзакция, начатая во время записи run вне транзакции, ждёт её конца', async () => {
    const { db, file } = await open();
    const before = file.events.length;
    const outside = db.run('INSERT INTO sync_cursor (child_id) VALUES (?)', ['kid']);
    const tx = recordLike(db, 'a');
    await Promise.all([outside, tx]);
    const order = file.events.slice(before).filter((e) => !e.startsWith('read:'));
    expect(order.map((e) => e.split('#')[0])).toEqual(['begin:main', 'end:main', 'begin:tx', 'end:tx']);
  });

  it('две записи exec и run вне транзакции не пересекаются', async () => {
    const { db, file } = await open();
    await Promise.all([db.exec('DELETE FROM sync_problems'), db.run('DELETE FROM sync_cursor'), db.exec('DELETE FROM consent_delivered')]);
    expect(file.maxConcurrentWriters).toBe(1);
  });

  it('чтение all не ждёт идущей транзакции', async () => {
    const { db, file } = await open();
    const before = file.events.length;
    const tx = recordLike(db, 'a');
    await hop(2); // транзакция уже началась и держит замок
    await db.all('SELECT body FROM aba_trials');
    const mid = file.events.slice(before);
    expect(mid).toContainEqual(expect.stringMatching(/^read:main/));
    expect(mid.some((e) => e.startsWith('end:tx'))).toBe(false);
    await tx;
  });

  it('сбой в первой транзакции не ломает очередь: вторая выполняется', async () => {
    const { db, file } = await open();
    const failing = db.transaction(async (tx) => {
      await tx.run('INSERT INTO aba_trials (id) VALUES (?)', ['x']);
      throw new Error('диск полон');
    });
    const next = recordLike(db, 'b');
    await expect(failing).rejects.toThrow('диск полон');
    await expect(next).resolves.toBe('b');
    expect(file.holder).toBeNull();
  });

  it('сбой записи run вне транзакции не ломает очередь для следующей записи', async () => {
    const { db, file } = await open();
    // первая запись падает на замке, занятом чужой нативной операцией
    file.holder = 'native-sync';
    await expect(db.run('INSERT INTO sync_cursor (child_id) VALUES (?)', ['kid'])).rejects.toThrow(/database is locked/);
    file.holder = null;
    await expect(db.run('INSERT INTO sync_cursor (child_id) VALUES (?)', ['kid'])).resolves.toEqual({ changes: 1 });
  });

  it('вызов transaction внутри tx не открывает новой транзакции и отдаёт ту же работу', async () => {
    const { db, file } = await open();
    const before = file.transactions;
    const out = await db.transaction(async (tx) => {
      await tx.run('INSERT INTO aba_trials (id) VALUES (?)', ['a']);
      return tx.transaction(async (inner) => {
        await inner.run('INSERT INTO aba_trials (id) VALUES (?)', ['b']);
        return 'inner-done';
      });
    });
    expect(out).toBe('inner-done');
    expect(file.transactions - before).toBe(1);
  });

  it('вложенная запись на tx не встаёт в очередь за самой транзакцией (нет взаимной блокировки)', async () => {
    const { db } = await open();
    const finished = await Promise.race([
      db.transaction(async (tx) => {
        await tx.exec('DELETE FROM sync_problems');
        await tx.run('DELETE FROM sync_cursor');
        return 'ok';
      }),
      (async () => {
        for (let i = 0; i < 200; i += 1) await hop(10);
        return 'завис';
      })(),
    ]);
    expect(finished).toBe('ok');
  });
});

describe('PRAGMA на соединениях', () => {
  it('удаляющая транзакция выполняет DELETE на соединении с secure_delete = ON', async () => {
    const { db, file } = await open();
    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM aba_trials WHERE child_id = ?', ['kid']);
    });
    const del = file.statements.filter((s) => s.sql.startsWith('DELETE FROM aba_trials'));
    expect(del.map((s) => [s.inTransaction, s.secureDelete])).toEqual([[true, 'ON']]);
  });

  it('соединение транзакции — не основное, и без PRAGMA secure_delete там был бы OFF', async () => {
    const { db, file } = await open();
    const seen = await db.transaction((tx) => tx.all<{ secure_delete: number }>('PRAGMA secure_delete'));
    expect(seen).toEqual([{ secure_delete: 1 }]);
    const stmt = file.statements.filter((s) => s.inTransaction).at(-1)!;
    expect(stmt.conn).not.toBe(file.mainConn.id);
  });

  it('каждая транзакция выставляет PRAGMA заново: busy_timeout = 5000 и secure_delete = ON', async () => {
    const { db, file } = await open();
    const before = file.statements.length;
    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM aba_trials');
    });
    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM aba_sessions');
    });
    const dels = file.statements.slice(before).filter((s) => s.sql.startsWith('DELETE'));
    expect(dels.map((s) => [s.busyTimeout, s.secureDelete])).toEqual([
      [5000, 'ON'],
      [5000, 'ON'],
    ]);
    expect(new Set(dels.map((s) => s.conn)).size).toBe(2);
  });

  it('PRAGMA идут до тела транзакции', async () => {
    const { db, file } = await open();
    const before = file.statements.length;
    await db.transaction(async (tx) => {
      await tx.run('INSERT INTO aba_trials (id) VALUES (?)', ['a']);
    });
    const inTx = file.statements.slice(before).filter((s) => s.inTransaction);
    expect(inTx[0].sql).toMatch(/PRAGMA busy_timeout = 5000;\s*PRAGMA secure_delete = ON;/);
    expect(inTx[1].sql).toMatch(/^INSERT INTO aba_trials/);
  });

  it('основное соединение при открытии выставляет secure_delete = ON и busy_timeout = 5000', async () => {
    const { file } = await open();
    expect([file.mainConn.secureDelete, file.mainConn.busyTimeout]).toEqual(['ON', 5000]);
  });

  it('основное соединение открывается в WAL с foreign_keys = ON', async () => {
    const { file } = await open();
    const first = file.statements.find((s) => s.sql.includes('journal_mode'))!;
    expect(first.sql).toMatch(/journal_mode = WAL/);
    expect(first.sql).toMatch(/foreign_keys = ON/);
  });

  it('миграции накатываются под очередью и закрывают ворота; повторное открытие даёт ту же базу', async () => {
    const { db, file } = await open();
    expect(file.userVersion).toBeGreaterThan(0);
    expect(file.maxConcurrentWriters).toBe(1);
    const again = await openLocalDb(`account-${String(n).padStart(4, '0')}`);
    expect(again).toBe(db);
  });
});

describe('deleteLocalDb: закрытие через очередь записи (раунд 4, backend 1)', () => {
  async function openAccount() {
    n += 1;
    const account = `del-${String(n).padStart(4, '0')}-acct`;
    const db = await openLocalDb(account);
    return { account, db, name: localDbName(account), file: fileOf(localDbName(account)) };
  }
  /** Дождаться, пока транзакция возьмёт замок файла. */
  async function untilHeld(file: { holder: string | null }) {
    for (let i = 0; i < 100 && file.holder === null; i += 1) await Promise.resolve();
    if (file.holder === null) throw new Error('транзакция не началась');
  }

  it('контроль фейка: закрыть соединение посреди транзакции и удалить открытый файл нельзя', async () => {
    const { db, name, file } = await openAccount();
    const tx = recordLike(db, 'ctl');
    await untilHeld(file);
    const other = await fakeExpoSqlite.openDatabaseAsync(name);
    await expect(other.closeAsync()).rejects.toThrow(/busy/);
    await expect(fakeExpoSqlite.deleteDatabaseAsync(name)).rejects.toThrow(/is open/);
    await tx;
  });

  it('транзакция идёт — deleteLocalDb ждёт её конца, закрывает соединение и удаляет файл', async () => {
    const { account, db, name, file } = await openAccount();
    const tx = recordLike(db, 'in-flight');
    await untilHeld(file);
    const del = deleteLocalDb(account);
    await expect(Promise.all([tx, del])).resolves.toEqual(['in-flight', undefined]);
    expect(file.events.filter((e) => e.startsWith('end:')).length).toBeGreaterThan(0);
    expect([file.openConnections, file.closed, files.has(name)]).toEqual([0, true, false]);
    expect(injected.closeCalls).toBe(1);
  });

  it('после удаления openLocalDb открывает новую базу, а не закрытую из кэша', async () => {
    const { account, db } = await openAccount();
    await deleteLocalDb(account);
    const again = await openLocalDb(account);
    expect(again).not.toBe(db);
  });

  it('удаление во время неудачного наката: соединение закрыто один раз, файл удалён', async () => {
    n += 1;
    const account = `fail-${String(n).padStart(4, '0')}-acct`;
    failNextExec(2);
    const opening = openLocalDb(account);
    const del = deleteLocalDb(account);
    await expect(opening).rejects.toThrow();
    await del;
    expect(injected.closeCalls).toBe(1);
    expect(files.has(localDbName(account))).toBe(false);
  });

  it('база не открывалась — удаляется файл без закрытия', async () => {
    await expect(deleteLocalDb('never-opened-1')).resolves.toBeUndefined();
    expect(injected.closeCalls).toBe(0);
  });
});
