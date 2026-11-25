import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui';
import { EQUIPMENT, type EquipmentId } from '@/domain/equipment';
import { updateSettings, useSettings } from '@/features/settings/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH } from '@/theme/tokens';

/** Cases à cocher de l'équipement de la cuisine (enregistrées tout de suite). */
export function EquipmentPicker() {
  const { colors } = useTheme();
  const { equipment } = useSettings();
  const toggle = (id: EquipmentId) =>
    updateSettings((s) => ({ equipment: s.equipment.includes(id) ? s.equipment.filter((x) => x !== id) : [...s.equipment, id] }));

  return (
    <View style={styles.list} accessibilityLabel="Équipement de ta cuisine">
      {EQUIPMENT.map((e) => {
        const on = equipment.includes(e.id);
        return (
          <Pressable
            key={e.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${e.label} (${e.hint})`}
            onPress={() => toggle(e.id)}
            style={[styles.row, { backgroundColor: on ? colors.primarySoft : colors.surface, borderColor: on ? colors.primary : colors.border }]}
          >
            <View style={[styles.box, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : 'transparent' }]}>
              {on && <Check size={16} color={colors.onPrimary} />}
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{e.label}</Text>
              <Text variant="label" tone="secondary">{e.hint}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: 8, alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, minHeight: MIN_TOUCH + 8 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
