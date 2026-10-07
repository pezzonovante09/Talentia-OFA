/**
 * Порт устройства на модулях Expo: AsyncStorage, SecureStore, файловая система.
 *
 * Уведомлений приложение не планирует, и модуля `expo-notifications` в сборке нет: его
 * плагин ставится автоматически и безусловно добавляет iOS push-entitlement и Android
 * `POST_NOTIFICATIONS` / `RECEIVE_BOOT_COMPLETED` — разрешения без функции (аудит
 * 2026-10-06, А3). Снимать нечего, поэтому снятие — пустое. Появятся напоминания
 * (PARENT.md, «Настройки ребёнка») — вернуть модуль, только локальные уведомления, и
 * config-плагин, убирающий `aps-environment`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Directory, Paths } from 'expo-file-system';
import type { DeviceStore } from './device';

export function expoDevice(): DeviceStore {
  return {
    keys: () => AsyncStorage.getAllKeys(),
    async removeKeys(keys) {
      if (keys.length) await AsyncStorage.multiRemove([...keys]);
    },
    async removeSecure(keys) {
      for (const k of keys) await SecureStore.deleteItemAsync(k);
    },
    async deleteCacheDir(path) {
      const dir = new Directory(Paths.cache, ...path);
      if (dir.exists) dir.delete();
    },
    async cancelChildNotifications() {},
    async cancelAllNotifications() {},
  };
}
