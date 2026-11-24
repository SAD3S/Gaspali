import { router } from 'expo-router';
import { Calendar, Camera, X, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, OptionTiles, ProductAvatar, SegmentedControl, Sheet, Stepper, Text } from '@/components/ui';
import type { Location } from '@/data/demo';
import { applyShortcut, DATE_SHORTCUTS, formatLongDate, type DateShortcut } from '@/domain/dates';
import type { DateType } from '@/domain/freshness';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

/** Écran « Ajout après scan » — caméra simulée à l'étape 1, réelle à l'étape 3. */
export default function Scan() {
  const { colors } = useTheme();
  const [burst, setBurst] = useState(true);
  const [count, setCount] = useState(3);
  const [dateType, setDateType] = useState<DateType>('DLC');
  const [shortcut, setShortcut] = useState<DateShortcut>('+1sem');
  const [qty, setQty] = useState(1);
  const [loc, setLoc] = useState<Location>('frigo');
  const expiry = applyShortcut(new Date(), shortcut);
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

          <View style={styles.between}>
            <Text variant="bodyStrong" style={{ fontSize: 16 }}>Date limite</Text>
            <SegmentedControl<DateType>
              accessibilityLabel="Type de date"
              value={dateType}
              onChange={setDateType}
              options={[
                { value: 'DLC', label: 'DLC', hint: 'à consommer jusqu’au' },
                { value: 'DDM', label: 'DDM', hint: 'à consommer de préférence avant' },
              ]}
            />
          </View>

          <View style={styles.wrap}>
            {DATE_SHORTCUTS.map((s) => (
              <Chip key={s.key} shape="button" label={s.label} selected={shortcut === s.key} onPress={() => setShortcut(s.key)} />
            ))}
            <Pressable accessibilityRole="button" accessibilityLabel="Choisir une date" style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Calendar size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.between}>
            <Text variant="body" style={styles.flex}>
              {dateType === 'DLC' ? 'Jusqu’au ' : 'De préférence avant le '}
              <Text variant="body" style={styles.bold}>{formatLongDate(expiry)}</Text>
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Lire la date sur l’emballage" style={[styles.readDate, { backgroundColor: colors.primarySoft }]}>
              <Camera size={16} color={colors.primaryText} />
              <Text variant="label" tone="primary" style={styles.bold}>Lire la date</Text>
            </Pressable>
          </View>

          <View style={styles.between}>
            <Text variant="bodyStrong" style={{ fontSize: 16 }}>Quantité</Text>
            <Stepper label="quantité" value={qty} onChange={setQty} min={1} />
          </View>

          <OptionTiles<Location>
            accessibilityLabel="Emplacement"
            value={loc}
            onChange={setLoc}
            options={[
              { value: 'frigo', label: 'Frigo' },
              { value: 'congelo', label: 'Congélo' },
              { value: 'placard', label: 'Placard' },
            ]}
          />

          <Button size="lg" label="Ajouter et scanner le suivant" onPress={() => (burst ? setCount((c) => c + 1) : router.back())} />
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
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  iconBtn: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  readDate: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: MIN_TOUCH, borderRadius: 14 },
  bold: { fontFamily: 'DMSans_700Bold' },
});
