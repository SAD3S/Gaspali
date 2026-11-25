import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import type { PlannedNotification } from '@/domain/notifications';

/** Notifications locales (aucun serveur) : rappel quotidien et veille de DLC. */
export const notificationsSupported = Platform.OS !== 'web';
export const CHANNEL_ID = 'rappels';
export const TIMER_CHANNEL_ID = 'minuteurs';
const TIMER_PREFIX = 'minuteur-';

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
  // On ne touche qu'aux rappels anti-gaspi (pas aux minuteurs du mode cuisine).
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => !n.identifier.startsWith(TIMER_PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
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

/**
 * Minuteur du mode cuisine quand l'horloge du téléphone n'est pas disponible (iOS…) :
 * notification sonore à la fin. Renvoie son identifiant (pour l'annuler), ou null.
 */
export async function scheduleTimerNotification(seconds: number, title: string, body: string): Promise<string | null> {
  if (!notificationsSupported) return null;
  if ((await getPermission()) !== 'granted' && (await requestPermission()) !== 'granted') return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(TIMER_CHANNEL_ID, {
      name: 'Minuteurs de cuisine',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 400, 200, 400],
    });
  }
  return Notifications.scheduleNotificationAsync({
    identifier: `${TIMER_PREFIX}${Date.now()}`,
    content: { title, body, sound: 'default' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, Math.round(seconds)), channelId: TIMER_CHANNEL_ID },
  });
}

export async function cancelTimerNotification(id: string): Promise<void> {
  if (notificationsSupported) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
