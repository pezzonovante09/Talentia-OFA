/**
 * Локальный аккаунт, PIN и профили детей (этап 10; проверка приватности 2026-10-25, блокеры 1–2):
 * до согласия `account_local` на устройстве — только id аккаунта, PIN и таймаут; профиль ребёнка
 * без согласия не пишется; отказ стирает всё; lockout переживает перезапуск; экспорт профиля —
 * allow-list; удаление ребёнка убирает его из списка аккаунта.
 */
import { createHash } from 'node:crypto';

import { fakeDevice } from '../../../test/fakeDevice';
import { CONFIRMATION, canPerform, deleteAccountConfirmation, openSession, type Digest } from '../../../domain/parentGate';
import { accountConsentStatus, checkPin, createLocalAccount, currentAccountId, grantAccountLocal, hasPin, readLockout } from '../account';
import { deleteChildEverywhere, wipeAccountEverywhere } from '../deleteEverywhere';
import { childKeyPrefix, knownAccountKey, secureKeys } from '../device';
import { childrenKey, exportProfile, listChildIds, listProfiles, newProfile, ProfileConsentRequiredError, saveProfile } from '../profiles';
import { memoryDb } from './nodeSql';

const digest: Digest = async (s) => createHash('sha256').update(s).digest('hex');
let counter = 0;
const randomBytes = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + ++counter) & 0xff);
const NOW = Date.parse('2026-10-25T10:00:00.000Z');
const AT = '2026-10-25T10:00:00.000Z';

describe('локальный аккаунт', () => {
  it('создание: id в AsyncStorage и в реестре аккаунтов (№148), хеш PIN и пустой таймаут в SecureStore, больше ничего', async () => {
    const device = fakeDevice();
    const id = await createLocalAccount(device, '295173', { randomBytes, digest });
    expect(await currentAccountId(device)).toBe(id);
    // реестр — тот же id аккаунта, ничего о ребёнке: до согласия на устройстве по-прежнему только id, PIN и таймаут
    expect([...device.storage.keys()].sort()).toEqual([knownAccountKey(id), 'talentia:account:current'].sort());
    expect(device.storage.get(knownAccountKey(id))).toBe('1');
    expect([...device.secure.keys()].sort()).toEqual([...secureKeys(id)].sort());
    expect(device.secure.get(secureKeys(id)[0])).not.toContain('295173');
    expect(await hasPin(device, id)).toBe(true);
  });

  it('слабый PIN отклоняется до любой записи', async () => {
    const device = fakeDevice();
    await expect(createLocalAccount(device, '111111', { randomBytes, digest })).rejects.toThrow('repeated');
    expect(device.storage.size + device.secure.size).toBe(0);
  });

  it('проверка PIN: верный — ok и сброс, пять неверных — блокировка, которая хранится в SecureStore', async () => {
    const device = fakeDevice();
    const id = await createLocalAccount(device, '295173', { randomBytes, digest });
    expect(await checkPin(device, id, '295173', { digest, now: NOW })).toEqual({ result: 'ok' });
    let last: Awaited<ReturnType<typeof checkPin>> | null = null;
    for (let i = 0; i < 5; i++) last = await checkPin(device, id, '000000', { digest, now: NOW + i });
    expect(last?.result).toBe('locked');
    const stored = await readLockout(device, id);
    expect(stored.lockedUntil).toBeGreaterThan(NOW);
    expect(await checkPin(device, id, '295173', { digest, now: NOW + 10 })).toMatchObject({ result: 'locked' });
    expect(await checkPin(device, id, '295173', { digest, now: stored.lockedUntil! + 1 })).toEqual({ result: 'ok' });
  });
});

describe('согласие раньше записи', () => {
  it('профиль без account_local не пишется: ни одного ключа ребёнка', async () => {
    const device = fakeDevice();
    const db = await memoryDb(undefined, { account: false });
    const id = await createLocalAccount(device, '295173', { randomBytes, digest });
    expect(await accountConsentStatus(db)).toBe('not_asked');
    const profile = newProfile({ childId: 'kid-1', band: '5-6', interfaceLang: 'ru', createdAt: AT, name: 'Айгерим' });
    await expect(saveProfile(device, db, id, profile)).rejects.toBeInstanceOf(ProfileConsentRequiredError);
    expect([...device.storage.keys()].filter((k) => k.startsWith(childKeyPrefix('kid-1')))).toEqual([]);
    expect(await listChildIds(device, id)).toEqual([]);
  });

  it('после согласия (подтверждено PIN) профиль и список пишутся; status granted', async () => {
    const device = fakeDevice();
    const db = await memoryDb(undefined, { account: false });
    const id = await createLocalAccount(device, '295173', { randomBytes, digest });
    await grantAccountLocal(db, { accountId: id, lang: 'ru', at: AT, randomBytes });
    expect(await accountConsentStatus(db)).toBe('granted');
    const rows = await db.all<{ confirmed_by: string; text_version: string }>('SELECT confirmed_by, text_version FROM consent_events');
    expect(rows).toEqual([{ confirmed_by: 'pin', text_version: 'ru-draft-1' }]);
    await saveProfile(device, db, id, newProfile({ childId: 'kid-1', band: '5-6', interfaceLang: 'ru', createdAt: AT }));
    await saveProfile(device, db, id, newProfile({ childId: 'kid-2', band: '7', interfaceLang: 'ky', createdAt: AT, name: 'Бек' }));
    expect(await listChildIds(device, id)).toEqual(['kid-1', 'kid-2']);
    expect((await listProfiles(device, id)).map((p) => p.name)).toEqual(['', 'Бек']);
  });

  it('отказ после PIN: wipeAccountEverywhere не оставляет ни ключей, ни PIN', async () => {
    const device = fakeDevice();
    const db = await memoryDb(undefined, { account: false });
    const id = await createLocalAccount(device, '295173', { randomBytes, digest });
    let fileDeleted = false;
    await wipeAccountEverywhere({ db, device, accountId: id, deleteDbFile: async () => void (fileDeleted = true), deliverRevocations: async () => true });
    expect(fileDeleted).toBe(true);
    expect(device.storage.size).toBe(0);
    expect(device.secure.size).toBe(0);
  });
});

describe('удаление и экспорт профиля', () => {
  it('удаление ребёнка убирает его ключи и строку из списка аккаунта', async () => {
    const device = fakeDevice();
    const db = await memoryDb();
    const id = 'acc-1';
    await saveProfile(device, db, id, newProfile({ childId: 'kid-1', band: '5-6', interfaceLang: 'ru', createdAt: AT }));
    await saveProfile(device, db, id, newProfile({ childId: 'kid-2', band: '5-6', interfaceLang: 'ru', createdAt: AT }));
    await deleteChildEverywhere({ db, device, childId: 'kid-1', pseudonym: '11111111-1111-4111-8111-111111111111', deliverRevocation: async () => true, accountId: id });
    expect(await listChildIds(device, id)).toEqual(['kid-2']);
    expect([...device.storage.keys()].some((k) => k.includes('kid-1'))).toBe(false);
    expect(device.storage.get(childrenKey(id))).not.toContain('kid-1');
  });

  it('экспорт профиля — allow-list: формы обращения и вибрации в нём нет', () => {
    const out = exportProfile(newProfile({ childId: 'kid-1', band: '5-6', interfaceLang: 'ru', createdAt: AT, addressForm: 'feminine', hapticsEnabled: true }));
    expect(Object.keys(out).sort()).toEqual(['band', 'childId', 'createdAt', 'interfaceLang', 'kyrgyzRegion', 'name', 'sessionMinutes']);
    expect(JSON.stringify(out)).not.toMatch(/addressForm|haptics|calm|focus/);
  });
});

describe('подтверждение удаления аккаунта без облака', () => {
  it('gate_now: открытое окно свежести удаление не разрешает; с облаком — код из письма', () => {
    expect(CONFIRMATION.delete_account).toBe('gate_now');
    const s = openSession(NOW);
    expect(canPerform('delete_account', s, NOW + 1000)).toBe(false);
    expect(canPerform('clear_progress', s, NOW + 1000)).toBe(true);
    expect(deleteAccountConfirmation(false)).toBe('gate_now');
    expect(deleteAccountConfirmation(true)).toBe('email_otp');
  });
});
