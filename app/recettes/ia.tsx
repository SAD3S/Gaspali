import { router } from 'expo-router';
import { ChevronLeft, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, Field, Stepper, Text, useSnackbar } from '@/components/ui';
import { ALLERGEN_LABELS } from '@/data/allergens';
import type { RecipeKind } from '@/data/recipes';
import { saveRecipe } from '@/db/recipesRepo';
import { queryInventory } from '@/domain/inventory';
import { DIET_LABELS, evaluateRecipe, recipeAllergens, type Recipe } from '@/domain/recipeEngine';
import { useAuth } from '@/features/account/AuthProvider';
import { useInventory } from '@/features/inventory/hooks';
import { IngredientChecks } from '@/features/recipes/IngredientChecks';
import { KIND_LABELS } from '@/features/recipes/RecipeCard';
import { useHouseholdPrefs } from '@/features/recipes/hooks';
import { useSettings } from '@/features/settings/settings';
import { AiRecipeError, buildAiPayload, generateAiRecipe, type AiRecipeResult } from '@/services/aiRecipes';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

const DURATIONS = [15, 30, 45, 60, 90];
const KINDS: { value: RecipeKind | 'peu-importe'; label: string }[] = [
  { value: 'peu-importe', label: 'Peu importe' },
  { value: 'plat', label: 'Plat' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'soupe', label: 'Soupe' },
  { value: 'salade', label: 'Salade' },
  { value: 'petit-dejeuner', label: 'Petit-déj' },
];

/** « Invente-moi une recette » : recette générée par l'IA à partir de ce qui périme bientôt. */
export default function RecetteIA() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const auth = useAuth();
  const items = useInventory();
  const { basics } = useSettings();
  const { members } = useHouseholdPrefs();
  const [minutes, setMinutes] = useState(30);
  const [servings, setServings] = useState(2);
  const [kind, setKind] = useState<RecipeKind | 'peu-importe'>('peu-importe');
  const [wish, setWish] = useState('');
  const [variation, setVariation] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiRecipeResult | null>(null);

  const urgent = useMemo(
    () => queryInventory(items).filter((r) => r.freshness.state === 'urgent' || r.freshness.state === 'bientot').slice(0, 6),
    [items],
  );
  const householdAllergens = useMemo(() => [...new Set(members.flatMap((m) => m.allergens))], [members]);
  const strictest = members.map((m) => m.diet).find((d) => d === 'vegan') ?? members.map((m) => m.diet).find((d) => d === 'vegetarien') ?? members.map((m) => m.diet).find((d) => d === 'pescetarien');

  // Recette affichée, évaluée comme les autres (disponibilité des ingrédients).
  const preview = useMemo<Recipe | null>(() => (result ? { ...result.recipe, id: 'ia-apercu', source: 'ia' } : null), [result]);
  const evaluation = useMemo(
    () => (preview ? evaluateRecipe(preview, { items, basics: new Set(basics), members: members.map((m) => ({ ...m, allergens: [] })) }) : null),
    [preview, items, basics, members],
  );
  // Défense en profondeur : le serveur a déjà vérifié, on revérifie avant d'enregistrer.
  const localConflicts = preview ? recipeAllergens(preview, true).filter((a) => householdAllergens.includes(a)) : [];

  const generate = async (nextVariation: number) => {
    if (!auth.active) return;
    setLoading(true);
    setError(null);
    try {
      const payload = buildAiPayload({ householdId: auth.active.id, minutes, servings, kind, wish, variation: nextVariation }, items, basics, members);
      setResult(await generateAiRecipe(payload));
      setVariation(nextVariation);
    } catch (e) {
      setError(e instanceof AiRecipeError ? e.message : 'Le chef n’a pas pu inventer de recette. Réessaie dans un instant.');
    } finally {
      setLoading(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ChevronLeft size={22} color={colors.text} />
      </Pressable>
      <Text variant="title2" accessibilityRole="header" style={{ flex: 1 }}>Invente-moi une recette</Text>
    </View>
  );

  if (!auth.cloud || !auth.session || !auth.active) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.content}>
          {header}
          <Card style={{ gap: 10 }}>
            <Sparkles size={28} color={colors.primaryText} />
            <Text variant="bodyStrong">Les idées IA demandent un compte</Text>
            <Text variant="body" tone="secondary">
              {!auth.cloud
                ? 'Elles seront disponibles quand le serveur de l’app sera configuré.'
                : 'Connecte-toi et crée (ou rejoins) un foyer : le nombre d’idées par jour est partagé par le foyer.'}
            </Text>
            {auth.cloud && <Button label="Compte et foyer" onPress={() => router.push('/compte')} />}
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {header}

        {!result && (
          <>
            <Card style={{ gap: 12 }}>
              <Text variant="bodyStrong">À utiliser en priorité</Text>
              {urgent.length ? (
                <View style={styles.wrap}>
                  {urgent.map(({ item, freshness }) => (
                    <View key={item.id} style={[styles.pill, { backgroundColor: colors.surface2 }]}>
                      <Text variant="label">{item.name} · {freshness.label}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text variant="label" tone="secondary">Rien d’urgent : l’IA piochera dans tout ton inventaire.</Text>
              )}
            </Card>

            <Text variant="overline" tone="secondary">Temps disponible</Text>
            <View style={styles.wrap}>
              {DURATIONS.map((d) => <Chip key={d} label={`${d} min`} selected={minutes === d} onPress={() => setMinutes(d)} />)}
            </View>
            <View style={styles.between}>
              <Text variant="bodyStrong" style={{ fontSize: 16 }}>Pour combien ?</Text>
              <Stepper label="personnes" value={servings} min={1} onChange={(v) => setServings(Math.min(12, v))} format={(v) => `${v} pers.`} />
            </View>
            <Text variant="overline" tone="secondary">Type</Text>
            <View style={styles.wrap}>
              {KINDS.map((k) => <Chip key={k.value} label={k.label} selected={kind === k.value} onPress={() => setKind(k.value)} />)}
            </View>
            <Field label="Une envie ? (facultatif)" value={wish} onChangeText={setWish} placeholder="Quelque chose de léger, de réconfortant…" maxLength={120} />
            <Text variant="label" tone="secondary">
              Pris en compte : {strictest ? `régime ${DIET_LABELS[strictest].toLowerCase()}` : 'pas de régime particulier'}
              {householdAllergens.length ? `, allergies (${householdAllergens.map((a) => ALLERGEN_LABELS[a].toLowerCase()).join(', ')}) jamais utilisées` : ''}.
            </Text>
          </>
        )}

        {loading && (
          <Card style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text variant="body" tone="secondary" accessibilityLiveRegion="polite">Le chef réfléchit… (environ 30 secondes)</Text>
          </Card>
        )}
        {error && !loading && (
          <Card style={{ gap: 6, borderColor: colors.urgent }}>
            <Text variant="body" accessibilityLiveRegion="polite">{error}</Text>
          </Card>
        )}

        {result && preview && evaluation && !loading && (
          <>
            <Card tone="primary" style={{ gap: 6 }}>
              <Text variant="overline" tone="onPrimary" style={{ opacity: 0.85 }}>Idée du chef{result.cached ? ' (déjà proposée)' : ''}</Text>
              <Text variant="title2" tone="onPrimary">{preview.title}</Text>
              <Text variant="body" tone="onPrimary">
                {preview.minutes} min · {preview.servings} pers. · {KIND_LABELS[preview.kind]}
                {evaluation.urgentUsed ? ` · sauve ${evaluation.urgentUsed} produit${evaluation.urgentUsed > 1 ? 's' : ''} urgent${evaluation.urgentUsed > 1 ? 's' : ''}` : ''}
              </Text>
            </Card>
            {localConflicts.length > 0 && (
              <Card style={{ borderColor: colors.urgent }}>
                <Text variant="bodyStrong" tone="urgent">Contient : {localConflicts.map((a) => ALLERGEN_LABELS[a]).join(', ')}. Ne l’enregistre pas.</Text>
              </Card>
            )}
            <Text variant="title2">Ingrédients</Text>
            <IngredientChecks checks={evaluation.checks} />
            <Text variant="title2">Préparation</Text>
            {preview.steps.map((s, i) => (
              <View key={i} style={styles.step}>
                <View style={[styles.stepNum, { backgroundColor: colors.primarySoft }]}>
                  <Text variant="label" tone="primary" style={styles.bold}>{i + 1}</Text>
                </View>
                <Text variant="body" style={{ flex: 1 }}>{s}</Text>
              </View>
            ))}
            <Text variant="label" tone="secondary">Recette générée par IA : vérifie les cuissons, et les allergènes sur les emballages.</Text>
            <Button
              size="lg"
              label="Enregistrer dans Mes recettes"
              disabled={localConflicts.length > 0}
              onPress={() => {
                const id = saveRecipe({ ...preview, photoUri: null, source: 'ia' });
                snackbar.show('Recette enregistrée dans Mes recettes');
                router.replace({ pathname: '/recettes/[id]', params: { id } });
              }}
            />
          </>
        )}

        {!loading && (
          <Button
            label={result ? 'Une autre idée' : 'Inventer une recette'}
            variant={result ? 'soft' : 'primary'}
            icon={<Sparkles size={18} color={result ? colors.primaryText : colors.onPrimary} />}
            onPress={() => generate(result ? variation + 1 : variation)}
          />
        )}
        {result && !loading && (
          <>
            <Button label="Changer les critères" variant="outline" onPress={() => setResult(null)} />
            <Text variant="label" tone="secondary" style={styles.center}>
              Encore {result.remaining} idée{result.remaining > 1 ? 's' : ''} aujourd’hui pour ton foyer.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  bold: { fontFamily: 'DMSans_700Bold' },
  center: { textAlign: 'center' },
});
