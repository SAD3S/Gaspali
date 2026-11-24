import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, sqlite } from '@/db/client';
import { members, outbox, syncState } from '@/db/schema';
import { toServerFields, type OutboxEntry } from '@/domain/sync';
import { stableUuid } from '@/db/ids';
import { getSyncContext, notifyLocalChange } from './context';
import { columnSpecs, SYNCED_TABLE_NAMES, SYNCED_TABLES, type SyncedTableName } from './tables';

/** Met en file les champs modifiés d'une ligne (rien si la ligne n'appartient à aucun foyer : mode local). */
export function enqueue(name: SyncedTableName, rowId: string, householdId: string | null | undefined, patch: Record<string, unknown>): void {
  if (!householdId) return;
  const fields = toServerFields(columnSpecs(name), patch);
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const now = Date.now();
  const ts = Object.fromEntries(keys.map((k) => [k, now]));
  db.insert(outbox).values({ tableName: name, rowId, householdId, fields: JSON.stringify(fields), ts: JSON.stringify(ts) }).run();
  notifyLocalChange();
}

/** Après une insertion locale : toute la ligne part au serveur. */
export function trackInsert(name: SyncedTableName, row: { id: string; householdId?: string | null } & Record<string, unknown>): void {
  enqueue(name, row.id, row.householdId, row);
}

/** Après une modification locale : seuls les champs modifiés partent. */
export function trackPatch(name: SyncedTableName, rowId: string, patch: Record<string, unknown>): void {
  const r = sqlite.getFirstSync<{ household_id: string | null }>(`SELECT household_id FROM ${name} WHERE id = ?`, rowId);
  enqueue(name, rowId, r?.household_id, patch);
}

/** Foyer et auteur à poser sur une nouvelle ligne. */
export function ownership(): { householdId: string | null; userId: string | null } {
  const { householdId, userId } = getSyncContext();
  return { householdId, userId };
}

export function readOutbox(limit = 1000): OutboxEntry[] {
  return db.select().from(outbox).orderBy(outbox.seq).limit(limit).all().map((r) => ({
    seq: r.seq,
    tableName: r.tableName,
    rowId: r.rowId,
    householdId: r.householdId,
    fields: JSON.parse(r.fields) as OutboxEntry['fields'],
    ts: JSON.parse(r.ts) as Record<string, number>,
  }));
}

export function deleteOutbox(seqs: number[]): void {
  for (let i = 0; i < seqs.length; i += 500) db.delete(outbox).where(inArray(outbox.seq, seqs.slice(i, i + 500))).run();
}

export function pendingCount(): number {
  return db.select({ n: sql<number>`count(*)` }).from(outbox).get()?.n ?? 0;
}

export function getState(key: string): string | null {
  return db.select().from(syncState).where(eq(syncState.key, key)).get()?.value ?? null;
}

export function setState(key: string, value: string): void {
  db.insert(syncState).values({ key, value }).onConflictDoUpdate({ target: syncState.key, set: { value } }).run();
}

/** Nombre de lignes locales sans foyer (créées en mode local). */
export function countLocalOnly(): number {
  return sqlite.getFirstSync<{ n: number }>(
    `SELECT count(*) AS n FROM inventory_items WHERE household_id IS NULL AND deleted_at IS NULL AND status = 'en_stock'`,
  )?.n ?? 0;
}

/** Rattache les données locales (sans foyer) au foyer et les met en file pour envoi complet. */
export function adoptLocalData(householdId: string): number {
  let adopted = 0;
  sqlite.withTransactionSync(() => {
    // Préférences saisies sans compte : elles deviennent celles de l'utilisateur dans ce foyer.
    const uid = getSyncContext().userId;
    const local = sqlite.getFirstSync<{ id: string }>(`SELECT id FROM dietary_profiles WHERE household_id IS NULL AND user_id = 'local'`);
    if (uid && local) {
      const id = stableUuid(`${householdId}:${uid}`);
      if (sqlite.getFirstSync(`SELECT id FROM dietary_profiles WHERE id = ?`, id)) sqlite.runSync(`DELETE FROM dietary_profiles WHERE id = ?`, local.id);
      else sqlite.runSync(`UPDATE dietary_profiles SET id = ?, user_id = ? WHERE id = ?`, id, uid, local.id);
    }
    for (const name of SYNCED_TABLE_NAMES) {
      const table = SYNCED_TABLES[name];
      const rows = db.select().from(table).where(isNull(table.householdId)).all() as ({ id: string } & Record<string, unknown>)[];
      if (!rows.length) continue;
      db.update(table).set({ householdId }).where(isNull(table.householdId)).run();
      for (const row of rows) enqueue(name, row.id, householdId, row);
      adopted += rows.length;
    }
  });
  return adopted;
}

/** Retire de l'appareil les données d'un foyer (elles restent sur le serveur). */
export function purgeHousehold(householdId: string): void {
  sqlite.withTransactionSync(() => {
    for (const name of SYNCED_TABLE_NAMES) {
      const table = SYNCED_TABLES[name];
      db.delete(table).where(eq(table.householdId, householdId)).run();
    }
    db.delete(outbox).where(eq(outbox.householdId, householdId)).run();
    db.delete(members).where(eq(members.householdId, householdId)).run();
    sqlite.runSync(`DELETE FROM sync_state WHERE key LIKE ?`, `%:${householdId}:%`);
  });
}

/** Remplace le cache local des membres d'un foyer. */
export function replaceMembers(householdId: string, list: { userId: string; displayName: string; role: 'admin' | 'membre' }[]): void {
  sqlite.withTransactionSync(() => {
    db.delete(members).where(eq(members.householdId, householdId)).run();
    if (list.length) db.insert(members).values(list.map((m) => ({ householdId, ...m }))).run();
  });
}

export function membersQuery(householdId: string) {
  return db.select().from(members).where(and(eq(members.householdId, householdId)));
}
