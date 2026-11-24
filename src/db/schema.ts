import { integer, real, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

/**
 * Colonnes communes, prêtes pour la synchro Supabase (étape 4) :
 * id UUID généré côté client, household_id, updated_at (dernière modif gagne), deleted_at (suppression douce).
 */
const syncColumns = {
  id: text('id').primaryKey(),
  householdId: text('household_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
};

/** Fiche produit (Open Food Facts ou saisie manuelle), cache local des codes-barres. */
export const products = sqliteTable('products', {
  ...syncColumns,
  barcode: text('barcode'),
  name: text('name').notNull(),
  brand: text('brand'),
  category: text('category').notNull(),
  imageUrl: text('image_url'),
  defaultQuantity: real('default_quantity'),
  defaultUnit: text('default_unit'),
  nutriscore: text('nutriscore'),
  allergens: text('allergens'),
  source: text('source', { enum: ['off', 'manuel'] }).notNull(),
}, (t) => [index('products_barcode_idx').on(t.barcode)]);

export const inventoryItems = sqliteTable('inventory_items', {
  ...syncColumns,
  productId: text('product_id'),
  name: text('name').notNull(),
  brand: text('brand'),
  category: text('category').notNull(),
  imageUrl: text('image_url'),
  quantity: real('quantity').notNull(),
  unit: text('unit').notNull(),
  location: text('location', { enum: ['frigo', 'congelo', 'placard'] }).notNull(),
  dateType: text('date_type', { enum: ['DLC', 'DDM'] }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  /** Date estimée (ticket de caisse, préréglage) tant que l'utilisateur ne l'a pas confirmée. */
  expiryEstimated: integer('expiry_estimated', { mode: 'boolean' }).notNull().default(false),
  openedAt: integer('opened_at', { mode: 'timestamp_ms' }),
  status: text('status', { enum: ['en_stock', 'consomme', 'jete'] }).notNull(),
  price: real('price'),
  addedBy: text('added_by'),
}, (t) => [index('items_status_idx').on(t.status)]);

export type EventType = 'ajout' | 'consomme' | 'jete' | 'entame' | 'partiel' | 'modif';

/** Historique (statistiques + « consommé par Tom »). */
export const events = sqliteTable('events', {
  ...syncColumns,
  itemId: text('item_id').notNull(),
  type: text('type', { enum: ['ajout', 'consomme', 'jete', 'entame', 'partiel', 'modif'] }).notNull(),
  productName: text('product_name').notNull(),
  category: text('category').notNull(),
  quantity: real('quantity'),
  unit: text('unit'),
  /** Valeur en € de la quantité concernée (pour les stats). */
  value: real('value'),
  detail: text('detail'),
  authorId: text('author_id'),
}, (t) => [index('events_item_idx').on(t.itemId)]);

export type ProductRow = typeof products.$inferSelect;
export type InventoryRow = typeof inventoryItems.$inferSelect;
export type NewInventoryRow = typeof inventoryItems.$inferInsert;
export type EventRow = typeof events.$inferSelect;
