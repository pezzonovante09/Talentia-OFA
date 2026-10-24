/**
 * Всё, что о ребёнке лежит на устройстве **вне** SQLite, и соглашения об именах, по
 * которым это находится при удалении (PARENT.md, «Удаление и экспорт», «Данные на
 * устройстве»). Новый код обязан класть данные ребёнка под эти имена: иначе удаление их
 * не найдёт.
 *
 * - AsyncStorage: ключи ребёнка — `talentia:child:<childId>:…`, аккаунта —
 *   `talentia:account:<accountId>:…`, очередь телеметрии — `talentia:telemetry:…`;
 * - SecureStore: PIN и таймаут гейта аккаунта (`secureKeys`);
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
  | 'telemetry_queue';
