import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';
import { Text } from './Text';

/** Bascule segmentée (DLC / DDM). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.seg, { backgroundColor: colors.surface2 }]}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }}
            accessibilityLabel={o.hint ? `${o.label}, ${o.hint}` : o.label}
            onPress={() => onChange(o.value)}
            style={[styles.segItem, sel && { backgroundColor: colors.surface }]}
          >
            <Text variant="label" color={sel ? colors.text : colors.textSecondary} style={sel && { fontFamily: 'DMSans_700Bold' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Quantité − / + */
export function Stepper({ value, onChange, min = 0, label }: { value: number; onChange: (v: number) => void; min?: number; label: string }) {
  const { colors } = useTheme();
  const btn = [styles.stepBtn, { backgroundColor: colors.surface }];
  return (
    <View style={[styles.stepper, { backgroundColor: colors.surface2 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Diminuer ${label}`} onPress={() => onChange(Math.max(min, value - 1))} style={btn}>
        <Minus size={18} color={colors.text} />
      </Pressable>
      <Text variant="bodyStrong" accessibilityLabel={`${label} : ${value}`} style={styles.stepValue}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Augmenter ${label}`} onPress={() => onChange(value + 1)} style={btn}>
        <Plus size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

/** Choix exclusif en grosses tuiles (Frigo / Congélo / Placard). */
export function OptionTiles<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.tiles}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: sel }}
            onPress={() => onChange(o.value)}
            style={[
              styles.tile,
              {
                backgroundColor: sel ? colors.primarySoft : colors.surface2,
                borderColor: sel ? colors.primary : colors.surface2,
                borderWidth: sel ? 2 : 1,
              },
            ]}
          >
            <Text variant="body" color={sel ? colors.primaryText : colors.text} style={sel && { fontFamily: 'DMSans_700Bold' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segItem: { minHeight: 38, minWidth: 54, paddingHorizontal: 12, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.button, padding: 4, gap: 4 },
  stepBtn: { width: MIN_TOUCH - 4, height: MIN_TOUCH - 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 32, textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, minHeight: 48, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
});
