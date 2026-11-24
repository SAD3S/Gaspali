import { addDays, startOfDay } from './dates';
import { computeFreshness, urgencyRank } from './freshness';
import type { Item } from './inventory';

export interface NotificationSettings {
  /** Rappel quotidien : produits à consommer d'ici demain. */
  dailyEnabled: boolean;
  hour: number;
  minute: number;
  /** Alerte la veille de la DLC (fusionnée dans le rappel du jour : une seule notification par jour). */
  dlcEveEnabled: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyEnabled: true,
  hour: 18,
  minute: 0,
  dlcEveEnabled: true,
};

export interface PlannedNotification {
  /** Identifiant stable par jour : « digest-2026-11-24 ». */
  id: string;
  date: Date;
  title: string;
  body: string;
  itemIds: string[];
}

function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** « A », « A et B », « A, B et C », « A, B, C et 2 autres » */
export function joinNames(names: string[], max = 3): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length <= max) return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
  const rest = names.length - max;
  return `${names.slice(0, max).join(', ')} et ${rest} autre${rest > 1 ? 's' : ''}`;
}

/**
 * Prévoit les notifications des `days` prochains jours à partir de l'inventaire actuel.
 * Au plus UNE notification par jour (rappel quotidien et veille de DLC regroupés).
 * À recalculer à chaque modification de l'inventaire.
 */
export function planNotifications(
  items: Item[],
  settings: NotificationSettings,
  now: Date = new Date(),
  days = 7,
): PlannedNotification[] {
  if (!settings.dailyEnabled && !settings.dlcEveEnabled) return [];
  const stock = items.filter((i) => i.status === 'en_stock');
  const out: PlannedNotification[] = [];

  for (let d = 0; d < days; d++) {
    const day = addDays(startOfDay(now), d);
    const fireAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), settings.hour, settings.minute);
    if (fireAt.getTime() <= now.getTime()) continue;

    const evaluated = stock
      .map((item) => ({ item, f: computeFreshness(item.expiresAt, item.dateType, day) }))
      .filter(({ f }) => f.daysLeft >= 0);
    const soon = evaluated.filter(({ f }) => f.daysLeft <= 1);
    const dlcEve = soon.filter(({ item, f }) => item.dateType === 'DLC' && f.daysLeft === 1);
    const chosen = settings.dailyEnabled ? soon : dlcEve;
    if (!chosen.length) continue;

    chosen.sort((a, b) => urgencyRank(a.f) - urgencyRank(b.f) || a.item.name.localeCompare(b.item.name, 'fr'));
    const today = chosen.filter(({ f }) => f.daysLeft === 0).map(({ item }) => item.name);
    const tomorrow = chosen.filter(({ f }) => f.daysLeft === 1).map(({ item }) => item.name);
    const n = chosen.length;

    let title: string;
    let body: string;
    if (settings.dailyEnabled) {
      title = `${n} produit${n > 1 ? 's' : ''} à consommer d’ici demain`;
      body = [today.length ? `Aujourd’hui : ${joinNames(today)}.` : '', tomorrow.length ? `Demain : ${joinNames(tomorrow)}.` : '']
        .filter(Boolean)
        .join(' ');
    } else {
      title = n > 1 ? `${n} DLC demain` : 'DLC demain';
      body = `${joinNames(tomorrow)} : à consommer au plus tard demain.`;
    }
    out.push({ id: `digest-${dayKey(day)}`, date: fireAt, title, body, itemIds: chosen.map(({ item }) => item.id) });
  }
  return out;
}

/** « 18:00 » */
export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
