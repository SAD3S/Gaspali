import { router, useLocalSearchParams } from 'expo-router';
import { Plus, Search, SlidersHorizontal, Check } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet, Button, Chip, Text, useSnackbar } from '@/components/ui';
import { setStatus } from '@/db/inventoryRepo';
import { queryInventory, SORT_LABELS, type LocationFilter, type SortKey } from '@/domain/inventory';
import { itemSubtitle } from '@/features/inventory/format';
import { useInventory } from '@/features/inventory/hooks';
import { useReservations } from '@/features/recipes/hooks';
import { SwipeableItem } from '@/features/inventory/SwipeableItem';
import { ThreadBackground } from '@/components/brand/ThreadBackground';
import { finishMessage } from '@/domain/prices';
import { EmptyState } from '@/components/brand/EmptyState';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';

const FILTERS: { key: LocationFilter; label: string }[] = [
  { key: 'tout', label: 'Tout' },
  { key: 'frigo', label: 'Frigo' },
  { key: 'congelo', label: 'Congélo' },
  { key: 'placard', label: 'Placard' },
];

export default function Inventaire() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const items = useInventory();
  const reservations = useReservations();
  const { lieu } = useLocalSearchParams<{ lieu?: string }>();
  const [filter, setFilter] = useState<LocationFilter>('tout');
  // Tuiles Frigo / Congélo / Placard de l'accueil : ouvre l'inventaire déjà filtré.
  useEffect(() => {
    if (lieu === 'frigo' || lieu === 'congelo' || lieu === 'placard' || lieu === 'tout') setFilter(lieu);
  }, [lieu]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('date');
  const [sortOpen, setSortOpen] = useState(false);

  const list = useMemo(() => queryInventory(items, { location: filter, search: query, sort }), [items, filter, query, sort]);

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.head}>
        <Text variant="title1" accessibilityRole="header">Inventaire</Text>
        <Text variant="label" tone="secondary">{items.length} produit{items.length > 1 ? 's' : ''}</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un produit"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Rechercher un produit"
            returnKeyType="search"
            style={[styles.input, { color: colors.text }]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ajouter un produit sans code-barres"
          onPress={() => router.push('/ajout')}
          style={[styles.squareBtn, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft, height: 50, width: 50 }]}
        >
          <Plus size={22} color={colors.primaryText} />
        </Pressable>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </View>

      <View style={styles.sortRow}>
        <Text variant="overline" tone="secondary">Trié par {SORT_LABELS[sort]}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Changer le tri, actuellement par ${SORT_LABELS[sort]}`}
          onPress={() => setSortOpen(true)}
          style={[styles.squareBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <SlidersHorizontal size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ThreadBackground variant={2} />
      <FlatList
        data={list}
        keyExtractor={(r) => r.item.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item: { item, freshness } }) => (
          <SwipeableItem
            name={item.name}
            imageUri={item.row.imageUrl ?? undefined}
            subtitle={itemSubtitle(item, reservations.get(item.id))}
            state={freshness.state}
            badgeLabel={item.row.expiryEstimated ? `≈ ${freshness.label}` : freshness.label}
            onPress={() => router.push({ pathname: '/produit/[id]', params: { id: item.id } })}
            onConsumed={() => snackbar.show(finishMessage(item.name, 'consomme', item.row), setStatus(item.id, 'consomme'))}
            onDiscarded={() => snackbar.show(finishMessage(item.name, 'jete', item.row), setStatus(item.id, 'jete'))}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            {items.length === 0 ? (
              <EmptyState title="Ton inventaire est vide" text="Scanne tes courses ou ajoute un produit frais : je te dirai quoi finir en premier.">
                <Button label="Ajouter un produit" variant="soft" onPress={() => router.push('/ajout')} />
              </EmptyState>
            ) : (
              <EmptyState mood="oups" size={90} title="Aucun produit ne correspond" />
            )}
          </View>
        }
        ListFooterComponent={
          list.length > 0 ? (
            <Text variant="label" tone="secondary" style={[styles.center, { marginTop: 16 }]}>
              Glisse une carte vers la droite si tu l’as consommée, vers la gauche si tu l’as jetée.
            </Text>
          ) : undefined
        }
      />

      <BottomSheet visible={sortOpen} onClose={() => setSortOpen(false)}>
        <Text variant="title2" style={{ marginBottom: 8 }}>Trier par</Text>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ checked: sort === k }}
            onPress={() => {
              setSort(k);
              setSortOpen(false);
            }}
            style={styles.sortOption}
          >
            <Text variant="body" style={sort === k && { fontFamily: 'DMSans_700Bold' }}>
              {SORT_LABELS[k].charAt(0).toUpperCase() + SORT_LABELS[k].slice(1)}
            </Text>
            {sort === k && <Check size={20} color={colors.primaryText} />}
          </Pressable>
        ))}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 140 },
  headerBlock: { gap: 14, marginBottom: 14 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  searchRow: { flexDirection: 'row', gap: 10 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 50 },
  input: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 16, minHeight: MIN_TOUCH },
  filters: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  squareBtn: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.button, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, marginTop: 40 },
  center: { textAlign: 'center' },
  sortOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52 },
});
