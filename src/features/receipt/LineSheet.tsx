import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BottomSheet, Button, Chip, Field, Text } from '@/components/ui';
import { CATEGORY_LIST, getCategory, type CategoryId, type Location } from '@/domain/categories';
import { ingredientOfName } from '@/domain/receiptMatch';
import { estimateExpiry, purchaseDate, type ReviewLine } from '@/domain/receiptReview';
import { ItemForm, type ItemFormValue } from '@/features/inventory/ItemForm';

interface Props {
  line: ReviewLine | null;
  /** Date d'achat lue sur le ticket (pour réestimer la date limite). */
  purchased: Date | null;
  onClose: () => void;
  onSave: (line: ReviewLine) => void;
}

function parsePrice(s: string): number | null {
  const n = Number(s.replace(',', '.').replace(/[^\d.]/g, ''));
  return s.trim() && Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Correction d'une ligne du ticket : nom, catégorie, date, quantité, emplacement, prix. */
export function LineSheet({ line, purchased, onClose, onSave }: Props) {
  const { height } = useWindowDimensions();
  const [name, setName] = useState(line?.name ?? '');
  const [category, setCategory] = useState<CategoryId>(line?.category ?? 'autre');
  const [form, setForm] = useState<ItemFormValue>(() => ({
    dateType: line?.dateType ?? 'DLC',
    expiresAt: line?.expiresAt ?? new Date(),
    quantity: line?.quantity ?? 1,
    unit: line?.unit ?? 'pièce',
    location: line?.location ?? 'frigo',
  }));
  const [confirmed, setConfirmed] = useState(line?.dateConfirmed ?? false);
  const [price, setPrice] = useState(line?.price != null ? line.price.toFixed(2).replace('.', ',') : '');
  if (!line) return null;

  const bought = purchaseDate({ date: purchased });
  const estimate = (c: CategoryId, location: Location) => estimateExpiry(c, location, bought);

  const changeCategory = (c: CategoryId) => {
    setCategory(c);
    if (confirmed) return;
    const cat = getCategory(c);
    setForm((f) => ({ ...f, dateType: cat.dateType, location: cat.location, expiresAt: estimate(c, cat.location) }));
  };

  return (
    <BottomSheet visible onClose={onClose}>
      <ScrollView style={{ maxHeight: height * 0.8 }} contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 2 }}>
          <Text variant="title2">Corriger la ligne</Text>
          <Text variant="label" tone="secondary">Sur le ticket : {line.raw}</Text>
        </View>
        <Field label="Nom du produit" value={name} onChangeText={setName} autoCapitalize="sentences" returnKeyType="done" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {[getCategory(line.category), ...CATEGORY_LIST.filter((c) => c.id !== line.category)].map((c) => (
            <Chip key={c.id} label={c.label} selected={category === c.id} onPress={() => changeCategory(c.id)} />
          ))}
        </ScrollView>
        <ItemForm
          value={form}
          onChange={(v) => {
            if (v.expiresAt.getTime() !== form.expiresAt.getTime() || v.dateType !== form.dateType) setConfirmed(true);
            setForm(v);
          }}
          onLocationChange={(location) => setForm((f) => ({ ...f, location, ...(confirmed ? {} : { expiresAt: estimate(category, location) }) }))}
        />
        {!confirmed && <Text variant="label" tone="secondary">Date estimée selon le type de produit : ajuste-la si tu la vois sur l’emballage.</Text>}
        <Field label="Prix payé (€)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" hint="Sert aux statistiques" />
        <Text variant="label" tone="secondary">Gaspalli retiendra ce nom pour ce libellé de ticket.</Text>
        <View style={{ gap: 8 }}>
          <Button
            size="lg"
            label="Valider"
            disabled={!name.trim()}
            onPress={() =>
              onSave({
                ...line,
                ...form,
                name: name.trim(),
                category,
                ingredientId: ingredientOfName(name),
                source: 'alias',
                dateConfirmed: confirmed,
                price: parsePrice(price),
                include: true,
              })
            }
          />
          <Button label="Ne pas ajouter" variant="outline" onPress={() => onSave({ ...line, include: false })} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ row: { gap: 8 } });
