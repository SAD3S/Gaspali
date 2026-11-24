import { sqlite } from '@/db/client';
import type { ColumnSpec } from '@/domain/sync';
import { columnSpecs, type SyncedTableName } from './tables';

function toLocalValue(v: unknown, spec: ColumnSpec): string | number | null {
  if (v === null || v === undefined) return null;
  if (spec.kind === 'boolean') return v ? 1 : 0;
  if (spec.kind === 'timestamp') return Number(v);
  return v as string | number;
}

/**
 * Écrit dans SQLite des lignes reçues du serveur (sans les remettre en file).
 * Les champs encore en attente d'envoi local sont laissés tels quels : le serveur arbitrera.
 */
export function applyRemoteRows(name: SyncedTableName, rows: Record<string, unknown>[], pending: Map<string, Set<string>>): void {
  const specs = columnSpecs(name);
  sqlite.withTransactionSync(() => {
    for (const row of rows) {
      const id = String(row.id);
      const pend = pending.get(`${name}:${id}`);
      const cols = specs.filter((s) => s.name in row && (s.name === 'id' || !pend?.has(s.name)));
      const names = cols.map((c) => c.name);
      const updates = names.filter((n) => n !== 'id').map((n) => `${n} = excluded.${n}`);
      const sql =
        `INSERT INTO ${name} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')}) ` +
        `ON CONFLICT(id) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'}`;
      sqlite.runSync(sql, cols.map((c) => toLocalValue(row[c.name], c)));
    }
  });
}
