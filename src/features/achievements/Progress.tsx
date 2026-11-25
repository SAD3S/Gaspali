import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

/** Barre de progression fine. */
export function Progress({ value, color }: { value: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.surface2 }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: '100%', borderRadius: 4, backgroundColor: color ?? colors.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
});
