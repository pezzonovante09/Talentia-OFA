/**
 * Порт устройства на модулях Expo: AsyncStorage, SecureStore, файловая система, уведомления.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Directory, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
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
    async cancelChildNotifications(childId) {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const n of scheduled) {
        if (n.content.data?.childId === childId) await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    },
    cancelAllNotifications: () => Notifications.cancelAllScheduledNotificationsAsync(),
  };
}
