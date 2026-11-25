import { fromServerRow, toServerFields } from '@/domain/sync';
import { columnSpecs, SYNCED_TABLE_NAMES, type SyncedTableName } from './tables';

/**
 * Format du fichier de sauvegarde (droit d'accès et de portabilité RGPD) : JSON lisible,
 * colonnes en snake_case et dates en millisecondes, comme sur le serveur.
 */
export interface Backup {
  app: 'gaspalli';
  format: 1;
  exportedAt: string;
  tables: Partial<Record<SyncedTableName, Record<string, unknown>[]>>;
}

/** Ligne locale → ligne de sauvegarde (avec identifiant, sans le foyer). */
export function toBackupRow(name: SyncedTableName, row: Record<string, unknown>): Record<string, unknown> {
  return { id: row.id, ...toServerFields(columnSpecs(name), row) };
}

/** Ligne de sauvegarde → valeurs locales, rattachées au foyer actif (ou au téléphone). */
export function reviveRow(name: SyncedTableName, row: Record<string, unknown>, householdId: string | null): Record<string, unknown> & { id: string } {
  return { ...fromServerRow(columnSpecs(name), row), id: String(row.id), householdId };
}

/** Vérifie qu'un fichier est bien une sauvegarde Gaspalli lisible. */
export function parseBackup(raw: unknown): Backup {
  const b = raw as Partial<Backup> | null;
  if (!b || typeof b !== 'object' || b.app !== 'gaspalli' || typeof b.tables !== 'object' || b.tables === null) {
    throw new Error('Ce fichier n’est pas une sauvegarde Gaspalli.');
  }
  if (b.format !== 1) throw new Error('Cette sauvegarde vient d’une version plus récente de Gaspalli : mets l’app à jour.');
  for (const [name, rows] of Object.entries(b.tables)) {
    if (!(SYNCED_TABLE_NAMES as string[]).includes(name) || !Array.isArray(rows)) throw new Error('Sauvegarde abîmée : table inconnue ou illisible.');
    if (rows.some((r) => !r || typeof r !== 'object' || typeof (r as { id?: unknown }).id !== 'string')) {
      throw new Error('Sauvegarde abîmée : ligne sans identifiant.');
    }
  }
  return b as Backup;
}
