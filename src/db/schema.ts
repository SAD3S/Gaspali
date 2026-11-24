import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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

/** Recettes personnelles (et recettes IA enregistrées). Listes stockées en JSON. */
export const recipes = sqliteTable('recipes', {
  ...syncColumns,
  title: text('title').notNull(),
  minutes: integer('minutes').notNull(),
  servings: integer('servings').notNull(),
  kind: text('kind').notNull(),
  /** JSON : string[] */
  tags: text('tags').notNull(),
  /** JSON : RecipeIngredient[] */
  ingredients: text('ingredients').notNull(),
  /** JSON : string[] */
  steps: text('steps').notNull(),
  photoUri: text('photo_uri'),
  source: text('source', { enum: ['perso', 'ia'] }).notNull(),
  authorId: text('author_id'),
});

/** Dossiers de recettes (« Desserts du dimanche », « Batch cooking »…). */
export const recipeFolders = sqliteTable('recipe_folders', {
  ...syncColumns,
  name: text('name').notNull(),
  position: integer('position').notNull(),
});

/**
 * Favoris et rangement en dossiers. recipe_id peut désigner une recette de la base
 * (identifiant texte) ou une recette perso (UUID).
 */
export const recipeLinks = sqliteTable('recipe_links', {
  ...syncColumns,
  recipeId: text('recipe_id').notNull(),
  folderId: text('folder_id'),
  kind: text('kind', { enum: ['favori', 'dossier'] }).notNull(),
}, (t) => [index('recipe_links_recipe_idx').on(t.recipeId)]);

/** Préférences alimentaires d'un membre (régime, allergènes, aliments détestés). */
export const dietaryProfiles = sqliteTable('dietary_profiles', {
  ...syncColumns,
  /** Utilisateur Supabase, ou « local » sans compte. */
  userId: text('user_id').notNull(),
  diet: text('diet', { enum: ['omnivore', 'pescetarien', 'vegetarien', 'vegan'] }).notNull(),
  /** JSON : AllergenId[] */
  allergens: text('allergens').notNull(),
  /** JSON : identifiants d'ingrédients */
  dislikes: text('dislikes').notNull(),
});

/** Liste de courses partagée. */
export const shoppingItems = sqliteTable('shopping_items', {
  ...syncColumns,
  name: text('name').notNull(),
  quantity: real('quantity'),
  unit: text('unit'),
  aisle: text('aisle').notNull(),
  checked: integer('checked', { mode: 'boolean' }).notNull(),
  ingredientId: text('ingredient_id'),
  recipeId: text('recipe_id'),
  addedBy: text('added_by'),
});

export type RecipeRow = typeof recipes.$inferSelect;
export type FolderRow = typeof recipeFolders.$inferSelect;
export type RecipeLinkRow = typeof recipeLinks.$inferSelect;
export type DietaryRow = typeof dietaryProfiles.$inferSelect;
export type ShoppingRow = typeof shoppingItems.$inferSelect;

/**
 * File des modifications locales à envoyer au serveur (synchro hors ligne).
 * Une ligne = un ensemble de champs modifiés d'une ligne, avec l'horodatage de chaque champ.
 */
export const outbox = sqliteTable('outbox', {
  seq: integer('seq').primaryKey({ autoIncrement: true }),
  tableName: text('table_name').notNull(),
  rowId: text('row_id').notNull(),
  householdId: text('household_id').notNull(),
  /** JSON : { colonne_serveur: valeur } */
  fields: text('fields').notNull(),
  /** JSON : { colonne_serveur: horodatage ms } */
  ts: text('ts').notNull(),
}, (t) => [index('outbox_row_idx').on(t.tableName, t.rowId)]);

/** Curseurs de synchronisation et autres états (clé / valeur). */
export const syncState = sqliteTable('sync_state', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/** Cache des membres du foyer (noms pour « ajouté par Léa »). */
export const members = sqliteTable('members', {
  householdId: text('household_id').notNull(),
  userId: text('user_id').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role', { enum: ['admin', 'membre'] }).notNull(),
}, (t) => [primaryKey({ columns: [t.householdId, t.userId] })]);

export type OutboxRow = typeof outbox.$inferSelect;
export type MemberRow = typeof members.$inferSelect;
