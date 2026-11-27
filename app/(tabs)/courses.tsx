import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { Archive, Check, ListChecks, Plus, ReceiptText, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { Button, Card, Screen, Text, useSnackbar } from '@/components/ui';
import { addItem } from '@/db/inventoryRepo';
import type { ShoppingRow } from '@/db/schema';
import { addShopping, clearChecked, removeShopping, repairNumberedItems, setChecked, shoppingQuery } from '@/db/shoppingRepo';
import { LOCATION_LABELS } from '@/domain/categories';
import { SavedListsSheet } from '@/features/shopping/SavedListsSheet';
import { categoryOf, defaultForm, StoreSheet } from '@/features/shopping/StoreSheet';
import { resolveIngredient } from '@/domain/ingredientMatch';
import { alreadyInStock, alreadyMessage } from '@/domain/duplicates';
import { categoryFromKeywords } from '@/domain/receiptMatch';
import { useInventory } from '@/features/inventory/hooks';
import { parseShoppingInput } from '@/domain/shoppingInput';
import { formatQuantity } from '@/domain/quantity';
import { EmptyState } from '@/components/brand/EmptyState';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

/** Liste de courses partagée, regroupée par rayon (étape 8 : passage dans l'inventaire, articles habituels). */
export default function Courses() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { data } = useLiveQuery(shoppingQuery());
  const [text, setText] = useState('');
  const [storing, setStoring] = useState<ShoppingRow | null>(null);
  const [listsOpen, setListsOpen] = useState(false);

  const groups = useMemo(() => {
    const rows = data ?? [];
    const byAisle = new Map<string, typeof rows>();
    for (const r of [...rows].sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, 'fr'))) {
      const list = byAisle.get(r.aisle) ?? [];
      list.push(r);
      byAisle.set(r.aisle, list);
    }
    return [...byAisle.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [data]);
  const checkedCount = (data ?? []).filter((r) => r.checked).length;
  const total = (data ?? []).length;

  const input = useRef<TextInputInstance>(null);
  const stock = useInventory();
  // Articles saisis avant que l'app lise les quantités (« 5 jus de pomme ») : remis en ordre une fois.
  useEffect(() => {
    repairNumberedItems();
  }, []);
  // « + » : ajoute l'article tapé et garde le clavier ouvert pour le suivant ; champ vide → on y place le curseur.
  const add = () => {
    const name = text.trim();
    if (!name) {
      input.current?.focus();
      return;
    }
    // « 5 jus de pomme » → 5 × « Jus de pomme », rangé en Boissons (ingrédient connu, sinon mots-clés).
    const parsed = parseShoppingInput(name);
    const ingredient = resolveIngredient(parsed.name);
    const ids = addShopping([
      {
        name: parsed.name,
        quantity: parsed.quantity,
        unit: parsed.unit,
        ingredientId: ingredient?.id ?? null,
        category: ingredient ? undefined : (categoryFromKeywords(parsed.name) ?? undefined),
      },
    ]);
    // « Déjà au frigo ! » : on prévient, avec « Annuler » pour retirer l'article.
    const already = alreadyMessage(alreadyInStock(stock, { name: parsed.name, ingredientId: ingredient?.id ?? null }));
    if (already && ids.length) snackbar.show(already, () => ids.forEach(removeShopping));
    setText('');
    input.current?.focus();
  };

  return (
    <Screen thread={3}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text variant="title1" accessibilityRole="header">Courses</Text>
          {total > 0 && <Text variant="label" tone="secondary">{total - checkedCount} à acheter</Text>}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mes listes enregistrées"
          accessibilityHint="Enregistre la liste sous un nom ou réutilise une liste"
          onPress={() => setListsOpen(true)}
          style={[styles.lists, { backgroundColor: colors.primarySoft }]}
        >
          <ListChecks size={18} color={colors.primaryText} />
          <Text variant="label" tone="primary" style={styles.bold}>Mes listes</Text>
        </Pressable>
      </View>

      <View style={styles.addRow}>
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
          placeholder="Ajouter un article"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Ajouter un article à la liste"
          returnKeyType="done"
          blurOnSubmit={false}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Ajouter" accessibilityHint="Ajoute l’article tapé à la liste" onPress={add} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
          <Plus size={22} color={colors.onPrimary} />
        </Pressable>
      </View>

      {total === 0 && (
        <View style={styles.empty}>
          <EmptyState title="Ta liste est vide" text="Ajoute des articles ici, les ingrédients manquants depuis une recette, ou reprends une liste enregistrée.">
            <Button label="Reprendre une liste enregistrée" variant="soft" onPress={() => setListsOpen(true)} />
          </EmptyState>
        </View>
      )}

      {groups.map(([aisle, rows]) => (
        <View key={aisle} style={{ gap: 8 }}>
          <Text variant="overline" tone="secondary" accessibilityRole="header">{aisle}</Text>
          <Card style={{ paddingVertical: 4 }}>
            {rows.map((r, i) => (
              <View key={r.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: r.checked }}
                  accessibilityLabel={r.name}
                  onPress={() => setChecked(r.id, !r.checked)}
                  style={styles.check}
                >
                  <View style={[styles.box, { borderColor: r.checked ? colors.primary : colors.border, backgroundColor: r.checked ? colors.primary : 'transparent' }]}>
                    {r.checked && <Check size={16} color={colors.onPrimary} />}
                  </View>
                  <Text variant="body" style={[styles.flex, r.checked && { textDecorationLine: 'line-through', color: colors.textSecondary }]}>
                    {r.name}
                    {r.quantity != null ? <Text variant="label" tone="secondary">{r.unit ? `  ${formatQuantity(r.quantity, r.unit)}` : `  × ${formatQuantity(r.quantity, '')}`}</Text> : null}
                  </Text>
                </Pressable>
                {r.checked && (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Ranger ${r.name} dans l’inventaire`} onPress={() => setStoring(r)} style={styles.remove}>
                    <Archive size={18} color={colors.primaryText} />
                  </Pressable>
                )}
                <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${r.name}`} onPress={() => removeShopping(r.id)} style={styles.remove}>
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))}
          </Card>
        </View>
      ))}

      {checkedCount > 0 && (
        <View style={{ gap: 10 }}>
          <Text variant="label" tone="secondary">Articles achetés : touche la boîte pour les ranger un par un avec leur date, ou range tout d’un coup avec des dates estimées.</Text>
          <Button
            label={`Tout ranger dans l’inventaire (${checkedCount})`}
            onPress={() => {
              const done = (data ?? []).filter((r) => r.checked);
              for (const r of done) {
                const category = categoryOf(r);
                addItem({ name: r.name, category, ...defaultForm(category, r.quantity, r.unit), expiryEstimated: true });
                removeShopping(r.id);
              }
              snackbar.show(`${done.length} produit${done.length > 1 ? 's' : ''} rangé${done.length > 1 ? 's' : ''} (dates estimées)`);
            }}
          />
          <Button
            label={`Retirer les ${checkedCount} article${checkedCount > 1 ? 's' : ''} coché${checkedCount > 1 ? 's' : ''}`}
            variant="outline"
            onPress={() => snackbar.show(`${clearChecked()} article(s) retiré(s)`)}
          />
        </View>
      )}

      {total > 0 && (
        <Button
          label="Scanner le ticket de caisse"
          variant="soft"
          icon={<ReceiptText size={18} color={colors.primaryText} />}
          accessibilityHint="Ajoute tes achats à l’inventaire avec leurs prix, et les retire de la liste"
          onPress={() => router.push({ pathname: '/scan', params: { onglet: 'ticket' } })}
        />
      )}

      <SavedListsSheet visible={listsOpen} onClose={() => setListsOpen(false)} current={data ?? []} />
      <StoreSheet
        key={storing?.id ?? 'aucun'}
        row={storing}
        onClose={() => setStoring(null)}
        onStore={(row, category, form, touched) => {
          addItem({ name: row.name, category, ...form, expiryEstimated: !touched });
          removeShopping(row.id);
          setStoring(null);
          snackbar.show(`Rangé au ${LOCATION_LABELS[form.location].toLowerCase()} : ${row.name}`);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lists: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: MIN_TOUCH, borderRadius: 999 },
  bold: { fontFamily: 'DMSans_700Bold' },
  addRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, minHeight: 50, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontFamily: 'DMSans_400Regular', fontSize: 16 },
  addBtn: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, marginTop: 60 },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  check: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TOUCH },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  remove: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
