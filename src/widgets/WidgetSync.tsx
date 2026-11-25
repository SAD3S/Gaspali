import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { shoppingQuery } from '@/db/shoppingRepo';
import { useInventory } from '@/features/inventory/hooks';
import { buildSnapshot, WIDGET_SNAPSHOT_KEY } from './snapshot';

/** Tient les widgets de l'écran d'accueil à jour (inventaire et courses, y compris venant du foyer). */
export function WidgetSync() {
  return Platform.OS === 'android' ? <AndroidWidgetSync /> : null;
}

function AndroidWidgetSync() {
  const items = useInventory();
  const { data: shopping } = useLiveQuery(shoppingQuery());

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const snapshot = buildSnapshot(items, shopping ?? []);
        const json = JSON.stringify(snapshot);
        if (json === (await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY))) return;
        await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, json);
        const { requestWidgetUpdate } = await import('react-native-android-widget');
        const { renderGaspalliWidget, SHOPPING_WIDGET, URGENT_WIDGET } = await import('./GaspalliWidgets');
        for (const widgetName of [URGENT_WIDGET, SHOPPING_WIDGET]) {
          await requestWidgetUpdate({ widgetName, renderWidget: () => renderGaspalliWidget(widgetName, snapshot) });
        }
      } catch {
        // un widget absent ou en erreur ne doit jamais gêner l'app
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [items, shopping]);

  return null;
}
