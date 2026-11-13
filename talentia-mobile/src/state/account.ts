/**
 * Аккаунт взрослого на устройстве (этап 10): загрузка на старте, первая настройка, профили детей.
 * Порядок первой настройки — «согласие раньше записи» (`services/local/account.ts`).
 */
import { Platform } from 'react-native';
import { create } from 'zustand';

import { uuidV4 } from '../domain/ids';
import type { ConsentStatus } from '../domain/consent';
import type { Digest } from '../domain/parentGate';
import type { InterfaceLang } from '../domain/regionVisibility';
import { accountConsentStatus, clearAfterReinstall, createLocalAccount, CURRENT_ACCOUNT_KEY, currentAccountId, grantAccountLocal, recoverableAccountId } from '../services/local/account';
import { finishDeviceWipe, wipeOwnAccount } from '../services/local/deleteEverywhere';
import { DB_FILE, EXPORT_DIR, WIPE_PENDING_KEY } from '../services/local/device';
import { deleteLocalDb, openLocalDb } from '../services/local/expoSqlite';
import { listChildIds, listProfiles, saveProfile, type ChildProfile } from '../services/local/profiles';
import { buildTime } from '../services/local/buildInfo';
import { runRetention, type RetentionOutcome } from '../services/local/purge';
import type { SqlDb } from '../services/local/sql';
import { noRecordPort, sqlitePort } from '../services/progressPort';
import { randomBytes } from '../services/random';
import { device } from './device';
import { setProgressPort } from './port';

/**
 * `error` — аккаунт на устройстве есть, а открыть его не вышло (битая база, база новее приложения, сбой
 * хранилища). Контрольный аудит 2026-11-09, Ж1: раньше сбой давал `none`, раздел вёл на первую настройку, и
 * брошенная настройка стирала базы всех аккаунтов вместе с настоящим. Теперь раздел показывает «Повторить»,
 * ребёнок — как без аккаунта (режим без записи по кнопке), но без пути к созданию второго аккаунта.
 */
export type AccountStatus = 'loading' | 'none' | 'ready' | 'error';

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
  /** Старт не удался до того, как стало известно, есть ли аккаунт (`app/_layout.tsx`): не `none`, а `error`. */
  fail(): void;
};

const EMPTY = { accountId: null, db: null, profiles: [], consent: 'not_asked' as const, retentionHold: null };

/**
 * Стирание брошенной настройки в полёте. Его могут позвать двое сразу — размонтирование настройки и слой
 * раздела при полуаккаунте (вопрос 92); второе параллельное стирание оставило бы метку `WIPE_PENDING_KEY`,
 * и следующий старт стёр бы аккаунт, заведённый уже после. Второй вызов получает тот же промис.
 */
let abandoning: Promise<void> | null = null;

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
    // файл выгрузки специалисту живёт не дольше листа «Поделиться»; если систему убили с открытым листом,
    // каталог остался — снять на старте, до базы (контрольный аудит 2026-11-09, Ж3). Сбой чистки старт не валит.
    await d.deleteCacheDir(EXPORT_DIR).catch((e: unknown) => {
      if (__DEV__) console.warn('export-dir', e);
    });
    // удаление аккаунта прервано (сбой, закрытое приложение) — довести до конца, аккаунта больше нет (№148)
    if ((await d.getItem(WIPE_PENDING_KEY)) !== null) {
      await finishDeviceWipe(d, null);
      setProgressPort(noRecordPort);
      set({ status: 'none', ...EMPTY });
      return;
    }
    let id = await currentAccountId(d);
    if (!id) {
      // ключ `current` потерян, а база с PIN на устройстве есть — вернуть её, а не вести к новой настройке (Ж1)
      id = await recoverableAccountId(d);
      if (id) await d.setItem(CURRENT_ACCOUNT_KEY, id);
    }
    if (!id) {
      setProgressPort(noRecordPort);
      set({ status: 'none', ...EMPTY });
      return;
    }
    try {
      // Файл базы пропал, а у аккаунта есть дети: открытие создало бы пустую базу без согласия, и ветка ниже
      // стёрла бы PIN и профили настоящего аккаунта. Это сбой, не брошенная настройка (`child-privacy-compliance`
      // по диффу этапа A). На web файлов нет по устройству — там проверка не применима.
      if (Platform.OS !== 'web') {
        const hasFile = (await d.listDbFiles()).some((f) => DB_FILE.exec(f)?.[1] === id);
        if (!hasFile && (await listChildIds(d, id)).length > 0) throw new Error(`Файл базы аккаунта ${id} не найден`);
      }
      const db = await openDb(id);
      // Прерванная настройка (PIN принят, согласие не дано): по тексту согласия на устройстве ничего не
      // остаётся — стираем этот аккаунт сами, иначе устройство застряло бы без входа для ребёнка и без удаления.
      // Только свой: базы других аккаунтов вправе снять лишь явное «Удалить аккаунт» (№148, Ж1).
      if ((await accountConsentStatus(db)) === 'not_asked') {
        await wipeOwnAccount({ db, device: d, accountId: id, deleteDbFile: () => deleteLocalDb(id) });
        setProgressPort(noRecordPort);
        set({ status: 'none', ...EMPTY });
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
    } catch (e) {
      // аккаунт есть, открыть не вышло: не «нет аккаунта» (это вело бы к новой настройке), а ошибка с «Повторить»
      if (__DEV__) console.warn('boot', e);
      setProgressPort(noRecordPort);
      set({ status: 'error', ...EMPTY, accountId: id });
    }
  },

  clearRetentionHold() {
    set({ retentionHold: null });
  },

  async createWithPin(pin, digest, openDb = openLocalDb) {
    const d = device();
    // настройку закрыли и тут же открыли снова: стирание брошенной ещё идёт, `current` снимается последним —
    // дождаться, иначе отказ «аккаунт уже есть» был бы ложным (`backend-auditor` по диффу)
    if (abandoning) await abandoning.catch(() => undefined);
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
    const consent = await accountConsentStatus(db);
    // аккаунт стёрт, пока писалось согласие (уход с настройки, вопрос 92): не возвращать `granted` в пустое состояние
    if (get().db !== db) return;
    set({ consent });
  },

  abandonSetup() {
    if (abandoning) return abandoning;
    abandoning = (async () => {
      const { db, accountId } = get();
      if (db && accountId) {
        // только этот аккаунт — не базы всего устройства (№148, контрольный аудит 2026-11-09, Ж1)
        await wipeOwnAccount({ db, device: device(), accountId, deleteDbFile: () => deleteLocalDb(accountId) });
      }
      setProgressPort(noRecordPort);
      set({ status: 'none', ...EMPTY });
    })().finally(() => {
      abandoning = null;
    });
    return abandoning;
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
    set({ status: 'none', ...EMPTY });
  },

  fail() {
    setProgressPort(noRecordPort);
    set({ status: 'error', ...EMPTY });
  },
}));
