import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { INGREDIENTS_BY_ID } from '@/data/ingredients';
import type { RecipeData, RecipeKind } from '@/data/recipes';
import { computeFreshness, urgencyRank } from '@/domain/freshness';
import type { Item } from '@/domain/inventory';
import { formatQuantity } from '@/domain/quantity';
import type { MemberPrefs } from '@/domain/recipeEngine';
import { supabase } from './supabase';

export interface AiRecipeOptions {
  householdId: string;
  minutes: number;
  servings: number;
  kind: RecipeKind | 'peu-importe';
  wish: string;
  variation: number;
}

export interface AiRecipeResult {
  recipe: Omit<RecipeData, 'id'> & { usesUrgent?: string[] };
  cached: boolean;
  remaining: number;
}

export class AiRecipeError extends Error {
  constructor(
    public code: 'quota' | 'offline' | 'unauthorized' | 'not_member' | 'refused' | 'unavailable' | 'failed',
    message: string,
  ) {
    super(message);
  }
}

/** Ce que la fonction reçoit : produits utilisables (pas de DLC dépassée), triés par urgence. */
export function buildAiPayload(
  opts: AiRecipeOptions,
  items: Item[],
  basics: string[],
  members: MemberPrefs[],
  today: Date = new Date(),
) {
  const products = items
    .filter((i) => i.status === 'en_stock')
    .map((i) => ({ i, f: computeFreshness(i.expiresAt, i.dateType, today) }))
    .filter(({ f }) => f.usableInRecipes)
    .sort((a, b) => urgencyRank(a.f) - urgencyRank(b.f))
    .slice(0, 150)
    .map(({ i, f }) => ({ name: i.name.slice(0, 80), days_left: Math.max(-60, Math.min(3650, f.daysLeft)), quantity: formatQuantity(i.quantity, i.unit).slice(0, 40) }));
  return {
    household_id: opts.householdId,
    minutes: opts.minutes,
    servings: opts.servings,
    kind: opts.kind,
    wish: opts.wish.trim().slice(0, 120),
    variation: opts.variation,
    products,
    basics: basics.map((b) => INGREDIENTS_BY_ID[b]?.name ?? b).slice(0, 40),
    members: members.map((m) => ({ diet: m.diet, allergens: m.allergens, dislikes: m.dislikes })),
  };
}

/** Appelle l'Edge Function generate-recipe (la clé de l'API Claude reste sur le serveur). */
export async function generateAiRecipe(payload: ReturnType<typeof buildAiPayload>): Promise<AiRecipeResult> {
  if (!supabase) throw new AiRecipeError('unavailable', 'Les idées IA seront disponibles quand le serveur sera configuré.');
  const { data, error } = await supabase.functions.invoke('generate-recipe', { body: payload });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      let body: { error?: string; message?: string } = {};
      try {
        body = await (error.context as Response).json();
      } catch {
        // corps illisible
      }
      const code = body.error;
      const message = body.message ?? 'Le chef n’a pas pu inventer de recette.';
      if (code === 'quota') throw new AiRecipeError('quota', message);
      if (code === 'unauthorized') throw new AiRecipeError('unauthorized', message);
      if (code === 'not_member') throw new AiRecipeError('not_member', message);
      if (code === 'refused') throw new AiRecipeError('refused', message);
      if (code === 'config') throw new AiRecipeError('unavailable', message);
      throw new AiRecipeError('failed', message);
    }
    if (error instanceof FunctionsFetchError) throw new AiRecipeError('offline', 'Pas de connexion internet : les idées IA ont besoin du réseau.');
    throw new AiRecipeError('failed', 'Le chef n’a pas pu inventer de recette. Réessaie dans un instant.');
  }
  return data as AiRecipeResult;
}
