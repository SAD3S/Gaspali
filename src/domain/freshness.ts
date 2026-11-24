import type { FreshnessState } from '@/theme/tokens';
import { daysBetween, relativeDayLabel } from './dates';

export type DateType = 'DLC' | 'DDM';

/** Seuils de l'échelle de fraîcheur (en jours restants). */
export const FRESHNESS_THRESHOLDS = { urgentMax: 2, soonMax: 5 } as const;

export interface Freshness {
  state: FreshnessState;
  daysLeft: number;
  /** Libellé du badge : « Aujourd'hui », « Dans 3 j », « À vérifier »… */
  label: string;
  /** Peut être proposé dans une recette (jamais un produit dont la DLC est dépassée). */
  usableInRecipes: boolean;
}

/**
 * Seule source de vérité du statut de fraîcheur.
 * - DLC dépassée → Périmé
 * - DDM dépassée → À vérifier (souvent encore bon)
 * - 0 à 2 j → Urgent, 3 à 5 j → Bientôt, plus de 5 j → Frais
 */
export function computeFreshness(expiry: Date, dateType: DateType, today: Date = new Date()): Freshness {
  const daysLeft = daysBetween(today, expiry);

  if (daysLeft < 0) {
    if (dateType === 'DLC') {
      return { state: 'perime', daysLeft, label: relativeDayLabel(daysLeft), usableInRecipes: false };
    }
    return { state: 'a_verifier', daysLeft, label: 'À vérifier', usableInRecipes: true };
  }

  const state: FreshnessState =
    daysLeft <= FRESHNESS_THRESHOLDS.urgentMax ? 'urgent'
    : daysLeft <= FRESHNESS_THRESHOLDS.soonMax ? 'bientot'
    : 'frais';

  return { state, daysLeft, label: relativeDayLabel(daysLeft), usableInRecipes: true };
}

/** Ordre de tri « par date limite » : le plus pressant d'abord. */
export function urgencyRank(f: Freshness): number {
  // Les produits à vérifier / périmés remontent en tête, puis par jours restants.
  if (f.state === 'perime') return -2000 + f.daysLeft;
  if (f.state === 'a_verifier') return -1000 + f.daysLeft;
  return f.daysLeft;
}
