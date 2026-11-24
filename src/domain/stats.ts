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

const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export interface MonthStats extends PeriodStats {
  /** « nov. » (avec l'année si ce n'est pas l'année en cours) */
  label: string;
  start: Date;
  savedValue: number;
}

/** Les `count` derniers mois, du plus ancien au plus récent (mois en cours inclus). */
export function monthlyStats(events: StatEvent[], count = 6, now: Date = new Date()): MonthStats[] {
  const out: MonthStats[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const base = periodStats(events, start, end);
    let savedValue = 0;
    for (const e of events) {
      if (e.type === 'consomme' && !e.deletedAt && e.createdAt >= start && e.createdAt < end) savedValue += eventValue(e);
    }
    const label = MONTHS_SHORT[start.getMonth()]! + (start.getFullYear() !== now.getFullYear() ? ` ${String(start.getFullYear()).slice(2)}` : '');
    out.push({ ...base, label, start, savedValue: Math.round(savedValue * 100) / 100 });
  }
  return out;
}

export interface CategoryWaste {
  category: string;
  count: number;
  value: number;
}

/** Catégories les plus jetées sur une période (par nombre, puis par valeur). */
export function topWastedCategories(events: StatEvent[], from: Date, limit = 5): CategoryWaste[] {
  const map = new Map<string, CategoryWaste>();
  for (const e of events) {
    if (e.type !== 'jete' || e.deletedAt || e.createdAt < from) continue;
    const c = map.get(e.category) ?? { category: e.category, count: 0, value: 0 };
    c.count++;
    c.value = Math.round((c.value + eventValue(e)) * 100) / 100;
    map.set(e.category, c);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.value - a.value).slice(0, limit);
}

/** Graduations « rondes » d'un axe qui part de 0 (1, 2 ou 5 × 10ⁿ), au moins jusqu'à `max`. */
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow);
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}
