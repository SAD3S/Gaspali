import { Calendar, Camera } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Chip, OptionTiles, SegmentedControl, Stepper, Text } from '@/components/ui';
import { CalendarSheet } from '@/components/ui/CalendarSheet';
import { UNITS } from '@/data/freshProducts';
import { LOCATION_LABELS, LOCATIONS, type Location } from '@/domain/categories';
import { applyShortcut, DATE_SHORTCUTS, daysBetween, formatLongDate, type DateShortcut } from '@/domain/dates';
import type { DateType } from '@/domain/freshness';
import { formatNumber, formatQuantity, stepFor } from '@/domain/quantity';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

export interface ItemFormValue {
  dateType: DateType;
  expiresAt: Date;
  quantity: number;
  unit: string;
  location: Location;
}

interface Props {
  value: ItemFormValue;
  onChange: (v: ItemFormValue) => void;
  /** Appelé quand l'utilisateur change d'emplacement (pour recalculer la date par défaut). */
  onLocationChange?: (loc: Location) => void;
  /** Bouton « Lire la date » (OCR, étape 3). */
  onReadDate?: () => void;
  showUnits?: boolean;
}

/** Bloc date / quantité / emplacement, partagé par le scan, l'ajout manuel et la fiche produit. */
export function ItemForm({ value, onChange, onLocationChange, onReadDate, showUnits = true }: Props) {
  const { colors } = useTheme();
  const [calendar, setCalendar] = useState(false);
  const set = (patch: Partial<ItemFormValue>) => onChange({ ...value, ...patch });
  const today = new Date();
  const activeShortcut = DATE_SHORTCUTS.find((s) => daysBetween(applyShortcut(today, s.key), value.expiresAt) === 0)?.key;

  return (
    <View style={{ gap: 18 }}>
      <View style={styles.between}>
        <Text variant="bodyStrong" style={styles.h}>Date limite</Text>
        <SegmentedControl<DateType>
          accessibilityLabel="Type de date"
          value={value.dateType}
          onChange={(dateType) => set({ dateType })}
          options={[
            { value: 'DLC', label: 'DLC', hint: 'à consommer jusqu’au' },
            { value: 'DDM', label: 'DDM', hint: 'à consommer de préférence avant' },
          ]}
        />
      </View>

      <View style={styles.wrap}>
        {DATE_SHORTCUTS.map((s) => (
          <Chip
            key={s.key}
            shape="button"
            label={s.label}
            selected={activeShortcut === s.key}
            onPress={() => set({ expiresAt: applyShortcut(new Date(), s.key as DateShortcut) })}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choisir une date dans le calendrier"
          onPress={() => setCalendar(true)}
          style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Calendar size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.between}>
        <Text variant="body" style={styles.flex}>
          {value.dateType === 'DLC' ? 'Jusqu’au ' : 'De préférence avant le '}
          <Text variant="body" style={styles.bold}>{formatLongDate(value.expiresAt)}</Text>
        </Text>
        {onReadDate && (
          <Pressable accessibilityRole="button" accessibilityLabel="Lire la date sur l’emballage" onPress={onReadDate} style={[styles.readDate, { backgroundColor: colors.primarySoft }]}>
            <Camera size={16} color={colors.primaryText} />
            <Text variant="label" tone="primary" style={styles.bold}>Lire la date</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.between}>
        <Text variant="bodyStrong" style={styles.h}>Quantité</Text>
        <Stepper
          label="quantité"
          value={value.quantity}
          step={stepFor(value.unit)}
          min={stepFor(value.unit) < 1 ? stepFor(value.unit) : 1}
          format={(q) => (value.unit === 'pièce' ? formatNumber(q) : formatQuantity(q, value.unit))}
          onChange={(quantity) => set({ quantity })}
        />
      </View>

      {showUnits && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.units} accessibilityLabel="Unité">
          {UNITS.map((u) => (
            <Chip
              key={u}
              label={u}
              selected={value.unit === u}
              onPress={() => {
                // Remettre une quantité cohérente quand on change d'unité.
                const q = u === 'g' ? 250 : u === 'cl' ? 20 : 1;
                set({ unit: u, quantity: u === value.unit ? value.quantity : q });
              }}
            />
          ))}
        </ScrollView>
      )}

      <OptionTiles<Location>
        accessibilityLabel="Emplacement"
        value={value.location}
        onChange={(location) => (onLocationChange ? onLocationChange(location) : set({ location }))}
        options={LOCATIONS.map((l) => ({ value: l, label: LOCATION_LABELS[l] }))}
      />

      <CalendarSheet
        key={value.expiresAt.getTime()}
        visible={calendar}
        value={value.expiresAt}
        onClose={() => setCalendar(false)}
        onConfirm={(d) => {
          set({ expiresAt: d });
          setCalendar(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  h: { fontSize: 16 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  units: { gap: 8 },
  iconBtn: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  readDate: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: MIN_TOUCH, borderRadius: 14 },
  bold: { fontFamily: 'DMSans_700Bold' },
});
