import { and, eq, isNull } from 'drizzle-orm';
import { INGREDIENTS_BY_ID } from '@/data/ingredients';
import { getCategory } from '@/domain/categories';
import { normalizeText } from '@/domain/inventory';
import { ownership, trackInsert, trackPatch } from '@/sync/outbox';
import { db } from './client';
import { newId } from './ids';
import { shoppingItems } from './schema';

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
 * plutôt que dupliqué ; les quantités s'additionnent si l'unité est la même. Renvoie le nombre d'ajouts.
 */
export function addShopping(list: ShoppingInput[]): number {
  const open = db.select().from(shoppingItems).where(and(isNull(shoppingItems.deletedAt), eq(shoppingItems.checked, false))).all();
  const { householdId, userId } = ownership();
  let added = 0;
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
    added++;
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
