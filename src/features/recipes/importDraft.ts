import type { ImportedRecipe } from '@/domain/recipeImport';

/** Recette importée en attente de relecture dans l'éditeur (passage d'un écran à l'autre). */
export type ImportOrigin = 'lien' | 'photo' | 'fichier';

let draft: { recipe: ImportedRecipe; origin: ImportOrigin } | null = null;

export function setImportDraft(recipe: ImportedRecipe, origin: ImportOrigin): void {
  draft = { recipe, origin };
}

/** Lecture sans effacer : React peut appeler deux fois l'initialisation d'un écran en développement. */
export function peekImportDraft() {
  return draft;
}

export function clearImportDraft(): void {
  draft = null;
}
