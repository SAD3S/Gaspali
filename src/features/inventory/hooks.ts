import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { historyQuery, inStockQuery, itemQuery, rowToItem, eventsSinceQuery } from '@/db/inventoryRepo';
import { periodStats, startOfMonth, type PeriodStats } from '@/domain/stats';

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

/** Statistiques du mois en cours (mises à jour en direct). */
export function useMonthStats(): PeriodStats {
  const from = startOfMonth(new Date());
  const { data } = useLiveQuery(eventsSinceQuery(from), [from.getTime()]);
  return useMemo(() => periodStats(data ?? [], from), [data, from.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
}
