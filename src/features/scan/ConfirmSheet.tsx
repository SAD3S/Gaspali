import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Chip, ProductAvatar, Sheet, Text } from '@/components/ui';
import { CATEGORY_LIST, getCategory, type CategoryId, type Location } from '@/domain/categories';
import type { ScannedProduct } from '@/domain/offProduct';
import { formatQuantity } from '@/domain/quantity';
import { ItemForm, type ItemFormValue } from '@/features/inventory/ItemForm';
import { ALLERGEN_LABELS, allergensFromOff } from '@/data/allergens';
import { useHouseholdPrefs } from '@/features/recipes/hooks';
import { useTheme } from '@/theme/ThemeProvider';

export type SheetProduct =
  | { kind: 'found'; product: ScannedProduct; source: 'off' | 'manuel' }
  | { kind: 'unknown'; barcode: string; offline: boolean };

interface Props {
  target: SheetProduct;
  form: ItemFormValue;
  onFormChange: (v: ItemFormValue) => void;
  onLocationChange: (l: Location) => void;
  onReadDate: () => void;
  /** Produit inconnu : nom et catégorie saisis. */
  unknownName: string;
  onUnknownName: (s: string) => void;
  unknownCategory: CategoryId;
  onUnknownCategory: (c: CategoryId) => void;
  burst: boolean;
  onAdd: () => void;
  onCancel: () => void;
}

/** Feuille de confirmation après un scan (maquette « Ajout après scan »). */
export function ConfirmSheet(p: Props) {
  const { colors, freshness } = useTheme();
  const [focused, setFocused] = useState(false);
  const found = p.target.kind === 'found' ? p.target : null;
  const { members } = useHouseholdPrefs();
  // Allergènes du produit (Open Food Facts) déclarés par un membre du foyer.
  const conflicts = found
    ? allergensFromOff(found.product.allergens).flatMap((a) =>
        members.filter((m) => m.allergens.includes(a)).map((m) => `${ALLERGEN_LABELS[a]} (${m.name === 'Toi' ? 'toi' : m.name})`),
      )
    : [];
  const name = found ? found.product.name : p.unknownName;
  const canAdd = name.trim().length > 0;

  return (
    <Sheet style={styles.sheet}>
      <ScrollView contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {found ? (
          <View style={styles.row}>
            <ProductAvatar name={found.product.name} state="urgent" size={56} imageUri={found.product.imageUrl ?? undefined} />
            <View style={styles.flex}>
              <Text variant="title2" numberOfLines={2}>{found.product.name}</Text>
              <Text variant="body" tone="secondary" numberOfLines={1}>
                {[
                  found.product.packUnit !== 'pièce' || found.product.packQuantity > 1 ? formatQuantity(found.product.packQuantity, found.product.packUnit) : null,
                  getCategory(found.product.category).label,
                ].filter(Boolean).join(' · ')}
              </Text>
              <Text variant="label" tone="secondary" style={styles.small}>
                {found.source === 'off' ? 'Trouvé via Open Food Facts' : 'Produit que tu as déjà enregistré'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Text variant="title2">Produit inconnu</Text>
            <Text variant="label" tone="secondary">
              {p.target.kind === 'unknown' && p.target.offline
                ? 'Pas de connexion pour l’instant. Donne-lui un nom, on retiendra ce code-barres.'
                : 'Ce code-barres n’est pas dans Open Food Facts. Donne-lui un nom, on s’en souviendra la prochaine fois.'}
            </Text>
            <TextInput
              autoFocus
              value={p.unknownName}
              onChangeText={p.onUnknownName}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Nom du produit"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Nom du produit"
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface2, borderColor: focused ? colors.primary : colors.surface2 }]}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
              {CATEGORY_LIST.map((c) => (
                <Chip key={c.id} label={c.label} selected={p.unknownCategory === c.id} onPress={() => p.onUnknownCategory(c.id)} />
              ))}
            </ScrollView>
          </View>
        )}

        {conflicts.length > 0 && (
          <View accessibilityRole="alert" style={[styles.warning, { backgroundColor: freshness.perime.bg }]}>
            <Text variant="bodyStrong" color={freshness.perime.fg}>Attention, allergène déclaré</Text>
            <Text variant="label" color={freshness.perime.fg}>Contient : {conflicts.join(', ')}.</Text>
          </View>
        )}

        <ItemForm
          value={p.form}
          onChange={p.onFormChange}
          onLocationChange={p.onLocationChange}
          onReadDate={p.onReadDate}
          showUnits={false}
        />

        <View style={{ gap: 6 }}>
          <Button size="lg" label={p.burst ? 'Ajouter et scanner le suivant' : 'Ajouter'} onPress={p.onAdd} disabled={!canAdd} />
          <Button label="Ignorer ce produit" variant="outline" onPress={p.onCancel} style={styles.ghost} />
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  small: { fontSize: 12 },
  input: { fontFamily: 'DMSans_500Medium', fontSize: 17, borderRadius: 14, borderWidth: 2, paddingHorizontal: 14, minHeight: 52 },
  ghost: { borderWidth: 0, backgroundColor: 'transparent' },
  warning: { borderRadius: 14, padding: 12, gap: 2 },
});
