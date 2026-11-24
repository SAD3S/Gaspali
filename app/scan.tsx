import { router } from 'expo-router';
import { Leaf, X, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ProductAvatar, Sheet, Text, useSnackbar } from '@/components/ui';
import { addItem } from '@/db/inventoryRepo';
import { getCategory, type Location } from '@/domain/categories';
import { defaultExpiry } from '@/domain/inventory';
import { ItemForm, type ItemFormValue } from '@/features/inventory/ItemForm';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

/** Écran « Ajout après scan » — caméra simulée à l'étape 1, réelle à l'étape 3. */
export default function Scan() {
  const { colors } = useTheme();
  const [burst, setBurst] = useState(true);
  const [count, setCount] = useState(3);
  const snackbar = useSnackbar();
  // Produit simulé jusqu'à l'étape 3 (caméra + Open Food Facts).
  const product = { name: 'Crème fraîche épaisse', category: 'laitier', quantity: 20, unit: 'cl' };
  const initialForm = (): ItemFormValue => {
    const c = getCategory(product.category);
    return { dateType: c.dateType, expiresAt: defaultExpiry(product.category, c.location), quantity: 1, unit: 'pièce', location: c.location };
  };
  const [form, setForm] = useState<ItemFormValue>(initialForm);
  const changeLocation = (location: Location) =>
    setForm({ ...form, location, expiresAt: defaultExpiry(product.category, location) });

  const add = () => {
    addItem({ name: product.name, category: product.category, ...form });
    snackbar.show(`${product.name} ajoutée`);
    if (burst) {
      setCount((c) => c + 1);
      setForm(initialForm());
    } else router.back();
  };
  const onDark = '#FFFFFF';
  const glass = 'rgba(255,255,255,0.12)';

  return (
    <View style={[styles.flex, { backgroundColor: colors.camera }]}>
      <SafeAreaView edges={['top']} style={styles.camera}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => router.back()} style={[styles.round, { backgroundColor: glass }]}>
            <X size={22} color={onDark} />
          </Pressable>
          <View style={[styles.burst, { backgroundColor: glass }]}>
            <Switch
              value={burst}
              onValueChange={setBurst}
              accessibilityLabel="Mode rafale"
              trackColor={{ true: colors.primary, false: '#555' }}
              thumbColor="#FFFFFF"
              style={{ transform: [{ scale: 0.8 }] }}
            />
            <Text variant="label" color={onDark} style={styles.bold}>
              Mode rafale{burst ? ` · ${count}` : ''}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Lampe torche" style={[styles.round, { backgroundColor: glass }]}>
            <Zap size={22} color={onDark} />
          </Pressable>
        </View>
        <View style={[styles.frame, { borderColor: '#4CC38A' }]} accessibilityLabel="Zone de scan du code-barres">
          <View style={[styles.laser, { backgroundColor: '#4CC38A' }]} />
        </View>
      </SafeAreaView>

      <Sheet style={styles.sheet}>
        <ScrollView contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false}>
          <View style={styles.row}>
            <ProductAvatar name="Crème fraîche" initials="Cr" state="urgent" size={56} />
            <View style={styles.flex}>
              <Text variant="title2" numberOfLines={2}>Crème fraîche épaisse</Text>
              <Text variant="body" tone="secondary">20 cl · Produits laitiers</Text>
              <Text variant="label" tone="secondary" style={{ fontSize: 12 }}>Trouvé via Open Food Facts</Text>
            </View>
          </View>

          <ItemForm value={form} onChange={setForm} onLocationChange={changeLocation} onReadDate={() => {}} showUnits={false} />

          <Button size="lg" label={burst ? 'Ajouter et scanner le suivant' : 'Ajouter'} onPress={add} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/ajout')}
            style={styles.noBarcode}
          >
            <Leaf size={18} color={colors.primaryText} />
            <Text variant="label" tone="primary" style={styles.bold}>Produit sans code-barres</Text>
          </Pressable>
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  camera: { paddingHorizontal: 16, paddingBottom: 28, alignItems: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch', paddingTop: 8 },
  round: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  burst: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingRight: 14, paddingLeft: 4, minHeight: MIN_TOUCH },
  frame: { marginTop: 28, width: 240, height: 130, borderWidth: 3, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  laser: { width: 180, height: 2 },
  sheet: { flex: 1 },
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  noBarcode: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: MIN_TOUCH },
  bold: { fontFamily: 'DMSans_700Bold' },
});
