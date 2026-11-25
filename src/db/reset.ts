import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetSettings } from '@/features/settings/settings';
import { reschedule } from '@/services/notifications';
import { SYNCED_TABLE_NAMES } from '@/sync/tables';
import { sqlite } from './client';

/**
 * Efface toutes les données de Gaspalli sur ce téléphone : inventaire, historique, recettes perso,
 * courses, planning, file de synchronisation, réglages, rappels programmés.
 * Les données d'un foyer restent sur le serveur pour les autres membres (sauf suppression du compte).
 */
export async function wipeLocalData(): Promise<void> {
  sqlite.withTransactionSync(() => {
    for (const name of SYNCED_TABLE_NAMES) sqlite.runSync(`DELETE FROM ${name}`);
    sqlite.runSync('DELETE FROM outbox');
    sqlite.runSync('DELETE FROM sync_state');
    sqlite.runSync('DELETE FROM members');
  });
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((k) => k.startsWith('gaspalli.'));
  await AsyncStorage.multiRemove(keys).catch(() => {});
  await reschedule([]).catch(() => {});
  resetSettings();
}
