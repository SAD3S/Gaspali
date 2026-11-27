import { and, desc, eq, gte, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import { addDays } from '@/domain/dates';
import { AVERAGE_PRICE } from '@/domain/stats';
import type { DateType } from '@/domain/freshness';
import { getCategory, type Location } from '@/domain/categories';
import { consumePartially, freezerExtension, normalizeText, openItem, thawPlan, type Item, type ItemStatus } from '@/domain/inventory';
import { maybeRestock } from '@/features/shopping/restock';
import { ownership, trackInsert, trackPatch } from '@/sync/outbox';
import { db } from './client';
import { removeShopping } from './shoppingRepo';
import { newId } from './ids';
import { events, inventoryItems, products, type EventType, type InventoryRow } from './schema';

// Toute écriture passe par ces fonctions : la modification est aussi mise en file pour la synchro.

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
    thawedAt: r.thawedAt,
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
  const values = {
    id: newId(),
    householdId: r.householdId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    itemId: r.id,
    type,
    productName: r.name,
    category: r.category,
    quantity,
    unit: r.unit,
    value: quantity != null ? valueOf(r, quantity) : null,
    detail: detail ?? null,
    authorId: ownership().userId,
  };
  db.insert(events).values(values).run();
  trackInsert('events', values);
  return values.id;
}

/** Annule un événement (suppression douce, pour qu'elle se synchronise aussi). */
function cancelEvent(id: string): void {
  const now = new Date();
  db.update(events).set({ deletedAt: now, updatedAt: now }).where(eq(events.id, id)).run();
  trackPatch('events', id, { deletedAt: now, updatedAt: now });
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
  const { householdId, userId } = ownership();
  const values = {
    id,
    householdId,
    addedBy: userId,
    deletedAt: null,
    openedAt: null,
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
    status: 'en_stock' as const,
  };
  db.insert(inventoryItems).values(values).run();
  trackInsert('inventory_items', values);
  const row = getItem(id);
  if (row) logEvent(row, 'ajout', row.quantity);
  return id;
}

export type ItemPatch = Partial<Pick<InventoryRow, 'name' | 'category' | 'quantity' | 'unit' | 'location' | 'dateType' | 'expiresAt' | 'expiryEstimated' | 'openedAt' | 'price' | 'status' | 'thawedAt' | 'imageUrl'>>;

export function updateItem(id: string, patch: ItemPatch): void {
  const full = { ...patch, updatedAt: new Date() };
  db.update(inventoryItems).set(full).where(eq(inventoryItems.id, id)).run();
  trackPatch('inventory_items', id, full);
}

/** Passe en consommé / jeté. Renvoie une fonction d'annulation. */
export function setStatus(id: string, status: Exclude<ItemStatus, 'en_stock'>): () => void {
  const before = getItem(id);
  if (!before) return () => {};
  updateItem(id, { status });
  const eventId = logEvent(before, status === 'consomme' ? 'consomme' : 'jete', before.quantity);
  const restocked = maybeRestock(before);
  return () => {
    updateItem(id, { status: before.status });
    cancelEvent(eventId);
    if (restocked) removeShopping(restocked);
  };
}

/** Consommation partielle : il reste `remaining`. À 0, l'article passe en consommé. */
export function consumePart(id: string, remaining: number): () => void {
  const before = getItem(id);
  if (!before) return () => {};
  const r = consumePartially(before, remaining);
  if (r.finished) return setStatus(id, 'consomme');
  const opened = before.openedAt ? {} : openItem(rowToItem(before));
  // Le prix suit ce qui reste : sinon la valeur du reste serait surestimée.
  const price = before.price != null && before.quantity > 0 ? Math.round(((before.price * r.remaining) / before.quantity) * 100) / 100 : before.price;
  updateItem(id, { quantity: r.remaining, price, ...opened });
  const eventId = logEvent(before, 'partiel', r.consumed);
  return () => {
    updateItem(id, { quantity: before.quantity, price: before.price, openedAt: before.openedAt, expiresAt: before.expiresAt });
    cancelEvent(eventId);
  };
}

/** Marque « entamé » (raccourcit la date si la catégorie le prévoit). Renvoie l'annulation. */
export function markOpened(id: string): () => void {
  const before = getItem(id);
  if (!before || before.openedAt) return () => {};
  const r = openItem(rowToItem(before));
  updateItem(id, r);
  // L'ancienne date est gardée dans l'événement : « Pas entamé » pourra la remettre plus tard.
  logEvent(before, 'entame', null, JSON.stringify({ expiresAt: before.expiresAt.getTime(), dateType: before.dateType }));
  return () => unmarkOpened(id);
}

/**
 * « Pas entamé » (erreur de manipulation) : retire la marque et remet la date d'avant si elle est
 * connue. Renvoie true si la date a été remise.
 */
export function unmarkOpened(id: string): boolean {
  const before = getItem(id);
  if (!before || !before.openedAt) return false;
  const last = db
    .select()
    .from(events)
    .where(and(eq(events.itemId, id), eq(events.type, 'entame'), isNull(events.deletedAt)))
    .orderBy(desc(events.createdAt))
    .get();
  let previous: { expiresAt: number; dateType: DateType } | null = null;
  try {
    previous = last?.detail ? (JSON.parse(last.detail) as { expiresAt: number; dateType: DateType }) : null;
  } catch {
    previous = null;
  }
  updateItem(id, {
    openedAt: null,
    ...(previous && Number.isFinite(previous.expiresAt) ? { expiresAt: new Date(previous.expiresAt), dateType: previous.dateType } : {}),
  });
  if (last) cancelEvent(last.id);
  return !!previous;
}

export function moveTo(id: string, location: Location, extendForFreezer: boolean): () => void {
  const before = getItem(id);
  if (!before) return () => {};
  const item = rowToItem(before);
  const ext = extendForFreezer && location === 'congelo' ? freezerExtension(item) : null;
  // Sortie du congélateur : date courte, marqué décongelé (pas de recongélation).
  const thaw = location !== 'congelo' ? thawPlan(item) : null;
  updateItem(id, {
    location,
    ...(ext ? { expiresAt: ext.expiresAt, dateType: 'DDM' as const } : {}),
    ...(thaw ? { expiresAt: thaw.expiresAt, dateType: 'DLC' as const, thawedAt: new Date() } : {}),
  });
  return () => updateItem(id, { location: before.location, expiresAt: before.expiresAt, dateType: before.dateType, thawedAt: before.thawedAt });
}

/** « Congèle-le ! » : au congélateur avec sa nouvelle date. Renvoie l'annulation. */
export function freezeItem(id: string): () => void {
  const before = getItem(id);
  if (!before) return () => {};
  return moveTo(id, 'congelo', true);
}

export function historyQuery(itemId: string) {
  return db.select().from(events).where(and(eq(events.itemId, itemId), isNull(events.deletedAt))).orderBy(desc(events.createdAt));
}

export function eventsSinceQuery(from: Date) {
  return db.select().from(events).where(and(gte(events.createdAt, from), isNull(events.deletedAt)));
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
  // Historique des 5 derniers mois, pour que l'écran Statistiques ait quelque chose à montrer.
  if (!db.select().from(events).where(eq(events.detail, 'demo')).get()) {
    const { householdId, userId } = ownership();
    const history: [number, string, string, number, number][] = [
      // [mois en arrière, catégorie, type, nombre, valeur unitaire]
      [5, 'legumes', 'jete', 4, 2], [5, 'laitier', 'consomme', 6, 1.8], [5, 'viande', 'jete', 1, 5.5],
      [4, 'legumes', 'jete', 3, 2], [4, 'laitier', 'consomme', 8, 1.8], [4, 'fruits', 'jete', 2, 2.2],
      [3, 'legumes', 'jete', 2, 2], [3, 'fromage', 'consomme', 9, 3.5], [3, 'traiteur', 'jete', 2, 4],
      [2, 'legumes', 'jete', 2, 2], [2, 'laitier', 'consomme', 11, 1.8], [2, 'boulangerie', 'jete', 1, 1.5],
      [1, 'fruits', 'jete', 1, 2.2], [1, 'viande', 'consomme', 12, 5], [1, 'legumes', 'jete', 1, 2],
      [0, 'laitier', 'consomme', 7, 1.8], [0, 'legumes', 'jete', 1, 2],
    ];
    for (const [back, category, type, count, value] of history) {
      for (let i = 0; i < count; i++) {
        const at = new Date(t.getFullYear(), t.getMonth() - back, Math.min(2 + i * 2, back === 0 ? Math.max(1, t.getDate() - 1) : 27), 19);
        const values = {
          id: newId(), householdId, createdAt: at, updatedAt: at, deletedAt: null, itemId: newId(),
          type: type as 'consomme' | 'jete', productName: getCategory(category).label, category,
          quantity: 1, unit: 'pièce', value, detail: 'demo', authorId: userId,
        };
        db.insert(events).values(values).run();
        trackInsert('events', values);
      }
    }
  }
  // Produit en cache, pour essayer « Saisir le code » sans réseau : 3260000000012.
  if (!db.select().from(products).where(eq(products.barcode, '3260000000012')).get()) {
    const values = {
      id: newId(), householdId: ownership().householdId, createdAt: t, updatedAt: t, deletedAt: null,
      barcode: '3260000000012', name: 'Crème fraîche épaisse', brand: 'Démo', category: 'laitier', imageUrl: null,
      defaultQuantity: 20, defaultUnit: 'cl', nutriscore: 'D', allergens: '["milk"]', source: 'off' as const,
    };
    db.insert(products).values(values).run();
    trackInsert('products', values);
  }
}

/**
 * Dernier prix payé pour ce produit (même code-barres, sinon même nom), d'après l'historique des
 * ajouts du foyer : ticket de caisse, scan ou saisie. Renvoie le prix et la quantité achetée.
 */
export function lastPaidPrice(productId: string | null, name: string): { value: number; quantity: number | null; at: Date } | null {
  const rows = db
    .select({ value: events.value, quantity: events.quantity, at: events.createdAt, productName: events.productName, productId: inventoryItems.productId })
    .from(events)
    .leftJoin(inventoryItems, eq(inventoryItems.id, events.itemId))
    .where(and(eq(events.type, 'ajout'), isNotNull(events.value), isNull(events.deletedAt)))
    .orderBy(desc(events.createdAt))
    .limit(500)
    .all();
  const key = normalizeText(name);
  const hit = (productId && rows.find((r) => r.productId === productId)) || rows.find((r) => normalizeText(r.productName) === key);
  return hit && hit.value != null ? { value: hit.value, quantity: hit.quantity, at: hit.at } : null;
}

/**
 * Historique résumé par jour et par type d'action (défis et badges) : quelques centaines de lignes
 * par an au lieu de tous les événements. La valeur d'une action sans prix est estimée par catégorie,
 * comme dans les statistiques. Les données de démonstration sont ignorées.
 */
export function dailyActivityQuery() {
  const estimate = sql.raw(
    `CASE category ${Object.entries(AVERAGE_PRICE).map(([c, v]) => `WHEN '${c}' THEN ${v}`).join(' ')} ELSE ${AVERAGE_PRICE.autre} END`,
  );
  const day = sql<string>`date(${events.createdAt} / 1000, 'unixepoch', 'localtime')`;
  return db
    .select({
      day,
      type: events.type,
      count: sql<number>`count(*)`,
      value: sql<number>`sum(coalesce(${events.value}, ${estimate}))`,
    })
    .from(events)
    .where(and(isNull(events.deletedAt), or(isNull(events.detail), ne(events.detail, 'demo'))))
    .groupBy(day, events.type);
}

/**
 * « Finir un produit » au scan : les articles en stock qui correspondent à ce code-barres (même fiche
 * produit, sinon même nom), du plus pressé au moins pressé.
 */
export function inStockForBarcode(barcode: string): { name: string | null; items: (Item & { row: InventoryRow })[] } {
  const product = db.select().from(products).where(and(eq(products.barcode, barcode), isNull(products.deletedAt))).get();
  if (!product) return { name: null, items: [] };
  const stock = inStockQuery().all().map(rowToItem);
  const byProduct = stock.filter((i) => i.row.productId === product.id);
  const key = normalizeText(product.name);
  const items = (byProduct.length ? byProduct : stock.filter((i) => normalizeText(i.name) === key)).sort(
    (a, b) => a.expiresAt.getTime() - b.expiresAt.getTime(),
  );
  return { name: product.name, items };
}
