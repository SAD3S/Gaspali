import { and, eq, gte, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { events, inventoryItems, type InventoryRow } from '@/db/schema';
import { addShopping } from '@/db/shoppingRepo';
import { HABIT_WINDOW_DAYS, isHabitual, productKey } from '@/domain/habits';
import { resolveIngredient } from '@/domain/ingredientMatch';
import { getSettings } from '@/features/settings/settings';

const listeners = new Set<(name: string, shoppingId: string) => void>();

/** Prévient l'interface quand un produit habituel est ajouté automatiquement aux courses. */
export function onRestock(listener: (name: string, shoppingId: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Le dernier exemplaire d'un produit habituel vient d'être terminé : on l'ajoute à la liste de courses.
 * Renvoie l'identifiant de l'article créé (pour l'annulation), ou null.
 */
export function maybeRestock(row: InventoryRow): string | null {
  if (!getSettings().autoRestock) return null;
  const key = productKey(row.name);
  const stillInStock = db
    .select({ name: inventoryItems.name })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.status, 'en_stock'), isNull(inventoryItems.deletedAt)))
    .all()
    .some((i) => productKey(i.name) === key);
  if (stillInStock) return null;
  const since = new Date(Date.now() - HABIT_WINDOW_DAYS * 86_400_000);
  const purchases = db
    .select({ type: events.type, productName: events.productName, createdAt: events.createdAt, deletedAt: events.deletedAt })
    .from(events)
    .where(and(eq(events.type, 'ajout'), gte(events.createdAt, since)))
    .all();
  if (!isHabitual(row.name, purchases)) return null;
  const [id] = addShopping([{ name: row.name, ingredientId: resolveIngredient(row.name)?.id ?? null, category: row.category }]);
  if (id) listeners.forEach((l) => l(row.name, id));
  return id ?? null;
}
