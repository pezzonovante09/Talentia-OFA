/**
 * №148: «Удалить аккаунт» стирает базы и PIN **всех** аккаунтов устройства, а не только текущего.
 * Брошенный аккаунт (после сбоя старта или настройки) находится по реестру
 * `talentia:accounts:known:<id>`, по `talentia:account:current` и по именам файлов `talentia-<id>.db*`.
 * Удаление повторяемо: сбой на любом шаге и повтор оставляют устройство пустым. Файл базы, который
 * не удалился, — ошибка удаления, а не тихий успех.
 */
import { CURRENT_ACCOUNT_KEY } from '../account';
import { DB_FILE, knownAccountKey, secureKeys, type CleanedPart, type DeviceStore } from '../device';
import { wipeAccountEverywhere } from '../deleteEverywhere';
import type { SqlDb } from '../sql';
import { failOnce, fakeDevice, type FakeDevice } from '../../../test/fakeDevice';
import { memoryDb, writeLessonRun } from './nodeSql';

const X = '0a1b2c3d-0000-4000-8000-00000000000a';
const Y = '0a1b2c3d-0000-4000-8000-00000000000b';
const KID = '00000000-0000-4000-8000-0000000000d1';
const FOREIGN = ['other.db', 'talentia.db', 'talentia-short.db', `talentia-${X}.db.bak`, `talentia-${X}.dbx`, `Talentia-${X}.db`, `x-talentia-${X}.db`];

const ourFiles = (d: FakeDevice) => [...d.files].filter((f) => f.startsWith('talentia-')).filter((f) => DB_FILE.test(f));
const pinOf = (id: string) => secureKeys(id);

/** Текущий аккаунт X с базой и спутниками, данными ребёнка в AsyncStorage и кеше. */
function withCurrent(d: FakeDevice, id = X) {
  d.storage.set(CURRENT_ACCOUNT_KEY, id);
  d.storage.set(knownAccountKey(id), '1');
  for (const k of pinOf(id)) d.secure.set(k, '{}');
  for (const s of ['', '-wal', '-shm']) d.files.add(`talentia-${id}.db${s}`);
  d.storage.set(`talentia:child:${KID}:settings`, '{}');
  d.storage.set('talentia:telemetry:q', '[]');
  d.storage.set('other-app', 'keep');
  d.cache.add(`voice/child/${KID}/hello.mp3`);
  d.cache.add('export/kid.json');
  d.notifications.add(KID);
}

/** Брошенный аккаунт Y: реестр, PIN, база со спутником — но не текущий. */
function withOrphan(d: FakeDevice, id = Y, { registry = true, files = ['', '-wal'] } = {}) {
  if (registry) d.storage.set(knownAccountKey(id), '1');
  for (const k of pinOf(id)) d.secure.set(k, '{}');
  for (const s of files) d.files.add(`talentia-${id}.db${s}`);
}

/** Как `deleteLocalDb`: удаляет основной файл; спутники — забота `deleteDbFiles`. */
const deleteMainFile = (d: FakeDevice, id = X) => async () => void d.files.delete(`talentia-${id}.db`);

async function filledDb(): Promise<SqlDb> {
  const db = await memoryDb();
  await writeLessonRun(db, { id: 'r', childId: KID, lessonId: 'l', startedAt: '2026-10-20T10:00:00.000Z', taskSeconds: [10], reviewTasks: 0 });
  return db;
}

const wipe = (db: SqlDb, d: DeviceStore, deleteDbFile: () => Promise<void>, accountId = X) =>
  wipeAccountEverywhere({ db, device: d, accountId, deleteDbFile, deliverRevocations: async () => true });

/** На устройстве не осталось ничего нашего: ни файлов баз, ни PIN, ни ключей, ни кеша, ни уведомлений. */
function expectEmpty(d: FakeDevice) {
  expect({
    files: ourFiles(d),
    secure: [...d.secure.keys()],
    storage: [...d.storage.keys()],
    cache: [...d.cache],
    notifications: [...d.notifications],
  }).toEqual({ files: [], secure: [], storage: ['other-app'], cache: [], notifications: [] });
}

describe('удаление всех баз и PIN устройства (№148)', () => {
  it('брошенный аккаунт с реестром: его база, спутники и PIN удалены вместе с текущим', async () => {
    const d = fakeDevice();
    withCurrent(d);
    withOrphan(d);
    await wipe(await filledDb(), d, deleteMainFile(d));
    expectEmpty(d);
  });

  it('брошенный аккаунт без реестра (создан до №148): найден по имени файла базы, PIN удалён', async () => {
    const d = fakeDevice();
    withCurrent(d);
    withOrphan(d, Y, { registry: false });
    await wipe(await filledDb(), d, deleteMainFile(d));
    expect(pinOf(Y).filter((k) => d.secure.has(k))).toEqual([]);
  });

  it('брошенный -wal без .db: файл удалён, PIN его аккаунта удалён', async () => {
    const d = fakeDevice();
    withCurrent(d);
    withOrphan(d, Y, { registry: false, files: ['-wal'] });
    await wipe(await filledDb(), d, deleteMainFile(d));
    expect([ourFiles(d), pinOf(Y).filter((k) => d.secure.has(k))]).toEqual([[], []]);
  });

  it.each([['-journal'], ['-shm']])('брошенный %s без .db удалён', async (suffix) => {
    const d = fakeDevice();
    withCurrent(d);
    d.files.add(`talentia-${Y}.db${suffix}`);
    await wipe(await filledDb(), d, deleteMainFile(d));
    expect(ourFiles(d)).toEqual([]);
  });

  it('спутники текущей базы (-wal, -shm) удалены, даже если deleteDbFile убрал только .db', async () => {
    const d = fakeDevice();
    withCurrent(d);
    await wipe(await filledDb(), d, deleteMainFile(d));
    expect(ourFiles(d)).toEqual([]);
  });

  it('id из talentia:account:current без реестра и без файла: PIN удалён', async () => {
    const d = fakeDevice();
    withCurrent(d);
    d.storage.set(CURRENT_ACCOUNT_KEY, Y);
    for (const k of pinOf(Y)) d.secure.set(k, '{}');
    await wipe(await filledDb(), d, deleteMainFile(d));
    expect([...d.secure.keys()]).toEqual([]);
  });

  it('файлы с чужими именами не тронуты', async () => {
    const d = fakeDevice();
    withCurrent(d);
    for (const f of FOREIGN) d.files.add(f);
    await wipe(await filledDb(), d, deleteMainFile(d));
    expect([...d.files].sort()).toEqual([...FOREIGN].sort());
  });

  it('id из чужого файла не принимается за аккаунт: чужие ключи SecureStore не трогаются', async () => {
    const d = fakeDevice();
    withCurrent(d);
    d.files.add('talentia-short.db');
    d.secure.set('talentia.short.pin', 'чужое');
    await wipe(await filledDb(), d, deleteMainFile(d));
    expect(d.secure.get('talentia.short.pin')).toBe('чужое');
  });

  it('CleanedPart содержит orphan_accounts', async () => {
    const d = fakeDevice();
    withCurrent(d);
    const done = await wipe(await filledDb(), d, deleteMainFile(d));
    expect(done).toContain<CleanedPart>('orphan_accounts');
  });

  it('файл базы остался после удаления — wipe бросает', async () => {
    const d = fakeDevice();
    withCurrent(d);
    withOrphan(d);
    // файл занят: удаление «прошло», а файл на месте
    const stuck = `talentia-${Y}.db`;
    const real = d.deleteDbFiles;
    d.deleteDbFiles = async (ns) => real(ns.filter((n) => n !== stuck));
    await expect(wipe(await filledDb(), d, deleteMainFile(d))).rejects.toThrow(/Файлы баз остались/);
    expect(d.files.has(stuck)).toBe(true);
  });

  it('файл текущей базы не удалился (deleteDbFile без эффекта) — его снимает deleteDbFiles', async () => {
    const d = fakeDevice();
    withCurrent(d);
    await wipe(await filledDb(), d, async () => undefined);
    expect(ourFiles(d)).toEqual([]);
  });
});

/** База, которую закрывает `deleteDbFile`: как `deleteLocalDb` — старая ручка дальше бросает. */
function closable(db: SqlDb) {
  let closed = false;
  const alive = () => {
    if (closed) throw new Error('Локальная база закрыта: аккаунт удаляется');
  };
  const handle: SqlDb = {
    run: async (s, p) => (alive(), db.run(s, p)),
    all: async (s, p) => (alive(), db.all(s, p)),
    exec: async (s) => (alive(), db.exec(s)),
    transaction: async (fn) => (alive(), db.transaction(fn)),
  };
  return { handle, close: () => void (closed = true) };
}

type Fault = (d: FakeDevice, ctx: { failDeleteFile: () => void; failTransaction: () => void }) => void;
/** Каждый шаг `wipeAccountEverywhere` по порядку (у текущего X и брошенного Y — две записи SecureStore). */
const BEFORE_FILE: [string, Fault][] = [
  ['keys() — сбор id', (d) => failOnce(d, 'keys', 1)],
  ['getItem(current)', (d) => failOnce(d, 'getItem', 1)],
  ['listDbFiles — сбор id', (d) => failOnce(d, 'listDbFiles', 1)],
  ['wipeDevice — строки базы', (_, c) => c.failTransaction()],
  ['deleteDbFile — файл текущей базы', (_, c) => c.failDeleteFile()],
];
const AFTER_FILE: [string, Fault][] = [
  ['listDbFiles — перед удалением файлов', (d) => failOnce(d, 'listDbFiles', 2)],
  ['deleteDbFiles', (d) => failOnce(d, 'deleteDbFiles', 1)],
  ['removeSecure — первый id', (d) => failOnce(d, 'removeSecure', 1)],
  ['removeSecure — второй id', (d) => failOnce(d, 'removeSecure', 2)],
  ['removeKeys — AsyncStorage', (d) => failOnce(d, 'removeKeys', 1)],
  ['removeKeys — телеметрия', (d) => failOnce(d, 'removeKeys', 2)],
  ['listDbFiles — проверка после удаления', (d) => failOnce(d, 'listDbFiles', 3)],
  ['deleteCacheDir — озвучка', (d) => failOnce(d, 'deleteCacheDir', 1)],
  ['deleteCacheDir — экспорт', (d) => failOnce(d, 'deleteCacheDir', 2)],
  ['cancelAllNotifications', (d) => failOnce(d, 'cancelAllNotifications', 1)],
];

/** Устройство X + брошенный Y; сбой внедрён; первый вызов wipe падает. */
async function failedOnce(fault: Fault) {
  const d = fakeDevice();
  withCurrent(d);
  withOrphan(d);
  const raw = await filledDb();
  const { handle, close } = closable(raw);
  let deleteFails = false;
  let txFails = false;
  const db: SqlDb = { ...handle, transaction: async (fn) => {
    if (txFails) {
      txFails = false;
      throw new Error('внедрённый сбой транзакции');
    }
    return handle.transaction(fn);
  } };
  fault(d, { failDeleteFile: () => void (deleteFails = true), failTransaction: () => void (txFails = true) });
  // `undeliveredRevocations` читает без транзакции; первая транзакция — wipeDevice
  const deleteDbFile = async () => {
    close();
    if (deleteFails) {
      deleteFails = false;
      throw new Error('внедрённый сбой deleteDatabaseAsync');
    }
    d.files.delete(`talentia-${X}.db`);
  };
  await expect(wipe(db, d, deleteDbFile)).rejects.toThrow(/внедрённый сбой/);
  return { d, raw, db, deleteDbFile };
}

describe('сбой на каждом шаге, затем повтор (№148)', () => {
  it.each([...BEFORE_FILE, ...AFTER_FILE])('сбой: %s → повтор с заново открытой базой → пусто', async (_, fault) => {
    const { d, raw } = await failedOnce(fault);
    // после перезапуска база открывается заново (файл есть — те же строки; удалён — пустая)
    await wipe(raw, d, deleteMainFile(d));
    expectEmpty(d);
  });

  it.each(BEFORE_FILE.filter(([n]) => !n.startsWith('deleteDbFile')))('сбой до закрытия базы: %s → повтор кнопкой в той же сессии → пусто', async (_, fault) => {
    const { d, db, deleteDbFile } = await failedOnce(fault);
    await wipe(db, d, deleteDbFile);
    expectEmpty(d);
  });

  /**
   * Регрессия (№148, исправлено меткой WIPE_PENDING_KEY): после `deleteDbFile` ручка базы в сторе закрыта (`deleteLocalDb` → `LocalDbClosedError`), а
   * повтор «Удалить аккаунт» на том же экране снова начинает с `undeliveredRevocations(db)` по этой
   * ручке и падает, не дойдя до устройства. В той же сессии удаление не довести до конца никогда.
   * deleteEverywhere.ts:118 (первое обращение к db), app/parent/confirm/[action].tsx:88.
   */
  it.each([...BEFORE_FILE.filter(([n]) => n.startsWith('deleteDbFile')), ...AFTER_FILE])(
    'сбой после закрытия базы: %s → повтор кнопкой в той же сессии → пусто',
    async (_, fault) => {
      const { d, db, deleteDbFile } = await failedOnce(fault);
      await wipe(db, d, deleteDbFile);
      expectEmpty(d);
    },
  );
});
