import { router, useLocalSearchParams } from 'expo-router';
import { Download, FolderPlus, Plus, Search, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheet, Button, Chip, Field, Text, useSnackbar } from '@/components/ui';
import { createFolder } from '@/db/recipesRepo';
import { normalizeText } from '@/domain/inventory';
import { recipeTags, type Suggestion } from '@/domain/recipeEngine';
import { AI_RECIPES } from '@/config';
import { AddRecipeSheet } from '@/features/recipes/AddRecipeSheet';
import { RecipeCard } from '@/features/recipes/RecipeCard';
import { useAllRecipes, useRecipeOrganization, useSuggestions } from '@/features/recipes/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';

type Quick = 'pour-toi' | 'favoris' | 'mes-recettes' | 'rapide' | 'vegetarien' | 'sans-gluten';
const QUICK: { key: Quick; label: string }[] = [
  { key: 'pour-toi', label: 'Pour toi' },
  { key: 'favoris', label: 'Favoris' },
  { key: 'mes-recettes', label: 'Mes recettes' },
  { key: 'rapide', label: '≤ 30 min' },
  { key: 'vegetarien', label: 'Végétarien' },
  { key: 'sans-gluten', label: 'Sans gluten' },
];

/** Onglet Recettes : suggestions anti-gaspi, filtres, tags, dossiers, ajout et import. */
export default function Recettes() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const params = useLocalSearchParams<{ filtre?: Quick }>();
  const all = useAllRecipes();
  const suggestions = useSuggestions();
  const org = useRecipeOrganization();
  const [quick, setQuick] = useState<Quick>(params.filtre ?? 'pour-toi');
  const [folder, setFolder] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const bySuggestion = useMemo(() => new Map(suggestions.map((s) => [s.recipe.id, s])), [suggestions]);

  // Tags proposés : ceux des recettes perso puis les plus courants.
  const tags = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of all) for (const t of recipeTags(r)) count.set(t, (count.get(t) ?? 0) + (r.source === 'base' ? 1 : 100));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t).filter((t) => t !== 'végétarien' && t !== 'sans gluten').slice(0, 14);
  }, [all]);

  const list = useMemo(() => {
    const q = normalizeText(query);
    // Ordre « Pour toi » : celui du moteur ; les recettes exclues (allergènes) n'y figurent pas.
    let rows: { recipe: (typeof all)[number]; s?: Suggestion }[] = suggestions.map((s) => ({ recipe: s.recipe, s }));
    if (quick === 'favoris') rows = rows.filter((r) => org.favorites.has(r.recipe.id));
    if (quick === 'mes-recettes') rows = rows.filter((r) => r.recipe.source !== 'base');
    if (quick === 'rapide') rows = rows.filter((r) => r.recipe.minutes <= 30);
    if (quick === 'vegetarien') rows = rows.filter((r) => recipeTags(r.recipe).includes('végétarien'));
    if (quick === 'sans-gluten') rows = rows.filter((r) => recipeTags(r.recipe).includes('sans gluten'));
    if (folder) rows = rows.filter((r) => org.byFolder.get(folder)?.has(r.recipe.id));
    if (tag) rows = rows.filter((r) => recipeTags(r.recipe).includes(tag));
    if (q) rows = rows.filter((r) => normalizeText(r.recipe.title).includes(q) || r.recipe.ingredients.some((i) => normalizeText(i.name ?? i.ingredientId ?? '').includes(q)));
    return rows;
  }, [suggestions, quick, folder, tag, query, org, all]);

  const header = (
    <View style={{ gap: 12, marginBottom: 12 }}>
      <View style={styles.head}>
        <Text variant="title1" accessibilityRole="header" style={{ flex: 1 }}>Recettes</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Ajouter une recette" onPress={() => setAdding(true)} style={[styles.round, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }]}>
          <Plus size={22} color={colors.primaryText} />
        </Pressable>
      </View>

      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Search size={20} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Recette ou ingrédient"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Rechercher une recette"
          style={[styles.input, { color: colors.text }]}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {QUICK.map((f) => <Chip key={f.key} label={f.label} selected={quick === f.key} onPress={() => setQuick(f.key)} />)}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityLabel="Dossiers">
        {org.folders.map((f) => (
          <Chip
            key={f.id}
            label={`${f.name} · ${org.byFolder.get(f.id)?.size ?? 0}`}
            selected={folder === f.id}
            onPress={() => setFolder(folder === f.id ? null : f.id)}
          />
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="Créer un dossier" onPress={() => setNewFolder('')} style={[styles.addFolder, { borderColor: colors.border }]}>
          <FolderPlus size={18} color={colors.primaryText} />
          <Text variant="label" tone="primary" style={styles.bold}>Dossier</Text>
        </Pressable>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityLabel="Tags">
        {tags.map((t) => <Chip key={t} label={`#${t}`} selected={tag === t} onPress={() => setTag(tag === t ? null : t)} />)}
      </ScrollView>

      {quick === 'pour-toi' && !folder && !tag && !query && (
        <>
          {AI_RECIPES ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Invente-moi une recette avec l’IA"
              onPress={() => router.push('/recettes/ia')}
              style={[styles.ai, { backgroundColor: colors.primarySoft }]}
            >
              <Sparkles size={22} color={colors.primaryText} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" tone="primary">Invente-moi une recette</Text>
                <Text variant="label" tone="primary">Une idée sur mesure avec ce qui périme bientôt</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Importer une recette depuis un site, une photo ou un fichier"
              onPress={() => setAdding(true)}
              style={[styles.ai, { backgroundColor: colors.primarySoft }]}
            >
              <Download size={22} color={colors.primaryText} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" tone="primary">Importer une recette</Text>
                <Text variant="label" tone="primary">Depuis un site, une photo de livre ou un fichier</Text>
              </View>
            </Pressable>
          )}
          <Text variant="label" tone="secondary">Classées pour utiliser d’abord ce qui périme bientôt.</Text>
        </>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <FlatList
        data={list}
        keyExtractor={(r) => r.recipe.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item.recipe}
            suggestion={item.s ?? bySuggestion.get(item.recipe.id)}
            favorite={org.favorites.has(item.recipe.id)}
            onPress={() => router.push({ pathname: '/recettes/[id]', params: { id: item.recipe.id } })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
              {quick === 'favoris' ? 'Pas encore de favoris : touche le cœur sur une recette.' : quick === 'mes-recettes' ? 'Ajoute ta première recette avec le bouton + : écrite, importée d’un site ou photographiée.' : 'Aucune recette ne correspond.'}
            </Text>
            {quick === 'mes-recettes' && <Button label="Ajouter une recette" variant="soft" onPress={() => setAdding(true)} />}
          </View>
        }
      />

      <BottomSheet visible={newFolder !== null} onClose={() => setNewFolder(null)}>
        <View style={{ gap: 14 }}>
          <Text variant="title2">Nouveau dossier</Text>
          <Field label="Nom" value={newFolder ?? ''} onChangeText={setNewFolder} placeholder="Desserts du dimanche" maxLength={40} autoFocus />
          <Button
            label="Créer"
            disabled={!newFolder?.trim()}
            onPress={() => {
              const id = createFolder(newFolder!);
              setFolder(id);
              setNewFolder(null);
              snackbar.show('Dossier créé : ajoute des recettes depuis leur fiche');
            }}
          />
        </View>
      </BottomSheet>
      <AddRecipeSheet visible={adding} onClose={() => setAdding(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 50 },
  input: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 16, minHeight: MIN_TOUCH },
  row: { gap: 8 },
  addFolder: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: MIN_TOUCH, borderRadius: radius.chip, borderWidth: 1, borderStyle: 'dashed' },
  empty: { alignItems: 'center', gap: 12, marginTop: 40 },
  ai: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14, minHeight: 64 },
  bold: { fontFamily: 'DMSans_700Bold' },
});
