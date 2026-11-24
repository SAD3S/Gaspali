import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { BottomSheet, Text } from '@/components/ui';
import { addDays } from '@/domain/dates';
import { normalizeText } from '@/domain/inventory';
import { availableAfterReservations, computeReservations, dayKey, dayLabel, slotTime, SLOT_LABELS, SLOTS, type PlanEntry, type Slot } from '@/domain/planner';
import { suggestRecipes, type Recipe } from '@/domain/recipeEngine';
import { RecipeCard } from '@/features/recipes/RecipeCard';
import { useAllRecipes, useEngineContext, usePlan, useRecipeOrganization, useRecipesById } from '@/features/recipes/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';

/**
 * Choix d'une recette pour un créneau : classement anti-gaspi sur le stock qui n'est pas déjà
 * réservé par les autres repas (le repas qu'on remplace libère ses ingrédients).
 */
export function RecipePicker({
  visible,
  title,
  replacing,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  replacing?: string;
  onClose: () => void;
  onPick: (recipe: Recipe) => void;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const recipes = useAllRecipes();
  const ctx = useEngineContext();
  const plan = usePlan();
  const byId = useRecipesById();
  const org = useRecipeOrganization();
  const [query, setQuery] = useState('');

  const ranked = useMemo(() => {
    if (!visible) return [];
    const reservations = computeReservations(plan.filter((e) => e.id !== replacing), byId, ctx);
    return suggestRecipes(recipes, { ...ctx, items: availableAfterReservations(ctx.items, reservations) });
  }, [visible, plan, replacing, byId, ctx, recipes]);

  const q = normalizeText(query);
  const list = (q ? ranked.filter((s) => normalizeText(s.recipe.title).includes(q)) : ranked).slice(0, 40);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: 12, maxHeight: height * 0.75 }}>
        <Text variant="title2">{title}</Text>
        <View style={[styles.search, { backgroundColor: colors.surface2 }]}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Chercher une recette"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Chercher une recette"
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
        {!q && <Text variant="label" tone="secondary">Les premières utilisent les produits qui périment le plus tôt.</Text>}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10, paddingBottom: 8 }}>
          {list.map((s) => (
            <RecipeCard key={s.recipe.id} recipe={s.recipe} suggestion={s} favorite={org.favorites.has(s.recipe.id)} onPress={() => onPick(s.recipe)} />
          ))}
          {list.length === 0 && <Text variant="body" tone="secondary">Aucune recette ne correspond.</Text>}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

/**
 * Choix d'un créneau sur les 14 prochains jours. En mode « déplacer », toucher un créneau pris
 * échange les deux repas ; sinon les créneaux pris sont indisponibles.
 */
export function SlotPicker({
  visible,
  title,
  entries,
  current,
  allowSwap,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  entries: PlanEntry[];
  /** Repas qu'on déplace (son créneau est mis en évidence). */
  current?: PlanEntry;
  allowSwap?: boolean;
  onClose: () => void;
  onPick: (date: string, slot: Slot, occupant: PlanEntry | undefined) => void;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const byId = useRecipesById();
  const now = new Date();
  const days = Array.from({ length: 14 }, (_, i) => addDays(now, i));
  const at = new Map(entries.map((e) => [`${e.date}:${e.slot}`, e]));

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: 12, maxHeight: height * 0.75 }}>
        <Text variant="title2">{title}</Text>
        <ScrollView contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
          {days.map((d) => {
            const key = dayKey(d);
            return (
              <View key={key} style={styles.dayRow}>
                <Text variant="body" style={styles.dayName}>{dayLabel(d, now)}</Text>
                {SLOTS.map((slot) => {
                  const occupant = at.get(`${key}:${slot}`);
                  const isCurrent = !!current && occupant?.id === current.id;
                  const past = slotTime(key, slot) <= now;
                  const disabled = past || isCurrent || (!!occupant && !allowSwap);
                  const recipe = occupant ? byId.get(occupant.recipeId) : undefined;
                  const label = occupant ? (recipe?.title ?? 'Pris') : SLOT_LABELS[slot];
                  return (
                    <Pressable
                      key={slot}
                      accessibilityRole="button"
                      accessibilityState={{ disabled, selected: isCurrent }}
                      accessibilityLabel={`${dayLabel(d, now)} ${SLOT_LABELS[slot].toLowerCase()}${occupant ? `, ${recipe?.title ?? 'pris'}${allowSwap && !isCurrent ? ', échanger' : ''}` : ''}`}
                      disabled={disabled}
                      onPress={() => onPick(key, slot, occupant)}
                      style={[
                        styles.slot,
                        {
                          borderColor: isCurrent ? colors.primary : colors.border,
                          backgroundColor: isCurrent ? colors.primarySoft : occupant ? colors.surface2 : colors.surface,
                          opacity: past ? 0.4 : 1,
                        },
                      ]}
                    >
                      <Text variant="label" tone={occupant ? 'secondary' : 'default'} numberOfLines={1}>
                        {occupant ? `${SLOT_LABELS[slot]} · ${label}` : label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
        {allowSwap && <Text variant="label" tone="secondary">Choisis un créneau pris pour échanger les deux repas.</Text>}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.button, paddingHorizontal: 12, minHeight: MIN_TOUCH },
  searchInput: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 16, minHeight: MIN_TOUCH },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayName: { width: 104 },
  slot: { flex: 1, minHeight: MIN_TOUCH, borderWidth: 1, borderRadius: radius.button, paddingHorizontal: 10, justifyContent: 'center' },
});
