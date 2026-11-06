/**
 * Стор аккаунта взрослого (этап 10): загрузка на старте без аккаунта и с ним, первая настройка
 * «согласие раньше записи» (PIN → аккаунт и база → согласие → профиль), отказ стирает всё.
 * База — in-memory SQLite через `openDb`, устройство — `fakeDevice()`; файл базы на устройстве
 * мокается (`expo-sqlite` в Jest — `{}`).
 */
import { fakeDevice } from '../../test/fakeDevice';
import { CURRENT_ACCOUNT_KEY, currentAccountId } from '../../services/local/account';
import { secureKeys } from '../../services/local/device';
import { memoryDb, writeLessonRun } from '../../services/local/__tests__/nodeSql';
import { sha256 } from '../../services/digest';
import { noRecordPort } from '../../services/progressPort';
import type { SqlDb } from '../../services/local/sql';
import { useAccount } from '../account';
import { setDevice } from '../device';
import { progressPort, setProgressPort } from '../port';

jest.mock('../../services/local/expoSqlite', () => ({
  openLocalDb: jest.fn(() => Promise.reject(new Error('openLocalDb не должен вызываться в тесте'))),
  deleteLocalDb: jest.fn(() => Promise.resolve()),
}));
const { deleteLocalDb: mockDeleteLocalDb } = jest.requireMock('../../services/local/expoSqlite') as { deleteLocalDb: jest.Mock };

const PIN = '295173';
const NOW = new Date('2026-10-25T10:00:00.000Z');
const KID = '00000000-0000-4000-8000-0000000000a1';

let device = fakeDevice();
let dbs: SqlDb[] = [];
/** База «с аккаунтом» для boot: согласие уже в журнале. */
const openWithConsent = async () => {
  const db = await memoryDb();
  dbs.push(db);
  return db;
};
/** Пустая база для первой настройки: согласия ещё нет. */
const openEmpty = async () => {
  const db = await memoryDb(undefined, { account: false });
  dbs.push(db);
  return db;
};

const reset = () => useAccount.setState({ status: 'loading', accountId: null, db: null, profiles: [], consent: 'not_asked' });

beforeEach(() => {
  device = fakeDevice();
  setDevice(device);
  dbs = [];
  mockDeleteLocalDb.mockClear();
  setProgressPort(noRecordPort);
  reset();
});

afterEach(() => setDevice(null));

describe('boot', () => {
  it('без аккаунта на устройстве: status none и порт без записи', async () => {
    const openDb = jest.fn(openWithConsent);
    await useAccount.getState().boot({ openDb, now: NOW });
    const s = useAccount.getState();
    expect(s.status).toBe('none');
    expect(s.accountId).toBeNull();
    expect(s.db).toBeNull();
    expect(s.profiles).toEqual([]);
    expect(progressPort()).toBe(noRecordPort);
    expect(openDb).not.toHaveBeenCalled();
  });

  it('с аккаунтом: открывает базу, читает профили и согласие, ставит порт на базу', async () => {
    // Arrange: аккаунт с согласием и одним профилем, созданный «в прошлой сессии».
    await useAccount.getState().createWithPin(PIN, sha256, openEmpty);
    await useAccount.getState().grantConsent('ru', NOW);
    const created = await useAccount.getState().addProfile({ childId: KID, name: 'Айгерим', band: '5-6', interfaceLang: 'ru', kyrgyzRegion: false, addressForm: 'neutral', hapticsEnabled: false, sessionMinutes: 10, calmMode: false, focusMode: false, soundEffects: true });
    const { accountId, db: setupDb } = useAccount.getState();
    reset();
    setProgressPort(noRecordPort);

    // Act: перезапуск — та же база по тому же id.
    const openDb = jest.fn(async (id: string) => {
      expect(id).toBe(accountId);
      return setupDb as SqlDb;
    });
    await useAccount.getState().boot({ openDb, now: NOW });

    // Assert
    const s = useAccount.getState();
    expect(s.status).toBe('ready');
    expect(s.accountId).toBe(accountId);
    expect(s.db).toBe(setupDb);
    expect(s.consent).toBe('granted');
    expect(s.profiles).toEqual([created]);
    expect(progressPort()).not.toBe(noRecordPort);
    const snap = await progressPort().load(KID);
    expect(snap.lessonCounter).toBe(0);
  });

  it('прерванная настройка (PIN есть, согласия нет): boot стирает аккаунт — status none, устройство пусто', async () => {
    const id = await useAccount.getState().createWithPin(PIN, sha256, openEmpty);
    const db = useAccount.getState().db as SqlDb;
    reset();
    setProgressPort(noRecordPort);

    await useAccount.getState().boot({ openDb: async () => db, now: NOW });

    const s = useAccount.getState();
    expect(s.status).toBe('none');
    expect(s.accountId).toBeNull();
    expect(s.db).toBeNull();
    expect(device.storage.size).toBe(0);
    expect(device.secure.size).toBe(0);
    expect(mockDeleteLocalDb).toHaveBeenCalledWith(id);
    expect(progressPort()).toBe(noRecordPort);
  });

  it('с аккаунтом применяет срок хранения: прохождение старше 12 месяцев удаляется на старте', async () => {
    await device.setItem(CURRENT_ACCOUNT_KEY, 'acc-boot');
    const db = await openWithConsent();
    await writeLessonRun(db, { id: 'old', childId: KID, lessonId: 'l', startedAt: '2025-01-01T00:00:00.000Z', taskSeconds: [10], reviewTasks: 0 });
    await writeLessonRun(db, { id: 'fresh', childId: KID, lessonId: 'l', startedAt: '2026-10-01T00:00:00.000Z', taskSeconds: [10], reviewTasks: 0 });

    await useAccount.getState().boot({ openDb: async () => db, now: NOW });

    const rows = await db.all<{ id: string }>('SELECT id FROM lesson_runs ORDER BY seq');
    expect(rows.map((r) => r.id)).toEqual(['fresh']);
    expect(useAccount.getState().status).toBe('ready');
  });
});

describe('первая настройка', () => {
  it('слабый PIN: отказ без единой записи на устройстве, стор остаётся без аккаунта', async () => {
    const openDb = jest.fn(openEmpty);
    await expect(useAccount.getState().createWithPin('123456', sha256, openDb)).rejects.toThrow('sequence');
    expect(device.storage.size + device.secure.size).toBe(0);
    expect(openDb).not.toHaveBeenCalled();
    expect(useAccount.getState().accountId).toBeNull();
    expect(progressPort()).toBe(noRecordPort);
  });

  it('createWithPin: id в AsyncStorage, хеш PIN в SecureStore, status ready без согласия', async () => {
    const id = await useAccount.getState().createWithPin(PIN, sha256, openEmpty);
    expect(await currentAccountId(device)).toBe(id);
    expect(device.secure.get(secureKeys(id)[0])).not.toContain(PIN);
    const s = useAccount.getState();
    expect(s.status).toBe('ready');
    expect(s.accountId).toBe(id);
    expect(s.db).not.toBeNull();
    expect(s.consent).toBe('not_asked');
    expect(s.profiles).toEqual([]);
    expect(progressPort()).not.toBe(noRecordPort);
  });

  it('профиль до согласия не пишется: addProfile отклоняется, ключей ребёнка нет', async () => {
    await useAccount.getState().createWithPin(PIN, sha256, openEmpty);
    await expect(useAccount.getState().addProfile({ childId: KID, name: '', band: '5-6', interfaceLang: 'ru', kyrgyzRegion: false, addressForm: 'neutral', hapticsEnabled: false, sessionMinutes: 10, calmMode: false, focusMode: false, soundEffects: true })).rejects.toThrow(/согласия/);
    expect([...device.storage.keys()].some((k) => k.includes(KID))).toBe(false);
    expect(useAccount.getState().profiles).toEqual([]);
  });

  it('grantConsent → granted; addProfile пишет профиль, подставляет id и дату, обновляет список', async () => {
    await useAccount.getState().createWithPin(PIN, sha256, openEmpty);
    await useAccount.getState().grantConsent('ky', NOW);
    expect(useAccount.getState().consent).toBe('granted');
    const db = useAccount.getState().db as SqlDb;
    const rows = await db.all<{ confirmed_by: string; text_version: string }>('SELECT confirmed_by, text_version FROM consent_events');
    expect(rows).toEqual([{ confirmed_by: 'pin', text_version: expect.stringMatching(/^ky-/) }]);

    const p = await useAccount.getState().addProfile({ name: '', band: '7', interfaceLang: 'ky', kyrgyzRegion: true, addressForm: 'neutral', hapticsEnabled: false, sessionMinutes: 10, calmMode: false, focusMode: false, soundEffects: true });
    expect(p.childId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(p.createdAt)).not.toBeNaN();
    expect(useAccount.getState().profiles).toEqual([p]);
  });

  it('grantConsent и addProfile без аккаунта бросают', async () => {
    await expect(useAccount.getState().grantConsent('ru', NOW)).rejects.toThrow('Согласие без аккаунта');
    await expect(useAccount.getState().addProfile({ name: '', band: '7', interfaceLang: 'ru', kyrgyzRegion: false, addressForm: 'neutral', hapticsEnabled: false, sessionMinutes: 10, calmMode: false, focusMode: false, soundEffects: true })).rejects.toThrow('Профиль без аккаунта');
  });

  it('abandonSetup после PIN: ни ключей, ни PIN, файл базы удалён, порт без записи', async () => {
    const id = await useAccount.getState().createWithPin(PIN, sha256, openEmpty);
    expect(device.storage.size + device.secure.size).toBeGreaterThan(0);

    await useAccount.getState().abandonSetup();

    expect(device.storage.size).toBe(0);
    expect(device.secure.size).toBe(0);
    expect(mockDeleteLocalDb).toHaveBeenCalledWith(id);
    const s = useAccount.getState();
    expect(s.status).toBe('none');
    expect(s.accountId).toBeNull();
    expect(s.db).toBeNull();
    expect(progressPort()).toBe(noRecordPort);
  });

  it('abandonSetup после согласия и профиля: профиль ребёнка тоже стёрт', async () => {
    await useAccount.getState().createWithPin(PIN, sha256, openEmpty);
    await useAccount.getState().grantConsent('ru', NOW);
    await useAccount.getState().addProfile({ childId: KID, name: 'Бек', band: '8', interfaceLang: 'ru', kyrgyzRegion: false, addressForm: 'neutral', hapticsEnabled: false, sessionMinutes: 10, calmMode: false, focusMode: false, soundEffects: true });
    expect([...device.storage.keys()].some((k) => k.includes(KID))).toBe(true);

    await useAccount.getState().abandonSetup();

    expect(device.storage.size).toBe(0);
    expect(device.secure.size).toBe(0);
    expect(useAccount.getState().profiles).toEqual([]);
  });

  it('abandonSetup без аккаунта: ничего не удаляет, состояние — none', async () => {
    await useAccount.getState().abandonSetup();
    expect(mockDeleteLocalDb).not.toHaveBeenCalled();
    expect(useAccount.getState().status).toBe('none');
    expect(progressPort()).toBe(noRecordPort);
  });
});

describe('профили и очистка', () => {
  it('updateProfile перезаписывает профиль без дубля в списке', async () => {
    await useAccount.getState().createWithPin(PIN, sha256, openEmpty);
    await useAccount.getState().grantConsent('ru', NOW);
    const p = await useAccount.getState().addProfile({ childId: KID, name: '', band: '5-6', interfaceLang: 'ru', kyrgyzRegion: false, addressForm: 'neutral', hapticsEnabled: false, sessionMinutes: 10, calmMode: false, focusMode: false, soundEffects: true });
    await useAccount.getState().updateProfile({ ...p, band: '7', name: 'Нур' });
    const profiles = useAccount.getState().profiles;
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ childId: KID, band: '7', name: 'Нур' });
  });

  it('refreshProfiles перечитывает список с устройства; без аккаунта — ничего не делает', async () => {
    await useAccount.getState().refreshProfiles();
    expect(useAccount.getState().profiles).toEqual([]);

    await useAccount.getState().createWithPin(PIN, sha256, openEmpty);
    await useAccount.getState().grantConsent('ru', NOW);
    const p = await useAccount.getState().addProfile({ childId: KID, name: '', band: '5-6', interfaceLang: 'ru', kyrgyzRegion: false, addressForm: 'neutral', hapticsEnabled: false, sessionMinutes: 10, calmMode: false, focusMode: false, soundEffects: true });
    useAccount.setState({ profiles: [] });
    await useAccount.getState().refreshProfiles();
    expect(useAccount.getState().profiles).toEqual([p]);
  });

  it('clear: стор пуст, порт без записи; данные на устройстве не трогаются (удаляет экран «Данные»)', async () => {
    await useAccount.getState().createWithPin(PIN, sha256, openEmpty);
    const before = device.storage.size + device.secure.size;

    useAccount.getState().clear();

    const s = useAccount.getState();
    expect(s).toMatchObject({ status: 'none', accountId: null, db: null, profiles: [], consent: 'not_asked' });
    expect(progressPort()).toBe(noRecordPort);
    expect(device.storage.size + device.secure.size).toBe(before);
    expect(mockDeleteLocalDb).not.toHaveBeenCalled();
  });
});

describe('boot и скачок часов (№147)', () => {
  const FIVE_YEARS = new Date('2031-10-25T10:00:00.000Z');
  async function bootedOnce() {
    await device.setItem(CURRENT_ACCOUNT_KEY, 'acc-clock');
    const db = await openWithConsent();
    await writeLessonRun(db, { id: 'old', childId: KID, lessonId: 'l', startedAt: '2025-01-01T00:00:00.000Z', taskSeconds: [10], reviewTasks: 0 });
    await writeLessonRun(db, { id: 'fresh', childId: KID, lessonId: 'l', startedAt: '2026-10-01T00:00:00.000Z', taskSeconds: [10], reviewTasks: 0 });
    // обычный старт сегодня: last_seen = NOW, старое удалено
    await useAccount.getState().boot({ openDb: async () => db, now: NOW, builtAt: null });
    reset();
    return db;
  }
  const ids = async (db: SqlDb) => (await db.all<{ id: string }>('SELECT id FROM lesson_runs ORDER BY seq')).map((r) => r.id);

  beforeEach(() => useAccount.setState({ retentionHold: null }));

  it('часы +5 лет: status ready — вход ребёнка не блокируется', async () => {
    const db = await bootedOnce();
    await useAccount.getState().boot({ openDb: async () => db, now: FIVE_YEARS, builtAt: null });
    expect(useAccount.getState().status).toBe('ready');
  });

  it('часы +5 лет: журналы целы', async () => {
    const db = await bootedOnce();
    await useAccount.getState().boot({ openDb: async () => db, now: FIVE_YEARS, builtAt: null });
    expect(await ids(db)).toEqual(['fresh']);
  });

  it('часы +5 лет: retentionHold с датой устройства, прошлой датой и числом к удалению', async () => {
    const db = await bootedOnce();
    await useAccount.getState().boot({ openDb: async () => db, now: FIVE_YEARS, builtAt: null });
    expect(useAccount.getState().retentionHold).toEqual({
      kind: 'held',
      reason: 'clock_jump',
      deviceNow: FIVE_YEARS.toISOString(),
      lastSeen: NOW.toISOString(),
      wouldRemove: 1,
      abaGoalsChildren: 0,
    });
  });

  it('обычный старт после удержания снимает retentionHold', async () => {
    const db = await bootedOnce();
    await useAccount.getState().boot({ openDb: async () => db, now: FIVE_YEARS, builtAt: null });
    reset();
    await useAccount.getState().boot({ openDb: async () => db, now: new Date(NOW.getTime() + 86_400_000), builtAt: null });
    expect(useAccount.getState().retentionHold).toBeNull();
  });

  it('clearRetentionHold снимает удержание, остальное состояние не трогает', async () => {
    const db = await bootedOnce();
    await useAccount.getState().boot({ openDb: async () => db, now: FIVE_YEARS, builtAt: null });
    useAccount.getState().clearRetentionHold();
    expect(useAccount.getState()).toMatchObject({ retentionHold: null, status: 'ready', accountId: 'acc-clock', db });
  });

  it('clear() сбрасывает и retentionHold', async () => {
    const db = await bootedOnce();
    await useAccount.getState().boot({ openDb: async () => db, now: FIVE_YEARS, builtAt: null });
    useAccount.getState().clear();
    expect(useAccount.getState().retentionHold).toBeNull();
  });
});
