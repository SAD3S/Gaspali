import { LOCATION_LABELS } from '@/domain/categories';
import type { Item } from '@/domain/inventory';
import { formatQuantity } from '@/domain/quantity';

/** « 2 filets · Frigo », « Placard · entamé » */
export function itemSubtitle(i: Pick<Item, 'quantity' | 'unit' | 'location' | 'openedAt'>): string {
  const q = i.unit === 'pièce' && i.quantity === 1 ? '' : formatQuantity(i.quantity, i.unit);
  return [q, LOCATION_LABELS[i.location], i.openedAt ? 'entamé' : ''].filter(Boolean).join(' · ');
}
