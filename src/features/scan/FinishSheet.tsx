import { Check, ChevronRight, Trash2 } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Pepin } from '@/components/brand/Pepin';
import { Button, FreshnessBadge, ProductAvatar, Sheet, Text } from '@/components/ui';
import type { InventoryRow } from '@/db/schema';
import { LOCATION_LABELS } from '@/domain/categories';
import { computeFreshness } from '@/domain/freshness';
import type { Item } from '@/domain/inventory';
import { formatQuantity } from '@/domain/quantity';
import { useTheme } from '@/theme/ThemeProvider';

export interface FinishTarget {
  code: string;
  name: string | null;
  items: (Item & { row: InventoryRow })[];
}

interface Props {
  target: FinishTarget;
  onFinish: (item: Item & { row: InventoryRow }, status: 'consomme' | 'jete') => void;
  onOpen: (id: string) => void;
  onAddInstead: () => void;
  onCancel: () => void;
}

/** Scan « Finir un produit » : consommé ou jeté en un geste, sans chercher dans la liste. */
export function FinishSheet({ target, onFinish, onOpen, onAddInstead, onCancel }: Props) {
  const { colors } = useTheme();

  if (!target.items.length) {
    return (
      <Sheet style={styles.sheet}>
        <View style={{ gap: 14 }}>
          <View style={styles.row}>
            <Pepin size={64} mood="oups" />
            <View style={styles.flex}>
              <Text variant="title2">Pas dans ton inventaire</Text>
              <Text variant="body" tone="secondary">
                {target.name ? `« ${target.name} » n’est pas en stock.` : 'Ce code-barres ne correspond à aucun produit de ton inventaire.'}
              </Text>
            </View>
          </View>
          <Button size="lg" label="L’ajouter à l’inventaire" onPress={onAddInstead} />
          <Button label="Scanner un autre produit" variant="outline" onPress={onCancel} />
        </View>
      </Sheet>
    );
  }

  const several = target.items.length > 1;
  return (
    <Sheet style={styles.sheet}>
      <ScrollView contentContainerStyle={{ gap: 12 }}>
        <Text variant="title2">{several ? 'Lequel as-tu fini ?' : 'Tu as fini ce produit ?'}</Text>
        {target.items.map((item) => {
          const f = computeFreshness(item.expiresAt, item.dateType);
          return (
            <View key={item.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir ${item.name}`} onPress={() => onOpen(item.id)} style={styles.row}>
                <ProductAvatar name={item.name} state={f.state} size={48} imageUri={item.row.imageUrl ?? undefined} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={2}>{item.name}</Text>
                  <Text variant="label" tone="secondary">
                    {formatQuantity(item.quantity, item.unit)} · {LOCATION_LABELS[item.location]}
                  </Text>
                </View>
                <FreshnessBadge state={f.state} label={f.label} />
                <ChevronRight size={18} color={colors.textSecondary} />
              </Pressable>
              <View style={styles.actions}>
                <Button label="Consommé" icon={<Check size={18} color={colors.onPrimary} />} onPress={() => onFinish(item, 'consomme')} style={styles.flex} />
                <Button label="Jeté" variant="outline" icon={<Trash2 size={18} color={colors.text} />} onPress={() => onFinish(item, 'jete')} style={styles.flex} />
              </View>
            </View>
          );
        })}
        <Text variant="label" tone="secondary">Une partie seulement ? Touche le produit pour ouvrir sa fiche.</Text>
        <Button label="Annuler" variant="outline" onPress={onCancel} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '75%' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { borderWidth: 1, borderRadius: 18, padding: 12, gap: 10 },
  actions: { flexDirection: 'row', gap: 8 },
});
