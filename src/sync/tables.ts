import { getTableColumns } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { ColumnKind, ColumnSpec } from '@/domain/sync';
import { events, inventoryItems, products } from '@/db/schema';

/** Tables synchronisées avec Supabase (même nom local et serveur). L'ordre compte : produits avant articles. */
export const SYNCED_TABLES = {
  products,
  inventory_items: inventoryItems,
  events,
} as const;

export type SyncedTableName = keyof typeof SYNCED_TABLES;
export const SYNCED_TABLE_NAMES = Object.keys(SYNCED_TABLES) as SyncedTableName[];

function kindOf(columnType: string): ColumnKind {
  if (columnType === 'SQLiteTimestamp') return 'timestamp';
  if (columnType === 'SQLiteBoolean') return 'boolean';
  return 'other';
}

const cache = new Map<SyncedTableName, ColumnSpec[]>();

/** Description des colonnes d'une table, déduite du schéma Drizzle. */
export function columnSpecs(name: SyncedTableName): ColumnSpec[] {
  let specs = cache.get(name);
  if (!specs) {
    const cols = getTableColumns(SYNCED_TABLES[name] as SQLiteTable);
    specs = Object.entries(cols).map(([key, c]) => ({ key, name: c.name, kind: kindOf(c.columnType) }));
    cache.set(name, specs);
  }
  return specs;
}
