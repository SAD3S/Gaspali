import { Refrigerator, Snowflake } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Pepin } from '@/components/brand/Pepin';
import { BottomSheet, Button, Stepper, Text, useSnackbar } from '@/components/ui';
import { addItem, setStatus } from '@/db/inventoryRepo';
import { getCategory } from '@/domain/categories';
import { addDays } from '@/domain/dates';
import { formatDuration } from '@/domain/inventory';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Après « J'ai cuisiné ça » : « Il en reste ? ». Les restes vont dans l'inventaire (catégorie
 * « Restes maison ») avec leur date : 3 jours au frigo, 3 mois au congélateur.
 */
export function LeftoversSheet({ title, visible, onClose }: { title: string; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const snackbar = useSnackbar();
  const [portions, setPortions] = useState(1);
  const restes = getCategory('restes');

  const save = (location: 'frigo' | 'congelo') => {
    const days = location === 'frigo' ? restes.shelfDays : (restes.freezerDays ?? 90);
    const id = addItem({
      name: `Restes : ${title}`,
      category: 'restes',
      quantity: portions,
      unit: 'portion',
      location,
      dateType: location === 'frigo' ? 'DLC' : 'DDM',
      expiresAt: addDays(new Date(), days),
    });
    onClose();
    snackbar.show(`Restes ${location === 'frigo' ? 'au frigo' : 'au congélateur'} : à finir d’ici ${formatDuration(days)}`, () => setStatus(id, 'jete'));
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: 14 }}>
        <View style={styles.head}>
          <Pepin size={64} mood="sourire" />
          <View style={styles.flex}>
            <Text variant="title2">Il en reste ?</Text>
            <Text variant="body" tone="secondary">Je les note pour que personne ne les oublie au fond du frigo.</Text>
          </View>
        </View>
        <View style={styles.between}>
          <Text variant="bodyStrong">Portions restantes</Text>
          <Stepper label="portions restantes" value={portions} min={1} max={12} onChange={setPortions} format={(v) => `${v} part${v > 1 ? 's' : ''}`} />
        </View>
        <Button size="lg" label={`Au frigo (${formatDuration(restes.shelfDays)})`} icon={<Refrigerator size={20} color={colors.onPrimary} />} onPress={() => save('frigo')} />
        <Button label={`Au congélateur (${formatDuration(restes.freezerDays ?? 90)})`} variant="soft" icon={<Snowflake size={18} color={colors.primaryText} />} onPress={() => save('congelo')} />
        <Button label="Non, tout a été mangé" variant="outline" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
