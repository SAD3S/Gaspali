import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { DOT_SIZE, freshnessLabels, type FreshnessState } from '@/theme/tokens';
import { Text } from './Text';

interface Props {
  state: FreshnessState;
  /** Texte affiché ; par défaut le nom de l'état (« Urgent »). */
  label?: string;
  /** La pastille (forme) est affichée par défaut, comme dans l'inventaire. */
  showDot?: boolean;
}

/** Badge de fraîcheur : couleur + libellé + forme de pastille, jamais la couleur seule. */
export function FreshnessBadge({ state, label, showDot = true }: Props) {
  const { freshness } = useTheme();
  const s = freshness[state];
  const text = label ?? freshnessLabels[state];
  return (
    <View
      accessible
      accessibilityLabel={`${freshnessLabels[state]} : ${text}`}
      style={[styles.badge, { backgroundColor: s.bg }]}
    >
      {showDot && (
        <View style={{ width: DOT_SIZE, height: DOT_SIZE, borderRadius: s.dotRadius, backgroundColor: s.fg }} />
      )}
      <Text variant="label" color={s.fg} style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontFamily: 'DMSans_700Bold' },
});
