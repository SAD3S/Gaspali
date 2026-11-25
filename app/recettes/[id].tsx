import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, CalendarPlus, Check, ChefHat, ChevronLeft, Clock, ExternalLink, FolderPlus, Heart, Pencil, ShoppingBasket } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet, Button, Card, Chip, Stepper, Text, useSnackbar } from '@/components/ui';
import { ALLERGEN_LABELS } from '@/data/allergens';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { consumePart } from '@/db/inventoryRepo';
import { addMeal, updateMeal } from '@/db/mealPlanRepo';
import { setFavorite, setInFolder } from '@/db/recipesRepo';
import { addShopping, shoppingQuery } from '@/db/shoppingRepo';
import { mealPhrase, subtractShoppingList } from '@/domain/planner';
import {
  cookProposals,
  DIET_LABELS,
  evaluateRecipe,
  missingIngredients,
  recipeAllergens,
  recipeTags,
  type CookProposal,
} from '@/domain/recipeEngine';
import { formatNumber, formatQuantity, stepFor } from '@/domain/quantity';
import { roundForShopping } from '@/domain/units';
import { useInventory } from '@/features/inventory/hooks';
import { IngredientChecks } from '@/features/recipes/IngredientChecks';
import { KIND_LABELS, RecipeVisual } from '@/features/recipes/RecipeCard';
import { useMembers } from '@/features/account/hooks';
import { SlotPicker } from '@/features/planning/pickers';
import { useHouseholdPrefs, usePlan, useRecipe, useRecipeOrganization } from '@/features/recipes/hooks';
import { useSettings } from '@/features/settings/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

export default function RecetteFiche() {
  const { id, plan: planId, portions } = useLocalSearchParams<{ id: string; plan?: string; portions?: string }>();
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const recipe = useRecipe(id);
  const items = useInventory();
  const { basics } = useSettings();
  const { members } = useHouseholdPrefs();
  const org = useRecipeOrganization();
  const plan = usePlan();
  const householdSize = useMembers().length;
  const { data: shopping } = useLiveQuery(shoppingQuery());
  // Ouverte depuis le planning : portions du repas prévu, et le repas passe en « cuisiné ».
  const meal = planId ? plan.find((e) => e.id === planId) : undefined;
  const [servings, setServings] = useState<number | null>(portions ? Number(portions) || null : null);
  const [scheduling, setScheduling] = useState(false);
  const [cooking, setCooking] = useState<CookProposal[] | null>(null);
  const [foldersOpen, setFoldersOpen] = useState(false);

  // Évaluation sans le filtre allergènes (on veut afficher la fiche et prévenir).
  const evaluation = useMemo(
    () => (recipe ? evaluateRecipe(recipe, { items, basics: new Set(basics), members: members.map((m) => ({ ...m, allergens: [] })) }) : null),
    [recipe, items, basics, members],
  );

  if (!recipe || !evaluation) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background, padding: 20, gap: 12 }]}>
        <Text variant="body">Cette recette n’existe plus.</Text>
        <Button label="Retour" variant="outline" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const n = servings ?? recipe.servings;
  const ratio = n / recipe.servings;
  const favorite = org.favorites.has(recipe.id);
  const householdAllergens = new Set(members.flatMap((m) => m.allergens));
  const allergenConflicts = recipeAllergens(recipe).filter((a) => householdAllergens.has(a));
  const missing = subtractShoppingList(missingIngredients(evaluation, n), shopping ?? []);
  const basicsSet = new Set(basics);

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex} />
        {recipe.source !== 'base' && (
          <Pressable accessibilityRole="button" accessibilityLabel="Modifier la recette" onPress={() => router.push({ pathname: '/recettes/editer', params: { id: recipe.id } })} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pencil size={20} color={colors.text} />
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="Ranger dans un dossier" onPress={() => setFoldersOpen(true)} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <FolderPlus size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: favorite }}
          accessibilityLabel="Favori"
          onPress={() => setFavorite(recipe.id, !favorite)}
          style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Heart size={20} color={favorite ? colors.urgent : colors.text} fill={favorite ? colors.urgent : 'transparent'} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <RecipeVisual recipe={recipe} size="100%" rounded={24} />
        <Text variant="title1" accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36 }}>{recipe.title}</Text>
        <View style={styles.meta}>
          <Clock size={16} color={colors.textSecondary} />
          <Text variant="label" tone="secondary">{recipe.minutes} min · {KIND_LABELS[recipe.kind]} · {DIET_LABELS[evaluation.diet]}</Text>
        </View>
        <View style={styles.wrap}>
          {recipeTags(recipe).map((t) => (
            <View key={t} style={[styles.tag, { backgroundColor: colors.surface2 }]}>
              <Text variant="label" tone="secondary">#{t}</Text>
            </View>
          ))}
        </View>

        {recipe.sourceUrl && (
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(recipe.sourceUrl!)} hitSlop={8} style={styles.source}>
            <ExternalLink size={16} color={colors.primaryText} />
            <Text variant="label" tone="primary" style={styles.bold} numberOfLines={1}>
              Recette de {(() => {
                try {
                  return new URL(recipe.sourceUrl).hostname.replace(/^www\./, '');
                } catch {
                  return 'la page d’origine';
                }
              })()}
            </Text>
          </Pressable>
        )}

        {meal && (
          <View style={[styles.planned, { backgroundColor: colors.primarySoft }]}>
            <CalendarDays size={18} color={colors.primaryText} />
            <Text variant="label" tone="primary" style={styles.bold}>
              Prévu {mealPhrase(meal.date, meal.slot)} · {meal.servings} pers.{meal.done ? ' · cuisiné' : ''}
            </Text>
          </View>
        )}

        {allergenConflicts.length > 0 && (
          <Card style={{ borderColor: colors.urgent, gap: 4 }}>
            <Text variant="bodyStrong" tone="urgent">Contient un allergène déclaré</Text>
            <Text variant="body" tone="secondary">{allergenConflicts.map((a) => ALLERGEN_LABELS[a]).join(', ')} : cette recette n’est pas proposée à ton foyer.</Text>
          </Card>
        )}
        {(evaluation.dietConflicts.length > 0 || evaluation.dislikes.length > 0) && (
          <Card style={{ gap: 4 }}>
            {evaluation.dietConflicts.length > 0 && (
              <Text variant="body" tone="secondary">Ne convient pas au régime de : {evaluation.dietConflicts.join(', ')}.</Text>
            )}
            {evaluation.dislikes.length > 0 && <Text variant="body" tone="secondary">Pas aimé dans le foyer : {evaluation.dislikes.join(', ')}.</Text>}
          </Card>
        )}

        <View style={styles.between}>
          <Text variant="title2">Ingrédients</Text>
          <Stepper label="portions" value={n} min={1} onChange={setServings} format={(v) => `${v} pers.`} />
        </View>
        <IngredientChecks checks={evaluation.checks} ratio={ratio} />

        <View style={styles.between}>
          <Text variant="title2">Préparation</Text>
          {recipe.steps.length > 0 && (
            <Button
              label="Mode cuisine"
              variant="soft"
              icon={<ChefHat size={18} color={colors.primaryText} />}
              accessibilityHint="Étapes en grand, écran allumé, minuteurs"
              onPress={() => router.push({ pathname: '/cuisine/[id]', params: { id: recipe.id, portions: String(n) } })}
            />
          )}
        </View>
        {recipe.steps.map((s, i) => (
          <View key={i} style={styles.step}>
            <View style={[styles.stepNum, { backgroundColor: colors.primarySoft }]}>
              <Text variant="label" tone="primary" style={styles.bold}>{i + 1}</Text>
            </View>
            <Text variant="body" style={styles.flex}>{s}</Text>
          </View>
        ))}

        <View style={{ gap: 10, marginTop: 8 }}>
          <Button
            size="lg"
            label="J’ai cuisiné ça"
            icon={<Check size={20} color={colors.onPrimary} />}
            onPress={() => {
              const p = cookProposals(evaluation, n, basicsSet);
              if (p.length) setCooking(p);
              else if (meal && !meal.done) {
                updateMeal(meal.id, { done: true });
                snackbar.show('Repas marqué comme cuisiné', () => updateMeal(meal.id, { done: false }));
              } else snackbar.show('Aucun produit de l’inventaire n’est utilisé par cette recette.');
            }}
          />
          {missing.length > 0 && (
            <Button
              label={`Ajouter ${missing.length} manquant${missing.length > 1 ? 's' : ''} aux courses`}
              variant="soft"
              icon={<ShoppingBasket size={18} color={colors.primaryText} />}
              onPress={() => {
                const added = addShopping(missing.map((m) => ({ name: m.label, quantity: m.quantity != null ? roundForShopping(m.quantity, m.unit) : null, unit: m.unit, ingredientId: m.ingredientId, recipeId: recipe.id }))).length;
                snackbar.show(added ? `${added} article${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''} à la liste de courses` : 'Quantités complétées dans ta liste de courses');
              }}
            />
          )}
          {!meal && (
            <Button
              label="Ajouter au planning"
              variant="outline"
              icon={<CalendarPlus size={18} color={colors.text} />}
              onPress={() => setScheduling(true)}
            />
          )}
        </View>
      </ScrollView>

      <CookSheet
        key={cooking?.map((p) => p.item.id).join(',') ?? 'ferme'}
        proposals={cooking}
        onClose={() => setCooking(null)}
        onConfirm={(final) => {
          const undos = final.filter((p) => p.remaining < p.item.quantity).map((p) => consumePart(p.item.id, p.remaining));
          if (meal && !meal.done) {
            updateMeal(meal.id, { done: true });
            undos.push(() => updateMeal(meal.id, { done: false }));
          }
          setCooking(null);
          const used = final.filter((p) => p.remaining < p.item.quantity).length;
          snackbar.show(`Inventaire mis à jour · ${used} produit${used > 1 ? 's' : ''}`, () => undos.reverse().forEach((u) => u()));
        }}
      />

      <SlotPicker
        visible={scheduling}
        title="Quand veux-tu la cuisiner ?"
        entries={plan}
        onClose={() => setScheduling(false)}
        onPick={(date, slot) => {
          const people = servings ?? Math.max(2, householdSize);
          addMeal(date, slot, recipe.id, people);
          setScheduling(false);
          snackbar.show(`Ajouté au planning : ${mealPhrase(date, slot)}`);
        }}
      />

      <BottomSheet visible={foldersOpen} onClose={() => setFoldersOpen(false)}>
        <View style={{ gap: 12 }}>
          <Text variant="title2">Ranger dans…</Text>
          {org.folders.length === 0 && <Text variant="body" tone="secondary">Crée d’abord un dossier depuis la liste des recettes.</Text>}
          <View style={styles.wrap}>
            {org.folders.map((f) => {
              const inside = org.byFolder.get(f.id)?.has(recipe.id) ?? false;
              return <Chip key={f.id} label={f.name} selected={inside} onPress={() => setInFolder(recipe.id, f.id, !inside)} />;
            })}
          </View>
          <Button label="Terminé" variant="outline" onPress={() => setFoldersOpen(false)} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

/** Confirmation de « J'ai cuisiné ça » : ce qu'il reste de chaque produit utilisé. */
function CookSheet({ proposals, onClose, onConfirm }: { proposals: CookProposal[] | null; onClose: () => void; onConfirm: (p: CookProposal[]) => void }) {
  const [edited, setEdited] = useState<Record<string, number>>({});
  if (!proposals) return null;
  const value = (p: CookProposal) => edited[p.item.id] ?? p.remaining;
  return (
    <BottomSheet visible onClose={onClose}>
      <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 14 }}>
        <Text variant="title2">Il te reste…</Text>
        <Text variant="label" tone="secondary">Ajuste si besoin, puis valide pour mettre l’inventaire à jour.</Text>
        {proposals.map((p) => (
          <View key={p.item.id} style={styles.cookRow}>
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>{p.item.name}</Text>
              <Text variant="label" tone={value(p) === 0 ? 'urgent' : 'secondary'}>
                {value(p) === 0 ? 'Terminé' : `Il reste ${formatQuantity(value(p), p.item.unit)}`}{!p.exact ? ' · à vérifier' : ''}
              </Text>
            </View>
            <Stepper
              label={`reste de ${p.item.name}`}
              value={value(p)}
              min={0}
              step={p.item.quantity <= 1 ? 0.25 : stepFor(p.item.unit)}
              format={(v) => (v === 0 ? '0' : formatNumber(v))}
              onChange={(v) => setEdited((e) => ({ ...e, [p.item.id]: Math.min(p.item.quantity, v) }))}
            />
          </View>
        ))}
        <Button size="lg" label="Mettre à jour l’inventaire" onPress={() => onConfirm(proposals.map((p) => ({ ...p, remaining: value(p) })))} />
        <Button label="Annuler" variant="outline" onPress={onClose} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingTop: 4, gap: 14, paddingBottom: 60 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  cookRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  planned: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  bold: { fontFamily: 'DMSans_700Bold' },
});
