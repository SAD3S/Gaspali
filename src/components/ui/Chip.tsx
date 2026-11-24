import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';
import { Text } from './Text';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** `pill` (filtres) ou `button` (raccourcis de date, rayon 14). */
  shape?: 'pill' | 'button';
  accessibilityLabel?: string;
}

export function Chip({ label, selected, onPress, shape = 'pill', accessibilityLabel }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      hitSlop={4}
      style={[
        styles.base,
        {
          borderRadius: shape === 'pill' ? radius.chip : radius.button,
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text variant="body" color={selected ? colors.onPrimary : colors.text} style={selected && styles.selected}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: MIN_TOUCH, paddingHorizontal: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  selected: { fontFamily: 'DMSans_700Bold' },
});
