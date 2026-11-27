import { addDays, daysBetween, startOfDay } from './dates';
import { computeFreshness, urgencyRank, type DateType, type Freshness } from './freshness';
import { defaultShelfDays, getCategory, type Location } from './categories';
import { roundQuarter } from './quantity';

export type ItemStatus = 'en_stock' | 'consomme' | 'jete';

/** Vue métier d'un article d'inventaire (indépendante de la base). */
export interface Item {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: Location;
  dateType: DateType;
  expiresAt: Date;
  addedAt: Date;
  openedAt: Date | null;
  status: ItemStatus;
  /** Sorti du congélateur : ne se recongèle pas (cru décongelé). */
  thawedAt?: Date | null;
}

export type SortKey = 'date' | 'nom' | 'ajout';
export const SORT_LABELS: Record<SortKey, string> = { date: 'date limite', nom: 'nom', ajout: 'date d’ajout' };

export type LocationFilter = 'tout' | Location;

const collator = typeof Intl !== 'undefined' ? new Intl.Collator('fr', { sensitivity: 'base' }) : null;

export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export interface ItemWithFreshness<T extends Item = Item> {
  item: T;
  freshness: Freshness;
}

/** Filtre (emplacement + recherche sans accents) et trie les articles en stock. */
export function queryInventory<T extends Item>(
  items: T[],
  opts: { location?: LocationFilter; search?: string; sort?: SortKey; today?: Date } = {},
): ItemWithFreshness<T>[] {
  const { location = 'tout', search = '', sort = 'date', today = new Date() } = opts;
  const q = normalizeText(search);
  const list = items
    .filter((i) => i.status === 'en_stock')
    .filter((i) => location === 'tout' || i.location === location)
    .filter((i) => !q || normalizeText(i.name).includes(q))
    .map((item) => ({ item, freshness: computeFreshness(item.expiresAt, item.dateType, today) }));

  const byName = (a: ItemWithFreshness<T>, b: ItemWithFreshness<T>) =>
    collator ? collator.compare(a.item.name, b.item.name) : a.item.name.localeCompare(b.item.name);

  list.sort((a, b) => {
    if (sort === 'nom') return byName(a, b);
    if (sort === 'ajout') return b.item.addedAt.getTime() - a.item.addedAt.getTime() || byName(a, b);
    return urgencyRank(a.freshness) - urgencyRank(b.freshness) || byName(a, b);
  });
  return list;
}

export function countByLocation(items: Item[]): Record<Location, number> {
  const r: Record<Location, number> = { frigo: 0, congelo: 0, placard: 0 };
  for (const i of items) if (i.status === 'en_stock') r[i.location]++;
  return r;
}

/** Date limite proposée par défaut pour une catégorie et un emplacement. */
export function defaultExpiry(categoryId: string, location: Location, today: Date = new Date()): Date {
  return addDays(today, defaultShelfDays(categoryId, location));
}

/**
 * Marque un produit « entamé » : la date peut être raccourcie selon la catégorie
 * (ex. crème fraîche ouverte : 3 jours). Ne rallonge jamais la date.
 */
export function openItem(item: Item, today: Date = new Date()): Pick<Item, 'openedAt' | 'expiresAt'> {
  if (item.openedAt) return { openedAt: item.openedAt, expiresAt: item.expiresAt };
  const opened = getCategory(item.category).openedDays;
  const shortened = opened != null ? addDays(today, opened) : item.expiresAt;
  return {
    openedAt: startOfDay(today),
    expiresAt: shortened < item.expiresAt ? shortened : item.expiresAt,
  };
}

/** Proposition de prolongation quand on passe un produit au congélateur. */
export function freezerExtension(item: Item, today: Date = new Date()): { expiresAt: Date; days: number } | null {
  if (item.location === 'congelo') return null;
  // Un produit décongelé ne se recongèle pas : la date reste courte.
  if (item.thawedAt) return null;
  // DLC dépassée : congeler ne rend pas un produit à nouveau consommable.
  if (item.dateType === 'DLC' && item.expiresAt < startOfDay(today)) return null;
  const days = getCategory(item.category).freezerDays;
  if (!days) return null;
  const expiresAt = addDays(today, days);
  if (expiresAt <= item.expiresAt) return null;
  return { expiresAt, days };
}

/**
 * « Congèle-le ! » : produits encore bons qui arrivent à leur date (aujourd'hui à dans 2 jours),
 * pas encore au congélateur et qui gagnent à y aller (viande, pain, fromage râpé…). Le plus pressé d'abord.
 */
export function freezeCandidates<T extends Item>(items: T[], today: Date = new Date()): { item: T; days: number; daysLeft: number }[] {
  return items
    .filter((i) => i.status === 'en_stock')
    .map((item) => ({ item, ext: freezerExtension(item, today), f: computeFreshness(item.expiresAt, item.dateType, today) }))
    .filter(({ ext, f }) => ext && f.state === 'urgent' && f.daysLeft >= 0)
    .sort((a, b) => a.f.daysLeft - b.f.daysLeft)
    .map(({ item, ext, f }) => ({ item, days: ext!.days, daysLeft: f.daysLeft }));
}

/** Catégories périssables à manger dans les 24 h après décongélation (au frigo). */
const THAW_ONE_DAY = new Set(['viande', 'poisson', 'restes', 'traiteur', 'surgeles']);

/**
 * Sortie du congélateur : nouvelle date courte (1 jour pour la viande, le poisson, les plats et
 * les restes ; 2 jours sinon), en DLC, et jamais plus loin que la date qu'avait le produit.
 * null si le produit n'est pas au congélateur.
 */
export function thawPlan(item: Pick<Item, 'location' | 'category' | 'expiresAt'>, today: Date = new Date()): { expiresAt: Date; days: number } | null {
  if (item.location !== 'congelo') return null;
  const days = THAW_ONE_DAY.has(item.category) ? 1 : 2;
  const target = addDays(startOfDay(today), days);
  return { expiresAt: target < item.expiresAt ? target : item.expiresAt, days };
}

/** « 4 mois », « 2 sem. », « 10 j » */
export function formatDuration(days: number): string {
  if (days >= 30) return `${Math.round(days / 30)} mois`;
  if (days >= 14 && days % 7 === 0) return `${days / 7} sem.`;
  return `${days} j`;
}

export interface PartialConsumption {
  remaining: number;
  consumed: number;
  /** Plus rien : l'article passe en « consommé ». */
  finished: boolean;
}

/** Consommation partielle : on indique ce qu'il reste (en quantité). */
export function consumePartially(item: Pick<Item, 'quantity'>, remaining: number): PartialConsumption {
  const r = Math.max(0, Math.min(item.quantity, roundQuarter(remaining)));
  return { remaining: r, consumed: roundQuarter(item.quantity - r), finished: r === 0 };
}

/** Raccourcis « il en reste » : ¾, ½, ¼ de la quantité actuelle. */
export function remainingOptions(quantity: number): { label: string; value: number }[] {
  return [
    { label: 'Les ¾', value: quantity * 0.75 },
    { label: 'La moitié', value: quantity * 0.5 },
    { label: 'Un quart', value: quantity * 0.25 },
  ];
}

export function addedLabel(addedAt: Date, today: Date = new Date()): string {
  const d = -daysBetween(today, addedAt);
  if (d <= 0) return 'ajouté aujourd’hui';
  if (d === 1) return 'ajouté hier';
  return `ajouté il y a ${d} j`;
}

export interface DayForecast<T extends Item = Item> {
  /** « 2026-11-27 » */
  key: string;
  date: Date;
  /** « Auj. », « Dem. », « Dim. » */
  short: string;
  /** Produits qui arrivent à date ce jour-là (aujourd'hui : aussi ceux déjà dépassés). */
  items: T[];
}

const WEEKDAYS_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];

/** « Météo du frigo » : ce qui arrive à date chacun des `days` prochains jours (hors congélateur). */
export function expiryForecast<T extends Item>(items: T[], today: Date = new Date(), days = 7): DayForecast<T>[] {
  const start = startOfDay(today);
  const out = Array.from({ length: days }, (_, i) => {
    const date = addDays(start, i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { key, date, short: i === 0 ? 'Auj.' : i === 1 ? 'Dem.' : WEEKDAYS_SHORT[date.getDay()]!, items: [] as T[] };
  });
  for (const item of items) {
    if (item.status !== 'en_stock' || item.location === 'congelo') continue;
    const d = daysBetween(start, item.expiresAt);
    if (d >= days) continue;
    out[Math.max(0, d)]!.items.push(item);
  }
  return out;
}
