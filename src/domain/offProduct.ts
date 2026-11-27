import type { CategoryId } from './categories';

/** Champs Open Food Facts utilisés (API v2). */
export interface OffRawProduct {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  generic_name_fr?: string;
  brands?: string;
  quantity?: string;
  categories_tags?: string[];
  image_front_small_url?: string;
  image_front_url?: string;
  nutriscore_grade?: string;
  allergens_tags?: string[];
}

export const OFF_FIELDS = [
  'code', 'product_name', 'product_name_fr', 'generic_name_fr', 'brands', 'quantity',
  'categories_tags', 'image_front_small_url', 'image_front_url', 'nutriscore_grade', 'allergens_tags',
].join(',');

export interface ScannedProduct {
  barcode: string;
  name: string;
  brand: string | null;
  category: CategoryId;
  /** Contenance d'un exemplaire (« 20 cl » → 20 / cl). */
  packQuantity: number;
  packUnit: string;
  imageUrl: string | null;
  nutriscore: string | null;
  /** Allergènes OFF sans préfixe de langue (« milk », « gluten »…). */
  allergens: string[];
}

/**
 * Ordre important : du plus spécifique au plus général, et les produits frais (date courte) avant
 * les catégories à longue conservation. Un yaourt à boire est « boisson » ET « produit laitier » pour
 * Open Food Facts : c'est la date du produit laitier (quelques semaines) qui compte, pas 9 mois.
 * Les conserves restent avant : du thon en boîte se garde des années, pas 2 jours.
 */
const CATEGORY_RULES: [CategoryId, string[]][] = [
  ['surgeles', ['en:frozen-foods']],
  ['conserves', ['en:canned-foods']],
  ['fromage', ['en:cheeses']],
  ['oeufs', ['en:eggs', 'en:chicken-eggs']],
  ['poisson', ['en:fishes', 'en:seafood', 'en:smoked-fishes', 'en:fish-and-seafood']],
  ['viande', ['en:meats', 'en:poultries', 'en:hams', 'en:sausages', 'en:prepared-meats', 'en:meat']],
  ['laitier', ['en:dairies', 'en:yogurts', 'en:drinkable-yogurts', 'en:creams', 'en:milks', 'en:butters', 'en:fermented-milk-products', 'en:dairy-desserts', 'en:dairy-drinks']],
  ['traiteur', ['en:meals', 'en:prepared-meals', 'en:pizzas', 'en:sandwiches', 'en:prepared-salads', 'en:fresh-pastas']],
  ['boissons', ['en:beverages', 'en:waters', 'en:fruit-juices']],
  ['boulangerie', ['en:breads', 'en:viennoiseries', 'en:sliced-breads']],
  ['fruits', ['en:fresh-fruits', 'en:fruits']],
  ['legumes', ['en:fresh-vegetables', 'en:vegetables']],
  ['condiments', ['en:sauces', 'en:condiments', 'en:mustards', 'en:ketchup', 'en:vinegars']],
  ['epicerie_sucree', ['en:sweet-snacks', 'en:biscuits', 'en:chocolates', 'en:confectioneries', 'en:breakfast-cereals', 'en:sugars', 'en:sweet-spreads', 'en:jams', 'en:honeys', 'en:biscuits-and-cakes', 'en:rusks']],
  ['epicerie_salee', ['en:pastas', 'en:rices', 'en:dried-products', 'en:legumes', 'en:salty-snacks', 'en:flours', 'en:fats', 'en:vegetable-oils', 'en:cereals-and-potatoes']],
];

export function mapCategory(tags: string[] | undefined): CategoryId {
  if (!tags?.length) return 'autre';
  const set = new Set(tags);
  for (const [id, keys] of CATEGORY_RULES) if (keys.some((k) => set.has(k))) return id;
  return 'autre';
}

const UNIT_ALIASES: Record<string, string> = {
  g: 'g', gr: 'g', grs: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg',
  mg: 'g',
  ml: 'cl', cl: 'cl', dl: 'cl', l: 'L', litre: 'L', litres: 'L',
};

/**
 * « 20 cl » → { 20, cl } ; « 1,5 L » → { 1.5, L } ; « 500 ml » → { 50, cl } ;
 * « 4 x 125 g » → { 4, pot|pièce } ; « 6 œufs » → { 6, pièce }.
 */
export function parseOffQuantity(text: string | undefined, category: CategoryId = 'autre'): { quantity: number; unit: string } {
  const fallback = { quantity: 1, unit: 'pièce' };
  if (!text) return fallback;
  const t = text.toLowerCase().replace(',', '.').trim();

  const multi = t.match(/^(\d+)\s*[x×*]\s*\d/);
  if (multi) return { quantity: Number(multi[1]), unit: category === 'laitier' ? 'pot' : 'pièce' };

  const m = t.match(/^(\d+(?:\.\d+)?)\s*([a-zé]+)/);
  if (!m) {
    const n = t.match(/^(\d+)/);
    return n ? { quantity: Number(n[1]), unit: 'pièce' } : fallback;
  }
  const value = Number(m[1]);
  const unit = UNIT_ALIASES[m[2]!];
  if (!unit) return { quantity: value, unit: 'pièce' };
  if (m[2] === 'ml') return { quantity: Math.round(value / 10 * 10) / 10, unit: 'cl' };
  if (m[2] === 'dl') return { quantity: value * 10, unit: 'cl' };
  if (m[2] === 'mg') return { quantity: value / 1000, unit: 'g' };
  // 100 cl et plus → litres, 1000 g et plus → kg : plus lisible.
  if (unit === 'cl' && value >= 100) return { quantity: value / 100, unit: 'L' };
  if (unit === 'g' && value >= 1000) return { quantity: value / 1000, unit: 'kg' };
  return { quantity: value, unit };
}

function clean(s: string | undefined): string | null {
  const v = s?.trim();
  return v ? v : null;
}

/** Réponse OFF v2 → produit Gaspalli, ou null si introuvable / sans nom. */
export function parseOffResponse(barcode: string, json: unknown): ScannedProduct | null {
  const body = json as { status?: number; product?: OffRawProduct } | null;
  if (!body || body.status !== 1 || !body.product) return null;
  const p = body.product;
  const name = clean(p.product_name_fr) ?? clean(p.product_name) ?? clean(p.generic_name_fr);
  if (!name) return null;
  const category = mapCategory(p.categories_tags);
  const { quantity, unit } = parseOffQuantity(p.quantity, category);
  return {
    barcode,
    name,
    brand: clean(p.brands?.split(',')[0]),
    category,
    packQuantity: quantity,
    packUnit: unit,
    imageUrl: clean(p.image_front_small_url) ?? clean(p.image_front_url),
    nutriscore: clean(p.nutriscore_grade)?.toUpperCase() ?? null,
    allergens: (p.allergens_tags ?? []).map((a) => a.replace(/^[a-z]{2}:/, '')),
  };
}
