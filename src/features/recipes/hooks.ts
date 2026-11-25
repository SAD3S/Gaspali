import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { BUILTIN_RECIPES } from '@/data/recipes';
import { LOCAL_USER, parseProfile, profilesQuery } from '@/db/dietaryRepo';
import { mealPlanQuery } from '@/db/mealPlanRepo';
import { foldersQuery, linksQuery, personalRecipesQuery, rowToRecipe } from '@/db/recipesRepo';
import { availableAfterReservations, computeReservations, type PlanEntry, type Reservation } from '@/domain/planner';
import { suggestRecipes, type EngineContext, type MemberPrefs, type Recipe, type Suggestion } from '@/domain/recipeEngine';
import { useAuth } from '@/features/account/AuthProvider';
import { useMembers } from '@/features/account/hooks';
import { useInventory } from '@/features/inventory/hooks';
import { useSettings } from '@/features/settings/settings';

const BUILTINS: Recipe[] = BUILTIN_RECIPES.map((r) => ({ ...r, source: 'base' }));

/** Recettes de la base + recettes perso du foyer. */
export function useAllRecipes(): Recipe[] {
  const { data } = useLiveQuery(personalRecipesQuery());
  return useMemo(() => [...(data ?? []).map(rowToRecipe), ...BUILTINS], [data]);
}

export function useRecipe(id: string): Recipe | undefined {
  const all = useAllRecipes();
  return all.find((r) => r.id === id);
}

export interface RecipeOrganization {
  favorites: Set<string>;
  /** dossier → recettes */
  byFolder: Map<string, Set<string>>;
  folders: { id: string; name: string }[];
}

export function useRecipeOrganization(): RecipeOrganization {
  const { data: links } = useLiveQuery(linksQuery());
  const { data: folders } = useLiveQuery(foldersQuery());
  return useMemo(() => {
    const favorites = new Set<string>();
    const byFolder = new Map<string, Set<string>>();
    for (const l of links ?? []) {
      if (l.kind === 'favori') favorites.add(l.recipeId);
      else if (l.folderId) {
        const set = byFolder.get(l.folderId) ?? new Set<string>();
        set.add(l.recipeId);
        byFolder.set(l.folderId, set);
      }
    }
    return { favorites, byFolder, folders: (folders ?? []).map((f) => ({ id: f.id, name: f.name })) };
  }, [links, folders]);
}

/**
 * Préférences de tous les membres du foyer (ou les miennes en local).
 * Un membre sans préférences enregistrées compte comme omnivore sans allergie.
 */
export function useHouseholdPrefs(): { members: MemberPrefs[]; mine: (MemberPrefs & { saved: boolean }) } {
  const { session, active } = useAuth();
  const members = useMembers();
  const { data } = useLiveQuery(profilesQuery());
  return useMemo(() => {
    const me = session && active ? session.user.id : LOCAL_USER;
    const names = new Map(members.map((m) => [m.userId, m.displayName]));
    const relevant = (data ?? [])
      .filter((r) => (active ? r.householdId === active.id : r.householdId === null))
      .map(parseProfile);
    const list: MemberPrefs[] = relevant.map((p) => ({
      name: p.userId === me ? 'Toi' : names.get(p.userId) || 'Un membre',
      diet: p.diet,
      allergens: p.allergens,
      dislikes: p.dislikes,
    }));
    const minePrefs = relevant.find((p) => p.userId === me);
    return {
      members: list,
      mine: minePrefs
        ? { name: 'Toi', diet: minePrefs.diet, allergens: minePrefs.allergens, dislikes: minePrefs.dislikes, saved: true }
        : { name: 'Toi', diet: 'omnivore', allergens: [], dislikes: [], saved: false },
    };
  }, [data, members, session, active]);
}

export function useRecipesById(): Map<string, Recipe> {
  const recipes = useAllRecipes();
  return useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
}

/** Contexte du moteur : stock, ingrédients de base et préférences du foyer. */
export function useEngineContext(): EngineContext {
  const items = useInventory();
  const { basics, equipment } = useSettings();
  const { members } = useHouseholdPrefs();
  return useMemo(() => ({ items, basics: new Set(basics), members, equipment: new Set(equipment) }), [items, basics, members, equipment]);
}

/** Repas planifiés (toutes dates). */
export function usePlan(): PlanEntry[] {
  const { data } = useLiveQuery(mealPlanQuery());
  return useMemo(
    () => (data ?? []).map((r) => ({ id: r.id, date: r.date, slot: r.slot, recipeId: r.recipeId, servings: r.servings, done: r.done })),
    [data],
  );
}

/** Produits réservés par les repas à venir (id d'article → quantité et repas). */
export function useReservations(): Map<string, Reservation> {
  const plan = usePlan();
  const byId = useRecipesById();
  const ctx = useEngineContext();
  return useMemo(() => computeReservations(plan, byId, ctx), [plan, byId, ctx]);
}

/** Suggestions classées par le moteur anti-gaspi (sur le stock non réservé par le planning). */
export function useSuggestions(): Suggestion[] {
  const recipes = useAllRecipes();
  const ctx = useEngineContext();
  const reservations = useReservations();
  return useMemo(
    () => suggestRecipes(recipes, { ...ctx, items: availableAfterReservations(ctx.items, reservations) }),
    [recipes, ctx, reservations],
  );
}
