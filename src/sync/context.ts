/**
 * Contexte de synchronisation : foyer actif et utilisateur connecté.
 * Renseigné par AuthProvider ; lu par les dépôts (household_id, auteur) et par le moteur de synchro.
 */
export interface SyncContext {
  householdId: string | null;
  userId: string | null;
}

let ctx: SyncContext = { householdId: null, userId: null };
const changeListeners = new Set<() => void>();

export function setSyncContext(next: SyncContext): void {
  ctx = next;
}

export function getSyncContext(): SyncContext {
  return ctx;
}

/** Appelé après chaque écriture locale mise en file (le moteur planifie un envoi). */
export function onLocalChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function notifyLocalChange(): void {
  changeListeners.forEach((l) => l());
}
