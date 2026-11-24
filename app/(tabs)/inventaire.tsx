import { Search, SlidersHorizontal } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Chip, ProductCard, Screen, Text } from '@/components/ui';
import { demoItems, subtitleOf, type Location } from '@/data/demo';
import { computeFreshness, urgencyRank } from '@/domain/freshness';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';

type Filter = 'tout' | Location;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'tout', label: 'Tout' },
  { key: 'frigo', label: 'Frigo' },
  { key: 'congelo', label: 'Congélo' },
  { key: 'placard', label: 'Placard' },
];

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Inventaire() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<Filter>('tout');
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const today = new Date();
    const q = normalize(query.trim());
    return demoItems
      .filter((i) => filter === 'tout' || i.location === filter)
      .filter((i) => !q || normalize(i.name).includes(q))
      .map((i) => ({ item: i, f: computeFreshness(i.expiry, i.dateType, today) }))
      .sort((a, b) => urgencyRank(a.f) - urgencyRank(b.f));
  }, [filter, query]);

  return (
    <Screen>
      <View style={styles.head}>
        <Text variant="title1" accessibilityRole="header">Inventaire</Text>
        <Text variant="label" tone="secondary">{demoItems.length} produits</Text>
      </View>

      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Search size={20} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un produit"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Rechercher un produit"
          style={[styles.input, { color: colors.text }]}
        />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </View>

      <View style={styles.sortRow}>
        <Text variant="overline" tone="secondary">Trié par date limite</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Changer le tri" style={[styles.sortBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SlidersHorizontal size={18} color={colors.text} />
        </Pressable>
      </View>

      {items.map(({ item, f }) => (
        <ProductCard key={item.id} name={item.name} initials={item.initials} subtitle={subtitleOf(item)} state={f.state} badgeLabel={f.label} />
      ))}
      {items.length === 0 && (
        <Text variant="body" tone="secondary" style={{ textAlign: 'center', marginTop: 24 }}>Aucun produit ne correspond.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 50 },
  input: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 16, minHeight: MIN_TOUCH },
  filters: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sortBtn: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.button, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
