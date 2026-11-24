/**
 * Migrations SQL versionnées (PRAGMA user_version).
 * Doivent rester alignées avec `schema.ts` — ne jamais modifier une migration déjà publiée, en ajouter une.
 */
const sync = `id TEXT PRIMARY KEY NOT NULL,
  household_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER`;

export const MIGRATIONS: string[] = [
  `CREATE TABLE products (
  ${sync},
  barcode TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT NOT NULL,
  image_url TEXT,
  default_quantity REAL,
  default_unit TEXT,
  nutriscore TEXT,
  allergens TEXT,
  source TEXT NOT NULL
);
CREATE INDEX products_barcode_idx ON products (barcode);
CREATE TABLE inventory_items (
  ${sync},
  product_id TEXT,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT NOT NULL,
  image_url TEXT,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  location TEXT NOT NULL,
  date_type TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  expiry_estimated INTEGER NOT NULL DEFAULT 0,
  opened_at INTEGER,
  status TEXT NOT NULL,
  price REAL,
  added_by TEXT
);
CREATE INDEX items_status_idx ON inventory_items (status);
CREATE TABLE events (
  ${sync},
  item_id TEXT NOT NULL,
  type TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity REAL,
  unit TEXT,
  value REAL,
  detail TEXT,
  author_id TEXT
);
CREATE INDEX events_item_idx ON events (item_id);`,

  // v2 — synchronisation (étape 4)
  `CREATE TABLE outbox (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  household_id TEXT NOT NULL,
  fields TEXT NOT NULL,
  ts TEXT NOT NULL
);
CREATE INDEX outbox_row_idx ON outbox (table_name, row_id);
CREATE TABLE sync_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE TABLE members (
  household_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  PRIMARY KEY (household_id, user_id)
);
CREATE INDEX items_household_idx ON inventory_items (household_id);
CREATE INDEX events_household_idx ON events (household_id);
CREATE INDEX products_household_idx ON products (household_id);`,

  // v3 — recettes, dossiers, préférences alimentaires, courses (étape 6)
  `CREATE TABLE recipes (
  ${sync},
  title TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  servings INTEGER NOT NULL,
  kind TEXT NOT NULL,
  tags TEXT NOT NULL,
  ingredients TEXT NOT NULL,
  steps TEXT NOT NULL,
  photo_uri TEXT,
  source TEXT NOT NULL,
  author_id TEXT
);
CREATE TABLE recipe_folders (
  ${sync},
  name TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE recipe_links (
  ${sync},
  recipe_id TEXT NOT NULL,
  folder_id TEXT,
  kind TEXT NOT NULL
);
CREATE INDEX recipe_links_recipe_idx ON recipe_links (recipe_id);
CREATE TABLE dietary_profiles (
  ${sync},
  user_id TEXT NOT NULL,
  diet TEXT NOT NULL,
  allergens TEXT NOT NULL,
  dislikes TEXT NOT NULL
);
CREATE TABLE shopping_items (
  ${sync},
  name TEXT NOT NULL,
  quantity REAL,
  unit TEXT,
  aisle TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  ingredient_id TEXT,
  recipe_id TEXT,
  added_by TEXT
);`,

  // v4 — planning des repas (étape 8)
  `CREATE TABLE meal_plan (
  ${sync},
  date TEXT NOT NULL,
  slot TEXT NOT NULL,
  recipe_id TEXT NOT NULL,
  servings INTEGER NOT NULL,
  done INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX meal_plan_date_idx ON meal_plan (date);`,

  // v5 — correspondances apprises des tickets de caisse (étape 9)
  `CREATE TABLE receipt_aliases (
  ${sync},
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT,
  unit TEXT
);
CREATE INDEX receipt_aliases_key_idx ON receipt_aliases (key);`,
];
