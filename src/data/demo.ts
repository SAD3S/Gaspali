import { addDays } from '@/domain/dates';
import type { DateType } from '@/domain/freshness';

/** Données de démonstration de l'étape 1 (remplacées par SQLite à l'étape 2). */
export type Location = 'frigo' | 'congelo' | 'placard';

export interface DemoItem {
  id: string;
  name: string;
  initials?: string;
  quantity: string;
  location: Location;
  dateType: DateType;
  expiry: Date;
  opened?: boolean;
}

export const LOCATION_LABELS: Record<Location, string> = { frigo: 'Frigo', congelo: 'Congélo', placard: 'Placard' };

const t = new Date();

export const demoItems: DemoItem[] = [
  { id: '1', name: 'Biscottes complètes', initials: 'Bi', quantity: '', location: 'placard', dateType: 'DDM', expiry: addDays(t, -20), opened: true },
  { id: '2', name: 'Blanc de poulet', initials: 'Po', quantity: '2 filets', location: 'frigo', dateType: 'DLC', expiry: addDays(t, 0) },
  { id: '3', name: 'Crème fraîche', initials: 'Cr', quantity: '20 cl', location: 'frigo', dateType: 'DLC', expiry: addDays(t, 1) },
  { id: '4', name: 'Épinards frais', initials: 'Ép', quantity: '300 g', location: 'frigo', dateType: 'DLC', expiry: addDays(t, 3) },
  { id: '5', name: 'Yaourts nature', initials: 'Yo', quantity: '4 pots', location: 'frigo', dateType: 'DLC', expiry: addDays(t, 9) },
  { id: '6', name: 'Comté 18 mois', initials: 'Co', quantity: '250 g', location: 'frigo', dateType: 'DLC', expiry: addDays(t, 12) },
  { id: '7', name: 'Petits pois', initials: 'Pp', quantity: '1 sachet', location: 'congelo', dateType: 'DDM', expiry: addDays(t, 120) },
  { id: '8', name: 'Pâtes penne', initials: 'Pâ', quantity: '500 g', location: 'placard', dateType: 'DDM', expiry: addDays(t, 300) },
];

export function subtitleOf(i: DemoItem): string {
  const parts = [i.quantity, LOCATION_LABELS[i.location]].filter(Boolean);
  if (i.opened) parts.push('entamé');
  return parts.join(' · ');
}
