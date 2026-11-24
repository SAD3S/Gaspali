import { CakeSlice, ChefHat, Cookie, Croissant, Heart, Salad, Soup, UtensilsCrossed, type LucideIcon } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import type { RecipeKind } from '@/data/recipes';
import { suggestionSummary, type Recipe, type Suggestion } from '@/domain/recipeEngine';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

export const KIND_LABELS: Record<RecipeKind, string> = {
  plat: 'Plat',
  entree: 'Entrée',
  soupe: 'Soupe',
  salade: 'Salade',
  dessert: 'Dessert',
  'petit-dejeuner': 'Petit-déj',
  gouter: 'Goûter',
};

const KIND_ICONS: Record<RecipeKind, LucideIcon> = {
  plat: UtensilsCrossed,
  entree: ChefHat,
  soupe: Soup,
  salade: Salad,
  dessert: CakeSlice,
  'petit-dejeuner': Croissant,
  gouter: Cookie,
};

/** Photo de la recette, ou pictogramme du type de plat sur fond doux. */
export function RecipeVisual({ recipe, size = 64, rounded = 18 }: { recipe: Recipe; size?: number | '100%'; rounded?: number }) {
  const { colors } = useTheme();
  const Icon = KIND_ICONS[recipe.kind] ?? UtensilsCrossed;
  const box = { width: size, height: size === '100%' ? 180 : size, borderRadius: rounded } as const;
  if (recipe.photoUri) return <Image source={{ uri: recipe.photoUri }} style={box} accessibilityIgnoresInvertColors />;
  return (
    <View style={[box, styles.visual, { backgroundColor: colors.primarySoft }]} importantForAccessibility="no-hide-descendants">
      <Icon size={size === '100%' ? 56 : 28} color={colors.primaryText} strokeWidth={1.6} />
    </View>
  );
}

interface Props {
  suggestion?: Suggestion;
  recipe: Recipe;
  favorite: boolean;
  onPress: () => void;
}

export function RecipeCard({ suggestion, recipe, favorite, onPress }: Props) {
  const { colors, freshness } = useTheme();
  const urgent = suggestion?.urgentUsed ?? 0;
  const summary = suggestion ? suggestionSummary(suggestion) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}, ${recipe.minutes} minutes${summary ? `, ${summary}` : ''}${favorite ? ', favori' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <RecipeVisual recipe={recipe} />
      <View style={styles.texts}>
        <Text variant="bodyStrong" numberOfLines={2}>{recipe.title}</Text>
        <Text variant="label" tone="secondary">
          {recipe.minutes} min · {recipe.servings} pers.{recipe.source !== 'base' ? ' · Ma recette' : ''}
        </Text>
        {summary && (
          <Text variant="label" color={urgent ? freshness.urgent.fg : colors.textSecondary} numberOfLines={1} style={urgent ? styles.bold : undefined}>
            {summary}
          </Text>
        )}
      </View>
      {favorite && <Heart size={18} color={colors.urgent} fill={colors.urgent} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: radius.tile, padding: 10 },
  texts: { flex: 1, gap: 2 },
  visual: { alignItems: 'center', justifyContent: 'center' },
  bold: { fontFamily: 'DMSans_700Bold' },
});
