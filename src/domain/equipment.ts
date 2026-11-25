import type { RecipeData } from '@/data/recipes';
import { normalizeText } from './inventory';

/** Équipement de cuisine qui conditionne une recette. */
export type EquipmentId = 'four' | 'plaques' | 'micro_ondes' | 'mixeur' | 'batteur';

export const EQUIPMENT: { id: EquipmentId; label: string; hint: string }[] = [
  { id: 'plaques', label: 'Plaques de cuisson', hint: 'poêle, casserole' },
  { id: 'four', label: 'Four', hint: 'gratins, gâteaux, rôtis' },
  { id: 'micro_ondes', label: 'Micro-ondes', hint: 'réchauffer, fondre' },
  { id: 'mixeur', label: 'Mixeur ou blender', hint: 'soupes, smoothies' },
  { id: 'batteur', label: 'Batteur électrique', hint: 'blancs en neige, crème fouettée' },
];
export const ALL_EQUIPMENT: EquipmentId[] = EQUIPMENT.map((e) => e.id);
export const EQUIPMENT_LABELS = Object.fromEntries(EQUIPMENT.map((e) => [e.id, e.label])) as Record<EquipmentId, string>;

/** Détection dans le texte des étapes (sans accents, en minuscules). */
const PATTERNS: Record<EquipmentId, RegExp> = {
  four: /\b(four|enfourne[rz]?|prechauff\w*|gril|grill|gratine[rz]?)\b/,
  plaques: /\b(poele|casserole|faitout|sauteuse|cocotte|wok|marmite|plancha|feu (vif|doux|moyen)|a feu|hors du feu|porte[rz]? a ebullition|ebullition|bouillir|mijote[rz]?|frire|revenir|dans le beurre|dans l.huile)\b/,
  micro_ondes: /\bmicro[- ]?ondes?\b/,
  mixeur: /\b(mixe[rz]?|mixe|mixez|mixeur|blender|plongeant)\b/,
  batteur: /\b(batteur|robot patissier|fouet electrique)\b/,
};

/** Verbes de cuisson sans ustensile précis : plaques, sauf si la recette passe déjà au four. */
const HEAT = /\b(cuire|cuisson|cuits?|dorer|fondre|sauter|chauffer|rechauffe[rz]?|bouillante?|griller|grille|chaude?|brouilles?|caramelise[rz]?)\b/;

/**
 * Équipement nécessaire à une recette, déduit des étapes : « préchauffe le four » → four.
 * Une recette au micro-ondes qui mentionne aussi une poêle demande les deux.
 */
export function recipeEquipment(recipe: Pick<RecipeData, 'steps'>): EquipmentId[] {
  // « Écrase ou mixe » : le mixeur est alors facultatif.
  const text = normalizeText(recipe.steps.join(' \n ')).replace(/\b\w+ ou mixe\b|\bmixe ou \w+\b/g, ' ');
  const found = ALL_EQUIPMENT.filter((id) => PATTERNS[id].test(text));
  if (!found.includes('plaques') && !found.includes('four') && !found.includes('micro_ondes') && HEAT.test(text)) found.push('plaques');
  return ALL_EQUIPMENT.filter((id) => found.includes(id));
}

/** Sans four, plaques ni micro-ondes. */
export function isNoCook(recipe: Pick<RecipeData, 'steps'>): boolean {
  const eq = recipeEquipment(recipe);
  return !eq.includes('four') && !eq.includes('plaques') && !eq.includes('micro_ondes');
}

/** Ce qui manque au foyer pour faire la recette (vide = faisable). */
export function missingEquipment(recipe: Pick<RecipeData, 'steps'>, owned: ReadonlySet<EquipmentId>): EquipmentId[] {
  return recipeEquipment(recipe).filter((id) => !owned.has(id));
}
