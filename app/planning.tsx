import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { ArrowLeftRight, BookOpen, Check, ChevronLeft, ChevronRight, Plus, RefreshCw, ShoppingBasket, Sparkles, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet, Button, Card, Stepper, Text, useSnackbar } from '@/components/ui';
import { addMeal, removeMeal, restoreMeal, updateMeal } from '@/db/mealPlanRepo';
import { addShopping, shoppingQuery } from '@/db/shoppingRepo';
import { addDays } from '@/domain/dates';
import {
  dayKey,
  dayLabel,
  freeSlotsOfWeek,
  mealPhrase,
  missingForPlan,
  parseDayKey,
  planWeek,
  slotTime,
  SLOT_LABELS,
  SLOTS,
  startOfWeek,
  subtractShoppingList,
  weekDays,
  weekRangeLabel,
  type PlanEntry,
  type PlannedMeal,
  type Slot,
} from '@/domain/planner';
import { suggestionSummary } from '@/domain/recipeEngine';
import { roundForShopping } from '@/domain/units';
import { useMembers } from '@/features/account/hooks';
import { RecipePicker, SlotPicker } from '@/features/planning/pickers';
import { RecipeVisual } from '@/features/recipes/RecipeCard';
import { useAllRecipes, useEngineContext, usePlan, useRecipesById } from '@/features/recipes/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';

/** « Mercredi 25 · soir » */
function slotTitle(date: string, slot: Slot, today: Date): string {
  return `${dayLabel(parseDayKey(date), today)} · ${SLOT_LABELS[slot].toLowerCase()}`;
}

/** Planning des repas : semaine midi / soir, partagée dans le foyer. */
export default function Planning() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { height } = useWindowDimensions();
  const now = new Date();
  const plan = usePlan();
  const byId = useRecipesById();
  const recipes = useAllRecipes();
  const ctx = useEngineContext();
  const members = useMembers();
  const { data: shopping } = useLiveQuery(shoppingQuery());
  const defaultServings = Math.max(2, members.length);

  const [week, setWeek] = useState(0);
  const [picking, setPicking] = useState<{ date: string; slot: Slot; replacing?: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moving, setMoving] = useState<PlanEntry | null>(null);
  const [proposal, setProposal] = useState<{ meals: PlannedMeal[]; keep: boolean[] } | null>(null);

  const monday = addDays(startOfWeek(now), 7 * week);
  const days = weekDays(monday);
  const keys = new Set(days.map(dayKey));
  const weekEntries = plan.filter((e) => keys.has(e.date));
  const at = new Map(weekEntries.map((e) => [`${e.date}:${e.slot}`, e]));
  const free = freeSlotsOfWeek(monday, plan, now);
  const selected = plan.find((e) => e.id === selectedId) ?? null;

  const missing = useMemo(
    () => subtractShoppingList(missingForPlan(plan, byId, ctx, new Date(), (e) => keys.has(e.date)), shopping ?? []),
    [plan, byId, ctx, shopping, monday.getTime()], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const selectedMissing = useMemo(
    () => (selected ? missingForPlan(plan, byId, ctx, new Date(), (e) => e.id === selected.id) : []),
    [selected, plan, byId, ctx],
  );

  const weekTitle = week === 0 ? 'Cette semaine' : week === 1 ? 'Semaine prochaine' : week === -1 ? 'Semaine dernière' : `Semaine du ${monday.getDate()}`;

  const proposeWeek = () => {
    const meals = planWeek({ freeSlots: free, existing: plan, recipes, ctx, servings: defaultServings, now });
    if (!meals.length) {
      snackbar.show(ctx.items.length ? 'Aucune recette ne convient avec ce qu’il reste dans ton stock.' : 'Ton inventaire est vide : ajoute des produits pour planifier.');
      return;
    }
    setProposal({ meals, keep: meals.map(() => true) });
  };

  const addMissing = () => {
    const added = addShopping(missing.map((m) => ({ name: m.label, quantity: m.quantity != null ? roundForShopping(m.quantity, m.unit) : null, unit: m.unit, ingredientId: m.ingredientId }))).length;
    snackbar.show(added ? `${missing.length} article${missing.length > 1 ? 's' : ''} ajouté${missing.length > 1 ? 's' : ''} aux courses` : 'Quantités complétées dans ta liste de courses');
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text variant="title1" accessibilityRole="header" style={styles.flex}>Planning</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.weekNav}>
          <Pressable accessibilityRole="button" accessibilityLabel="Semaine précédente" onPress={() => setWeek((w) => w - 1)} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ChevronLeft size={20} color={colors.text} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`${weekTitle}, ${weekRangeLabel(monday)}. Revenir à cette semaine`} onPress={() => setWeek(0)} style={styles.weekLabel}>
            <Text variant="bodyStrong">{weekTitle}</Text>
            <Text variant="label" tone="secondary">{weekRangeLabel(monday)}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Semaine suivante" onPress={() => setWeek((w) => w + 1)} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ChevronRight size={20} color={colors.text} />
          </Pressable>
        </View>

        {free.length > 0 && (
          <Button
            size="lg"
            label="Planifier ma semaine anti-gaspi"
            icon={<Sparkles size={20} color={colors.onPrimary} />}
            onPress={proposeWeek}
            accessibilityHint={`Remplit les ${free.length} créneaux libres en commençant par les produits qui périment le plus tôt`}
          />
        )}

        {days.map((d) => {
          const key = dayKey(d);
          const isToday = key === dayKey(now);
          return (
            <Card key={key} style={[styles.day, isToday && { borderColor: colors.primary }]}>
              <Text variant="overline" tone={isToday ? 'primary' : 'secondary'} accessibilityRole="header">{dayLabel(d, now)}</Text>
              {SLOTS.map((slot, i) => {
                const entry = at.get(`${key}:${slot}`);
                const recipe = entry ? byId.get(entry.recipeId) : undefined;
                const past = slotTime(key, slot) <= now;
                return (
                  <View key={slot} style={[styles.slotRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                    <Text variant="label" tone="secondary" style={styles.slotName}>{SLOT_LABELS[slot]}</Text>
                    {entry ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${SLOT_LABELS[slot]} : ${recipe?.title ?? 'recette supprimée'}, ${entry.servings} personnes${entry.done ? ', cuisiné' : ''}`}
                        onPress={() => setSelectedId(entry.id)}
                        style={styles.meal}
                      >
                        {recipe && <RecipeVisual recipe={recipe} size={40} rounded={12} />}
                        <View style={styles.flex}>
                          <Text variant="bodyStrong" numberOfLines={1} style={entry.done && { color: colors.textSecondary }}>{recipe?.title ?? 'Recette supprimée'}</Text>
                          <Text variant="label" tone="secondary">
                            {entry.servings} pers.{recipe ? ` · ${recipe.minutes} min` : ''}{entry.done ? ' · cuisiné' : ''}
                          </Text>
                        </View>
                        {entry.done && <Check size={18} color={colors.primaryText} />}
                      </Pressable>
                    ) : past ? (
                      <Text variant="label" tone="secondary" style={styles.flex}>—</Text>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Ajouter un repas, ${dayLabel(d, now)} ${SLOT_LABELS[slot].toLowerCase()}`}
                        onPress={() => setPicking({ date: key, slot })}
                        style={[styles.empty, { borderColor: colors.border }]}
                      >
                        <Plus size={16} color={colors.textSecondary} />
                        <Text variant="label" tone="secondary">Ajouter un repas</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </Card>
          );
        })}

        {missing.length > 0 && (
          <Button
            label={`Ajouter ${missing.length} manquant${missing.length > 1 ? 's' : ''} aux courses`}
            accessibilityHint="Ingrédients qui manquent pour les repas de cette semaine"
            variant="soft"
            icon={<ShoppingBasket size={18} color={colors.primaryText} />}
            onPress={addMissing}
          />
        )}
        {weekEntries.length > 0 && missing.length === 0 && (
          <Text variant="label" tone="secondary" style={styles.center}>Tout ce qu’il faut pour cette semaine est dans ton stock ou ta liste de courses.</Text>
        )}
        <Text variant="label" tone="secondary" style={styles.center}>
          Les ingrédients des repas prévus sont réservés : ils ne sont plus proposés pour d’autres recettes.
        </Text>
      </ScrollView>

      {/* Actions sur un repas planifié */}
      <BottomSheet visible={!!selected} onClose={() => setSelectedId(null)}>
        {selected && (
          <View style={{ gap: 12 }}>
            <Text variant="label" tone="secondary">{slotTitle(selected.date, selected.slot, now)}{selected.done ? ' · cuisiné' : ''}</Text>
            <Text variant="title2">{byId.get(selected.recipeId)?.title ?? 'Recette supprimée'}</Text>
            <Text variant="body" tone="secondary">
              {selected.done
                ? 'Repas déjà cuisiné.'
                : selectedMissing.length
                  ? `Il manque : ${selectedMissing.map((m) => m.label).join(', ')}.`
                  : 'Tout est dans ton stock.'}
            </Text>
            <View style={styles.between}>
              <Text variant="body">Portions</Text>
              <Stepper label="portions" value={selected.servings} min={1} onChange={(v) => updateMeal(selected.id, { servings: v })} format={(v) => `${v} pers.`} />
            </View>
            {byId.has(selected.recipeId) && (
              <Button
                label="Voir la recette"
                icon={<BookOpen size={18} color={colors.onPrimary} />}
                onPress={() => {
                  setSelectedId(null);
                  router.push({ pathname: '/recettes/[id]', params: { id: selected.recipeId, plan: selected.id, portions: String(selected.servings) } });
                }}
              />
            )}
            <View style={styles.actions}>
              <Button
                label="Changer"
                variant="soft"
                style={styles.flex}
                icon={<RefreshCw size={18} color={colors.primaryText} />}
                onPress={() => {
                  setSelectedId(null);
                  setPicking({ date: selected.date, slot: selected.slot, replacing: selected.id });
                }}
              />
              <Button
                label="Déplacer"
                variant="soft"
                style={styles.flex}
                icon={<ArrowLeftRight size={18} color={colors.primaryText} />}
                onPress={() => {
                  setSelectedId(null);
                  setMoving(selected);
                }}
              />
            </View>
            {selected.done ? (
              <Button label="Ce n’est pas encore cuisiné" variant="outline" onPress={() => updateMeal(selected.id, { done: false })} />
            ) : null}
            <Button
              label="Retirer du planning"
              variant="outline"
              icon={<Trash2 size={18} color={colors.text} />}
              onPress={() => {
                const id = selected.id;
                removeMeal(id);
                setSelectedId(null);
                snackbar.show('Repas retiré du planning', () => restoreMeal(id));
              }}
            />
          </View>
        )}
      </BottomSheet>

      <RecipePicker
        visible={!!picking}
        title={picking ? slotTitle(picking.date, picking.slot, now) : ''}
        replacing={picking?.replacing}
        onClose={() => setPicking(null)}
        onPick={(recipe) => {
          if (!picking) return;
          if (picking.replacing) updateMeal(picking.replacing, { recipeId: recipe.id, done: false });
          else addMeal(picking.date, picking.slot, recipe.id, defaultServings);
          setPicking(null);
          snackbar.show(`${recipe.title} : ${mealPhrase(picking.date, picking.slot, now)}`);
        }}
      />

      <SlotPicker
        visible={!!moving}
        title="Déplacer vers…"
        entries={plan}
        current={moving ?? undefined}
        allowSwap
        onClose={() => setMoving(null)}
        onPick={(date, slot, occupant) => {
          if (!moving) return;
          if (occupant) updateMeal(occupant.id, { date: moving.date, slot: moving.slot });
          updateMeal(moving.id, { date, slot });
          setMoving(null);
          snackbar.show(occupant ? 'Repas échangés' : `Déplacé à ${mealPhrase(date, slot, now)}`);
        }}
      />

      {/* Proposition « Planifier ma semaine anti-gaspi » */}
      <BottomSheet visible={!!proposal} onClose={() => setProposal(null)}>
        {proposal && (
          <View style={{ gap: 12, maxHeight: height * 0.8 }}>
            <Text variant="title2">Ta semaine anti-gaspi</Text>
            <Text variant="label" tone="secondary">
              Les recettes qui sauvent les produits les plus urgents passent en premier. Décoche ce qui ne te tente pas.
            </Text>
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              {proposal.meals.map((m, i) => {
                const on = proposal.keep[i]!;
                return (
                  <Pressable
                    key={`${m.date}:${m.slot}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${slotTitle(m.date, m.slot, now)} : ${m.recipe.title}, ${suggestionSummary(m.suggestion)}`}
                    onPress={() => setProposal((p) => p && { ...p, keep: p.keep.map((k, j) => (j === i ? !k : k)) })}
                    style={[styles.proposal, { borderColor: on ? colors.primary : colors.border, backgroundColor: colors.surface }]}
                  >
                    <View style={[styles.box, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : 'transparent' }]}>
                      {on && <Check size={16} color={colors.onPrimary} />}
                    </View>
                    <View style={styles.flex}>
                      <Text variant="label" tone="secondary">{slotTitle(m.date, m.slot, now)}</Text>
                      <Text variant="bodyStrong" numberOfLines={1}>{m.recipe.title}</Text>
                      <Text variant="label" tone={m.suggestion.urgentUsed ? 'urgent' : 'secondary'} numberOfLines={1}>{suggestionSummary(m.suggestion)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text variant="label" tone="secondary">
              {defaultServings} personnes par repas, modifiable ensuite.
              {free.length > proposal.meals.length
                ? ` ${free.length - proposal.meals.length} créneau${free.length - proposal.meals.length > 1 ? 'x restent libres' : ' reste libre'} : pas assez de produits pour ${free.length - proposal.meals.length > 1 ? 'les' : 'le'} remplir sans courses.`
                : ''}
            </Text>
            <Button
              size="lg"
              label={`Ajouter ${proposal.keep.filter(Boolean).length} repas au planning`}
              disabled={!proposal.keep.some(Boolean)}
              onPress={() => {
                const kept = proposal.meals.filter((_, i) => proposal.keep[i]);
                const ids = kept.map((m) => addMeal(m.date, m.slot, m.recipe.id, defaultServings));
                setProposal(null);
                snackbar.show(`${ids.length} repas planifié${ids.length > 1 ? 's' : ''}`, () => ids.forEach(removeMeal));
              }}
            />
            <Button label="Annuler" variant="outline" onPress={() => setProposal(null)} />
          </View>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 4, gap: 12, paddingBottom: 60 },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weekLabel: { flex: 1, alignItems: 'center', minHeight: MIN_TOUCH, justifyContent: 'center' },
  day: { paddingVertical: 10, gap: 2 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  slotName: { width: 40 },
  meal: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56 },
  empty: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TOUCH, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.button, paddingHorizontal: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  proposal: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: radius.tile, padding: 12 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
