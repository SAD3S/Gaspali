import { router } from 'expo-router';
import { ChevronLeft, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Card, Chip, Screen, SegmentedControl, Text, useSnackbar } from '@/components/ui';
import { ALLERGENS, ALLERGEN_LABELS, type AllergenId } from '@/data/allergens';
import { INGREDIENTS_BY_ID } from '@/data/ingredients';
import { saveMyProfile } from '@/db/dietaryRepo';
import { searchIngredients } from '@/domain/ingredientMatch';
import { DIET_LABELS, type Diet } from '@/domain/recipeEngine';
import { useHouseholdPrefs } from '@/features/recipes/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

/** Préférences alimentaires : les miennes (modifiables) et celles du foyer (lecture). */
export default function Preferences() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { mine, members } = useHouseholdPrefs();
  const [query, setQuery] = useState('');
  const others = members.filter((m) => m.name !== 'Toi');

  const save = (patch: Partial<{ diet: Diet; allergens: AllergenId[]; dislikes: string[] }>) => {
    saveMyProfile({ diet: mine.diet, allergens: mine.allergens, dislikes: mine.dislikes, ...patch });
  };
  const results = useMemo(() => searchIngredients(query, 6).filter((i) => !mine.dislikes.includes(i.id)), [query, mine.dislikes]);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ChevronLeft size={22} color={colors.text} />
        </Pressable>
        <Text variant="title1" accessibilityRole="header" style={{ flex: 1 }}>Préférences</Text>
      </View>
      <Text variant="body" tone="secondary">
        Les recettes avec un allergène déclaré ne sont jamais proposées ; le régime et les aliments que tu n’aimes pas font baisser leur classement.
      </Text>

      <Card style={{ gap: 12 }}>
        <Text variant="bodyStrong">Ton régime</Text>
        <SegmentedControl<Diet>
          accessibilityLabel="Régime alimentaire"
          value={mine.diet}
          onChange={(diet) => save({ diet })}
          options={(Object.keys(DIET_LABELS) as Diet[]).map((d) => ({ value: d, label: d === 'pescetarien' ? 'Pesco' : DIET_LABELS[d] }))}
        />
      </Card>

      <Card style={{ gap: 12 }}>
        <Text variant="bodyStrong">Allergies et intolérances</Text>
        <Text variant="label" tone="secondary">Les 14 allergènes réglementaires (UE). Le scan te prévient aussi si un produit en contient.</Text>
        <View style={styles.wrap}>
          {ALLERGENS.map((a) => {
            const on = mine.allergens.includes(a.id);
            return (
              <Chip
                key={a.id}
                label={a.label}
                selected={on}
                accessibilityLabel={`${a.label}${a.hint ? ` (${a.hint})` : ''}`}
                onPress={() => {
                  save({ allergens: on ? mine.allergens.filter((x) => x !== a.id) : [...mine.allergens, a.id] });
                  if (!on) snackbar.show(`${a.label} : recettes concernées retirées des suggestions`);
                }}
              />
            );
          })}
        </View>
      </Card>

      <Card style={{ gap: 12 }}>
        <Text variant="bodyStrong">Aliments que tu n’aimes pas</Text>
        <View style={styles.wrap}>
          {mine.dislikes.map((id) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${INGREDIENTS_BY_ID[id]?.name ?? id}`}
              onPress={() => save({ dislikes: mine.dislikes.filter((x) => x !== id) })}
              style={[styles.dislike, { backgroundColor: colors.surface2 }]}
            >
              <Text variant="label">{INGREDIENTS_BY_ID[id]?.name ?? id}</Text>
              <X size={14} color={colors.textSecondary} />
            </Pressable>
          ))}
          {!mine.dislikes.length && <Text variant="label" tone="secondary">Aucun pour l’instant.</Text>}
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ajouter : champignons, poivron…"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Ajouter un aliment que tu n’aimes pas"
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />
        {results.length > 0 && (
          <View style={styles.wrap}>
            {results.map((i) => (
              <Chip key={i.id} label={`+ ${i.name}`} onPress={() => { save({ dislikes: [...mine.dislikes, i.id] }); setQuery(''); }} />
            ))}
          </View>
        )}
      </Card>

      {others.length > 0 && (
        <>
          <Text variant="overline" tone="secondary">Le reste du foyer</Text>
          <Card style={{ paddingVertical: 6 }}>
            {others.map((m, i) => (
              <View key={`${m.name}-${i}`} style={[styles.member, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <Text variant="bodyStrong">{m.name}</Text>
                <Text variant="label" tone="secondary">
                  {DIET_LABELS[m.diet]}
                  {m.allergens.length ? ` · Allergies : ${m.allergens.map((a) => ALLERGEN_LABELS[a]).join(', ')}` : ''}
                  {m.dislikes.length ? ` · N’aime pas : ${m.dislikes.map((d) => INGREDIENTS_BY_ID[d]?.name ?? d).join(', ')}` : ''}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dislike: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, minHeight: 36 },
  input: { minHeight: MIN_TOUCH + 4, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontFamily: 'DMSans_500Medium', fontSize: 16 },
  member: { paddingVertical: 10, gap: 2 },
});
