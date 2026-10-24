/** Порт устройства в памяти для тестов: AsyncStorage и SecureStore — обычные Map. */
import type { DeviceStore } from '../services/local/device';

export function fakeDevice(): DeviceStore & { storage: Map<string, string>; secure: Map<string, string> } {
  const storage = new Map<string, string>();
  const secure = new Map<string, string>();
  return {
    storage,
    secure,
    keys: async () => [...storage.keys()],
    removeKeys: async (ks) => ks.forEach((k) => storage.delete(k)),
    removeSecure: async (ks) => ks.forEach((k) => secure.delete(k)),
    getItem: async (k) => storage.get(k) ?? null,
    setItem: async (k, v) => void storage.set(k, v),
    getSecure: async (k) => secure.get(k) ?? null,
    setSecure: async (k, v) => void secure.set(k, v),
    deleteCacheDir: async () => undefined,
    cancelChildNotifications: async () => undefined,
    cancelAllNotifications: async () => undefined,
  };
}
