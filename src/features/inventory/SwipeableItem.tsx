import { Check, Trash2 } from 'lucide-react-native';
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Swipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { ProductCard, Text } from '@/components/ui';
import type { FreshnessState } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';

interface Props {
  name: string;
  imageUri?: string;
  subtitle: string;
  state: FreshnessState;
  badgeLabel: string;
  onPress: () => void;
  onConsumed: () => void;
  onDiscarded: () => void;
}

/** Carte d'inventaire : glisser à droite = Consommé (vert), à gauche = Jeté (rouge). */
export function SwipeableItem({ name, imageUri, subtitle, state, badgeLabel, onPress, onConsumed, onDiscarded }: Props) {
  const { colors, freshness } = useTheme();
  const ref = useRef<SwipeableMethods>(null);

  return (
    <Swipeable
      ref={ref}
      friction={1.5}
      leftThreshold={90}
      rightThreshold={90}
      overshootLeft={false}
      overshootRight={false}
      containerStyle={styles.container}
      renderLeftActions={(_, translation) => (
        <ActionPanel translation={translation} side="left" label="Consommé" Icon={Check} bg={colors.primary} fg={colors.onPrimary} />
      )}
      renderRightActions={(_, translation) => (
        <ActionPanel translation={translation} side="right" label="Jeté" Icon={Trash2} bg={freshness.perime.fg} fg={colors.surface} />
      )}
      onSwipeableOpen={(dir) => {
        if (dir === SwipeDirection.RIGHT) onConsumed();
        else onDiscarded();
        ref.current?.reset();
      }}
    >
      <View accessibilityActions={[{ name: 'consumed', label: 'Marquer consommé' }, { name: 'discarded', label: 'Marquer jeté' }]}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'consumed' ? onConsumed() : onDiscarded())}
      >
        <ProductCard name={name} subtitle={subtitle} state={state} badgeLabel={badgeLabel} imageUri={imageUri} onPress={onPress} />
      </View>
    </Swipeable>
  );
}

/** Panneau d'action visible uniquement du côté tiré (les deux panneaux se superposent). */
function ActionPanel({ translation, side, label, Icon, bg, fg }: {
  translation: SharedValue<number>;
  side: 'left' | 'right';
  label: string;
  Icon: typeof Check;
  bg: string;
  fg: string;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: side === 'left' ? (translation.value > 0 ? 1 : 0) : translation.value < 0 ? 1 : 0,
  }));
  return (
    <Animated.View style={[styles.action, { backgroundColor: bg, alignItems: side === 'left' ? 'flex-start' : 'flex-end' }, style]}>
      <View style={styles.actionInner}>
        <Icon size={20} color={fg} />
        <Text variant="bodyStrong" color={fg} style={{ fontSize: 15 }}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.tile, overflow: 'hidden' },
  action: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, minWidth: 140 },
  actionInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
