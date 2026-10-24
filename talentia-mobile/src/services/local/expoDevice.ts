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
import { Platform } from 'react-native';
import type { DeviceStore } from './device';

/**
 * SecureStore на web недоступен. В Expo Web-прототипе (только `__DEV__`) хеш PIN лежит в AsyncStorage
 * под префиксом — это ворота прототипа; в выпуске раздел на web не показывается (PARENT.md «Web»).
 */
const WEB_SECURE_PREFIX = 'talentia:web-secure:';
const webSecure = Platform.OS === 'web' && __DEV__;

export function expoDevice(): DeviceStore {
  return {
    keys: () => AsyncStorage.getAllKeys(),
    async removeKeys(keys) {
      if (keys.length) await AsyncStorage.multiRemove([...keys]);
    },
    async removeSecure(keys) {
      if (webSecure) {
        await AsyncStorage.multiRemove(keys.map((k) => WEB_SECURE_PREFIX + k));
        return;
      }
      for (const k of keys) await SecureStore.deleteItemAsync(k);
    },
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    getSecure: (key) => (webSecure ? AsyncStorage.getItem(WEB_SECURE_PREFIX + key) : SecureStore.getItemAsync(key)),
    setSecure: (key, value) => (webSecure ? AsyncStorage.setItem(WEB_SECURE_PREFIX + key, value) : SecureStore.setItemAsync(key, value)),
    async deleteCacheDir(path) {
      // web: файловой системы нет (`Paths.cache` недоступен), кэша голоса/экспорта там тоже нет
      if (Platform.OS === 'web') return;
      const dir = new Directory(Paths.cache, ...path);
      if (dir.exists) dir.delete();
    },
    async cancelChildNotifications() {},
    async cancelAllNotifications() {},
  };
}
