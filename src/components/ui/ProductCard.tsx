import { StyleSheet, View } from 'react-native';
// Pressable de gesture-handler : un glissement (Swipeable) annule le toucher.
import { Pressable } from 'react-native-gesture-handler';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, type FreshnessState } from '@/theme/tokens';
import { FreshnessBadge } from './FreshnessBadge';
import { ProductAvatar } from './ProductAvatar';
import { Text } from './Text';

interface Props {
  name: string;
  subtitle: string;
  state: FreshnessState;
  badgeLabel: string;
  initials?: string;
  imageUri?: string;
  /** `card` : carte bordée (inventaire). `row` : ligne nue (liste « À consommer vite »). */
  variant?: 'card' | 'row';
  showDot?: boolean;
  onPress?: () => void;
}

export function ProductCard({ name, subtitle, state, badgeLabel, initials, imageUri, variant = 'card', showDot, onPress }: Props) {
  const { colors } = useTheme();
  const isCard = variant === 'card';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${subtitle}, ${badgeLabel}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isCard && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.tile, padding: 12 },
        !isCard && { paddingVertical: 6 },
        pressed && { opacity: 0.85 },
      ]}
    >
      <ProductAvatar name={name} initials={initials} imageUri={imageUri} state={state} />
      <View style={styles.texts}>
        <Text variant="bodyStrong" numberOfLines={1}>{name}</Text>
        <Text variant="label" tone="secondary" numberOfLines={1}>{subtitle}</Text>
      </View>
      <FreshnessBadge state={state} label={badgeLabel} showDot={showDot ?? isCard} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  texts: { flex: 1, gap: 2 },
});
