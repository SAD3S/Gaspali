import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Check, Plus, ShoppingCart, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, Card, Screen, Text, useSnackbar } from '@/components/ui';
import { addShopping, clearChecked, removeShopping, setChecked, shoppingQuery } from '@/db/shoppingRepo';
import { resolveIngredient } from '@/domain/ingredientMatch';
import { formatNumber } from '@/domain/quantity';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

/** Liste de courses partagée, regroupée par rayon (étape 8 : passage dans l'inventaire, articles habituels). */
export default function Courses() {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const { data } = useLiveQuery(shoppingQuery());
  const [text, setText] = useState('');

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

  const add = () => {
    const name = text.trim();
    if (!name) return;
    addShopping([{ name, ingredientId: resolveIngredient(name)?.id ?? null }]);
    setText('');
  };

  return (
    <Screen>
      <View style={styles.head}>
        <Text variant="title1" accessibilityRole="header">Courses</Text>
        {total > 0 && <Text variant="label" tone="secondary">{total - checkedCount} à acheter</Text>}
      </View>

      <View style={styles.addRow}>
        <TextInput
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
        <Pressable accessibilityRole="button" accessibilityLabel="Ajouter" onPress={add} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
          <Plus size={22} color={colors.onPrimary} />
        </Pressable>
      </View>

      {total === 0 && (
        <View style={styles.empty}>
          <ShoppingCart size={40} color={colors.textSecondary} />
          <Text variant="bodyStrong">Ta liste est vide</Text>
          <Text variant="body" tone="secondary" style={styles.center}>Ajoute des articles ici, ou les ingrédients manquants depuis une recette.</Text>
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
                    {r.quantity != null ? <Text variant="label" tone="secondary">{`  ${formatNumber(r.quantity)}${r.unit ? ` ${r.unit}` : ''}`}</Text> : null}
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Retirer ${r.name}`} onPress={() => removeShopping(r.id)} style={styles.remove}>
                  <X size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            ))}
          </Card>
        </View>
      ))}

      {checkedCount > 0 && (
        <Button
          label={`Retirer les ${checkedCount} article${checkedCount > 1 ? 's' : ''} coché${checkedCount > 1 ? 's' : ''}`}
          variant="outline"
          onPress={() => snackbar.show(`${clearChecked()} article(s) retiré(s)`)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
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
