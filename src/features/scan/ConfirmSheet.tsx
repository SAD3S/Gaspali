import { Camera } from 'lucide-react-native';
import { Pepin } from '@/components/brand/Pepin';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button, Chip, ProductAvatar, Sheet, Text } from '@/components/ui';
import { CATEGORY_LIST, getCategory, type CategoryId, type Location } from '@/domain/categories';
import type { ScannedProduct } from '@/domain/offProduct';
import type { PriceHint } from '@/domain/prices';
import { unitPriceLabel } from '@/domain/prices';
import { formatNumber, formatQuantity } from '@/domain/quantity';
import { ItemForm, type ItemFormValue } from '@/features/inventory/ItemForm';
import { ALLERGEN_LABELS, allergensFromOff } from '@/data/allergens';
import { useHouseholdPrefs } from '@/features/recipes/hooks';
import { useTheme } from '@/theme/ThemeProvider';

export interface ProductDetails {
  name: string;
  category: CategoryId;
  /** Contenance d'un exemplaire : 250 g, 1,5 L, 1 pièce… */
  packQuantity: number;
  packUnit: string;
}

const PACK_UNITS = ['g', 'kg', 'cl', 'L', 'pièce'];

export type SheetProduct =
  | { kind: 'found'; product: ScannedProduct; source: 'off' | 'manuel'; productId: string }
  | { kind: 'unknown'; barcode: string; offline: boolean };

interface Props {
  target: SheetProduct;
  form: ItemFormValue;
  onFormChange: (v: ItemFormValue) => void;
  onLocationChange: (l: Location) => void;
  onReadDate: () => void;
  /** La date n'a pas encore été lue ni choisie : c'est une estimation selon la catégorie. */
  dateEstimated: boolean;
  /** « Déjà au frigo ! » : ce produit est déjà en stock (message prêt), sinon null. */
  already: string | null;
  /** Nom, catégorie et contenance, modifiables (pré-remplis par Open Food Facts). */
  details: ProductDetails;
  onDetails: (patch: Partial<ProductDetails>) => void;
  onCategory: (c: CategoryId) => void;
  burst: boolean;
  /** Prix suggérés (dernier prix payé, prix relevés), déjà multipliés par la quantité. */
  priceHints: PriceHint[];
  onAdd: () => void;
  onCancel: () => void;
}

/** Feuille de confirmation après un scan (maquette « Ajout après scan »). */
export function ConfirmSheet(p: Props) {
  const { colors, freshness } = useTheme();
  const [focused, setFocused] = useState<'nom' | 'pack' | null>(null);
  const [packText, setPackText] = useState(formatNumber(p.details.packQuantity));
  const [showCategories, setShowCategories] = useState(false);
  const found = p.target.kind === 'found' ? p.target : null;
  const { members } = useHouseholdPrefs();
  // Allergènes du produit (Open Food Facts) déclarés par un membre du foyer.
  const conflicts = found
    ? allergensFromOff(found.product.allergens).flatMap((a) =>
        members.filter((m) => m.allergens.includes(a)).map((m) => `${ALLERGEN_LABELS[a]} (${m.name === 'Toi' ? 'toi' : m.name})`),
      )
    : [];
  const canAdd = p.details.name.trim().length > 0 && p.details.packQuantity > 0;

  return (
    <Sheet style={styles.sheet}>
      <ScrollView contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.row}>
          {found && <ProductAvatar name={p.details.name || found.product.name} state="urgent" size={56} imageUri={found.product.imageUrl ?? undefined} />}
          <View style={styles.flex}>
            {!found && <Text variant="title2">Produit inconnu</Text>}
            <Text variant="label" tone="secondary" style={styles.small}>
              {found
                ? found.source === 'off'
                  ? 'Trouvé via Open Food Facts : corrige si besoin, on s’en souviendra'
                  : 'Produit que tu as déjà enregistré'
                : p.target.kind === 'unknown' && p.target.offline
                  ? 'Pas de connexion pour l’instant. Donne-lui un nom, on retiendra ce code-barres.'
                  : 'Ce code-barres n’est pas dans Open Food Facts. Donne-lui un nom, on s’en souviendra.'}
            </Text>
          </View>
        </View>

        {p.already && (
          <View style={[styles.already, { backgroundColor: colors.primarySoft }]} accessibilityRole="alert">
            <Pepin size={40} mood="clin" />
            <View style={styles.flex}>
              <Text variant="bodyStrong" tone="primary">Déjà au frigo !</Text>
              <Text variant="label" tone="primary">{p.already}</Text>
            </View>
          </View>
        )}

        <View style={{ gap: 6 }}>
          <Text variant="label" tone="secondary">Nom</Text>
          <TextInput
            autoFocus={!found}
            value={p.details.name}
            onChangeText={(name) => p.onDetails({ name })}
            onFocus={() => setFocused('nom')}
            onBlur={() => setFocused(null)}
            placeholder="Nom du produit"
            placeholderTextColor={colors.textSecondary}
            accessibilityLabel="Nom du produit"
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface2, borderColor: focused === 'nom' ? colors.primary : colors.surface2 }]}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text variant="label" tone="secondary">Contenance d’un exemplaire</Text>
          <View style={styles.packRow}>
            <TextInput
              value={packText}
              onChangeText={(t) => {
                setPackText(t);
                const v = parseFloat(t.replace(',', '.'));
                if (v > 0) p.onDetails({ packQuantity: Math.round(v * 1000) / 1000 });
              }}
              onFocus={() => setFocused('pack')}
              onBlur={() => {
                setFocused(null);
                setPackText(formatNumber(p.details.packQuantity));
              }}
              keyboardType="decimal-pad"
              accessibilityLabel="Contenance d’un exemplaire"
              maxLength={7}
              style={[styles.input, styles.packInput, { color: colors.text, backgroundColor: colors.surface2, borderColor: focused === 'pack' ? colors.primary : colors.surface2 }]}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} keyboardShouldPersistTaps="handled">
              {PACK_UNITS.map((u) => (
                <Chip
                  key={u}
                  label={u}
                  selected={p.details.packUnit === u}
                  onPress={() => {
                    // Changer d'unité garde une valeur plausible (500 g ↔ 0,5 kg).
                    const q = convertPack(p.details.packQuantity, p.details.packUnit, u);
                    p.onDetails({ packUnit: u, packQuantity: q });
                    setPackText(formatNumber(q));
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <View style={styles.between}>
            <Text variant="label" tone="secondary">Catégorie</Text>
            {found && !showCategories && (
              <Pressable accessibilityRole="button" onPress={() => setShowCategories(true)} hitSlop={8}>
                <Text variant="label" tone="primary" style={styles.bold}>{getCategory(p.details.category).label} · Changer</Text>
              </Pressable>
            )}
          </View>
          {(!found || showCategories) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
              {[getCategory(p.details.category), ...CATEGORY_LIST.filter((c) => c.id !== p.details.category)].map((c) => (
                <Chip key={c.id} label={c.label} selected={p.details.category === c.id} onPress={() => p.onCategory(c.id)} />
              ))}
            </ScrollView>
          )}
        </View>

        {conflicts.length > 0 && (
          <View accessibilityRole="alert" style={[styles.warning, { backgroundColor: freshness.perime.bg }]}>
            <Text variant="bodyStrong" color={freshness.perime.fg}>Attention, allergène déclaré</Text>
            <Text variant="label" color={freshness.perime.fg}>Contient : {conflicts.join(', ')}.</Text>
          </View>
        )}

        {p.dateEstimated && (
          <View style={[styles.estimate, { backgroundColor: freshness.a_verifier.bg }]}>
            <View style={styles.flex}>
              <Text variant="bodyStrong" color={freshness.a_verifier.fg}>Date estimée</Text>
              <Text variant="label" color={freshness.a_verifier.fg}>
                Selon le type de produit ({getCategory(p.details.category).label.toLowerCase()}). Lis la vraie date sur l’emballage pour des alertes justes.
              </Text>
            </View>
            <Button label="Lire la date" size="md" icon={<Camera size={18} color={colors.onPrimary} />} onPress={p.onReadDate} />
          </View>
        )}

        <ItemForm
          value={p.form}
          onChange={p.onFormChange}
          onLocationChange={p.onLocationChange}
          onReadDate={p.onReadDate}
          showUnits={false}
          showPrice
          priceHints={p.priceHints}
          quantityLabel="Nombre"
          priceNote={unitPriceLabel(p.form.price, p.form.quantity, p.details.packQuantity, p.details.packUnit)}
        />
        <Text variant="label" tone="secondary">
          Au total : {formatQuantity(p.form.quantity * p.details.packQuantity, p.details.packUnit)}
          {p.form.quantity > 1 ? ` (${formatNumber(p.form.quantity)} × ${formatQuantity(p.details.packQuantity, p.details.packUnit)})` : ''}
        </Text>

        <View style={{ gap: 6 }}>
          <Button size="lg" label={p.burst ? 'Ajouter et scanner le suivant' : 'Ajouter'} onPress={p.onAdd} disabled={!canAdd} />
          <Button label="Ignorer ce produit" variant="outline" onPress={p.onCancel} style={styles.ghost} />
        </View>
      </ScrollView>
    </Sheet>
  );
}

/** 500 g → 0,5 kg, 50 cl → 0,5 L ; entre familles différentes, la valeur est gardée telle quelle. */
function convertPack(q: number, from: string, to: string): number {
  const toBase: Record<string, [string, number]> = { g: ['m', 1], kg: ['m', 1000], cl: ['v', 10], L: ['v', 1000], ml: ['v', 1] };
  const a = toBase[from];
  const b = toBase[to];
  if (!a || !b || a[0] !== b[0]) return q;
  return Math.round(((q * a[1]) / b[1]) * 1000) / 1000;
}

const styles = StyleSheet.create({
  already: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 10 },
  estimate: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontFamily: 'DMSans_700Bold' },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  packInput: { width: 96, textAlign: 'right' },
  sheet: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  small: { fontSize: 12 },
  input: { fontFamily: 'DMSans_500Medium', fontSize: 17, borderRadius: 14, borderWidth: 2, paddingHorizontal: 14, minHeight: 52 },
  ghost: { borderWidth: 0, backgroundColor: 'transparent' },
  warning: { borderRadius: 14, padding: 12, gap: 2 },
});
