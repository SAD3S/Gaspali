import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp, Camera, ChevronLeft, ImagePlus, Plus, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, Field, Stepper, Text, useSnackbar } from '@/components/ui';
import { INGREDIENTS_BY_ID } from '@/data/ingredients';
import type { RecipeIngredient, RecipeKind } from '@/data/recipes';
import { deleteRecipe, saveRecipe, setInFolder } from '@/db/recipesRepo';
import { resolveIngredient, searchIngredients } from '@/domain/ingredientMatch';
import { KIND_LABELS } from '@/features/recipes/RecipeCard';
import { useRecipe, useRecipeOrganization } from '@/features/recipes/hooks';
import { clearImportDraft, peekImportDraft } from '@/features/recipes/importDraft';
import { pickRecipePhoto } from '@/services/photos';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';

const UNITS = ['', 'g', 'kg', 'cl', 'L', 'pièce', 'c. à s.', 'c. à c.', 'gousse', 'tranche', 'pot', 'boîte', 'sachet', 'pincée'];
const SUGGESTED_TAGS = ['dessert', 'plat', 'apéro', 'rapide', 'anti-gaspi', 'batch cooking', 'four', 'économique', 'enfants', 'fête', 'été', 'hiver'];

interface Row {
  key: string;
  name: string;
  ingredientId: string | null;
  quantity: string;
  unit: string;
  optional: boolean;
}

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

function toRow(ri: RecipeIngredient): Row {
  return {
    key: nextKey(),
    name: ri.name ?? (ri.ingredientId ? INGREDIENTS_BY_ID[ri.ingredientId]?.name ?? ri.ingredientId : ''),
    ingredientId: ri.ingredientId,
    quantity: ri.quantity != null ? String(ri.quantity).replace('.', ',') : '',
    unit: ri.unit ?? '',
    optional: !!ri.optional,
  };
}

/** « www.marmiton.org » → « marmiton.org » */
function hostOf(url: string | null): string {
  if (!url) return 'un site';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'un site';
  }
}

/** Création / modification d'une recette perso (avec tags et dossiers). */
export default function EditerRecette() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { id, brouillon } = useLocalSearchParams<{ id?: string; brouillon?: string }>();
  const existing = useRecipe(id ?? '');
  const org = useRecipeOrganization();
  const editing = !!(id && existing && existing.source !== 'base');
  // Recette importée (site, photo, fichier) à relire avant d'enregistrer.
  const [imported] = useState(() => (brouillon ? peekImportDraft() : null));
  const base = imported?.recipe;

  const [title, setTitle] = useState(existing?.title ?? base?.title ?? '');
  const [kind, setKind] = useState<RecipeKind>(existing?.kind ?? base?.kind ?? 'plat');
  const [minutes, setMinutes] = useState(existing?.minutes ?? base?.minutes ?? 30);
  const [servings, setServings] = useState(existing?.servings ?? base?.servings ?? 4);
  const [photo, setPhoto] = useState<string | null>(existing?.photoUri ?? base?.imageUrl ?? null);
  const [sourceUrl] = useState<string | null>(existing?.sourceUrl ?? base?.sourceUrl ?? null);
  const [rows, setRows] = useState<Row[]>(() => {
    const list = existing?.ingredients.length ? existing.ingredients : base?.ingredients ?? [];
    return list.length ? list.map(toRow) : [toRow({ ingredientId: null, name: '', quantity: null, unit: null })];
  });
  const [steps, setSteps] = useState<string[]>(existing?.steps.length ? existing.steps : base?.steps.length ? base.steps : ['']);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? base?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [folders, setFolders] = useState<Set<string>>(
    () => new Set(org.folders.filter((f) => id && org.byFolder.get(f.id)?.has(id)).map((f) => f.id)),
  );
  const [focusRow, setFocusRow] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const row = rows.find((r) => r.key === focusRow);
    return row && row.name.trim().length >= 2 && !row.ingredientId ? searchIngredients(row.name, 5) : [];
  }, [rows, focusRow]);

  const updateRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = () => {
    const ingredients: RecipeIngredient[] = rows
      .filter((r) => r.name.trim())
      .map((r) => {
        const resolved = r.ingredientId ? INGREDIENTS_BY_ID[r.ingredientId] : resolveIngredient(r.name);
        const q = parseFloat(r.quantity.replace(',', '.'));
        return {
          ingredientId: resolved?.id ?? null,
          // Libellé saisi conservé s'il diffère du nom normalisé (« blanc de poulet fermier »).
          ...(resolved && resolved.name === r.name.trim() ? {} : { name: r.name.trim() }),
          quantity: Number.isFinite(q) ? q : null,
          unit: r.unit || null,
          ...(r.optional ? { optional: true } : {}),
        };
      });
    if (!title.trim()) return setError('Donne un titre à ta recette.');
    if (!ingredients.length) return setError('Ajoute au moins un ingrédient.');
    const savedId = saveRecipe({ id: editing ? id : undefined, title, kind, minutes, servings, photoUri: photo, sourceUrl, tags, ingredients, steps });
    clearImportDraft();
    for (const f of org.folders) setInFolder(savedId, f.id, folders.has(f.id));
    snackbar.show(editing ? 'Recette mise à jour' : 'Recette créée');
    router.replace({ pathname: '/recettes/[id]', params: { id: savedId } });
  };

  const addTag = (t: string) => {
    const v = t.trim().toLowerCase().replace(/^#/, '');
    if (v && !tags.includes(v)) setTags([...tags, v]);
    setTagInput('');
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Annuler" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text variant="title2" accessibilityRole="header" style={styles.flex}>{editing ? 'Modifier la recette' : imported ? 'Recette importée' : 'Nouvelle recette'}</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {imported && (
            <Card style={{ gap: 4, backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }}>
              <Text variant="bodyStrong" tone="primary">
                {imported.origin === 'photo' ? 'Lue sur ta photo' : imported.origin === 'lien' ? `Importée de ${hostOf(sourceUrl)}` : 'Importée d’un fichier'}
              </Text>
              <Text variant="label" tone="primary">
                {imported.origin === 'photo'
                  ? 'La lecture peut se tromper : vérifie les quantités et les étapes, puis enregistre.'
                  : 'Vérifie les ingrédients (ceux reconnus servent aux suggestions anti-gaspi), puis enregistre.'}
              </Text>
            </Card>
          )}
          <Field label="Titre" value={title} onChangeText={setTitle} placeholder="Tarte aux pommes de mamie" maxLength={120} />

          {photo ? (
            <View>
              <Image source={{ uri: photo }} style={styles.photo} accessibilityLabel="Photo de la recette" />
              <Pressable accessibilityRole="button" accessibilityLabel="Retirer la photo" onPress={() => setPhoto(null)} style={[styles.removePhoto, { backgroundColor: colors.surface }]}>
                <X size={18} color={colors.text} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoRow}>
              <Button label="Choisir une photo" variant="outline" icon={<ImagePlus size={18} color={colors.text} />} style={styles.flex}
                onPress={() => pickRecipePhoto('galerie').then((u) => u && setPhoto(u)).catch(() => snackbar.show('Impossible d’ouvrir la galerie'))} />
              {Platform.OS !== 'web' && (
                <Pressable accessibilityRole="button" accessibilityLabel="Prendre une photo" onPress={() => pickRecipePhoto('camera').then((u) => u && setPhoto(u)).catch(() => {})}
                  style={[styles.round, { width: 52, height: 52, backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Camera size={20} color={colors.text} />
                </Pressable>
              )}
            </View>
          )}

          <Text variant="overline" tone="secondary">Type</Text>
          <View style={styles.wrap}>
            {(Object.keys(KIND_LABELS) as RecipeKind[]).map((k) => <Chip key={k} label={KIND_LABELS[k]} selected={kind === k} onPress={() => setKind(k)} />)}
          </View>

          <View style={styles.between}>
            <Text variant="bodyStrong" style={{ fontSize: 16 }}>Durée</Text>
            <Stepper label="durée" value={minutes} min={5} step={5} onChange={setMinutes} format={(v) => `${v} min`} />
          </View>
          <View style={styles.between}>
            <Text variant="bodyStrong" style={{ fontSize: 16 }}>Portions</Text>
            <Stepper label="portions" value={servings} min={1} onChange={setServings} format={(v) => `${v} pers.`} />
          </View>

          <Text variant="overline" tone="secondary">Ingrédients</Text>
          {rows.map((r) => (
            <Card key={r.key} style={{ gap: 8, padding: 12 }}>
              <View style={styles.ingHead}>
                <TextInput
                  value={r.quantity}
                  onChangeText={(v) => updateRow(r.key, { quantity: v.replace(/[^0-9.,/]/g, '') })}
                  placeholder="Qté"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Quantité"
                  style={[styles.qty, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface2 }]}
                />
                <TextInput
                  value={r.name}
                  onChangeText={(v) => updateRow(r.key, { name: v, ingredientId: null })}
                  onFocus={() => setFocusRow(r.key)}
                  placeholder="Ingrédient (ex. poulet)"
                  placeholderTextColor={colors.textSecondary}
                  accessibilityLabel="Ingrédient"
                  style={[styles.name, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface2 }]}
                />
                <Pressable accessibilityRole="button" accessibilityLabel={`Supprimer ${r.name || 'cet ingrédient'}`} onPress={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} style={styles.iconBtn}>
                  <Trash2 size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
              {focusRow === r.key && suggestions.length > 0 && (
                <View style={styles.wrap}>
                  {suggestions.map((s) => <Chip key={s.id} label={s.name} onPress={() => updateRow(r.key, { name: s.name, ingredientId: s.id })} />)}
                </View>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
                {UNITS.map((u) => <Chip key={u || 'aucune'} label={u || 'sans unité'} selected={r.unit === u} onPress={() => updateRow(r.key, { unit: u })} />)}
              </ScrollView>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: r.optional }} onPress={() => updateRow(r.key, { optional: !r.optional })} style={styles.optional}>
                <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: r.optional ? colors.primary : 'transparent' }]} />
                <Text variant="label" tone="secondary">Facultatif{r.ingredientId ? ` · reconnu : ${INGREDIENTS_BY_ID[r.ingredientId]?.name}` : ''}</Text>
              </Pressable>
            </Card>
          ))}
          <Button label="Ajouter un ingrédient" variant="outline" icon={<Plus size={18} color={colors.text} />}
            onPress={() => setRows((rs) => [...rs, toRow({ ingredientId: null, name: '', quantity: null, unit: null })])} />

          <Text variant="overline" tone="secondary">Étapes</Text>
          {steps.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <Text variant="bodyStrong" style={styles.stepNum}>{i + 1}</Text>
              <TextInput
                value={s}
                onChangeText={(v) => setSteps((st) => st.map((x, j) => (j === i ? v : x)))}
                placeholder="Décris l’étape"
                placeholderTextColor={colors.textSecondary}
                multiline
                accessibilityLabel={`Étape ${i + 1}`}
                style={[styles.stepInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              />
              <View>
                <Pressable accessibilityRole="button" accessibilityLabel="Monter l’étape" disabled={i === 0} onPress={() => setSteps((st) => { const c = [...st]; [c[i - 1], c[i]] = [c[i]!, c[i - 1]!]; return c; })} hitSlop={8} style={styles.smallBtn}>
                  <ArrowUp size={16} color={i === 0 ? colors.border : colors.textSecondary} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Supprimer l’étape" onPress={() => setSteps((st) => st.filter((_, j) => j !== i))} hitSlop={8} style={styles.smallBtn}>
                  <Trash2 size={16} color={colors.textSecondary} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Descendre l’étape" disabled={i === steps.length - 1} onPress={() => setSteps((st) => { const c = [...st]; [c[i + 1], c[i]] = [c[i]!, c[i + 1]!]; return c; })} hitSlop={8} style={styles.smallBtn}>
                  <ArrowDown size={16} color={i === steps.length - 1 ? colors.border : colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          ))}
          <Button label="Ajouter une étape" variant="outline" icon={<Plus size={18} color={colors.text} />} onPress={() => setSteps((st) => [...st, ''])} />

          <Text variant="overline" tone="secondary">Tags</Text>
          <View style={styles.wrap}>
            {[...new Set([...tags, ...SUGGESTED_TAGS])].map((t) => (
              <Chip key={t} label={`#${t}`} selected={tags.includes(t)} onPress={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} />
            ))}
          </View>
          <View style={styles.photoRow}>
            <TextInput
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={() => addTag(tagInput)}
              placeholder="Nouveau tag (ex. sans gluten)"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Nouveau tag"
              returnKeyType="done"
              style={[styles.name, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
            <Button label="Ajouter" variant="soft" onPress={() => addTag(tagInput)} disabled={!tagInput.trim()} />
          </View>
          <Text variant="label" tone="secondary">Végétarien, végan, sans gluten et sans lactose sont aussi déduits automatiquement des ingrédients.</Text>

          {org.folders.length > 0 && (
            <>
              <Text variant="overline" tone="secondary">Dossiers</Text>
              <View style={styles.wrap}>
                {org.folders.map((f) => (
                  <Chip key={f.id} label={f.name} selected={folders.has(f.id)}
                    onPress={() => setFolders((s) => { const n = new Set(s); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })} />
                ))}
              </View>
            </>
          )}

          {error && <Text variant="label" tone="urgent" accessibilityLiveRegion="polite">{error}</Text>}
          <Button size="lg" label={editing ? 'Enregistrer' : 'Créer la recette'} onPress={save} />
          {editing && (
            <Button
              label="Supprimer la recette"
              variant="outline"
              onPress={() =>
                Alert.alert('Supprimer cette recette ?', 'Elle sera retirée pour tout le foyer.', [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: () => { deleteRecipe(id!); snackbar.show('Recette supprimée'); router.replace('/recettes'); } },
                ])
              }
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 12, paddingBottom: 60 },
  photo: { width: '100%', height: 200, borderRadius: radius.cardLarge },
  removePhoto: { position: 'absolute', top: 10, right: 10, width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  photoRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ingHead: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  qty: { width: 64, minHeight: MIN_TOUCH, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, fontFamily: 'DMSans_500Medium', fontSize: 16 },
  name: { flex: 1, minHeight: MIN_TOUCH, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontFamily: 'DMSans_500Medium', fontSize: 16 },
  iconBtn: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  optional: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5 },
  stepRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  stepNum: { width: 22, marginTop: 12, textAlign: 'center' },
  stepInput: { flex: 1, minHeight: 64, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: 'DMSans_400Regular', fontSize: 16, textAlignVertical: 'top' },
  smallBtn: { width: 36, height: 28, alignItems: 'center', justifyContent: 'center' },
});
