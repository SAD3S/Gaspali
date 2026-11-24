import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Chip, Text } from '@/components/ui';
import { INGREDIENTS_BY_ID } from '@/data/ingredients';
import type { ShoppingRow } from '@/db/schema';
import { CATEGORY_LIST, getCategory, type CategoryId, type Location } from '@/domain/categories';
import { defaultExpiry } from '@/domain/inventory';
import { ItemForm, type ItemFormValue } from '@/features/inventory/ItemForm';

/** Catégorie probable d'un article de courses (ingrédient reconnu, sinon « autre »). */
export function categoryOf(row: Pick<ShoppingRow, 'ingredientId'>): CategoryId {
  return (row.ingredientId && INGREDIENTS_BY_ID[row.ingredientId]?.category) || 'autre';
}

export function defaultForm(category: CategoryId, quantity: number | null, unit: string | null): ItemFormValue {
  const c = getCategory(category);
  return { dateType: c.dateType, expiresAt: defaultExpiry(category, c.location), quantity: quantity ?? 1, unit: unit ?? 'pièce', location: c.location };
}

interface Props {
  row: ShoppingRow | null;
  onClose: () => void;
  onStore: (row: ShoppingRow, category: CategoryId, form: ItemFormValue, dateTouched: boolean) => void;
}

/** Article acheté → inventaire, avec la même feuille date / quantité / emplacement que le scan. */
export function StoreSheet({ row, onClose, onStore }: Props) {
  const initialCategory = row ? categoryOf(row) : 'autre';
  const [category, setCategory] = useState<CategoryId>(initialCategory);
  const [form, setForm] = useState<ItemFormValue>(() => defaultForm(initialCategory, row?.quantity ?? null, row?.unit ?? null));
  const [touched, setTouched] = useState(false);
  if (!row) return null;

  return (
    <BottomSheet visible onClose={onClose}>
      <ScrollView style={{ maxHeight: 600 }} contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
        <Text variant="title2">Ranger « {row.name} »</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {/* La catégorie devinée d'abord, pour qu'elle soit visible sans défiler. */}
          {[getCategory(initialCategory), ...CATEGORY_LIST.filter((c) => c.id !== initialCategory)].map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              selected={category === c.id}
              onPress={() => {
                setCategory(c.id);
                if (!touched) setForm(defaultForm(c.id, form.quantity, form.unit));
              }}
            />
          ))}
        </ScrollView>
        <ItemForm
          value={form}
          onChange={(v) => {
            if (v.expiresAt.getTime() !== form.expiresAt.getTime() || v.dateType !== form.dateType) setTouched(true);
            setForm(v);
          }}
          onLocationChange={(location: Location) =>
            setForm((f) => ({ ...f, location, ...(touched ? {} : { expiresAt: defaultExpiry(category, location) }) }))
          }
        />
        {!touched && <Text variant="label" tone="secondary">Date estimée selon le type de produit : ajuste-la si tu la connais.</Text>}
        <View style={{ gap: 8 }}>
          <Button size="lg" label="Ajouter à l’inventaire" onPress={() => onStore(row, category, form, touched)} />
          <Button label="Annuler" variant="outline" onPress={onClose} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ row: { gap: 8 } });
