import { and, eq, isNull } from 'drizzle-orm';
import type { RecipeIngredient, RecipeKind } from '@/data/recipes';
import type { Recipe } from '@/domain/recipeEngine';
import { ownership, trackInsert, trackPatch } from '@/sync/outbox';
import { db } from './client';
import { newId } from './ids';
import { recipeFolders, recipeLinks, recipes, type RecipeRow } from './schema';

function parse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function rowToRecipe(r: RecipeRow): Recipe {
  return {
    id: r.id,
    title: r.title,
    minutes: r.minutes,
    servings: r.servings,
    kind: r.kind as RecipeKind,
    tags: parse<string[]>(r.tags, []),
    ingredients: parse<RecipeIngredient[]>(r.ingredients, []),
    steps: parse<string[]>(r.steps, []),
    photoUri: r.photoUri,
    sourceUrl: r.sourceUrl,
    source: r.source,
    authorId: r.authorId,
  };
}

export function personalRecipesQuery() {
  return db.select().from(recipes).where(isNull(recipes.deletedAt));
}

export interface RecipeInput {
  id?: string;
  title: string;
  minutes: number;
  servings: number;
  kind: RecipeKind;
  tags: string[];
  ingredients: RecipeIngredient[];
  steps: string[];
  photoUri: string | null;
  /** Page d'origine (import depuis un site) ; absent = inchangé. */
  sourceUrl?: string | null;
  source?: 'perso' | 'ia';
}

/** Crée ou met à jour une recette perso. Renvoie son identifiant. */
export function saveRecipe(input: RecipeInput): string {
  const now = new Date();
  const fields = {
    title: input.title.trim(),
    minutes: Math.max(0, Math.round(input.minutes)),
    servings: Math.max(1, Math.round(input.servings)),
    kind: input.kind,
    tags: JSON.stringify([...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))]),
    ingredients: JSON.stringify(input.ingredients),
    steps: JSON.stringify(input.steps.map((s) => s.trim()).filter(Boolean)),
    photoUri: input.photoUri,
    ...(input.sourceUrl !== undefined ? { sourceUrl: input.sourceUrl } : {}),
    updatedAt: now,
  };
  if (input.id) {
    db.update(recipes).set(fields).where(eq(recipes.id, input.id)).run();
    trackPatch('recipes', input.id, fields);
    return input.id;
  }
  const { householdId, userId } = ownership();
  const row = { id: newId(), householdId, createdAt: now, deletedAt: null, source: input.source ?? ('perso' as const), authorId: userId, ...fields };
  db.insert(recipes).values(row).run();
  trackInsert('recipes', row);
  return row.id;
}

export function deleteRecipe(id: string): void {
  const now = new Date();
  db.update(recipes).set({ deletedAt: now, updatedAt: now }).where(eq(recipes.id, id)).run();
  trackPatch('recipes', id, { deletedAt: now, updatedAt: now });
  for (const l of db.select().from(recipeLinks).where(and(eq(recipeLinks.recipeId, id), isNull(recipeLinks.deletedAt))).all()) removeLink(l.id);
}

// ─── Dossiers et favoris ─────────────────────────────────────────────────────

export function foldersQuery() {
  return db.select().from(recipeFolders).where(isNull(recipeFolders.deletedAt)).orderBy(recipeFolders.position, recipeFolders.name);
}

export function linksQuery() {
  return db.select().from(recipeLinks).where(isNull(recipeLinks.deletedAt));
}

export function createFolder(name: string): string {
  const now = new Date();
  const position = db.select().from(recipeFolders).all().length;
  const row = { id: newId(), householdId: ownership().householdId, createdAt: now, updatedAt: now, deletedAt: null, name: name.trim().slice(0, 40), position };
  db.insert(recipeFolders).values(row).run();
  trackInsert('recipe_folders', row);
  return row.id;
}

export function renameFolder(id: string, name: string): void {
  const patch = { name: name.trim().slice(0, 40), updatedAt: new Date() };
  db.update(recipeFolders).set(patch).where(eq(recipeFolders.id, id)).run();
  trackPatch('recipe_folders', id, patch);
}

export function deleteFolder(id: string): void {
  const now = new Date();
  db.update(recipeFolders).set({ deletedAt: now, updatedAt: now }).where(eq(recipeFolders.id, id)).run();
  trackPatch('recipe_folders', id, { deletedAt: now, updatedAt: now });
  for (const l of db.select().from(recipeLinks).where(and(eq(recipeLinks.folderId, id), isNull(recipeLinks.deletedAt))).all()) removeLink(l.id);
}

function removeLink(id: string): void {
  const now = new Date();
  db.update(recipeLinks).set({ deletedAt: now, updatedAt: now }).where(eq(recipeLinks.id, id)).run();
  trackPatch('recipe_links', id, { deletedAt: now, updatedAt: now });
}

function addLink(recipeId: string, kind: 'favori' | 'dossier', folderId: string | null): void {
  const now = new Date();
  const row = { id: newId(), householdId: ownership().householdId, createdAt: now, updatedAt: now, deletedAt: null, recipeId, folderId, kind };
  db.insert(recipeLinks).values(row).run();
  trackInsert('recipe_links', row);
}

function activeLinks(recipeId: string, kind: 'favori' | 'dossier', folderId: string | null) {
  return db.select().from(recipeLinks).where(and(eq(recipeLinks.recipeId, recipeId), eq(recipeLinks.kind, kind), isNull(recipeLinks.deletedAt))).all()
    .filter((l) => l.folderId === folderId);
}

/** Ajoute ou retire des favoris (deux téléphones peuvent créer un doublon : on les retire tous). */
export function setFavorite(recipeId: string, on: boolean): void {
  const existing = activeLinks(recipeId, 'favori', null);
  if (on && !existing.length) addLink(recipeId, 'favori', null);
  if (!on) existing.forEach((l) => removeLink(l.id));
}

export function setInFolder(recipeId: string, folderId: string, on: boolean): void {
  const existing = activeLinks(recipeId, 'dossier', folderId);
  if (on && !existing.length) addLink(recipeId, 'dossier', folderId);
  if (!on) existing.forEach((l) => removeLink(l.id));
}
