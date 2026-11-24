import { and, desc, eq, isNull } from 'drizzle-orm';
import { addDays } from '@/domain/dates';
import type { DateType } from '@/domain/freshness';
import type { Location } from '@/domain/categories';
import { consumePartially, freezerExtension, openItem, type Item, type ItemStatus } from '@/domain/inventory';
import { db } from './client';
import { newId } from './ids';
import { events, inventoryItems, products, type EventType, type InventoryRow } from './schema';

export function rowToItem(r: InventoryRow): Item & { row: InventoryRow } {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    quantity: r.quantity,
    unit: r.unit,
    location: r.location,
    dateType: r.dateType,
    expiresAt: r.expiresAt,
    addedAt: r.createdAt,
    openedAt: r.openedAt,
    status: r.status,
    row: r,
  };
}

/** Valeur en € d'une quantité, au prorata du prix d'achat. */
function valueOf(r: InventoryRow, quantity: number): number | null {
  if (r.price == null || r.quantity <= 0) return null;
  return Math.round((r.price * quantity) / r.quantity * 100) / 100;
}

function logEvent(r: InventoryRow, type: EventType, quantity: number | null, detail?: string): string {
  const now = new Date();
  const id = newId();
  db.insert(events).values({
    id,
    householdId: r.householdId,
    createdAt: now,
    updatedAt: now,
    itemId: r.id,
    type,
    productName: r.name,
    category: r.category,
    quantity,
    unit: r.unit,
    value: quantity != null ? valueOf(r, quantity) : null,
    detail: detail ?? null,
  }).run();
  return id;
}

export function getItem(id: string): InventoryRow | undefined {
  return db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).get();
}

export interface NewItemInput {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: Location;
  dateType: DateType;
  expiresAt: Date;
  expiryEstimated?: boolean;
  brand?: string | null;
  imageUrl?: string | null;
  productId?: string | null;
  price?: number | null;
}

export function addItem(input: NewItemInput): string {
  const now = new Date();
  const id = newId();
  db.insert(inventoryItems).values({
    id,
    createdAt: now,
    updatedAt: now,
    name: input.name.trim(),
    category: input.category,
    quantity: input.quantity,
    unit: input.unit,
    location: input.location,
    dateType: input.dateType,
    expiresAt: input.expiresAt,
    expiryEstimated: input.expiryEstimated ?? false,
    brand: input.brand ?? null,
    imageUrl: input.imageUrl ?? null,
    productId: input.productId ?? null,
    price: input.price ?? null,
    status: 'en_stock',
  }).run();
  const row = getItem(id);
  if (row) logEvent(row, 'ajout', row.quantity);
  return id;
}

export type ItemPatch = Partial<Pick<InventoryRow, 'name' | 'category' | 'quantity' | 'unit' | 'location' | 'dateType' | 'expiresAt' | 'expiryEstimated' | 'openedAt' | 'price'>>;

export function updateItem(id: string, patch: ItemPatch): void {
  db.update(inventoryItems).set({ ...patch, updatedAt: new Date() }).where(eq(inventoryItems.id, id)).run();
}

/** Passe en consommé / jeté. Renvoie une fonction d'annulation. */
export function setStatus(id: string, status: Exclude<ItemStatus, 'en_stock'>): () => void {
  const before = getItem(id);
  if (!before) return () => {};
  db.update(inventoryItems).set({ status, updatedAt: new Date() }).where(eq(inventoryItems.id, id)).run();
  const eventId = logEvent(before, status === 'consomme' ? 'consomme' : 'jete', before.quantity);
  return () => {
    db.update(inventoryItems).set({ status: before.status, updatedAt: new Date() }).where(eq(inventoryItems.id, id)).run();
    db.delete(events).where(eq(events.id, eventId)).run();
  };
}

/** Consommation partielle : il reste `remaining`. À 0, l'article passe en consommé. */
export function consumePart(id: string, remaining: number): () => void {
  const before = getItem(id);
  if (!before) return () => {};
  const r = consumePartially(before, remaining);
  if (r.finished) return setStatus(id, 'consomme');
  const opened = before.openedAt ? {} : openItem(rowToItem(before));
  updateItem(id, { quantity: r.remaining, ...opened });
  const eventId = logEvent(before, 'partiel', r.consumed);
  return () => {
    updateItem(id, { quantity: before.quantity, openedAt: before.openedAt, expiresAt: before.expiresAt });
    db.delete(events).where(eq(events.id, eventId)).run();
  };
}

/** Marque « entamé » (raccourcit la date si la catégorie le prévoit). */
export function markOpened(id: string): void {
  const before = getItem(id);
  if (!before || before.openedAt) return;
  const r = openItem(rowToItem(before));
  updateItem(id, r);
  logEvent(before, 'entame', null);
}

export function moveTo(id: string, location: Location, extendForFreezer: boolean): void {
  const before = getItem(id);
  if (!before) return;
  const ext = extendForFreezer && location === 'congelo' ? freezerExtension(rowToItem(before)) : null;
  updateItem(id, { location, ...(ext ? { expiresAt: ext.expiresAt, dateType: 'DDM' as const } : {}) });
}

export function historyQuery(itemId: string) {
  return db.select().from(events).where(and(eq(events.itemId, itemId), isNull(events.deletedAt))).orderBy(desc(events.createdAt));
}

export function inStockQuery() {
  return db.select().from(inventoryItems).where(and(eq(inventoryItems.status, 'en_stock'), isNull(inventoryItems.deletedAt)));
}

export function itemQuery(id: string) {
  return db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
}

/** Données de démonstration (bouton de développement dans « Plus »). */
export function seedDemo(): void {
  const t = new Date();
  const d = (n: number) => addDays(t, n);
  const rows: NewItemInput[] = [
    { name: 'Biscottes complètes', category: 'epicerie_sucree', quantity: 0.5, unit: 'paquet', location: 'placard', dateType: 'DDM', expiresAt: d(-20), price: 2.1 },
    { name: 'Blanc de poulet', category: 'viande', quantity: 2, unit: 'filet', location: 'frigo', dateType: 'DLC', expiresAt: d(0), price: 6.9 },
    { name: 'Crème fraîche', category: 'laitier', quantity: 20, unit: 'cl', location: 'frigo', dateType: 'DLC', expiresAt: d(1), price: 1.4 },
    { name: 'Épinards frais', category: 'legumes', quantity: 300, unit: 'g', location: 'frigo', dateType: 'DLC', expiresAt: d(3), price: 2.5 },
    { name: 'Yaourts nature', category: 'laitier', quantity: 4, unit: 'pot', location: 'frigo', dateType: 'DLC', expiresAt: d(9), price: 1.9 },
    { name: 'Comté 18 mois', category: 'fromage', quantity: 250, unit: 'g', location: 'frigo', dateType: 'DLC', expiresAt: d(12), price: 5.8 },
    { name: 'Petits pois', category: 'surgeles', quantity: 1, unit: 'sachet', location: 'congelo', dateType: 'DDM', expiresAt: d(120), price: 2.3 },
    { name: 'Pâtes penne', category: 'epicerie_salee', quantity: 500, unit: 'g', location: 'placard', dateType: 'DDM', expiresAt: d(300), price: 1.2 },
  ];
  rows.forEach(addItem);
  const biscottes = db.select().from(inventoryItems).where(eq(inventoryItems.name, 'Biscottes complètes')).get();
  if (biscottes) updateItem(biscottes.id, { openedAt: d(-3) });
  // Produit en cache, pour essayer « Saisir le code » sans réseau : 3260000000012.
  if (!db.select().from(products).where(eq(products.barcode, '3260000000012')).get()) {
    db.insert(products).values({
      id: newId(), createdAt: t, updatedAt: t, barcode: '3260000000012', name: 'Crème fraîche épaisse', brand: 'Démo',
      category: 'laitier', defaultQuantity: 20, defaultUnit: 'cl', nutriscore: 'D', allergens: '["milk"]', source: 'off',
    }).run();
  }
}
