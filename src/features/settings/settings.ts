import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { DEFAULT_BASICS } from '@/data/ingredients';
import { DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettings } from '@/domain/notifications';

/** Réglages propres à cet appareil (les notifications ne se synchronisent pas entre téléphones). */
export interface AppSettings {
  notifications: NotificationSettings;
  /** L'utilisateur a répondu (ou refusé pour l'instant) à la proposition d'activer les rappels. */
  notificationPromptDone: boolean;
  /** Ingrédients de base considérés comme toujours disponibles (sel, huile…). */
  basics: string[];
  /** Produit habituel terminé → ajouté automatiquement aux courses. */
  autoRestock: boolean;
}

const KEY = 'gaspalli.settings';
const DEFAULTS: AppSettings = { notifications: DEFAULT_NOTIFICATION_SETTINGS, notificationPromptDone: false, basics: DEFAULT_BASICS, autoRestock: true };

let current: AppSettings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Charge les réglages enregistrés (au démarrage). */
export async function loadSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<AppSettings>;
      current = { ...DEFAULTS, ...saved, notifications: { ...DEFAULTS.notifications, ...saved.notifications } };
    }
  } catch {
    // réglages par défaut
  }
  loaded = true;
  emit();
}

export function getSettings(): AppSettings {
  return current;
}

export function updateSettings(patch: Partial<AppSettings> | ((s: AppSettings) => Partial<AppSettings>)): void {
  const p = typeof patch === 'function' ? patch(current) : patch;
  current = { ...current, ...p };
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(current)).catch(() => {});
}

export function updateNotificationSettings(patch: Partial<NotificationSettings>): void {
  updateSettings((s) => ({ notifications: { ...s.notifications, ...patch } }));
}

export function useSettings(): AppSettings & { loaded: boolean } {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  return { ...s, loaded };
}
