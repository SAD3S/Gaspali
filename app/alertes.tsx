import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ProductCard, Screen, Text } from '@/components/ui';
import { expiryForecast, queryInventory } from '@/domain/inventory';
import { WeekStrip } from '@/features/inventory/WeekStrip';
import { computeFreshness } from '@/domain/freshness';
import { formatLongDate } from '@/domain/dates';
import { itemSubtitle } from '@/features/inventory/format';
import { useInventory } from '@/features/inventory/hooks';
import { EmptyState } from '@/components/brand/EmptyState';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

/** Alertes : produits périmés, à consommer aujourd'hui / demain, à vérifier (DDM dépassée). */
export default function Alertes() {
  const { colors } = useTheme();
  const items = useInventory();
  const { jour } = useLocalSearchParams<{ jour?: string }>();
  const [day, setDay] = useState<string | null>(jour ?? null);
  const forecast = useMemo(() => expiryForecast(items), [items]);
  const selected = forecast.find((d) => d.key === day) ?? null;
  const groups = useMemo(() => {
    const all = queryInventory(items);
    return [
      { key: 'perime', title: 'Périmés (DLC dépassée)', hint: 'Mieux vaut ne pas les consommer.', list: all.filter((r) => r.freshness.state === 'perime') },
      { key: 'urgent', title: 'À consommer d’ici demain', hint: null, list: all.filter((r) => r.freshness.state === 'urgent' && r.freshness.daysLeft <= 1) },
      { key: 'bientot', title: 'Dans les prochains jours', hint: null, list: all.filter((r) => (r.freshness.state === 'urgent' && r.freshness.daysLeft > 1) || r.freshness.state === 'bientot') },
      { key: 'a_verifier', title: 'À vérifier (DDM dépassée)', hint: 'Souvent encore bons : regarde, sens, goûte.', list: all.filter((r) => r.freshness.state === 'a_verifier') },
    ].filter((g) => g.list.length);
  }, [items]);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text variant="title1" accessibilityRole="header">Alertes</Text>
      </View>

      <WeekStrip days={forecast} selected={day} onSelect={(k) => setDay(day === k ? null : k)} />

      {selected ? (
        <View style={{ gap: 10 }}>
          <View style={styles.header}>
            <Text variant="overline" tone="secondary" accessibilityRole="header" style={{ flex: 1 }}>
              {selected.short === 'Auj.' ? 'Aujourd’hui (et déjà dépassés)' : selected.short === 'Dem.' ? 'Demain' : formatLongDate(selected.date)} · {selected.items.length}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setDay(null)} hitSlop={8}>
              <Text variant="label" tone="primary" style={{ fontFamily: 'DMSans_700Bold' }}>Tout voir</Text>
            </Pressable>
          </View>
          {selected.items.length === 0 ? (
            <EmptyState mood="joie" size={90} title="Rien ce jour-là" />
          ) : (
            selected.items.map((item) => {
              const f = computeFreshness(item.expiresAt, item.dateType);
              return (
                <ProductCard
                  key={item.id}
                  name={item.name}
                  imageUri={item.row.imageUrl ?? undefined}
                  subtitle={itemSubtitle(item)}
                  state={f.state}
                  badgeLabel={item.row.expiryEstimated ? `≈ ${f.label}` : f.label}
                  onPress={() => router.push({ pathname: '/produit/[id]', params: { id: item.id } })}
                />
              );
            })
          )}
        </View>
      ) : (
        <>
      {groups.length === 0 && (
        <EmptyState mood="joie" title="Rien d’urgent" text="Aucun produit à consommer dans les 5 prochains jours. Bravo !" />
      )}

      {groups.map((g) => (
        <View key={g.key} style={{ gap: 10 }}>
          <Text variant="overline" tone="secondary" accessibilityRole="header">{g.title} · {g.list.length}</Text>
          {g.hint && <Text variant="label" tone="secondary">{g.hint}</Text>}
          {g.list.map(({ item, freshness }) => (
            <ProductCard
              key={item.id}
              name={item.name}
              imageUri={item.row.imageUrl ?? undefined}
              subtitle={itemSubtitle(item)}
              state={freshness.state}
              badgeLabel={freshness.label}
              onPress={() => router.push({ pathname: '/produit/[id]', params: { id: item.id } })}
            />
          ))}
        </View>
      ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  center: { textAlign: 'center' },
});
