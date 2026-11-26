import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ArrowLeftRight, BookOpen, Check, ChevronLeft, ChevronRight, Lightbulb, Move, NotebookPen, Plus, RefreshCw, ShoppingBasket, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { BottomSheet, Button, Card, Stepper, Text, useSnackbar } from '@/components/ui';
import { addMeal, removeMeal, restoreMeal, updateMeal } from '@/db/mealPlanRepo';
import { addShopping, shoppingQuery } from '@/db/shoppingRepo';
import { addDays } from '@/domain/dates';
import {
  dayKey,
  dayLabel,
  freeSlotsOfWeek,
  mealPhrase,
  mealsBySlot,
  missingForPlan,
  noteMeal,
  noteText,
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
  type Slot,
} from '@/domain/planner';
import { suggestionSummary, type Recipe } from '@/domain/recipeEngine';
import { roundForShopping } from '@/domain/units';
import { useMembers } from '@/features/account/hooks';
import { RecipeVisual } from '@/features/recipes/RecipeCard';
import { useAllRecipes, useEngineContext, usePlan, useRecipesById } from '@/features/recipes/hooks';
import { updateSettings, useSettings } from '@/features/settings/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';
import { RecipePicker } from './pickers';

/** « Mercredi 25 · soir » */
function slotTitle(date: string, slot: Slot, today: Date): string {
  return `${dayLabel(parseDayKey(date), today)} · ${SLOT_LABELS[slot].toLowerCase()}`;
}

/**
 * La semaine des repas, libre : chaque créneau (midi, soir) peut contenir plusieurs plats ou un repas
 * sans recette ; « + » pour chercher la recette qu'on veut ; appui long sur un plat pour le déplacer,
 * puis toucher l'endroit voulu. Les créneaux libres montrent une idée anti-gaspi à accepter en un geste.
 */
export function WeekPlanner() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const now = new Date();
  const plan = usePlan();
  const byId = useRecipesById();
  const recipes = useAllRecipes();
  const ctx = useEngineContext();
  const members = useMembers();
  const { planIdeas } = useSettings();
  const { data: shopping } = useLiveQuery(shoppingQuery());
  const servings = Math.max(2, members.length);

  const [week, setWeek] = useState(0);
  const [picking, setPicking] = useState<{ date: string; slot: Slot; replacing?: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moving, setMoving] = useState<PlanEntry | null>(null);

  const monday = addDays(startOfWeek(now), 7 * week);
  // Semaine en cours : on commence à aujourd'hui (les jours passés sans repas n'apportent rien).
  const allDays = weekDays(monday);
  const keys = new Set(allDays.map(dayKey));
  const weekEntries = plan.filter((e) => keys.has(e.date));
  const bySlot = mealsBySlot(weekEntries);
  const todayKey = dayKey(now);
  const days = allDays.filter((d) => dayKey(d) >= todayKey || SLOTS.some((sl) => bySlot.has(`${dayKey(d)}:${sl}`)));
  const selected = plan.find((e) => e.id === selectedId) ?? null;
  const titleOf = (e: PlanEntry) => byId.get(e.recipeId)?.title ?? noteText(e.recipeId) ?? 'Recette supprimée';

  // Idées anti-gaspi pour les créneaux libres (recalculées quand le planning ou le stock change).
  const ideas = useMemo(() => {
    if (!planIdeas) return new Map<string, { recipe: Recipe; summary: string }>();
    const meals = planWeek({ freeSlots: freeSlotsOfWeek(monday, plan, now), existing: plan, recipes, ctx, servings, now });
    return new Map(meals.map((m) => [`${m.date}:${m.slot}`, { recipe: m.recipe, summary: suggestionSummary(m.suggestion) }]));
  }, [planIdeas, plan, recipes, ctx, servings, monday.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  const missing = useMemo(
    () => subtractShoppingList(missingForPlan(plan, byId, ctx, new Date(), (e) => keys.has(e.date)), shopping ?? []),
    [plan, byId, ctx, shopping, monday.getTime()], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const selectedMissing = useMemo(
    () => (selected ? missingForPlan(plan, byId, ctx, new Date(), (e) => e.id === selected.id) : []),
    [selected, plan, byId, ctx],
  );

  const weekTitle = week === 0 ? 'Cette semaine' : week === 1 ? 'Semaine prochaine' : week === -1 ? 'Semaine dernière' : `Semaine du ${monday.getDate()}`;

  const add = (date: string, slot: Slot, recipeId: string, label: string) => {
    const id = addMeal(date, slot, recipeId, servings);
    snackbar.show(`${label} : ${mealPhrase(date, slot, now)}`, () => removeMeal(id));
  };

  const drop = (date: string, slot: Slot) => {
    if (!moving) return;
    const from = { date: moving.date, slot: moving.slot };
    updateMeal(moving.id, { date, slot });
    const id = moving.id;
    setMoving(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    snackbar.show(`${titleOf(moving)} : ${mealPhrase(date, slot, now)}`, () => updateMeal(id, from));
  };

  const acceptAll = () => {
    const ids = [...ideas].map(([k, idea]) => {
      const [date, slot] = k.split(':') as [string, Slot];
      return addMeal(date, slot, idea.recipe.id, servings);
    });
    snackbar.show(`${ids.length} idée${ids.length > 1 ? 's' : ''} ajoutée${ids.length > 1 ? 's' : ''}`, () => ids.forEach(removeMeal));
  };

  const addMissing = () => {
    const added = addShopping(missing.map((m) => ({ name: m.label, quantity: m.quantity != null ? roundForShopping(m.quantity, m.unit) : null, unit: m.unit, ingredientId: m.ingredientId }))).length;
    snackbar.show(added ? `${missing.length} article${missing.length > 1 ? 's' : ''} ajouté${missing.length > 1 ? 's' : ''} aux courses` : 'Quantités complétées dans ta liste de courses');
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

        {moving ? (
          <View style={[styles.banner, { backgroundColor: colors.primary }]}>
            <Move size={18} color={colors.onPrimary} />
            <Text variant="bodyStrong" color={colors.onPrimary} style={styles.flex}>Touche l’endroit où mettre « {titleOf(moving)} »</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Annuler le déplacement" onPress={() => setMoving(null)} hitSlop={8}>
              <X size={20} color={colors.onPrimary} />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.ideasRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Lightbulb size={18} color={colors.primaryText} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">Idées anti-gaspi</Text>
              {planIdeas && ideas.size > 1 ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Ajouter les ${ideas.size} idées au planning`} onPress={acceptAll} hitSlop={6} style={styles.acceptAll}>
                  <Text variant="label" tone="primary" style={styles.bold}>Tout ajouter ({ideas.size})</Text>
                </Pressable>
              ) : (
                <Text variant="label" tone="secondary">{planIdeas ? 'Proposées dans les créneaux libres' : 'Masquées'}</Text>
              )}
            </View>
            <Switch
              value={planIdeas}
              onValueChange={(v) => updateSettings({ planIdeas: v })}
              accessibilityLabel="Afficher des idées anti-gaspi"
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={colors.surface}
            />
          </View>
        )}

        {days.map((d) => {
          const key = dayKey(d);
          const isToday = key === dayKey(now);
          return (
            <Card key={key} style={[styles.day, isToday && { borderColor: colors.primary }]}>
              <Text variant="overline" tone={isToday ? 'primary' : 'secondary'} accessibilityRole="header">{dayLabel(d, now)}</Text>
              {SLOTS.map((slot, i) => {
                const meals = bySlot.get(`${key}:${slot}`) ?? [];
                const past = slotTime(key, slot) <= now;
                const idea = !meals.length && !past ? ideas.get(`${key}:${slot}`) : undefined;
                const dropTarget = !!moving && !past && !(meals.length === 1 && meals[0]!.id === moving.id);
                // Zone touchable seulement pendant un déplacement (sinon ses plats seraient vus comme désactivés).
                const Row = dropTarget ? Pressable : View;
                return (
                  <Row
                    key={slot}
                    {...(dropTarget
                      ? { onPress: () => drop(key, slot), accessibilityRole: 'button' as const, accessibilityLabel: `Mettre ici : ${dayLabel(d, now)} ${SLOT_LABELS[slot].toLowerCase()}` }
                      : {})}
                    style={[
                      styles.slotRow,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                      dropTarget && { backgroundColor: colors.primarySoft, borderRadius: 12 },
                    ]}
                  >
                    <Text variant="label" tone="secondary" style={styles.slotName}>{SLOT_LABELS[slot]}</Text>
                    <View style={styles.slotBody}>
                      {meals.map((entry) => {
                        const recipe = byId.get(entry.recipeId);
                        const note = noteText(entry.recipeId);
                        const isMoving = moving?.id === entry.id;
                        // Pendant un déplacement, c'est le créneau entier qui se touche.
                        const Meal = moving ? View : Pressable;
                        return (
                          <Meal
                            key={entry.id}
                            {...(moving
                              ? {}
                              : {
                                  accessibilityRole: 'button' as const,
                                  accessibilityLabel: `${titleOf(entry)}, ${entry.servings} personnes${entry.done ? ', cuisiné' : ''}. Appui long pour déplacer`,
                                  onPress: () => setSelectedId(entry.id),
                                  onLongPress: () => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                                    setMoving(entry);
                                  },
                                  delayLongPress: 350,
                                })}
                            style={[styles.meal, isMoving && { opacity: 0.45 }]}
                          >
                            {recipe ? (
                              <RecipeVisual recipe={recipe} size={40} rounded={12} />
                            ) : (
                              <View style={[styles.noteIcon, { backgroundColor: colors.surface2 }]}>
                                <NotebookPen size={18} color={colors.textSecondary} />
                              </View>
                            )}
                            <View style={styles.flex}>
                              <Text variant="bodyStrong" numberOfLines={1} style={entry.done && { color: colors.textSecondary }}>{titleOf(entry)}</Text>
                              <Text variant="label" tone="secondary">
                                {note ? 'Sans recette' : `${entry.servings} pers.${recipe ? ` · ${recipe.minutes} min` : ''}`}{entry.done ? ' · cuisiné' : ''}
                              </Text>
                            </View>
                            {entry.done && <Check size={18} color={colors.primaryText} />}
                          </Meal>
                        );
                      })}

                      {idea && !moving && (
                        <View style={[styles.idea, { borderColor: colors.primary, backgroundColor: colors.surface }]}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Idée : ${idea.recipe.title}, ${idea.summary}. Toucher pour choisir autre chose`}
                            onPress={() => setPicking({ date: key, slot })}
                            style={[styles.flex, styles.ideaBody]}
                          >
                            <RecipeVisual recipe={idea.recipe} size={36} rounded={10} />
                            <View style={styles.flex}>
                              <Text variant="label" tone="primary" style={styles.bold}>Idée</Text>
                              <Text variant="body" numberOfLines={1}>{idea.recipe.title}</Text>
                              <Text variant="label" tone="secondary" numberOfLines={1}>{idea.summary}</Text>
                            </View>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Accepter l’idée ${idea.recipe.title}`}
                            onPress={() => add(key, slot, idea.recipe.id, idea.recipe.title)}
                            style={[styles.ideaAdd, { backgroundColor: colors.primary }]}
                          >
                            <Check size={18} color={colors.onPrimary} />
                          </Pressable>
                        </View>
                      )}

                      {!past && !moving && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${meals.length ? 'Ajouter un plat' : 'Choisir un repas'}, ${dayLabel(d, now)} ${SLOT_LABELS[slot].toLowerCase()}`}
                          onPress={() => setPicking({ date: key, slot })}
                          style={[meals.length ? styles.addSmall : styles.empty, { borderColor: colors.border }]}
                        >
                          <Plus size={16} color={colors.textSecondary} />
                          <Text variant="label" tone="secondary">{meals.length ? 'Ajouter un plat' : idea ? 'Choisir autre chose' : 'Choisir un repas'}</Text>
                        </Pressable>
                      )}
                      {past && !meals.length && <Text variant="label" tone="secondary">—</Text>}
                    </View>
                  </Row>
                );
              })}
            </Card>
          );
        })}

        {missing.length > 0 && !moving && (
          <Button
            label={`Ajouter ${missing.length} manquant${missing.length > 1 ? 's' : ''} aux courses`}
            accessibilityHint="Ingrédients qui manquent pour les repas de cette semaine"
            variant="soft"
            icon={<ShoppingBasket size={18} color={colors.primaryText} />}
            onPress={addMissing}
          />
        )}
        <Text variant="label" tone="secondary" style={styles.center}>
          Appui long sur un plat pour le déplacer. Les ingrédients des repas prévus sont réservés : ils ne sont plus proposés ailleurs.
        </Text>
      </ScrollView>

      {/* Actions sur un plat planifié */}
      <BottomSheet visible={!!selected} onClose={() => setSelectedId(null)}>
        {selected && (
          <View style={{ gap: 12 }}>
            <Text variant="label" tone="secondary">{slotTitle(selected.date, selected.slot, now)}{selected.done ? ' · cuisiné' : ''}</Text>
            <Text variant="title2">{titleOf(selected)}</Text>
            {byId.has(selected.recipeId) && (
              <>
                <Text variant="body" tone="secondary">
                  {selected.done ? 'Repas déjà cuisiné.' : selectedMissing.length ? `Il manque : ${selectedMissing.map((m) => m.label).join(', ')}.` : 'Tout est dans ton stock.'}
                </Text>
                <View style={styles.between}>
                  <Text variant="body">Portions</Text>
                  <Stepper label="portions" value={selected.servings} min={1} onChange={(v) => updateMeal(selected.id, { servings: v })} format={(v) => `${v} pers.`} />
                </View>
                <Button
                  label="Voir la recette"
                  icon={<BookOpen size={18} color={colors.onPrimary} />}
                  onPress={() => {
                    setSelectedId(null);
                    router.push({ pathname: '/recettes/[id]', params: { id: selected.recipeId, plan: selected.id, portions: String(selected.servings) } });
                  }}
                />
              </>
            )}
            <View style={styles.actions}>
              <Button
                label="Remplacer"
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
            {byId.has(selected.recipeId) && (
              <Button
                label={selected.done ? 'Ce n’est pas encore cuisiné' : 'C’est cuisiné'}
                variant="outline"
                icon={selected.done ? undefined : <Check size={18} color={colors.text} />}
                onPress={() => updateMeal(selected.id, { done: !selected.done })}
              />
            )}
            <Button
              label="Retirer du planning"
              variant="outline"
              icon={<Trash2 size={18} color={colors.text} />}
              onPress={() => {
                const id = selected.id;
                removeMeal(id);
                setSelectedId(null);
                snackbar.show('Retiré du planning', () => restoreMeal(id));
              }}
            />
          </View>
        )}
      </BottomSheet>

      <RecipePicker
        visible={!!picking}
        title={picking ? (picking.replacing ? `Remplacer · ${slotTitle(picking.date, picking.slot, now)}` : slotTitle(picking.date, picking.slot, now)) : ''}
        replacing={picking?.replacing}
        onClose={() => setPicking(null)}
        onPick={(recipe) => {
          if (!picking) return;
          if (picking.replacing) {
            updateMeal(picking.replacing, { recipeId: recipe.id, done: false });
            snackbar.show(`Remplacé par ${recipe.title}`);
          } else add(picking.date, picking.slot, recipe.id, recipe.title);
          setPicking(null);
        }}
        onPickNote={(text) => {
          if (!picking) return;
          if (picking.replacing) updateMeal(picking.replacing, { recipeId: noteMeal(text), done: false });
          else add(picking.date, picking.slot, noteMeal(text), text);
          setPicking(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: 'DMSans_700Bold' },
  center: { textAlign: 'center' },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 4, gap: 12, paddingBottom: 120 },
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weekLabel: { flex: 1, alignItems: 'center', minHeight: MIN_TOUCH, justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 14, minHeight: 52 },
  ideasRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  acceptAll: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  day: { paddingVertical: 10, gap: 2 },
  slotRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  slotName: { width: 40, marginTop: 14 },
  slotBody: { flex: 1, gap: 6 },
  meal: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  noteIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  idea: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.button, padding: 8, opacity: 0.92 },
  ideaBody: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ideaAdd: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: MIN_TOUCH, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.button, paddingHorizontal: 12 },
  addSmall: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, alignSelf: 'flex-start', paddingHorizontal: 4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
});
