import type { CategoryId } from './categories';
import { getCategory } from './categories';
import { eventValue, type StatEvent } from './stats';

/**
 * Ordre de grandeur des émissions évitées en sauvant un produit (kg CO₂e par article courant),
 * d'après les moyennes Agribalyse / ADEME par famille d'aliments. Volontairement prudent.
 */
const CO2_PER_ITEM: Record<CategoryId, number> = {
  viande: 5, poisson: 2.5, fromage: 2, laitier: 0.6, oeufs: 1.2, traiteur: 1.5, restes: 1, boulangerie: 0.4,
  fruits: 0.4, legumes: 0.4, surgeles: 1, epicerie_salee: 0.6, epicerie_sucree: 0.8, conserves: 0.6, boissons: 0.4,
  condiments: 0.5, autre: 0.6,
};
/** Voiture moyenne (ADEME) : environ 0,2 kg CO₂e par km. */
const CO2_PER_KM = 0.2;

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export interface MonthRecap {
  /** « novembre 2026 » */
  label: string;
  saved: number;
  savedValue: number;
  wasted: number;
  wastedValue: number;
  /** Part des produits terminés qui ont été mangés (null : rien ce mois-ci). */
  savedPct: number | null;
  /** Jours du mois (écoulés) sans rien jeter. */
  wasteFreeDays: number;
  daysCounted: number;
  co2Kg: number;
  carKm: number;
  /** Famille la plus sauvée (« Produits laitiers »). */
  topSaved: string | null;
}

/** Bilan d'un mois, à partir des événements (consommé, entamé en partie, jeté). */
export function monthRecap(events: StatEvent[], monthStart: Date, now: Date = new Date()): MonthRecap {
  const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const list = events.filter((e) => !e.deletedAt && e.createdAt >= monthStart && e.createdAt < end && (e as { detail?: string | null }).detail !== 'demo');
  const used = list.filter((e) => e.type === 'consomme' || e.type === 'partiel');
  const wasted = list.filter((e) => e.type === 'jete');
  const sum = (l: StatEvent[]) => Math.round(l.reduce((s, e) => s + eventValue(e), 0) * 100) / 100;
  const byCat = new Map<string, number>();
  for (const e of used) byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
  const top = [...byCat].sort((a, b) => b[1] - a[1])[0];
  const finished = used.filter((e) => e.type === 'consomme').length + wasted.length;
  const lastDay = now < end ? now.getDate() : new Date(end.getTime() - 1).getDate();
  const wasteDays = new Set(wasted.map((e) => e.createdAt.getDate())).size;
  const co2 = used.reduce((s, e) => s + (CO2_PER_ITEM[e.category as CategoryId] ?? CO2_PER_ITEM.autre), 0);
  return {
    label: `${MONTHS[monthStart.getMonth()]} ${monthStart.getFullYear()}`,
    saved: used.length,
    savedValue: sum(used),
    wasted: wasted.length,
    wastedValue: sum(wasted),
    savedPct: finished ? Math.round((used.filter((e) => e.type === 'consomme').length / finished) * 100) : null,
    wasteFreeDays: Math.max(0, lastDay - wasteDays),
    daysCounted: lastDay,
    co2Kg: Math.round(co2 * 10) / 10,
    carKm: Math.round(co2 / CO2_PER_KM),
    topSaved: top ? getCategory(top[0]).label : null,
  };
}
