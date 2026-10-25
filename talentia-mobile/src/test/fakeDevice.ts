/** Порт устройства в памяти для тестов: AsyncStorage и SecureStore — обычные Map. */
import type { DeviceStore } from '../services/local/device';

export type FakeDevice = DeviceStore & {
  storage: Map<string, string>;
  secure: Map<string, string>;
  files: Set<string>;
  /** Файлы в кеше — путь через `/` (`voice/child/<id>/a.mp3`); `deleteCacheDir` снимает каталог целиком. */
  cache: Set<string>;
  /** Запланированные уведомления — `childId` из `data`. */
  notifications: Set<string>;
};

export function fakeDevice(): FakeDevice {
  const storage = new Map<string, string>();
  const secure = new Map<string, string>();
  /** Имена файлов в каталоге баз. */
  const files = new Set<string>();
  const cache = new Set<string>();
  const notifications = new Set<string>();
  return {
    storage,
    secure,
    files,
    cache,
    notifications,
    listDbFiles: async () => [...files],
    deleteDbFiles: async (ns) => ns.forEach((n) => files.delete(n)),
    keys: async () => [...storage.keys()],
    removeKeys: async (ks) => ks.forEach((k) => storage.delete(k)),
    removeSecure: async (ks) => ks.forEach((k) => secure.delete(k)),
    getItem: async (k) => storage.get(k) ?? null,
    setItem: async (k, v) => void storage.set(k, v),
    getSecure: async (k) => secure.get(k) ?? null,
    setSecure: async (k, v) => void secure.set(k, v),
    deleteCacheDir: async (path) => {
      const dir = `${path.join('/')}/`;
      for (const f of [...cache]) if (f.startsWith(dir)) cache.delete(f);
    },
    cancelChildNotifications: async (childId) => void notifications.delete(childId),
    cancelAllNotifications: async () => notifications.clear(),
  };
}

/** Внедрить сбой: `nth`-й вызов метода бросает, остальные идут как обычно. */
export function failOnce(d: DeviceStore, method: keyof DeviceStore, nth: number): void {
  const target = d as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const orig = target[method];
  let n = 0;
  target[method] = async (...a: unknown[]) => {
    n += 1;
    if (n === nth) throw new Error(`внедрённый сбой ${method}#${nth}`);
    return orig(...a);
  };
}
