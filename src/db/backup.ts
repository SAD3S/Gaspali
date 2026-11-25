import { eq, isNull } from 'drizzle-orm';
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { ownership, trackInsert } from '@/sync/outbox';
import { reviveRow, toBackupRow, type Backup } from '@/sync/backupFormat';
import { SYNCED_TABLE_NAMES, SYNCED_TABLES, type SyncedTableName } from '@/sync/tables';
import { db } from './client';
import { LOCAL_USER, profileId } from './dietaryRepo';

type SyncTable = SQLiteTable & { id: AnySQLiteColumn; deletedAt: AnySQLiteColumn };
const tableOf = (name: SyncedTableName) => SYNCED_TABLES[name] as unknown as SyncTable;

/** Lignes d'une table au format de la sauvegarde (avec identifiant, sans le foyer). */
function exportRows(name: SyncedTableName): Record<string, unknown>[] {
  const table = tableOf(name);
  const rows = db.select().from(table).where(isNull(table.deletedAt)).all() as Record<string, unknown>[];
  return rows.map((r) => toBackupRow(name, r));
}

/** Toutes les données de ce téléphone (droit d'accès et de portabilité RGPD). */
export function buildBackup(now: Date = new Date()): Backup {
  const tables: Backup['tables'] = {};
  for (const name of SYNCED_TABLE_NAMES) tables[name] = exportRows(name);
  return { app: 'gaspalli', format: 1, exportedAt: now.toISOString(), tables };
}

/**
 * Restaure une sauvegarde en l'ajoutant aux données existantes : les lignes déjà présentes
 * (même identifiant) sont gardées telles quelles. Dans un foyer, tout est partagé avec ses membres.
 */
export function restoreBackup(backup: Backup): { imported: number; skipped: number } {
  const { householdId, userId } = ownership();
  let imported = 0;
  let skipped = 0;
  db.transaction(() => {
    for (const name of SYNCED_TABLE_NAMES) {
      const table = tableOf(name);
      for (const raw of backup.tables[name] ?? []) {
        let row = reviveRow(name, raw, householdId);
        if (name === 'dietary_profiles') {
          // Les préférences sauvegardées deviennent les miennes, sauf si j'en ai déjà.
          const me = householdId && userId ? userId : LOCAL_USER;
          row = { ...row, id: profileId(householdId, me), userId: me };
        }
        if (db.select().from(table).where(eq(table.id, row.id)).get()) {
          skipped++;
          continue;
        }
        db.insert(table).values(row as never).run();
        trackInsert(name, row);
        imported++;
      }
    }
  });
  return { imported, skipped };
}
