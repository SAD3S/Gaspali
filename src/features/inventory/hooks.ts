import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { historyQuery, inStockQuery, itemQuery, rowToItem } from '@/db/inventoryRepo';

/** Articles en stock, mis à jour en direct à chaque écriture SQLite. */
export function useInventory() {
  const { data } = useLiveQuery(inStockQuery());
  return useMemo(() => (data ?? []).map(rowToItem), [data]);
}

export function useItem(id: string) {
  const { data } = useLiveQuery(itemQuery(id), [id]);
  const row = data?.[0];
  return useMemo(() => (row ? rowToItem(row) : undefined), [row]);
}

export function useItemHistory(id: string) {
  const { data } = useLiveQuery(historyQuery(id), [id]);
  return data ?? [];
}
