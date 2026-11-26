import { Snowflake } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Pepin } from '@/components/brand/Pepin';
import { Button, Text, useSnackbar } from '@/components/ui';
import { freezeItem } from '@/db/inventoryRepo';
import { formatDuration, freezeCandidates, type Item } from '@/domain/inventory';
import { dayKey } from '@/domain/planner';
import { updateSettings, useSettings } from '@/features/settings/settings';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * « Congèle-le ! » : Pépin propose de passer au congélateur un produit qui arrive à sa date.
 * Un seul à la fois ; « Plus tard » le laisse tranquille jusqu'au lendemain.
 */
export function FreezeTip({ items, compact = false }: { items: Item[]; compact?: boolean }) {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { freezeDismissed } = useSettings();
  const today = dayKey(new Date());
  const candidate = freezeCandidates(items).find((c) => freezeDismissed[c.item.id] !== today);
  if (!candidate) return null;
  const { item, days, daysLeft } = candidate;
  const when = daysLeft === 0 ? 'aujourd’hui' : daysLeft === 1 ? 'demain' : `dans ${daysLeft} jours`;

  return (
    <View style={[styles.tip, { backgroundColor: colors.primarySoft }]} accessibilityRole="summary">
      <View style={styles.top}>
        {!compact && <Pepin size={44} mood="clin" />}
        <View style={styles.body}>
          <Text variant="bodyStrong" tone="primary">Congèle-le !</Text>
          <Text variant="body">
            {item.name} périme {when}. Au congélateur, il tiendra encore {formatDuration(days)}.
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label="Congeler"
          style={styles.flex}
          icon={<Snowflake size={18} color={colors.onPrimary} />}
          onPress={() => {
            const undo = freezeItem(item.id);
            snackbar.show(`${item.name} au congélateur : bon ${formatDuration(days)}`, undo);
          }}
        />
        <Button
          label="Plus tard"
          variant="outline"
          style={styles.flex}
          onPress={() => {
            // On ne garde que les refus du jour.
            const kept = Object.fromEntries(Object.entries(freezeDismissed).filter(([, d]) => d === today));
            updateSettings({ freezeDismissed: { ...kept, [item.id]: today } });
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tip: { gap: 10, borderRadius: 18, padding: 12 },
  top: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  body: { flex: 1, gap: 6 },
  actions: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
