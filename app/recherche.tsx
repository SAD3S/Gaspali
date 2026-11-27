import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { ChevronLeft, Search, ShoppingCart } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/brand/EmptyState';
import { ThreadBackground } from '@/components/brand/ThreadBackground';
import { Card, ProductCard, Text } from '@/components/ui';
import { shoppingQuery } from '@/db/shoppingRepo';
import { LOCATION_LABELS } from '@/domain/categories';
import { queryInventory } from '@/domain/inventory';
import { formatQuantity } from '@/domain/quantity';
import { searchList } from '@/domain/search';
import { useInventory } from '@/features/inventory/hooks';
import { RecipeCard } from '@/features/recipes/RecipeCard';
import { useAllRecipes, useRecipeOrganization } from '@/features/recipes/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

/** Recherche dans toute l'app : produits en stock, recettes (titre ou ingrédient), liste de courses. */
export default function Recherche() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const items = useInventory();
  const recipes = useAllRecipes();
  const org = useRecipeOrganization();
  const { data: shopping } = useLiveQuery(shoppingQuery());

  const q = query.trim();
  const found = useMemo(() => {
    if (q.length < 2) return null;
    return {
      products: searchList(queryInventory(items), q, (r) => [r.item.name, r.item.row.brand, r.item.category], 6),
      recipes: searchList(recipes, q, (r) => [r.title, r.tags.join(' '), r.ingredients.map((i) => i.name ?? i.ingredientId ?? '').join(' ')], 6),
      shopping: searchList((shopping ?? []).filter((s) => !s.checked), q, (s) => [s.name], 6),
    };
  }, [q, items, recipes, shopping]);
  const total = found ? found.products.length + found.recipes.length + found.shopping.length : 0;

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ThreadBackground variant={9} />
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Produit, recette, article…"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Rechercher dans Gaspalli"
            returnKeyType="search"
            style={[styles.input, { color: colors.text }]}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!found ? (
          <Text variant="body" tone="secondary">Tape au moins deux lettres : je cherche dans ton stock, les recettes et la liste de courses.</Text>
        ) : total === 0 ? (
          <EmptyState mood="oups" size={90} title="Rien trouvé" text={`Aucun produit, recette ou article pour « ${q} ».`} />
        ) : (
          <>
            {found.products.length > 0 && (
              <View style={styles.section}>
                <Text variant="overline" tone="secondary" accessibilityRole="header">Dans ton stock</Text>
                {found.products.map(({ item, freshness: f }) => (
                  <ProductCard
                    key={item.id}
                    variant="row"
                    name={item.name}
                    imageUri={item.row.imageUrl ?? undefined}
                    subtitle={`${formatQuantity(item.quantity, item.unit)} · ${LOCATION_LABELS[item.location]}`}
                    state={f.state}
                    badgeLabel={item.row.expiryEstimated ? `≈ ${f.label}` : f.label}
                    onPress={() => router.push({ pathname: '/produit/[id]', params: { id: item.id } })}
                  />
                ))}
              </View>
            )}
            {found.recipes.length > 0 && (
              <View style={styles.section}>
                <Text variant="overline" tone="secondary" accessibilityRole="header">Recettes</Text>
                {found.recipes.map((r) => (
                  <RecipeCard key={r.id} recipe={r} favorite={org.favorites.has(r.id)} onPress={() => router.push({ pathname: '/recettes/[id]', params: { id: r.id } })} />
                ))}
              </View>
            )}
            {found.shopping.length > 0 && (
              <View style={styles.section}>
                <Text variant="overline" tone="secondary" accessibilityRole="header">Sur la liste de courses</Text>
                <Card style={{ paddingVertical: 4 }}>
                  {found.shopping.map((s, i) => (
                    <Pressable
                      key={s.id}
                      accessibilityRole="button"
                      onPress={() => router.navigate('/courses')}
                      style={[styles.shopRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                    >
                      <ShoppingCart size={18} color={colors.textSecondary} />
                      <Text variant="body" style={styles.flex}>{s.name}</Text>
                      {s.quantity != null && <Text variant="label" tone="secondary">{formatQuantity(s.quantity, s.unit ?? '')}</Text>}
                    </Pressable>
                  ))}
                </Card>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderRadius: 16, paddingHorizontal: 12, minHeight: 50 },
  input: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 16, minHeight: MIN_TOUCH },
  content: { padding: 20, paddingTop: 8, gap: 18, paddingBottom: 60 },
  section: { gap: 8 },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
});
