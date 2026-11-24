import { INGREDIENTS, INGREDIENTS_BY_ID, type Ingredient } from '@/data/ingredients';

/** Mots sans valeur pour la correspondance (articles, conditionnements, qualificatifs). */
const STOP = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'en', 'et', 'avec', 'sans', 'pour', 'un', 'une',
  'bio', 'frais', 'fraiche', 'fraiches', 'extra', 'fin', 'fine', 'nature', 'naturel', 'classique', 'tradition', 'traditionnel',
  'x', 'lot', 'pack', 'pot', 'barquette', 'boite', 'sachet', 'paquet', 'filet', 'tranche', 'portion',
  'g', 'kg', 'cl', 'l', 'ml', 'marque', 'repere', 'carrefour', 'auchan', 'leclerc', 'u',
]);

/** « Œufs frais » → « oeufs frais » → [oeuf] ; singulier simplifié, accents retirés. */
export function tokens(s: string): string[] {
  const cleaned = s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
  const out: string[] = [];
  for (let w of cleaned.split(' ')) {
    if (!w || /^\d+$/.test(w) || STOP.has(w)) continue;
    // Pluriels : « tomates » → « tomate », « poireaux » → « poireau ».
    if (w.length > 3 && (w.endsWith('s') || w.endsWith('x'))) w = w.slice(0, -1);
    if (!STOP.has(w)) out.push(w);
  }
  return out;
}

function containsAll(haystack: Set<string>, needle: string[]): boolean {
  return needle.length > 0 && needle.every((t) => haystack.has(t));
}

/** Le nom d'un produit (« Blanc de poulet fermier ») correspond-il à l'ingrédient (« poulet ») ? */
export function matchesIngredient(productName: string, ingredient: Pick<Ingredient, 'name' | 'synonyms' | 'exclude'>): boolean {
  const pt = new Set(tokens(productName));
  if (ingredient.exclude.some((ex) => containsAll(pt, tokens(ex)))) return false;
  return [ingredient.name, ...ingredient.synonyms].some((term) => containsAll(pt, tokens(term)));
}

const cache = new Map<string, string[]>();

/** Tous les ingrédients normalisés auxquels correspond un nom de produit. */
export function ingredientsForProduct(productName: string): string[] {
  const key = productName.toLowerCase();
  let ids = cache.get(key);
  if (!ids) {
    ids = INGREDIENTS.filter((ing) => matchesIngredient(productName, ing)).map((ing) => ing.id);
    // Éviter les doublons trop généraux : « emmental râpé » est du fromage râpé, pas (aussi) de l'emmental en bloc.
    if (ids.includes('fromage_rape')) ids = ids.filter((x) => x !== 'emmental');
    if (ids.includes('saumon_fume')) ids = ids.filter((x) => x !== 'saumon');
    cache.set(key, ids);
  }
  return ids;
}

/** Ingrédient normalisé le plus proche d'un libellé saisi (éditeur de recette), ou null. */
export function resolveIngredient(label: string): Ingredient | null {
  const t = tokens(label);
  if (!t.length) return null;
  const exact = INGREDIENTS.find((ing) => [ing.name, ...ing.synonyms].some((term) => tokens(term).join(' ') === t.join(' ')));
  if (exact) return exact;
  const ids = ingredientsForProduct(label);
  return ids.length ? INGREDIENTS_BY_ID[ids[0]!] ?? null : null;
}

/** Recherche d'ingrédients par préfixe (éditeur, aliments détestés). */
export function searchIngredients(query: string, limit = 8): Ingredient[] {
  const q = tokens(query).join(' ');
  if (!q) return [];
  return INGREDIENTS.filter((ing) => [ing.name, ...ing.synonyms].some((term) => tokens(term).join(' ').includes(q))).slice(0, limit);
}
