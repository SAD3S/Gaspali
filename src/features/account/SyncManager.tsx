import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/services/supabase';
import { onLocalChange } from '@/sync/context';
import { refreshPendingCount, scheduleSync } from '@/sync/engine';
import { SYNCED_TABLE_NAMES } from '@/sync/tables';
import { useAuth } from './AuthProvider';

/**
 * Déclenche la synchronisation :
 * - après chaque modification locale (regroupées sur 2 s),
 * - au retour au premier plan et au retour du réseau,
 * - quand un autre membre modifie quelque chose (Realtime).
 */
export function SyncManager() {
  const { session, active } = useAuth();
  const householdId = session && active ? active.id : null;

  useEffect(
    () =>
      onLocalChange(() => {
        refreshPendingCount();
        scheduleSync(2000);
      }),
    [],
  );

  useEffect(() => {
    if (!householdId) return;
    const appSub = AppState.addEventListener('change', (s) => s === 'active' && scheduleSync(0));
    let wasConnected = true;
    const unsubNet = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected && state.isInternetReachable !== false;
      if (connected && !wasConnected) scheduleSync(500);
      wasConnected = connected;
    });
    return () => {
      appSub.remove();
      unsubNet();
    };
  }, [householdId]);

  useEffect(() => {
    if (!supabase || !householdId) return;
    const channel = supabase.channel(`foyer-${householdId}`);
    for (const table of [...SYNCED_TABLE_NAMES, 'household_members']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` }, () =>
        scheduleSync(800),
      );
    }
    channel.subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [householdId]);

  return null;
}
