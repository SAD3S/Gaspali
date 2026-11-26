import { useEffect } from 'react';
import { newsMessage } from '@/domain/householdNews';
import { useMembers } from '@/features/account/hooks';
import { getSettings } from '@/features/settings/settings';
import { notifyNow } from '@/services/notifications';
import { onHouseholdNews } from '@/sync/engine';

/**
 * Prévient quand l'autre personne du foyer ajoute des articles aux courses, ou termine la liste.
 * Fonctionne tant que l'app tourne (au premier plan ou en arrière-plan récent) ; réglable dans Réglages.
 */
export function HouseholdNotifier() {
  const members = useMembers();

  useEffect(
    () =>
      onHouseholdNews((news) => {
        if (!getSettings().householdAlerts) return;
        for (const n of news.added) {
          const author = members.find((m) => m.userId === n.by)?.displayName ?? null;
          const { title, body } = newsMessage(n, author);
          void notifyNow(title, body, '/courses').catch(() => {});
        }
        if (news.finished) void notifyNow('Les courses sont faites', 'Toute la liste a été cochée. Pense à ranger les produits dans l’inventaire.', '/courses').catch(() => {});
      }),
    [members],
  );

  return null;
}
