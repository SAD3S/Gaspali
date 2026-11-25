import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { planNotifications } from '@/domain/notifications';
import { suggestRecipes } from '@/domain/recipeEngine';
import { useAllRecipes, useHouseholdPrefs } from '@/features/recipes/hooks';
import { useInventory } from '@/features/inventory/hooks';
import { useSettings } from '@/features/settings/settings';
import { getPermission, notificationsSupported, reschedule } from '@/services/notifications';

/**
 * Tient les notifications programmées à jour : à chaque changement de l'inventaire
 * (y compris venant d'un autre membre du foyer) ou des réglages, le plan des 7 prochains jours
 * est recalculé. Au toucher d'une notification, ouvre l'écran des alertes.
 */
export function NotificationManager() {
  // Pas de module natif sur le web : rien à gérer.
  return notificationsSupported ? <NativeNotificationManager /> : null;
}

function NativeNotificationManager() {
  const items = useInventory();
  const { notifications, loaded, basics, equipment } = useSettings();
  const recipes = useAllRecipes();
  const { members } = useHouseholdPrefs();
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      try {
        if ((await getPermission()) !== 'granted') return;
        const basicsSet = new Set(basics);
        // Recette du jour : la mieux classée pour ce jour-là, si elle sauve un produit urgent.
        const hint = (day: Date) => {
          const top = suggestRecipes(recipes, { items, basics: basicsSet, members, today: day, equipment: new Set(equipment) })[0];
          return top && top.urgentUsed > 0 ? top.recipe.title : null;
        };
        await reschedule(planNotifications(items, notifications, new Date(), 7, hint));
      } catch {
        // une erreur de programmation ne doit jamais bloquer l'app
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [items, notifications, loaded, basics, recipes, members, equipment]);

  useEffect(() => {
    const url = lastResponse?.notification.request.content.data?.url;
    if (typeof url === 'string' && lastResponse?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      router.push(url as Href);
    }
  }, [lastResponse]);

  return null;
}
