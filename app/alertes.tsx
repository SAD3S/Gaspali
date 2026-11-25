import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ProductCard, Screen, Text } from '@/components/ui';
import { queryInventory } from '@/domain/inventory';
import { itemSubtitle } from '@/features/inventory/format';
import { useInventory } from '@/features/inventory/hooks';
import { EmptyState } from '@/components/brand/EmptyState';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

/** Alertes : produits périmés, à consommer aujourd'hui / demain, à vérifier (DDM dépassée). */
export default function Alertes() {
  const { colors } = useTheme();
  const items = useInventory();
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
              subtitle={itemSubtitle(item)}
              state={freshness.state}
              badgeLabel={freshness.label}
              onPress={() => router.push({ pathname: '/produit/[id]', params: { id: item.id } })}
            />
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  center: { textAlign: 'center' },
});
