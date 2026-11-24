import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { MIGRATIONS } from './migrations';
import * as schema from './schema';

const DB_NAME = 'gaspalli.db';

export type DB = ExpoSQLiteDatabase<typeof schema>;

// Liaisons ES « vivantes » : affectées par initDb() avant le premier rendu.
export let sqlite: SQLiteDatabase;
export let db: DB;

let ready: Promise<void> | null = null;

/** Ouvre la base et applique les migrations. À attendre avant d'afficher l'app. */
export function initDb(): Promise<void> {
  ready ??= (async () => {
    // Sur le web, l'API synchrone exige que le worker SQLite soit déjà chargé.
    if (Platform.OS === 'web') await openDatabaseAsync(DB_NAME);
    sqlite = openDatabaseSync(DB_NAME, { enableChangeListener: true });
    db = drizzle(sqlite, { schema });
    migrate();
  })();
  return ready;
}

/** Applique les migrations manquantes (PRAGMA user_version), une transaction chacune. */
function migrate(): void {
  if (Platform.OS !== 'web') sqlite.execSync('PRAGMA journal_mode = WAL;');
  const row = sqlite.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  MIGRATIONS.slice(current).forEach((sql, i) => {
    sqlite.withTransactionSync(() => {
      sqlite.execSync(sql);
      sqlite.execSync(`PRAGMA user_version = ${current + i + 1}`);
    });
  });
}
