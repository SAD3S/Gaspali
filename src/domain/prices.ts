import { AVERAGE_PRICE, formatEuros } from './stats';
import type { CategoryId } from './categories';

/** « 3,49 », « 3.49 € », « 3 » → 3.49 ; vide ou illisible → null. */
export function parsePrice(text: string): number | null {
  const m = text.replace(/\s/g, '').replace('€', '').replace(',', '.').match(/^\d{1,4}(?:\.\d{0,2})?$/);
  if (!m) return null;
  const v = Math.round(parseFloat(m[0]) * 100) / 100;
  return v > 0 ? v : null;
}

/** 3.5 → « 3,50 » (pour remplir un champ). */
export function priceInput(v: number | null | undefined): string {
  return v == null ? '' : v.toFixed(2).replace('.', ',');
}

/** Prix suggéré au moment d'ajouter un produit (touché pour remplir le champ). */
export interface PriceHint {
  amount: number;
  /** « Ton dernier prix (12 nov.) », « Open Prices · Carrefour » */
  label: string;
}

/** Prix d'un relevé Open Prices (API publique d'Open Food Facts), champs tolérés manquants. */
interface OpenPrice {
  price?: unknown;
  currency?: unknown;
  date?: unknown;
  price_is_discounted?: unknown;
  location?: { osm_name?: unknown; osm_address_city?: unknown } | null;
}

/**
 * Résume les derniers relevés d'un produit : médiane des prix en euros (hors promotions si possible),
 * et le magasin du relevé le plus récent.
 */
export function summarizeOpenPrices(json: unknown): PriceHint | null {
  const items = (json as { items?: unknown })?.items;
  if (!Array.isArray(items)) return null;
  const valid = (items as OpenPrice[])
    .filter((p) => p && typeof p.price === 'number' && p.price > 0 && p.price < 1000 && (p.currency ?? 'EUR') === 'EUR')
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
    .slice(0, 10);
  if (!valid.length) return null;
  const regular = valid.filter((p) => p.price_is_discounted !== true);
  const pool = (regular.length ? regular : valid).map((p) => p.price as number).sort((a, b) => a - b);
  const mid = Math.floor(pool.length / 2);
  const median = pool.length % 2 ? pool[mid]! : (pool[mid - 1]! + pool[mid]!) / 2;
  const store = valid[0]!.location?.osm_name;
  const where = typeof store === 'string' && store.trim() ? ` · ${store.trim()}` : '';
  return { amount: Math.round(median * 100) / 100, label: `Prix relevé${valid.length > 1 ? 's' : ''} par la communauté${where}` };
}

/** « +4,20 € sauvés » / « −4,20 € perdus », avec ≈ quand c'est une estimation. */
export function moneyPhrase(value: number, estimated: boolean, kind: 'sauve' | 'perdu'): string {
  return `${estimated ? '≈ ' : ''}${formatEuros(value)} ${kind === 'sauve' ? 'sauvés' : 'perdus'}`;
}

/** Valeur d'un produit en stock : son prix s'il est connu, sinon une estimation par catégorie. */
export function itemWorth(item: { price: number | null; category: string }): { value: number; estimated: boolean } {
  if (item.price != null) return { value: item.price, estimated: false };
  return { value: AVERAGE_PRICE[item.category as CategoryId] ?? AVERAGE_PRICE.autre, estimated: true };
}

/** « Steak haché : consommé · 4,20 € sauvés » */
export function finishMessage(name: string, status: 'consomme' | 'jete', item: { price: number | null; category: string }): string {
  const w = itemWorth(item);
  return `${name} : ${status === 'consomme' ? 'consommé' : 'jeté'} · ${moneyPhrase(w.value, w.estimated, status === 'consomme' ? 'sauve' : 'perdu')}`;
}
