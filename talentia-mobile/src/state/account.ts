/**
 * Аккаунт взрослого на устройстве (этап 10): загрузка на старте, первая настройка, профили детей.
 * Порядок первой настройки — «согласие раньше записи» (`services/local/account.ts`).
 */
import { create } from 'zustand';

import { uuidV4 } from '../domain/ids';
import type { ConsentStatus } from '../domain/consent';
import type { Digest } from '../domain/parentGate';
import type { InterfaceLang } from '../domain/regionVisibility';
import { accountConsentStatus, clearAfterReinstall, createLocalAccount, currentAccountId, grantAccountLocal } from '../services/local/account';
import { finishDeviceWipe, wipeAccountEverywhere } from '../services/local/deleteEverywhere';
import { WIPE_PENDING_KEY } from '../services/local/device';
import { deleteLocalDb, openLocalDb } from '../services/local/expoSqlite';
import { listProfiles, saveProfile, type ChildProfile } from '../services/local/profiles';
import { buildTime } from '../services/local/buildInfo';
import { runRetention, type RetentionOutcome } from '../services/local/purge';
import type { SqlDb } from '../services/local/sql';
import { noRecordPort, sqlitePort } from '../services/progressPort';
import { randomBytes } from '../services/random';
import { device } from './device';
import { setProgressPort } from './port';

export type AccountStatus = 'loading' | 'none' | 'ready';

export type AccountState = {
  status: AccountStatus;
  accountId: string | null;
  db: SqlDb | null;
  profiles: ChildProfile[];
  consent: ConsentStatus;
  /**
   * Срок хранения удержан скачком часов (№147): вход не блокируется, раздел родителя показывает
   * лист подтверждения. `null` — удержания нет.
   */
  retentionHold: Extract<RetentionOutcome, { kind: 'held' }> | null;
  /** Прочитать аккаунт с устройства, открыть базу, применить срок хранения, подключить порт прогресса. */
  boot(opts?: { openDb?: (id: string) => Promise<SqlDb>; now?: Date; builtAt?: string | null }): Promise<void>;
  /** Удержание снято подтверждением взрослого. */
  clearRetentionHold(): void;
  /** Шаги первой настройки: PIN принят → аккаунт и база; согласие → событие; отказ → всё стёрто. */
  createWithPin(pin: string, digest: Digest, openDb?: (id: string) => Promise<SqlDb>): Promise<string>;
  grantConsent(lang: InterfaceLang, now?: Date): Promise<void>;
  abandonSetup(): Promise<void>;
  addProfile(p: Omit<ChildProfile, 'childId' | 'createdAt'> & Partial<Pick<ChildProfile, 'childId' | 'createdAt'>>): Promise<ChildProfile>;
  updateProfile(p: ChildProfile): Promise<void>;
  refreshProfiles(): Promise<void>;
  /** После удаления аккаунта экраном «Данные». */
  clear(): void;
};

export const useAccount = create<AccountState>((set, get) => ({
  status: 'loading',
  accountId: null,
  db: null,
  profiles: [],
  consent: 'not_asked',
  retentionHold: null,

  async boot({ openDb = openLocalDb, now = new Date(), builtAt = buildTime() } = {}) {
    const d = device();
    await clearAfterReinstall(d);
    // удаление аккаунта прервано (сбой, закрытое приложение) — довести до конца, аккаунта больше нет (№148)
    if ((await d.getItem(WIPE_PENDING_KEY)) !== null) {
      await finishDeviceWipe(d, null);
      setProgressPort(noRecordPort);
      set({ status: 'none', accountId: null, db: null, profiles: [], consent: 'not_asked', retentionHold: null });
      return;
    }
    const id = await currentAccountId(d);
    if (!id) {
      setProgressPort(noRecordPort);
      set({ status: 'none', accountId: null, db: null, profiles: [], consent: 'not_asked' });
      return;
    }
    const db = await openDb(id);
    // Прерванная настройка (PIN принят, согласие не дано): по тексту согласия на устройстве ничего не
    // остаётся — стираем аккаунт сами, иначе устройство застряло бы без входа для ребёнка и без удаления.
    if ((await accountConsentStatus(db)) === 'not_asked') {
      await wipeAccountEverywhere({ db, device: d, accountId: id, deleteDbFile: () => deleteLocalDb(id), deliverRevocations: async () => true });
      setProgressPort(noRecordPort);
      set({ status: 'none', accountId: null, db: null, profiles: [], consent: 'not_asked' });
      return;
    }
    // Срок хранения — по часам устройства с нижней границей сборки (№131), скачок вперёд ждёт взрослого (№147).
    const retention = await runRetention(db, { deviceNow: now, builtAt });
    setProgressPort(sqlitePort(db));
    set({
      status: 'ready',
      accountId: id,
      db,
      profiles: await listProfiles(d, id),
      consent: await accountConsentStatus(db),
      retentionHold: retention.kind === 'held' ? retention : null,
    });
  },

  clearRetentionHold() {
    set({ retentionHold: null });
  },

  async createWithPin(pin, digest, openDb = openLocalDb) {
    const d = device();
    const id = await createLocalAccount(d, pin, { randomBytes, digest });
    const db = await openDb(id);
    setProgressPort(sqlitePort(db));
    set({ status: 'ready', accountId: id, db, profiles: [], consent: 'not_asked' });
    return id;
  },

  async grantConsent(lang, now = new Date()) {
    const { db, accountId } = get();
    if (!db || !accountId) throw new Error('Согласие без аккаунта');
    await grantAccountLocal(db, { accountId, lang, at: now.toISOString(), randomBytes });
    set({ consent: await accountConsentStatus(db) });
  },

  async abandonSetup() {
    const { db, accountId } = get();
    if (db && accountId) {
      await wipeAccountEverywhere({ db, device: device(), accountId, deleteDbFile: () => deleteLocalDb(accountId), deliverRevocations: async () => true });
    }
    setProgressPort(noRecordPort);
    set({ status: 'none', accountId: null, db: null, profiles: [], consent: 'not_asked' });
  },

  async addProfile(p) {
    const { db, accountId } = get();
    if (!db || !accountId) throw new Error('Профиль без аккаунта');
    const profile: ChildProfile = { ...p, childId: p.childId ?? uuidV4(randomBytes), createdAt: p.createdAt ?? new Date().toISOString() };
    await saveProfile(device(), db, accountId, profile);
    set({ profiles: await listProfiles(device(), accountId) });
    return profile;
  },

  async updateProfile(p) {
    const { db, accountId } = get();
    if (!db || !accountId) throw new Error('Профиль без аккаунта');
    await saveProfile(device(), db, accountId, p);
    set({ profiles: await listProfiles(device(), accountId) });
  },

  async refreshProfiles() {
    const { accountId } = get();
    if (!accountId) return;
    set({ profiles: await listProfiles(device(), accountId) });
  },

  clear() {
    setProgressPort(noRecordPort);
    set({ status: 'none', accountId: null, db: null, profiles: [], consent: 'not_asked', retentionHold: null });
  },
}));
