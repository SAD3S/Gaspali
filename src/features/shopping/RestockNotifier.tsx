import { and, eq, isNull } from 'drizzle-orm';
import { useEffect } from 'react';
import { useSnackbar } from '@/components/ui';
import { db } from '@/db/client';
import { shoppingItems } from '@/db/schema';
import { onRestock } from './restock';

/**
 * Affiche « Lait ajouté aux courses » quand un produit habituel terminé est remis sur la liste,
 * après le message « consommé / Annuler » — et seulement si l'action n'a pas été annulée entre-temps.
 */
export function RestockNotifier() {
  const snackbar = useSnackbar();
  useEffect(
    () =>
      onRestock((name, id) =>
        setTimeout(() => {
          const still = db.select({ id: shoppingItems.id }).from(shoppingItems).where(and(eq(shoppingItems.id, id), isNull(shoppingItems.deletedAt))).get();
          if (still) snackbar.show(`${name} ajouté aux courses (produit habituel)`);
        }, 5200),
      ),
    [snackbar],
  );
  return null;
}
