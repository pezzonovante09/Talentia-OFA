import { Platform } from 'react-native';

// Lazy-load expo-notifications only on native to avoid web warnings (push token listener not supported)
let Notifications: typeof import('expo-notifications') | null = null;
if (Platform.OS !== 'web') {
  const mod = require('expo-notifications') as typeof import('expo-notifications');
  Notifications = mod;
  mod.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web' || !Notifications) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications!.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyReminder(
  hour: number,
  titleText: string,
  bodyText: string,
): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: titleText,
        body: bodyText,
        sound: false,
      },
      trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
    },
  });
  } catch (err) {
    console.error('[notificationService] Failed to schedule reminder:', err);
  }
}

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
