/** Formatage et arithmétique des quantités (fractions lisibles : ½, ¼, ¾). */

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };

/** Unités comptables qui prennent un « s » au pluriel. */
const PLURALIZABLE = new Set(['pièce', 'pot', 'tranche', 'filet', 'sachet', 'paquet', 'boîte', 'bouteille', 'portion', 'bouquet']);

/** Arrondi au quart le plus proche. */
export function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

export function formatNumber(n: number): string {
  const r = roundQuarter(n);
  const whole = Math.floor(r);
  const frac = FRACTIONS[(r - whole).toFixed(2).replace(/0$/, '')];
  if (frac) return whole === 0 ? frac : `${whole}${frac}`;
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace('.', ',');
}

/** « 2 filets », « 300 g », « ½ pot », « 1 » (unité « pièce » masquée au singulier). */
export function formatQuantity(quantity: number, unit: string): string {
  const n = formatNumber(quantity);
  if (!unit) return n;
  if (unit === 'pièce') return quantity > 1 ? `${n} pièces` : n;
  const u = PLURALIZABLE.has(unit) && quantity > 1 ? `${unit}s` : unit;
  return `${n} ${u}`;
}

/** Pas d'incrément du sélecteur selon l'unité. */
export function stepFor(unit: string): number {
  switch (unit) {
    case 'g': return 50;
    case 'cl': return 5;
    case 'kg':
    case 'L': return 0.25;
    default: return 1;
  }
}
