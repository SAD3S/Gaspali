import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { DEFAULT_BASICS } from '@/data/ingredients';
import { ALL_EQUIPMENT, type EquipmentId } from '@/domain/equipment';
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
  /** Présentation du premier lancement vue (ou passée). */
  onboardingDone: boolean;
  /** Envoi des rapports de plantage anonymes (Sentry, si configuré). */
  crashReports: boolean;
  /** Équipement de la cuisine : filtre les recettes proposées. */
  equipment: EquipmentId[];
  /** Badges déjà fêtés sur ce téléphone (null : pas encore initialisé, rien à fêter). */
  seenBadges: string[] | null;
  /** Dernier défi de la semaine réussi déjà fêté (« lundi-id »). */
  celebratedChallenge: string | null;
  /** Planning : idées anti-gaspi affichées dans les créneaux libres. */
  planIdeas: boolean;
}

const KEY = 'gaspalli.settings';
const DEFAULTS: AppSettings = {
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
  notificationPromptDone: false,
  basics: DEFAULT_BASICS,
  autoRestock: true,
  onboardingDone: false,
  crashReports: true,
  equipment: ALL_EQUIPMENT,
  seenBadges: null,
  celebratedChallenge: null,
  planIdeas: true,
};

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
      current = {
        ...DEFAULTS,
        // Installation existante (réglages enregistrés avant la présentation) : on ne la montre pas.
        onboardingDone: true,
        ...saved,
        notifications: { ...DEFAULTS.notifications, ...saved.notifications },
      };
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

/** Retour aux réglages d'origine (après effacement des données) : la présentation réapparaît. */
export function resetSettings(): void {
  current = DEFAULTS;
  emit();
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
