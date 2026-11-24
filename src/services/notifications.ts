import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import type { PlannedNotification } from '@/domain/notifications';

/** Notifications locales (aucun serveur) : rappel quotidien et veille de DLC. */
export const notificationsSupported = Platform.OS !== 'web';
export const CHANNEL_ID = 'rappels';

export type PermissionState = 'granted' | 'undetermined' | 'denied';

if (notificationsSupported) {
  // App ouverte : on affiche quand même la notification (bandeau discret, sans son).
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Rappels anti-gaspi',
    description: 'Un rappel par jour quand des produits sont à consommer vite.',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#1F7A4D',
  });
}

export async function getPermission(): Promise<PermissionState> {
  if (!notificationsSupported) return 'denied';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  return canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<PermissionState> {
  if (!notificationsSupported) return 'denied';
  await ensureChannel();
  const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
  if (status === 'granted') return 'granted';
  return canAskAgain ? 'undetermined' : 'denied';
}

/** Ouvre les réglages du téléphone (permission refusée définitivement). */
export function openSystemSettings(): void {
  void Linking.openSettings();
}

/** Remplace toutes les notifications programmées par le nouveau plan. */
export async function reschedule(plan: PlannedNotification[]): Promise<void> {
  if (!notificationsSupported) return;
  await ensureChannel();
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const n of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: { url: '/alertes' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.date, channelId: CHANNEL_ID },
    });
  }
}

/** Notification de test dans 5 secondes (Réglages). */
export async function sendTest(title: string, body: string): Promise<void> {
  if (!notificationsSupported) return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { url: '/alertes' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL_ID },
  });
}
