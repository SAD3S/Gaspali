import { router } from 'expo-router';
import { Calendar, Check, ChevronLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { EmptyState } from '@/components/brand/EmptyState';
import { Card, ProductAvatar, Screen, Text, useSnackbar } from '@/components/ui';
import { CalendarSheet } from '@/components/ui/CalendarSheet';
import { updateItem } from '@/db/inventoryRepo';
import { LOCATION_LABELS } from '@/domain/categories';
import { daysBetween, formatLongDate, relativeDayLabel } from '@/domain/dates';
import { computeFreshness } from '@/domain/freshness';
import { useInventory } from '@/features/inventory/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

/**
 * Dates estimées à vérifier : pour chaque produit ajouté sans sa vraie date, « Bonne date » ou
 * « Changer » (calendrier), d'un geste. Des dates justes = des alertes et des recettes justes.
 */
export default function Verifier() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const items = useInventory();
  const [editing, setEditing] = useState<{ id: string; name: string; date: Date } | null>(null);
  const list = useMemo(
    () => items.filter((i) => i.status === 'en_stock' && i.row.expiryEstimated).sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime()),
    [items],
  );
  const today = new Date();

  return (
    <Screen thread={8}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text variant="title1" accessibilityRole="header" style={styles.flex}>Dates à vérifier</Text>
      </View>

      {list.length === 0 ? (
        <EmptyState mood="joie" title="Toutes les dates sont vérifiées" text="Tes alertes et tes idées de recettes se basent sur les vraies dates." />
      ) : (
        <>
          <Text variant="body" tone="secondary">
            Ces dates ont été estimées selon le type de produit. Regarde l’emballage : un geste par produit, et les alertes seront justes.
          </Text>
          {list.map((i) => {
            const f = computeFreshness(i.expiresAt, i.dateType, today);
            return (
              <Card key={i.id} style={{ gap: 10 }}>
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/produit/[id]', params: { id: i.id } })} style={styles.row}>
                  <ProductAvatar name={i.name} state={f.state} size={44} imageUri={i.row.imageUrl ?? undefined} />
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={1}>{i.name}</Text>
                    <Text variant="label" tone="secondary">
                      {LOCATION_LABELS[i.location]} · ≈ {formatLongDate(i.expiresAt)} ({relativeDayLabel(daysBetween(today, i.expiresAt)).toLowerCase()})
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${i.name} : c’est la bonne date`}
                    onPress={() => {
                      updateItem(i.id, { expiryEstimated: false });
                      snackbar.show(`${i.name} : date confirmée`, () => updateItem(i.id, { expiryEstimated: true }));
                    }}
                    style={[styles.action, { backgroundColor: colors.primarySoft }]}
                  >
                    <Check size={18} color={colors.primaryText} />
                    <Text variant="label" tone="primary" style={styles.bold}>Bonne date</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${i.name} : changer la date`}
                    onPress={() => setEditing({ id: i.id, name: i.name, date: i.expiresAt })}
                    style={[styles.action, { backgroundColor: colors.surface2 }]}
                  >
                    <Calendar size={18} color={colors.text} />
                    <Text variant="label" style={styles.bold}>Changer</Text>
                  </Pressable>
                </View>
              </Card>
            );
          })}
        </>
      )}

      <CalendarSheet
        key={editing?.id ?? 'ferme'}
        visible={!!editing}
        value={editing?.date ?? today}
        title={editing ? `Date de ${editing.name}` : undefined}
        onClose={() => setEditing(null)}
        onConfirm={(d) => {
          if (editing) {
            updateItem(editing.id, { expiresAt: d, expiryEstimated: false });
            snackbar.show(`${editing.name} : jusqu’au ${formatLongDate(d)}`);
          }
          setEditing(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: 'DMSans_700Bold' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: MIN_TOUCH, borderRadius: 14 },
});
