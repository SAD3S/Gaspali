/**
 * Logique pure de la synchronisation locale ↔ serveur (sans base ni réseau, testée).
 *
 * - Les colonnes locales (Drizzle, camelCase, Date) sont converties en colonnes serveur
 *   (snake_case, millisecondes) et inversement.
 * - Chaque modification locale est mise en file avec l'horodatage de CHAQUE champ ;
 *   le serveur applique « dernière modification gagne » champ par champ.
 * - À la réception, un champ encore en attente d'envoi n'est pas écrasé par la version serveur.
 */

export type ColumnKind = 'timestamp' | 'boolean' | 'other';

export interface ColumnSpec {
  /** Nom côté JS (Drizzle) : `expiresAt` */
  key: string;
  /** Nom de colonne (local et serveur) : `expires_at` */
  name: string;
  kind: ColumnKind;
}

/** Colonnes jamais envoyées comme « champs » (identité de la ligne). */
export const IDENTITY_COLUMNS = new Set(['id', 'household_id']);

export type ServerFields = Record<string, string | number | boolean | null>;

/** Patch local (camelCase) → champs serveur (snake_case). Les clés inconnues et `undefined` sont ignorées. */
export function toServerFields(specs: ColumnSpec[], patch: Record<string, unknown>): ServerFields {
  const out: ServerFields = {};
  for (const spec of specs) {
    if (!(spec.key in patch) || IDENTITY_COLUMNS.has(spec.name)) continue;
    const v = patch[spec.key];
    if (v === undefined) continue;
    if (v === null) out[spec.name] = null;
    else if (spec.kind === 'timestamp') out[spec.name] = v instanceof Date ? v.getTime() : Number(v);
    else if (spec.kind === 'boolean') out[spec.name] = Boolean(v);
    else out[spec.name] = v as string | number;
  }
  return out;
}

/** Ligne serveur → valeurs locales (camelCase, Date). Les colonnes techniques (field_ts, server_seq) sont ignorées. */
export function fromServerRow(specs: ColumnSpec[], row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const spec of specs) {
    if (!(spec.name in row)) continue;
    const v = row[spec.name];
    if (v === null || v === undefined) out[spec.key] = null;
    else if (spec.kind === 'timestamp') out[spec.key] = new Date(Number(v));
    else if (spec.kind === 'boolean') out[spec.key] = Boolean(v);
    else out[spec.key] = v;
  }
  return out;
}

export interface OutboxEntry {
  seq: number;
  tableName: string;
  rowId: string;
  householdId: string;
  fields: ServerFields;
  ts: Record<string, number>;
}

export interface PushChange {
  id: string;
  household_id: string;
  fields: ServerFields;
  ts: Record<string, number>;
}

/**
 * Regroupe la file par table puis par ligne. Pour un même champ, la modification la plus récente
 * (horodatage, puis ordre d'insertion) l'emporte.
 */
export function coalesceOutbox(entries: OutboxEntry[]): Map<string, PushChange[]> {
  const byTable = new Map<string, Map<string, PushChange>>();
  for (const e of [...entries].sort((a, b) => a.seq - b.seq)) {
    let rows = byTable.get(e.tableName);
    if (!rows) byTable.set(e.tableName, (rows = new Map()));
    let change = rows.get(e.rowId);
    if (!change) rows.set(e.rowId, (change = { id: e.rowId, household_id: e.householdId, fields: {}, ts: {} }));
    for (const [k, v] of Object.entries(e.fields)) {
      const t = e.ts[k] ?? 0;
      if (t >= (change.ts[k] ?? 0)) {
        change.fields[k] = v;
        change.ts[k] = t;
      }
    }
  }
  const out = new Map<string, PushChange[]>();
  for (const [table, rows] of byTable) out.set(table, [...rows.values()]);
  return out;
}

/** Champs (noms serveur) encore en attente d'envoi, par `table:id`. */
export function pendingFields(entries: Pick<OutboxEntry, 'tableName' | 'rowId' | 'fields'>[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const e of entries) {
    const key = `${e.tableName}:${e.rowId}`;
    let set = out.get(key);
    if (!set) out.set(key, (set = new Set()));
    for (const k of Object.keys(e.fields)) set.add(k);
  }
  return out;
}

/** Retire d'une ligne reçue les champs qui ont une modification locale en attente (elle sera envoyée et arbitrée). */
export function withoutPending(specs: ColumnSpec[], local: Record<string, unknown>, pending: Set<string> | undefined): Record<string, unknown> {
  if (!pending?.size) return local;
  const out = { ...local };
  for (const spec of specs) if (pending.has(spec.name)) delete out[spec.key];
  return out;
}

/** Découpe une liste en paquets (envoi par lots). */
export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Code d'invitation saisi → forme canonique (« abcd 2345 » → « ABCD2345 »). */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Code d'invitation plausible (8 caractères de l'alphabet sans ambiguïté). */
export function isValidInviteCode(code: string): boolean {
  return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(code);
}

/** « ABCD2345 » → « ABCD 2345 » (lisible, à dicter). */
export function formatInviteCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}
