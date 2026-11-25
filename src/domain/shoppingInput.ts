import { normalizeText } from './inventory';

/** Article tapé dans la liste de courses, avec sa quantité séparée du nom. */
export interface ShoppingInputParsed {
  name: string;
  quantity: number | null;
  unit: string | null;
}

const UNITS: Record<string, string> = {
  g: 'g', gr: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg',
  cl: 'cl', ml: 'ml', l: 'L', litre: 'L', litres: 'L',
};
const NUM = '(\\d+(?:[.,]\\d+)?)';
const UNIT_RE = '(kg|kilos?|grammes?|gr|g|cl|ml|litres?|l)';

const num = (s: string) => parseFloat(s.replace(',', '.'));
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** « de pommes », « d'huile » → « pommes », « huile ». */
const stripOf = (s: string) => s.replace(/^(?:de |d['’]\s*|des )/i, '').trim();

/**
 * « 5 jus de pomme » → 5 × « Jus de pomme » ; « 500 g de farine » → 500 g ; « yaourts x4 » → 4 ;
 * « 1,5 L lait » → 1,5 L. Sans chiffre, le nom est gardé tel quel.
 */
export function parseShoppingInput(text: string): ShoppingInputParsed {
  const t = text.trim().replace(/\s+/g, ' ');
  let m = new RegExp(`^${NUM}\\s*${UNIT_RE}\\.?\\s+(.+)$`, 'i').exec(t);
  if (m) return { name: capitalize(stripOf(m[3]!)), quantity: num(m[1]!), unit: UNITS[m[2]!.toLowerCase()] ?? null };
  m = new RegExp(`^(?:x\\s*)?${NUM}\\s*(?:x|×|\\*)?\\s+(.+)$`, 'i').exec(t);
  if (m && !/^\d/.test(m[2]!)) return { name: capitalize(stripOf(m[2]!)), quantity: num(m[1]!), unit: null };
  m = new RegExp(`^(.+?)\\s+(?:x|×|\\*)\\s*${NUM}$`, 'i').exec(t) ?? new RegExp(`^(.+?)\\s+${NUM}\\s*${UNIT_RE}$`, 'i').exec(t);
  if (m) return { name: capitalize(m[1]!), quantity: num(m[2]!), unit: m[3] ? (UNITS[m[3].toLowerCase()] ?? null) : null };
  return { name: capitalize(t), quantity: null, unit: null };
}

/** Clé de comparaison d'un nom d'article. */
export const shoppingKey = (name: string) => normalizeText(name);
