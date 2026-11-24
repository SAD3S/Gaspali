import type { DateType } from './freshness';

export type Location = 'frigo' | 'congelo' | 'placard';

export const LOCATION_LABELS: Record<Location, string> = { frigo: 'Frigo', congelo: 'Congélo', placard: 'Placard' };
export const LOCATIONS: Location[] = ['frigo', 'congelo', 'placard'];

export type CategoryId =
  | 'viande' | 'poisson' | 'laitier' | 'fromage' | 'oeufs' | 'fruits' | 'legumes'
  | 'boulangerie' | 'traiteur' | 'restes' | 'surgeles' | 'epicerie_salee'
  | 'epicerie_sucree' | 'conserves' | 'boissons' | 'condiments' | 'autre';

export interface Category {
  id: CategoryId;
  label: string;
  /** Emplacement proposé par défaut. */
  location: Location;
  /** Type de date proposé par défaut. */
  dateType: DateType;
  /** Durée de conservation par défaut (jours) dans l'emplacement par défaut. */
  shelfDays: number;
  /** Durée une fois ouvert (jours), si elle raccourcit la date. */
  openedDays?: number;
  /** Durée au congélateur (jours) ; absent = ne se congèle pas bien. */
  freezerDays?: number;
  /** Rayon pour la liste de courses. */
  aisle: string;
}

const M = 30;

export const CATEGORIES: Record<CategoryId, Category> = {
  viande: { id: 'viande', label: 'Viande', location: 'frigo', dateType: 'DLC', shelfDays: 3, openedDays: 2, freezerDays: 4 * M, aisle: 'Boucherie' },
  poisson: { id: 'poisson', label: 'Poisson', location: 'frigo', dateType: 'DLC', shelfDays: 2, openedDays: 1, freezerDays: 3 * M, aisle: 'Poissonnerie' },
  laitier: { id: 'laitier', label: 'Produits laitiers', location: 'frigo', dateType: 'DLC', shelfDays: 14, openedDays: 3, freezerDays: 2 * M, aisle: 'Crèmerie' },
  fromage: { id: 'fromage', label: 'Fromage', location: 'frigo', dateType: 'DLC', shelfDays: 21, openedDays: 10, freezerDays: 3 * M, aisle: 'Crèmerie' },
  oeufs: { id: 'oeufs', label: 'Œufs', location: 'frigo', dateType: 'DDM', shelfDays: 28, aisle: 'Crèmerie' },
  fruits: { id: 'fruits', label: 'Fruits', location: 'placard', dateType: 'DDM', shelfDays: 5, freezerDays: 8 * M, aisle: 'Fruits et légumes' },
  legumes: { id: 'legumes', label: 'Légumes', location: 'frigo', dateType: 'DDM', shelfDays: 6, freezerDays: 8 * M, aisle: 'Fruits et légumes' },
  boulangerie: { id: 'boulangerie', label: 'Boulangerie', location: 'placard', dateType: 'DDM', shelfDays: 3, freezerDays: 2 * M, aisle: 'Boulangerie' },
  traiteur: { id: 'traiteur', label: 'Traiteur', location: 'frigo', dateType: 'DLC', shelfDays: 4, openedDays: 2, freezerDays: 2 * M, aisle: 'Traiteur' },
  restes: { id: 'restes', label: 'Restes maison', location: 'frigo', dateType: 'DLC', shelfDays: 3, freezerDays: 3 * M, aisle: 'Autre' },
  surgeles: { id: 'surgeles', label: 'Surgelés', location: 'congelo', dateType: 'DDM', shelfDays: 6 * M, aisle: 'Surgelés' },
  epicerie_salee: { id: 'epicerie_salee', label: 'Épicerie salée', location: 'placard', dateType: 'DDM', shelfDays: 12 * M, openedDays: 3 * M, aisle: 'Épicerie' },
  epicerie_sucree: { id: 'epicerie_sucree', label: 'Épicerie sucrée', location: 'placard', dateType: 'DDM', shelfDays: 9 * M, openedDays: 2 * M, aisle: 'Épicerie' },
  conserves: { id: 'conserves', label: 'Conserves', location: 'placard', dateType: 'DDM', shelfDays: 24 * M, openedDays: 3, aisle: 'Épicerie' },
  boissons: { id: 'boissons', label: 'Boissons', location: 'placard', dateType: 'DDM', shelfDays: 9 * M, openedDays: 4, aisle: 'Boissons' },
  condiments: { id: 'condiments', label: 'Sauces et condiments', location: 'placard', dateType: 'DDM', shelfDays: 12 * M, openedDays: 2 * M, aisle: 'Épicerie' },
  autre: { id: 'autre', label: 'Autre', location: 'frigo', dateType: 'DLC', shelfDays: 7, aisle: 'Autre' },
};

export const CATEGORY_LIST: Category[] = Object.values(CATEGORIES);

export function getCategory(id: string | null | undefined): Category {
  return (id && CATEGORIES[id as CategoryId]) || CATEGORIES.autre;
}

/** Durée de conservation par défaut selon l'emplacement choisi. */
export function defaultShelfDays(categoryId: string, location: Location): number {
  const c = getCategory(categoryId);
  if (location === 'congelo') return c.freezerDays ?? c.shelfDays;
  return c.shelfDays;
}
