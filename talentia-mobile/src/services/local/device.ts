/**
 * Всё, что о ребёнке лежит на устройстве **вне** SQLite, и соглашения об именах, по
 * которым это находится при удалении (PARENT.md, «Удаление и экспорт», «Данные на
 * устройстве»). Новый код обязан класть данные ребёнка под эти имена: иначе удаление их
 * не найдёт.
 *
 * - AsyncStorage: ключи ребёнка — `talentia:child:<childId>:…`, аккаунта —
 *   `talentia:account:<accountId>:…`, очередь телеметрии — `talentia:telemetry:…`;
 * - SecureStore: PIN и таймаут гейта аккаунта (`secureKeys`); SecureStore не перечисляет ключи,
 *   поэтому каждый id аккаунта ещё и в реестре `talentia:accounts:known:<id>` (№148);
 * - файлы баз: `talentia-<accountId>.db` и его `-wal` / `-shm` / `-journal` (`DB_FILE`);
 * - кеш: озвучка с подставленным именем ребёнка — `voice/child/<childId>/`, файл экспорта —
 *   `export/`;
 * - уведомления: запланированные для ребёнка несут `childId` в `data`.
 *
 * Сессию Supabase снимает `signOut()` вызывающего, не этот модуль.
 */

export const childKeyPrefix = (childId: string) => `talentia:child:${childId}:`;
export const accountKeyPrefix = (accountId: string) => `talentia:account:${accountId}:`;
export const TELEMETRY_KEY_PREFIX = 'talentia:telemetry:';
export const ALL_KEYS_PREFIX = 'talentia:';

/**
 * Реестр id аккаунтов на устройстве (№148): ключ на каждый id, без общего списка — сбой записи
 * не портит чужие записи. Пишется до PIN: по нему удаление находит PIN брошенного аккаунта.
 */
export const KNOWN_ACCOUNTS_PREFIX = 'talentia:accounts:known:';
export const knownAccountKey = (accountId: string) => `${KNOWN_ACCOUNTS_PREFIX}${accountId}`;

/**
 * Удаление аккаунта начато и не закончено (№148): ставится до первого удаления, снимается последним.
 * По нему повтор не обращается к уже закрытой базе, а старт доводит удаление (`finishDeviceWipe`).
 */
export const WIPE_PENDING_KEY = 'talentia:wipe:pending';

/** Файл базы аккаунта и его спутники; группа 1 — id. Чужие файлы под это имя не подходят. */
export const DB_FILE = /^talentia-([A-Za-z0-9-]{8,64})\.db(?:-wal|-shm|-journal)?$/;

/** Ключи SecureStore аккаунта: PIN гейта и его таймаут. */
export const secureKeys = (accountId: string) => [`talentia.${accountId}.pin`, `talentia.${accountId}.lockout`];

/** Каталоги в кеше, относительно корня кеша. */
export const childVoiceDir = (childId: string) => ['voice', 'child', childId];
export const CHILD_VOICE_ROOT = ['voice', 'child'];
export const EXPORT_DIR = ['export'];

/** Порт устройства. В приложении — `expoDevice()`, в тестах — запись вызовов. */
export interface DeviceStore {
  keys(): Promise<readonly string[]>;
  removeKeys(keys: readonly string[]): Promise<void>;
  removeSecure(keys: readonly string[]): Promise<void>;
  /** AsyncStorage: профили, список детей, текущий аккаунт — только под префиксами выше. */
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  /** SecureStore: хеш PIN и таймаут гейта (`secureKeys`). */
  getSecure(key: string): Promise<string | null>;
  setSecure(key: string, value: string): Promise<void>;
  /** Имена файлов в каталоге баз SQLite (на web — пусто: база там в AsyncStorage). */
  listDbFiles(): Promise<readonly string[]>;
  /** Удалить файлы баз по имени; нет файла — не ошибка. */
  deleteDbFiles(names: readonly string[]): Promise<void>;
  /** Удалить каталог в кеше рекурсивно; нет каталога — не ошибка. */
  deleteCacheDir(path: readonly string[]): Promise<void>;
  cancelChildNotifications(childId: string): Promise<void>;
  cancelAllNotifications(): Promise<void>;
}

/** Что удаление обязано затронуть. Тест проверяет, что затронуто всё. */
export type CleanedPart =
  | 'server_revocation'
  | 'sqlite'
  | 'async_storage'
  | 'secure_store'
  | 'voice_cache'
  | 'export_file'
  | 'notifications'
  | 'telemetry_queue'
  /** Базы и PIN других аккаунтов этого устройства — брошенных после сбоя старта (№148). */
  | 'orphan_accounts';
