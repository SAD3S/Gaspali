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
];
