import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { MIN_TOUCH, radius } from '@/theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'soft' | 'outline' | 'onPrimary';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ReactNode;
  size?: 'md' | 'lg';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({ label, onPress, variant = 'primary', icon, size = 'md', disabled, style, accessibilityHint }: Props) {
  const { colors } = useTheme();
  const v = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    soft: { bg: colors.primarySoft, fg: colors.primaryText, border: colors.primarySoft },
    outline: { bg: colors.surface, fg: colors.text, border: colors.border },
    onPrimary: { bg: colors.surface, fg: colors.primaryText, border: colors.surface },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border, minHeight: size === 'lg' ? 56 : 52, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <View style={styles.row}>
        {icon}
        <Text variant="bodyStrong" color={v.fg} style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.button, borderWidth: 1, paddingHorizontal: 20, justifyContent: 'center', minWidth: MIN_TOUCH },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 16 },
});
