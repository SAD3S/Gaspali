import { router } from 'expo-router';
import { ChevronLeft, Plus, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, ProductAvatar, Text, useSnackbar } from '@/components/ui';
import { FRESH_PRESETS, type FreshPreset } from '@/data/freshProducts';
import { addItem } from '@/db/inventoryRepo';
import { CATEGORY_LIST, getCategory, LOCATION_LABELS, type CategoryId, type Location } from '@/domain/categories';
import { addDays } from '@/domain/dates';
import { defaultExpiry, normalizeText } from '@/domain/inventory';
import { ItemForm, type ItemFormValue } from '@/features/inventory/ItemForm';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

interface Draft {
  name: string;
  category: CategoryId;
  form: ItemFormValue;
  /** La date vient d'une durée par défaut, pas de l'emballage. */
  estimated: boolean;
}

function draftFromPreset(p: FreshPreset): Draft {
  return {
    name: p.name,
    category: p.category,
    estimated: true,
    form: { dateType: getCategory(p.category).dateType, expiresAt: addDays(new Date(), p.days), quantity: p.quantity, unit: p.unit, location: p.location },
  };
}

function draftFromName(name: string, category: CategoryId = 'autre'): Draft {
  const c = getCategory(category);
  return {
    name,
    category,
    estimated: true,
    form: { dateType: c.dateType, expiresAt: defaultExpiry(category, c.location), quantity: 1, unit: 'pièce', location: c.location },
  };
}

/** Ajout sans code-barres : fruits, légumes, vrac, restes maison. */
export default function Ajout() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);

  const matches = useMemo(() => {
    const q = normalizeText(query);
    return q ? FRESH_PRESETS.filter((p) => normalizeText(p.name).includes(q)) : FRESH_PRESETS;
  }, [query]);

  const save = (another: boolean) => {
    if (!draft || !draft.name.trim()) return;
    addItem({ name: draft.name, category: draft.category, ...draft.form, expiryEstimated: draft.estimated });
    snackbar.show(`Ajouté au ${LOCATION_LABELS[draft.form.location].toLowerCase()} : ${draft.name}`);
    if (another) {
      setDraft(null);
      setQuery('');
    } else router.back();
  };

  const setCategory = (category: CategoryId) => {
    if (!draft) return;
    const c = getCategory(category);
    setDraft({
      ...draft,
      category,
      form: { ...draft.form, dateType: c.dateType, location: c.location, expiresAt: defaultExpiry(category, c.location) },
    });
  };

  const changeLocation = (location: Location) => {
    if (!draft) return;
    // Si la date n'a pas été saisie à la main, on la recalcule pour le nouvel emplacement.
    setDraft({
      ...draft,
      form: { ...draft.form, location, ...(draft.estimated ? { expiresAt: defaultExpiry(draft.category, location) } : {}) },
    });
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={draft ? 'Retour à la liste' : 'Fermer'}
          onPress={() => (draft ? setDraft(null) : router.back())}
          style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {draft ? <ChevronLeft size={22} color={colors.text} /> : <X size={22} color={colors.text} />}
        </Pressable>
        <Text variant="title2" accessibilityRole="header">Ajouter un produit</Text>
        <View style={{ width: MIN_TOUCH }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {!draft ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Search size={20} color={colors.textSecondary} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Tomates, baguette, reste de lasagnes…"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Nom du produit"
                returnKeyType="next"
                onSubmitEditing={() => query.trim() && setDraft(matches[0] && normalizeText(matches[0].name) === normalizeText(query) ? draftFromPreset(matches[0]) : draftFromName(query.trim()))}
                style={[styles.input, { color: colors.text }]}
              />
            </View>

            {query.trim().length > 0 && !matches.some((m) => normalizeText(m.name) === normalizeText(query)) && (
              <Pressable accessibilityRole="button" onPress={() => setDraft(draftFromName(query.trim()))} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <View style={[styles.plus, { backgroundColor: colors.primarySoft }]}>
                  <Plus size={20} color={colors.primaryText} />
                </View>
                <Text variant="bodyStrong" style={styles.flex}>Ajouter « {query.trim()} »</Text>
              </Pressable>
            )}

            <Text variant="overline" tone="secondary">{query ? 'Suggestions' : 'Produits frais courants'}</Text>
            {matches.map((p) => (
              <Pressable
                key={p.name}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}, ${getCategory(p.category).label}`}
                onPress={() => setDraft(draftFromPreset(p))}
                style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <ProductAvatar name={p.name} state="frais" size={40} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{p.name}</Text>
                  <Text variant="label" tone="secondary">{getCategory(p.category).label} · {LOCATION_LABELS[p.location]} · ~{p.days} j</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.nameRow}>
              <ProductAvatar name={draft.name || '?'} state="frais" size={56} />
              <TextInput
                value={draft.name}
                onChangeText={(name) => setDraft({ ...draft, name })}
                accessibilityLabel="Nom du produit"
                style={[styles.nameInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              />
            </View>

            <Text variant="overline" tone="secondary">Catégorie</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {CATEGORY_LIST.map((c) => (
                <Chip key={c.id} label={c.label} selected={draft.category === c.id} onPress={() => setCategory(c.id)} />
              ))}
            </ScrollView>

            <ItemForm
              value={draft.form}
              onChange={(form) => setDraft({ ...draft, form, estimated: draft.estimated && form.expiresAt === draft.form.expiresAt })}
              onLocationChange={changeLocation}
            />
            {draft.estimated && (
              <Text variant="label" tone="secondary">Date estimée selon le type de produit — ajuste-la si tu la connais.</Text>
            )}

            <View style={{ gap: 10, marginTop: 4 }}>
              <Button size="lg" label="Ajouter" onPress={() => save(false)} disabled={!draft.name.trim()} />
              <Button label="Ajouter et en saisir un autre" variant="outline" onPress={() => save(true)} disabled={!draft.name.trim()} />
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 50 },
  input: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 16, minHeight: MIN_TOUCH },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 10, minHeight: 60 },
  plus: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameInput: { flex: 1, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 52 },
});
