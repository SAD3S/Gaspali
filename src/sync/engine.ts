import { useSyncExternalStore } from 'react';
import { shoppingNews, type ShoppingNews, type ShoppingState } from '@/domain/householdNews';
import { chunk, coalesceOutbox, pendingFields } from '@/domain/sync';
import { sqlite } from '@/db/client';
import { frenchError, isNetworkError, supabase } from '@/services/supabase';
import { applyRemoteRows } from './apply';
import { getSyncContext } from './context';
import { deleteOutbox, getState, pendingCount, readOutbox, replaceMembers, setState } from './outbox';
import { SYNCED_TABLE_NAMES } from './tables';

export type SyncPhase = 'local' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  lastSyncAt: number | null;
  pending: number;
  error: string | null;
}

const PAGE = 500;

// ─── Nouvelles du foyer (liste de courses modifiée sur un autre téléphone) ───

type NewsListener = (news: ShoppingNews) => void;
const newsListeners = new Set<NewsListener>();

/** Abonnement aux changements de la liste de courses venus des autres membres. */
export function onHouseholdNews(listener: NewsListener): () => void {
  newsListeners.add(listener);
  return () => newsListeners.delete(listener);
}

function shoppingSnapshot(householdId: string): ShoppingState[] {
  return sqlite
    .getAllSync<{ id: string; name: string; checked: number; deleted_at: number | null; added_by: string | null }>(
      'SELECT id, name, checked, deleted_at, added_by FROM shopping_items WHERE household_id = ?',
      householdId,
    )
    .map((r) => ({ id: r.id, name: r.name, checked: !!r.checked, deleted: r.deleted_at != null, addedBy: r.added_by }));
}
let status: SyncStatus = { phase: 'local', lastSyncAt: null, pending: 0, error: null };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

export function refreshPendingCount(): void {
  setStatus({ pending: pendingCount() });
}

/** Envoie la file locale (par lots), puis la vide. */
async function push(): Promise<void> {
  if (!supabase) return;
  for (;;) {
    const entries = readOutbox(PAGE);
    if (!entries.length) return;
    const grouped = coalesceOutbox(entries);
    for (const name of SYNCED_TABLE_NAMES) {
      for (const batch of chunk(grouped.get(name) ?? [], 100)) {
        const { data, error } = await supabase.rpc('sync_push', { p_table: name, p_changes: batch });
        if (error) throw error;
        // Lignes refusées par le serveur (droits, contraintes) : on ne les renverra pas indéfiniment.
        const rejected = (data as { rejected?: string[] } | null)?.rejected ?? [];
        if (rejected.length) console.warn(`[synchro] ${rejected.length} ligne(s) refusée(s) dans ${name}`, rejected);
      }
    }
    deleteOutbox(entries.map((e) => e.seq));
    if (entries.length < PAGE) return;
  }
}

/** Récupère ce qui a changé côté serveur depuis le dernier curseur. */
async function pull(householdId: string): Promise<void> {
  if (!supabase) return;
  const pending = pendingFields(readOutbox(100_000));
  for (const name of SYNCED_TABLE_NAMES) {
    const key = `cursor:${householdId}:${name}`;
    let cursor = Number(getState(key) ?? 0);
    for (;;) {
      const { data, error } = await supabase
        .from(name)
        .select('*')
        .eq('household_id', householdId)
        .gt('server_seq', cursor)
        .order('server_seq')
        .limit(PAGE);
      if (error) throw error;
      const rows = (data ?? []) as Record<string, unknown>[];
      if (!rows.length) break;
      // Liste de courses : ce qui change ici vient forcément d'un autre téléphone (les modifications
      // locales sont déjà appliquées). Pas de nouvelles au tout premier chargement.
      const watch = name === 'shopping_items' && cursor > 0 && newsListeners.size > 0;
      const before = watch ? shoppingSnapshot(householdId) : null;
      applyRemoteRows(name, rows, pending);
      if (before) {
        const news = shoppingNews(before, shoppingSnapshot(householdId), getSyncContext().userId);
        if (news.added.length || news.finished) newsListeners.forEach((l) => l(news));
      }
      cursor = Number(rows[rows.length - 1]!.server_seq);
      setState(key, String(cursor));
      if (rows.length < PAGE) break;
    }
  }
}

async function pullMembers(householdId: string): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('household_members')
    .select('user_id, role, profiles(display_name)')
    .eq('household_id', householdId);
  if (error) throw error;
  type Row = { user_id: string; role: 'admin' | 'membre'; profiles: { display_name: string } | { display_name: string }[] | null };
  replaceMembers(
    householdId,
    ((data ?? []) as Row[]).map((m) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return { userId: m.user_id, role: m.role, displayName: p?.display_name ?? '' };
    }),
  );
}

async function runOnce(): Promise<void> {
  const { householdId, userId } = getSyncContext();
  if (!supabase || !householdId || !userId) {
    setStatus({ phase: 'local', pending: pendingCount(), error: null });
    return;
  }
  setStatus({ phase: 'syncing', pending: pendingCount() });
  try {
    await push();
    await pull(householdId);
    await pullMembers(householdId);
    const now = Date.now();
    setState(`last:${householdId}:sync`, String(now));
    setStatus({ phase: 'idle', lastSyncAt: now, pending: pendingCount(), error: null });
  } catch (e) {
    setStatus({ phase: isNetworkError(e) ? 'offline' : 'error', error: frenchError(e), pending: pendingCount() });
  }
}

let running: Promise<void> | null = null;
let again = false;

/** Synchronise maintenant (une seule synchro à la fois ; une demande pendant une synchro la relance). */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await runOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Planifie une synchro (regroupe les demandes rapprochées). */
export function scheduleSync(delayMs = 1500): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, delayMs);
}

export function lastSyncAt(householdId: string): number | null {
  const v = getState(`last:${householdId}:sync`);
  return v ? Number(v) : null;
}
