import { and, eq, isNull } from 'drizzle-orm';
import { INGREDIENTS_BY_ID } from '@/data/ingredients';
import { getCategory } from '@/domain/categories';
import { normalizeText } from '@/domain/inventory';
import type { SavedListItem } from '@/domain/savedLists';
import { ownership, trackInsert, trackPatch } from '@/sync/outbox';
import { db } from './client';
import { newId } from './ids';
import { shoppingItems, shoppingLists } from './schema';

export function shoppingQuery() {
  return db.select().from(shoppingItems).where(isNull(shoppingItems.deletedAt));
}

export function aisleFor(ingredientId: string | null | undefined, category?: string): string {
  const cat = (ingredientId && INGREDIENTS_BY_ID[ingredientId]?.category) || category;
  return cat ? getCategory(cat).aisle : 'Autre';
}

export interface ShoppingInput {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  ingredientId?: string | null;
  recipeId?: string | null;
  category?: string;
}

/**
 * Ajoute des articles. Un article non coché du même ingrédient (ou du même nom) est complété
 * plutôt que dupliqué ; les quantités s'additionnent si l'unité est la même.
 * Renvoie les identifiants des articles réellement créés.
 */
export function addShopping(list: ShoppingInput[]): string[] {
  const open = db.select().from(shoppingItems).where(and(isNull(shoppingItems.deletedAt), eq(shoppingItems.checked, false))).all();
  const { householdId, userId } = ownership();
  const added: string[] = [];
  for (const it of list) {
    const now = new Date();
    const same = open.find((o) =>
      it.ingredientId ? o.ingredientId === it.ingredientId : normalizeText(o.name) === normalizeText(it.name),
    );
    if (same) {
      if (it.quantity != null && same.quantity != null && same.unit === (it.unit ?? null)) {
        const patch = { quantity: Math.round((same.quantity + it.quantity) * 100) / 100, updatedAt: now };
        db.update(shoppingItems).set(patch).where(eq(shoppingItems.id, same.id)).run();
        trackPatch('shopping_items', same.id, patch);
        same.quantity = patch.quantity;
      }
      continue;
    }
    const row = {
      id: newId(), householdId, createdAt: now, updatedAt: now, deletedAt: null,
      name: it.name.trim(), quantity: it.quantity ?? null, unit: it.unit ?? null,
      aisle: aisleFor(it.ingredientId, it.category), checked: false,
      ingredientId: it.ingredientId ?? null, recipeId: it.recipeId ?? null, addedBy: userId,
    };
    db.insert(shoppingItems).values(row).run();
    trackInsert('shopping_items', row);
    open.push(row);
    added.push(row.id);
  }
  return added;
}

export function setChecked(id: string, checked: boolean): void {
  const patch = { checked, updatedAt: new Date() };
  db.update(shoppingItems).set(patch).where(eq(shoppingItems.id, id)).run();
  trackPatch('shopping_items', id, patch);
}

export function removeShopping(id: string): void {
  const now = new Date();
  db.update(shoppingItems).set({ deletedAt: now, updatedAt: now }).where(eq(shoppingItems.id, id)).run();
  trackPatch('shopping_items', id, { deletedAt: now, updatedAt: now });
}

export function clearChecked(): number {
  const done = db.select().from(shoppingItems).where(and(isNull(shoppingItems.deletedAt), eq(shoppingItems.checked, true))).all();
  done.forEach((d) => removeShopping(d.id));
  return done.length;
}

/**
 * Produits achetés (ticket de caisse) : retire de la liste les articles correspondants
 * (même ingrédient, ou même nom). Renvoie le nombre d'articles retirés.
 */
export function removeBought(bought: { name: string; ingredientId: string | null }[]): number {
  const open = db.select().from(shoppingItems).where(isNull(shoppingItems.deletedAt)).all();
  const ids = new Set(bought.map((b) => b.ingredientId).filter(Boolean));
  const names = new Set(bought.map((b) => normalizeText(b.name)));
  let removed = 0;
  for (const row of open) {
    if ((row.ingredientId && ids.has(row.ingredientId)) || names.has(normalizeText(row.name))) {
      removeShopping(row.id);
      removed++;
    }
  }
  return removed;
}

// ─── Listes enregistrées ─────────────────────────────────────────────────────

export function savedListsQuery() {
  return db.select().from(shoppingLists).where(isNull(shoppingLists.deletedAt)).orderBy(shoppingLists.position, shoppingLists.name);
}

/** Enregistre des articles sous un nom ; un nom déjà pris remplace le contenu de cette liste. */
export function saveList(name: string, items: SavedListItem[]): string {
  const clean = name.trim().slice(0, 40);
  const now = new Date();
  const json = JSON.stringify(items);
  const existing = savedListsQuery().all().find((l) => normalizeText(l.name) === normalizeText(clean));
  if (existing) {
    const patch = { items: json, updatedAt: now };
    db.update(shoppingLists).set(patch).where(eq(shoppingLists.id, existing.id)).run();
    trackPatch('shopping_lists', existing.id, patch);
    return existing.id;
  }
  const position = db.select().from(shoppingLists).all().length;
  const row = { id: newId(), householdId: ownership().householdId, createdAt: now, updatedAt: now, deletedAt: null, name: clean, items: json, position };
  db.insert(shoppingLists).values(row).run();
  trackInsert('shopping_lists', row);
  return row.id;
}

export function updateSavedList(id: string, patch: { name?: string; items?: SavedListItem[] }): void {
  const full = {
    ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 40) } : {}),
    ...(patch.items !== undefined ? { items: JSON.stringify(patch.items) } : {}),
    updatedAt: new Date(),
  };
  db.update(shoppingLists).set(full).where(eq(shoppingLists.id, id)).run();
  trackPatch('shopping_lists', id, full);
}

export function deleteSavedList(id: string): void {
  const now = new Date();
  db.update(shoppingLists).set({ deletedAt: now, updatedAt: now }).where(eq(shoppingLists.id, id)).run();
  trackPatch('shopping_lists', id, { deletedAt: now, updatedAt: now });
}

/** Ajoute le contenu d'une liste enregistrée à la liste en cours. Renvoie le nombre d'articles nouveaux. */
export function applySavedList(items: SavedListItem[]): number {
  return addShopping(items).length;
}
