import type { CategoryId } from './categories';

/**
 * Prix moyen estimé d'un article par catégorie (€), utilisé quand aucun prix n'a été saisi
 * ni lu sur un ticket. Ordre de grandeur pour un achat courant en France.
 */
export const AVERAGE_PRICE: Record<CategoryId, number> = {
  viande: 5,
  poisson: 6,
  laitier: 1.8,
  fromage: 3.5,
  oeufs: 2.8,
  fruits: 2.2,
  legumes: 2,
  boulangerie: 1.5,
  traiteur: 4,
  restes: 2.5,
  surgeles: 3.5,
  epicerie_salee: 1.8,
  epicerie_sucree: 2.5,
  conserves: 2,
  boissons: 2,
  condiments: 2.5,
  autre: 2.5,
};

export interface StatEvent {
  type: string;
  category: string;
  value: number | null;
  createdAt: Date;
  deletedAt?: Date | null;
}

/** Valeur d'un événement : prix réel au prorata si connu, sinon estimation par catégorie. */
export function eventValue(e: Pick<StatEvent, 'value' | 'category'>): number {
  if (e.value != null) return e.value;
  return AVERAGE_PRICE[e.category as CategoryId] ?? AVERAGE_PRICE.autre;
}

export interface PeriodStats {
  consumed: number;
  discarded: number;
  /** Part des produits terminés qui ont été consommés (null : pas encore de données). */
  savedPct: number | null;
  wastedValue: number;
  /** Au moins une valeur jetée est une estimation (pas de prix réel). */
  wastedEstimated: boolean;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Statistiques d'une période (par défaut : le mois en cours). */
export function periodStats(events: StatEvent[], from: Date, to: Date = new Date(8.64e15)): PeriodStats {
  let consumed = 0;
  let discarded = 0;
  let wastedValue = 0;
  let wastedEstimated = false;
  for (const e of events) {
    if (e.deletedAt || e.createdAt < from || e.createdAt >= to) continue;
    if (e.type === 'consomme') consumed++;
    else if (e.type === 'jete') {
      discarded++;
      wastedValue += eventValue(e);
      if (e.value == null) wastedEstimated = true;
    }
  }
  const total = consumed + discarded;
  return {
    consumed,
    discarded,
    savedPct: total ? Math.round((consumed / total) * 100) : null,
    wastedValue: Math.round(wastedValue * 100) / 100,
    wastedEstimated,
  };
}

/** « 4,80 € » */
export function formatEuros(v: number): string {
  return `${v.toFixed(2).replace('.', ',')} €`;
}
