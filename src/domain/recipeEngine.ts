import type { AllergenId } from '@/data/allergens';
import { INGREDIENTS_BY_ID, type Ingredient, type IngredientDiet } from '@/data/ingredients';
import type { RecipeData, RecipeIngredient } from '@/data/recipes';
import { computeFreshness, urgencyRank, type Freshness } from './freshness';
import { ingredientsForProduct, matchesIngredient, resolveIngredient } from './ingredientMatch';
import type { Item } from './inventory';
import { convert } from './units';

// ─── Recettes ────────────────────────────────────────────────────────────────

export type RecipeSource = 'base' | 'perso' | 'ia';

export interface Recipe extends RecipeData {
  source: RecipeSource;
  photoUri?: string | null;
  /** Page d'origine (recette importée d'un site). */
  sourceUrl?: string | null;
  authorId?: string | null;
}

export type Diet = 'omnivore' | 'pescetarien' | 'vegetarien' | 'vegan';
export const DIET_LABELS: Record<Diet, string> = { omnivore: 'Omnivore', pescetarien: 'Pescétarien', vegetarien: 'Végétarien', vegan: 'Végan' };

/** Ingrédient normalisé d'une ligne de recette (libellé libre résolu si possible). */
export function ingredientOf(ri: RecipeIngredient): Ingredient | null {
  if (ri.ingredientId) return INGREDIENTS_BY_ID[ri.ingredientId] ?? null;
  return ri.name ? resolveIngredient(ri.name) : null;
}

export function ingredientLabel(ri: RecipeIngredient): string {
  return ri.name ?? ingredientOf(ri)?.name ?? '?';
}

const required = (r: RecipeData) => r.ingredients.filter((x) => !x.optional);

/** Régime le plus strict compatible (ingrédients obligatoires seulement). */
export function recipeDiet(r: RecipeData): Diet {
  const diets = new Set<IngredientDiet>(required(r).map((x) => ingredientOf(x)?.diet ?? 'vegetal'));
  if (diets.has('viande')) return 'omnivore';
  if (diets.has('poisson')) return 'pescetarien';
  if (diets.has('animal')) return 'vegetarien';
  return 'vegan';
}

export function recipeAllergens(r: RecipeData, includeOptional = false): AllergenId[] {
  const out = new Set<AllergenId>();
  for (const x of includeOptional ? r.ingredients : required(r)) ingredientOf(x)?.allergens.forEach((a) => out.add(a));
  return [...out];
}

/** Le régime d'un membre accepte-t-il cette recette ? */
export function dietAccepts(member: Diet, recipe: Diet): boolean {
  const rank: Record<Diet, number> = { omnivore: 0, pescetarien: 1, vegetarien: 2, vegan: 3 };
  return rank[recipe] >= rank[member];
}

/** Tags affichés : ceux de la recette + tags déduits (régime, gluten, lactose, durée). */
export function recipeTags(r: RecipeData): string[] {
  const tags = new Set(r.tags.filter((t) => t !== 'végétarien' && t !== 'végan'));
  const diet = recipeDiet(r);
  if (diet === 'vegetarien' || diet === 'vegan') tags.add('végétarien');
  if (diet === 'vegan') tags.add('végan');
  const allergens = recipeAllergens(r);
  if (!allergens.includes('gluten')) tags.add('sans gluten');
  if (!allergens.includes('lait')) tags.add('sans lactose');
  if (r.minutes <= 20) tags.add('rapide');
  return [...tags];
}

// ─── Préférences du foyer ────────────────────────────────────────────────────

export interface MemberPrefs {
  name: string;
  diet: Diet;
  allergens: AllergenId[];
  dislikes: string[];
}

// ─── Évaluation ──────────────────────────────────────────────────────────────

export type IngredientStatus = 'urgent' | 'bientot' | 'a_verifier' | 'dispo' | 'base' | 'manquant';

export interface StockMatch {
  item: Item;
  freshness: Freshness;
}

export interface IngredientCheck {
  ri: RecipeIngredient;
  label: string;
  status: IngredientStatus;
  /** Produits de l'inventaire utilisables, du plus urgent au moins urgent. */
  stock: StockMatch[];
  /** Allergènes déclarés par le foyer présents dans cet ingrédient. */
  allergens: AllergenId[];
  disliked: boolean;
}

export interface Suggestion {
  recipe: Recipe;
  score: number;
  checks: IngredientCheck[];
  urgentUsed: number;
  soonUsed: number;
  missing: number;
  allAvailable: boolean;
  diet: Diet;
  /** Membres dont le régime n'est pas respecté. */
  dietConflicts: string[];
  dislikes: string[];
}

export const WEIGHTS = {
  urgentToday: 12,
  urgent: 10,
  soon: 5,
  toCheck: 3,
  available: 1,
  missing: -4,
  allAvailable: 6,
  dislike: -6,
  dietConflict: -8,
};

export interface EngineContext {
  items: Item[];
  basics: Set<string>;
  members: MemberPrefs[];
  today?: Date;
}

/** Index « ingrédient → produits en stock », calculé une fois pour toutes les recettes. */
export function indexStock(items: Item[], today: Date = new Date()): Map<string, StockMatch[]> {
  const index = new Map<string, StockMatch[]>();
  for (const item of items) {
    if (item.status !== 'en_stock') continue;
    const freshness = computeFreshness(item.expiresAt, item.dateType, today);
    if (!freshness.usableInRecipes) continue; // DLC dépassée : jamais proposée
    for (const id of ingredientsForProduct(item.name)) {
      const list = index.get(id) ?? [];
      list.push({ item, freshness });
      index.set(id, list);
    }
  }
  for (const list of index.values()) list.sort((a, b) => urgencyRank(a.freshness) - urgencyRank(b.freshness));
  return index;
}

function stockFor(ri: RecipeIngredient, index: Map<string, StockMatch[]>, items: Item[], today: Date): StockMatch[] {
  const ing = ingredientOf(ri);
  if (ing) return index.get(ing.id) ?? [];
  if (!ri.name) return [];
  // Ingrédient libre non reconnu : correspondance directe sur le nom.
  const pseudo = { name: ri.name, synonyms: [], exclude: [] };
  return items
    .filter((i) => i.status === 'en_stock' && matchesIngredient(i.name, pseudo))
    .map((item) => ({ item, freshness: computeFreshness(item.expiresAt, item.dateType, today) }))
    .filter((s) => s.freshness.usableInRecipes);
}

function statusOf(stock: StockMatch[], isBasic: boolean): IngredientStatus {
  const best = stock[0];
  if (best) {
    if (best.freshness.state === 'urgent') return 'urgent';
    if (best.freshness.state === 'bientot') return 'bientot';
    if (best.freshness.state === 'a_verifier') return 'a_verifier';
    return 'dispo';
  }
  return isBasic ? 'base' : 'manquant';
}

/**
 * Évalue une recette pour le foyer. Renvoie null si elle contient un allergène déclaré
 * (filtre strict : jamais proposée).
 */
export function evaluateRecipe(recipe: Recipe, ctx: EngineContext, index = indexStock(ctx.items, ctx.today)): Suggestion | null {
  const today = ctx.today ?? new Date();
  const householdAllergens = new Set(ctx.members.flatMap((m) => m.allergens));
  const dislikes = new Set(ctx.members.flatMap((m) => m.dislikes));
  let score = 0;
  let urgentUsed = 0;
  let soonUsed = 0;
  let missing = 0;
  const dislikedNames: string[] = [];

  const checks: IngredientCheck[] = recipe.ingredients.map((ri) => {
    const ing = ingredientOf(ri);
    const allergens = (ing?.allergens ?? []).filter((a) => householdAllergens.has(a));
    const stock = stockFor(ri, index, ctx.items, today);
    const status = statusOf(stock, !!ing && ctx.basics.has(ing.id));
    const disliked = !!ing && dislikes.has(ing.id);
    return { ri, label: ingredientLabel(ri), status, stock, allergens, disliked };
  });

  for (const c of checks) {
    if (c.ri.optional) {
      // Un ingrédient facultatif ne pénalise pas ; s'il est urgent, l'utiliser est un plus.
      if (c.status === 'urgent' && !c.allergens.length) score += WEIGHTS.soon;
      continue;
    }
    if (c.allergens.length) return null;
    switch (c.status) {
      case 'urgent':
        urgentUsed++;
        score += c.stock[0]!.freshness.daysLeft <= 0 ? WEIGHTS.urgentToday : WEIGHTS.urgent;
        break;
      case 'bientot':
        soonUsed++;
        score += WEIGHTS.soon;
        break;
      case 'a_verifier':
        score += WEIGHTS.toCheck;
        break;
      case 'dispo':
        score += WEIGHTS.available;
        break;
      case 'manquant':
        missing++;
        score += WEIGHTS.missing;
        break;
      case 'base':
        break;
    }
    if (c.disliked) {
      score += WEIGHTS.dislike;
      dislikedNames.push(c.label);
    }
  }

  const allAvailable = missing === 0;
  if (allAvailable) score += WEIGHTS.allAvailable;
  const diet = recipeDiet(recipe);
  const dietConflicts = ctx.members.filter((m) => !dietAccepts(m.diet, diet)).map((m) => m.name);
  score += dietConflicts.length ? WEIGHTS.dietConflict : 0;

  return { recipe, score, checks, urgentUsed, soonUsed, missing, allAvailable, diet, dietConflicts, dislikes: dislikedNames };
}

/** Recettes classées : d'abord celles qui sauvent les produits urgents. Allergènes exclus. */
export function suggestRecipes(recipes: Recipe[], ctx: EngineContext): Suggestion[] {
  const index = indexStock(ctx.items, ctx.today);
  return recipes
    .map((r) => evaluateRecipe(r, ctx, index))
    .filter((s): s is Suggestion => s !== null)
    .sort((a, b) => b.score - a.score || a.missing - b.missing || a.recipe.minutes - b.recipe.minutes);
}

/** « utilise 3 de tes produits urgents · 1 manquant » */
export function suggestionSummary(s: Suggestion): string {
  const parts: string[] = [];
  const urgent = s.urgentUsed + s.soonUsed;
  if (s.urgentUsed) parts.push(`utilise ${s.urgentUsed} de tes produits urgents`);
  else if (urgent) parts.push(`utilise ${urgent} produit${urgent > 1 ? 's' : ''} qui périme${urgent > 1 ? 'nt' : ''} bientôt`);
  if (s.allAvailable) parts.push('tout est dispo');
  else parts.push(`${s.missing} manquant${s.missing > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

// ─── « J'ai cuisiné ça » ─────────────────────────────────────────────────────

export interface CookProposal {
  item: Item;
  ingredient: string;
  /** Quantité restante proposée (0 = terminé). */
  remaining: number;
  /** Quantité convertible (sinon le produit est proposé comme terminé, à ajuster). */
  exact: boolean;
}

/**
 * Propose de décrémenter l'inventaire après avoir cuisiné, en piochant d'abord dans les
 * produits les plus urgents. Les ingrédients de base ne sont pas décomptés.
 */
export function cookProposals(s: Suggestion, servings: number, basics: Set<string>): CookProposal[] {
  const ratio = servings / s.recipe.servings;
  const out: CookProposal[] = [];
  for (const c of s.checks) {
    const ing = ingredientOf(c.ri);
    if (!c.stock.length || (ing && basics.has(ing.id) && c.status === 'base')) continue;
    if (c.ri.optional && c.status !== 'urgent') continue;
    let need = c.ri.quantity != null ? c.ri.quantity * ratio : null;
    for (const { item } of c.stock) {
      if (out.some((p) => p.item.id === item.id)) continue;
      if (need === null) {
        // Pas de quantité (« persil ») : on propose de garder le produit, à ajuster.
        out.push({ item, ingredient: c.label, remaining: item.quantity, exact: false });
        break;
      }
      const needInItemUnit = convert(need, c.ri.unit, item.unit);
      if (needInItemUnit === null) {
        out.push({ item, ingredient: c.label, remaining: 0, exact: false });
        break;
      }
      const used = Math.min(item.quantity, needInItemUnit);
      out.push({ item, ingredient: c.label, remaining: Math.max(0, Math.round((item.quantity - used) * 100) / 100), exact: true });
      need = convert(needInItemUnit - used, item.unit, c.ri.unit) ?? 0;
      if (need <= 0.0001) break;
    }
  }
  return out;
}

/** Ingrédients obligatoires manquants (pour la liste de courses), quantités à l'échelle. */
export function missingIngredients(s: Suggestion, servings: number): { label: string; ingredientId: string | null; quantity: number | null; unit: string | null }[] {
  const ratio = servings / s.recipe.servings;
  return s.checks
    .filter((c) => c.status === 'manquant' && !c.ri.optional)
    .map((c) => ({
      label: c.label,
      ingredientId: ingredientOf(c.ri)?.id ?? null,
      quantity: c.ri.quantity != null ? c.ri.quantity * ratio : null,
      unit: c.ri.unit,
    }));
}
