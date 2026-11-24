import { normalizeText } from './inventory';

/** Achats considérés : les « ajout » de l'historique. */
export interface PurchaseEvent {
  type: string;
  productName: string;
  createdAt: Date;
  deletedAt?: Date | null;
}

export const HABIT_WINDOW_DAYS = 60;
export const HABIT_MIN_PURCHASES = 2;

/** Clé de regroupement d'un produit (« Lait demi-écrémé » et « lait demi écrémé » = même produit). */
export function productKey(name: string): string {
  return normalizeText(name).replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Produit habituel : acheté au moins 2 fois sur les 60 derniers jours.
 * Quand le dernier exemplaire est terminé, on le propose sur la liste de courses.
 */
export function isHabitual(name: string, purchases: PurchaseEvent[], now: Date = new Date()): boolean {
  const key = productKey(name);
  const since = now.getTime() - HABIT_WINDOW_DAYS * 86_400_000;
  const count = purchases.filter(
    (e) => e.type === 'ajout' && !e.deletedAt && e.createdAt.getTime() >= since && productKey(e.productName) === key,
  ).length;
  return count >= HABIT_MIN_PURCHASES;
}
