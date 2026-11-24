/** Conversions entre unités de recette et unités d'inventaire. */

const MASS: Record<string, number> = { g: 1, kg: 1000 };
const VOLUME: Record<string, number> = { ml: 1, cl: 10, L: 1000, l: 1000 };
/** Unités « au compte » considérées équivalentes (2 pièces = 2 filets = 2 pots). */
const COUNT = new Set(['pièce', 'filet', 'pot', 'tranche', 'gousse', 'botte', 'boîte', 'sachet', 'paquet', 'cube', 'bouteille', 'portion', 'bouquet']);

/** Convertit une quantité, ou null si les unités ne sont pas comparables (300 g vs 2 filets). */
export function convert(quantity: number, from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  if (from === to) return quantity;
  if (MASS[from] && MASS[to]) return (quantity * MASS[from]) / MASS[to];
  if (VOLUME[from] && VOLUME[to]) return (quantity * VOLUME[from]) / VOLUME[to];
  if (COUNT.has(from) && COUNT.has(to)) return quantity;
  return null;
}

/** Arrondi lisible pour des quantités mises à l'échelle (portions). */
export function roundForDisplay(q: number, unit: string | null): number {
  if (unit === 'g' || unit === 'ml') return q >= 100 ? Math.round(q / 10) * 10 : Math.round(q);
  if (unit === 'cl') return Math.round(q);
  return Math.round(q * 4) / 4;
}
