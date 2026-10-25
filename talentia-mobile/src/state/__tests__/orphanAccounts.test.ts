/**
 * №148 через стор аккаунта: брошенные аккаунты появляются после сбоя старта (`boot` падает →
 * `_layout` зовёт `clear()` → новая настройка) и после сбоя `createLocalAccount` посередине. «Удалить
 * аккаунт» обязан снять базы и PIN всех. И удаление, упавшее посередине, доводится до конца после
 * перезапуска приложения. Файлы баз — `fakeDevice().files`: `openDb` их создаёт, `deleteLocalDb` —
 * удаляет только основной файл, как `deleteDatabaseAsync`.
 */
import { wipeAccountEverywhere } from '../../services/local/deleteEverywhere';
import { DB_FILE, knownAccountKey, secureKeys } from '../../services/local/device';
import { deleteLocalDb } from '../../services/local/expoSqlite';
import { memoryDb } from '../../services/local/__tests__/nodeSql';
import { sha256 } from '../../services/digest';
import type { SqlDb } from '../../services/local/sql';
import { failOnce, fakeDevice, type FakeDevice } from '../../test/fakeDevice';
import { useAccount } from '../account';
import { setDevice } from '../device';

jest.mock('../../services/local/expoSqlite', () => ({
  openLocalDb: jest.fn(() => Promise.reject(new Error('openLocalDb не должен вызываться в тесте'))),
  deleteLocalDb: jest.fn(),
}));
const mockDeleteLocalDb = deleteLocalDb as jest.Mock;
// мок expo-crypto отдаёт одни и те же байты — у двух аккаунтов был бы один id; здесь — разные
jest.mock('../../services/random', () => {
  let c = 0;
  return { randomBytes: (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + (c += 7)) & 0xff), randomSeed: () => 1 };
});

const PIN = '295173';
const NOW = new Date('2026-10-25T10:00:00.000Z');
const KID = '00000000-0000-4000-8000-0000000000b1';

let device: FakeDevice = fakeDevice();
/** «Файлы» баз: та же база по тому же id, пока файл не удалён. */
let dbs = new Map<string, SqlDb>();

const openDb = async (id: string): Promise<SqlDb> => {
  device.files.add(`talentia-${id}.db`);
  device.files.add(`talentia-${id}.db-wal`);
  let db = dbs.get(id);
  if (!db) {
    db = await memoryDb(undefined, { account: false });
    dbs.set(id, db);
  }
  return db;
};
const brokenDb = async (): Promise<SqlDb> => {
  throw new Error('database disk image is malformed');
};

const reset = () => useAccount.setState({ status: 'loading', accountId: null, db: null, profiles: [], consent: 'not_asked', retentionHold: null });

/** Как `_layout`: сбой старта — `clear()`, ребёнок без записи. */
async function bootLikeLayout(open: (id: string) => Promise<SqlDb>) {
  reset();
  await useAccount
    .getState()
    .boot({ openDb: open, now: NOW, builtAt: null })
    .catch(() => useAccount.getState().clear());
}

/** Настройка до конца: PIN → база → согласие. */
async function setUp(): Promise<string> {
  const id = await useAccount.getState().createWithPin(PIN, sha256, openDb);
  await useAccount.getState().grantConsent('ru', NOW);
  return id;
}

/** «Удалить аккаунт» как на `confirm/delete_account`. */
async function deleteAccount() {
  const { db, accountId } = useAccount.getState();
  if (!db || !accountId) throw new Error('нет аккаунта');
  await wipeAccountEverywhere({ db, device, accountId, deleteDbFile: () => deleteLocalDb(accountId), deliverRevocations: async () => true });
  useAccount.getState().clear();
}

const ourFiles = () => [...device.files].filter((f) => DB_FILE.test(f));
const pinsOf = (...ids: string[]) => ids.flatMap(secureKeys).filter((k) => device.secure.has(k));

beforeEach(() => {
  device = fakeDevice();
  setDevice(device);
  dbs = new Map();
  mockDeleteLocalDb.mockReset();
  mockDeleteLocalDb.mockImplementation(async (id: string) => {
    device.files.delete(`talentia-${id}.db`);
    dbs.delete(id);
  });
  reset();
});

afterEach(() => setDevice(null));

describe('сбой boot → clear() → новая настройка → «Удалить аккаунт»', () => {
  async function scenario({ legacy = false } = {}) {
    const a = await setUp();
    // аккаунт создан до №148: реестра нет
    if (legacy) device.storage.delete(knownAccountKey(a));
    await bootLikeLayout(brokenDb);
    expect(useAccount.getState().status).toBe('none');
    const b = await setUp();
    expect(b).not.toBe(a);
    await deleteAccount();
    return { a, b };
  }

  it('не осталось ни одного файла talentia-*.db*', async () => {
    await scenario();
    expect(ourFiles()).toEqual([]);
  });

  it('не осталось PIN и таймаута ни старого, ни нового id', async () => {
    const { a, b } = await scenario();
    expect(pinsOf(a, b)).toEqual([]);
  });

  it('SecureStore и AsyncStorage пусты', async () => {
    await scenario();
    expect([[...device.secure.keys()], [...device.storage.keys()]]).toEqual([[], []]);
  });

  it('старый аккаунт без реестра (до №148): найден по файлу базы, PIN снят', async () => {
    const { a } = await scenario({ legacy: true });
    expect([ourFiles(), pinsOf(a)]).toEqual([[], []]);
  });
});

describe('сбой createLocalAccount посередине', () => {
  it.each([
    ['запись PIN (реестр уже есть)', 'setSecure', 1],
    ['запись таймаута (PIN уже есть)', 'setSecure', 2],
    ['запись current (PIN и таймаут уже есть)', 'setItem', 2],
  ] as const)('сбой: %s → повтор настройки → удаление: PIN брошенного id снят', async (_, method, nth) => {
    failOnce(device, method, nth);
    await expect(useAccount.getState().createWithPin(PIN, sha256, openDb)).rejects.toThrow(/внедрённый сбой/);
    const orphan = [...device.storage.keys()].find((k) => k.startsWith('talentia:accounts:known:'))!.slice('talentia:accounts:known:'.length);
    const b = await setUp();
    await deleteAccount();
    expect([pinsOf(orphan, b), [...device.storage.keys()]]).toEqual([[], []]);
  });

  it('сбой на первой записи реестра: на устройстве не остаётся ничего', async () => {
    failOnce(device, 'setItem', 1);
    await expect(useAccount.getState().createWithPin(PIN, sha256, openDb)).rejects.toThrow(/внедрённый сбой/);
    expect([device.storage.size, device.secure.size]).toEqual([0, 0]);
  });
});

describe('удаление упало посередине → перезапуск приложения → в итоге пусто', () => {
  /** Аккаунт с согласием, данными ребёнка вне базы, брошенным аккаунтом рядом. */
  async function populated() {
    const a = await setUp();
    device.storage.set(`talentia:child:${KID}:settings`, '{}');
    device.storage.set('talentia:telemetry:q', '[]');
    device.cache.add(`voice/child/${KID}/hello.mp3`);
    device.cache.add('export/kid.json');
    device.notifications.add(KID);
    // брошенный рядом
    const orphan = '0a1b2c3d-0000-4000-8000-0000000000ff';
    device.storage.set(knownAccountKey(orphan), '1');
    for (const k of secureKeys(orphan)) device.secure.set(k, '{}');
    device.files.add(`talentia-${orphan}.db`);
    return a;
  }

  /** Перезапуск: `boot` как в `_layout`; аккаунт поднялся — родитель снова жмёт «Удалить аккаунт». */
  async function restartAndFinish() {
    await bootLikeLayout(openDb);
    if (useAccount.getState().status === 'ready') await deleteAccount();
  }

  const expectEmpty = () =>
    expect({
      files: ourFiles(),
      secure: [...device.secure.keys()],
      storage: [...device.storage.keys()],
      cache: [...device.cache],
      notifications: [...device.notifications],
    }).toEqual({ files: [], secure: [], storage: [], cache: [], notifications: [] });

  // current и реестр ещё на месте: перезапуск находит аккаунт и доводит удаление
  it.each([
    ['keys() — сбор id', 'keys', 1],
    ['getItem(current)', 'getItem', 1],
    ['listDbFiles — сбор id', 'listDbFiles', 1],
    ['listDbFiles — перед удалением файлов', 'listDbFiles', 2],
    ['deleteDbFiles', 'deleteDbFiles', 1],
    ['removeSecure — первый id', 'removeSecure', 1],
    ['removeSecure — второй id', 'removeSecure', 2],
    ['removeKeys — AsyncStorage', 'removeKeys', 1],
  ] as const)('сбой: %s', async (_, method, nth) => {
    await populated();
    failOnce(device, method, nth);
    await expect(deleteAccount()).rejects.toThrow(/внедрённый сбой/);
    await restartAndFinish();
    expectEmpty();
  });

  it('сбой deleteLocalDb: перезапуск доводит удаление', async () => {
    await populated();
    mockDeleteLocalDb.mockRejectedValueOnce(new Error('внедрённый сбой deleteDatabaseAsync'));
    await expect(deleteAccount()).rejects.toThrow(/внедрённый сбой/);
    await restartAndFinish();
    expectEmpty();
  });

  /**
   * Регрессия (№148, исправлено: id и метка снимаются последними, boot доводит удаление): `talentia:account:current` и реестр снимаются (`removeKeys` AsyncStorage) раньше телеметрии,
   * проверки файлов, кеша озвучки, экспорта и уведомлений. Сбой на любом из этих шагов — и после
   * перезапуска `boot` не видит аккаунта (status none), а повтор в той же сессии упирается в закрытую
   * базу. Остатки (очередь телеметрии, озвучка с именем ребёнка, файл экспорта, уведомления, файл базы,
   * который не удалился) больше никто не удаляет. deleteEverywhere.ts:146–163.
   */
  it.each([
    ['removeKeys — телеметрия', 'removeKeys', 2],
    ['listDbFiles — проверка после удаления', 'listDbFiles', 3],
    ['deleteCacheDir — озвучка', 'deleteCacheDir', 1],
    ['deleteCacheDir — экспорт', 'deleteCacheDir', 2],
    ['cancelAllNotifications', 'cancelAllNotifications', 1],
  ] as const)('сбой: %s', async (_, method, nth) => {
    await populated();
    failOnce(device, method, nth);
    await expect(deleteAccount()).rejects.toThrow(/внедрённый сбой/);
    await restartAndFinish();
    expectEmpty();
  });

  it('файл базы не удалился (wipe бросил «Файлы баз остались»): перезапуск доводит удаление', async () => {
    await populated();
    const real = device.deleteDbFiles;
    device.deleteDbFiles = async (ns) => real(ns.filter((n) => !n.endsWith('-wal')));
    await expect(deleteAccount()).rejects.toThrow(/Файлы баз остались/);
    device.deleteDbFiles = real;
    await restartAndFinish();
    expect(ourFiles()).toEqual([]);
  });
});
