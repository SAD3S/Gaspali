import { LOCATION_LABELS } from '@/domain/categories';
import type { Item } from '@/domain/inventory';
import { formatQuantity } from '@/domain/quantity';

/** « 2 filets · Frigo », « Placard · entamé », « 2 filets · prévu ce soir » */
export function itemSubtitle(
  i: Pick<Item, 'quantity' | 'unit' | 'location' | 'openedAt'>,
  reservation?: { quantity: number; meals: string[] },
): string {
  const q = i.unit === 'pièce' && i.quantity === 1 ? '' : formatQuantity(i.quantity, i.unit);
  // Court pour tenir sur une ligne : un produit prévu pour un repas affiche le repas à la place de
  // l'emplacement ; le détail (quantité réservée) est sur la fiche produit.
  const planned = reservation?.meals.length
    ? `prévu ${reservation.meals[0]}${reservation.meals.length > 1 ? ` +${reservation.meals.length - 1}` : ''}`
    : '';
  return [q, planned ? '' : LOCATION_LABELS[i.location], i.openedAt ? 'entamé' : '', planned].filter(Boolean).join(' · ');
}
